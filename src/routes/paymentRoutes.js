const express = require("express");
const {
  createOrder,
  verifyPayment,
  cancelPaymentAttempt,
  razorpayWebhook,
} = require("../controllers/paymentController.js");
const optionalAuth = require("../middleware/optionalAuth.js");

const router = express.Router();

router.post("/create-order", optionalAuth, createOrder);
router.post("/verify-payment", verifyPayment);
router.post("/cancel-attempt", cancelPaymentAttempt);
router.post("/webhook", express.raw({ type: "application/json" }), razorpayWebhook);

module.exports = router;
