/**
 * CDN Configuration for Static Assets
 *
 * Configures CDN integration for:
 * - Images (profile pictures, documents)
 * - Static assets (CSS, JS, fonts)
 * - Document storage (PDFs, invoices)
 */

export interface CDNConfig {
  provider: 'cloudflare' | 'fastly' | 'cloudfront' | 'local';
  baseUrl: string;
  bucketName?: string;
  region?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
}

// CDN configuration based on environment
export const cdnConfig: CDNConfig = {
  provider: (process.env.CDN_PROVIDER as any) || 'local',
  baseUrl: process.env.CDN_BASE_URL || 'http://localhost:3000',
  bucketName: process.env.AWS_S3_BUCKET,
  region: process.env.AWS_REGION || 'us-east-1',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
};

/**
 * Get CDN URL for asset
 */
export function getCDNUrl(path: string): string {
  if (cdnConfig.provider === 'local') {
    return `${cdnConfig.baseUrl}${path}`;
  }

  // Remove leading slash for CDN paths
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;

  return `${cdnConfig.baseUrl}/${cleanPath}`;
}

/**
 * Get optimized image URL with transformations
 */
export interface ImageTransformOptions {
  width?: number;
  height?: number;
  quality?: number;
  format?: 'webp' | 'avif' | 'jpeg' | 'png';
  fit?: 'cover' | 'contain' | 'fill';
}

export function getOptimizedImageUrl(
  path: string,
  options: ImageTransformOptions = {}
): string {
  const baseUrl = getCDNUrl(path);

  // Cloudflare Image Resizing
  if (cdnConfig.provider === 'cloudflare') {
    const params = new URLSearchParams();

    if (options.width) params.append('width', options.width.toString());
    if (options.height) params.append('height', options.height.toString());
    if (options.quality) params.append('quality', options.quality.toString());
    if (options.format) params.append('format', options.format);
    if (options.fit) params.append('fit', options.fit);

    return `${baseUrl}?${params.toString()}`;
  }

  // AWS CloudFront + Lambda@Edge transformations
  if (cdnConfig.provider === 'cloudfront') {
    const params: string[] = [];

    if (options.width) params.push(`w${options.width}`);
    if (options.height) params.push(`h${options.height}`);
    if (options.quality) params.push(`q${options.quality}`);
    if (options.format) params.push(options.format);

    if (params.length > 0) {
      return `${baseUrl}?tr=${params.join(',')}`;
    }
  }

  return baseUrl;
}

/**
 * Lazy loading configuration
 */
export const lazyLoadConfig = {
  // Threshold for intersection observer
  threshold: 0.1,

  // Root margin for preloading
  rootMargin: '50px',

  // Placeholder image
  placeholder: '/assets/placeholder.jpg',

  // Blur hash for progressive loading
  useBlurHash: true,
};

/**
 * Document storage paths
 */
export const storagePaths = {
  profileImages: 'uploads/profiles',
  documents: 'uploads/documents',
  invoices: 'uploads/invoices',
  certificates: 'uploads/certificates',
};

/**
 * Get document URL
 */
export function getDocumentUrl(filename: string, type: keyof typeof storagePaths): string {
  const path = `/${storagePaths[type]}/${filename}`;
  return getCDNUrl(path);
}

/**
 * Generate signed URL for private documents
 */
export function getSignedUrl(
  path: string,
  expiresIn: number = 3600 // 1 hour
): string {
  // For S3/CloudFront signed URLs
  if (cdnConfig.provider === 'cloudfront') {
    // Implementation would use AWS SDK
    // This is a placeholder
    return `${getCDNUrl(path)}?expires=${Date.now() + expiresIn * 1000}`;
  }

  return getCDNUrl(path);
}
