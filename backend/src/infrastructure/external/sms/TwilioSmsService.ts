/**
 * Twilio SMS Service
 *
 * Implements ISmsService using Twilio for sending SMS messages.
 * Used for collaboration invitations and notifications.
 *
 * Configuration via environment variables:
 * - TWILIO_ACCOUNT_SID: Twilio account SID
 * - TWILIO_AUTH_TOKEN: Twilio auth token
 * - TWILIO_PHONE_NUMBER: Twilio phone number (E.164 format)
 *
 * @module infrastructure/external/sms/TwilioSmsService
 */

import Twilio from 'twilio';
import { ISmsService, SmsSendResult } from '../../../application/interfaces/ISmsService';
import { logger } from '../../../shared/logger';

export class TwilioSmsService implements ISmsService {
  private client: Twilio.Twilio | null = null;
  private fromNumber: string;
  private configured: boolean = false;

  constructor() {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    this.fromNumber = process.env.TWILIO_PHONE_NUMBER || '';

    if (!accountSid || !authToken || !this.fromNumber) {
      logger.warn('Twilio SMS service not configured - missing credentials. SMS sending will be disabled.', {
        service: 'p2p-api',
        component: 'TwilioSmsService',
        hasAccountSid: !!accountSid,
        hasAuthToken: !!authToken,
        hasPhoneNumber: !!this.fromNumber,
      });
      return;
    }

    try {
      this.client = Twilio(accountSid, authToken);
      this.configured = true;
      logger.info('Twilio SMS service configured successfully', {
        service: 'p2p-api',
        component: 'TwilioSmsService',
        fromNumber: this.fromNumber,
      });
    } catch (error: any) {
      logger.error('Failed to initialize Twilio SMS client', {
        service: 'p2p-api',
        component: 'TwilioSmsService',
        error: error.message,
      });
    }
  }

  /**
   * Check if the SMS service is properly configured and available
   */
  isAvailable(): boolean {
    return this.configured && this.client !== null;
  }

  /**
   * Send a raw SMS message
   */
  async sendSms(to: string, body: string): Promise<SmsSendResult> {
    if (!this.isAvailable()) {
      logger.warn('SMS not sent - Twilio not configured', {
        service: 'p2p-api',
        component: 'TwilioSmsService',
        to,
      });
      return {
        success: false,
        error: 'SMS service not configured',
      };
    }

    try {
      const normalizedTo = this.normalizePhoneNumber(to);

      const message = await this.client!.messages.create({
        body,
        from: this.fromNumber,
        to: normalizedTo,
      });

      logger.info('SMS sent successfully via Twilio', {
        service: 'p2p-api',
        component: 'TwilioSmsService',
        messageId: message.sid,
        to: normalizedTo,
        status: message.status,
      });

      return {
        success: true,
        messageId: message.sid,
      };
    } catch (error: any) {
      logger.error('Failed to send SMS via Twilio', {
        service: 'p2p-api',
        component: 'TwilioSmsService',
        to,
        error: error.message,
        code: error.code,
        moreInfo: error.moreInfo,
      });

      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Send a collaboration invitation SMS
   */
  async sendInvitation(
    to: string,
    inviterName: string,
    projectTitle: string,
    inviteLink: string
  ): Promise<SmsSendResult> {
    const body = this.formatInvitationMessage(inviterName, projectTitle, inviteLink);
    return this.sendSms(to, body);
  }

  /**
   * Format an invitation message for SMS
   * Kept concise to stay within SMS character limits
   */
  private formatInvitationMessage(
    inviterName: string,
    projectTitle: string,
    inviteLink: string
  ): string {
    return (
      `${inviterName} thinks you'd be a great fit for "${projectTitle}" on IntellMatch. ` +
      `View details and respond: ${inviteLink}`
    );
  }

  /**
   * Normalize phone number to E.164 format
   */
  private normalizePhoneNumber(phone: string): string {
    // Remove all non-numeric characters except leading +
    let normalized = phone.replace(/[^\d+]/g, '');

    // Ensure it starts with +
    if (!normalized.startsWith('+')) {
      // Assume US number if no country code and 10 digits
      if (normalized.length === 10) {
        normalized = '+1' + normalized;
      } else {
        normalized = '+' + normalized;
      }
    }

    return normalized;
  }
}

// Export singleton instance
export const twilioSmsService = new TwilioSmsService();
