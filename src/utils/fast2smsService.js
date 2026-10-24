const https = require("https");

/**
 * Fast2SMS API Integration
 * Docs: https://docs.fast2sms.com/
 */
const sendFast2SmsOtp = async (mobile, otp) => {
    return new Promise((resolve, reject) => {
        const apiKey = process.env.FAST2SMS_API_KEY || "PTSMWeSylqzwKx4SJ9iGP2ZI8jW1axoKokPaunCy7vwc1BjMqu6a7TLatEmcuWbNkqswEiO7Qox0YCBR";
        if (!apiKey) {
            return reject(new Error("FAST2SMS_API_KEY is not configured"));
        }

        const cleanMobile = mobile.replace(/\D/g, "").slice(-10);

        // Try OTP route first, or Quick SMS route
        const postData = JSON.stringify({
            variables_values: otp.toString(),
            route: "otp",
            numbers: cleanMobile
        });

        const options = {
            hostname: "www.fast2sms.com",
            path: "/dev/bulkV2",
            method: "POST",
            headers: {
                "authorization": apiKey,
                "Content-Type": "application/json",
                "Content-Length": Buffer.byteLength(postData)
            }
        };

        const req = https.request(options, (res) => {
            let data = "";
            res.on("data", (chunk) => (data += chunk));
            res.on("end", () => {
                try {
                    const parsed = JSON.parse(data);
                    if (parsed.return === true || parsed.status_code === 200) {
                        resolve(parsed);
                    } else {
                        // If OTP route is restricted, fallback to Quick SMS route
                        sendFast2SmsQuick(cleanMobile, `Your Brunati verification code is ${otp}. Valid for 5 minutes.`)
                            .then(resolve)
                            .catch(() => reject(new Error(parsed.message || "Fast2SMS OTP failed")));
                    }
                } catch (e) {
                    resolve({ raw: data });
                }
            });
        });

        req.on("error", (err) => reject(err));
        req.write(postData);
        req.end();
    });
};

const sendFast2SmsQuick = async (mobile, message) => {
    return new Promise((resolve, reject) => {
        const apiKey = process.env.FAST2SMS_API_KEY || "PTSMWeSylqzwKx4SJ9iGP2ZI8jW1axoKokPaunCy7vwc1BjMqu6a7TLatEmcuWbNkqswEiO7Qox0YCBR";
        const cleanMobile = mobile.replace(/\D/g, "").slice(-10);

        const postData = JSON.stringify({
            route: "q",
            message: message,
            language: "english",
            numbers: cleanMobile
        });

        const options = {
            hostname: "www.fast2sms.com",
            path: "/dev/bulkV2",
            method: "POST",
            headers: {
                "authorization": apiKey,
                "Content-Type": "application/json",
                "Content-Length": Buffer.byteLength(postData)
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
        req.write(postData);
        req.end();
    });
};

module.exports = {
    sendFast2SmsOtp,
    sendFast2SmsQuick
};
