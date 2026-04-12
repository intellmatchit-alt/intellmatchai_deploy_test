/**
 * Email Service
 *
 * Handles sending emails via SendGrid Web API with beautifully designed IntellMatch templates.
 *
 * @module infrastructure/services/EmailService
 */

import sgMail from '@sendgrid/mail';
import { logger } from '../../shared/logger';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

interface VerificationEmailData {
  name: string;
  verificationUrl: string;
  expiresIn: string;
}

interface PasswordResetEmailData {
  name: string;
  resetUrl: string;
  expiresIn: string;
}

interface WelcomeEmailData {
  name: string;
  loginUrl: string;
}

interface InvitationEmailData {
  inviterName: string;
  inviteeName: string;
  inviteUrl: string;
  message?: string;
}

interface MatchNotificationData {
  userName: string;
  contactName: string;
  contactCompany?: string;
  contactJobTitle?: string;
  matchScore: number;
  matchReasons: string[];
  viewMatchUrl: string;
}

interface WeeklyDigestData {
  userName: string;
  topMatches: Array<{
    name: string;
    company?: string;
    score: number;
    reason: string;
  }>;
  newConnectionsCount: number;
  viewAllUrl: string;
}

interface DailyRecommendationData {
  userName: string;
  recommendations: Array<{
    name: string;
    company?: string;
    reason: string;
    viewUrl: string;
  }>;
  dashboardUrl: string;
}

interface TaskEmailData {
  contactName: string;
  senderName: string;
  taskTitle: string;
  taskDescription?: string;
  taskDueDate?: string;
  taskPriority: string;
}

interface TeamInquiryEmailData {
  companyName: string;
  contactName: string;
  email: string;
  phone?: string;
  teamSize: string;
  message?: string;
}

interface PaymentConfirmationEmailData {
  customerName: string;
  plan: string;
  billingInterval: string;
  amount: number;
  currency: string;
  seats?: number;
  transactionRef: string;
  paymentDate: string;
  periodStart: string;
  periodEnd: string;
  dashboardUrl: string;
}

interface InvoiceEmailData {
  customerName: string;
  customerEmail: string;
  invoiceNumber: string;
  invoiceDate: string;
  plan: string;
  billingInterval: string;
  amount: number;
  currency: string;
  seats?: number;
  transactionRef: string;
  periodStart: string;
  periodEnd: string;
  companyName?: string;
  companyAddress?: string;
}

interface PaymentNotificationToAdminData {
  customerName: string;
  customerEmail: string;
  plan: string;
  billingInterval: string;
  amount: number;
  currency: string;
  seats?: number;
  transactionRef: string;
  paymentDate: string;
}

interface CollaborationInvitationEmailData {
  recipientName: string;
  inviterName: string;
  ownerName: string;
  ownerCompany?: string;
  sourceType: string;
  sourceTitle: string;
  sourceDescription?: string;
  invitationUrl: string;
  customMessage?: string;
}

interface IntroductionConsentEmailData {
  contactName: string;
  collaboratorName: string;
  ownerName: string;
  ownerCompany?: string;
  sourceType: string;
  sourceTitle: string;
  sourceDescription?: string;
  introductionUrl: string;
  customMessage?: string;
}

interface OrganizationInvitationEmailData {
  recipientEmail: string;
  inviterName: string;
  organizationName: string;
  role: string;
  inviteUrl: string;
}

interface EventInvitationEmailData {
  recipientName: string;
  recipientEmail: string;
  hostName: string;
  eventName: string;
  eventDate: string;
  eventLocation?: string;
  eventDescription?: string;
  registerUrl: string;
  customMessage?: string;
}

/**
 * Email Service for sending transactional emails
 */
export class EmailService {
  private isConfigured: boolean = false;
  private fromAddress: string;
  private fromName: string;
  private frontendUrl: string;

  constructor() {
    this.fromAddress = process.env.SMTP_FROM_EMAIL || 'info@intellmatch.com';
    this.fromName = process.env.SMTP_FROM_NAME || 'IntellMatch';
    this.frontendUrl = process.env.FRONTEND_URL || 'https://intellmatch.com';
    this.initializeSendGrid();
  }

  /**
   * Initialize SendGrid API
   */
  private initializeSendGrid(): void {
    const apiKey = process.env.SMTP_PASS; // SendGrid API key stored in SMTP_PASS

    if (!apiKey || !apiKey.startsWith('SG.')) {
      logger.warn('SendGrid API key not configured. Email sending will be disabled.', {
        service: 'p2p-api',
        component: 'EmailService',
      });
      return;
    }

    try {
      sgMail.setApiKey(apiKey);
      this.isConfigured = true;
      logger.info('SendGrid API configured successfully', {
        service: 'p2p-api',
        component: 'EmailService',
        fromEmail: this.fromAddress,
      });
    } catch (error) {
      logger.error('Failed to initialize SendGrid', {
        service: 'p2p-api',
        component: 'EmailService',
        error,
      });
    }
  }

  /**
   * Send an email via SendGrid API
   */
  async sendEmail(options: EmailOptions): Promise<boolean> {
    if (!this.isConfigured) {
      logger.warn('Email not sent - SendGrid not configured', {
        service: 'p2p-api',
        component: 'EmailService',
        to: options.to,
        subject: options.subject,
      });
      return false;
    }

    try {
      const msg = {
        to: options.to,
        from: {
          email: this.fromAddress,
          name: this.fromName,
        },
        subject: options.subject,
        html: options.html,
        text: options.text || this.stripHtml(options.html),
      };

      const [response] = await sgMail.send(msg);

      logger.info('Email sent successfully via SendGrid', {
        service: 'p2p-api',
        component: 'EmailService',
        statusCode: response.statusCode,
        to: options.to,
        subject: options.subject,
      });

      return true;
    } catch (error: any) {
      logger.error('Failed to send email via SendGrid', {
        service: 'p2p-api',
        component: 'EmailService',
        to: options.to,
        error: error.message,
        response: error.response?.body,
      });
      return false;
    }
  }

  /**
   * Send email verification email
   */
  async sendVerificationEmail(to: string, data: VerificationEmailData): Promise<boolean> {
    const html = this.getVerificationEmailTemplate(data);
    return this.sendEmail({
      to,
      subject: '✉️ Verify Your Email - IntellMatch',
      html,
    });
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(to: string, data: PasswordResetEmailData): Promise<boolean> {
    const html = this.getPasswordResetEmailTemplate(data);
    return this.sendEmail({
      to,
      subject: '🔐 Reset Your Password - IntellMatch',
      html,
    });
  }

  /**
   * Send welcome email
   */
  async sendWelcomeEmail(to: string, data: WelcomeEmailData): Promise<boolean> {
    const html = this.getWelcomeEmailTemplate(data);
    return this.sendEmail({
      to,
      subject: '🎉 Welcome to IntellMatch!',
      html,
    });
  }

  /**
   * Send invitation email
   */
  async sendInvitationEmail(to: string, data: InvitationEmailData): Promise<boolean> {
    const html = this.getInvitationEmailTemplate(data);
    return this.sendEmail({
      to,
      subject: `🤝 ${data.inviterName} invited you to join IntellMatch`,
      html,
    });
  }

  /**
   * Send organization member invitation email
   */
  async sendOrganizationInvitationEmail(to: string, data: OrganizationInvitationEmailData): Promise<boolean> {
    const html = this.getOrganizationInvitationEmailTemplate(data);
    return this.sendEmail({
      to,
      subject: `🏢 ${data.inviterName} invited you to join ${data.organizationName} on IntellMatch`,
      html,
    });
  }

  /**
   * Send collaboration invitation email (for project/opportunity/pitch/deal)
   */
  async sendCollaborationInvitationEmail(to: string, data: CollaborationInvitationEmailData): Promise<boolean> {
    const html = this.getCollaborationInvitationEmailTemplate(data);
    const sourceTypeLabel = this.getSourceTypeLabel(data.sourceType);
    return this.sendEmail({
      to,
      subject: `🚀 ${data.inviterName} thinks you're a great fit for ${data.sourceTitle}`,
      html,
    });
  }

  /**
   * Send introduction consent email (for introduction consent flow)
   */
  async sendIntroductionConsentEmail(to: string, data: IntroductionConsentEmailData): Promise<boolean> {
    const html = this.getIntroductionConsentEmailTemplate(data);
    return this.sendEmail({
      to,
      subject: `${data.collaboratorName} would like to introduce you to ${data.ownerName} for "${data.sourceTitle}"`,
      html,
    });
  }

  /**
   * Send event invitation email to attendees
   */
  async sendEventInvitation(to: string, data: EventInvitationEmailData): Promise<boolean> {
    const html = this.getEventInvitationEmailTemplate(data);
    return this.sendEmail({
      to,
      subject: `🎉 ${data.hostName} invites you to join IntellMatch - ${data.eventName}`,
      html,
    });
  }

  /**
   * Send bulk event invitations
   */
  async sendBulkEventInvitations(
    attendees: Array<{ email: string; name: string }>,
    eventData: Omit<EventInvitationEmailData, 'recipientName' | 'recipientEmail'>
  ): Promise<{ sent: number; failed: number }> {
    let sent = 0;
    let failed = 0;

    for (const attendee of attendees) {
      const result = await this.sendEventInvitation(attendee.email, {
        ...eventData,
        recipientName: attendee.name,
        recipientEmail: attendee.email,
      });

      if (result) {
        sent++;
      } else {
        failed++;
      }
    }

    return { sent, failed };
  }

  /**
   * Get source type label for email
   */
  private getSourceTypeLabel(sourceType: string): string {
    switch (sourceType) {
      case 'PROJECT':
        return 'project';
      case 'OPPORTUNITY':
        return 'opportunity';
      case 'PITCH':
        return 'pitch';
      case 'DEAL':
        return 'deal';
      default:
        return 'project';
    }
  }

  /**
   * Send high-score match notification
   */
  async sendMatchNotification(to: string, data: MatchNotificationData): Promise<boolean> {
    const html = this.getMatchNotificationTemplate(data);
    return this.sendEmail({
      to,
      subject: `🌟 New High-Score Match: ${data.contactName} (${data.matchScore}%)`,
      html,
    });
  }

  /**
   * Send weekly match digest
   */
  async sendWeeklyDigest(to: string, data: WeeklyDigestData): Promise<boolean> {
    const html = this.getWeeklyDigestTemplate(data);
    return this.sendEmail({
      to,
      subject: '📊 Your Weekly Match Digest - IntellMatch',
      html,
    });
  }

  /**
   * Send daily recommendation reminder
   */
  async sendDailyRecommendation(to: string, data: DailyRecommendationData): Promise<boolean> {
    const html = this.getDailyRecommendationTemplate(data);
    return this.sendEmail({
      to,
      subject: "💡 Today's Recommended Connections - IntellMatch",
      html,
    });
  }

  /**
   * Send task email to contact
   */
  async sendTaskEmail(to: string, data: TaskEmailData): Promise<boolean> {
    const html = this.getTaskEmailTemplate(data);
    return this.sendEmail({
      to,
      subject: `📋 Task from ${data.senderName}: ${data.taskTitle}`,
      html,
    });
  }

  /**
   * Send team plan inquiry email to sales team
   */
  async sendTeamInquiryEmail(data: TeamInquiryEmailData): Promise<boolean> {
    const html = this.getTeamInquiryEmailTemplate(data);
    const recipients = [
      'osama.alasasfah@gmail.com',
      'maen.qatamin@entreviable.com',
    ];

    let success = true;
    for (const to of recipients) {
      const result = await this.sendEmail({
        to,
        subject: `🏢 Team Plan Inquiry from ${data.companyName}`,
        html,
      });
      if (!result) success = false;
    }
    return success;
  }

  /**
   * Send payment confirmation email to customer
   */
  async sendPaymentConfirmationEmail(to: string, data: PaymentConfirmationEmailData): Promise<boolean> {
    const html = this.getPaymentConfirmationTemplate(data);
    return this.sendEmail({
      to,
      subject: `✅ Payment Confirmed - ${data.plan} Plan Activated`,
      html,
    });
  }

  /**
   * Send invoice email to customer
   */
  async sendInvoiceEmail(to: string, data: InvoiceEmailData): Promise<boolean> {
    const html = this.getInvoiceEmailTemplate(data);
    return this.sendEmail({
      to,
      subject: `🧾 Invoice #${data.invoiceNumber} - IntellMatch`,
      html,
    });
  }

  /**
   * Send payment notification to admin
   */
  async sendPaymentNotificationToAdmin(data: PaymentNotificationToAdminData): Promise<boolean> {
    const html = this.getPaymentNotificationToAdminTemplate(data);
    const adminEmails = [
      'osama.alasasfah@gmail.com',
      'maen.qatamin@entreviable.com',
    ];

    let success = true;
    for (const to of adminEmails) {
      const result = await this.sendEmail({
        to,
        subject: `💰 New Payment: ${data.plan} Plan - $${data.amount} ${data.currency}`,
        html,
      });
      if (!result) success = false;
    }
    return success;
  }

  /**
   * Strip HTML tags for plain text version
   */
  private stripHtml(html: string): string {
    return html
      .replace(/<style[^>]*>.*<\/style>/gi, '')
      .replace(/<script[^>]*>.*<\/script>/gi, '')
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * IntellMatch Logo - uses hosted image
   */
  private getLogo(): string {
    return `
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
        <tr>
          <td align="center" style="padding-bottom: 32px;">
            <img src="${this.frontendUrl}/intelllogo.png" alt="IntellMatch" width="180" height="auto" style="display: block; max-width: 180px; height: auto;" />
            <p style="color: #9ca3af; font-size: 13px; margin: 16px 0 0 0; letter-spacing: 1px;">AI-Powered Professional Networking</p>
          </td>
        </tr>
      </table>
    `;
  }

  /**
   * Base email template wrapper - Premium Design matching frontend theme
   */
  private getBaseTemplate(content: string, preheader?: string): string {
    const preheaderHtml = preheader
      ? `<span style="display: none !important; visibility: hidden; mso-hide: all; font-size: 1px; line-height: 1px; max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden;">${preheader}</span>`
      : '';

    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>IntellMatch</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0a0a0a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  ${preheaderHtml}

  <!-- Main Container -->
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #0a0a0a;">
    <tr>
      <td align="center" style="padding: 40px 20px;">

        <!-- Email Card -->
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 600px; background: linear-gradient(145deg, #171717 0%, #0f0f0f 100%); border: 1px solid rgba(139, 92, 246, 0.2); border-radius: 24px;">
          <tr>
            <td style="padding: 48px 40px;">

              <!-- Logo -->
              ${this.getLogo()}

              <!-- Content -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td align="center">
                    ${content}
                  </td>
                </tr>
              </table>

            </td>
          </tr>
        </table>

        <!-- Footer -->
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 600px;">
          <tr>
            <td align="center" style="padding: 32px 24px;">
              <p style="color: #6b7280; font-size: 13px; margin: 0 0 8px 0;">
                <a href="${this.frontendUrl}/privacy" style="color: #9ca3af; text-decoration: none;">Privacy</a>
                <span style="color: #4b5563; margin: 0 12px;">•</span>
                <a href="${this.frontendUrl}/terms" style="color: #9ca3af; text-decoration: none;">Terms</a>
                <span style="color: #4b5563; margin: 0 12px;">•</span>
                <a href="${this.frontendUrl}/settings" style="color: #9ca3af; text-decoration: none;">Unsubscribe</a>
              </p>
              <p style="color: #4b5563; font-size: 12px; margin: 16px 0 0 0;">
                © ${new Date().getFullYear()} IntellMatch. All rights reserved.
              </p>
            </td>
          </tr>
        </table>

      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();
  }

  /**
   * Email verification template
   */
  private getVerificationEmailTemplate(data: VerificationEmailData): string {
    const content = `
      <!-- Icon -->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
        <tr>
          <td align="center" style="padding-bottom: 24px;">
            <div style="width: 80px; height: 80px; background: linear-gradient(135deg, rgba(139, 92, 246, 0.3) 0%, rgba(236, 72, 153, 0.3) 100%); border-radius: 20px; line-height: 80px; text-align: center;">
              <span style="font-size: 36px;">✉️</span>
            </div>
          </td>
        </tr>
      </table>

      <!-- Title -->
      <h1 style="color: #ffffff; font-size: 28px; font-weight: 700; margin: 0 0 8px 0; text-align: center;">
        Verify Your Email
      </h1>
      <p style="color: #9ca3af; font-size: 16px; text-align: center; margin: 0 0 32px 0;">
        One quick step to get started
      </p>

      <!-- Message -->
      <p style="color: #d1d5db; font-size: 16px; line-height: 1.7; margin: 0 0 16px 0; text-align: center;">
        Hi <strong style="color: #ffffff;">${data.name}</strong>,
      </p>
      <p style="color: #9ca3af; font-size: 16px; line-height: 1.7; margin: 0 0 32px 0; text-align: center;">
        Welcome to IntellMatch! Please verify your email address to activate your account and start building your professional network.
      </p>

      <!-- Button -->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
        <tr>
          <td align="center" style="padding: 32px 0;">
            <a href="${data.verificationUrl}" style="display: inline-block; background: linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%); color: #ffffff; text-decoration: none; padding: 16px 48px; border-radius: 12px; font-weight: 600; font-size: 16px;">
              ✓ Verify Email Address
            </a>
          </td>
        </tr>
      </table>

      <!-- Divider -->
      <div style="height: 1px; background: linear-gradient(90deg, transparent, rgba(139, 92, 246, 0.3), transparent); margin: 32px 0;"></div>

      <!-- Note -->
      <div style="background: rgba(251, 191, 36, 0.1); border: 1px solid rgba(251, 191, 36, 0.2); border-radius: 12px; padding: 16px; margin-bottom: 24px; text-align: center;">
        <p style="color: #fbbf24; font-size: 14px; margin: 0;">
          ⏰ This link expires in <strong>${data.expiresIn}</strong>
        </p>
      </div>

      <!-- Fallback Link -->
      <p style="color: #6b7280; font-size: 12px; margin: 0; text-align: center;">
        Or copy this link: <a href="${data.verificationUrl}" style="color: #a78bfa;">${data.verificationUrl}</a>
      </p>
    `;
    return this.getBaseTemplate(content, 'Please verify your email to activate your IntellMatch account');
  }

  /**
   * Password reset template
   */
  private getPasswordResetEmailTemplate(data: PasswordResetEmailData): string {
    const content = `
      <!-- Icon -->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
        <tr>
          <td align="center" style="padding-bottom: 24px;">
            <div style="width: 80px; height: 80px; background: linear-gradient(135deg, rgba(139, 92, 246, 0.3) 0%, rgba(236, 72, 153, 0.3) 100%); border-radius: 20px; line-height: 80px; text-align: center;">
              <span style="font-size: 36px;">🔐</span>
            </div>
          </td>
        </tr>
      </table>

      <!-- Title -->
      <h1 style="color: #ffffff; font-size: 28px; font-weight: 700; margin: 0 0 8px 0; text-align: center;">
        Reset Your Password
      </h1>
      <p style="color: #9ca3af; font-size: 16px; text-align: center; margin: 0 0 32px 0;">
        No worries, it happens to the best of us
      </p>

      <!-- Message -->
      <p style="color: #d1d5db; font-size: 16px; line-height: 1.7; margin: 0 0 16px 0; text-align: center;">
        Hi <strong style="color: #ffffff;">${data.name}</strong>,
      </p>
      <p style="color: #9ca3af; font-size: 16px; line-height: 1.7; margin: 0 0 32px 0; text-align: center;">
        We received a request to reset your password. Click the button below to create a new secure password.
      </p>

      <!-- Button -->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
        <tr>
          <td align="center" style="padding: 32px 0;">
            <a href="${data.resetUrl}" style="display: inline-block; background: linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%); color: #ffffff; text-decoration: none; padding: 16px 48px; border-radius: 12px; font-weight: 600; font-size: 16px;">
              🔑 Reset Password
            </a>
          </td>
        </tr>
      </table>

      <!-- Divider -->
      <div style="height: 1px; background: linear-gradient(90deg, transparent, rgba(139, 92, 246, 0.3), transparent); margin: 32px 0;"></div>

      <!-- Security Note -->
      <div style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.2); border-radius: 12px; padding: 16px; margin-bottom: 24px; text-align: center;">
        <p style="color: #f87171; font-size: 14px; margin: 0;">
          🛡️ This link expires in <strong>${data.expiresIn}</strong>
        </p>
      </div>

      <!-- Fallback Link -->
      <p style="color: #6b7280; font-size: 12px; margin: 0; text-align: center;">
        Or copy this link: <a href="${data.resetUrl}" style="color: #a78bfa;">${data.resetUrl}</a>
      </p>
    `;
    return this.getBaseTemplate(content, 'Reset your IntellMatch password');
  }

  /**
   * Welcome email template
   */
  private getWelcomeEmailTemplate(data: WelcomeEmailData): string {
    const content = `
      <!-- Icon -->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
        <tr>
          <td align="center" style="padding-bottom: 24px;">
            <div style="width: 80px; height: 80px; background: linear-gradient(135deg, rgba(16, 185, 129, 0.3) 0%, rgba(139, 92, 246, 0.3) 100%); border-radius: 20px; line-height: 80px; text-align: center;">
              <span style="font-size: 36px;">🎉</span>
            </div>
          </td>
        </tr>
      </table>

      <!-- Title -->
      <h1 style="color: #ffffff; font-size: 28px; font-weight: 700; margin: 0 0 8px 0; text-align: center;">
        Welcome to IntellMatch!
      </h1>
      <p style="color: #9ca3af; font-size: 16px; text-align: center; margin: 0 0 32px 0;">
        Your professional networking journey starts here
      </p>

      <!-- Message -->
      <p style="color: #d1d5db; font-size: 16px; line-height: 1.7; margin: 0 0 16px 0; text-align: center;">
        Hi <strong style="color: #ffffff;">${data.name}</strong>,
      </p>
      <p style="color: #9ca3af; font-size: 16px; line-height: 1.7; margin: 0 0 32px 0; text-align: center;">
        Thank you for joining IntellMatch! We're thrilled to have you.
      </p>

      <!-- Features -->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 24px 0;">
        <tr>
          <td align="center">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="background: rgba(139, 92, 246, 0.1); border-radius: 16px; padding: 24px; width: 100%;">
              <tr>
                <td align="center" style="padding: 12px;">
                  <span style="font-size: 32px;">📸</span>
                  <p style="color: #ffffff; font-size: 14px; font-weight: 600; margin: 8px 0 4px 0;">Scan Cards</p>
                  <p style="color: #9ca3af; font-size: 12px; margin: 0;">AI-powered OCR</p>
                </td>
                <td align="center" style="padding: 12px;">
                  <span style="font-size: 32px;">🤝</span>
                  <p style="color: #ffffff; font-size: 14px; font-weight: 600; margin: 8px 0 4px 0;">Smart Match</p>
                  <p style="color: #9ca3af; font-size: 12px; margin: 0;">AI connections</p>
                </td>
              </tr>
              <tr>
                <td align="center" style="padding: 12px;">
                  <span style="font-size: 32px;">🗺️</span>
                  <p style="color: #ffffff; font-size: 14px; font-weight: 600; margin: 8px 0 4px 0;">Visualize</p>
                  <p style="color: #9ca3af; font-size: 12px; margin: 0;">Network graph</p>
                </td>
                <td align="center" style="padding: 12px;">
                  <span style="font-size: 32px;">✨</span>
                  <p style="color: #ffffff; font-size: 14px; font-weight: 600; margin: 8px 0 4px 0;">AI Insights</p>
                  <p style="color: #9ca3af; font-size: 12px; margin: 0;">Recommendations</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>

      <!-- Button -->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
        <tr>
          <td align="center" style="padding: 32px 0;">
            <a href="${data.loginUrl}" style="display: inline-block; background: linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%); color: #ffffff; text-decoration: none; padding: 16px 48px; border-radius: 12px; font-weight: 600; font-size: 16px;">
              🚀 Get Started
            </a>
          </td>
        </tr>
      </table>

      <!-- Support -->
      <p style="color: #6b7280; font-size: 14px; text-align: center; margin: 24px 0 0 0;">
        Need help? <a href="mailto:support@intellmatch.com" style="color: #a78bfa;">support@intellmatch.com</a>
      </p>
    `;
    return this.getBaseTemplate(content, 'Welcome to IntellMatch! Start building your professional network today.');
  }

  /**
   * Invitation email template
   */
  private getInvitationEmailTemplate(data: InvitationEmailData): string {
    const messageSection = data.message
      ? `
      <div style="background: rgba(139, 92, 246, 0.1); border-left: 4px solid #8b5cf6; border-radius: 0 12px 12px 0; padding: 16px 20px; margin: 24px 0;">
        <p style="color: #d1d5db; font-size: 15px; font-style: italic; margin: 0 0 8px 0;">"${data.message}"</p>
        <p style="color: #9ca3af; font-size: 13px; margin: 0;">— ${data.inviterName}</p>
      </div>
    `
      : '';

    const content = `
      <!-- Icon -->
      <div style="text-align: center; margin-bottom: 24px;">
        <div style="display: inline-block; width: 80px; height: 80px; background: linear-gradient(135deg, rgba(139, 92, 246, 0.2) 0%, rgba(236, 72, 153, 0.2) 100%); border-radius: 20px; line-height: 80px;">
          <span style="font-size: 36px;">🤝</span>
        </div>
      </div>

      <!-- Title -->
      <h1 style="color: #ffffff; font-size: 28px; font-weight: 700; margin: 0 0 8px 0; text-align: center;">
        You're Invited!
      </h1>
      <p style="color: #9ca3af; font-size: 16px; text-align: center; margin: 0 0 32px 0;">
        Join the professional network that's changing careers
      </p>

      <!-- Message -->
      <p style="color: #d1d5db; font-size: 16px; line-height: 1.7; margin: 0 0 16px 0;">
        Hi <strong style="color: #ffffff;">${data.inviteeName}</strong>,
      </p>
      <p style="color: #9ca3af; font-size: 16px; line-height: 1.7; margin: 0 0 24px 0;">
        <strong style="color: #a78bfa;">${data.inviterName}</strong> has invited you to join IntellMatch, an AI-powered professional networking platform that helps you build meaningful connections.
      </p>

      ${messageSection}

      <!-- Benefits -->
      <p style="color: #ffffff; font-size: 16px; font-weight: 600; margin: 24px 0 16px 0;">What you'll get:</p>
      <ul style="color: #9ca3af; font-size: 15px; line-height: 1.8; padding-left: 20px; margin: 0 0 32px 0;">
        <li><strong style="color: #ffffff;">Connect</strong> with ${data.inviterName} and their professional network</li>
        <li><strong style="color: #ffffff;">Discover</strong> high-value connections based on your goals and skills</li>
        <li><strong style="color: #ffffff;">Collaborate</strong> on projects and opportunities</li>
        <li><strong style="color: #ffffff;">Grow</strong> your professional network with AI-powered matching</li>
      </ul>

      <!-- Button -->
      <div style="text-align: center; margin: 32px 0;">
        <a href="${data.inviteUrl}" class="btn" style="display: inline-block; background: linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%); color: #ffffff; text-decoration: none; padding: 16px 48px; border-radius: 12px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 20px rgba(139, 92, 246, 0.4);">
          ✓ Accept Invitation
        </a>
      </div>

      <!-- Divider -->
      <div style="height: 1px; background: linear-gradient(90deg, transparent, rgba(139, 92, 246, 0.3), transparent); margin: 32px 0;"></div>

      <!-- Note -->
      <div style="background: rgba(139, 92, 246, 0.1); border-radius: 12px; padding: 16px; margin-bottom: 24px;">
        <p style="color: #a78bfa; font-size: 14px; margin: 0;">
          💡 Your account will be automatically connected with ${data.inviterName} when you sign up using this invitation.
        </p>
      </div>

      <!-- Fallback Link -->
      <p style="color: #6b7280; font-size: 13px; margin: 0;">
        If the button doesn't work, copy and paste this link:
      </p>
      <p style="color: #a78bfa; font-size: 13px; word-break: break-all; margin: 8px 0 0 0;">
        <a href="${data.inviteUrl}" style="color: #a78bfa;">${data.inviteUrl}</a>
      </p>
    `;
    return this.getBaseTemplate(content, `${data.inviterName} invited you to join IntellMatch`);
  }

  /**
   * Collaboration invitation email template
   */
  private getCollaborationInvitationEmailTemplate(data: CollaborationInvitationEmailData): string {
    const sourceTypeLabel = this.getSourceTypeLabel(data.sourceType);
    const messageSection = data.customMessage
      ? `
      <div style="background: rgba(139, 92, 246, 0.1); border-left: 4px solid #8b5cf6; border-radius: 0 12px 12px 0; padding: 16px 20px; margin: 24px 0;">
        <p style="color: #d1d5db; font-size: 15px; font-style: italic; margin: 0 0 8px 0;">"${data.customMessage}"</p>
        <p style="color: #9ca3af; font-size: 13px; margin: 0;">— ${data.inviterName}</p>
      </div>
    `
      : '';

    const descriptionSection = data.sourceDescription
      ? `
      <p style="color: #9ca3af; font-size: 15px; line-height: 1.7; margin: 16px 0;">
        ${data.sourceDescription.substring(0, 300)}${data.sourceDescription.length > 300 ? '...' : ''}
      </p>
    `
      : '';

    const content = `
      <!-- Icon -->
      <div style="text-align: center; margin-bottom: 24px;">
        <div style="display: inline-block; width: 80px; height: 80px; background: linear-gradient(135deg, rgba(139, 92, 246, 0.2) 0%, rgba(236, 72, 153, 0.2) 100%); border-radius: 20px; line-height: 80px;">
          <span style="font-size: 36px;">🚀</span>
        </div>
      </div>

      <!-- Title -->
      <h1 style="color: #ffffff; font-size: 28px; font-weight: 700; margin: 0 0 8px 0; text-align: center;">
        You're a Great Fit!
      </h1>
      <p style="color: #9ca3af; font-size: 16px; text-align: center; margin: 0 0 32px 0;">
        Someone thinks you'd be perfect for their ${sourceTypeLabel}
      </p>

      <!-- Message -->
      <p style="color: #d1d5db; font-size: 16px; line-height: 1.7; margin: 0 0 16px 0;">
        Hi <strong style="color: #ffffff;">${data.recipientName}</strong>,
      </p>
      <p style="color: #9ca3af; font-size: 16px; line-height: 1.7; margin: 0 0 24px 0;">
        <strong style="color: #a78bfa;">${data.inviterName}</strong> has identified you as a potential collaborator for a ${sourceTypeLabel}
        ${data.ownerCompany ? `at <strong style="color: #ffffff;">${data.ownerCompany}</strong>` : ''}.
      </p>

      ${messageSection}

      <!-- Project Details -->
      <div style="background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 16px; padding: 24px; margin: 24px 0;">
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
          <span style="font-size: 24px;">📋</span>
          <h2 style="color: #ffffff; font-size: 20px; margin: 0;">${data.sourceTitle}</h2>
        </div>
        ${descriptionSection}
        <p style="color: #a78bfa; font-size: 14px; margin: 0;">
          <strong>Owner:</strong> ${data.ownerName}${data.ownerCompany ? ` (${data.ownerCompany})` : ''}
        </p>
      </div>

      <!-- What's next -->
      <p style="color: #ffffff; font-size: 16px; font-weight: 600; margin: 24px 0 16px 0;">What's next?</p>
      <ul style="color: #9ca3af; font-size: 15px; line-height: 1.8; padding-left: 20px; margin: 0 0 32px 0;">
        <li><strong style="color: #ffffff;">Review</strong> the ${sourceTypeLabel} details</li>
        <li><strong style="color: #ffffff;">Connect</strong> with ${data.ownerName} and the team</li>
        <li><strong style="color: #ffffff;">Collaborate</strong> and make an impact</li>
      </ul>

      <!-- Button -->
      <div style="text-align: center; margin: 32px 0;">
        <a href="${data.invitationUrl}" class="btn" style="display: inline-block; background: linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%); color: #ffffff; text-decoration: none; padding: 16px 48px; border-radius: 12px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 20px rgba(139, 92, 246, 0.4);">
          🚀 View & Respond
        </a>
      </div>

      <!-- Divider -->
      <div style="height: 1px; background: linear-gradient(90deg, transparent, rgba(139, 92, 246, 0.3), transparent); margin: 32px 0;"></div>

      <!-- Note -->
      <div style="background: rgba(139, 92, 246, 0.1); border-radius: 12px; padding: 16px; margin-bottom: 24px;">
        <p style="color: #a78bfa; font-size: 14px; margin: 0;">
          💡 This invitation was sent to you by ${data.inviterName} via IntellMatch. Click the button above to learn more and respond.
        </p>
      </div>

      <!-- Fallback Link -->
      <p style="color: #6b7280; font-size: 13px; margin: 0;">
        If the button doesn't work, copy and paste this link:
      </p>
      <p style="color: #a78bfa; font-size: 13px; word-break: break-all; margin: 8px 0 0 0;">
        <a href="${data.invitationUrl}" style="color: #a78bfa;">${data.invitationUrl}</a>
      </p>
    `;
    return this.getBaseTemplate(content, `${data.inviterName} thinks you're a great fit for ${data.sourceTitle}`);
  }

  /**
   * Event invitation email template
   */
  private getIntroductionConsentEmailTemplate(data: IntroductionConsentEmailData): string {
    const sourceTypeLabel = this.getSourceTypeLabel(data.sourceType);
    const messageSection = data.customMessage
      ? `
      <div style="background: rgba(139, 92, 246, 0.1); border-left: 4px solid #8b5cf6; border-radius: 0 12px 12px 0; padding: 16px 20px; margin: 24px 0;">
        <p style="color: #d1d5db; font-size: 15px; font-style: italic; margin: 0 0 8px 0;">"${data.customMessage}"</p>
        <p style="color: #9ca3af; font-size: 13px; margin: 0;">— ${data.collaboratorName}</p>
      </div>
    `
      : '';

    const descriptionSection = data.sourceDescription
      ? `
      <p style="color: #9ca3af; font-size: 15px; line-height: 1.7; margin: 16px 0;">
        ${data.sourceDescription.substring(0, 300)}${data.sourceDescription.length > 300 ? '...' : ''}
      </p>
    `
      : '';

    const content = `
      <!-- Icon -->
      <div style="text-align: center; margin-bottom: 24px;">
        <div style="display: inline-block; width: 80px; height: 80px; background: linear-gradient(135deg, rgba(139, 92, 246, 0.2) 0%, rgba(59, 130, 246, 0.2) 100%); border-radius: 20px; line-height: 80px;">
          <span style="font-size: 36px;">🤝</span>
        </div>
      </div>

      <!-- Title -->
      <h1 style="color: #ffffff; font-size: 28px; font-weight: 700; margin: 0 0 8px 0; text-align: center;">
        You've Been Recommended
      </h1>
      <p style="color: #9ca3af; font-size: 16px; text-align: center; margin: 0 0 32px 0;">
        Someone thinks you'd be a great collaborator
      </p>

      <!-- Message -->
      <p style="color: #d1d5db; font-size: 16px; line-height: 1.7; margin: 0 0 16px 0;">
        Hi <strong style="color: #ffffff;">${data.contactName}</strong>,
      </p>
      <p style="color: #9ca3af; font-size: 16px; line-height: 1.7; margin: 0 0 24px 0;">
        <strong style="color: #a78bfa;">${data.collaboratorName}</strong> would like to introduce you to
        <strong style="color: #ffffff;">${data.ownerName}</strong>${data.ownerCompany ? ` from <strong style="color: #ffffff;">${data.ownerCompany}</strong>` : ''}
        for a ${sourceTypeLabel} collaboration.
      </p>

      ${messageSection}

      <!-- Project Details -->
      <div style="background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 16px; padding: 24px; margin: 24px 0;">
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
          <span style="font-size: 24px;">📋</span>
          <h2 style="color: #ffffff; font-size: 20px; margin: 0;">${data.sourceTitle}</h2>
        </div>
        ${descriptionSection}
        <p style="color: #a78bfa; font-size: 14px; margin: 0;">
          <strong>By:</strong> ${data.ownerName}${data.ownerCompany ? ` (${data.ownerCompany})` : ''}
        </p>
      </div>

      <!-- What to do -->
      <p style="color: #ffffff; font-size: 16px; font-weight: 600; margin: 24px 0 16px 0;">What would you like to do?</p>
      <p style="color: #9ca3af; font-size: 15px; line-height: 1.8; margin: 0 0 32px 0;">
        Review the details and let us know if you're interested in this collaboration. You can accept or decline — no pressure!
      </p>

      <!-- Button -->
      <div style="text-align: center; margin: 32px 0;">
        <a href="${data.introductionUrl}" class="btn" style="display: inline-block; background: linear-gradient(135deg, #8b5cf6 0%, #3b82f6 100%); color: #ffffff; text-decoration: none; padding: 16px 48px; border-radius: 12px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 20px rgba(139, 92, 246, 0.4);">
          🤝 Review & Respond
        </a>
      </div>

      <!-- Divider -->
      <div style="height: 1px; background: linear-gradient(90deg, transparent, rgba(139, 92, 246, 0.3), transparent); margin: 32px 0;"></div>

      <!-- Note -->
      <div style="background: rgba(139, 92, 246, 0.1); border-radius: 12px; padding: 16px; margin-bottom: 24px;">
        <p style="color: #a78bfa; font-size: 14px; margin: 0;">
          This introduction was sent by ${data.collaboratorName} via IntellMatch. Click the button above to review and respond.
        </p>
      </div>

      <!-- Fallback Link -->
      <p style="color: #6b7280; font-size: 13px; margin: 0;">
        If the button doesn't work, copy and paste this link:
      </p>
      <p style="color: #a78bfa; font-size: 13px; word-break: break-all; margin: 8px 0 0 0;">
        <a href="${data.introductionUrl}" style="color: #a78bfa;">${data.introductionUrl}</a>
      </p>
    `;
    return this.getBaseTemplate(content, `${data.collaboratorName} would like to introduce you for ${data.sourceTitle}`);
  }

  private getEventInvitationEmailTemplate(data: EventInvitationEmailData): string {
    const messageSection = data.customMessage
      ? `
      <div style="background: rgba(139, 92, 246, 0.1); border-left: 4px solid #8b5cf6; border-radius: 0 12px 12px 0; padding: 16px 20px; margin: 24px 0;">
        <p style="color: #d1d5db; font-size: 15px; font-style: italic; margin: 0 0 8px 0;">"${data.customMessage}"</p>
        <p style="color: #9ca3af; font-size: 13px; margin: 0;">— ${data.hostName}</p>
      </div>
    `
      : '';

    const locationSection = data.eventLocation
      ? `<p style="color: #9ca3af; font-size: 14px; margin: 8px 0 0 0;">📍 ${data.eventLocation}</p>`
      : '';

    const descriptionSection = data.eventDescription
      ? `<p style="color: #9ca3af; font-size: 14px; margin: 16px 0 0 0;">${data.eventDescription}</p>`
      : '';

    const content = `
      <!-- Icon -->
      <div style="text-align: center; margin-bottom: 24px;">
        <div style="display: inline-block; width: 80px; height: 80px; background: linear-gradient(135deg, rgba(139, 92, 246, 0.2) 0%, rgba(236, 72, 153, 0.2) 100%); border-radius: 20px; line-height: 80px;">
          <span style="font-size: 36px;">🎉</span>
        </div>
      </div>

      <!-- Title -->
      <h1 style="color: #ffffff; font-size: 28px; font-weight: 700; margin: 0 0 8px 0; text-align: center;">
        You're Invited to an Event!
      </h1>
      <p style="color: #9ca3af; font-size: 16px; text-align: center; margin: 0 0 32px 0;">
        Join IntellMatch and connect with like-minded professionals
      </p>

      <!-- Message -->
      <p style="color: #d1d5db; font-size: 16px; line-height: 1.7; margin: 0 0 16px 0;">
        Hi <strong style="color: #ffffff;">${data.recipientName}</strong>,
      </p>
      <p style="color: #9ca3af; font-size: 16px; line-height: 1.7; margin: 0 0 24px 0;">
        <strong style="color: #a78bfa;">${data.hostName}</strong> attended an event with you and wants to stay connected! Join IntellMatch to keep building your professional network.
      </p>

      ${messageSection}

      <!-- Event Details -->
      <div style="background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 16px; padding: 24px; margin: 24px 0;">
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
          <span style="font-size: 24px;">📅</span>
          <h2 style="color: #ffffff; font-size: 20px; margin: 0;">${data.eventName}</h2>
        </div>
        <p style="color: #a78bfa; font-size: 14px; margin: 0;">
          <strong>Date:</strong> ${data.eventDate}
        </p>
        ${locationSection}
        ${descriptionSection}
      </div>

      <!-- Benefits -->
      <p style="color: #ffffff; font-size: 16px; font-weight: 600; margin: 24px 0 16px 0;">Why join IntellMatch?</p>
      <ul style="color: #9ca3af; font-size: 15px; line-height: 1.8; padding-left: 20px; margin: 0 0 32px 0;">
        <li><strong style="color: #ffffff;">Connect</strong> with attendees you met at ${data.eventName}</li>
        <li><strong style="color: #ffffff;">Discover</strong> high-value connections based on your goals</li>
        <li><strong style="color: #ffffff;">Network</strong> with AI-powered matching</li>
        <li><strong style="color: #ffffff;">Collaborate</strong> on projects and opportunities</li>
      </ul>

      <!-- Button -->
      <div style="text-align: center; margin: 32px 0;">
        <a href="${data.registerUrl}" class="btn" style="display: inline-block; background: linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%); color: #ffffff; text-decoration: none; padding: 16px 48px; border-radius: 12px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 20px rgba(139, 92, 246, 0.4);">
          ✓ Join IntellMatch
        </a>
      </div>

      <!-- Divider -->
      <div style="height: 1px; background: linear-gradient(90deg, transparent, rgba(139, 92, 246, 0.3), transparent); margin: 32px 0;"></div>

      <!-- Note -->
      <div style="background: rgba(139, 92, 246, 0.1); border-radius: 12px; padding: 16px; margin-bottom: 24px;">
        <p style="color: #a78bfa; font-size: 14px; margin: 0;">
          💡 This invitation was sent by ${data.hostName} who attended ${data.eventName} with you. Create your account to stay connected!
        </p>
      </div>

      <!-- Fallback Link -->
      <p style="color: #6b7280; font-size: 13px; margin: 0;">
        If the button doesn't work, copy and paste this link:
      </p>
      <p style="color: #a78bfa; font-size: 13px; word-break: break-all; margin: 8px 0 0 0;">
        <a href="${data.registerUrl}" style="color: #a78bfa;">${data.registerUrl}</a>
      </p>
    `;
    return this.getBaseTemplate(content, `${data.hostName} invites you to join IntellMatch`);
  }

  /**
   * Match notification email template
   */
  private getMatchNotificationTemplate(data: MatchNotificationData): string {
    const scoreColor = data.matchScore >= 80 ? '#10b981' : data.matchScore >= 60 ? '#f59e0b' : '#8b5cf6';
    const reasons = data.matchReasons.slice(0, 3).map(r => `<li style="margin-bottom: 8px;">${r}</li>`).join('');

    const content = `
      <!-- Icon -->
      <div style="text-align: center; margin-bottom: 24px;">
        <div style="display: inline-block; width: 80px; height: 80px; background: linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(139, 92, 246, 0.2) 100%); border-radius: 20px; line-height: 80px;">
          <span style="font-size: 36px;">🌟</span>
        </div>
      </div>

      <!-- Title -->
      <h1 style="color: #ffffff; font-size: 28px; font-weight: 700; margin: 0 0 8px 0; text-align: center;">
        New High-Score Match!
      </h1>
      <p style="color: #9ca3af; font-size: 16px; text-align: center; margin: 0 0 32px 0;">
        We found someone great for you
      </p>

      <!-- Message -->
      <p style="color: #d1d5db; font-size: 16px; line-height: 1.7; margin: 0 0 24px 0;">
        Hi <strong style="color: #ffffff;">${data.userName}</strong>, we found a potential connection that matches your professional goals:
      </p>

      <!-- Match Card -->
      <div style="background: linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(236, 72, 153, 0.15) 100%); border: 1px solid rgba(139, 92, 246, 0.3); border-radius: 16px; padding: 24px; margin: 24px 0; text-align: center;">
        <h2 style="color: #ffffff; margin: 0 0 8px 0; font-size: 24px; font-weight: 700;">${data.contactName}</h2>
        ${data.contactJobTitle ? `<p style="color: #d1d5db; margin: 0; font-size: 16px;">${data.contactJobTitle}</p>` : ''}
        ${data.contactCompany ? `<p style="color: #9ca3af; margin: 4px 0 20px 0; font-size: 15px;">${data.contactCompany}</p>` : '<div style="height: 20px;"></div>'}

        <div style="display: inline-block; background: ${scoreColor}; color: white; font-size: 36px; font-weight: 800; padding: 16px 32px; border-radius: 16px; box-shadow: 0 4px 20px ${scoreColor}40;">
          ${data.matchScore}%
        </div>
        <p style="color: #6b7280; font-size: 13px; margin-top: 12px; text-transform: uppercase; letter-spacing: 1px;">Match Score</p>
      </div>

      <!-- Reasons -->
      <p style="color: #ffffff; font-size: 16px; font-weight: 600; margin: 24px 0 16px 0;">Why you matched:</p>
      <ul style="color: #9ca3af; font-size: 15px; line-height: 1.8; padding-left: 20px; margin: 0 0 32px 0;">
        ${reasons}
      </ul>

      <!-- Button -->
      <div style="text-align: center; margin: 32px 0;">
        <a href="${data.viewMatchUrl}" class="btn" style="display: inline-block; background: linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%); color: #ffffff; text-decoration: none; padding: 16px 48px; border-radius: 12px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 20px rgba(139, 92, 246, 0.4);">
          👀 View Match Details
        </a>
      </div>

      <!-- Divider -->
      <div style="height: 1px; background: linear-gradient(90deg, transparent, rgba(139, 92, 246, 0.3), transparent); margin: 32px 0;"></div>

      <!-- Preferences -->
      <p style="color: #6b7280; font-size: 13px; text-align: center; margin: 0;">
        Don't want these notifications? <a href="${this.frontendUrl}/settings" style="color: #a78bfa;">Manage preferences</a>
      </p>
    `;
    return this.getBaseTemplate(content, `New ${data.matchScore}% match: ${data.contactName}`);
  }

  /**
   * Weekly digest email template
   */
  private getWeeklyDigestTemplate(data: WeeklyDigestData): string {
    const matchList = data.topMatches.slice(0, 5).map(match => `
      <div style="background: rgba(255, 255, 255, 0.05); border-radius: 12px; padding: 16px; margin-bottom: 12px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div>
            <strong style="color: #ffffff; font-size: 16px;">${match.name}</strong>
            ${match.company ? `<span style="color: #6b7280;"> at ${match.company}</span>` : ''}
          </div>
          <div style="background: linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%); color: white; padding: 6px 14px; border-radius: 8px; font-weight: 700; font-size: 14px;">
            ${match.score}%
          </div>
        </div>
        <p style="color: #9ca3af; font-size: 14px; margin: 8px 0 0 0;">${match.reason}</p>
      </div>
    `).join('');

    const content = `
      <!-- Icon -->
      <div style="text-align: center; margin-bottom: 24px;">
        <div style="display: inline-block; width: 80px; height: 80px; background: linear-gradient(135deg, rgba(139, 92, 246, 0.2) 0%, rgba(236, 72, 153, 0.2) 100%); border-radius: 20px; line-height: 80px;">
          <span style="font-size: 36px;">📊</span>
        </div>
      </div>

      <!-- Title -->
      <h1 style="color: #ffffff; font-size: 28px; font-weight: 700; margin: 0 0 8px 0; text-align: center;">
        Your Weekly Digest
      </h1>
      <p style="color: #9ca3af; font-size: 16px; text-align: center; margin: 0 0 32px 0;">
        Here's what happened this week
      </p>

      <!-- Message -->
      <p style="color: #d1d5db; font-size: 16px; line-height: 1.7; margin: 0 0 24px 0;">
        Hi <strong style="color: #ffffff;">${data.userName}</strong>, here's a summary of your top matches this week:
      </p>

      <!-- Match List -->
      <div style="margin: 24px 0;">
        ${matchList}
      </div>

      ${data.newConnectionsCount > 0 ? `
        <!-- Stats -->
        <div style="background: linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(139, 92, 246, 0.15) 100%); border-radius: 12px; padding: 20px; text-align: center; margin: 24px 0;">
          <span style="font-size: 32px; font-weight: 800; color: #10b981;">+${data.newConnectionsCount}</span>
          <p style="color: #9ca3af; font-size: 14px; margin: 8px 0 0 0;">new connections added this week!</p>
        </div>
      ` : ''}

      <!-- Button -->
      <div style="text-align: center; margin: 32px 0;">
        <a href="${data.viewAllUrl}" class="btn" style="display: inline-block; background: linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%); color: #ffffff; text-decoration: none; padding: 16px 48px; border-radius: 12px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 20px rgba(139, 92, 246, 0.4);">
          📈 View All Matches
        </a>
      </div>

      <!-- Divider -->
      <div style="height: 1px; background: linear-gradient(90deg, transparent, rgba(139, 92, 246, 0.3), transparent); margin: 32px 0;"></div>

      <!-- Preferences -->
      <p style="color: #6b7280; font-size: 13px; text-align: center; margin: 0;">
        Sent weekly. <a href="${this.frontendUrl}/settings" style="color: #a78bfa;">Manage preferences</a>
      </p>
    `;
    return this.getBaseTemplate(content, `Your weekly IntellMatch digest: ${data.topMatches.length} matches`);
  }

  /**
   * Daily recommendation email template
   */
  private getDailyRecommendationTemplate(data: DailyRecommendationData): string {
    const recList = data.recommendations.slice(0, 3).map(rec => `
      <div style="background: rgba(255, 255, 255, 0.05); border-radius: 12px; padding: 16px; margin-bottom: 12px;">
        <strong style="color: #ffffff; font-size: 16px;">${rec.name}</strong>
        ${rec.company ? `<span style="color: #6b7280;"> at ${rec.company}</span>` : ''}
        <p style="color: #9ca3af; font-size: 14px; margin: 8px 0;">${rec.reason}</p>
        <a href="${rec.viewUrl}" style="color: #a78bfa; font-size: 14px; text-decoration: none;">View profile →</a>
      </div>
    `).join('');

    const content = `
      <!-- Icon -->
      <div style="text-align: center; margin-bottom: 24px;">
        <div style="display: inline-block; width: 80px; height: 80px; background: linear-gradient(135deg, rgba(251, 191, 36, 0.2) 0%, rgba(139, 92, 246, 0.2) 100%); border-radius: 20px; line-height: 80px;">
          <span style="font-size: 36px;">💡</span>
        </div>
      </div>

      <!-- Title -->
      <h1 style="color: #ffffff; font-size: 28px; font-weight: 700; margin: 0 0 8px 0; text-align: center;">
        Today's Recommendations
      </h1>
      <p style="color: #9ca3af; font-size: 16px; text-align: center; margin: 0 0 32px 0;">
        Connections picked just for you
      </p>

      <!-- Message -->
      <p style="color: #d1d5db; font-size: 16px; line-height: 1.7; margin: 0 0 24px 0;">
        Hi <strong style="color: #ffffff;">${data.userName}</strong>, based on your network goals, here are today's top recommendations:
      </p>

      <!-- Recommendations -->
      <div style="margin: 24px 0;">
        ${recList}
      </div>

      <!-- Button -->
      <div style="text-align: center; margin: 32px 0;">
        <a href="${data.dashboardUrl}" class="btn" style="display: inline-block; background: linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%); color: #ffffff; text-decoration: none; padding: 16px 48px; border-radius: 12px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 20px rgba(139, 92, 246, 0.4);">
          🏠 View Dashboard
        </a>
      </div>

      <!-- Divider -->
      <div style="height: 1px; background: linear-gradient(90deg, transparent, rgba(139, 92, 246, 0.3), transparent); margin: 32px 0;"></div>

      <!-- Preferences -->
      <p style="color: #6b7280; font-size: 13px; text-align: center; margin: 0;">
        Sent daily. <a href="${this.frontendUrl}/settings" style="color: #a78bfa;">Manage preferences</a>
      </p>
    `;
    return this.getBaseTemplate(content, "Today's recommended connections on IntellMatch");
  }

  /**
   * Task email template
   */
  private getTaskEmailTemplate(data: TaskEmailData): string {
    const priorityColors: Record<string, { bg: string; text: string; label: string }> = {
      LOW: { bg: 'rgba(107, 114, 128, 0.2)', text: '#9ca3af', label: 'Low' },
      MEDIUM: { bg: 'rgba(59, 130, 246, 0.2)', text: '#60a5fa', label: 'Medium' },
      HIGH: { bg: 'rgba(251, 191, 36, 0.2)', text: '#fbbf24', label: 'High' },
      URGENT: { bg: 'rgba(239, 68, 68, 0.2)', text: '#f87171', label: 'Urgent' },
    };
    const priority = priorityColors[data.taskPriority] || priorityColors.MEDIUM;

    const content = `
      <!-- Icon -->
      <div style="text-align: center; margin-bottom: 24px;">
        <div style="display: inline-block; width: 80px; height: 80px; background: linear-gradient(135deg, rgba(59, 130, 246, 0.2) 0%, rgba(139, 92, 246, 0.2) 100%); border-radius: 20px; line-height: 80px;">
          <span style="font-size: 36px;">📋</span>
        </div>
      </div>

      <!-- Title -->
      <h1 style="color: #ffffff; font-size: 28px; font-weight: 700; margin: 0 0 8px 0; text-align: center;">
        New Task for You
      </h1>
      <p style="color: #9ca3af; font-size: 16px; text-align: center; margin: 0 0 32px 0;">
        From ${data.senderName}
      </p>

      <!-- Message -->
      <p style="color: #d1d5db; font-size: 16px; line-height: 1.7; margin: 0 0 24px 0;">
        Hi <strong style="color: #ffffff;">${data.contactName}</strong>, ${data.senderName} has shared a task with you:
      </p>

      <!-- Task Card -->
      <div style="background: linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%); border: 1px solid rgba(59, 130, 246, 0.2); border-radius: 16px; padding: 24px; margin: 24px 0;">
        <h2 style="color: #ffffff; margin: 0 0 16px 0; font-size: 20px; font-weight: 700;">${data.taskTitle}</h2>
        ${data.taskDescription ? `<p style="color: #9ca3af; margin: 0 0 20px 0; font-size: 15px; line-height: 1.6;">${data.taskDescription}</p>` : ''}

        <div style="display: flex; gap: 12px; flex-wrap: wrap;">
          ${data.taskDueDate ? `
            <div style="background: rgba(255, 255, 255, 0.1); border-radius: 10px; padding: 12px 16px;">
              <span style="color: #6b7280; font-size: 11px; text-transform: uppercase; letter-spacing: 1px;">Due Date</span><br>
              <span style="color: #ffffff; font-weight: 600; font-size: 15px;">${data.taskDueDate}</span>
            </div>
          ` : ''}
          <div style="background: ${priority.bg}; border-radius: 10px; padding: 12px 16px;">
            <span style="color: #6b7280; font-size: 11px; text-transform: uppercase; letter-spacing: 1px;">Priority</span><br>
            <span style="color: ${priority.text}; font-weight: 600; font-size: 15px;">${priority.label}</span>
          </div>
        </div>
      </div>

      <!-- Divider -->
      <div style="height: 1px; background: linear-gradient(90deg, transparent, rgba(139, 92, 246, 0.3), transparent); margin: 32px 0;"></div>

      <!-- Footer -->
      <p style="color: #6b7280; font-size: 13px; text-align: center; margin: 0;">
        This task was shared via <a href="${this.frontendUrl}" style="color: #a78bfa;">IntellMatch</a>
      </p>
    `;
    return this.getBaseTemplate(content, `Task from ${data.senderName}: ${data.taskTitle}`);
  }

  /**
   * Team inquiry email template
   */
  private getTeamInquiryEmailTemplate(data: TeamInquiryEmailData): string {
    const content = `
      <!-- Icon -->
      <div style="text-align: center; margin-bottom: 24px;">
        <div style="display: inline-block; width: 80px; height: 80px; background: linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(139, 92, 246, 0.2) 100%); border-radius: 20px; line-height: 80px;">
          <span style="font-size: 36px;">🏢</span>
        </div>
      </div>

      <!-- Title -->
      <h1 style="color: #ffffff; font-size: 28px; font-weight: 700; margin: 0 0 8px 0; text-align: center;">
        New Team Plan Inquiry
      </h1>
      <p style="color: #9ca3af; font-size: 16px; text-align: center; margin: 0 0 32px 0;">
        A company is interested in the Team plan
      </p>

      <!-- Inquiry Details Card -->
      <div style="background: linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(236, 72, 153, 0.15) 100%); border: 1px solid rgba(139, 92, 246, 0.3); border-radius: 16px; padding: 24px; margin: 24px 0;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
          <tr>
            <td style="padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.1);">
              <span style="color: #9ca3af; font-size: 13px; text-transform: uppercase; letter-spacing: 1px;">Company</span><br>
              <span style="color: #ffffff; font-size: 18px; font-weight: 600;">${data.companyName}</span>
            </td>
          </tr>
          <tr>
            <td style="padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.1);">
              <span style="color: #9ca3af; font-size: 13px; text-transform: uppercase; letter-spacing: 1px;">Contact Name</span><br>
              <span style="color: #ffffff; font-size: 16px;">${data.contactName}</span>
            </td>
          </tr>
          <tr>
            <td style="padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.1);">
              <span style="color: #9ca3af; font-size: 13px; text-transform: uppercase; letter-spacing: 1px;">Email</span><br>
              <a href="mailto:${data.email}" style="color: #a78bfa; font-size: 16px; text-decoration: none;">${data.email}</a>
            </td>
          </tr>
          ${data.phone ? `
          <tr>
            <td style="padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.1);">
              <span style="color: #9ca3af; font-size: 13px; text-transform: uppercase; letter-spacing: 1px;">Phone</span><br>
              <a href="tel:${data.phone}" style="color: #a78bfa; font-size: 16px; text-decoration: none;">${data.phone}</a>
            </td>
          </tr>
          ` : ''}
          <tr>
            <td style="padding: 12px 0; ${data.message ? 'border-bottom: 1px solid rgba(255,255,255,0.1);' : ''}">
              <span style="color: #9ca3af; font-size: 13px; text-transform: uppercase; letter-spacing: 1px;">Team Size</span><br>
              <span style="color: #ffffff; font-size: 16px;">${data.teamSize} members</span>
            </td>
          </tr>
          ${data.message ? `
          <tr>
            <td style="padding: 12px 0;">
              <span style="color: #9ca3af; font-size: 13px; text-transform: uppercase; letter-spacing: 1px;">Message</span><br>
              <p style="color: #d1d5db; font-size: 15px; line-height: 1.6; margin: 8px 0 0 0;">${data.message}</p>
            </td>
          </tr>
          ` : ''}
        </table>
      </div>

      <!-- Action Buttons -->
      <div style="text-align: center; margin: 32px 0;">
        <a href="mailto:${data.email}?subject=IntellMatch Team Plan - Follow Up&body=Hi ${data.contactName},%0D%0A%0D%0AThank you for your interest in IntellMatch Team Plan.%0D%0A%0D%0A" style="display: inline-block; background: linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%); color: #ffffff; text-decoration: none; padding: 16px 48px; border-radius: 12px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 20px rgba(139, 92, 246, 0.4);">
          ✉️ Reply to ${data.contactName}
        </a>
      </div>

      <!-- Divider -->
      <div style="height: 1px; background: linear-gradient(90deg, transparent, rgba(139, 92, 246, 0.3), transparent); margin: 32px 0;"></div>

      <!-- Footer Note -->
      <p style="color: #6b7280; font-size: 13px; text-align: center; margin: 0;">
        This inquiry was submitted via the IntellMatch landing page.
      </p>
    `;
    return this.getBaseTemplate(content, `Team Plan Inquiry from ${data.companyName}`);
  }

  /**
   * Payment confirmation email template
   */
  private getPaymentConfirmationTemplate(data: PaymentConfirmationEmailData): string {
    const seatsText = data.seats && data.seats > 1 ? ` (${data.seats} seats)` : '';
    const content = `
      <!-- Icon -->
      <div style="text-align: center; margin-bottom: 24px;">
        <div style="display: inline-block; width: 80px; height: 80px; background: linear-gradient(135deg, rgba(16, 185, 129, 0.3) 0%, rgba(139, 92, 246, 0.3) 100%); border-radius: 20px; line-height: 80px;">
          <span style="font-size: 36px;">✅</span>
        </div>
      </div>

      <!-- Title -->
      <h1 style="color: #ffffff; font-size: 28px; font-weight: 700; margin: 0 0 8px 0; text-align: center;">
        Payment Confirmed!
      </h1>
      <p style="color: #9ca3af; font-size: 16px; text-align: center; margin: 0 0 32px 0;">
        Your ${data.plan} plan is now active
      </p>

      <!-- Message -->
      <p style="color: #d1d5db; font-size: 16px; line-height: 1.7; margin: 0 0 24px 0; text-align: center;">
        Hi <strong style="color: #ffffff;">${data.customerName}</strong>,
      </p>
      <p style="color: #9ca3af; font-size: 16px; line-height: 1.7; margin: 0 0 32px 0; text-align: center;">
        Thank you for your purchase! Your subscription has been activated and you now have access to all ${data.plan} features.
      </p>

      <!-- Payment Details Card -->
      <div style="background: linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(139, 92, 246, 0.15) 100%); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 16px; padding: 24px; margin: 24px 0;">
        <h3 style="color: #10b981; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 16px 0;">Payment Details</h3>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
          <tr>
            <td style="padding: 8px 0; color: #9ca3af; font-size: 14px;">Plan</td>
            <td style="padding: 8px 0; color: #ffffff; font-size: 14px; text-align: right; font-weight: 600;">${data.plan}${seatsText}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #9ca3af; font-size: 14px;">Billing</td>
            <td style="padding: 8px 0; color: #ffffff; font-size: 14px; text-align: right;">${data.billingInterval}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #9ca3af; font-size: 14px;">Amount</td>
            <td style="padding: 8px 0; color: #10b981; font-size: 18px; text-align: right; font-weight: 700;">$${data.amount.toFixed(2)} ${data.currency}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #9ca3af; font-size: 14px;">Transaction ID</td>
            <td style="padding: 8px 0; color: #ffffff; font-size: 14px; text-align: right; font-family: monospace;">${data.transactionRef}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #9ca3af; font-size: 14px;">Payment Date</td>
            <td style="padding: 8px 0; color: #ffffff; font-size: 14px; text-align: right;">${data.paymentDate}</td>
          </tr>
        </table>
      </div>

      <!-- Subscription Period -->
      <div style="background: rgba(139, 92, 246, 0.1); border: 1px solid rgba(139, 92, 246, 0.2); border-radius: 12px; padding: 16px; margin: 24px 0; text-align: center;">
        <p style="color: #a78bfa; font-size: 14px; margin: 0;">
          📅 Subscription Period: <strong>${data.periodStart}</strong> to <strong>${data.periodEnd}</strong>
        </p>
      </div>

      <!-- Button -->
      <div style="text-align: center; margin: 32px 0;">
        <a href="${data.dashboardUrl}" style="display: inline-block; background: linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%); color: #ffffff; text-decoration: none; padding: 16px 48px; border-radius: 12px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 20px rgba(139, 92, 246, 0.4);">
          🚀 Go to Dashboard
        </a>
      </div>

      <!-- Divider -->
      <div style="height: 1px; background: linear-gradient(90deg, transparent, rgba(139, 92, 246, 0.3), transparent); margin: 32px 0;"></div>

      <!-- Footer Note -->
      <p style="color: #6b7280; font-size: 13px; text-align: center; margin: 0;">
        You will receive a separate invoice email with full details for your records.
      </p>
    `;
    return this.getBaseTemplate(content, `Payment confirmed for ${data.plan} plan - IntellMatch`);
  }

  /**
   * Invoice email template
   */
  private getInvoiceEmailTemplate(data: InvoiceEmailData): string {
    const seatsText = data.seats && data.seats > 1 ? ` × ${data.seats} seats` : '';
    const unitPrice = data.seats && data.seats > 1 ? (data.amount / data.seats).toFixed(2) : data.amount.toFixed(2);

    const content = `
      <!-- Icon -->
      <div style="text-align: center; margin-bottom: 24px;">
        <div style="display: inline-block; width: 80px; height: 80px; background: linear-gradient(135deg, rgba(139, 92, 246, 0.3) 0%, rgba(236, 72, 153, 0.3) 100%); border-radius: 20px; line-height: 80px;">
          <span style="font-size: 36px;">🧾</span>
        </div>
      </div>

      <!-- Title -->
      <h1 style="color: #ffffff; font-size: 28px; font-weight: 700; margin: 0 0 8px 0; text-align: center;">
        Invoice
      </h1>
      <p style="color: #9ca3af; font-size: 16px; text-align: center; margin: 0 0 32px 0;">
        #${data.invoiceNumber}
      </p>

      <!-- Invoice Header -->
      <div style="display: flex; justify-content: space-between; margin-bottom: 32px;">
        <div>
          <p style="color: #9ca3af; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 4px 0;">Billed To</p>
          <p style="color: #ffffff; font-size: 16px; font-weight: 600; margin: 0;">${data.customerName}</p>
          <p style="color: #9ca3af; font-size: 14px; margin: 4px 0 0 0;">${data.customerEmail}</p>
          ${data.companyName ? `<p style="color: #9ca3af; font-size: 14px; margin: 4px 0 0 0;">${data.companyName}</p>` : ''}
        </div>
        <div style="text-align: right;">
          <p style="color: #9ca3af; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 4px 0;">Invoice Date</p>
          <p style="color: #ffffff; font-size: 16px; margin: 0;">${data.invoiceDate}</p>
        </div>
      </div>

      <!-- Invoice Items -->
      <div style="background: rgba(255, 255, 255, 0.05); border-radius: 12px; overflow: hidden; margin: 24px 0;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
          <thead>
            <tr style="background: rgba(139, 92, 246, 0.2);">
              <th style="padding: 16px; text-align: left; color: #ffffff; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Description</th>
              <th style="padding: 16px; text-align: right; color: #ffffff; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="padding: 16px; border-bottom: 1px solid rgba(255,255,255,0.1);">
                <p style="color: #ffffff; font-size: 16px; font-weight: 600; margin: 0;">${data.plan} Plan${seatsText}</p>
                <p style="color: #9ca3af; font-size: 14px; margin: 4px 0 0 0;">${data.billingInterval} subscription</p>
                <p style="color: #6b7280; font-size: 13px; margin: 4px 0 0 0;">Period: ${data.periodStart} - ${data.periodEnd}</p>
              </td>
              <td style="padding: 16px; border-bottom: 1px solid rgba(255,255,255,0.1); text-align: right;">
                <p style="color: #ffffff; font-size: 16px; margin: 0;">$${unitPrice}${data.seats && data.seats > 1 ? '/seat' : ''}</p>
              </td>
            </tr>
          </tbody>
          <tfoot>
            <tr style="background: rgba(16, 185, 129, 0.1);">
              <td style="padding: 16px; color: #ffffff; font-size: 16px; font-weight: 600;">Total</td>
              <td style="padding: 16px; text-align: right; color: #10b981; font-size: 24px; font-weight: 700;">$${data.amount.toFixed(2)} ${data.currency}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <!-- Transaction Reference -->
      <div style="background: rgba(139, 92, 246, 0.1); border-radius: 12px; padding: 16px; margin: 24px 0;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
          <tr>
            <td style="color: #9ca3af; font-size: 14px;">Transaction Reference</td>
            <td style="color: #ffffff; font-size: 14px; text-align: right; font-family: monospace;">${data.transactionRef}</td>
          </tr>
        </table>
      </div>

      <!-- Print Button -->
      <div style="text-align: center; margin: 32px 0;">
        <a href="${this.frontendUrl}/settings/billing" style="display: inline-block; background: linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%); color: #ffffff; text-decoration: none; padding: 16px 48px; border-radius: 12px; font-weight: 600; font-size: 16px;">
          📄 View & Print Invoice
        </a>
      </div>

      <!-- Divider -->
      <div style="height: 1px; background: linear-gradient(90deg, transparent, rgba(139, 92, 246, 0.3), transparent); margin: 32px 0;"></div>

      <!-- Company Info -->
      <div style="text-align: center;">
        <p style="color: #ffffff; font-size: 14px; font-weight: 600; margin: 0;">IntellMatch</p>
        <p style="color: #6b7280; font-size: 13px; margin: 4px 0 0 0;">AI-Powered Professional Networking</p>
        <p style="color: #6b7280; font-size: 13px; margin: 4px 0 0 0;">support@intellmatch.com</p>
      </div>
    `;
    return this.getBaseTemplate(content, `Invoice #${data.invoiceNumber} - IntellMatch`);
  }

  /**
   * Payment notification to admin template
   */
  private getPaymentNotificationToAdminTemplate(data: PaymentNotificationToAdminData): string {
    const seatsText = data.seats && data.seats > 1 ? ` (${data.seats} seats)` : '';
    const content = `
      <!-- Icon -->
      <div style="text-align: center; margin-bottom: 24px;">
        <div style="display: inline-block; width: 80px; height: 80px; background: linear-gradient(135deg, rgba(16, 185, 129, 0.3) 0%, rgba(251, 191, 36, 0.3) 100%); border-radius: 20px; line-height: 80px;">
          <span style="font-size: 36px;">💰</span>
        </div>
      </div>

      <!-- Title -->
      <h1 style="color: #ffffff; font-size: 28px; font-weight: 700; margin: 0 0 8px 0; text-align: center;">
        New Payment Received!
      </h1>
      <p style="color: #10b981; font-size: 24px; text-align: center; margin: 0 0 32px 0; font-weight: 700;">
        +$${data.amount.toFixed(2)} ${data.currency}
      </p>

      <!-- Payment Details Card -->
      <div style="background: linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(139, 92, 246, 0.15) 100%); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 16px; padding: 24px; margin: 24px 0;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
          <tr>
            <td style="padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.1);">
              <span style="color: #9ca3af; font-size: 13px; text-transform: uppercase; letter-spacing: 1px;">Customer</span><br>
              <span style="color: #ffffff; font-size: 16px; font-weight: 600;">${data.customerName}</span>
            </td>
          </tr>
          <tr>
            <td style="padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.1);">
              <span style="color: #9ca3af; font-size: 13px; text-transform: uppercase; letter-spacing: 1px;">Email</span><br>
              <a href="mailto:${data.customerEmail}" style="color: #a78bfa; font-size: 16px; text-decoration: none;">${data.customerEmail}</a>
            </td>
          </tr>
          <tr>
            <td style="padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.1);">
              <span style="color: #9ca3af; font-size: 13px; text-transform: uppercase; letter-spacing: 1px;">Plan</span><br>
              <span style="color: #ffffff; font-size: 16px;">${data.plan}${seatsText} - ${data.billingInterval}</span>
            </td>
          </tr>
          <tr>
            <td style="padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.1);">
              <span style="color: #9ca3af; font-size: 13px; text-transform: uppercase; letter-spacing: 1px;">Transaction ID</span><br>
              <span style="color: #ffffff; font-size: 14px; font-family: monospace;">${data.transactionRef}</span>
            </td>
          </tr>
          <tr>
            <td style="padding: 12px 0;">
              <span style="color: #9ca3af; font-size: 13px; text-transform: uppercase; letter-spacing: 1px;">Payment Date</span><br>
              <span style="color: #ffffff; font-size: 16px;">${data.paymentDate}</span>
            </td>
          </tr>
        </table>
      </div>

      <!-- Divider -->
      <div style="height: 1px; background: linear-gradient(90deg, transparent, rgba(139, 92, 246, 0.3), transparent); margin: 32px 0;"></div>

      <!-- Footer Note -->
      <p style="color: #6b7280; font-size: 13px; text-align: center; margin: 0;">
        This is an automated notification from IntellMatch payment system.
      </p>
    `;
    return this.getBaseTemplate(content, `New payment: $${data.amount} from ${data.customerName}`);
  }

  /**
   * Organization invitation email template
   */
  private getOrganizationInvitationEmailTemplate(data: OrganizationInvitationEmailData): string {
    const roleName = data.role.charAt(0) + data.role.slice(1).toLowerCase();

    const content = `
      <!-- Icon -->
      <div style="text-align: center; margin-bottom: 24px;">
        <div style="display: inline-block; width: 80px; height: 80px; background: linear-gradient(135deg, rgba(139, 92, 246, 0.2) 0%, rgba(236, 72, 153, 0.2) 100%); border-radius: 20px; line-height: 80px;">
          <span style="font-size: 36px;">🏢</span>
        </div>
      </div>

      <!-- Title -->
      <h1 style="color: #ffffff; font-size: 28px; font-weight: 700; margin: 0 0 8px 0; text-align: center;">
        You've Been Invited!
      </h1>
      <p style="color: #9ca3af; font-size: 16px; text-align: center; margin: 0 0 32px 0;">
        Join your team on IntellMatch
      </p>

      <!-- Message -->
      <p style="color: #d1d5db; font-size: 16px; line-height: 1.7; margin: 0 0 16px 0;">
        Hi there,
      </p>
      <p style="color: #9ca3af; font-size: 16px; line-height: 1.7; margin: 0 0 24px 0;">
        <strong style="color: #a78bfa;">${data.inviterName}</strong> has invited you to join
        <strong style="color: #ffffff;">${data.organizationName}</strong> as a
        <strong style="color: #a78bfa;">${roleName}</strong> on IntellMatch.
      </p>

      <!-- Org Info Card -->
      <div style="background: rgba(139, 92, 246, 0.1); border: 1px solid rgba(139, 92, 246, 0.2); border-radius: 16px; padding: 20px; margin: 24px 0; text-align: center;">
        <p style="color: #ffffff; font-size: 18px; font-weight: 600; margin: 0 0 4px 0;">${data.organizationName}</p>
        <p style="color: #a78bfa; font-size: 14px; margin: 0;">Role: ${roleName}</p>
      </div>

      <!-- Benefits -->
      <p style="color: #ffffff; font-size: 16px; font-weight: 600; margin: 24px 0 16px 0;">As a team member you can:</p>
      <ul style="color: #9ca3af; font-size: 15px; line-height: 1.8; padding-left: 20px; margin: 0 0 32px 0;">
        <li><strong style="color: #ffffff;">Share</strong> contacts and connections with your team</li>
        <li><strong style="color: #ffffff;">Collaborate</strong> on deals and opportunities together</li>
        <li><strong style="color: #ffffff;">Request</strong> warm introductions through your network</li>
        <li><strong style="color: #ffffff;">Track</strong> your team's networking activity</li>
      </ul>

      <!-- Button -->
      <div style="text-align: center; margin: 32px 0;">
        <a href="${data.inviteUrl}" style="display: inline-block; background: linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%); color: #ffffff; text-decoration: none; padding: 16px 48px; border-radius: 12px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 20px rgba(139, 92, 246, 0.4);">
          Accept Invitation
        </a>
      </div>

      <!-- Divider -->
      <div style="height: 1px; background: linear-gradient(90deg, transparent, rgba(139, 92, 246, 0.3), transparent); margin: 32px 0;"></div>

      <!-- Note -->
      <div style="background: rgba(139, 92, 246, 0.1); border-radius: 12px; padding: 16px; margin-bottom: 24px;">
        <p style="color: #a78bfa; font-size: 14px; margin: 0;">
          This invitation expires in 7 days. If you don't have an IntellMatch account yet, you'll be able to create one when you accept.
        </p>
      </div>

      <!-- Fallback Link -->
      <p style="color: #6b7280; font-size: 13px; margin: 0;">
        If the button doesn't work, copy and paste this link:
      </p>
      <p style="color: #a78bfa; font-size: 13px; word-break: break-all; margin: 8px 0 0 0;">
        <a href="${data.inviteUrl}" style="color: #a78bfa;">${data.inviteUrl}</a>
      </p>
    `;
    return this.getBaseTemplate(content, `${data.inviterName} invited you to join ${data.organizationName}`);
  }
}

// Export singleton instance
export const emailService = new EmailService();
