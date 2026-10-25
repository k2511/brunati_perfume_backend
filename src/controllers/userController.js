const User = require("../models/User");
const Order = require("../models/Order");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

exports.registerUser = async (req, res) => {
    try {

        const { name, email, password, phone } = req.body;

        if (!phone || !password) {
            return res.status(400).json({ status: false, message: "Phone and password are required", data: null });
        }

        const userExists = await User.findOne({ phone });

        if (userExists) {
            return res.status(400).json({ status: false, message: "User already exists with this phone number", data: null });
        }

        const user = await User.create({
            name,
            email,
            password,
            phone
        });

        res.status(201).json({
            status: true,
            message: "User registered successfully",
            data: user
        });

    } catch (error) {
        res.status(500).json({ status: false, message: error.message, data: null });
    }
};

const COOKIE_OPTIONS = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production", // Secure in production
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax", // Cross-site support in production
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    path: "/"
};

exports.loginUser = async (req, res) => {

    try {

        const { phone, password } = req.body;

        if (!phone || !password) {
            return res.status(400).json({ status: false, message: "Phone and password are required", data: null });
        }

        const user = await User.findOne({ phone });

        if (!user) {
            return res.status(400).json({ status: false, message: "Invalid credentials", data: null });
        }

        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(400).json({ status: false, message: "Invalid credentials", data: null });
        }

        const token = jwt.sign(
            { id: user._id },
            process.env.JWT_SECRET,
            { expiresIn: "30d" }
        );

        res.cookie("token", token, COOKIE_OPTIONS);

        res.json({
            status: true,
            message: "Login successful",
            data: { user, token }
        });

    } catch (error) {
        res.status(500).json({ status: false, message: error.message, data: null });
    }

};

exports.logoutUser = async (req, res) => {

    res.clearCookie("token", COOKIE_OPTIONS);

    res.json({ status: true, message: "Logged out successfully", data: null });

};

exports.getProfile = async (req, res) => {

    const user = await User.findById(req.user.id).select("-password");

    res.json({ status: true, message: "Profile fetched successfully", data: user });

};

exports.getUserOrders = async (req, res) => {

    const orders = await Order.find({ 
        userId: req.user.id,  
        $or: [
            { paymentStatus: 'paid' },
            { paymentMethod: 'COD' }
        ]
    });

    res.json({ status: true, message: "Orders fetched successfully", data: orders });

};

exports.updateAddress = async (req, res) => {
    try {
        const { addresses } = req.body;

        if (!addresses || !Array.isArray(addresses)) {
            return res.status(400).json({ status: false, message: "addresses array is required", data: null });
        }

        const user = await User.findById(req.user.id);
        user.addresses = addresses;
        await user.save();

        res.json({ status: true, message: "Addresses updated successfully", data: user.addresses });
    } catch (error) {
        res.status(500).json({ status: false, message: error.message, data: null });
    }
};

exports.changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ status: false, message: "Both currentPassword and newPassword are required", data: null });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ status: false, message: "New password must be at least 6 characters", data: null });
        }

        const user = await User.findById(req.user.id);

        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return res.status(401).json({ status: false, message: "Current password is incorrect", data: null });
        }

        user.password = newPassword;
        await user.save(); // Pre-save hook auto-hashes the new password

        res.json({ status: true, message: "Password changed successfully", data: null });
    } catch (error) {
        res.status(500).json({ status: false, message: error.message, data: null });
    }
};

exports.forgotPassword = async (req, res) => {
    try {
        const { phone, newPassword } = req.body;

        if (!phone || !newPassword) {
            return res.status(400).json({ status: false, message: "Phone and newPassword are required", data: null });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ status: false, message: "New password must be at least 6 characters", data: null });
        }

        const user = await User.findOne({ phone });

        if (!user) {
            return res.status(404).json({ status: false, message: "User not found with this phone number", data: null });
        }

        user.password = newPassword;
        await user.save(); // Pre-save hook auto-hashes the new password

        res.json({ status: true, message: "Password reset successfully", data: null });
    } catch (error) {
        res.status(500).json({ status: false, message: error.message, data: null });
    }
};

exports.checkAuth = async (req, res) => {
    try {
        let token;
        if (req.cookies && req.cookies.token) {
            token = req.cookies.token;
        } else if (req.headers.authorization?.startsWith("Bearer")) {
            token = req.headers.authorization.split(" ")[1];
        }

        if (!token) {
            return res.json({ status: true, isLoggedIn: false, data: null });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id).select("-password");

        if (!user) {
            return res.json({ status: true, isLoggedIn: false, data: null });
        }

        res.json({ status: true, isLoggedIn: true, data: user });
    } catch (error) {
        // If JWT verify fails (expired/invalid), still return status true but isLoggedIn false
        res.json({ status: true, isLoggedIn: false, data: null });
    }
};


exports.deleteAddress = async (req, res) => {
    try {
        const { addressId } = req.params;
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ status: false, message: "User not found" });
        }

        const address = user.addresses.id(addressId);
        if (!address) {
            return res.status(404).json({ status: false, message: "Address not found or unauthorized" });
        }

        user.addresses.pull({ _id: addressId });
        await user.save();

        res.json({
            status: true,
            message: "Address deleted successfully",
            data: user.addresses
        });
    } catch (error) {
        res.status(500).json({ status: false, message: error.message });
    }
};
