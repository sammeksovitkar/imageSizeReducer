const express = require("express");
const multer = require("multer");
const sharp = require("sharp");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

const app = express();

// Set up multer for image uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // Limit file size to 10MB
});
app.use(cors());

// Helper function to compress image to a specific size (in KB)
async function compressImageToExactSize(buffer, targetSizeKB, width, height) {
  let lowQuality = 1;
  let highQuality = 100;
  let optimalBuffer = buffer;

  while (lowQuality <= highQuality) {
    const midQuality = Math.floor((lowQuality + highQuality) / 2);

    const resizedImageBuffer = await sharp(buffer)
      .resize(width, height)
      .jpeg({ quality: midQuality })
      .toBuffer();

    const resizedImageSizeKB = Buffer.byteLength(resizedImageBuffer) / 1024;

    if (resizedImageSizeKB < targetSizeKB) {
      lowQuality = midQuality + 1;
      optimalBuffer = resizedImageBuffer;
    } else if (resizedImageSizeKB > targetSizeKB) {
      highQuality = midQuality - 1;
      optimalBuffer = resizedImageBuffer;
    } else {
      return resizedImageBuffer;
    }
  }

  return optimalBuffer;
}

app.get("/", (req, res) => {
  res.sendFile(__dirname + "/ui.html");
});

app.post("/upload", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Please upload an image" });
    }

    const width = parseInt(req.body.width) || 800;
    const height = parseInt(req.body.height) || 600;
    const targetSizeKB = parseInt(req.body.size);

    if (!targetSizeKB || targetSizeKB <= 0) {
      return res.status(400).json({ error: "Please provide a valid size in KB" });
    }

    const fileSizeInKB = req.file.size / 1024;
    const resizedImage = await compressImageToExactSize(req.file.buffer, targetSizeKB, width, height);

    const resizedImageSizeInKB = Buffer.byteLength(resizedImage) / 1024;

    const outputPath = path.join(__dirname, "uploads", `resized-${Date.now()}.jpg`);
    fs.writeFileSync(outputPath, resizedImage);

    res.json({
      message: "Image uploaded and resized successfully",
      originalSize: `${fileSizeInKB.toFixed(2)} KB`,
      resizedSize: `${resizedImageSizeInKB.toFixed(2)} KB`,
      path: outputPath,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to process image" });
  }
});

// Export the app instead of calling app.listen
module.exports = app;
