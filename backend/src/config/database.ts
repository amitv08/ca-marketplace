import { PrismaClient } from '@prisma/client';
import { isDevelopment } from './env';

/**
 * Database Configuration with Connection Pooling
 *
 * Connection Pool Settings:
 * - connection_limit: Maximum number of database connections
 * - pool_timeout: Maximum time to wait for a connection (seconds)
 * - connect_timeout: Maximum time to wait for initial connection (seconds)
 *
 * Recommended pool sizes:
 * - Development: 5-10 connections
 * - Production (single instance): 10-20 connections
 * - Production (multiple instances): (total connections / instances)
 *
 * Formula: connection_limit = (core_count * 2) + effective_spindle_count
 * For cloud databases: connection_limit = ~10-20 per instance
 */

// Connection pool configuration
const DATABASE_POOL_SIZE = parseInt(process.env.DATABASE_POOL_SIZE || '10', 10);
const POOL_TIMEOUT = parseInt(process.env.DATABASE_POOL_TIMEOUT || '20', 10);
const CONNECT_TIMEOUT = parseInt(process.env.DATABASE_CONNECT_TIMEOUT || '10', 10);

/**
 * Build optimized database URL with connection pooling parameters
 */
function buildDatabaseUrl(): string | undefined {
  const baseUrl = process.env.DATABASE_URL;
  if (!baseUrl) return undefined;

  try {
    // Parse existing URL
    const url = new URL(baseUrl);

    // Add connection pool parameters
    const params = new URLSearchParams(url.search);

    // Connection pool size
    if (!params.has('connection_limit')) {
      params.set('connection_limit', DATABASE_POOL_SIZE.toString());
    }

    // Pool timeout (seconds to wait for available connection)
    if (!params.has('pool_timeout')) {
      params.set('pool_timeout', POOL_TIMEOUT.toString());
    }

    // Connection timeout (seconds to wait for initial connection)
    if (!params.has('connect_timeout')) {
      params.set('connect_timeout', CONNECT_TIMEOUT.toString());
    }

    // Statement timeout (milliseconds - prevents long-running queries)
    if (!params.has('statement_timeout')) {
      params.set('statement_timeout', '30000'); // 30 seconds
    }

    // Idle timeout (seconds - close idle connections)
    if (!params.has('idle_in_transaction_session_timeout')) {
      params.set('idle_in_transaction_session_timeout', '60'); // 60 seconds
    }

    url.search = params.toString();
    return url.toString();
  } catch (error) {
    console.warn('Failed to parse DATABASE_URL, using as-is:', error);
    return baseUrl;
  }
}

// Prisma Client singleton with optimized configuration
const prismaClientSingleton = () => {
  const databaseUrl = buildDatabaseUrl();

  return new PrismaClient({
    datasources: databaseUrl ? {
      db: {
        url: databaseUrl,
      },
    } : undefined,
    log: isDevelopment
      ? [
          { emit: 'event', level: 'query' },
          { emit: 'stdout', level: 'error' },
          { emit: 'stdout', level: 'warn' },
        ]
      : [
          { emit: 'stdout', level: 'error' },
        ],
    errorFormat: isDevelopment ? 'pretty' : 'minimal',
  });
};

declare global {
  // eslint-disable-next-line no-var
  var prisma: ReturnType<typeof prismaClientSingleton> | undefined;
}

export const prisma = globalThis.prisma ?? prismaClientSingleton();

// Query logging in development
if (isDevelopment) {
  globalThis.prisma = prisma;

  prisma.$on('query' as never, (e: any) => {
    console.log('Query: ' + e.query);
    console.log('Duration: ' + e.duration + 'ms');
  });
}

/**
 * Database connection helper
 */
export const connectDatabase = async (): Promise<void> => {
  try {
    await prisma.$connect();
    console.log('✅ Database connected successfully');
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    throw error;
  }
};

/**
 * Database disconnection helper
 */
export const disconnectDatabase = async (): Promise<void> => {
  try {
    await prisma.$disconnect();
    console.log('🔌 Database disconnected');
  } catch (error) {
    console.error('❌ Database disconnection failed:', error);
    throw error;
  }
};

/**
 * Database health check
 */
export async function checkDatabaseHealth(): Promise<{
  healthy: boolean;
  latency?: number;
  error?: string;
}> {
  const start = Date.now();

  try {
    // Simple query to check connection
    await prisma.$queryRaw`SELECT 1`;

    const latency = Date.now() - start;

    return {
      healthy: true,
      latency,
    };
  } catch (error: any) {
    return {
      healthy: false,
      error: error.message,
    };
  }
}

/**
 * Get current database connection pool stats
 */
export async function getPoolStats(): Promise<{
  activeConnections: number;
  idleConnections: number;
  totalConnections: number;
  maxConnections: number;
}> {
  try {
    // Query PostgreSQL connection stats
    const result = await prisma.$queryRaw<any[]>`
      SELECT
        (SELECT count(*) FROM pg_stat_activity WHERE state = 'active') as active,
        (SELECT count(*) FROM pg_stat_activity WHERE state = 'idle') as idle,
        (SELECT count(*) FROM pg_stat_activity) as total,
        (SELECT setting::int FROM pg_settings WHERE name = 'max_connections') as max
    `;

    const stats = result[0];

    return {
      activeConnections: parseInt(stats.active),
      idleConnections: parseInt(stats.idle),
      totalConnections: parseInt(stats.total),
      maxConnections: parseInt(stats.max),
    };
  } catch (error) {
    console.error('Error fetching pool stats:', error);
    return {
      activeConnections: 0,
      idleConnections: 0,
      totalConnections: 0,
      maxConnections: DATABASE_POOL_SIZE,
    };
  }
}

/**
 * Monitor slow queries
 */
export async function getSlowQueries(minDuration: number = 1000): Promise<any[]> {
  try {
    // Get slow queries from pg_stat_statements
    // Note: requires pg_stat_statements extension
    const slowQueries = await prisma.$queryRaw<any[]>`
      SELECT
        query,
        calls,
        total_exec_time,
        mean_exec_time,
        max_exec_time
      FROM pg_stat_statements
      WHERE mean_exec_time > ${minDuration}
      ORDER BY mean_exec_time DESC
      LIMIT 20
    `;

    return slowQueries;
  } catch (error) {
    // pg_stat_statements may not be enabled
    return [];
  }
}

/**
 * Get database size
 */
export async function getDatabaseSize(): Promise<{
  size: string;
  sizeBytes: number;
}> {
  try {
    const result = await prisma.$queryRaw<any[]>`
      SELECT
        pg_database_size(current_database()) as size_bytes,
        pg_size_pretty(pg_database_size(current_database())) as size
    `;

    return {
      size: result[0].size,
      sizeBytes: parseInt(result[0].size_bytes),
    };
  } catch (error) {
    console.error('Error fetching database size:', error);
    return {
      size: 'N/A',
      sizeBytes: 0,
    };
  }
}

/**
 * Get table sizes
 */
export async function getTableSizes(): Promise<Array<{
  tableName: string;
  size: string;
  rowCount: number;
}>> {
  try {
    const tables = await prisma.$queryRaw<any[]>`
      SELECT
        schemaname || '.' || tablename as table_name,
        pg_size_pretty(pg_total_relation_size(schemaname || '.' || tablename)) as size,
        n_live_tup as row_count
      FROM pg_stat_user_tables
      ORDER BY pg_total_relation_size(schemaname || '.' || tablename) DESC
    `;

    return tables.map(t => ({
      tableName: t.table_name,
      size: t.size,
      rowCount: parseInt(t.row_count),
    }));
  } catch (error) {
    console.error('Error fetching table sizes:', error);
    return [];
  }
}

/**
 * Get index usage statistics
 */
export async function getIndexStats(): Promise<Array<{
  tableName: string;
  indexName: string;
  indexSize: string;
  scans: number;
  rowsRead: number;
}>> {
  try {
    const indexes = await prisma.$queryRaw<any[]>`
      SELECT
        schemaname || '.' || tablename as table_name,
        indexrelname as index_name,
        pg_size_pretty(pg_relation_size(indexrelid)) as index_size,
        idx_scan as scans,
        idx_tup_read as rows_read
      FROM pg_stat_user_indexes
      ORDER BY idx_scan DESC
      LIMIT 50
    `;

    return indexes.map(i => ({
      tableName: i.table_name,
      indexName: i.index_name,
      indexSize: i.index_size,
      scans: parseInt(i.scans),
      rowsRead: parseInt(i.rows_read),
    }));
  } catch (error) {
    console.error('Error fetching index stats:', error);
    return [];
  }
}

/**
 * Find unused indexes
 */
export async function getUnusedIndexes(): Promise<Array<{
  tableName: string;
  indexName: string;
  size: string;
}>> {
  try {
    const unused = await prisma.$queryRaw<any[]>`
      SELECT
        schemaname || '.' || tablename as table_name,
        indexrelname as index_name,
        pg_size_pretty(pg_relation_size(indexrelid)) as size
      FROM pg_stat_user_indexes
      WHERE idx_scan = 0
      AND indexrelname NOT LIKE '%_pkey'
      ORDER BY pg_relation_size(indexrelid) DESC
    `;

    return unused.map(u => ({
      tableName: u.table_name,
      indexName: u.index_name,
      size: u.size,
    }));
  } catch (error) {
    console.error('Error fetching unused indexes:', error);
    return [];
  }
}

/**
 * Get cache hit ratio
 * Good ratio: >99%
 */
export async function getCacheHitRatio(): Promise<{
  ratio: number;
  heapHits: number;
  heapReads: number;
}> {
  try {
    const result = await prisma.$queryRaw<any[]>`
      SELECT
        sum(heap_blks_hit) as heap_hits,
        sum(heap_blks_read) as heap_reads,
        sum(heap_blks_hit) / NULLIF(sum(heap_blks_hit) + sum(heap_blks_read), 0) * 100 as ratio
      FROM pg_statio_user_tables
    `;

    return {
      ratio: parseFloat(result[0].ratio) || 0,
      heapHits: parseInt(result[0].heap_hits) || 0,
      heapReads: parseInt(result[0].heap_reads) || 0,
    };
  } catch (error) {
    console.error('Error fetching cache hit ratio:', error);
    return {
      ratio: 0,
      heapHits: 0,
      heapReads: 0,
    };
  }
}

/**
 * Analyze database and update statistics
 * Should be run periodically
 */
export async function analyzeDatabase(): Promise<void> {
  try {
    await prisma.$executeRaw`ANALYZE`;
    console.log('Database analysis completed');
  } catch (error) {
    console.error('Error analyzing database:', error);
  }
}

/**
 * Vacuum database (cleanup and optimize)
 * Should be run during low-traffic periods
 */
export async function vacuumDatabase(full: boolean = false): Promise<void> {
  try {
    if (full) {
      await prisma.$executeRaw`VACUUM FULL`;
      console.log('Full vacuum completed');
    } else {
      await prisma.$executeRaw`VACUUM`;
      console.log('Vacuum completed');
    }
  } catch (error) {
    console.error('Error vacuuming database:', error);
  }
}

/**
 * Reindex database
 * Rebuilds all indexes for a database
 */
export async function reindexDatabase(): Promise<void> {
  try {
    await prisma.$executeRaw`REINDEX DATABASE CURRENT`;
    console.log('Reindex completed');
  } catch (error) {
    console.error('Error reindexing database:', error);
  }
}

/**
 * Get database performance recommendations
 */
export async function getDatabaseRecommendations(): Promise<string[]> {
  const recommendations: string[] = [];

  try {
    // Check cache hit ratio
    const cacheHitRatio = await getCacheHitRatio();
    if (cacheHitRatio.ratio < 99) {
      recommendations.push(`Low cache hit ratio (${cacheHitRatio.ratio.toFixed(2)}%). Consider increasing shared_buffers.`);
    }

    // Check for unused indexes
    const unusedIndexes = await getUnusedIndexes();
    if (unusedIndexes.length > 0) {
      recommendations.push(`Found ${unusedIndexes.length} unused indexes. Consider dropping them to save space.`);
    }

    // Check connection pool usage
    const poolStats = await getPoolStats();
    const utilizationPercent = (poolStats.activeConnections / poolStats.maxConnections) * 100;
    if (utilizationPercent > 80) {
      recommendations.push(`High connection pool utilization (${utilizationPercent.toFixed(1)}%). Consider increasing pool size.`);
    }

    recommendations.push('Run ANALYZE regularly to keep statistics up to date.');
    recommendations.push('Monitor slow queries and add indexes where needed.');

  } catch (error) {
    console.error('Error generating recommendations:', error);
  }

  return recommendations;
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  await disconnectDatabase();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await disconnectDatabase();
  process.exit(0);
});
