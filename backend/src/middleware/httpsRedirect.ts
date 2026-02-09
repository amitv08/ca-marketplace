import { Request, Response, NextFunction } from 'express';
import { LoggerService } from '../services/logger.service';

/**
 * HTTPS Redirect Middleware
 * Enforces HTTPS connections in production by redirecting HTTP requests
 * 
 * This middleware checks the X-Forwarded-Proto header (set by reverse proxy)
 * and redirects to HTTPS if the request came over HTTP
 */
export const httpsRedirectMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Only enforce HTTPS in production
  if (process.env.NODE_ENV !== 'production') {
    return next();
  }

  // Skip health check endpoint (for load balancer health checks)
  if (req.path === '/api/health') {
    return next();
  }

  // Check if request is over HTTPS
  const forwardedProto = req.header('x-forwarded-proto');
  const isSecure = forwardedProto === 'https' || req.secure;

  if (!isSecure) {
    LoggerService.warn('HTTP request redirected to HTTPS', {
      path: req.path,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });

    const httpsUrl = `https://${req.header('host')}${req.url}`;
    return res.redirect(301, httpsUrl);
  }

  next();
};
