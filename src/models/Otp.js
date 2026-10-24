const mongoose = require("mongoose");

const otpSchema = new mongoose.Schema({
    phone: {
        type: String,
        required: true,
        index: true
    },
    otpHash: {
        type: String,
        required: true
    },
    expiresAt: {
        type: Date,
        required: true,
        index: { expires: '5m' } // MongoDB auto-cleanup TTL index
    },
    attempts: {
        type: Number,
        default: 0
    }
}, { timestamps: true });

module.exports = mongoose.model("Otp", otpSchema);
