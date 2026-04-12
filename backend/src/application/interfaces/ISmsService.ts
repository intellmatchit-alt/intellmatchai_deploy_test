/**
 * Interface: SMS Service
 *
 * Defines the contract for sending SMS messages.
 * Used for collaboration invitations and notifications.
 *
 * @module application/interfaces/ISmsService
 */

export interface SmsSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface ISmsService {
  /**
   * Check if the SMS service is properly configured and available
   */
  isAvailable(): boolean;

  /**
   * Send a raw SMS message
   * @param to Phone number in E.164 format (e.g., +1234567890)
   * @param body SMS message text
   */
  sendSms(to: string, body: string): Promise<SmsSendResult>;

  /**
   * Send a collaboration invitation SMS
   * @param to Phone number in E.164 format
   * @param inviterName Name of the person sending the invitation
   * @param projectTitle Title of the project/opportunity
   * @param inviteLink URL for the invitation
   */
  sendInvitation(
    to: string,
    inviterName: string,
    projectTitle: string,
    inviteLink: string
  ): Promise<SmsSendResult>;
}
