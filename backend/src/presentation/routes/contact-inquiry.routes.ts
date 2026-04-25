/**
 * Contact Inquiry Routes
 *
 * Public endpoints for contact form submissions (no authentication required).
 *
 * @module presentation/routes/contact-inquiry
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { emailService } from '../../infrastructure/services/EmailService';
import { logger } from '../../shared/logger/index';

const router = Router();

/**
 * Team inquiry validation schema
 */
const teamInquirySchema = z.object({
  companyName: z.string().min(1, 'Company name is required').max(200),
  contactName: z.string().min(1, 'Contact name is required').max(200),
  email: z.string().email('Invalid email address'),
  phone: z.string().max(50).optional(),
  teamSize: z.string().min(1, 'Team size is required'),
  message: z.string().max(2000).optional(),
});

/**
 * POST /api/v1/contact/team-inquiry
 * Submit a team plan inquiry (public endpoint)
 */
router.post('/team-inquiry', async (req: Request, res: Response) => {
  try {
    // Validate request body
    const validationResult = teamInquirySchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: validationResult.error.errors,
      });
    }

    const validatedData = validationResult.data;

    // Construct the data object with required fields
    const data = {
      companyName: validatedData.companyName,
      contactName: validatedData.contactName,
      email: validatedData.email,
      phone: validatedData.phone,
      teamSize: validatedData.teamSize,
      message: validatedData.message,
    };

    logger.info('Team inquiry received', {
      service: 'p2p-api',
      component: 'ContactInquiryRoutes',
      companyName: data.companyName,
      email: data.email,
      teamSize: data.teamSize,
    });

    // Send email to sales team
    const emailSent = await emailService.sendTeamInquiryEmail(data);

    if (emailSent) {
      logger.info('Team inquiry email sent successfully', {
        service: 'p2p-api',
        component: 'ContactInquiryRoutes',
        companyName: data.companyName,
      });

      return res.status(200).json({
        success: true,
        message: 'Your inquiry has been submitted. We will contact you soon.',
      });
    } else {
      logger.error('Failed to send team inquiry email', {
        service: 'p2p-api',
        component: 'ContactInquiryRoutes',
        companyName: data.companyName,
      });

      return res.status(500).json({
        success: false,
        error: 'Failed to send inquiry. Please try again later.',
      });
    }
  } catch (error) {
    logger.error('Error processing team inquiry', {
      service: 'p2p-api',
      component: 'ContactInquiryRoutes',
      error,
    });

    return res.status(500).json({
      success: false,
      error: 'An unexpected error occurred. Please try again later.',
    });
  }
});

export const contactInquiryRoutes = router;
export default router;
