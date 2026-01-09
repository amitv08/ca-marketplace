import { Response, NextFunction } from 'express';

/**
 * Field Selection Middleware
 *
 * Allows clients to specify which fields they want in the response:
 * - Reduces payload size
 * - Faster response times
 * - Lower bandwidth costs
 * - Similar to GraphQL field selection
 *
 * Usage:
 *   GET /api/users?fields=id,name,email
 *   GET /api/cas?fields=id,user.name,hourlyRate&expand=reviews
 */

/**
 * Parse fields query parameter
 * Supports:
 * - Simple fields: "id,name,email"
 * - Nested fields: "user.name,user.email"
 * - Wildcards: "*" for all fields
 */
export function parseFields(fieldsParam: string | undefined): Set<string> | null {
  if (!fieldsParam) return null;

  // Wildcard means all fields
  if (fieldsParam === '*') return null;

  // Split by comma and trim
  const fields = fieldsParam.split(',').map(f => f.trim()).filter(f => f);

  return new Set(fields);
}

/**
 * Parse expand parameter for relations
 * Example: expand=user,reviews
 */
export function parseExpand(expandParam: string | undefined): Set<string> | null {
  if (!expandParam) return null;

  const relations = expandParam.split(',').map(r => r.trim()).filter(r => r);

  return new Set(relations);
}

/**
 * Filter object by selected fields
 */
export function filterFields(obj: any, fields: Set<string> | null): any {
  if (!fields || !obj) return obj;

  if (Array.isArray(obj)) {
    return obj.map(item => filterFields(item, fields));
  }

  if (typeof obj !== 'object') return obj;

  const filtered: any = {};

  // Always include id if present
  if ('id' in obj) {
    filtered.id = obj.id;
  }

  for (const field of fields) {
    // Handle nested fields (e.g., "user.name")
    if (field.includes('.')) {
      const [parent, ...rest] = field.split('.');

      if (parent in obj) {
        if (!filtered[parent]) {
          filtered[parent] = {};
        }

        const nestedField = rest.join('.');
        const nestedValue = getNestedValue(obj[parent], nestedField);

        if (nestedValue !== undefined) {
          setNestedValue(filtered[parent], nestedField, nestedValue);
        }
      }
    } else {
      // Simple field
      if (field in obj) {
        filtered[field] = obj[field];
      }
    }
  }

  return filtered;
}

/**
 * Get nested value from object
 */
function getNestedValue(obj: any, path: string): any {
  const parts = path.split('.');
  let current = obj;

  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = current[part];
    } else {
      return undefined;
    }
  }

  return current;
}

/**
 * Set nested value in object
 */
function setNestedValue(obj: any, path: string, value: any): void {
  const parts = path.split('.');
  let current = obj;

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (!(part in current)) {
      current[part] = {};
    }
    current = current[part];
  }

  current[parts[parts.length - 1]] = value;
}

/**
 * Convert fields Set to Prisma select object
 * Used to optimize database queries
 */
export function fieldsToPrismaSelect(fields: Set<string> | null): any {
  if (!fields) return undefined;

  const select: any = { id: true }; // Always include id

  for (const field of fields) {
    if (field.includes('.')) {
      // Nested field - create select for relation
      const [parent, ...rest] = field.split('.');

      if (!select[parent]) {
        select[parent] = { select: { id: true } };
      }

      if (select[parent] === true) {
        select[parent] = { select: { id: true } };
      }

      // Add nested field to select
      const nestedField = rest.join('.');
      if (nestedField) {
        select[parent].select[nestedField] = true;
      }
    } else {
      // Simple field
      select[field] = true;
    }
  }

  return select;
}

/**
 * Convert expand Set to Prisma include object
 */
export function expandToPrismaInclude(expand: Set<string> | null): any {
  if (!expand) return undefined;

  const include: any = {};

  for (const relation of expand) {
    include[relation] = true;
  }

  return include;
}

/**
 * Field selection middleware
 * Parses fields and expand parameters and attaches to request
 */
export function fieldSelectionMiddleware(req: any, res: Response, next: NextFunction) {
  // Parse fields parameter
  const fields = parseFields(req.query.fields as string);
  const expand = parseExpand(req.query.expand as string);

  // Attach to request for use in route handlers
  req.selectedFields = fields;
  req.expandedRelations = expand;

  // Convert to Prisma select/include for convenience
  req.prismaSelect = fieldsToPrismaSelect(fields);
  req.prismaInclude = expandToPrismaInclude(expand);

  // Override res.json to filter response
  const originalJson = res.json.bind(res);

  res.json = function(data: any) {
    // Filter data by selected fields
    if (fields && data) {
      data = filterFields(data, fields);
    }

    return originalJson(data);
  };

  next();
}

/**
 * Field selection for Prisma queries
 * Example usage in route handlers
 */
export class FieldSelector {
  /**
   * Get select object for Prisma query
   */
  static getSelect(req: any, defaultFields?: string[]): any {
    const fields = req.selectedFields;

    if (!fields && defaultFields) {
      return this.createSelect(defaultFields);
    }

    return req.prismaSelect;
  }

  /**
   * Get include object for Prisma query
   */
  static getInclude(req: any, defaultRelations?: string[]): any {
    const expand = req.expandedRelations;

    if (!expand && defaultRelations) {
      return this.createInclude(defaultRelations);
    }

    return req.prismaInclude;
  }

  /**
   * Create select object from field array
   */
  static createSelect(fields: string[]): any {
    const select: any = { id: true };

    for (const field of fields) {
      select[field] = true;
    }

    return select;
  }

  /**
   * Create include object from relation array
   */
  static createInclude(relations: string[]): any {
    const include: any = {};

    for (const relation of relations) {
      include[relation] = true;
    }

    return include;
  }

  /**
   * Merge select with default fields
   */
  static mergeSelect(select: any, defaultFields: string[]): any {
    const merged = { ...select };

    for (const field of defaultFields) {
      if (!(field in merged)) {
        merged[field] = true;
      }
    }

    return merged;
  }
}

/**
 * Pagination with field selection
 * Combines pagination parameters with field selection
 */
export interface PaginationParams {
  page?: number;
  limit?: number;
  fields?: Set<string>;
  expand?: Set<string>;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export function parsePaginationParams(req: any): PaginationParams {
  const page = parseInt(req.query.page as string) || 1;
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
  const fields = parseFields(req.query.fields as string);
  const expand = parseExpand(req.query.expand as string);
  const sortBy = req.query.sortBy as string || 'createdAt';
  const sortOrder = (req.query.sortOrder as string)?.toLowerCase() === 'asc' ? 'asc' : 'desc';

  return {
    page,
    limit,
    fields: fields || undefined,
    expand: expand || undefined,
    sortBy,
    sortOrder,
  };
}

/**
 * Response metadata for paginated results
 */
export interface ResponseMetadata {
  fields?: string[];
  expanded?: string[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  timing?: {
    queryTime: number;
    totalTime: number;
  };
}

/**
 * Add metadata to response
 */
export function addResponseMetadata(
  res: Response,
  metadata: ResponseMetadata
): void {
  if (metadata.fields) {
    res.setHeader('X-Fields', metadata.fields.join(','));
  }

  if (metadata.expanded) {
    res.setHeader('X-Expanded', metadata.expanded.join(','));
  }

  if (metadata.pagination) {
    res.setHeader('X-Total-Count', metadata.pagination.total.toString());
    res.setHeader('X-Page', metadata.pagination.page.toString());
    res.setHeader('X-Limit', metadata.pagination.limit.toString());
    res.setHeader('X-Total-Pages', metadata.pagination.totalPages.toString());
  }

  if (metadata.timing) {
    res.setHeader('X-Query-Time', `${metadata.timing.queryTime}ms`);
    res.setHeader('X-Total-Time', `${metadata.timing.totalTime}ms`);
  }
}

/**
 * Example field presets for common use cases
 */
export const FieldPresets = {
  // User presets
  userBasic: ['id', 'name', 'email', 'role'],
  userPublic: ['id', 'name', 'profileImage'],
  userFull: ['id', 'name', 'email', 'role', 'phone', 'profileImage', 'createdAt'],

  // CA presets
  caBasic: ['id', 'hourlyRate', 'specialization', 'experienceYears'],
  caPublic: ['id', 'hourlyRate', 'specialization', 'experienceYears', 'description', 'user.name', 'user.profileImage'],
  caFull: ['id', 'hourlyRate', 'specialization', 'experienceYears', 'description', 'languages', 'qualifications', 'verificationStatus'],

  // Service Request presets
  requestBasic: ['id', 'serviceType', 'status', 'createdAt'],
  requestWithClient: ['id', 'serviceType', 'status', 'createdAt', 'client.user.name'],
  requestFull: ['id', 'serviceType', 'status', 'description', 'deadline', 'createdAt', 'updatedAt'],
};

/**
 * Get preset fields
 */
export function getPresetFields(preset: string): string[] | null {
  return (FieldPresets as any)[preset] || null;
}

/**
 * Apply preset to request
 */
export function applyFieldPreset(req: any, preset: string): void {
  const fields = getPresetFields(preset);

  if (fields) {
    req.selectedFields = new Set(fields);
    req.prismaSelect = fieldsToPrismaSelect(req.selectedFields);
  }
}
