const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");
require("dotenv").config();

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME || process.env.CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: async (req, file) => {
        let folder = 'brunati_products';
        let resource_type = 'auto'; // Auto-detect for videos/images
        
        if (req.path.includes('banners')) folder = 'brunati_banners';
        if (req.path.includes('trends')) folder = 'brunati_trends';
        if (req.path.includes('influencers')) folder = 'brunati_influencers';
        
        return {
            folder: folder,
            resource_type: resource_type,
            allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'mp4', 'webm', 'mov']
        };
    }
});


module.exports = { cloudinary, storage };
