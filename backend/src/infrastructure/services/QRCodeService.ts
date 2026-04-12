/**
 * QR Code Service
 *
 * Generates QR codes for events.
 *
 * @module infrastructure/services/QRCodeService
 */

import QRCode from 'qrcode';
import { logger } from '../../shared/logger';

export interface QRCodeOptions {
  format?: 'png' | 'svg' | 'base64';
  size?: number;
  margin?: number;
  darkColor?: string;
  lightColor?: string;
}

const DEFAULT_OPTIONS: QRCodeOptions = {
  format: 'png',
  size: 300,
  margin: 2,
  darkColor: '#000000',
  lightColor: '#ffffff',
};

/**
 * QR Code Service
 *
 * Generates QR codes in various formats.
 */
export class QRCodeService {
  /**
   * Generate QR code for an event URL
   *
   * @param eventCode - The unique event code
   * @param options - QR code generation options
   * @returns QR code as buffer (PNG), string (SVG), or data URL (base64)
   */
  async generateEventQR(
    eventCode: string,
    options: QRCodeOptions = {}
  ): Promise<Buffer | string> {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    const baseUrl = process.env.FRONTEND_URL || 'https://intellmatch.com';
    const eventUrl = `${baseUrl}/e/${eventCode}`;

    logger.debug(`Generating QR code for event: ${eventCode}`, { format: opts.format });

    const qrOptions = {
      width: opts.size,
      margin: opts.margin,
      color: {
        dark: opts.darkColor,
        light: opts.lightColor,
      },
    };

    try {
      switch (opts.format) {
        case 'svg':
          return await QRCode.toString(eventUrl, {
            ...qrOptions,
            type: 'svg',
          });

        case 'base64':
          return await QRCode.toDataURL(eventUrl, qrOptions);

        case 'png':
        default:
          return await QRCode.toBuffer(eventUrl, {
            ...qrOptions,
            type: 'png',
          });
      }
    } catch (error) {
      logger.error('Failed to generate QR code', { eventCode, error });
      throw new Error('Failed to generate QR code');
    }
  }

  /**
   * Generate QR code as PNG buffer
   */
  async generatePNG(eventCode: string, size = 300): Promise<Buffer> {
    return (await this.generateEventQR(eventCode, { format: 'png', size })) as Buffer;
  }

  /**
   * Generate QR code as SVG string
   */
  async generateSVG(eventCode: string, size = 300): Promise<string> {
    return (await this.generateEventQR(eventCode, { format: 'svg', size })) as string;
  }

  /**
   * Generate QR code as base64 data URL
   */
  async generateBase64(eventCode: string, size = 300): Promise<string> {
    return (await this.generateEventQR(eventCode, { format: 'base64', size })) as string;
  }
}

// Export singleton instance
export const qrCodeService = new QRCodeService();
