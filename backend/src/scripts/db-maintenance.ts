/**
 * Database Maintenance Scripts
 *
 * Run these scripts periodically to maintain database health:
 * - ANALYZE: Update statistics for query planner (daily)
 * - VACUUM: Reclaim storage and update visibility map (weekly)
 * - REINDEX: Rebuild indexes to prevent bloat (monthly)
 *
 * Usage:
 *   npm run db:analyze
 *   npm run db:vacuum
 *   npm run db:reindex
 *   npm run db:stats
 */

import {
  prisma,
  analyzeDatabase,
  vacuumDatabase,
  reindexDatabase,
  getPoolStats,
  getDatabaseSize,
  getTableSizes,
  getIndexStats,
  getUnusedIndexes,
  getCacheHitRatio,
  getSlowQueries,
  getDatabaseRecommendations,
} from '../config/database';

/**
 * Run ANALYZE on all tables
 * Updates statistics for the query planner
 */
async function runAnalyze() {
  console.log('🔍 Running ANALYZE on database...');
  console.log('This will update statistics for the query planner.');

  try {
    await analyzeDatabase();
    console.log('✅ ANALYZE completed successfully');
  } catch (error) {
    console.error('❌ ANALYZE failed:', error);
    process.exit(1);
  }
}

/**
 * Run VACUUM on database
 * Reclaims storage and updates visibility map
 */
async function runVacuum() {
  console.log('🧹 Running VACUUM on database...');
  console.log('This will reclaim storage and update visibility map.');
  console.log('Note: This may take a while on large databases.');

  const full = process.argv.includes('--full');

  if (full) {
    console.log('⚠️  Running FULL VACUUM - this requires exclusive locks and may block queries.');
    console.log('Press Ctrl+C within 5 seconds to cancel...');
    await new Promise(resolve => setTimeout(resolve, 5000));
  }

  try {
    await vacuumDatabase(full);
    console.log('✅ VACUUM completed successfully');
  } catch (error) {
    console.error('❌ VACUUM failed:', error);
    process.exit(1);
  }
}

/**
 * Rebuild all indexes
 * Fixes index bloat and corruption
 */
async function runReindex() {
  console.log('🔨 Rebuilding database indexes...');
  console.log('This will rebuild all indexes to fix bloat.');
  console.log('⚠️  This may take a while and will lock tables.');

  try {
    await reindexDatabase();
    console.log('✅ REINDEX completed successfully');
  } catch (error) {
    console.error('❌ REINDEX failed:', error);
    process.exit(1);
  }
}

/**
 * Display database statistics
 */
async function showStats() {
  console.log('📊 Database Statistics\n');

  try {
    // Connection pool stats
    console.log('━━━ Connection Pool ━━━');
    const poolStats = await getPoolStats();
    console.log(`Active Connections:  ${poolStats.activeConnections}`);
    console.log(`Idle Connections:    ${poolStats.idleConnections}`);
    console.log(`Total Connections:   ${poolStats.totalConnections}`);
    console.log(`Max Connections:     ${poolStats.maxConnections}`);
    const utilization = (poolStats.activeConnections / poolStats.maxConnections * 100).toFixed(1);
    console.log(`Utilization:         ${utilization}%\n`);

    // Database size
    console.log('━━━ Database Size ━━━');
    const dbSize = await getDatabaseSize();
    console.log(`Total Size:          ${dbSize.size}\n`);

    // Cache hit ratio
    console.log('━━━ Cache Performance ━━━');
    const cacheRatio = await getCacheHitRatio();
    console.log(`Cache Hit Ratio:     ${cacheRatio.ratio.toFixed(2)}%`);
    console.log(`Heap Hits:           ${cacheRatio.heapHits.toLocaleString()}`);
    console.log(`Heap Reads:          ${cacheRatio.heapReads.toLocaleString()}`);
    if (cacheRatio.ratio < 99) {
      console.log('⚠️  Cache hit ratio is low. Consider increasing shared_buffers.');
    }
    console.log();

    // Table sizes (top 10)
    console.log('━━━ Largest Tables ━━━');
    const tables = await getTableSizes();
    tables.slice(0, 10).forEach((table, i) => {
      console.log(`${i + 1}. ${table.tableName}`);
      console.log(`   Size: ${table.size}, Rows: ${table.rowCount.toLocaleString()}`);
    });
    console.log();

    // Most used indexes (top 10)
    console.log('━━━ Most Used Indexes ━━━');
    const indexes = await getIndexStats();
    indexes.slice(0, 10).forEach((idx, i) => {
      console.log(`${i + 1}. ${idx.indexName} (${idx.tableName})`);
      console.log(`   Scans: ${idx.scans.toLocaleString()}, Size: ${idx.indexSize}`);
    });
    console.log();

    // Unused indexes
    console.log('━━━ Unused Indexes ━━━');
    const unused = await getUnusedIndexes();
    if (unused.length === 0) {
      console.log('✅ No unused indexes found\n');
    } else {
      console.log(`⚠️  Found ${unused.length} unused indexes:\n`);
      unused.slice(0, 10).forEach((idx, i) => {
        console.log(`${i + 1}. ${idx.indexName} (${idx.tableName})`);
        console.log(`   Size: ${idx.size}`);
      });
      console.log();
    }

    // Slow queries (requires pg_stat_statements)
    console.log('━━━ Slow Queries ━━━');
    const slowQueries = await getSlowQueries(1000); // > 1 second
    if (slowQueries.length === 0) {
      console.log('✅ No slow queries found (or pg_stat_statements not enabled)\n');
    } else {
      console.log(`Found ${slowQueries.length} slow queries:\n`);
      slowQueries.slice(0, 5).forEach((query, i) => {
        console.log(`${i + 1}. ${query.query.substring(0, 100)}...`);
        console.log(`   Calls: ${query.calls}, Avg: ${Math.round(query.mean_exec_time)}ms, Max: ${Math.round(query.max_exec_time)}ms`);
      });
      console.log();
    }

    // Recommendations
    console.log('━━━ Recommendations ━━━');
    const recommendations = await getDatabaseRecommendations();
    if (recommendations.length === 0) {
      console.log('✅ No recommendations - database looks healthy!\n');
    } else {
      recommendations.forEach((rec, i) => {
        console.log(`${i + 1}. ${rec}`);
      });
      console.log();
    }

    console.log('✅ Statistics retrieved successfully');
  } catch (error) {
    console.error('❌ Failed to retrieve statistics:', error);
    process.exit(1);
  }
}

/**
 * Enable PostgreSQL extensions for monitoring
 */
async function enableExtensions() {
  console.log('🔧 Enabling PostgreSQL extensions for monitoring...\n');

  try {
    // Enable pg_stat_statements for query performance tracking
    console.log('Enabling pg_stat_statements...');
    await prisma.$executeRaw`CREATE EXTENSION IF NOT EXISTS pg_stat_statements`;
    console.log('✅ pg_stat_statements enabled\n');

    // Enable pg_trgm for full-text search
    console.log('Enabling pg_trgm...');
    await prisma.$executeRaw`CREATE EXTENSION IF NOT EXISTS pg_trgm`;
    console.log('✅ pg_trgm enabled\n');

    console.log('✅ Extensions enabled successfully');
    console.log('\nNote: You may need to add pg_stat_statements to shared_preload_libraries');
    console.log('and restart PostgreSQL for full functionality.');
  } catch (error) {
    console.error('❌ Failed to enable extensions:', error);
    process.exit(1);
  }
}

/**
 * Optimize PostgreSQL settings
 * Displays recommended configuration
 */
async function showOptimalSettings() {
  console.log('⚙️  Recommended PostgreSQL Settings\n');

  console.log('Add these settings to your postgresql.conf:\n');

  console.log('# Memory Settings');
  console.log('shared_buffers = 256MB              # 25% of RAM (adjust based on your system)');
  console.log('effective_cache_size = 1GB          # 50-75% of RAM');
  console.log('work_mem = 16MB                      # Per operation memory');
  console.log('maintenance_work_mem = 128MB        # For VACUUM, CREATE INDEX\n');

  console.log('# Connection Settings');
  console.log('max_connections = 100               # Adjust based on your needs');
  console.log('statement_timeout = 30000           # 30 seconds\n');

  console.log('# Checkpoints and WAL');
  console.log('checkpoint_completion_target = 0.9');
  console.log('wal_buffers = 16MB');
  console.log('min_wal_size = 1GB');
  console.log('max_wal_size = 4GB\n');

  console.log('# Query Planning');
  console.log('random_page_cost = 1.1              # For SSDs');
  console.log('effective_io_concurrency = 200      # For SSDs\n');

  console.log('# Autovacuum (for automated maintenance)');
  console.log('autovacuum = on');
  console.log('autovacuum_max_workers = 4');
  console.log('autovacuum_naptime = 1min');
  console.log('autovacuum_vacuum_cost_limit = 500\n');

  console.log('# Monitoring');
  console.log('shared_preload_libraries = \'pg_stat_statements\'');
  console.log('pg_stat_statements.track = all\n');

  console.log('Note: These are general recommendations. Tune based on your workload.');
}

/**
 * Main function - parse command and execute
 */
async function main() {
  const command = process.argv[2];

  console.log('🗄️  CA Marketplace - Database Maintenance\n');

  try {
    switch (command) {
      case 'analyze':
        await runAnalyze();
        break;

      case 'vacuum':
        await runVacuum();
        break;

      case 'reindex':
        await runReindex();
        break;

      case 'stats':
        await showStats();
        break;

      case 'extensions':
        await enableExtensions();
        break;

      case 'settings':
        await showOptimalSettings();
        break;

      default:
        console.log('Usage: npm run db:maintenance <command>\n');
        console.log('Commands:');
        console.log('  analyze      - Update database statistics (run daily)');
        console.log('  vacuum       - Reclaim storage space (run weekly)');
        console.log('  vacuum --full - Full vacuum with table rewrite (run monthly, during maintenance)');
        console.log('  reindex      - Rebuild all indexes (run monthly)');
        console.log('  stats        - Show database statistics and health');
        console.log('  extensions   - Enable monitoring extensions');
        console.log('  settings     - Show recommended PostgreSQL settings\n');
        console.log('Examples:');
        console.log('  npm run db:maintenance analyze');
        console.log('  npm run db:maintenance vacuum');
        console.log('  npm run db:maintenance stats');
        process.exit(0);
    }
  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run main function
main();
