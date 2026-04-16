/**
 * SDAIA Data Subject Rights Controller
 *
 * Handles HTTP requests for SDAIA PDPL compliance endpoints:
 * - Right to Access (GET subject data)
 * - Right to Deletion (DELETE subject data)
 * - List processing records
 *
 * @module presentation/controllers/SdaiaController
 */

import { Request, Response, NextFunction } from "express";
import {
  AuthenticationError,
  NotFoundError,
} from "../../shared/errors/index.js";
import { getSdaiaComplianceService } from "../../infrastructure/services/SdaiaComplianceService.js";
import { logger } from "../../shared/logger/index.js";

class SdaiaController {
  /**
   * GET /subjects/:contactId/data
   * Right to Access - Get all processed data for a contact
   */
  async getSubjectData(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) throw new AuthenticationError("Not authenticated");

      const { contactId } = req.params as { contactId: string };
      const service = getSdaiaComplianceService();
      const data = await service.getSubjectData(contactId, userId);

      if (!data) {
        throw new NotFoundError("Contact not found");
      }

      res.json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /subjects/:contactId
   * Right to Deletion - Delete all enrichment data for a contact
   */
  async deleteSubjectData(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) throw new AuthenticationError("Not authenticated");

      const { contactId } = req.params;
      const service = getSdaiaComplianceService();

      // Verify contact exists
      const data = await service.getSubjectData(String(contactId), userId);
      if (!data) {
        throw new NotFoundError("Contact not found");
      }

      await service.deleteSubjectData(String(contactId), userId);

      logger.info("SDAIA subject data deletion requested", {
        contactId,
        userId,
      });

      res.json({
        success: true,
        message: "Subject data deleted successfully",
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /subjects/processing-records
   * List all processing records for the current user
   */
  async listProcessingRecords(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) throw new AuthenticationError("Not authenticated");

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      const service = getSdaiaComplianceService();
      const { records, total } = await service.listProcessingRecords(userId, {
        page,
        limit,
      });

      res.json({
        success: true,
        data: {
          records,
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      next(error);
    }
  }
}

export const sdaiaController = new SdaiaController();
export default sdaiaController;
