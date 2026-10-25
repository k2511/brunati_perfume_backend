const express = require("express");
const router = express.Router();
const orderController = require("../controllers/orderController");

const authMiddleware = require("../middleware/authMiddleware");
const optionalAuth = require("../middleware/optionalAuth");

// Allow guest checkout / fast mobile checkout for placing orders and viewing confirmation
router.post("/", optionalAuth, orderController.createOrder);
router.get("/:orderId", optionalAuth, orderController.getOrderById);
router.post("/:orderId/cancel", authMiddleware, orderController.cancelOrder);

module.exports = router;
