const sendEmail = require("./emailService");
const { sendMsg91Sms } = require("./msg91Service");

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "worldofbrunati@gmail.com";
const ADMIN_PHONE = process.env.ADMIN_PHONE || "+918767692853";

/**
 * Send comprehensive HTML email & SMS notification to Admin upon Order creation
 */
const notifyAdminNewOrder = async (order) => {
    if (!order) return;

    // Check if notification already sent (idempotency)
    if (order.adminNotified) {
        console.log(`Notification already sent for Order #${order.orderId}, skipping duplicate.`);
        return;
    }

    const orderTime = new Date(order.createdAt || Date.now()).toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
        dateStyle: "medium",
        timeStyle: "short"
    });

    const itemsRows = (order.items || []).map((item, idx) => `
        <tr style="border-bottom: 1px solid #E5E7EB;">
            <td style="padding: 10px 8px; font-size: 14px; color: #111;">
                <b>${item.productName || item.name || 'Perfume'}</b>
                <div style="font-size: 12px; color: #6B7280;">Size: ${item.size || 'Standard'}</div>
            </td>
            <td style="padding: 10px 8px; font-size: 14px; text-align: center; color: #111;">${item.quantity || 1}</td>
            <td style="padding: 10px 8px; font-size: 14px; text-align: right; color: #111;">₹${(item.price || 0) * (item.quantity || 1)}</td>
        </tr>
    `).join("");

    const emailHtml = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #F9FAFB; margin: 0; padding: 20px; }
            .card { max-width: 600px; margin: 0 auto; background: #FFFFFF; border-radius: 12px; border: 1px solid #E5E7EB; overflow: hidden; }
            .header { background: #000000; color: #FFFFFF; padding: 24px; text-align: center; }
            .content { padding: 24px; }
            .badge { display: inline-block; padding: 4px 10px; border-radius: 6px; font-size: 12px; font-weight: 700; text-transform: uppercase; }
            .badge-paid { background: #DCFCE7; color: #166534; }
            .badge-cod { background: #FEF3C7; color: #92400E; }
            .section-title { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #6B7280; margin: 20px 0 8px; }
            table { width: 100%; border-collapse: collapse; }
        </style>
    </head>
    <body>
        <div class="card">
            <div class="header">
                <h1 style="margin: 0; font-size: 20px; letter-spacing: 1px;">BRUNATI PERFUMES</h1>
                <p style="margin: 6px 0 0; font-size: 13px; opacity: 0.8;">New Customer Order Received</p>
            </div>
            <div class="content">
                <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #E5E7EB; padding-bottom: 16px;">
                    <div>
                        <div style="font-size: 18px; font-weight: 700;">Order #${order.orderId}</div>
                        <div style="font-size: 13px; color: #6B7280;">${orderTime}</div>
                    </div>
                    <div>
                        <span class="badge ${order.paymentStatus === 'paid' ? 'badge-paid' : 'badge-cod'}">
                            ${order.paymentMethod === 'COD' ? 'Cash On Delivery' : 'Online Paid'}
                        </span>
                    </div>
                </div>

                <div class="section-title">Customer Information</div>
                <div style="background: #F9FAFB; padding: 12px 16px; border-radius: 8px; font-size: 14px; line-height: 1.5;">
                    <div><b>Name:</b> ${order.customer?.name || 'Customer'}</div>
                    <div><b>Verified Mobile:</b> <a href="tel:${order.customer?.phone}">${order.customer?.phone || 'N/A'}</a></div>
                    ${order.customer?.email ? `<div><b>Email:</b> ${order.customer.email}</div>` : ''}
                    <div><b>Delivery Address:</b> ${order.customer?.street || ''}, ${order.customer?.city || ''}, ${order.customer?.state || ''} - ${order.customer?.pincode || ''}</div>
                </div>

                <div class="section-title">Products Ordered</div>
                <table>
                    <thead>
                        <tr style="border-bottom: 1px solid #E5E7EB; color: #6B7280; font-size: 12px; text-transform: uppercase;">
                            <th style="padding: 8px; text-align: left;">Item</th>
                            <th style="padding: 8px; text-align: center;">Qty</th>
                            <th style="padding: 8px; text-align: right;">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${itemsRows}
                    </tbody>
                </table>

                <div style="border-top: 1px solid #E5E7EB; margin-top: 16px; padding-top: 12px;">
                    <table style="font-size: 14px;">
                        <tr>
                            <td style="color: #6B7280; padding: 4px 0;">Subtotal</td>
                            <td style="text-align: right; padding: 4px 0;">₹${order.totalAmount}</td>
                        </tr>
                        <tr>
                            <td style="color: #6B7280; padding: 4px 0;">Shipping</td>
                            <td style="text-align: right; padding: 4px 0; color: #16A34A; font-weight: 600;">FREE</td>
                        </tr>
                        <tr style="font-size: 16px; font-weight: 700; border-top: 1px solid #E5E7EB;">
                            <td style="padding: 10px 0;">Final Total</td>
                            <td style="text-align: right; padding: 10px 0;">₹${order.totalAmount}</td>
                        </tr>
                    </table>
                </div>

                <div style="margin-top: 24px; text-align: center;">
                    <a href="https://brunati.in/admin/orders" style="display: inline-block; background: #000; color: #FFF; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px;">View in Admin Panel</a>
                </div>
            </div>
        </div>
    </body>
    </html>
    `;

    // 1. Dispatch Admin Email
    try {
        await sendEmail({
            email: ADMIN_EMAIL,
            subject: `New Order Received – Order #${order.orderId}`,
            message: `New Order Received! Order #${order.orderId}\nCustomer: ${order.customer?.name} (${order.customer?.phone})\nAmount: ₹${order.totalAmount}\nPayment: ${order.paymentMethod}`,
            html: emailHtml
        });
        console.log(`[NOTIFY] Admin email sent to ${ADMIN_EMAIL} for Order #${order.orderId}`);
    } catch (mailErr) {
        console.error("[NOTIFY] Admin email failed:", mailErr.message);
    }

    // 2. Dispatch Admin SMS
    try {
        const smsMessage = `Brunati Alert: New Order #${order.orderId} received from ${order.customer?.name || 'Customer'}. Amount: Rs.${order.totalAmount}. Payment: ${order.paymentMethod}.`;
        
        // Attempt via MSG91 Flow
        if (process.env.MSG91_AUTH_KEY) {
            await sendMsg91Sms(ADMIN_PHONE, {
                order_id: order.orderId,
                customer_name: order.customer?.name || 'Customer',
                amount: order.totalAmount,
                payment_method: order.paymentMethod
            });
            console.log(`[NOTIFY] Admin SMS sent via MSG91 to ${ADMIN_PHONE}`);
        } else {
            console.log(`[SMS NOTIFICATION] To Admin ${ADMIN_PHONE}: "${smsMessage}"`);
        }
    } catch (smsErr) {
        console.error("[NOTIFY] Admin SMS dispatch error:", smsErr.message);
    }
};

module.exports = {
    notifyAdminNewOrder,
    ADMIN_EMAIL,
    ADMIN_PHONE
};
