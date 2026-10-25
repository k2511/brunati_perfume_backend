const Product = require("../models/Product");
const Settings = require("../models/Settings");

exports.getAvailableSamples = async (req, res) => {
    try {
        // Always ensure a settings document exists with defaults (upsert)
        const settings = await Settings.findOneAndUpdate(
            {},
            { $setOnInsert: { freeSampleEnabled: true, maxSamples: 1, allowedGifts: [], codCharge: 0 } },
            { upsert: true, new: true }
        );

        if (!settings.freeSampleEnabled) {
            return res.json({ 
                status: true, 
                message: "Free samples are currently disabled", 
                data: { maxSamples: 0, samples: [] } 
            });
        }

        // Query active products based on admin allowedGifts configuration
        let filter = { isActive: true };
        if (settings.allowedGifts && settings.allowedGifts.length > 0) {
            filter._id = { $in: settings.allowedGifts };
        }

        const products = await Product.find(filter);

        if (!products || products.length === 0) {
            return res.json({
                status: true,
                message: "No gifts available at the moment",
                data: { maxSamples: settings.maxSamples || 1, samples: [] }
            });
        }

        const samples = products.map(product => ({
            _id: product._id, // Use Product ID as Sample ID
            productId: product,
            size: "1 ml",
            active: true
        }));

        res.json({
            status: true,
            message: "Available samples fetched successfully",
            data: {
                maxSamples: settings.maxSamples || 1,
                samples
            }
        });
    } catch (error) {
        console.error("Error in getAvailableSamples:", error);
        res.status(500).json({ status: false, message: error.message });
    }
};
