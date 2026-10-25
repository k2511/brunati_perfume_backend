const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");

const connectDB = require("./config/db");

const paymentRoute = require("./routes/paymentRoutes")
// Connect to database
// connectDB(); // Called in server.js instead

const app = express();

// Trust proxy for Vercel
app.set('trust proxy', 1);

// Middleware to ensure DB is connected before any request is processed
app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    console.error("DB Middleware Error:", err);
    res.status(503).json({
      status: false,
      message: "Database connection error. Please try again shortly.",
      data: null
    });
  }
});

// Middlewares
app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Robust CORS for Production
const allowedOrigins = [
  process.env.FRONTEND_URL,
  "http://localhost:5173",
  "http://localhost:5174",
  "https://brunati.in", // Add user's potential production domain if known
  "https://www.brunati.in"
].filter(Boolean);

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);
      
      if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV !== 'production') {
        callback(null, true);
      } else {
        console.error(`CORS Blocked: Origin ${origin} not in allowedOrigins:`, allowedOrigins);
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
  })
);

// Routes
app.use("/api/v1/users", require("./routes/userRoutes"));
app.use("/api/v1/products", require("./routes/productRoutes"));
app.use("/api/v1/orders", require("./routes/orderRoutes"));
app.use("/api/v1/reviews", require("./routes/reviewRoutes"));
app.use("/api/v1/samples", require("./routes/sampleRoutes"));
app.use("/api/v1/announcements", require("./routes/announcementRoutes"));
app.use("/api/v1/categories", require("./routes/categoryRoutes"));
app.use("/api/v1/banners", require("./routes/bannerRoutes"));
app.use("/api/v1/testimonials", require("./routes/testimonialRoutes"));
app.use("/api/v1/influencers", require("./routes/influencerRoutes"));
app.use("/api/v1/trends", require("./routes/trendRoutes"));
app.use("/api/v1/admin", require("./routes/adminRoutes"));
app.use("/api/v1/policies", require("./routes/policyRoutes"));

app.use("/api/v1/payment", paymentRoute);





const authRoutes = require("./routes/authRoutes");
app.use("/api/v1", authRoutes);




app.get('/', (req, res) => {
  res.send("API is running...");
});

// 404 Handler
app.use((req, res, next) => {
  const error = new Error(`Not Found - ${req.originalUrl}`);
  res.status(404);
  next(error);
});

// Global Error Handler
app.use((err, req, res, next) => {
  let message = err.message;
  if (err.name === 'MulterError' || err.message === 'Unexpected field') {
      if (err.code === 'LIMIT_FILE_SIZE') {
          message = "File is too large! Vercel limits uploads to 4.5MB. Please compress your image and try again.";
      } else if (err.field) {
          message = `Unexpected field: '${err.field}'. You uploaded a file using a key name we don't accept. Only 'images' and 'storyImages' are allowed.`;
      } else {
          message = `Upload Error: ${err.message}. Please check your file and try again!`;
      }
  }


  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  res.status(statusCode).json({
    status: false,
    message: message,
    data: null,
    stack: process.env.NODE_ENV === "production" ? null : err.stack,
  });
});

module.exports = app;
