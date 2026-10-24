const jwt = require("jsonwebtoken");
const User = require("../models/User");

/**
 * Optional Authentication Middleware
 * If a valid JWT token is present in cookies or Authorization header,
 * populates req.user. If no token is provided or token is invalid,
 * req.user is set to null and request proceeds gracefully without returning 401.
 */
const optionalAuth = async (req, res, next) => {
    let token;

    if (req.cookies && req.cookies.token) {
        token = req.cookies.token;
    } else if (
        req.headers.authorization &&
        req.headers.authorization.startsWith("Bearer")
    ) {
        token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
        req.user = null;
        return next();
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = await User.findById(decoded.id).select("-password");
    } catch (error) {
        // Token invalid or expired - treat as guest instead of throwing 401
        req.user = null;
    }

    next();
};

module.exports = optionalAuth;
