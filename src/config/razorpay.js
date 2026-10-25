const Razorpay = require("razorpay");
const dotenv = require("dotenv");
dotenv.config();

let razor;
try {
    razor = new Razorpay({
        key_id: (process.env.RAZORPAY_KEY_ID || "").trim(),
        key_secret: (process.env.RAZORPAY_SECRET || "").trim(),
    });
} catch (error) {
    console.error("Razorpay SDK Initialization Error:", error.message);
}

module.exports = { razor };
