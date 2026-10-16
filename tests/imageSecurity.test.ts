import { describe, it, expect } from 'vitest';
import {
  validateImageBuffer,
  detectMagicMimeType,
  parseImageDimensions,
  checkSensitiveImageCues,
  createTestPng,
} from '../src/lib/security/imageSecurity';

describe('Phase 5: Image Security & Validation Controls', () => {
  describe('Magic Byte MIME Detection', () => {
    it('accurately identifies PNG magic bytes', () => {
      const png = createTestPng(100, 100);
      expect(detectMagicMimeType(png)).toBe('image/png');
    });

    it('accurately identifies JPEG magic bytes', () => {
      const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
      expect(detectMagicMimeType(jpeg)).toBe('image/jpeg');
    });

    it('accurately identifies WebP magic bytes', () => {
      const webp = Buffer.from([
        0x52, 0x49, 0x46, 0x46, // RIFF
        0x20, 0x00, 0x00, 0x00,
        0x57, 0x45, 0x42, 0x50, // WEBP
      ]);
      expect(detectMagicMimeType(webp)).toBe('image/webp');
    });

    it('rejects unsupported or disguised media types (GIF, SVG, HTML, PDF)', () => {
      const gif = Buffer.from('GIF89a\x01\x00\x01\x00\x80\x00\x00\xff\xff\xff\x00\x00\x00!\xf9\x04\x01\x00\x00\x00\x00,\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x02D\x01\x00;');
      const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
      const html = Buffer.from('<!DOCTYPE html><html><body><h1>Disguised HTML</h1></body></html>');
      const pdf = Buffer.from('%PDF-1.4\n%...\n');

      expect(detectMagicMimeType(gif)).toBeNull();
      expect(detectMagicMimeType(svg)).toBeNull();
      expect(detectMagicMimeType(html)).toBeNull();
      expect(detectMagicMimeType(pdf)).toBeNull();
    });
  });

  describe('Dimension Extraction & Size Boundaries', () => {
    it('correctly parses width and height from valid PNG headers', () => {
      const png = createTestPng(640, 480);
      const dims = parseImageDimensions(png, 'image/png');
      expect(dims).not.toBeNull();
      expect(dims?.width).toBe(640);
      expect(dims?.height).toBe(480);
      expect(dims?.mimeType).toBe('image/png');
    });

    it('validates genuine screenshot image within safe bounds (100x100 to 8000x8000, <= 5MB)', () => {
      const png = createTestPng(300, 200, 'Test screenshot content');
      const res = validateImageBuffer(png, 'image/png');

      expect(res.isValid).toBe(true);
      if (res.isValid) {
        expect(res.mimeType).toBe('image/png');
        expect(res.dimensions.width).toBe(300);
        expect(res.dimensions.height).toBe(200);
      }
    });

    it('rejects files smaller than 100 bytes minimum container threshold', () => {
      const tiny = Buffer.from([0x89, 0x50, 0x4e, 0x47]); // 4 bytes
      const res = validateImageBuffer(tiny);

      expect(res.isValid).toBe(false);
      if (!res.isValid) {
        expect(res.errorCode).toBe('FILE_TOO_SMALL');
      }
    });

    it('rejects files larger than 5 MB ceiling', () => {
      // Create a virtual oversized buffer > 5 MB
      const oversized = Buffer.alloc(5 * 1024 * 1024 + 1024);
      const res = validateImageBuffer(oversized);

      expect(res.isValid).toBe(false);
      if (!res.isValid) {
        expect(res.errorCode).toBe('FILE_TOO_LARGE');
      }
    });

    it('rejects extreme dimensions (< 50x50 tracking pixels or > 8000x8000 zip bombs)', () => {
      // 10x10 tracking pixel
      const trackingPixel = createTestPng(10, 10);
      const resTracking = validateImageBuffer(trackingPixel);

      expect(resTracking.isValid).toBe(false);
      if (!resTracking.isValid) {
        expect(resTracking.errorCode).toBe('INVALID_DIMENSIONS');
      }

      // 9000x9000 decompression bomb header
      const bomb = createTestPng(9000, 9000);
      const resBomb = validateImageBuffer(bomb);

      expect(resBomb.isValid).toBe(false);
      if (!resBomb.isValid) {
        expect(resBomb.errorCode).toBe('INVALID_DIMENSIONS');
      }
    });
  });

  describe('Sensitive Credentials & Data Leakage Cues', () => {
    it('detects unmasked card CVV security codes in OCR text', () => {
      const text = 'Payment Card: Visa CVV: 842 Valid Thru: 12/28';
      const check = checkSensitiveImageCues(text);
      expect(check.isSensitive).toBe(true);
      expect(check.cueMessage).toContain('CVV');
    });

    it('detects full 16-digit payment card numbers in screenshot', () => {
      const text = 'Transfer to card 4111 2222 3333 4444 approved';
      const check = checkSensitiveImageCues(text);
      expect(check.isSensitive).toBe(true);
      expect(check.cueMessage).toContain('card number');
    });

    it('detects netbanking password or ATM PIN labels', () => {
      const text = 'Login details: Username: user123 Netbanking Password: secretPassword!';
      const check = checkSensitiveImageCues(text);
      expect(check.isSensitive).toBe(true);
    });

    it('returns not sensitive for ordinary alert texts', () => {
      const text = 'SBI YONO: Electricity bill unpaid. Disconnection tonight at 9 PM.';
      const check = checkSensitiveImageCues(text);
      expect(check.isSensitive).toBe(false);
    });
  });
});
