const mongoose = require("mongoose");

const orderItemSchema = new mongoose.Schema({

    productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product"
    },

    productName: String,

    productImage: [String],

    size: String,

    mrp: Number,
    price: Number,


    quantity: Number

});

const freeSampleSchema = new mongoose.Schema({
    productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product"
    },
    productName: String,
    productImage: [String],
    size: {
        type: String,
        default: "1 ml"
    }
});


const orderSchema = new mongoose.Schema({

    orderId: {
        type: String,
        unique: true
    },

    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null
    },

    customer: {
        name: String,
        email: String,
        phone: String,
        alternatePhone: String,
        street: String,
        city: String,
        state: String,
        pincode: String
    },

    items: [orderItemSchema],

    freeSample: freeSampleSchema,

    totalAmount: Number,

    paymentStatus: {
        type: String,
        enum: ["pending", "paid", "failed"],
        default: "pending"
    },

    paymentMethod: {
        type: String,
        enum: ["online", "COD"],
        default: "online"
    },

        adminNotified: {
        type: Boolean,
        default: false
    },
    orderStatus: {
        type: String,
        enum: [
            "placed",
            "shipped",
            "delivered",
            "cancelled"
        ],
        default: "placed"
    }

}, { timestamps: true });

orderSchema.pre("save", async function () {
    if (!this.isNew) return;

    const Order = mongoose.model("Order");
    const year = new Date().getFullYear();
    
    // Find the last inserted order for the current year
    const lastOrder = await Order.findOne({ orderId: new RegExp(`^BRN-${year}-`) })
                                 .sort({ orderId: -1 })
                                 .collation({ locale: "en", numericOrdering: true });
    
    let nextIdNumber = 1;

    if (lastOrder && lastOrder.orderId) {
        const parts = lastOrder.orderId.split('-');
        if (parts.length === 3) {
            nextIdNumber = parseInt(parts[2], 10) + 1;
        }
    }

    this.orderId = `BRN-${year}-${nextIdNumber.toString().padStart(4, "0")}`;
});

orderSchema.index({ orderStatus: 1 });
orderSchema.index({ createdAt: -1 });

module.exports = mongoose.model("Order", orderSchema);