const crypto = require('crypto');
const dotenv = require("dotenv");
dotenv.config();
const { razor } = require('../config/razorpay.js');
const Order = require('../models/Order.js');

exports.createOrder = async (req, res) => {  
  try {
    const { amount, currency, orderData } = req.body;
    const userId = req.user ? req.user.id : null;
    
    const rzpOrder = await razor.orders.create({
      amount: amount * 100,
      currency: currency || "INR",
      receipt: "rcpt_" + Date.now(),
      notes: { userId }
    });
    
    // Resolve products from DB to match Order schema exactly
    const Product = require('../models/Product.js');
    let orderItems = [];
    for (let item of orderData.items) {
        const mongoose = require("mongoose");
        let product = null;
        const pId = item.productId || item.id;
        if (pId && mongoose.Types.ObjectId.isValid(pId)) {
            product = await Product.findById(pId);
        }
        if (!product && item.slug) {
            product = await Product.findOne({ slug: item.slug });
        }
        if (!product && item.name) {
            product = await Product.findOne({ name: new RegExp(item.name.trim(), "i") });
        }
        const sizeData = product.sizes ? product.sizes.find(s => s.size === item.size) : null;
        orderItems.push({
            productId: product._id,
            productName: product.name,
            productImage: product.images[0],
            size: item.size,
            mrp: sizeData ? sizeData.mrp : item.price,
            price: sizeData ? sizeData.sellingPrice : item.price,
            quantity: item.quantity
        });
    }

    let freeSample = null;
    if (orderData.sampleId) {
        const sampleProduct = await Product.findById(orderData.sampleId);
        if (sampleProduct) {
            freeSample = {
                productId: sampleProduct._id,
                productName: sampleProduct.name,
                productImage: sampleProduct.images,
                size: "1 ml"
            };
        }
    }

    const customer = {
        name: orderData.shippingAddress?.name || req.user?.name,
        email: req.user?.email,
        phone: orderData.shippingAddress?.phone || req.user?.phone,
        alternatePhone: orderData.shippingAddress?.alternatePhone || "",
        street: orderData.shippingAddress?.street || "",
        city: orderData.shippingAddress?.city || "",
        state: orderData.shippingAddress?.state || "",
        pincode: orderData.shippingAddress?.pincode || ""
    };

    const newOrder = new Order({
      userId,
      items: orderItems,
      freeSample,
      customer,
      totalAmount: amount,
      paymentStatus: "pending",
      paymentMethod: "online"
    });
    
    const savedOrder = await newOrder.save();

    res.status(200).json({
      success: true,
      message: "order created",
      order: rzpOrder,
      localOrderId: savedOrder._id,
      myOrders: rzpOrder.notes
    });

  } catch (err) {
    console.error("Razorpay Error:", err);
    res.status(500).json({ message: "error" });
  }
};

exports.verifyPayment = async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      localOrderId,
    } = req.body;
   
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expected = crypto
      .createHmac("sha256", process.env.RAZORPAY_SECRET)
      .update(body)
      .digest("hex");

    if (expected === razorpay_signature) {
            const updatedOrder = await Order.findByIdAndUpdate(localOrderId, {
        paymentStatus: 'paid',
        orderStatus: 'placed'
      }, { new: true });

            // Trigger Admin Notifications (HTML Email to worldofbrunati@gmail.com & SMS to +918767692853)
      try {
        await notifyAdminNewOrder(updatedOrder);
        await Order.findByIdAndUpdate(localOrderId, { adminNotified: true });
      } catch (mailErr) {
        console.error("Admin Payment Notification Dispatch Error:", mailErr.message);
      }

      res.json({
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
        localOrderId,
        success: true 
      });

    } else {
      await Order.findByIdAndUpdate(localOrderId, {
        paymentStatus: 'failed'
      });

            // Send Failed Payment Alert to Admin
      try {
        const failedOrder = await Order.findById(localOrderId);
        await sendEmail({
          email: process.env.ADMIN_EMAIL || "worldofbrunati@gmail.com",
          subject: `?? Payment Failed for Order #${failedOrder?.orderId || localOrderId}`,
          message: `Payment Failed Alert!\nOrder: #${failedOrder?.orderId || localOrderId}\nCustomer: ${failedOrder?.customer?.name} (${failedOrder?.customer?.phone})\nAmount: ?${failedOrder?.totalAmount}\nStatus: FAILED / CANCELLED\n\nPlease check Admin Dashboard.`
        });
      } catch (errAlert) {
        console.error("Failed Payment Alert Error:", errAlert.message);
      }
      res.json({ success: false, message: "Payment verification failed" });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
};

exports.razorpayWebhook = async (req, res) => {
  try {
      console.log("Webhook received");
    console.log(req.headers);
    console.log(req.body);

    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || '12345678';
    const signature = req.headers["x-razorpay-signature"];

    const digest = crypto
      .createHmac("sha256", webhookSecret)
      .update(JSON.stringify(req.body))
      .digest("hex");

    if (signature !== digest) {
      return res.status(400).json({ message: "Invalid signature" });
    }

      console.log("Verified Successfully");
    res.json({ status: "ok" ,ok: true });
  } catch {
    res.status(500).json({ ok: false });
  }
};

exports.sendPdf = async (req, res) => {
  try {
    res.json({ status: "ok" ,ok: true });
  } catch {
    res.status(500).json({ ok: false });
  }
};