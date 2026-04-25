/**
 * Authentication Routes
 *
 * Routes for user authentication and session management.
 *
 * @module presentation/routes/auth
 */

import { Router } from "express";
import { authController } from "../controllers/AuthController";
import { authenticate } from "../middleware/auth.middleware";
import { validate } from "../middleware/validate.middleware";
import { authRateLimiter } from "../middleware/rateLimiter";
import {
  registerSchema,
  loginSchema,
  refreshTokenSchema,
  logoutSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from "../validators/auth.validator";
import { logger } from "../../shared/logger";

export const authRoutes = Router();

/**
 * POST /api/v1/auth/register
 * Create a new user account
 */
authRoutes.post(
  "/register",
  authRateLimiter,
  validate(registerSchema),
  authController.register.bind(authController),
);

/**
 * POST /api/v1/auth/login
 * Authenticate user and return tokens
 */
authRoutes.post(
  "/login",
  authRateLimiter,
  validate(loginSchema),
  authController.login.bind(authController),
);

/**
 * POST /api/v1/auth/refresh
 * Refresh access token using refresh token
 */
authRoutes.post(
  "/refresh",
  authRateLimiter,
  validate(refreshTokenSchema),
  authController.refresh.bind(authController),
);

/**
 * POST /api/v1/auth/logout
 * Invalidate current session (revoke refresh token)
 */
authRoutes.post(
  "/logout",
  validate(logoutSchema),
  authController.logout.bind(authController),
);

/**
 * POST /api/v1/auth/logout-all
 * Logout from all devices (revoke all refresh tokens)
 */
authRoutes.post(
  "/logout-all",
  authenticate,
  authController.logoutAll.bind(authController),
);

/**
 * GET /api/v1/auth/me
 * Get current authenticated user
 */
authRoutes.get("/me", authenticate, authController.me.bind(authController));

/**
 * POST /api/v1/auth/forgot-password
 * Request password reset email
 */
authRoutes.post(
  "/forgot-password",
  authRateLimiter,
  validate(forgotPasswordSchema),
  authController.forgotPassword.bind(authController),
);

/**
 * POST /api/v1/auth/reset-password
 * Reset password using token
 */
authRoutes.post(
  "/reset-password",
  authRateLimiter,
  validate(resetPasswordSchema),
  authController.resetPassword.bind(authController),
);

/**
 * GET /api/v1/auth/verify-email/:token
 * Verify email address
 */
authRoutes.get("/verify-email/:token", async (req, res, next) => {
  try {
    const { token } = req.params;

    const result = await authController.verifyEmail(token);
    console.log("result", result);

    if (result.success) {
      // Redirect to frontend success page
      // const frontendUrl = "http://10.200.56.22:3000/";
      const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
      res.redirect(`${frontendUrl}/email-verified?success=true`);
    } else {
      const frontendUrl = "http://10.200.56.22:3000/";
      // const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
      res.redirect(
        `${frontendUrl}/email-verified?success=false&error=${result.error}`,
      );
    }
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/auth/resend-verification
 * Resend verification email
 */
authRoutes.post(
  "/resend-verification",
  authRateLimiter,
  async (req, res, next) => {
    try {
      const { email } = req.body;

      if (!email) {
        res.status(400).json({
          success: false,
          error: { code: "MISSING_EMAIL", message: "Email is required" },
        });
        return;
      }

      await authController.resendVerificationEmail(email);

      // Always return success to prevent email enumeration
      res.status(200).json({
        success: true,
        message:
          "If an account exists with this email, a verification link will be sent",
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * POST /api/v1/auth/linkedin
 * Initiate LinkedIn OAuth authentication
 */
authRoutes.post("/linkedin", authRateLimiter, async (req, res, next) => {
  try {
    const { code, redirectUri } = req.body;

    if (!code) {
      res.status(400).json({
        success: false,
        error: {
          code: "MISSING_CODE",
          message: "Authorization code is required",
        },
      });
      return;
    }

    const clientId = process.env.LINKEDIN_CLIENT_ID;
    const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      logger.error("LinkedIn OAuth not configured");
      res.status(500).json({
        success: false,
        error: {
          code: "NOT_CONFIGURED",
          message: "LinkedIn OAuth not configured",
        },
      });
      return;
    }

    // Exchange code for access token
    const tokenResponse = await fetch(
      "https://www.linkedin.com/oauth/v2/accessToken",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          redirect_uri:
            redirectUri ||
            `${process.env.FRONTEND_URL}/api/auth/linkedin/callback`,
          client_id: clientId,
          client_secret: clientSecret,
        }),
      },
    );

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      logger.error("LinkedIn token exchange failed", errorData);
      res.status(401).json({
        success: false,
        error: {
          code: "TOKEN_EXCHANGE_FAILED",
          message: "Failed to exchange authorization code",
        },
      });
      return;
    }

    const tokenData = (await tokenResponse.json()) as { access_token: string };
    const accessToken = tokenData.access_token;

    // Get user profile from LinkedIn
    const profileResponse = await fetch(
      "https://api.linkedin.com/v2/userinfo",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    if (!profileResponse.ok) {
      logger.error("LinkedIn profile fetch failed");
      res.status(401).json({
        success: false,
        error: {
          code: "PROFILE_FETCH_FAILED",
          message: "Failed to fetch LinkedIn profile",
        },
      });
      return;
    }

    interface LinkedInProfile {
      sub: string;
      email: string;
      name: string;
      given_name: string;
      family_name: string;
      picture: string;
      email_verified: boolean;
    }
    const profileData = (await profileResponse.json()) as LinkedInProfile;

    // Return LinkedIn profile data for frontend to use
    res.status(200).json({
      success: true,
      data: {
        linkedinId: profileData.sub,
        email: profileData.email,
        name: profileData.name,
        firstName: profileData.given_name,
        lastName: profileData.family_name,
        picture: profileData.picture,
        emailVerified: profileData.email_verified,
      },
    });
  } catch (error) {
    logger.error("LinkedIn OAuth error", error);
    next(error);
  }
});

/**
 * POST /api/v1/auth/linkedin/register
 * Register or login user with LinkedIn profile
 */
authRoutes.post(
  "/linkedin/register",
  authRateLimiter,
  async (req, res, next) => {
    try {
      const { linkedinId, email, name, picture } = req.body;

      if (!email || !name) {
        res.status(400).json({
          success: false,
          error: {
            code: "MISSING_FIELDS",
            message: "Email and name are required",
          },
        });
        return;
      }

      // Use the auth controller to handle registration/login
      // This will either create a new user or login existing user
      const result = await authController.linkedInAuth({
        linkedinId,
        email,
        name,
        avatarUrl: picture,
        userAgent: req.headers["user-agent"],
        ipAddress: req.ip,
      });

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  },
);

export default authRoutes;
