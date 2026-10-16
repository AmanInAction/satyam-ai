/**
 * Image Security & Validation Controls
 * Enforces strict MIME, size, dimension, magic byte checks, and sensitive data detection.
 */

export const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB ceiling
export const MIN_IMAGE_SIZE_BYTES = 100; // 100 Bytes minimum valid container
export const MIN_IMAGE_DIMENSION = 50; // Minimum 50x50 to avoid tracking pixels
export const MAX_IMAGE_DIMENSION = 8000; // Maximum 8000x8000 to prevent decompression exhaustion

export const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;
export type AllowedImageMimeType = (typeof ALLOWED_MIME_TYPES)[number];

export interface ImageDimensions {
  width: number;
  height: number;
  mimeType: AllowedImageMimeType;
}

export interface ImageValidationSuccess {
  isValid: true;
  mimeType: AllowedImageMimeType;
  dimensions: ImageDimensions;
  sizeBytes: number;
}

export interface ImageValidationFailure {
  isValid: false;
  errorCode: 'FILE_TOO_LARGE' | 'FILE_TOO_SMALL' | 'INVALID_IMAGE_TYPE' | 'INVALID_DIMENSIONS' | 'MALFORMED_IMAGE';
  errorMessage: string;
}

export type ImageValidationResult = ImageValidationSuccess | ImageValidationFailure;

/**
 * Checks magic byte signatures to ensure the file is an authentic PNG, JPEG, or WEBP,
 * preventing MIME spoofing and disguised payloads (SVG, HTML, executables).
 */
export function detectMagicMimeType(buffer: Buffer): AllowedImageMimeType | null {
  if (buffer.length < 12) return null;

  // PNG Magic Bytes: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'image/png';
  }

  // JPEG Magic Bytes: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }

  // WEBP Magic Bytes: "RIFF" .... "WEBP"
  if (
    buffer[0] === 0x52 && // R
    buffer[1] === 0x49 && // I
    buffer[2] === 0x46 && // F
    buffer[3] === 0x46 && // F
    buffer[8] === 0x57 && // W
    buffer[9] === 0x45 && // E
    buffer[10] === 0x42 && // B
    buffer[11] === 0x50 // P
  ) {
    return 'image/webp';
  }

  return null;
}

/**
 * Extracts width and height directly from image headers in pure TypeScript.
 * Returns null if the header cannot be read or contains invalid data.
 */
export function parseImageDimensions(buffer: Buffer, detectedMime: AllowedImageMimeType): ImageDimensions | null {
  try {
    if (detectedMime === 'image/png') {
      // In PNG, IHDR chunk starts at byte 8 (length 4 bytes, type 'IHDR' 4 bytes)
      // Width is at byte 16 (4 bytes UInt32BE), Height is at byte 20 (4 bytes UInt32BE)
      if (buffer.length < 24) return null;
      const width = buffer.readUInt32BE(16);
      const height = buffer.readUInt32BE(20);
      return { width, height, mimeType: 'image/png' };
    }

    if (detectedMime === 'image/jpeg') {
      let offset = 2; // Skip SOI (FF D8)
      while (offset < buffer.length - 8) {
        if (buffer[offset] !== 0xff) {
          offset++;
          continue;
        }

        const marker = buffer[offset + 1];

        // Standalone markers without length: RST, SOI, EOI, TEM
        if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
          offset += 2;
          continue;
        }

        const length = buffer.readUInt16BE(offset + 2);
        if (length < 2 || offset + 2 + length > buffer.length) break;

        // Baseline SOF0 (0xC0), Extended SOF1 (0xC1), Progressive SOF2 (0xC2), etc.
        const isSOF =
          (marker >= 0xc0 && marker <= 0xc3) ||
          (marker >= 0xc5 && marker <= 0xc7) ||
          (marker >= 0xc9 && marker <= 0xcb) ||
          (marker >= 0xcd && marker <= 0xcf);

        if (isSOF && length >= 7) {
          const height = buffer.readUInt16BE(offset + 5);
          const width = buffer.readUInt16BE(offset + 7);
          return { width, height, mimeType: 'image/jpeg' };
        }

        offset += 2 + length;
      }
      return null;
    }

    if (detectedMime === 'image/webp') {
      if (buffer.length < 30) return null;
      const chunkFourCC = buffer.toString('ascii', 12, 16);

      // VP8 (lossy)
      if (chunkFourCC === 'VP8 ') {
        if (buffer.length < 30) return null;
        // Check frame tag and start code (9d 01 2a)
        const width = buffer.readUInt16LE(26) & 0x3fff;
        const height = buffer.readUInt16LE(28) & 0x3fff;
        return { width, height, mimeType: 'image/webp' };
      }

      // VP8L (lossless)
      if (chunkFourCC === 'VP8L') {
        if (buffer.length < 25) return null;
        // Signature byte at offset 20 should be 0x2f
        if (buffer[20] === 0x2f) {
          const b1 = buffer[21];
          const b2 = buffer[22];
          const b3 = buffer[23];
          const b4 = buffer[24];
          const width = 1 + (((b2 & 0x3f) << 8) | b1);
          const height = 1 + (((b4 & 0x0f) << 10) | (b3 << 2) | ((b2 & 0xc0) >> 6));
          return { width, height, mimeType: 'image/webp' };
        }
      }

      // VP8X (extended)
      if (chunkFourCC === 'VP8X') {
        if (buffer.length < 30) return null;
        const width = 1 + buffer.readUIntLE(24, 3);
        const height = 1 + buffer.readUIntLE(27, 3);
        return { width, height, mimeType: 'image/webp' };
      }
    }
  } catch {
    return null;
  }

  return null;
}

/**
 * Validates an image buffer comprehensively.
 */
export function validateImageBuffer(
  buffer: Buffer,
  declaredMimeType?: string
): ImageValidationResult {
  if (buffer.length < MIN_IMAGE_SIZE_BYTES) {
    return {
      isValid: false,
      errorCode: 'FILE_TOO_SMALL',
      errorMessage: `Image file is too small (${buffer.length} bytes). Minimum valid image size is ${MIN_IMAGE_SIZE_BYTES} bytes.`,
    };
  }

  if (buffer.length > MAX_IMAGE_SIZE_BYTES) {
    return {
      isValid: false,
      errorCode: 'FILE_TOO_LARGE',
      errorMessage: `Image file exceeds the 5 MB size limit (${Math.round(buffer.length / (1024 * 1024))} MB).`,
    };
  }

  const magicMime = detectMagicMimeType(buffer);
  if (!magicMime) {
    return {
      isValid: false,
      errorCode: 'INVALID_IMAGE_TYPE',
      errorMessage: 'Unsupported or unverified image file type. Only PNG, JPEG, and WebP images are allowed.',
    };
  }

  if (declaredMimeType && declaredMimeType.toLowerCase() !== magicMime) {
    // If declared MIME conflicts with actual container magic bytes
    if (!ALLOWED_MIME_TYPES.includes(declaredMimeType.toLowerCase() as AllowedImageMimeType)) {
      return {
        isValid: false,
        errorCode: 'INVALID_IMAGE_TYPE',
        errorMessage: `Declared MIME type '${declaredMimeType}' is unsupported. Only PNG, JPEG, and WebP are accepted.`,
      };
    }
  }

  const dims = parseImageDimensions(buffer, magicMime);
  if (!dims || dims.width <= 0 || dims.height <= 0) {
    return {
      isValid: false,
      errorCode: 'MALFORMED_IMAGE',
      errorMessage: 'Image header is corrupted or unreadable.',
    };
  }

  if (
    dims.width < MIN_IMAGE_DIMENSION ||
    dims.height < MIN_IMAGE_DIMENSION ||
    dims.width > MAX_IMAGE_DIMENSION ||
    dims.height > MAX_IMAGE_DIMENSION
  ) {
    return {
      isValid: false,
      errorCode: 'INVALID_DIMENSIONS',
      errorMessage: `Image dimensions (${dims.width}x${dims.height}) exceed safe boundaries (min ${MIN_IMAGE_DIMENSION}x${MIN_IMAGE_DIMENSION}, max ${MAX_IMAGE_DIMENSION}x${MAX_IMAGE_DIMENSION}).`,
    };
  }

  return {
    isValid: true,
    mimeType: magicMime,
    dimensions: dims,
    sizeBytes: buffer.length,
  };
}

/**
 * Checks extracted OCR text for sensitive credential cues (CVV, full card number, OTP, ATM PIN).
 * Helps warn the user about uploading confidential credentials.
 */
export function checkSensitiveImageCues(text: string): { isSensitive: boolean; cueMessage?: string } {
  const lower = text.toLowerCase();

  // CVV / CVC with 3-4 digits
  if (/\b(?:cvv|cvc|security code)\s*[:=]?\s*\d{3,4}\b/i.test(lower)) {
    return {
      isSensitive: true,
      cueMessage: 'Detected possible card CVV/security code in screenshot. Never share card security codes.',
    };
  }

  // Full 16-digit credit card pattern (grouped 4-4-4-4 or 16 continuous digits)
  if (/\b(?:\d{4}[-\s]?){3}\d{4}\b/.test(text)) {
    return {
      isSensitive: true,
      cueMessage: 'Detected possible full payment card number in screenshot. Mask card numbers before sharing.',
    };
  }

  // ATM PIN or Password credentials
  if (/\b(?:atm\s*pin|netbanking\s*password)\s*[:=]?\s*\S+/i.test(lower)) {
    return {
      isSensitive: true,
      cueMessage: 'Detected sensitive PIN or password credentials in screenshot.',
    };
  }

  return { isSensitive: false };
}

/**
 * Creates a valid PNG buffer of specified dimensions with optional embedded mock text.
 * Highly useful for deterministic unit testing and presets.
 */
export function createTestPng(width: number = 100, height: number = 100, mockText?: string): Buffer {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8;
  ihdrData[9] = 2;
  ihdrData[10] = 0;
  ihdrData[11] = 0;
  ihdrData[12] = 0;

  const ihdrChunk = Buffer.concat([
    Buffer.from([0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52]),
    ihdrData,
    Buffer.from([0x00, 0x00, 0x00, 0x00]),
  ]);

  const idatChunk = Buffer.from([
    0x00, 0x00, 0x00, 0x0a,
    0x49, 0x44, 0x41, 0x54,
    0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00, 0x05, 0x00, 0x01,
    0x00, 0x00, 0x00, 0x00,
  ]);

  const iendChunk = Buffer.from([
    0x00, 0x00, 0x00, 0x00,
    0x49, 0x45, 0x4e, 0x44,
    0xae, 0x42, 0x60, 0x82,
  ]);

  // Ensure minimum size of 100 bytes by padding
  const padding = Buffer.alloc(Math.max(0, 100 - (signature.length + ihdrChunk.length + idatChunk.length + iendChunk.length)));

  const parts = [signature, ihdrChunk, idatChunk, padding, iendChunk];
  if (mockText) {
    parts.push(Buffer.from(`\nMOCK_OCR:${mockText}`));
  }

  return Buffer.concat(parts);
}
