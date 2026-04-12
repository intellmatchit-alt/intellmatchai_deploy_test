/**
 * WhatsApp Service
 *
 * Handles sending WhatsApp messages via WhatsApp Business API or Twilio.
 * Used for collaboration invitations and notifications.
 *
 * @module infrastructure/services/WhatsAppService
 */

import { logger } from '../../shared/logger';

// ============================================================================
// Types
// ============================================================================

export interface WhatsAppMessage {
  to: string; // Phone number in E.164 format (e.g., +1234567890)
  text?: string;
  template?: {
    name: string;
    language: string;
    components?: WhatsAppTemplateComponent[];
  };
}

export interface WhatsAppTemplateComponent {
  type: 'header' | 'body' | 'button';
  parameters: Array<{
    type: 'text' | 'image' | 'document' | 'video';
    text?: string;
    image?: { link: string };
  }>;
}

export interface CollaborationInvitationMessage {
  recipientPhone: string;
  recipientName: string;
  inviterName: string;
  ownerName: string;
  projectTitle: string;
  projectDescription?: string;
  invitationUrl: string;
  customMessage?: string;
}

export interface WhatsAppSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

// ============================================================================
// WhatsApp Service Class
// ============================================================================

export class WhatsAppService {
  private isConfigured: boolean = false;
  private apiUrl: string;
  private apiToken: string;
  private phoneNumberId: string;
  private provider: 'whatsapp_cloud' | 'twilio' | 'mock';

  constructor() {
    this.apiUrl = process.env.WHATSAPP_API_URL || '';
    this.apiToken = process.env.WHATSAPP_API_TOKEN || '';
    this.phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || '';

    // Determine provider based on configuration
    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
      this.provider = 'twilio';
      this.isConfigured = true;
    } else if (this.apiToken && this.phoneNumberId) {
      this.provider = 'whatsapp_cloud';
      this.isConfigured = true;
    } else {
      this.provider = 'mock';
      this.isConfigured = false;
      logger.warn('WhatsApp service not configured - messages will be logged only');
    }
  }

  /**
   * Check if WhatsApp service is available
   */
  isAvailable(): boolean {
    return this.isConfigured;
  }

  /**
   * Send a text message via WhatsApp
   */
  async sendMessage(message: WhatsAppMessage): Promise<WhatsAppSendResult> {
    if (!this.isConfigured) {
      logger.info('WhatsApp message (mock)', {
        to: message.to,
        text: message.text?.substring(0, 100),
      });
      return { success: true, messageId: `mock-${Date.now()}` };
    }

    try {
      if (this.provider === 'twilio') {
        return this.sendViaTwilio(message);
      } else {
        return this.sendViaWhatsAppCloud(message);
      }
    } catch (error: any) {
      logger.error('Failed to send WhatsApp message', {
        error: error.message,
        to: message.to,
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Send collaboration invitation via WhatsApp
   */
  async sendCollaborationInvitation(
    data: CollaborationInvitationMessage
  ): Promise<WhatsAppSendResult> {
    const text = this.formatCollaborationInvitationMessage(data);

    return this.sendMessage({
      to: this.normalizePhoneNumber(data.recipientPhone),
      text,
    });
  }

  /**
   * Format collaboration invitation message
   */
  private formatCollaborationInvitationMessage(
    data: CollaborationInvitationMessage
  ): string {
    const lines = [
      `Hi ${data.recipientName},`,
      '',
      `${data.inviterName} thinks you might be a great fit for a project called "${data.projectTitle}"`,
    ];

    if (data.projectDescription) {
      lines.push('');
      lines.push(data.projectDescription.substring(0, 200));
      if (data.projectDescription.length > 200) lines[lines.length - 1] += '...';
    }

    if (data.customMessage) {
      lines.push('');
      lines.push(`Message from ${data.inviterName}:`);
      lines.push(`"${data.customMessage}"`);
    }

    lines.push('');
    lines.push(`Project Owner: ${data.ownerName}`);
    lines.push('');
    lines.push('Click below to learn more and respond:');
    lines.push(data.invitationUrl);
    lines.push('');
    lines.push('- IntellMatch Team');

    return lines.join('\n');
  }

  /**
   * Normalize phone number to E.164 format
   */
  private normalizePhoneNumber(phone: string): string {
    // Remove all non-numeric characters except leading +
    let normalized = phone.replace(/[^\d+]/g, '');

    // Ensure it starts with +
    if (!normalized.startsWith('+')) {
      // Assume US number if no country code
      if (normalized.length === 10) {
        normalized = '+1' + normalized;
      } else {
        normalized = '+' + normalized;
      }
    }

    return normalized;
  }

  /**
   * Send via WhatsApp Cloud API (Meta)
   */
  private async sendViaWhatsAppCloud(
    message: WhatsAppMessage
  ): Promise<WhatsAppSendResult> {
    const url = `https://graph.facebook.com/v18.0/${this.phoneNumberId}/messages`;

    const body: any = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: message.to,
    };

    if (message.template) {
      body.type = 'template';
      body.template = message.template;
    } else {
      body.type = 'text';
      body.text = { body: message.text };
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json() as { error?: { message?: string }; messages?: Array<{ id: string }> };

    if (!response.ok) {
      throw new Error(data.error?.message || 'WhatsApp API error');
    }

    logger.info('WhatsApp message sent via Cloud API', {
      to: message.to,
      messageId: data.messages?.[0]?.id,
    });

    return {
      success: true,
      messageId: data.messages?.[0]?.id,
    };
  }

  /**
   * Send via Twilio WhatsApp API
   */
  private async sendViaTwilio(
    message: WhatsAppMessage
  ): Promise<WhatsAppSendResult> {
    const accountSid = process.env.TWILIO_ACCOUNT_SID!;
    const authToken = process.env.TWILIO_AUTH_TOKEN!;
    const fromNumber = process.env.TWILIO_WHATSAPP_NUMBER || 'whatsapp:+14155238886';

    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;

    const params = new URLSearchParams();
    params.append('From', fromNumber.startsWith('whatsapp:') ? fromNumber : `whatsapp:${fromNumber}`);
    params.append('To', message.to.startsWith('whatsapp:') ? message.to : `whatsapp:${message.to}`);
    params.append('Body', message.text || '');

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
    });

    const data = await response.json() as { message?: string; sid?: string };

    if (!response.ok) {
      throw new Error(data.message || 'Twilio API error');
    }

    logger.info('WhatsApp message sent via Twilio', {
      to: message.to,
      messageId: data.sid,
    });

    return {
      success: true,
      messageId: data.sid,
    };
  }
}

// Export singleton instance
export const whatsAppService = new WhatsAppService();
