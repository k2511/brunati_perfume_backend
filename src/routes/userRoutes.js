const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController");
const authMiddleware = require("../middleware/authMiddleware");

router.post("/register", userController.registerUser);
router.post("/login", userController.loginUser);
router.post("/logout", userController.logoutUser);
router.post("/forgot-password", userController.forgotPassword);

router.get("/me", authMiddleware, userController.getProfile);
router.get("/check-auth", userController.checkAuth);
router.put("/me/address", authMiddleware, userController.updateAddress);
router.delete("/me/address/:addressId", authMiddleware, userController.deleteAddress);

router.put("/me/password", authMiddleware, userController.changePassword);
router.get("/orders", authMiddleware, userController.getUserOrders);

module.exports = router;
