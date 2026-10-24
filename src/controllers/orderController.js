const Order = require("../models/Order");
const Product = require("../models/Product");
const sendEmail = require("../utils/emailService");

exports.createOrder = async (req, res) => {
    try {


        const { items, sampleId, shippingAddress, paymentMethod } = req.body;

        if (shippingAddress) {
            // Check if this address already exists structurally
            const existingNum = req.user.addresses?.findIndex(a => 
                a.street === shippingAddress.street && 
                a.pincode === shippingAddress.pincode &&
                a.city === shippingAddress.city
            );

            if (existingNum === -1 || existingNum === undefined) {
                if (!req.user.addresses) req.user.addresses = [];
                req.user.addresses.push({
                    name: shippingAddress.name || req.user.name,
                    phone: shippingAddress.phone || req.user.phone,
                    alternatePhone: shippingAddress.alternatePhone || "",
                    street: shippingAddress.street,
                    city: shippingAddress.city,
                    state: shippingAddress.state,
                    pincode: shippingAddress.pincode
                });
                await req.user.save();
            } else if (existingNum >= 0 && req.user.addresses) {
                // Update specific phone or name if they changed the name
                req.user.addresses[existingNum].name = shippingAddress.name || req.user.addresses[existingNum].name;
                req.user.addresses[existingNum].phone = shippingAddress.phone || req.user.addresses[existingNum].phone;
                req.user.addresses[existingNum].alternatePhone = shippingAddress.alternatePhone || req.user.addresses[existingNum].alternatePhone;
                await req.user.save();
            }
        }

        // Populate customer info for the Order model
        const customer = {
            name:    shippingAddress?.name || req.user.name,
            email:   req.user.email,
            phone:   shippingAddress?.phone || req.user.phone,
            alternatePhone: shippingAddress?.alternatePhone || "",
            street:  shippingAddress?.street || "",
            city:    shippingAddress?.city || "",
            state:   shippingAddress?.state || "",
            pincode: shippingAddress?.pincode || ""
        };

        let orderItems = [];
        let total = 0;

        for (let item of items) {

            const product = await Product.findById(item.productId);

            const sizeData = product.sizes.find(
                s => s.size === item.size
            );

            if (!sizeData) {
                return res.status(400).json({
                    status: false,
                    message: "Selected product variant not found",
                    data: null
                });
            }

            orderItems.push({
                productId: product._id,
                productName: product.name,
                productImage: product.images[0],
                size: item.size,
                mrp: sizeData.mrp,
                price: sizeData.sellingPrice,
                quantity: item.quantity
            });

            total += sizeData.sellingPrice * item.quantity;

            // Stock decrement bypassed as per "Always Available" policy
        }

        let freeSample = null;

        if (sampleId) {
            // Now sampleId is actually a Product ID for a 1ml sample
            const sampleProduct = await Product.findById(sampleId);

            if (sampleProduct && sampleProduct.isActive) {
                freeSample = {
                    productId: sampleProduct._id,
                    productName: sampleProduct.name,
                    productImage: sampleProduct.images,
                    size: "1 ml"
                };
                // Samples don't have separate stock management now as per new requirement
            }
        }

        const order = await Order.create({
            userId: req.user._id,
            customer,
            items: orderItems,
            freeSample,
            totalAmount: total,
            paymentMethod: paymentMethod || "COD"
        });

        // ✅ Email: Order Placed (Awaited for Vercel/Reliability)
                // 1. Send Order Confirmation to Customer
        if (req.user.email) {
            try {
                await sendEmail({
                    email: req.user.email,
                    subject: `Order Confirmed! Your Brunati Order #${order.orderId}`,
                    message: `Hello ${req.user.name},\n\nThank you for your order! We have received your order #${order.orderId} for ?${order.totalAmount}.\n\nWe will notify you when your order ships.\n\nThank you for choosing Brunati.`
                });
            } catch (err) {
                console.error("Customer Email Error:", err.message);
            }
        }

        // 2. Send New Order Alert to Admin
        try {
            const adminEmail = process.env.ADMIN_NOTIFY_EMAIL || process.env.EMAIL_USER || "worldofbrunati@gmail.com";
            await sendEmail({
                email: adminEmail,
                subject: `?? New Order Alert! Brunati Order #${order.orderId}`,
                message: `New Order Received!\n\nOrder ID: #${order.orderId}\nCustomer: ${order.customer?.name || req.user.name} (${req.user.email})\nPhone: ${order.customer?.phone || req.user.phone || 'N/A'}\nTotal Amount: ?${order.totalAmount}\nPayment Method: ${order.paymentMethod}\nShipping: ${order.customer?.street || ''}, ${order.customer?.city || ''}, ${order.customer?.state || ''} - ${order.customer?.pincode || ''}\n\nCheck your Admin Panel for full details.`
            });
        } catch (adminErr) {
            console.error("Admin Alert Email Error:", adminErr.message);
        }

        res.status(201).json({
            status: true,
            message: "Order created successfully",
            data: order
        });

    } catch (error) {

        res.status(500).json({
            status: false,
            message: error.message,
            data: null
        });

    }

};

exports.getOrderById = async (req, res) => {
    try {
        const order = await Order.findOne({
            orderId: req.params.orderId,
            userId: req.user._id // Security: Ensure customer can only view their own order
        });

        if (!order) {
            return res.status(404).json({ status: false, message: "Order not found", data: null });
        }

        res.json({ status: true, message: "Order fetched successfully", data: order });
    } catch (error) {
        res.status(500).json({ status: false, message: error.message, data: null });
    }
};

exports.cancelOrder = async (req, res) => {
    try {
        const order = await Order.findOne({
            orderId: req.params.orderId,
            userId: req.user._id
        });

        if (!order) {
            return res.status(404).json({ status: false, message: "Order not found", data: null });
        }

        // Only allow cancellation if order hasn't been processed/shipped yet
        if (!["placed", "confirmed"].includes(order.orderStatus)) {
            return res.status(400).json({ 
                status: false, 
                message: `Cannot cancel order in '${order.orderStatus}' status. Please contact support.`, 
                data: null 
            });
        }

        // 1. Items are always available, no need to return to stock

        // 2. Samples don't have separate stock records in the new system
        
        // 3. Update order status
        order.orderStatus = "cancelled";
        await order.save();


        // 4. Send Email (Awaited)
        if (order.customer.email) {
            try {
                await sendEmail({
                    email: order.customer.email,
                    subject: `Order Cancelled: #${order.orderId}`,
                    message: `Hello ${order.customer.name},\n\nYour order #${order.orderId} has been successfully cancelled as per your request.\n\nIf this was a mistake, please reach out to us.\n\nBest regards,\nBrunati Team`
                });
            } catch (err) {
                console.error("Cancellation Email Error:", err.message);
            }
        }

        res.json({ status: true, message: "Order cancelled successfully", data: order });

    } catch (error) {
        res.status(500).json({ status: false, message: error.message, data: null });
    }
};