import { Request, Response, NextFunction } from 'express';

/**
 * Response Caching Headers Middleware
 *
 * Implements intelligent HTTP caching with:
 * - Cache-Control directives
 * - ETag support for conditional requests
 * - Last-Modified headers
 * - Vary headers for content negotiation
 * - CDN-specific headers
 */

export interface CacheOptions {
  // Cache duration in seconds
  maxAge?: number;

  // Shared cache (CDN) max age
  sMaxAge?: number;

  // Revalidation strategy
  mustRevalidate?: boolean;
  proxyRevalidate?: boolean;

  // Cache visibility
  public?: boolean;
  private?: boolean;

  // Transformation control
  noTransform?: boolean;

  // Immutable content
  immutable?: boolean;

  // Stale content handling
  staleWhileRevalidate?: number;
  staleIfError?: number;

  // ETag support
  etag?: boolean;

  // Vary header
  vary?: string[];
}

/**
 * Cache presets for different resource types
 */
export const CachePresets = {
  // Static assets (images, fonts, etc.) - 1 year
  static: {
    maxAge: 31536000, // 1 year
    public: true,
    immutable: true,
  },

  // API responses - 5 minutes
  api: {
    maxAge: 300, // 5 minutes
    private: true,
    mustRevalidate: true,
    staleWhileRevalidate: 60,
  },

  // Dynamic content - 1 minute
  dynamic: {
    maxAge: 60, // 1 minute
    private: true,
    mustRevalidate: true,
  },

  // User-specific data - no cache
  userSpecific: {
    maxAge: 0,
    private: true,
    mustRevalidate: true,
  },

  // Public lists (CA listings) - 5 minutes
  publicList: {
    maxAge: 300, // 5 minutes
    sMaxAge: 600, // 10 minutes for CDN
    public: true,
    staleWhileRevalidate: 120,
  },

  // Documents (PDFs, images) - 1 day
  document: {
    maxAge: 86400, // 1 day
    public: true,
    immutable: true,
  },

  // No cache for sensitive data
  noCache: {
    maxAge: 0,
    private: true,
    noTransform: true,
  },
};

/**
 * Build Cache-Control header value
 */
function buildCacheControl(options: CacheOptions): string {
  const directives: string[] = [];

  // Visibility
  if (options.public) {
    directives.push('public');
  } else if (options.private) {
    directives.push('private');
  }

  // Max age
  if (options.maxAge !== undefined) {
    directives.push(`max-age=${options.maxAge}`);
  }

  if (options.sMaxAge !== undefined) {
    directives.push(`s-maxage=${options.sMaxAge}`);
  }

  // Revalidation
  if (options.mustRevalidate) {
    directives.push('must-revalidate');
  }

  if (options.proxyRevalidate) {
    directives.push('proxy-revalidate');
  }

  // Transform control
  if (options.noTransform) {
    directives.push('no-transform');
  }

  // Immutable
  if (options.immutable) {
    directives.push('immutable');
  }

  // Stale content handling
  if (options.staleWhileRevalidate !== undefined) {
    directives.push(`stale-while-revalidate=${options.staleWhileRevalidate}`);
  }

  if (options.staleIfError !== undefined) {
    directives.push(`stale-if-error=${options.staleIfError}`);
  }

  // No cache
  if (options.maxAge === 0) {
    directives.push('no-cache', 'no-store');
  }

  return directives.join(', ');
}

/**
 * Apply cache headers
 */
export function applyCacheHeaders(
  res: Response,
  options: CacheOptions
): void {
  // Set Cache-Control header
  const cacheControl = buildCacheControl(options);
  res.setHeader('Cache-Control', cacheControl);

  // Set Vary header for content negotiation
  if (options.vary && options.vary.length > 0) {
    res.setHeader('Vary', options.vary.join(', '));
  }

  // Set CDN-specific headers
  if (options.sMaxAge !== undefined) {
    // Cloudflare
    res.setHeader('CDN-Cache-Control', `max-age=${options.sMaxAge}`);

    // Fastly
    res.setHeader('Surrogate-Control', `max-age=${options.sMaxAge}`);
  }
}

/**
 * Cache headers middleware factory
 */
export function cacheHeaders(preset: keyof typeof CachePresets | CacheOptions) {
  return (req: Request, res: Response, next: NextFunction) => {
    const options = typeof preset === 'string'
      ? CachePresets[preset]
      : preset;

    applyCacheHeaders(res, options);
    next();
  };
}

/**
 * ETag support for conditional requests
 */
export function etagMiddleware(req: Request, res: Response, next: NextFunction) {
  const originalJson = res.json.bind(res);

  res.json = function(data: any) {
    if (!data) {
      return originalJson(data);
    }

    // Generate ETag from response data
    const etag = generateETag(data);
    res.setHeader('ETag', etag);

    // Check If-None-Match header
    const clientETag = req.headers['if-none-match'];
    if (clientETag === etag) {
      // Content hasn't changed
      res.status(304).end();
      return res;
    }

    return originalJson(data);
  };

  next();
}

/**
 * Generate ETag from data
 */
function generateETag(data: any): string {
  const crypto = require('crypto');
  const content = typeof data === 'string' ? data : JSON.stringify(data);
  const hash = crypto.createHash('md5').update(content).digest('hex');
  return `"${hash}"`;
}

/**
 * Last-Modified support
 */
export function lastModifiedMiddleware(getLastModified: (req: Request) => Date | null) {
  return (req: Request, res: Response, next: NextFunction) => {
    const lastModified = getLastModified(req);

    if (lastModified) {
      res.setHeader('Last-Modified', lastModified.toUTCString());

      // Check If-Modified-Since header
      const ifModifiedSince = req.headers['if-modified-since'];
      if (ifModifiedSince) {
        const clientDate = new Date(ifModifiedSince);
        if (lastModified <= clientDate) {
          res.status(304).end();
          return;
        }
      }
    }

    next();
  };
}

/**
 * Conditional caching based on route patterns
 */
export function smartCacheMiddleware(req: Request, res: Response, next: NextFunction) {
  // Determine cache strategy based on request
  let cacheOptions: CacheOptions;

  // Static assets
  if (req.path.match(/\.(jpg|jpeg|png|gif|svg|ico|css|js|woff|woff2|ttf|eot)$/)) {
    cacheOptions = CachePresets.static;
  }
  // Documents
  else if (req.path.match(/\.(pdf|doc|docx|xls|xlsx)$/)) {
    cacheOptions = CachePresets.document;
  }
  // Public API endpoints
  else if (req.path.match(/^\/api\/(cas|services|reviews)/) && req.method === 'GET') {
    cacheOptions = CachePresets.publicList;
  }
  // User-specific endpoints
  else if (req.path.match(/^\/api\/(me|profile|requests)/) && req.method === 'GET') {
    cacheOptions = CachePresets.userSpecific;
  }
  // Dynamic API endpoints
  else if (req.path.startsWith('/api/') && req.method === 'GET') {
    cacheOptions = CachePresets.dynamic;
  }
  // No cache for mutations
  else if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    cacheOptions = CachePresets.noCache;
  }
  // Default
  else {
    cacheOptions = CachePresets.api;
  }

  applyCacheHeaders(res, cacheOptions);

  // Add Vary header for API endpoints
  if (req.path.startsWith('/api/')) {
    const vary = ['Accept-Encoding', 'Authorization'];
    res.setHeader('Vary', vary.join(', '));
  }

  next();
}

/**
 * CDN bypass for authenticated requests
 */
export function cdnBypassMiddleware(req: Request, res: Response, next: NextFunction) {
  // If request is authenticated, bypass CDN cache
  if (req.headers.authorization) {
    res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');
    res.setHeader('CDN-Cache-Control', 'no-store');
  }

  next();
}

/**
 * Cache warming hints
 * Adds headers to tell CDN to prefetch related resources
 */
export function cacheWarmingMiddleware(req: Request, res: Response, next: NextFunction) {
  const originalJson = res.json.bind(res);

  res.json = function(data: any) {
    // Add Link header for prefetching
    if (data && Array.isArray(data)) {
      // For list responses, add prefetch links
      const links: string[] = [];

      data.slice(0, 5).forEach((item: any) => {
        if (item.id) {
          links.push(`</api/resource/${item.id}>; rel=prefetch`);
        }
      });

      if (links.length > 0) {
        res.setHeader('Link', links.join(', '));
      }
    }

    return originalJson(data);
  };

  next();
}

/**
 * Purge cache helper
 * For use after data updates
 */
export interface CachePurgeOptions {
  urls?: string[];
  tags?: string[];
  all?: boolean;
}

export async function purgeCDNCache(options: CachePurgeOptions): Promise<void> {
  // Cloudflare cache purge
  if (process.env.CLOUDFLARE_API_TOKEN) {
    await purgeCloudflareCache(options);
  }

  // Fastly cache purge
  if (process.env.FASTLY_API_KEY) {
    await purgeFastlyCache(options);
  }

  // Custom CDN implementation
  // Add your CDN purge logic here
}

/**
 * Purge Cloudflare cache
 */
async function purgeCloudflareCache(options: CachePurgeOptions): Promise<void> {
  const zoneId = process.env.CLOUDFLARE_ZONE_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;

  if (!zoneId || !apiToken) return;

  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${zoneId}/purge_cache`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          files: options.urls,
          tags: options.tags,
          purge_everything: options.all,
        }),
      }
    );

    if (!response.ok) {
      console.error('Cloudflare cache purge failed:', await response.text());
    }
  } catch (error) {
    console.error('Error purging Cloudflare cache:', error);
  }
}

/**
 * Purge Fastly cache
 */
async function purgeFastlyCache(options: CachePurgeOptions): Promise<void> {
  const serviceId = process.env.FASTLY_SERVICE_ID;
  const apiKey = process.env.FASTLY_API_KEY;

  if (!serviceId || !apiKey) return;

  try {
    if (options.all) {
      // Purge all
      await fetch(
        `https://api.fastly.com/service/${serviceId}/purge_all`,
        {
          method: 'POST',
          headers: {
            'Fastly-Key': apiKey,
          },
        }
      );
    } else if (options.urls) {
      // Purge specific URLs
      for (const url of options.urls) {
        await fetch(url, {
          method: 'PURGE',
          headers: {
            'Fastly-Key': apiKey,
          },
        });
      }
    }
  } catch (error) {
    console.error('Error purging Fastly cache:', error);
  }
}

/**
 * Cache invalidation middleware
 * Automatically purges cache after mutations
 */
export function cacheInvalidationMiddleware(req: Request, res: Response, next: NextFunction) {
  // Only for mutation requests
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    return next();
  }

  // Store original send
  const originalSend = res.send.bind(res);

  res.send = function(data: any) {
    // If mutation was successful, purge related cache
    if (res.statusCode >= 200 && res.statusCode < 300) {
      // Determine URLs to purge based on request path
      const urlsToPurge = getRelatedURLs(req.path);

      if (urlsToPurge.length > 0) {
        // Purge asynchronously (don't block response)
        purgeCDNCache({ urls: urlsToPurge }).catch(console.error);
      }
    }

    return originalSend(data);
  };

  next();
}

/**
 * Get related URLs to purge based on mutated resource
 */
function getRelatedURLs(path: string): string[] {
  const urls: string[] = [];
  const baseUrl = process.env.API_BASE_URL || '';

  // Extract resource type from path
  if (path.includes('/cas/')) {
    urls.push(`${baseUrl}/api/cas`);
    urls.push(`${baseUrl}/api/stats/platform`);
  } else if (path.includes('/requests/')) {
    urls.push(`${baseUrl}/api/requests`);
    urls.push(`${baseUrl}/api/stats/platform`);
  } else if (path.includes('/reviews/')) {
    urls.push(`${baseUrl}/api/reviews`);
  }

  return urls;
}
