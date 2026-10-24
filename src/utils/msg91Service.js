const https = require("https");

/**
 * MSG91 Official API Integration for OTP and SMS
 * Documentation: https://docs.msg91.com/p/tf9fvn/e/7XzJ8f
 */

/**
 * Send OTP via MSG91 Send OTP API
 * POST https://control.msg91.com/api/v5/otp?template_id=...&mobile=...
 */
const sendMsg91Otp = async (mobile, otp) => {
    return new Promise((resolve, reject) => {
        const authKey = process.env.MSG91_AUTH_KEY;
        const templateId = process.env.MSG91_OTP_TEMPLATE_ID;

        if (!authKey || !templateId) {
            return reject(new Error("MSG91_AUTH_KEY or MSG91_OTP_TEMPLATE_ID is not configured"));
        }

        const formattedPhone = mobile.startsWith("+") ? mobile.replace("+", "") : `91${mobile}`;
        const queryParams = new URLSearchParams({
            template_id: templateId,
            mobile: formattedPhone,
            authkey: authKey,
            otp: otp
        });

        const options = {
            hostname: "control.msg91.com",
            path: `/api/v5/otp?${queryParams.toString()}`,
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            }
        };

        const req = https.request(options, (res) => {
            let data = "";
            res.on("data", (chunk) => (data += chunk));
            res.on("end", () => {
                try {
                    const parsed = JSON.parse(data);
                    if (parsed.type === "success" || res.statusCode === 200) {
                        resolve(parsed);
                    } else {
                        reject(new Error(parsed.message || "MSG91 OTP request failed"));
                    }
                } catch (e) {
                    resolve({ raw: data });
                }
            });
        });

        req.on("error", (err) => reject(err));
        req.end();
    });
};

/**
 * Send Transactional SMS via MSG91 Flow API
 * POST https://control.msg91.com/api/v5/flow/
 */
const sendMsg91Sms = async (mobile, variables = {}) => {
    return new Promise((resolve, reject) => {
        const authKey = process.env.MSG91_AUTH_KEY;
        const flowId = process.env.MSG91_ORDER_FLOW_ID || process.env.MSG91_FLOW_ID;

        if (!authKey || !flowId) {
            return reject(new Error("MSG91_AUTH_KEY or MSG91_FLOW_ID not configured"));
        }

        const formattedPhone = mobile.startsWith("+") ? mobile.replace("+", "") : `91${mobile}`;
        const payload = JSON.stringify({
            flow_id: flowId,
            sender: process.env.MSG91_SENDER_ID || "BRNATI",
            mobiles: formattedPhone,
            ...variables
        });

        const options = {
            hostname: "control.msg91.com",
            path: "/api/v5/flow/",
            method: "POST",
            headers: {
                "authkey": authKey,
                "Content-Type": "application/json",
                "Content-Length": Buffer.byteLength(payload)
            }
        };

        const req = https.request(options, (res) => {
            let data = "";
            res.on("data", (chunk) => (data += chunk));
            res.on("end", () => {
                try {
                    const parsed = JSON.parse(data);
                    resolve(parsed);
                } catch (e) {
                    resolve({ raw: data });
                }
            });
        });

        req.on("error", (err) => reject(err));
        req.write(payload);
        req.end();
    });
};

module.exports = {
    sendMsg91Otp,
    sendMsg91Sms
};
