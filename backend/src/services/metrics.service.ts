import {
  Counter,
  Gauge,
  Histogram,
  Registry,
  collectDefaultMetrics,
} from 'prom-client';
import { prisma } from '../config/database';
import { redisClient } from '../config/redis';
import * as os from 'os';

export class MetricsService {
  private static registry: Registry;
  private static initialized = false;

  // HTTP Metrics
  private static httpRequestsTotal: Counter<string>;
  private static httpRequestDuration: Histogram<string>;
  private static httpRequestSize: Histogram<string>;
  private static httpResponseSize: Histogram<string>;

  // Error Metrics
  private static errorsTotal: Counter<string>;
  private static errorsByCategory: Counter<string>;

  // Business Metrics
  private static userRegistrations: Counter<string>;
  private static serviceRequestsCreated: Counter<string>;
  private static paymentsProcessed: Counter<string>;
  private static paymentAmount: Counter<string>;

  // Database Metrics
  private static databaseConnections: Gauge<string>;
  private static databaseQueryDuration: Histogram<string>;
  private static databaseErrors: Counter<string>;

  // Redis Metrics
  private static redisConnections: Gauge<string>;
  private static redisCommandDuration: Histogram<string>;
  private static redisErrors: Counter<string>;

  // System Metrics
  private static cpuUsage: Gauge<string>;
  private static memoryUsage: Gauge<string>;
  private static activeRequests: Gauge<string>;

  /**
   * Initialize metrics
   */
  static initialize(): void {
    if (this.initialized) return;

    this.registry = new Registry();

    // Collect default metrics (CPU, memory, etc.)
    collectDefaultMetrics({
      register: this.registry,
      prefix: 'ca_marketplace_',
    });

    // Initialize HTTP metrics
    this.httpRequestsTotal = new Counter({
      name: 'ca_marketplace_http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status_code'],
      registers: [this.registry],
    });

    this.httpRequestDuration = new Histogram({
      name: 'ca_marketplace_http_request_duration_seconds',
      help: 'Duration of HTTP requests in seconds',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
      registers: [this.registry],
    });

    this.httpRequestSize = new Histogram({
      name: 'ca_marketplace_http_request_size_bytes',
      help: 'Size of HTTP requests in bytes',
      labelNames: ['method', 'route'],
      buckets: [100, 1000, 5000, 10000, 50000, 100000],
      registers: [this.registry],
    });

    this.httpResponseSize = new Histogram({
      name: 'ca_marketplace_http_response_size_bytes',
      help: 'Size of HTTP responses in bytes',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [100, 1000, 5000, 10000, 50000, 100000, 500000],
      registers: [this.registry],
    });

    // Initialize error metrics
    this.errorsTotal = new Counter({
      name: 'ca_marketplace_errors_total',
      help: 'Total number of errors',
      labelNames: ['type'],
      registers: [this.registry],
    });

    this.errorsByCategory = new Counter({
      name: 'ca_marketplace_errors_by_category',
      help: 'Errors categorized by type',
      labelNames: ['category', 'code'],
      registers: [this.registry],
    });

    // Initialize business metrics
    this.userRegistrations = new Counter({
      name: 'ca_marketplace_user_registrations_total',
      help: 'Total number of user registrations',
      labelNames: ['role'],
      registers: [this.registry],
    });

    this.serviceRequestsCreated = new Counter({
      name: 'ca_marketplace_service_requests_total',
      help: 'Total number of service requests created',
      labelNames: ['service_type', 'status'],
      registers: [this.registry],
    });

    this.paymentsProcessed = new Counter({
      name: 'ca_marketplace_payments_processed_total',
      help: 'Total number of payments processed',
      labelNames: ['status'],
      registers: [this.registry],
    });

    this.paymentAmount = new Counter({
      name: 'ca_marketplace_payment_amount_total',
      help: 'Total payment amount in currency',
      labelNames: ['currency', 'status'],
      registers: [this.registry],
    });

    // Initialize database metrics
    this.databaseConnections = new Gauge({
      name: 'ca_marketplace_database_connections',
      help: 'Number of active database connections',
      labelNames: ['state'],
      registers: [this.registry],
    });

    this.databaseQueryDuration = new Histogram({
      name: 'ca_marketplace_database_query_duration_seconds',
      help: 'Duration of database queries in seconds',
      labelNames: ['operation', 'table'],
      buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5],
      registers: [this.registry],
    });

    this.databaseErrors = new Counter({
      name: 'ca_marketplace_database_errors_total',
      help: 'Total number of database errors',
      labelNames: ['type'],
      registers: [this.registry],
    });

    // Initialize Redis metrics
    this.redisConnections = new Gauge({
      name: 'ca_marketplace_redis_connections',
      help: 'Number of Redis connections',
      registers: [this.registry],
    });

    this.redisCommandDuration = new Histogram({
      name: 'ca_marketplace_redis_command_duration_seconds',
      help: 'Duration of Redis commands in seconds',
      labelNames: ['command'],
      buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5],
      registers: [this.registry],
    });

    this.redisErrors = new Counter({
      name: 'ca_marketplace_redis_errors_total',
      help: 'Total number of Redis errors',
      registers: [this.registry],
    });

    // Initialize system metrics
    this.cpuUsage = new Gauge({
      name: 'ca_marketplace_cpu_usage_percent',
      help: 'CPU usage percentage',
      registers: [this.registry],
    });

    this.memoryUsage = new Gauge({
      name: 'ca_marketplace_memory_usage_bytes',
      help: 'Memory usage in bytes',
      labelNames: ['type'],
      registers: [this.registry],
    });

    this.activeRequests = new Gauge({
      name: 'ca_marketplace_active_requests',
      help: 'Number of active HTTP requests',
      registers: [this.registry],
    });

    this.initialized = true;
  }

  /**
   * Get metrics in Prometheus format
   */
  static async getMetrics(): Promise<string> {
    if (!this.initialized) {
      this.initialize();
    }

    // Update dynamic metrics before exporting
    await this.updateDynamicMetrics();

    return this.registry.metrics();
  }

  /**
   * Update dynamic metrics (database, Redis, etc.)
   */
  private static async updateDynamicMetrics(): Promise<void> {
    try {
      // Database connections
      const dbStats = await prisma.$queryRaw<any[]>`
        SELECT
          (SELECT count(*) FROM pg_stat_activity WHERE state = 'active') as active,
          (SELECT count(*) FROM pg_stat_activity WHERE state = 'idle') as idle
      `;

      if (dbStats.length > 0) {
        this.databaseConnections.set({ state: 'active' }, parseInt(dbStats[0].active));
        this.databaseConnections.set({ state: 'idle' }, parseInt(dbStats[0].idle));
      }

      // Redis connections
      const redisInfo = await redisClient.info('clients');
      const connMatch = redisInfo.match(/connected_clients:(\d+)/);
      if (connMatch) {
        this.redisConnections.set(parseInt(connMatch[1]));
      }

      // System metrics
      const cpus = os.cpus();
      const avgLoad = os.loadavg()[0];
      const cpuUsagePercent = (avgLoad / cpus.length) * 100;
      this.cpuUsage.set(cpuUsagePercent);

      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      this.memoryUsage.set({ type: 'total' }, totalMem);
      this.memoryUsage.set({ type: 'free' }, freeMem);
      this.memoryUsage.set({ type: 'used' }, totalMem - freeMem);
    } catch (error) {
      // Silently fail - metrics collection shouldn't break the app
      console.error('Error updating dynamic metrics:', error);
    }
  }

  /**
   * Record HTTP request
   */
  static recordHttpRequest(
    method: string,
    route: string,
    statusCode: number,
    duration: number,
    requestSize?: number,
    responseSize?: number
  ): void {
    if (!this.initialized) return;

    const durationSeconds = duration / 1000;

    this.httpRequestsTotal.inc({ method, route, status_code: statusCode });
    this.httpRequestDuration.observe({ method, route, status_code: statusCode }, durationSeconds);

    if (requestSize) {
      this.httpRequestSize.observe({ method, route }, requestSize);
    }

    if (responseSize) {
      this.httpResponseSize.observe({ method, route, status_code: statusCode }, responseSize);
    }
  }

  /**
   * Record error
   */
  static recordError(type: string, category?: string, code?: string): void {
    if (!this.initialized) return;

    this.errorsTotal.inc({ type });

    if (category && code) {
      this.errorsByCategory.inc({ category, code });
    }
  }

  /**
   * Record user registration
   */
  static recordUserRegistration(role: string): void {
    if (!this.initialized) return;

    this.userRegistrations.inc({ role });
  }

  /**
   * Record service request
   */
  static recordServiceRequest(serviceType: string, status: string): void {
    if (!this.initialized) return;

    this.serviceRequestsCreated.inc({ service_type: serviceType, status });
  }

  /**
   * Record payment
   */
  static recordPayment(amount: number, currency: string, status: string): void {
    if (!this.initialized) return;

    this.paymentsProcessed.inc({ status });
    this.paymentAmount.inc({ currency, status }, amount / 100); // Convert paise to rupees
  }

  /**
   * Record database query
   */
  static recordDatabaseQuery(operation: string, table: string, duration: number): void {
    if (!this.initialized) return;

    const durationSeconds = duration / 1000;
    this.databaseQueryDuration.observe({ operation, table }, durationSeconds);
  }

  /**
   * Record database error
   */
  static recordDatabaseError(type: string): void {
    if (!this.initialized) return;

    this.databaseErrors.inc({ type });
  }

  /**
   * Record Redis command
   */
  static recordRedisCommand(command: string, duration: number): void {
    if (!this.initialized) return;

    const durationSeconds = duration / 1000;
    this.redisCommandDuration.observe({ command }, durationSeconds);
  }

  /**
   * Record Redis error
   */
  static recordRedisError(): void {
    if (!this.initialized) return;

    this.redisErrors.inc();
  }

  /**
   * Increment active requests
   */
  static incrementActiveRequests(): void {
    if (!this.initialized) return;

    this.activeRequests.inc();
  }

  /**
   * Decrement active requests
   */
  static decrementActiveRequests(): void {
    if (!this.initialized) return;

    this.activeRequests.dec();
  }

  /**
   * Get current metrics as JSON (for dashboard)
   */
  static async getMetricsJson(): Promise<Record<string, any>> {
    if (!this.initialized) {
      this.initialize();
    }

    await this.updateDynamicMetrics();

    const metrics = await this.registry.getMetricsAsJSON();

    // Convert to more readable format
    const result: Record<string, any> = {};

    for (const metric of metrics) {
      result[metric.name] = {
        help: metric.help,
        type: metric.type,
        values: metric.values,
      };
    }

    return result;
  }

  /**
   * Reset all metrics (useful for testing)
   */
  static reset(): void {
    if (this.registry) {
      this.registry.clear();
    }
    this.initialized = false;
  }
}

// Initialize metrics on module load
MetricsService.initialize();
