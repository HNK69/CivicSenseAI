const multer  = require('multer');
const path    = require('path');
const { uploadToCloudinary } = require('../config/cloudinary');

/* ---- Allowed MIME types ---- */
const ALLOWED_IMAGES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const ALLOWED_VIDEOS = ['video/mp4', 'video/webm', 'video/quicktime'];
const ALLOWED_ALL    = [...ALLOWED_IMAGES, ...ALLOWED_VIDEOS];

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

/* ---- Use memory storage so we can pipe to Cloudinary ---- */
const storage = multer.memoryStorage();

const fileFilter = (_req, file, cb) => {
  if (ALLOWED_ALL.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Unsupported file type: ${file.mimetype}`), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE },
});

/**
 * handleCloudinaryUpload — middleware that takes multer-processed files
 * from req.files (or req.file) and uploads them to Cloudinary.
 *
 * After this middleware, req.uploadedMedia is an object:
 *   { images: [{url, publicId}], videos: [{url, publicId}] }
 *
 * Usage after: upload.fields([{ name:'images', maxCount:5 }, { name:'videos', maxCount:2 }])
 */
const handleCloudinaryUpload = async (req, res, next) => {
  try {
    req.uploadedMedia = { images: [], videos: [] };
    const files = req.files || {};

    const imageFiles = files.images || [];
    const videoFiles = files.videos || [];

    for (const file of imageFiles) {
      const result = await uploadToCloudinary(file.buffer, 'civicsense/issues', 'image');
      req.uploadedMedia.images.push(result);
    }
    for (const file of videoFiles) {
      const result = await uploadToCloudinary(file.buffer, 'civicsense/issues', 'video');
      req.uploadedMedia.videos.push(result);
    }

    // Single avatar file
    if (req.file) {
      const result = await uploadToCloudinary(req.file.buffer, 'civicsense/avatars', 'image');
      req.uploadedMedia.avatar = result;
    }

    next();
  } catch (err) {
    next(err);
  }
};

/**
 * Preset field configs for convenience
 */
const uploadIssueMedia = upload.fields([
  { name: 'images', maxCount: 5 },
  { name: 'videos', maxCount: 2 },
]);

const uploadAvatar = upload.single('avatar');

module.exports = {
  upload,
  uploadIssueMedia,
  uploadAvatar,
  handleCloudinaryUpload,
};
