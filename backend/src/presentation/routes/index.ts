/**
 * API Routes
 *
 * Main router that combines all API routes.
 *
 * @module presentation/routes
 */

import { Router } from 'express';
import express from 'express';
import { prisma } from '../../infrastructure/database/prisma/client.js';
import { authRoutes } from './auth.routes.js';
import { profileRoutes } from './profile.routes.js';
import { contactRoutes } from './contact.routes.js';
import { scanRoutes } from './scan.routes.js';
import { matchRoutes } from './match.routes.js';
import { graphRoutes } from './graph.routes.js';
import { lookupRoutes } from './lookup.routes.js';
import { dashboardRoutes } from './dashboard.routes.js';
import { projectRoutes } from './project.routes.js';
import { opportunityRoutes } from './opportunity.routes.js';
import { taskRoutes, taskPublicRoutes, reminderRoutes } from './task.routes.js';
import { notificationRoutes } from './notification.routes.js';
import { calendarRoutes } from './calendar.routes.js';
import { findContactRoutes } from './find-contact.routes.js';
import { invitationRoutes } from './invitation.routes.js';
import pitchRoutes from './pitch.routes.js';
import pitchMatchRoutes from './pitchMatch.routes.js';
import dealRoutes from './deal.routes.js';
import dealResultRoutes from './dealResult.routes.js';
import { productProfileRoutes, productMatchRoutes } from './productMatch.routes.js';
import collaborationRoutes from './collaboration.routes.js';
import collaborationSessionRoutes from './collaborationSession.routes.js';
import introductionRoutes from './introduction.routes.js';
import collaborationSettingsRoutes from './collaborationSettings.routes.js';
import collaborationLedgerRoutes from './collaborationLedger.routes.js';
import collaborationInvitationRoutes from './collaboration-invitation.routes.js';
import teamMemberRoutes from './team-member.routes.js';
import importRoutes from './import.routes.js';
import { userRoutes } from './user.routes.js';
import storageRoutes from './storage.routes.js';
import { paymentRoutes } from './payment.routes.js';
import { contactInquiryRoutes } from './contact-inquiry.routes.js';
import { eventRoutes } from './event.routes.js';
import { itemizedMatchRoutes } from './itemizedMatch.routes.js';
import messageRoutes from './message.routes.js';
import sdaiaRoutes from './sdaia.routes.js';
import { organizationRoutes } from './organization.routes.js';
import { suggestionsRoutes } from './suggestions.routes.js';
import { walletRoutes } from './wallet.routes.js';
import { adminRoutes } from './admin.routes.js';
import { superAdminRoutes } from './superadmin.routes.js';
import { bugReportRoutes } from './bug-report.routes.js';
import { affiliateRoutes } from './affiliate.routes.js';
import { videoRoutes } from './video.routes.js';
import { systemConfigService } from '../../infrastructure/services/SystemConfigService.js';
import opportunityMatchingRoutes from '../../infrastructure/external/opportunities/routes/opportunity-matching.routes';
import { jobMatchingRoutes } from './job-matching.routes.js';

/**
 * Main API router
 */
export const routes = Router();

/**
 * API Information endpoint
 */
routes.get('/', (req, res) => {
  res.json({
    success: true,
    data: {
      name: 'P2P Relationship Intelligence API',
      version: '1.0.0',
      documentation: '/api/v1/docs',
      endpoints: {
        auth: '/api/v1/auth',
        profile: '/api/v1/profile',
        contacts: '/api/v1/contacts',
        scan: '/api/v1/scan',
        matches: '/api/v1/matches',
        graph: '/api/v1/graph',
        dashboard: '/api/v1/dashboard',
        projects: '/api/v1/projects',
        opportunities: '/api/v1/opportunities',
        tasks: '/api/v1/tasks',
        reminders: '/api/v1/reminders',
        calendar: '/api/v1/calendar',
        findContact: '/api/v1/find-contact',
        invitations: '/api/v1/invitations',
        pitches: '/api/v1/pitches',
        pitchMatches: '/api/v1/pitch-matches',
        deals: '/api/v1/deals',
        dealResults: '/api/v1/deal-results',
        productProfile: '/api/v1/product-profile',
        productMatch: '/api/v1/product-match',
        collaborationRequests: '/api/v1/collaboration-requests',
        collaborationSessions: '/api/v1/collaboration-sessions',
        introductions: '/api/v1/introductions',
        collaborationSettings: '/api/v1/collaboration-settings',
        collaborationLedger: '/api/v1/collaboration-ledger',
        events: '/api/v1/events',
        messages: '/api/v1/messages',
        notifications: '/api/v1/notifications',
        organizations: '/api/v1/organizations',
        subjects: '/api/v1/subjects',
        users: '/api/v1/users',
        wallet: '/api/v1/wallet',
        admin: '/api/v1/admin',
        superadmin: '/api/v1/superadmin',
        affiliate: '/api/v1/affiliate',
        videos: '/api/v1/videos',
        jobMatching: '/api/v1/job-matching',
        payments: '/api/v1/payments',
        sectors: '/api/v1/sectors',
        skills: '/api/v1/skills',
        interests: '/api/v1/interests',
        hobbies: '/api/v1/hobbies',
      },
    },
  });
});

/**
 * GET /plans — Public endpoint for landing page pricing
 * Returns active plan configs (no auth required)
 */
routes.get('/plans', async (req, res) => {
  try {
    const plans = await prisma.planConfig.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        name: true,
        displayName: true,
        displayNameAr: true,
        description: true,
        descriptionAr: true,
        monthlyPrice: true,
        yearlyPrice: true,
        pointsAllocation: true,
        contactLimit: true,
        features: true,
        featuresAr: true,
        isFree: true,
        hasFreeTrial: true,
        freeTrialDays: true,
        paymentRequired: true,
        isUpgradable: true,
        sortOrder: true,
        ctaText: true,
        ctaTextAr: true,
        badgeText: true,
        badgeTextAr: true,
        badgeColor: true,
        borderColor: true,
        isHighlighted: true,
        animation: true,
      },
    });
    res.json({ success: true, data: plans });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch plans' });
  }
});

/**
 * GET /point-packs — Public endpoint for wallet page
 * Returns active point packs (no auth required)
 */
routes.get('/point-packs', async (req, res) => {
  try {
    const packs = await prisma.pointPack.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        name: true,
        nameAr: true,
        points: true,
        price: true,
        currency: true,
      },
    });
    res.json({ success: true, data: packs });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch point packs' });
  }
});

/**
 * GET /app-config — Public endpoint for feature flags (no auth required)
 */
routes.get('/app-config', async (req, res) => {
  try {
    const [qaReportingEnabled, affiliateEnabled, collaborationRequestCost, collaborationPlatformPercentage] = await Promise.all([
      systemConfigService.get('qa_reporting_enabled'),
      systemConfigService.get('affiliate_enabled'),
      systemConfigService.getNumber('collaboration_request_cost', 0),
      systemConfigService.getNumber('collaboration_platform_percentage', 20),
    ]);
    res.json({
      success: true,
      data: {
        qaReportingEnabled: qaReportingEnabled === 'true',
        affiliateEnabled: affiliateEnabled !== 'false',
        collaborationRequestCost,
        collaborationPlatformPercentage,
      },
    });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch app config' });
  }
});

/**
 * Mount route modules
 */
routes.use('/auth', authRoutes);
routes.use('/profile', profileRoutes);
routes.use('/contacts', contactRoutes);
routes.use('/contacts/import', importRoutes);
routes.use('/scan', express.json({ limit: '15mb' }), scanRoutes); // Scan sends base64 images in JSON
routes.use('/matches', matchRoutes);
routes.use('/matches/itemized', itemizedMatchRoutes); // Itemized explainable matching
routes.use('/recommendations', matchRoutes); // Alias
routes.use('/graph', graphRoutes);
routes.use('/dashboard', dashboardRoutes);
routes.use('/projects', projectRoutes);
routes.use('/opportunities', opportunityRoutes);
routes.use('/opportunities/v2', opportunityMatchingRoutes); // v2 matching with hard filters, AI validation
routes.use('/tasks', taskRoutes);
routes.use('/tasks', taskPublicRoutes);
routes.use('/reminders', reminderRoutes);
routes.use('/notifications', notificationRoutes);
routes.use('/calendar', calendarRoutes);
routes.use('/find-contact', findContactRoutes);
routes.use('/invitations', invitationRoutes);
routes.use('/pitches', pitchRoutes);
routes.use('/pitch-matches', pitchMatchRoutes);
routes.use('/deals', dealRoutes);
routes.use('/deal-results', dealResultRoutes);
routes.use('/product-profile', productProfileRoutes);
routes.use('/product-match', productMatchRoutes);
routes.use('/collaboration-requests', collaborationRoutes);
routes.use('/collaboration-sessions', collaborationSessionRoutes);
routes.use('/introductions', introductionRoutes);
routes.use('/collaboration-settings', collaborationSettingsRoutes);
routes.use('/collaboration-ledger', collaborationLedgerRoutes);
routes.use('/events', eventRoutes);
routes.use('/messages', messageRoutes);
routes.use('/organizations', organizationRoutes);
routes.use('/suggestions', suggestionsRoutes);
routes.use('/wallet', walletRoutes);
routes.use('/admin', adminRoutes);
routes.use('/superadmin', superAdminRoutes);
routes.use('/subjects', sdaiaRoutes);
routes.use('/storage', storageRoutes); // Storage routes - NO AUTH required, must be before catch-all routers
routes.use('/affiliate', affiliateRoutes); // Affiliate routes - has public endpoints, must be before catch-all routers
routes.use('/sectors', lookupRoutes);
routes.use('/skills', lookupRoutes);
routes.use('/interests', lookupRoutes);
routes.use('/hobbies', lookupRoutes);
routes.use('/videos', videoRoutes); // Public video gallery — must be before catch-all '/' routers
routes.use('/', collaborationInvitationRoutes); // V2: Collaboration invitations (WhatsApp/Email)
routes.use('/', teamMemberRoutes); // V2: Team member management
routes.use('/users', userRoutes);
routes.use('/payments', paymentRoutes);
routes.use('/contact', contactInquiryRoutes);
routes.use('/bug-reports', bugReportRoutes);
routes.use('/job-matching', jobMatchingRoutes); // V3 Job Matching Engine

export default routes;
