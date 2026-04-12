/**
 * Graph Routes
 *
 * Routes for relationship graph and network visualization.
 *
 * @module presentation/routes/graph
 */

import { Router } from 'express';
import { graphController } from '../controllers/GraphController';
import { authenticate } from '../middleware/auth.middleware';
import { attachSubscriptionContext, requirePlan } from '../middleware/featureGate.middleware';

export const graphRoutes = Router();

// All graph routes require authentication
graphRoutes.use(authenticate);

/**
 * GET /api/v1/graph/network
 * Get user's relationship network data
 *
 * Returns nodes and edges for D3/vis.js graph visualization.
 *
 * Query params:
 * - depth: graph depth (default 1)
 * - sector: filter by sector ID
 * - limit: max contacts (default 100)
 *
 * Response:
 * - nodes: array of graph nodes (user, contacts, sectors)
 * - edges: array of connections between nodes
 * - stats: summary statistics
 */
graphRoutes.get('/network', graphController.getNetwork.bind(graphController));

/**
 * GET /api/v1/graph/clusters
 * Get contact clusters by sector/company
 *
 * Groups contacts into clusters for visualization.
 *
 * Query params:
 * - groupBy: 'sector' | 'company' | 'location' (default 'sector')
 *
 * Response:
 * - clusters: array of cluster objects with contacts
 */
graphRoutes.get('/clusters', graphController.getClusters.bind(graphController));

/**
 * GET /api/v1/graph/path/:targetId
 * Find warm introduction paths to target
 *
 * Uses graph traversal to find connection paths.
 * Requires Neo4j for full functionality.
 */
graphRoutes.get('/path/:targetId', graphController.findPath.bind(graphController));

/**
 * GET /api/v1/graph/underutilized
 * Get underutilized connections
 *
 * Returns high-value contacts that haven't been engaged recently.
 *
 * Query params:
 * - days: days since last interaction (default 30)
 * - minScore: minimum match score (default 50)
 * - limit: max results (default 20)
 */
graphRoutes.get('/underutilized', graphController.getUnderutilized.bind(graphController));

/**
 * GET /api/v1/graph/stats
 * Get network statistics
 *
 * Returns summary statistics about the user's network:
 * - Total contacts
 * - Contacts added this month
 * - Total interactions
 * - Average match score
 * - Top sectors
 * - Source breakdown
 */
graphRoutes.get('/stats', graphController.getStats.bind(graphController));

/**
 * GET /api/v1/graph/suggestions
 * Get suggested connections
 *
 * Returns potential connections based on mutual contacts and shared sectors.
 * Requires Neo4j for best results.
 *
 * Query params:
 * - limit: max suggestions (default 10)
 */
graphRoutes.get('/suggestions', graphController.getSuggestions.bind(graphController));

/**
 * POST /api/v1/graph/sync/:contactId
 * Sync contact to Neo4j
 *
 * Manually triggers syncing a contact to the Neo4j graph database.
 */
graphRoutes.post('/sync/:contactId', graphController.syncContact.bind(graphController));

/**
 * Team Graph Routes (require TEAM plan)
 */

/**
 * GET /api/v1/graph/team/network
 * Get combined team network graph
 */
graphRoutes.get('/team/network', attachSubscriptionContext, requirePlan('TEAM'), graphController.getTeamNetwork.bind(graphController));

/**
 * GET /api/v1/graph/team/stats
 * Get team network statistics
 */
graphRoutes.get('/team/stats', attachSubscriptionContext, requirePlan('TEAM'), graphController.getTeamStats.bind(graphController));

/**
 * GET /api/v1/graph/team/overlap
 * Get mutual contact overlap between team members
 */
graphRoutes.get('/team/overlap', attachSubscriptionContext, requirePlan('TEAM'), graphController.getTeamOverlap.bind(graphController));

export default graphRoutes;
