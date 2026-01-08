import { Request, Response, NextFunction } from 'express';
import { MetricsService } from '../services/metrics.service';
import { AlertService } from '../services/alert.service';

/**
 * Middleware to track request metrics and trigger alerts
 */
export const metricsTracker = (req: Request, res: Response, next: NextFunction): void => {
  const startTime = Date.now();

  // Increment active requests
  MetricsService.incrementActiveRequests();

  // Capture original res.end to track metrics when response is sent
  const originalEnd = res.end;

  // Override res.end
  res.end = function (chunk?: any, encoding?: any, callback?: any): any {
    const duration = Date.now() - startTime;
    const statusCode = res.statusCode;

    // Extract route pattern (remove dynamic params)
    const route = getRoutePattern(req);

    // Calculate request and response sizes
    const requestSize = parseInt(req.headers['content-length'] || '0', 10);
    const responseSize = parseInt(res.getHeader('content-length')?.toString() || '0', 10);

    // Record metrics
    MetricsService.recordHttpRequest(
      req.method,
      route,
      statusCode,
      duration,
      requestSize,
      responseSize
    );

    // Record for alert service
    const isError = statusCode >= 400;
    AlertService.recordRequest(isError, duration);

    // Record errors
    if (isError) {
      MetricsService.recordError('http_error');
    }

    // Decrement active requests
    MetricsService.decrementActiveRequests();

    // Call original end
    return originalEnd.call(this, chunk, encoding, callback);
  };

  next();
};

/**
 * Helper to extract route pattern from request
 * Converts /api/users/123 to /api/users/:id
 */
function getRoutePattern(req: Request): string {
  // Try to get the route from Express route object
  if (req.route && req.route.path) {
    const basePath = req.baseUrl || '';
    return basePath + req.route.path;
  }

  // Fallback: sanitize the URL to remove IDs
  let path = req.path;

  // Replace UUIDs
  path = path.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ':id');

  // Replace numeric IDs
  path = path.replace(/\/\d+/g, '/:id');

  return path;
}
