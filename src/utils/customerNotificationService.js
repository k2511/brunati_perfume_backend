const sendEmail = require("./emailService");
const Order = require("../models/Order");

/**
 * Send verified Order Confirmation & Receipt HTML email to Customer
 */
const notifyCustomerOrderSuccess = async (order) => {
    try {
        if (!order || !order._id) return;

        const customerEmail = order.customer?.email;
        if (!customerEmail || customerEmail.includes("guest@brunati.in")) {
            console.log(`No valid customer email for Order #${order.orderId}, skipping email.`);
            return;
        }

        // Atomic lock: check and lock customerNotified to prevent concurrent duplicate emails
        const lockedOrder = await Order.findOneAndUpdate(
            { _id: order._id, customerNotified: { $ne: true } },
            { $set: { customerNotified: true } },
            { new: true }
        );

        if (!lockedOrder) {
            console.log(`Customer notification already sent/locked for Order #${order.orderId}, skipping duplicate.`);
            return;
        }

        const orderTime = new Date(order.createdAt || Date.now()).toLocaleString("en-IN", {
            timeZone: "Asia/Kolkata",
            dateStyle: "medium",
            timeStyle: "short"
        });

        const itemsRows = (order.items || []).map(item => `
            <tr style="border-bottom: 1px solid #F3F4F6;">
                <td style="padding: 12px 8px; font-size: 14px; color: #111827;">
                    <b>${item.productName || 'Perfume'}</b>
                    <div style="font-size: 12px; color: #6B7280;">Size: ${item.size || 'Standard'}</div>
                </td>
                <td style="padding: 12px 8px; font-size: 14px; text-align: center; color: #111827;">${item.quantity || 1}</td>
                <td style="padding: 12px 8px; font-size: 14px; text-align: right; color: #111827;">₹${((item.price || 0) * (item.quantity || 1)).toLocaleString('en-IN')}</td>
            </tr>
        `).join("");

        const sampleRow = order.freeSample && order.freeSample.productName ? `
            <tr style="border-bottom: 1px solid #F3F4F6; background: #FDFBF7;">
                <td style="padding: 12px 8px; font-size: 14px; color: #92400E;">
                    <b>🎁 ${order.freeSample.productName}</b>
                    <div style="font-size: 12px; color: #B45309;">Complimentary Free Sample (1 ml)</div>
                </td>
                <td style="padding: 12px 8px; font-size: 14px; text-align: center; color: #92400E;">1</td>
                <td style="padding: 12px 8px; font-size: 14px; text-align: right; color: #16A34A; font-weight: bold;">FREE</td>
            </tr>
        ` : "";

        const emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Order Confirmation - Brunati Perfumes</title>
            <style>
                body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #F9FAFB; margin: 0; padding: 24px; color: #111827; }
                .card { max-width: 600px; margin: 0 auto; background: #FFFFFF; border-radius: 14px; border: 1px solid #E5E7EB; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.03); }
                .header { background: #000000; color: #FFFFFF; padding: 28px 24px; text-align: center; }
                .header h1 { margin: 0 0 6px; font-size: 24px; letter-spacing: 2px; text-transform: uppercase; font-weight: 800; }
                .header p { margin: 0; font-size: 14px; color: #9CA3AF; }
                .content { padding: 28px 24px; }
                .badge { display: inline-block; padding: 5px 12px; border-radius: 6px; font-size: 12px; font-weight: 700; text-transform: uppercase; }
                .badge-paid { background: #DCFCE7; color: #166534; }
                .badge-cod { background: #FEF3C7; color: #92400E; }
                table { width: 100%; border-collapse: collapse; margin-top: 12px; }
                th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #6B7280; padding: 8px 8px; border-bottom: 2px solid #E5E7EB; }
                .totals-row td { padding: 8px 8px; font-size: 14px; }
                .footer { background: #F9FAFB; padding: 20px 24px; text-align: center; font-size: 12px; color: #6B7280; border-top: 1px solid #E5E7EB; }
            </style>
        </head>
        <body>
            <div class="card">
                <div class="header">
                    <h1>BRUNATI</h1>
                    <p>Luxury Artisanal Perfumery</p>
                </div>
                <div class="content">
                    <div style="text-align: center; margin-bottom: 24px;">
                        <span class="badge ${order.paymentMethod === 'online' ? 'badge-paid' : 'badge-cod'}">
                            ${order.paymentMethod === 'online' ? 'Payment Verified (Paid)' : 'Cash on Delivery (Confirmed)'}
                        </span>
                        <h2 style="margin: 12px 0 4px; font-size: 20px;">Thank You For Your Order!</h2>
                        <p style="margin: 0; color: #6B7280; font-size: 14px;">Order ID: <b>#${order.orderId}</b> &bull; ${orderTime}</p>
                    </div>

                    <p style="font-size: 14px; line-height: 1.6; color: #374151;">
                        Dear <b>${order.customer?.name || 'Customer'}</b>,<br>
                        We have successfully received your order. We are carefully packaging your artisanal perfumes to dispatch them to your doorstep.
                    </p>

                    <div style="margin: 24px 0;">
                        <h3 style="font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; color: #6B7280; margin: 0 0 8px;">Order Summary</h3>
                        <table>
                            <thead>
                                <tr>
                                    <th>Item</th>
                                    <th style="text-align: center;">Qty</th>
                                    <th style="text-align: right;">Amount</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${itemsRows}
                                ${sampleRow}
                            </tbody>
                        </table>
                    </div>

                    <div style="background: #F9FAFB; border-radius: 8px; padding: 16px; margin: 20px 0;">
                        <table style="margin: 0;">
                            <tr class="totals-row">
                                <td style="color: #6B7280;">Subtotal</td>
                                <td style="text-align: right; font-weight: 600;">₹${(order.subtotal || order.totalAmount).toLocaleString('en-IN')}</td>
                            </tr>
                            <tr class="totals-row">
                                <td style="color: #6B7280;">Standard Delivery</td>
                                <td style="text-align: right; color: #16A34A; font-weight: 700;">FREE</td>
                            </tr>
                            ${order.codCharge > 0 ? `
                            <tr class="totals-row">
                                <td style="color: #6B7280;">COD Handling Fee</td>
                                <td style="text-align: right; font-weight: 600;">₹${order.codCharge}</td>
                            </tr>
                            ` : ''}
                            <tr style="border-top: 2px solid #E5E7EB;">
                                <td style="padding: 12px 8px 4px; font-size: 16px; font-weight: 800;">Total Amount</td>
                                <td style="padding: 12px 8px 4px; font-size: 16px; font-weight: 800; text-align: right;">₹${(order.totalAmount || 0).toLocaleString('en-IN')}</td>
                            </tr>
                        </table>
                    </div>

                    <div style="border-top: 1px solid #E5E7EB; padding-top: 16px; margin-top: 20px;">
                        <h3 style="font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; color: #6B7280; margin: 0 0 6px;">Delivery Details</h3>
                        <p style="font-size: 13px; line-height: 1.5; color: #4B5563; margin: 0;">
                            <b>${order.customer?.name}</b><br>
                            ${order.customer?.street}<br>
                            ${order.customer?.city}, ${order.customer?.state} - ${order.customer?.pincode}<br>
                            Phone: ${order.customer?.phone} ${order.customer?.alternatePhone ? `| Alt: ${order.customer?.alternatePhone}` : ''}
                        </p>
                    </div>
                </div>

                <div class="footer">
                    <p style="margin: 0 0 8px;">If you have any questions, feel free to contact us at <a href="mailto:worldofbrunati@gmail.com" style="color: #000; font-weight: 600;">worldofbrunati@gmail.com</a></p>
                    <p style="margin: 0;">© ${new Date().getFullYear()} Brunati Perfumes. All rights reserved.</p>
                </div>
            </div>
        </body>
        </html>
        `;

        await sendEmail({
            email: customerEmail,
            subject: `Order Confirmed! Your Brunati Order #${order.orderId}`,
            message: `Hello ${order.customer?.name},\n\nThank you for choosing Brunati Perfumes! Your order #${order.orderId} for ₹${order.totalAmount} has been confirmed.\n\nTeam Brunati`,
            html: emailHtml
        });

        console.log(`Customer confirmation email successfully sent for Order #${order.orderId}`);
    } catch (err) {
        console.error("Customer Notification Dispatch Error:", err.message);
    }
};

/**
 * Send Payment Failed / Cancelled guidance HTML email to Customer
 */
const notifyCustomerPaymentFailed = async (order, reason) => {
    try {
        if (!order || !order._id) return;

        const customerEmail = order.customer?.email;
        if (!customerEmail || customerEmail.includes("guest@brunati.in")) {
            return;
        }

        // Atomic lock for failure email
        const lockedOrder = await Order.findOneAndUpdate(
            { _id: order._id, paymentFailureNotified: { $ne: true } },
            { $set: { paymentFailureNotified: true } },
            { new: true }
        );

        if (!lockedOrder) {
            return;
        }

        const emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Payment Update - Brunati Perfumes</title>
            <style>
                body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #F9FAFB; margin: 0; padding: 24px; color: #111827; }
                .card { max-width: 600px; margin: 0 auto; background: #FFFFFF; border-radius: 14px; border: 1px solid #E5E7EB; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.03); }
                .header { background: #000000; color: #FFFFFF; padding: 24px; text-align: center; }
                .header h1 { margin: 0 0 6px; font-size: 22px; letter-spacing: 2px; text-transform: uppercase; font-weight: 800; }
                .content { padding: 28px 24px; }
                .alert-box { background: #FEF2F2; border: 1px solid #FEE2E2; border-radius: 8px; padding: 16px; margin: 20px 0; color: #991B1B; font-size: 13px; line-height: 1.6; }
                .footer { background: #F9FAFB; padding: 20px 24px; text-align: center; font-size: 12px; color: #6B7280; border-top: 1px solid #E5E7EB; }
            </style>
        </head>
        <body>
            <div class="card">
                <div class="header">
                    <h1>BRUNATI</h1>
                    <p style="margin: 0; font-size: 13px; color: #9CA3AF;">Luxury Artisanal Perfumery</p>
                </div>
                <div class="content">
                    <h2 style="margin: 0 0 12px; font-size: 18px; color: #DC2626;">Payment Could Not Be Completed</h2>
                    <p style="font-size: 14px; color: #4B5563; line-height: 1.6;">
                        Dear <b>${order.customer?.name || 'Customer'}</b>,<br>
                        We noticed that your payment attempt for Order <b>#${order.orderId || order._id}</b> for amount <b>₹${order.totalAmount}</b> could not be completed.
                        ${reason ? `<br><span style="font-size: 12px; color: #6B7280;">Reason: ${reason}</span>` : ''}
                    </p>

                    <div class="alert-box">
                        <b>Bank Deductions & Reversal Info:</b><br>
                        If any amount was debited from your bank account or UPI app for this unconfirmed attempt, it is usually reversed automatically by your issuing bank. In case of delay, please reach out to our team at worldofbrunati@gmail.com with your bank payment reference.
                    </div>

                    <p style="font-size: 14px; color: #4B5563; line-height: 1.6;">
                        Your cart items are safe. You can retry paying anytime by visiting our website, or you may also choose Cash on Delivery (COD) at checkout.
                    </p>
                </div>
                <div class="footer">
                    <p style="margin: 0 0 8px;">Assistance: <a href="mailto:worldofbrunati@gmail.com" style="color: #000; font-weight: 600;">worldofbrunati@gmail.com</a></p>
                    <p style="margin: 0;">© ${new Date().getFullYear()} Brunati Perfumes.</p>
                </div>
            </div>
        </body>
        </html>
        `;

        await sendEmail({
            email: customerEmail,
            subject: `Payment Update for Order #${order.orderId || order._id}`,
            message: `Hello ${order.customer?.name},\n\nYour payment for order #${order.orderId || order._id} could not be completed. If debited, issuing banks usually reverse unconfirmed payments automatically.\n\nTeam Brunati`,
            html: emailHtml
        });

        console.log(`Customer failure notification sent for Order #${order.orderId}`);
    } catch (err) {
        console.error("Customer Failure Notification Error:", err.message);
    }
};

module.exports = {
    notifyCustomerOrderSuccess,
    notifyCustomerPaymentFailed
};
