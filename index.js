const express = require("express");
const multer = require("multer");
const sharp = require("sharp");
const cors = require("cors");
const path = require("path");

const fs = require("fs");

const app = express();
const port = 3000;

// Set up multer for image uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // Limit file size to 10MB
});
app.use(cors());
// Helper function to compress image to a specific size (in KB)
async function compressImageToExactSize(buffer, targetSizeKB, width, height) {
  console.log(targetSizeKB, width, height);
  let lowQuality = 1; // Minimum quality
  let highQuality = 100; // Maximum quality
  let optimalBuffer = buffer;
  let currentSizeKB = Buffer.byteLength(buffer) / 1024;

  while (lowQuality <= highQuality) {
    const midQuality = Math.floor((lowQuality + highQuality) / 2);

    // Resize and compress the image
    const resizedImageBuffer = await sharp(buffer)
      .resize(width, height)
      .jpeg({ quality: midQuality })
      .toBuffer();

    const resizedImageSizeKB = Buffer.byteLength(resizedImageBuffer) / 1024;

    if (resizedImageSizeKB < targetSizeKB) {
      lowQuality = midQuality + 1; // Increase quality if size is too small
      optimalBuffer = resizedImageBuffer; // Store current buffer
    } else if (resizedImageSizeKB > targetSizeKB) {
      highQuality = midQuality - 1; // Decrease quality if size is too large
      optimalBuffer = resizedImageBuffer; // Store current buffer
    } else {
      return resizedImageBuffer; // Exact match found
    }
  }

  // Final adjustment if we couldn't find an exact match
  return optimalBuffer;
}
app.get("/", (req, res) => {
  //   res.send({ name: "sammek" });
  res.sendFile(__dirname + "/ui.html");
});
// Endpoint to upload and resize image
app.post("/upload", upload.single("image"), async (req, res) => {
  console.log(req.file);
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Please upload an image" });
    }

    // Get the width, height, and desired size from the request
    const width = parseInt(req.body.width) || 800; // Default width
    const height = parseInt(req.body.height) || 600; // Default height
    const targetSizeKB = parseInt(req.body.size); // Desired size in KB (sent by the user)

    if (!targetSizeKB || targetSizeKB <= 0) {
      return res
        .status(400)
        .json({ error: "Please provide a valid size in KB" });
    }

    // Log the original file size (in bytes and KB)
    const fileSizeInBytes = req.file.size;
    const fileSizeInKB = fileSizeInBytes / 1024;
    console.log(
      `Original file size: ${fileSizeInBytes} bytes (${fileSizeInKB.toFixed(
        2
      )} KB)`
    );

    // Compress the image to the target size
    const resizedImage = await compressImageToExactSize(
      req.file.buffer,
      targetSizeKB,
      width,
      height
    );

    // Log the resized image size
    const resizedImageSizeInBytes = Buffer.byteLength(resizedImage);
    const resizedImageSizeInKB = resizedImageSizeInBytes / 1024;
    console.log(
      `Resized image size: ${resizedImageSizeInBytes} bytes (${resizedImageSizeInKB.toFixed(
        2
      )} KB)`
    );

    // Save the resized image to a file (optional)
    const outputPath = path.join(
      __dirname,
      "uploads",
      `resized-${Date.now()}.jpg`
    );
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

// Create 'uploads' directory if it doesn't exist
if (!fs.existsSync(path.join(__dirname, "uploads"))) {
  fs.mkdirSync(path.join(__dirname, "uploads"));
}

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
