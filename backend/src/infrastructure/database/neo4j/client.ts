/**
 * Neo4j Database Client
 *
 * Neo4j graph database client for relationship queries and network visualization.
 *
 * @module infrastructure/database/neo4j/client
 */

import neo4j, { Driver, Session, Result } from 'neo4j-driver';
import { config } from '../../../config/index.js';
import { logger } from '../../../shared/logger/index.js';

/**
 * Neo4j client instance
 */
let driver: Driver | null = null;
let neo4jAvailable = false;
let neo4jChecked = false;

/**
 * Get or create Neo4j driver instance
 *
 * @returns Neo4j driver singleton or null if not available
 */
export const getNeo4jDriver = (): Driver | null => {
  if (neo4jChecked && !neo4jAvailable) {
    return null;
  }

  if (!driver) {
    try {
      driver = neo4j.driver(
        config.neo4j.uri,
        neo4j.auth.basic(config.neo4j.user, config.neo4j.password),
        {
          maxConnectionLifetime: 3 * 60 * 60 * 1000, // 3 hours
          maxConnectionPoolSize: 50,
          connectionAcquisitionTimeout: 2 * 60 * 1000, // 2 minutes
          disableLosslessIntegers: true,
        }
      );
    } catch (error) {
      logger.warn('Failed to create Neo4j driver:', error);
      neo4jChecked = true;
      neo4jAvailable = false;
      return null;
    }
  }

  return driver;
};

/**
 * Initialize Neo4j connection
 *
 * Tests the Neo4j connection and logs the result.
 * Neo4j is optional - the app will continue without it.
 */
export const initializeNeo4j = async (): Promise<void> => {
  try {
    const neo4jDriver = getNeo4jDriver();
    if (!neo4jDriver) {
      logger.info('Neo4j not configured - continuing without graph database');
      neo4jChecked = true;
      return;
    }

    // Verify connectivity
    await neo4jDriver.verifyConnectivity();
    neo4jAvailable = true;
    neo4jChecked = true;

    // Get server info
    const serverInfo = await neo4jDriver.getServerInfo();
    logger.info('Neo4j connection verified', {
      address: serverInfo.address,
      version: serverInfo.protocolVersion,
    });

    // Initialize schema constraints
    await initializeSchema();
  } catch (error) {
    neo4jChecked = true;
    neo4jAvailable = false;
    logger.info('Neo4j not available - continuing without graph database');
  }
};

/**
 * Initialize Neo4j schema with constraints and indexes
 */
async function initializeSchema(): Promise<void> {
  const session = getSession();
  if (!session) return;

  try {
    // Create constraints for unique identifiers
    const constraints = [
      'CREATE CONSTRAINT user_id IF NOT EXISTS FOR (u:User) REQUIRE u.id IS UNIQUE',
      'CREATE CONSTRAINT contact_id IF NOT EXISTS FOR (c:Contact) REQUIRE c.id IS UNIQUE',
      'CREATE CONSTRAINT sector_id IF NOT EXISTS FOR (s:Sector) REQUIRE s.id IS UNIQUE',
      'CREATE CONSTRAINT skill_id IF NOT EXISTS FOR (sk:Skill) REQUIRE sk.id IS UNIQUE',
    ];

    for (const constraint of constraints) {
      try {
        await session.run(constraint);
      } catch (e: any) {
        // Ignore if constraint already exists
        if (!e.message?.includes('already exists')) {
          logger.warn('Failed to create constraint:', e.message);
        }
      }
    }

    // Create indexes for faster lookups
    const indexes = [
      'CREATE INDEX user_email IF NOT EXISTS FOR (u:User) ON (u.email)',
      'CREATE INDEX contact_owner IF NOT EXISTS FOR (c:Contact) ON (c.ownerId)',
      'CREATE INDEX sector_name IF NOT EXISTS FOR (s:Sector) ON (s.name)',
    ];

    for (const index of indexes) {
      try {
        await session.run(index);
      } catch (e: any) {
        if (!e.message?.includes('already exists')) {
          logger.warn('Failed to create index:', e.message);
        }
      }
    }

    logger.info('Neo4j schema initialized');
  } finally {
    await session.close();
  }
}

/**
 * Get a new Neo4j session
 *
 * @returns Neo4j session or null if not available
 */
export const getSession = (): Session | null => {
  if (!neo4jAvailable) return null;
  const neo4jDriver = getNeo4jDriver();
  if (!neo4jDriver) return null;
  return neo4jDriver.session();
};

/**
 * Check if Neo4j is available
 */
export const isNeo4jAvailable = (): boolean => {
  return neo4jAvailable;
};

/**
 * Disconnect from Neo4j
 *
 * Should be called during graceful shutdown.
 */
export const disconnectNeo4j = async (): Promise<void> => {
  if (driver) {
    await driver.close();
    driver = null;
    neo4jAvailable = false;
    logger.info('Neo4j disconnected');
  }
};

/**
 * Execute a Cypher query
 *
 * @param cypher - Cypher query string
 * @param params - Query parameters
 * @returns Query result or null if Neo4j is not available
 */
export const runQuery = async (
  cypher: string,
  params: Record<string, unknown> = {}
): Promise<Result | null> => {
  const session = getSession();
  if (!session) return null;

  try {
    return await session.run(cypher, params);
  } finally {
    await session.close();
  }
};

/**
 * Execute a Cypher query and return records as plain objects
 *
 * @param cypher - Cypher query string
 * @param params - Query parameters
 * @returns Array of record objects
 */
export const queryRecords = async <T = Record<string, unknown>>(
  cypher: string,
  params: Record<string, unknown> = {}
): Promise<T[]> => {
  const result = await runQuery(cypher, params);
  if (!result) return [];

  return result.records.map((record) => {
    const obj: Record<string, unknown> = {};
    record.keys.forEach((key) => {
      const value = record.get(key);
      const keyStr = String(key);
      // Convert Neo4j integers to JS numbers
      obj[keyStr] = typeof value?.toNumber === 'function' ? value.toNumber() : value;
    });
    return obj as T;
  });
};

export { driver };
export default getNeo4jDriver;
