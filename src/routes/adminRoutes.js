const express = require("express");
const router = express.Router();

const adminMiddleware = require("../middleware/adminMiddleware");
const upload = require("../middleware/uploadMiddleware");

const adminProductController = require("../controllers/admin/adminProductController");
const adminReviewController = require("../controllers/admin/adminReviewController");
const adminOrderController = require("../controllers/admin/adminOrderController");

const adminAnnouncementController = require("../controllers/admin/adminAnnouncementController");
const adminSettingsController = require("../controllers/admin/adminSettingsController");
const adminCategoryController = require("../controllers/admin/adminCategoryController");
const adminDashboardController = require("../controllers/admin/adminDashboardController");
const adminBannerController = require("../controllers/admin/adminBannerController");
const adminAuthController = require("../controllers/admin/adminAuthController");
const adminTrendController = require("../controllers/admin/adminTrendController");
const adminInfluencerController = require("../controllers/admin/adminInfluencerController");
const adminTestimonialController = require("../controllers/admin/adminTestimonialController");
const adminPolicyController = require("../controllers/admin/adminPolicyController");


/* ─── PUBLIC: Auth (no token required) ─── */
router.post("/login", adminAuthController.adminLogin);
router.post("/logout", adminAuthController.adminLogout);
router.post("/forgot-password", adminAuthController.adminForgotPassword);

/* ─── All routes below this line require a valid admin JWT cookie ─── */
router.use(adminMiddleware);

router.get("/check-auth", adminAuthController.checkAuth);
router.put("/profile", adminAuthController.updateAdminProfile);

/* DASHBOARD */
router.get("/dashboard", adminDashboardController.getDashboard);

/* PRODUCT MANAGEMENT */

router.post("/products", upload.fields([{ name: 'images', maxCount: 10 }, { name: 'storyImages', maxCount: 5 }]), adminProductController.createProduct);
router.put("/products/:id", upload.fields([{ name: 'images', maxCount: 10 }, { name: 'storyImages', maxCount: 5 }]), adminProductController.updateProduct);
router.delete("/products/:id", adminProductController.deleteProduct);
router.get("/products", adminProductController.getAllProducts);

/* CATEGORY MANAGEMENT */

router.post("/categories", upload.single("image"), adminCategoryController.createCategory);
router.put("/categories/:id", upload.single("image"), adminCategoryController.updateCategory);
router.delete("/categories/:id", adminCategoryController.deleteCategory);
router.get("/categories", adminCategoryController.getAllCategories);

/* REVIEW MANAGEMENT */

router.post("/reviews", adminReviewController.createReview);
router.put("/reviews/:id", adminReviewController.updateReview);
router.delete("/reviews/:id", adminReviewController.deleteReview);
router.get("/reviews", adminReviewController.getAllReviews);


/* ANNOUNCEMENTS */

router.post("/announcements", adminAnnouncementController.createAnnouncement);
router.put("/announcements/:id", adminAnnouncementController.updateAnnouncement);
router.delete("/announcements/:id", adminAnnouncementController.deleteAnnouncement);
router.get("/announcements", adminAnnouncementController.getAllAnnouncements);


/* ORDERS */

router.get("/orders", adminOrderController.getAllOrders);
router.get("/orders/:orderId", adminOrderController.getOrderDetails);
router.patch("/orders/bulk-update", adminOrderController.bulkUpdateOrders);
router.patch("/orders/:orderId/status", adminOrderController.updateOrderStatus);
router.patch("/orders/:orderId/payment-status", adminOrderController.updatePaymentStatus);
router.delete("/orders/bulk-delete", adminOrderController.bulkDeleteOrders);


/* TREND MANAGEMENT */
router.post("/trends", upload.single("video"), adminTrendController.createTrend);
router.put("/trends/:id", upload.single("video"), adminTrendController.updateTrend);
router.delete("/trends/:id", adminTrendController.deleteTrend);
router.get("/trends", adminTrendController.getAllTrends);

/* INFLUENCER MANAGEMENT */
router.post("/famous-people", upload.single("image"), adminInfluencerController.createInfluencer);
router.put("/famous-people/:id", upload.single("image"), adminInfluencerController.updateInfluencer);
router.delete("/famous-people/:id", adminInfluencerController.deleteInfluencer);
router.get("/famous-people", adminInfluencerController.getAllInfluencers);

/* TESTIMONIALS (Landing Page Reviews) */
router.post("/testimonials", adminTestimonialController.createTestimonial);
router.put("/testimonials/:id", adminTestimonialController.updateTestimonial);
router.delete("/testimonials/:id", adminTestimonialController.deleteTestimonial);
router.get("/testimonials", adminTestimonialController.getAllTestimonials);

/* BANNER MANAGEMENT */

router.post("/banners", upload.single("image"), adminBannerController.createBanner);
router.put("/banners/:id", upload.single("image"), adminBannerController.updateBanner);
router.delete("/banners/:id", adminBannerController.deleteBanner);
router.get("/banners", adminBannerController.getAllBanners);

/* SETTINGS */

router.get("/settings", adminSettingsController.getSettings);
router.put("/settings/free-samples", adminSettingsController.updateFreeSampleSettings);

/* POLICY MANAGEMENT */
router.get("/policies", adminPolicyController.getAllPolicies);
router.post("/policies", adminPolicyController.createPolicy);
router.put("/policies/:id", adminPolicyController.updatePolicy);
router.delete("/policies/:id", adminPolicyController.deletePolicy);

module.exports = router;
