/**
 * Client-Side Image Compression & Content Disarm/Reconstruction (CDR) Utility
 *
 * Uses native HTML5 Canvas pixel re-encoding to:
 * 1. Allow non-technical users to select large smartphone camera photos (up to 25 MB)
 *    without hitting upload size rejections.
 * 2. Downscale resolution proportionally (default max 1280px) and compress to WebP/JPEG
 *    (typically reducing 10–15 MB camera photos down to 80–250 KB).
 * 3. Strip all EXIF metadata and potential polyglot/script payloads (CDR security).
 */

export interface CompressImageOptions {
  maxWidthOrHeight?: number;
  quality?: number;
  maxInputBytes?: number;
}

export interface CompressedImageResult {
  file: File;
  dataUrl: string;
  originalSize: number;
  compressedSize: number;
  width: number;
  height: number;
}

const DEFAULT_MAX_DIMENSION = 1280;
const DEFAULT_QUALITY = 0.82;
const DEFAULT_MAX_INPUT_BYTES = 25 * 1024 * 1024; // 25 MB raw camera ceiling

export async function compressImageFile(
  inputFile: File,
  options: CompressImageOptions = {}
): Promise<CompressedImageResult> {
  const maxDimension = options.maxWidthOrHeight ?? DEFAULT_MAX_DIMENSION;
  const quality = options.quality ?? DEFAULT_QUALITY;
  const maxInputBytes = options.maxInputBytes ?? DEFAULT_MAX_INPUT_BYTES;

  if (!inputFile.type.startsWith("image/")) {
    throw new Error("File harus berupa gambar (JPG, PNG, atau WebP)");
  }

  if (inputFile.size > maxInputBytes) {
    throw new Error("Ukuran foto mentah melebihi batas wajar kamera (maksimal 25 MB)");
  }

  const imageSource = await loadImageElement(inputFile);
  const { width, height } = calculateTargetDimensions(
    imageSource.naturalWidth || imageSource.width,
    imageSource.naturalHeight || imageSource.height,
    maxDimension
  );

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Browser tidak mendukung pemrosesan kanvas gambar");
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(imageSource, 0, 0, width, height);

  // Prefer modern WebP; fallback to JPEG if browser encoder does not support WebP
  let targetMime = "image/webp";
  let ext = ".webp";
  let dataUrl = canvas.toDataURL(targetMime, quality);

  if (!dataUrl.startsWith("data:image/webp")) {
    targetMime = "image/jpeg";
    ext = ".jpg";
    dataUrl = canvas.toDataURL(targetMime, quality);
  }

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (b) resolve(b);
        else reject(new Error("Gagal melakukan kompresi biner gambar"));
      },
      targetMime,
      quality
    );
  });

  const baseName = inputFile.name.replace(/\.[^/.]+$/, "") || "image";
  const compressedFile = new File([blob], `${baseName}${ext}`, {
    type: targetMime,
    lastModified: Date.now(),
  });

  return {
    file: compressedFile,
    dataUrl,
    originalSize: inputFile.size,
    compressedSize: compressedFile.size,
    width,
    height,
  };
}

function calculateTargetDimensions(
  srcWidth: number,
  srcHeight: number,
  maxDimension: number
): { width: number; height: number } {
  if (srcWidth <= 0 || srcHeight <= 0) {
    return { width: maxDimension, height: maxDimension };
  }

  if (srcWidth <= maxDimension && srcHeight <= maxDimension) {
    return { width: srcWidth, height: srcHeight };
  }

  if (srcWidth >= srcHeight) {
    return {
      width: maxDimension,
      height: Math.max(1, Math.round((srcHeight * maxDimension) / srcWidth)),
    };
  }

  return {
    width: Math.max(1, Math.round((srcWidth * maxDimension) / srcHeight)),
    height: maxDimension,
  };
}

function loadImageElement(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(img);
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("File gambar rusak atau format tidak didukung"));
    };

    img.src = objectUrl;
  });
}
