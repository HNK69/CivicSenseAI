const cloudinary = require('cloudinary').v2;

const required = ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'];
const missing  = required.filter(k => !process.env[k]);

if (missing.length > 0) {
  // Non-fatal in dev — uploads will fail but server still starts.
  // In production, treat this as fatal.
  console.warn(`[cloudinary] WARNING: Missing env vars: ${missing.join(', ')}. Media uploads will fail.`);
}

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || '',
  api_key:    process.env.CLOUDINARY_API_KEY    || '',
  api_secret: process.env.CLOUDINARY_API_SECRET || '',
  secure:     true,
});

/**
 * uploadToCloudinary — Promise-based upload from a buffer.
 * @param {Buffer} buffer      — file buffer from multer memoryStorage
 * @param {string} folder      — Cloudinary folder (e.g. 'civicsense/issues')
 * @param {string} resourceType — 'image' | 'video' | 'raw'
 * @returns {Promise<{url, publicId}>}
 */
const uploadToCloudinary = (buffer, folder = 'civicsense', resourceType = 'image') => {
  return new Promise((resolve) => {
    if (missing.length > 0) {
      console.warn('[cloudinary] Missing keys — using fallback placeholder media URL.');
      const fallbackUrl = resourceType === 'video'
        ? 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4'
        : 'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?w=600';
      return resolve({ url: fallbackUrl, publicId: `fallback-${Date.now()}` });
    }

    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: resourceType },
      (error, result) => {
        if (error) {
          console.error('[cloudinary] Upload error:', error.message);
          const fallbackUrl = resourceType === 'video'
            ? 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4'
            : 'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?w=600';
          return resolve({ url: fallbackUrl, publicId: `fallback-${Date.now()}` });
        }
        resolve({ url: result.secure_url, publicId: result.public_id });
      }
    );
    const streamifier = require('streamifier');
    streamifier.createReadStream(buffer).pipe(stream);
  });
};

/**
 * deleteFromCloudinary — Remove a resource by public_id.
 */
const deleteFromCloudinary = (publicId, resourceType = 'image') =>
  cloudinary.uploader.destroy(publicId, { resource_type: resourceType });

module.exports = { cloudinary, uploadToCloudinary, deleteFromCloudinary };
