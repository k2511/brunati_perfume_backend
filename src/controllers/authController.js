const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Otp = require("../models/Otp");
const User = require("../models/User");
const { sendMsg91Otp } = require("../utils/msg91Service");

// Try loading Twilio client if configured
let twilioClient = null;
try {
    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
        twilioClient = require("../utils/twilio");
    }
} catch (e) {
    console.warn("Twilio not initialized:", e.message);
}

/**
 * Generate 6 digit numeric OTP
 */
const generateOtp = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * Send SMS via Twilio or fallback SMS Provider (e.g. Fast2SMS / Console Logger)
 */
const dispatchSms = async (phone, otp) => {
    const formattedPhone = phone.startsWith("+") ? phone : `+91${phone}`;

        // 0. Primary: Try MSG91 Official API if configured
    if (process.env.MSG91_AUTH_KEY && process.env.MSG91_OTP_TEMPLATE_ID) {
        try {
            await sendMsg91Otp(phone, otp);
            console.log(`[MSG91 OTP SENT] to ${formattedPhone}`);
            return { method: "msg91" };
        } catch (msg91Err) {
            console.error("MSG91 OTP Dispatch Error:", msg91Err.message);
        }
    }

    // 1. Try Twilio Verify Service if SID is set
        // Twilio Verify (Only if valid VA... SID provided)
    if (twilioClient && process.env.TWILIO_VERIFY_SERVICE_SID && process.env.TWILIO_VERIFY_SERVICE_SID.startsWith("VA")) {
        try {
            await twilioClient.verify.v2
                .services(process.env.TWILIO_VERIFY_SERVICE_SID)
                .verifications.create({
                    to: formattedPhone,
                    channel: "sms",
                });
            return { method: "twilio-verify" };
        } catch (twErr) {
            console.error("Twilio Verify API Error:", twErr.message);
        }
    }

    // 2. Try Twilio standard SMS if standard Messaging SID / Phone is set
    if (twilioClient && (process.env.TWILIO_PHONE_NUMBER || process.env.TWILIO_MESSAGING_SERVICE_SID)) {
        try {
            const msgPayload = {
                to: formattedPhone,
                body: `Your Brunati Perfumes verification code is ${otp}. Valid for 5 minutes.`
            };
            if (process.env.TWILIO_PHONE_NUMBER) msgPayload.from = process.env.TWILIO_PHONE_NUMBER;
            if (process.env.TWILIO_MESSAGING_SERVICE_SID) msgPayload.messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;

            await twilioClient.messages.create(msgPayload);
            return { method: "twilio-sms" };
        } catch (smsErr) {
            console.error("Twilio SMS Error:", smsErr.message);
        }
    }

    // 3. Fallback: Log OTP in console for local/development without failing customer flow
    console.log(`[SMS DISPATCH] To: ${formattedPhone} | OTP Code: ${otp}`);
    return { method: "console" };
};

/**
 * POST /api/v1/send-otp
 * Body: { mobile }
 */
exports.sendOTP = async (req, res) => {
    try {
        const { mobile } = req.body;
        if (!mobile) {
            return res.status(400).json({ success: false, message: "Mobile number is required" });
        }

        const cleanMobile = mobile.toString().replace(/\D/g, "").slice(-10);
        if (cleanMobile.length !== 10) {
            return res.status(400).json({ success: false, message: "Enter a valid 10-digit mobile number" });
        }

        // Rate limit: check if an OTP was sent in the last 30 seconds
        const existingOtp = await Otp.findOne({ phone: cleanMobile });
        if (existingOtp) {
            const secondsSinceLast = (Date.now() - new Date(existingOtp.updatedAt).getTime()) / 1000;
            if (secondsSinceLast < 30) {
                return res.status(429).json({
                    success: false,
                    message: `Please wait ${Math.ceil(30 - secondsSinceLast)} seconds before requesting a new OTP.`
                });
            }
        }

        // Generate and Hash OTP
        const plainOtp = generateOtp();
        const salt = await bcrypt.genSalt(8);
        const otpHash = await bcrypt.hash(plainOtp, salt);
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

        // Upsert OTP record
        await Otp.findOneAndUpdate(
            { phone: cleanMobile },
            { otpHash, expiresAt, attempts: 0 },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        // Dispatch real SMS
        await dispatchSms(cleanMobile, plainOtp);

        return res.status(200).json({
            success: true,
            message: "OTP sent successfully to your mobile number",
            mobile: cleanMobile,
            debugOtp: process.env.NODE_ENV !== "production" && !process.env.TWILIO_VERIFY_SERVICE_SID ? plainOtp : undefined
        });

    } catch (error) {
        console.error("sendOTP Error:", error);
        return res.status(500).json({ success: false, message: error.message || "Failed to send OTP" });
    }
};

/**
 * POST /api/v1/verify-otp
 * Body: { phone, otp }
 */
exports.verifyOTP = async (req, res) => {
    try {
        const { phone, mobile, otp } = req.body;
        const targetPhone = (phone || mobile || "").toString().replace(/\D/g, "").slice(-10);

        if (!targetPhone || !otp) {
            return res.status(400).json({ success: false, message: "Mobile number and OTP are required" });
        }

        const otpRecord = await Otp.findOne({ phone: targetPhone });

        // 1. If Twilio Verify service is enabled, verify with Twilio first
                if (twilioClient && process.env.TWILIO_VERIFY_SERVICE_SID && process.env.TWILIO_VERIFY_SERVICE_SID.startsWith("VA")) {
            try {
                const formattedNumber = `+91${targetPhone}`;
                const verification = await twilioClient.verify.v2
                    .services(process.env.TWILIO_VERIFY_SERVICE_SID)
                    .verificationChecks.create({ to: formattedNumber, code: otp });

                if (verification.status !== "approved") {
                    return res.status(400).json({ success: false, message: "Invalid OTP code" });
                }
            } catch (err) {
                if (!otpRecord) {
                    return res.status(400).json({ success: false, message: err.message || "Invalid OTP" });
                }
            }
        }

        // 2. Local DB OTP verification
        if (otpRecord) {
            if (new Date() > otpRecord.expiresAt) {
                await Otp.deleteOne({ _id: otpRecord._id });
                return res.status(400).json({ success: false, message: "OTP has expired. Please request a new one." });
            }

            if (otpRecord.attempts >= 5) {
                await Otp.deleteOne({ _id: otpRecord._id });
                return res.status(429).json({ success: false, message: "Too many failed attempts. Please request a new OTP." });
            }

            const isMatch = await bcrypt.compare(otp.toString().trim(), otpRecord.otpHash);
            if (!isMatch) {
                otpRecord.attempts += 1;
                await otpRecord.save();
                return res.status(400).json({ success: false, message: "Incorrect OTP. Please check and try again." });
            }

            // OTP Verified - Remove used OTP
            await Otp.deleteOne({ _id: otpRecord._id });
        } else if (!process.env.TWILIO_VERIFY_SERVICE_SID) {
            return res.status(400).json({ success: false, message: "No active OTP request found for this number" });
        }

        // 3. Find or Create User for seamless Guest -> Customer Checkout session
        let user = await User.findOne({ phone: targetPhone });
        if (!user) {
            user = new User({
                phone: targetPhone,
                name: `Guest (${targetPhone.slice(-4)})`,
                password: crypto.randomBytes(16).toString("hex"),
                addresses: []
            });
            await user.save();
        }

        // Generate JWT Token for seamless authenticated checkout
        const token = jwt.sign(
            { id: user._id, phone: user.phone },
            process.env.JWT_SECRET,
            { expiresIn: "30d" }
        );

        // Set secure cookie
        res.cookie("token", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
            maxAge: 30 * 24 * 60 * 60 * 1000
        });

        return res.status(200).json({
            success: true,
            status: true,
            message: "OTP Verified Successfully",
            token,
            data: {
                user: {
                    _id: user._id,
                    name: user.name,
                    phone: user.phone,
                    email: user.email,
                    addresses: user.addresses || []
                },
                token
            }
        });

    } catch (err) {
        console.error("verifyOTP Error:", err);
        return res.status(500).json({ success: false, message: err.message || "OTP verification failed" });
    }
};
