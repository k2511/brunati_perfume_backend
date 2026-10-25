const mongoose = require("mongoose");

const settingsSchema = new mongoose.Schema({

    freeSampleEnabled: {
        type: Boolean,
        default: true
    },

    maxSamples: {
        type: Number,
        default: 1
    },

    allowedGifts: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product"
    }],

    codCharge: {
        type: Number,
        default: 0
    }

}, { timestamps: true });

module.exports = mongoose.model("Settings", settingsSchema);
