/**
 * Invitation Routes
 *
 * API endpoints for contact invitations and pre-account management.
 *
 * @module presentation/routes/invitation
 */

import { Router, Request, Response, NextFunction } from "express";
import { authenticate } from "../middleware/auth.middleware";
import { inviteContactService } from "../../application/use-cases/invitation";
import { logger } from "../../shared/logger";

export const invitationRoutes = Router();

/**
 * POST /api/v1/invitations/send
 *
 * Send an invitation to a contact.
 *
 * Body:
 * - contactId: string (required) - ID of the contact to invite
 * - method: 'email' | 'sms' (required) - Invitation method
 * - message?: string - Optional personalized message
 *
 * Response:
 * - success: boolean
 * - preAccountId: string - ID of the created pre-account
 * - invitationSent: boolean - Whether the invitation was sent
 */
invitationRoutes.post(
  "/send",
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: { code: "UNAUTHORIZED", message: "Authentication required" },
        });
        return;
      }

      const { contactId, method, message } = req.body;

      if (!contactId) {
        res.status(400).json({
          success: false,
          error: {
            code: "MISSING_CONTACT_ID",
            message: "contactId is required",
          },
        });
        return;
      }

      if (!method || !["email", "sms"].includes(method)) {
        res.status(400).json({
          success: false,
          error: {
            code: "INVALID_METHOD",
            message: 'method must be "email" or "sms"',
          },
        });
        return;
      }

      const result = await inviteContactService.inviteContact(
        { contactId, method, message },
        req.user.userId,
      );

      if (!result.success) {
        res.status(400).json({
          success: false,
          error: { code: "INVITATION_FAILED", message: result.error },
        });
        return;
      }

      res.json({
        success: true,
        data: {
          preAccountId: result.preAccountId,
          invitationSent: result.invitationSent,
          method: result.method,
        },
      });
    } catch (error) {
      logger.error("Send invitation failed", { error });
      next(error);
    }
  },
);

/**
 * GET /api/v1/invitations/verify/:token
 *
 * Verify an invitation token (public endpoint for signup page).
 *
 * Response:
 * - valid: boolean
 * - preAccount: Pre-filled account data if valid
 */
invitationRoutes.get(
  "/verify/:token",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { token } = req.params as { token: string };

      const result = await inviteContactService.verifyInvitationToken(token);

      if (!result.valid) {
        res.status(404).json({
          success: false,
          error: {
            code: "INVALID_TOKEN",
            message: "Invalid or expired invitation",
          },
        });
        return;
      }

      res.json({
        success: true,
        data: result.preAccount,
      });
    } catch (error) {
      logger.error("Verify invitation token failed", { error });
      next(error);
    }
  },
);

/**
 * POST /api/v1/invitations/accept
 *
 * Accept an invitation and activate the account (public endpoint).
 *
 * Body:
 * - token: string (required) - Invitation token
 * - password: string (required) - New password for the account
 *
 * Response:
 * - success: boolean
 * - userId: string - ID of the activated user
 */
invitationRoutes.post(
  "/accept",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { token, password } = req.body;

      if (!token) {
        res.status(400).json({
          success: false,
          error: { code: "MISSING_TOKEN", message: "token is required" },
        });
        return;
      }

      if (!password || password.length < 8) {
        res.status(400).json({
          success: false,
          error: {
            code: "INVALID_PASSWORD",
            message: "Password must be at least 8 characters",
          },
        });
        return;
      }

      const result = await inviteContactService.acceptInvitation({
        token,
        password,
      });

      if (!result.success) {
        res.status(400).json({
          success: false,
          error: { code: "ACCEPT_FAILED", message: result.error },
        });
        return;
      }

      res.json({
        success: true,
        data: {
          userId: result.userId,
          connectedWithId: result.connectedWithId,
        },
      });
    } catch (error) {
      logger.error("Accept invitation failed", { error });
      next(error);
    }
  },
);

/**
 * GET /api/v1/invitations/pending
 *
 * Get pending invitations sent by the current user.
 */
invitationRoutes.get(
  "/pending",
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: { code: "UNAUTHORIZED", message: "Authentication required" },
        });
        return;
      }

      const invitations = await inviteContactService.getPendingInvitations(
        req.user.userId,
      );

      res.json({
        success: true,
        data: invitations,
      });
    } catch (error) {
      logger.error("Get pending invitations failed", { error });
      next(error);
    }
  },
);

/**
 * DELETE /api/v1/invitations/:id
 *
 * Cancel a pending invitation.
 */
invitationRoutes.delete(
  "/:id",
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: { code: "UNAUTHORIZED", message: "Authentication required" },
        });
        return;
      }

      const { id } = req.params;

      const success = await inviteContactService.cancelInvitation(
        String(id),
        req.user.userId,
      );

      if (!success) {
        res.status(400).json({
          success: false,
          error: {
            code: "CANCEL_FAILED",
            message: "Unable to cancel invitation",
          },
        });
        return;
      }

      res.json({
        success: true,
        message: "Invitation cancelled",
      });
    } catch (error) {
      logger.error("Cancel invitation failed", { error });
      next(error);
    }
  },
);

export default invitationRoutes;
