const crypto = require('crypto');
const dotenv = require("dotenv");
dotenv.config();
const { razor } = require('../config/razorpay.js');
const Order = require('../models/Order.js');
const Product = require('../models/Product.js');
const Settings = require('../models/Settings.js');
const mongoose = require("mongoose");
const { notifyAdminNewOrder } = require("../utils/adminNotificationService.js");
const { notifyCustomerOrderSuccess, notifyCustomerPaymentFailed } = require("../utils/customerNotificationService.js");

exports.createOrder = async (req, res) => {  
  try {
    const { amount, currency, orderData, existingOrderId } = req.body;
    const userId = req.user ? req.user.id : null;

    if (!orderData || !orderData.items || !Array.isArray(orderData.items) || orderData.items.length === 0) {
      // If legacy format sent only amount
      if (amount && Number(amount) > 0) {
        const rzpOrder = await razor.orders.create({
          amount: Math.round(Number(amount) * 100),
          currency: currency || "INR",
          receipt: "rcpt_" + Date.now(),
          notes: { userId: userId ? userId.toString() : "guest" }
        });
        return res.status(200).json({ success: true, order: rzpOrder });
      }
      return res.status(400).json({ status: false, message: "Order items cannot be empty" });
    }

    // 1. Authoritative calculation from DB Product data (DO NOT trust client amounts)
    let orderItems = [];
    let subtotal = 0;

    for (let item of orderData.items) {
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

      if (!product) {
        return res.status(400).json({ status: false, message: `Product not found: ${item.name || pId}` });
      }

      const sizeData = product.sizes ? product.sizes.find(s => s.size === item.size) : null;
      if (!sizeData) {
        return res.status(400).json({ status: false, message: `Variant (${item.size}) for ${product.name} not found` });
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

    // 2. Fetch authoritative system settings
    const settings = await Settings.findOne() || { freeSampleEnabled: true, allowedGifts: [], codCharge: 0 };

    // 3. Validate Free Gift Security
    let freeSample = null;
    if (orderData.sampleId && settings.freeSampleEnabled) {
      const isAllowed = (!settings.allowedGifts || settings.allowedGifts.length === 0)
        || settings.allowedGifts.some(gId => gId.toString() === orderData.sampleId.toString());

      if (isAllowed) {
        const sampleProduct = await Product.findById(orderData.sampleId);
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

    // 4. Authoritative pricing
    const deliveryCharge = 0; // Free Standard Delivery
    const codCharge = 0; // 0 for online payment
    const totalAmount = subtotal > 0 ? (subtotal + deliveryCharge + codCharge) : (Number(amount) || 0);

    const customer = {
      name: orderData.shippingAddress?.name || req.user?.name || "Customer",
      email: orderData.shippingAddress?.email || req.user?.email || "guest@brunati.in",
      phone: orderData.shippingAddress?.phone || req.user?.phone || "",
      alternatePhone: orderData.shippingAddress?.alternatePhone || "",
      street: orderData.shippingAddress?.street || "",
      city: orderData.shippingAddress?.city || "",
      state: orderData.shippingAddress?.state || "",
      pincode: orderData.shippingAddress?.pincode || ""
    };

    // 5. Create Razorpay Order
    const rzpOrder = await razor.orders.create({
      amount: Math.round(totalAmount * 100), // in paise
      currency: currency || "INR",
      receipt: "rcpt_" + Date.now(),
      notes: { userId: userId ? userId.toString() : "guest" }
    });

    // 6. Reuse pending order on retry or create new
    let savedOrder;
    if (existingOrderId && mongoose.Types.ObjectId.isValid(existingOrderId)) {
      const existing = await Order.findById(existingOrderId);
      if (existing && existing.paymentStatus === 'pending') {
        existing.items = orderItems;
        existing.freeSample = freeSample;
        existing.customer = customer;
        existing.subtotal = subtotal;
        existing.deliveryCharge = deliveryCharge;
        existing.codCharge = codCharge;
        existing.totalAmount = totalAmount;
        existing.razorpayOrderId = rzpOrder.id;
        savedOrder = await existing.save();
      }
    }

    if (!savedOrder) {
      const newOrder = new Order({
        userId,
        items: orderItems,
        freeSample,
        customer,
        subtotal,
        deliveryCharge,
        codCharge,
        totalAmount,
        paymentStatus: "pending",
        paymentMethod: "online",
        razorpayOrderId: rzpOrder.id
      });
      savedOrder = await newOrder.save();
    }

    res.status(200).json({
      success: true,
      message: "Order initiated successfully",
      order: rzpOrder,
      localOrderId: savedOrder._id,
      orderId: savedOrder.orderId
    });

  } catch (err) {
    console.error("Razorpay Order Creation Error:", err);
    res.status(500).json({ success: false, message: err.message || "Failed to create order" });
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
      .createHmac("sha256", (process.env.RAZORPAY_SECRET || "").trim())
      .update(body)
      .digest("hex");

    if (expected === razorpay_signature) {
      const updatedOrder = await Order.findByIdAndUpdate(localOrderId, {
        paymentStatus: 'paid',
        orderStatus: 'placed',
        razorpayPaymentId: razorpay_payment_id,
        razorpaySignature: razorpay_signature
      }, { new: true });

      res.json({
        success: true,
        razorpay_order_id,
        razorpay_payment_id,
        localOrderId,
        orderId: updatedOrder?.orderId || localOrderId
      });

      if (updatedOrder) {
        // Trigger notifications asynchronously in background
        notifyAdminNewOrder(updatedOrder).catch(mailErr => {
          console.error("Admin Payment Notification Dispatch Error:", mailErr.message);
        });

        notifyCustomerOrderSuccess(updatedOrder).catch(custMailErr => {
          console.error("Customer Receipt Dispatch Error:", custMailErr.message);
        });
      }

    } else {
      const failedOrder = await Order.findByIdAndUpdate(localOrderId, {
        paymentStatus: 'failed',
        paymentFailureReason: 'Signature verification mismatch'
      }, { new: true });

      if (failedOrder) {
        try {
          await notifyCustomerPaymentFailed(failedOrder, 'Payment signature verification failed');
        } catch (failErr) {
          console.error("Customer Failure Notification Error:", failErr.message);
        }
      }

      res.json({ success: false, message: "Payment verification failed" });
    }
  } catch (err) {
    console.error("Payment Verification Error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.razorpayWebhook = async (req, res) => {
  try {
    const webhookSecret = (process.env.RAZORPAY_WEBHOOK_SECRET || '12345678').trim();
    const signature = req.headers["x-razorpay-signature"];

    // Use rawBody captured directly from incoming byte stream before JSON parsing
    const payloadBuffer = req.rawBody 
      || (Buffer.isBuffer(req.body) ? req.body : Buffer.from(typeof req.body === 'string' ? req.body : JSON.stringify(req.body)));

    const digest = crypto
      .createHmac("sha256", webhookSecret)
      .update(payloadBuffer)
      .digest("hex");

    if (signature !== digest) {
      console.warn("Webhook Signature Mismatch");
      return res.status(400).json({ message: "Invalid signature" });
    }

    const event = JSON.parse(payloadBuffer.toString());
    const eventName = event.event;
    console.log(`[RAZORPAY WEBHOOK] Received event: ${eventName}`);

    if (eventName === "payment.captured" || eventName === "order.paid") {
      const pEntity = event.payload?.payment?.entity;
      const rzpOrderId = pEntity?.order_id || event.payload?.order?.entity?.id;
      const rzpPaymentId = pEntity?.id;

      if (rzpOrderId) {
        const order = await Order.findOne({ razorpayOrderId: rzpOrderId });
        if (order) {
          if (order.paymentStatus === 'paid') {
            console.log(`Order #${order.orderId} is already marked as paid. Skipping duplicate webhook.`);
            return res.json({ status: "ok", message: "Already processed" });
          }

          order.paymentStatus = 'paid';
          order.orderStatus = 'placed';
          if (rzpPaymentId) order.razorpayPaymentId = rzpPaymentId;
          await order.save();

          await notifyAdminNewOrder(order);
          await notifyCustomerOrderSuccess(order);
        }
      }
    } else if (eventName === "payment.failed") {
      const pEntity = event.payload?.payment?.entity;
      const rzpOrderId = pEntity?.order_id;
      const errorDesc = pEntity?.error_description || "Payment failed";

      if (rzpOrderId) {
        const order = await Order.findOne({ razorpayOrderId: rzpOrderId });
        if (order && order.paymentStatus !== 'paid') {
          order.paymentStatus = 'failed';
          order.paymentFailureReason = errorDesc;
          await order.save();

          await notifyCustomerPaymentFailed(order, errorDesc);
        }
      }
    }

    res.json({ status: "ok", ok: true });
  } catch (error) {
    console.error("Webhook Processing Error:", error);
    res.status(500).json({ ok: false, message: error.message });
  }
};

exports.sendPdf = async (req, res) => {
  try {
    res.json({ status: "ok", ok: true });
  } catch {
    res.status(500).json({ ok: false });
  }
};
