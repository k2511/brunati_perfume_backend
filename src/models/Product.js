const mongoose = require("mongoose");
const slugify = require("slugify");

const sizeSchema = new mongoose.Schema({
    size: {
        type: String,
        required: true
    },
    mrp: {
        type: Number,
        required: true
    },
    sellingPrice: {
        type: Number,
        required: true
    },

    stock: {
        type: Number,
        default: 999 // High placeholder for UI compatibility if needed
    }

});

const storySectionSchema = new mongoose.Schema({
    title: String,
    description: String
});

const productSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },

    description: {
        type: String,
        default: ""
    },

    slug: {
        type: String,
        unique: true
    },

    category: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Category",
        required: true
    },


    images: [String],

    mainAccords: [String],

    perfumePyramid: {
        top: [String],
        middle: [String],
        base: [String]
    },

    sizes: [sizeSchema],

    story: {
        storyImages: [String],
        sections: [storySectionSchema]
    },

    isActive: {
        type: Boolean,
        default: true
    }

}, { timestamps: true });



productSchema.pre("save", function () {

    if (!this.isModified("name")) {
        return;
    }

    let generatedSlug = slugify(this.name, { lower: true, strict: true }); if (!this.slug || this.isModified("name")) { this.slug = generatedSlug; }

});

productSchema.index({ category: 1 });
productSchema.index({ name: "text" });

module.exports = mongoose.model("Product", productSchema);