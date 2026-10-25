const Settings = require("../../models/Settings");

exports.getSettings = async (req, res) => {
    try {
        const settings = await Settings.findOneAndUpdate(
            {},
            { $setOnInsert: { freeSampleEnabled: true, maxSamples: 1, allowedGifts: [], codCharge: 0 } },
            { upsert: true, new: true }
        ).populate('allowedGifts', 'name images sizes isActive');
        res.json({ status: true, data: settings });
    } catch (error) {
        res.status(500).json({ status: false, message: error.message, data: null });
    }
};

exports.updateFreeSampleSettings = async (req, res) => {
    try {
        const data = { ...req.body };
        if (data.allowedGifts && typeof data.allowedGifts === 'string') {
            try {
                data.allowedGifts = JSON.parse(data.allowedGifts);
            } catch (e) {}
        }
        if (data.allowedSamples && typeof data.allowedSamples === 'string') {
            try {
                data.allowedGifts = JSON.parse(data.allowedSamples);
            } catch (e) {}
        }

        let settings = await Settings.findOne();
        if (!settings) {
            settings = new Settings(data);
        } else {
            Object.assign(settings, data);
        }
        await settings.save();
        res.json({ status: true, message: "Settings updated successfully", data: settings });
    } catch (error) {
        res.status(400).json({ status: false, message: error.message, data: null });
    }
};
