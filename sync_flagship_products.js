const mongoose = require('mongoose');
require('dotenv').config();

const Product = require('./src/models/Product');
const Category = require('./src/models/Category');

const flagshipProducts = [
    {
        name: "Dominus Emperor",
        slug: "dominus-emperor",
        categoryName: "Men",
        description: "A bold and regal fragrance designed for the modern visionary. Speaking volumes with notes of rich oud, sensual patchouli, and a hint of saffron.",
        images: ["media/dominus/1.png", "media/dominus/2.png", "media/dominus/3.png"],
        mainAccords: ["Warm Spicy", "Woody", "Tobacco", "Whiskey", "Oud", "Sweet", "Amber", "Balsamic", "Vanilla", "Smoky"],
        perfumePyramid: {
            top: ["Whiskey"],
            middle: ["Spicy Notes", "Cinnamon", "Coriander"],
            base: ["Tobacco", "Agarwood (Oud)", "Incense", "Sandalwood", "Patchouli", "Benzoin", "Vanilla", "Cedar"]
        },
        sizes: [
            { size: "50ml", mrp: 1795, sellingPrice: 1095, stock: 999 },
            { size: "100ml", mrp: 2495, sellingPrice: 1795, stock: 999 }
        ],
        details: {
            whereToWear: "Formal events, evening gatherings, boardrooms, and winter nights.",
            keyNotes: "Whiskey, Agarwood (Oud), Tobacco, Vanilla, Sandalwood.",
            ingredients: "Alcohol Denat., Parfum (Fragrance), Aqua (Water), Coumarin, Linalool, Limonene.",
            shippingNotes: "Complimentary premium express shipping across India within 3-5 business days.",
            returnsAndExchanges: "Due to the artisanal nature of personal luxury fragrances, unsealed items cannot be returned. Complimentary 1ml discovery vial included for testing."
        },
        isActive: true
    },
    {
        name: "Brunati Aqua",
        slug: "brunati-aqua",
        categoryName: "Unisex",
        description: "Crystalline depths of the Mediterranean captured in a bottle. A surge of mineral freshness, aromatic herbs, and marine notes.",
        images: ["media/aqua/1.png", "media/aqua/2.png", "media/aqua/3.png"],
        mainAccords: ["Aromatic", "Marine", "Fresh Spicy", "Woody", "Citrus", "Earthy"],
        perfumePyramid: {
            top: ["Sea Notes", "Bergamot"],
            middle: ["Sage", "Geranium", "Rosemary"],
            base: ["Incense", "Patchouli"]
        },
        sizes: [
            { size: "50ml", mrp: 1795, sellingPrice: 1095, stock: 999 },
            { size: "100ml", mrp: 2495, sellingPrice: 1500, stock: 999 }
        ],
        details: {
            whereToWear: "Daytime, summer wear, coastal getaways, and gym/sport luxury.",
            keyNotes: "Sea Salt, Bergamot, Rosemary, Atlas Cedarwood.",
            ingredients: "Alcohol Denat., Parfum (Fragrance), Aqua, Limonene, Linalool, Citronellol.",
            shippingNotes: "Complimentary express shipping across India within 3-5 business days.",
            returnsAndExchanges: "Unsealed items cannot be returned. Complimentary 1ml discovery vial included."
        },
        isActive: true
    },
    {
        name: "Mestia",
        slug: "mestia",
        categoryName: "Women",
        description: "An ethereal dance of white florals and creamy sandalwood. Designed for the woman who finds strength in grace.",
        images: ["media/mistia/1.png", "media/mistia/2.png", "media/mistia/3.png"],
        mainAccords: ["Floral", "White Floral", "Musky", "Powdery", "Woody"],
        perfumePyramid: {
            top: ["White Florals", "Pear"],
            middle: ["Tuberose", "Jasmine"],
            base: ["Sandalwood", "Musk"]
        },
        sizes: [
            { size: "50ml", mrp: 1795, sellingPrice: 1095, stock: 999 },
            { size: "100ml", mrp: 2495, sellingPrice: 1795, stock: 999 }
        ],
        details: {
            whereToWear: "Brunches, spring afternoons, date nights, and celebration dinners.",
            keyNotes: "White Florals, Pear, Tuberose, Jasmine, Sandalwood.",
            ingredients: "Alcohol Denat., Parfum (Fragrance), Aqua, Benzyl Salicylate, Hydroxycitronellal.",
            shippingNotes: "Complimentary express shipping across India within 3-5 business days.",
            returnsAndExchanges: "Unsealed items cannot be returned. Complimentary 1ml discovery vial included."
        },
        isActive: true
    },
    {
        name: "Citrine Dusk",
        slug: "citrine-dusk",
        categoryName: "Unisex",
        description: "The warmth of a golden sunset. A sophisticated blend of citrus zest, amber, and warm woody base notes for an elegant presence.",
        images: ["media/dusk/1.png", "media/dusk/2.png", "media/dusk/3.png"],
        mainAccords: ["Citrus", "Amber", "Woody", "Powdery", "Fresh"],
        perfumePyramid: {
            top: ["Citrus Zest", "Bergamot"],
            middle: ["Amber", "Spicy Notes"],
            base: ["Sandalwood", "Oakmoss"]
        },
        sizes: [
            { size: "50ml", mrp: 1795, sellingPrice: 1095, stock: 999 },
            { size: "100ml", mrp: 2495, sellingPrice: 1795, stock: 999 }
        ],
        details: {
            whereToWear: "Evening sundowners, lounge parties, autumn walks, and creative gatherings.",
            keyNotes: "Citrus Zest, Bergamot, Amber, Sandalwood, Oakmoss.",
            ingredients: "Alcohol Denat., Parfum, Aqua, Limonene, Citral, Evernia Prunastri Extract.",
            shippingNotes: "Complimentary express shipping across India within 3-5 business days.",
            returnsAndExchanges: "Unsealed items cannot be returned. Complimentary 1ml discovery vial included."
        },
        isActive: true
    },
    {
        name: "Midnight Glimmer",
        slug: "midnight-glimmer",
        categoryName: "Women",
        description: "Provocative and deep. Dark Cherry and Tonka Bean meet a base of smoky Vetiver for a mysterious allure.",
        images: ["media/midnight/1.png", "media/midnight/2.png", "media/midnight/3.png"],
        mainAccords: ["Fruity", "Sweet", "Vanilla", "Balsamic", "Smoky"],
        perfumePyramid: {
            top: ["Dark Cherry", "Almond"],
            middle: ["Tonka Bean", "Rose de Grasse"],
            base: ["Vetiver", "Vanilla", "Cedar"]
        },
        sizes: [
            { size: "50ml", mrp: 1795, sellingPrice: 1095, stock: 999 },
            { size: "100ml", mrp: 2495, sellingPrice: 1795, stock: 999 }
        ],
        details: {
            whereToWear: "Night clubs, gala dinners, romantic dates, and exclusive celebrations.",
            keyNotes: "Dark Cherry, Almond, Tonka Bean, Rose, Vetiver, Vanilla.",
            ingredients: "Alcohol Denat., Parfum, Aqua, Coumarin, Benzyl Benzoate, Eugenol.",
            shippingNotes: "Complimentary express shipping across India within 3-5 business days.",
            returnsAndExchanges: "Unsealed items cannot be returned. Complimentary 1ml discovery vial included."
        },
        isActive: true
    }
];

async function syncProducts() {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB Atlas!");

    const categories = await Category.find({});
    const catMap = {};
    for (const c of categories) {
        catMap[c.name.toLowerCase()] = c._id;
    }

    for (const p of flagshipProducts) {
        const catId = catMap[p.categoryName.toLowerCase()] || categories[0]._id;
        
        let existing = await Product.findOne({
            $or: [
                { slug: p.slug },
                { name: new RegExp('^' + p.name + '$', 'i') }
            ]
        });

        if (existing) {
            existing.name = p.name;
            existing.slug = p.slug;
            existing.description = p.description;
            existing.category = catId;
            existing.images = p.images;
            existing.mainAccords = p.mainAccords;
            existing.perfumePyramid = p.perfumePyramid;
            existing.sizes = p.sizes;
            existing.details = p.details;
            existing.isActive = true;
            await existing.save();
            console.log(`Updated product: ${p.name} (slug: ${existing.slug}, ID: ${existing._id})`);
        } else {
            const created = await Product.create({
                name: p.name,
                slug: p.slug,
                description: p.description,
                category: catId,
                images: p.images,
                mainAccords: p.mainAccords,
                perfumePyramid: p.perfumePyramid,
                sizes: p.sizes,
                details: p.details,
                isActive: true
            });
            console.log(`Created product: ${p.name} (slug: ${created.slug}, ID: ${created._id})`);
        }
    }

    const totalInDb = await Product.countDocuments();
    console.log(`Total products in database: ${totalInDb}`);
    await mongoose.disconnect();
}

syncProducts().catch(err => {
    console.error("Sync error:", err);
    process.exit(1);
});
