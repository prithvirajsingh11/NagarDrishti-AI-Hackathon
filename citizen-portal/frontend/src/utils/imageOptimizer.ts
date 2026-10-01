/**
 * Android-Friendly Client-Side Image Optimizer
 * 
 * Ensures large photos captured from modern Android cameras (12MP-108MP, 8MB-20MB)
 * do not exhaust WebView memory or trigger upload timeouts, while preserving
 * crisp textures, edge definitions, and visual evidence needed for Gemini AI classification.
 */

export interface OptimizeImageOptions {
  maxDimension?: number;
  quality?: number;
  maxSizeBytes?: number;
}

const DEFAULT_MAX_DIMENSION = 1920; // Sufficient for high-confidence AI defect recognition
const DEFAULT_QUALITY = 0.88;       // High visual fidelity, prevents artifacting
const MAX_ALLOWED_SIZE = 10 * 1024 * 1024; // 10 MB system boundary

export async function optimizeImageForUpload(
  file: File,
  options: OptimizeImageOptions = {}
): Promise<File> {
  const maxDim = options.maxDimension || DEFAULT_MAX_DIMENSION;
  const quality = options.quality || DEFAULT_QUALITY;
  const maxSizeBytes = options.maxSizeBytes || MAX_ALLOWED_SIZE;

  // Validate format
  const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
  if (!validTypes.includes(file.type.toLowerCase())) {
    throw new Error('Unsupported image format. Please upload JPG, PNG, or WEBP.');
  }

  // Check upload limit boundary
  if (file.size > maxSizeBytes) {
    throw new Error('Image exceeds 10 MB limit. Please select a smaller photo.');
  }

  // If already compact and reasonable size (< 1.5MB), avoid extra canvas processing
  if (file.size <= 1.5 * 1024 * 1024) {
    return file;
  }

  return new Promise((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      let width = img.naturalWidth || img.width;
      let height = img.naturalHeight || img.height;

      // If dimensions are within bounds and size is acceptable, return original
      if (width <= maxDim && height <= maxDim && file.size <= 2.5 * 1024 * 1024) {
        resolve(file);
        return;
      }

      // Calculate constrained dimensions preserving exact aspect ratio
      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        // Fallback to original file if canvas context unavailable
        resolve(file);
        return;
      }

      // High quality image smoothing
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(file);
            return;
          }

          // Create new optimized File object
          const cleanName = file.name.replace(/\.[^/.]+$/, '') + '.jpg';
          const optimizedFile = new File([blob], cleanName, {
            type: 'image/jpeg',
            lastModified: Date.now(),
          });

          resolve(optimizedFile);
        },
        'image/jpeg',
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      // Fallback gracefully to original
      resolve(file);
    };

    img.src = objectUrl;
  });
}
