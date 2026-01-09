import compression from 'compression';
import { Request, Response } from 'express';

/**
 * Response Compression Middleware
 *
 * Implements gzip and brotli compression with intelligent filtering:
 * - Compresses text-based responses (JSON, HTML, CSS, JS)
 * - Skips already compressed formats (images, videos)
 * - Minimum threshold to avoid overhead
 * - Configurable compression levels
 */

/**
 * Should compress predicate
 * Determines if response should be compressed based on content type
 */
function shouldCompress(req: Request, res: Response): boolean {
  // Skip compression if client doesn't accept encoding
  if (!req.headers['accept-encoding']) {
    return false;
  }

  // Check for no-transform cache-control directive
  const cacheControl = res.getHeader('Cache-Control');
  if (cacheControl && cacheControl.toString().includes('no-transform')) {
    return false;
  }

  // Use compression's default filter
  return compression.filter(req, res);
}

/**
 * Compression middleware options
 */
const compressionOptions: compression.CompressionOptions = {
  // Only compress responses above 1KB
  threshold: 1024,

  // Compression level (0-9, default: 6)
  // Higher = better compression but slower
  // 6 is good balance for production
  level: 6,

  // Memory level (1-9, default: 8)
  // Higher = more memory but better compression
  memLevel: 8,

  // Custom filter function
  filter: shouldCompress,

  // Brotli options (when available)
  // @ts-ignore - compression types may not include brotli
  brotli: {
    // Brotli quality (0-11, default: 4)
    // Higher = better compression but slower
    params: {
      [require('zlib').constants.BROTLI_PARAM_QUALITY]: 4,
      [require('zlib').constants.BROTLI_PARAM_MODE]: require('zlib').constants.BROTLI_MODE_TEXT,
    },
  },
};

/**
 * Export compression middleware
 */
export const compressionMiddleware = compression(compressionOptions);

/**
 * Compression statistics middleware
 * Logs compression ratio for monitoring
 */
export function compressionStatsMiddleware(req: Request, res: Response, next: Function) {
  const originalWrite = res.write;
  const originalEnd = res.end;
  let uncompressedSize = 0;

  // Override write to track original size
  res.write = function(chunk: any, ...args: any[]): boolean {
    if (chunk) {
      uncompressedSize += Buffer.isBuffer(chunk) ? chunk.length : Buffer.byteLength(chunk);
    }
    return originalWrite.apply(res, [chunk, ...args] as any);
  };

  // Override end to track original size and log stats
  res.end = function(chunk: any, ...args: any[]): any {
    if (chunk) {
      uncompressedSize += Buffer.isBuffer(chunk) ? chunk.length : Buffer.byteLength(chunk);
    }

    const contentEncoding = res.getHeader('Content-Encoding');
    if (contentEncoding && uncompressedSize > 0) {
      // Compression was applied
      res.setHeader('X-Uncompressed-Size', uncompressedSize.toString());

      // Log compression stats for monitoring
      if (process.env.NODE_ENV === 'development') {
        console.log(`Compressed ${req.method} ${req.path}: ${uncompressedSize} bytes (${contentEncoding})`);
      }
    }

    return originalEnd.apply(res, [chunk, ...args] as any);
  };

  next();
}

/**
 * Precompression check middleware
 * Serves precompressed files if available (.gz, .br)
 */
export function precompressionMiddleware(req: Request, _res: Response, next: Function) {
  // Only for static file requests
  if (!req.path.match(/\.(js|css|html|json|svg)$/)) {
    return next();
  }

  const acceptEncoding = req.headers['accept-encoding'] || '';

  // Check for brotli support first (better compression)
  if (acceptEncoding.includes('br')) {
    // Try to serve .br file
    // This would require file system check - placeholder
    // In production, nginx/CDN would handle this
  } else if (acceptEncoding.includes('gzip')) {
    // Try to serve .gz file
    // Placeholder for production implementation
  }

  next();
}

/**
 * Response size header middleware
 * Adds X-Response-Size header for monitoring
 */
export function responseSizeMiddleware(_req: Request, res: Response, next: Function) {
  const originalSend = res.send;

  res.send = function(data: any): Response {
    if (data) {
      const size = Buffer.isBuffer(data)
        ? data.length
        : typeof data === 'string'
        ? Buffer.byteLength(data)
        : Buffer.byteLength(JSON.stringify(data));

      res.setHeader('X-Response-Size', size.toString());
    }

    return originalSend.call(this, data);
  };

  next();
}

/**
 * Content-Type specific compression settings
 */
export const compressionByContentType = {
  // High compression for text
  'application/json': { level: 9 },
  'text/html': { level: 9 },
  'text/css': { level: 9 },
  'application/javascript': { level: 9 },

  // Medium compression for data
  'text/plain': { level: 6 },
  'application/xml': { level: 6 },

  // No compression for already compressed
  'image/jpeg': { level: 0 },
  'image/png': { level: 0 },
  'image/gif': { level: 0 },
  'video/mp4': { level: 0 },
  'application/pdf': { level: 0 },
  'application/zip': { level: 0 },
};

/**
 * Get optimal compression level for content type
 */
export function getCompressionLevel(contentType: string): number {
  for (const [type, options] of Object.entries(compressionByContentType)) {
    if (contentType.includes(type)) {
      return options.level;
    }
  }
  return 6; // Default
}
