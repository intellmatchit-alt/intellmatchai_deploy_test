/**
 * Neo4j Module Exports
 *
 * @module infrastructure/database/neo4j
 */

export {
  getNeo4jDriver,
  getSession,
  initializeNeo4j,
  disconnectNeo4j,
  isNeo4jAvailable,
  runQuery,
  queryRecords,
} from './client.js';

export {
  Neo4jGraphService,
  neo4jGraphService,
  type NodeType,
  type RelationshipType,
  type GraphNodeData,
  type GraphRelationshipData,
  type PathResult,
  type ConnectionSuggestion,
} from './GraphService.js';
