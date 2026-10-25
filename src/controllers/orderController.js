const Order = require("../models/Order");
const Product = require("../models/Product");
const Settings = require("../models/Settings");
const sendEmail = require("../utils/emailService");
const { notifyAdminNewOrder } = require("../utils/adminNotificationService");
const { notifyCustomerOrderSuccess } = require("../utils/customerNotificationService");
const mongoose = require("mongoose");

exports.createOrder = async (req, res) => {
    try {
        const { items, sampleId, shippingAddress, paymentMethod } = req.body;

        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({
                status: false,
                message: "Order items cannot be empty",
                data: null
            });
        }

        if (req.user && shippingAddress) {
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
            name:    shippingAddress?.name || req.user?.name || "Customer",
            email:   shippingAddress?.email || req.user?.email || "guest@brunati.in",
            phone:   shippingAddress?.phone || req.user?.phone || "",
            alternatePhone: shippingAddress?.alternatePhone || "",
            street:  shippingAddress?.street || "",
            city:    shippingAddress?.city || "",
            state:   shippingAddress?.state || "",
            pincode: shippingAddress?.pincode || ""
        };

        let orderItems = [];
        let subtotal = 0;

        for (let item of items) {
            const pId = item.productId || item.id;
            const product = await Product.findById(pId);

            if (!product) {
                return res.status(400).json({
                    status: false,
                    message: `Product not found: ${item.name || pId}`,
                    data: null
                });
            }

            const sizeData = product.sizes?.find(
                s => s.size === item.size
            );

            if (!sizeData) {
                return res.status(400).json({
                    status: false,
                    message: `Selected variant (${item.size}) for ${product.name} not found`,
                    data: null
                });
            }

            const qty = Number(item.quantity) || 1;
            orderItems.push({
                productId: product._id,
                productName: product.name,
                productImage: product.images,
                size: item.size,
                mrp: sizeData.mrp,
                price: sizeData.sellingPrice,
                quantity: qty
            });

            subtotal += sizeData.sellingPrice * qty;
        }

        // Fetch authoritative system settings
        const settings = await Settings.findOne() || { freeSampleEnabled: true, codCharge: 0, allowedGifts: [] };

        // Validate Free Gift Security
        let freeSample = null;
        if (sampleId && settings.freeSampleEnabled) {
            const isAllowed = (!settings.allowedGifts || settings.allowedGifts.length === 0)
                || settings.allowedGifts.some(gId => gId.toString() === sampleId.toString());

            if (isAllowed) {
                const sampleProduct = await Product.findById(sampleId);
                if (sampleProduct && sampleProduct.isActive) {
                    freeSample = {
                        productId: sampleProduct._id,
                        productName: sampleProduct.name,
                        productImage: sampleProduct.images,
                        size: "1 ml"
                    };
                }
            }
        }

        // Authoritative pricing calculation
        const deliveryCharge = 0; // Free Standard Delivery
        const selectedMethod = paymentMethod === "COD" ? "COD" : "online";
        const codCharge = selectedMethod === "COD" ? Number(settings.codCharge || 0) : 0;
        const totalAmount = subtotal + deliveryCharge + codCharge;

        const order = await Order.create({
            userId: req.user ? req.user._id : null,
            customer,
            items: orderItems,
            freeSample,
            subtotal,
            deliveryCharge,
            codCharge,
            totalAmount,
            paymentMethod: selectedMethod,
            paymentStatus: selectedMethod === "COD" ? "pending" : "pending",
            orderStatus: "placed"
        });

        // Send response immediately so checkout completes in milliseconds without waiting on external SMTP
        res.status(201).json({
            status: true,
            message: "Order created successfully",
            data: order
        });

        // 1. Send Order Confirmation Email to Customer in background
        notifyCustomerOrderSuccess(order).catch(err => {
            console.error("Customer Email Error:", err.message);
        });

        // 2. Trigger Admin Notification in background
        notifyAdminNewOrder(order)
            .then(() => Order.findByIdAndUpdate(order._id, { adminNotified: true }))
            .catch(adminErr => {
                console.error("Admin Notification Dispatch Error:", adminErr.message);
            });

    } catch (error) {
        console.error("Create Order Error:", error);
        res.status(500).json({
            status: false,
            message: error.message,
            data: null
        });
    }
};

exports.getOrderById = async (req, res) => {
    try {
        const idParam = req.params.orderId;
        let query = {};
        if (mongoose.Types.ObjectId.isValid(idParam)) {
            query = { $or: [{ _id: idParam }, { orderId: idParam }] };
        } else {
            query = { orderId: idParam };
        }

        // If user is authenticated and not admin, match user ID
        if (req.user && !req.user.isAdmin) {
            query.$or = [
                ...(query.$or || [query]),
                { userId: req.user._id }
            ];
        }

        const order = await Order.findOne(query);

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

        // Only allow cancellation if order hasn't been shipped/delivered yet
        if (!["placed", "confirmed"].includes(order.orderStatus)) {
            return res.status(400).json({ 
                status: false, 
                message: `Cannot cancel order in '${order.orderStatus}' status. Please contact support.`, 
                data: null 
            });
        }

        order.orderStatus = "cancelled";
        await order.save();

        if (order.customer?.email) {
            try {
                await sendEmail({
                    email: order.customer.email,
                    subject: `Order Cancelled: #${order.orderId}`,
                    message: `Hello ${order.customer.name},\n\nYour order #${order.orderId} has been cancelled.\n\nBest regards,\nBrunati Perfumes`
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
