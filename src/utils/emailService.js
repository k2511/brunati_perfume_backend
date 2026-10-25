const nodemailer = require("nodemailer");

const sendEmail = async (options) => {
    try {
        if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
            console.warn("Email service Warning: Missing EMAIL_USER or EMAIL_PASS in .env. Skipping email dispatch.");
            return;
        }

        const transporter = nodemailer.createTransport({
            service: "gmail",
            secure: true,
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            },
            connectionTimeout: 8000,
            greetingTimeout: 8000,
            socketTimeout: 10000
        });

        const mailOptions = {
            from: `"Brunati Perfumes" <${process.env.EMAIL_USER}>`,
            to: options.email,
            subject: options.subject,
            text: options.message,
            html: options.html
        };

        const info = await transporter.sendMail(mailOptions);
        console.log(`Email successfully sent to ${options.email}. Response: ${info.response}`);
        return info;
    } catch (error) {
        console.error("CRITICAL EMAIL ERROR:", error.message);
        if (error.message.includes("EAUTH")) {
            console.error("HELP: This looks like a login error. Ensure you are using a Gmail 'App Password', not your main account password!");
        }
        throw error;
    }
};

module.exports = sendEmail;
