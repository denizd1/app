const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const { upload, status } = require("../controllers/excel.controller");

// ---------------------------
// Configure file upload storage
// ---------------------------
// You can adjust the destination folder as needed
const uploadDir = path.join(__dirname, "../uploads");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // e.g. excel_20251006_123456.xlsx
    const uniqueSuffix = Date.now() + path.extname(file.originalname);
    cb(null, "excel_" + uniqueSuffix);
  },
});

const uploadMiddleware = multer({
  storage: storage,
  fileFilter: function (req, file, cb) {
    if (!file.originalname.match(/\.(xls|xlsx)$/)) {
      return cb(new Error("Only Excel files (.xls/.xlsx) are allowed"));
    }
    cb(null, true);
  },
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
});

// ---------------------------
// Router setup
// ---------------------------
const router = express.Router();

// Upload route — queues the import job
router.post(
  "/upload",
  uploadMiddleware.single("file"),
  async (req, res, next) => {
    try {
      await upload(req, res);
    } catch (err) {
      next(err);
    }
  }
);

// Job status route — checks import progress
router.get("/status/:id", async (req, res, next) => {
  try {
    await status(req, res);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
