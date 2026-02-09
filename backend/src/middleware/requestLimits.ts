import { Request, Response, NextFunction } from 'express';
import { sendError } from '../utils';

/**
 * SEC-015: Search Query Length Limits
 * Prevents DoS attacks via excessively long search queries
 */
export const searchQueryLimiter = (req: Request, res: Response, next: NextFunction): void => {
  const MAX_QUERY_LENGTH = 200;
  
  if (req.query.q || req.query.search || req.query.query) {
    const searchTerm = (req.query.q || req.query.search || req.query.query) as string;
    
    if (searchTerm && searchTerm.length > MAX_QUERY_LENGTH) {
      return sendError(res, `Search query too long (max ${MAX_QUERY_LENGTH} characters)`, 400);
    }
  }
  
  next();
};

/**
 * SEC-019: Pagination Limits
 * Prevents resource exhaustion via large page sizes
 */
export const paginationLimiter = (req: Request, _res: Response, next: NextFunction): void => {
  const MAX_PAGE_SIZE = 100;
  const DEFAULT_PAGE_SIZE = 20;
  
  // Normalize pagination parameters
  if (req.query.limit) {
    const limit = parseInt(req.query.limit as string, 10);
    if (isNaN(limit) || limit < 1) {
      req.query.limit = String(DEFAULT_PAGE_SIZE);
    } else if (limit > MAX_PAGE_SIZE) {
      req.query.limit = String(MAX_PAGE_SIZE);
    }
  } else {
    req.query.limit = String(DEFAULT_PAGE_SIZE);
  }
  
  // Normalize page number
  if (req.query.page) {
    const page = parseInt(req.query.page as string, 10);
    if (isNaN(page) || page < 1) {
      req.query.page = '1';
    }
  } else {
    req.query.page = '1';
  }
  
  next();
};

/**
 * SEC-026: Date Range Validation
 * Prevents queries with unrealistic date ranges
 */
export const dateRangeValidator = (req: Request, res: Response, next: NextFunction): void => {
  const MAX_RANGE_DAYS = 365; // 1 year max
  
  const startDate = req.query.startDate || req.query.from;
  const endDate = req.query.endDate || req.query.to;
  
  if (startDate && endDate) {
    try {
      const start = new Date(startDate as string);
      const end = new Date(endDate as string);
      
      // Check for invalid dates
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return sendError(res, 'Invalid date format', 400);
      }
      
      // Check if start is after end
      if (start > end) {
        return sendError(res, 'Start date must be before end date', 400);
      }
      
      // Check if range exceeds maximum
      const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays > MAX_RANGE_DAYS) {
        return sendError(res, `Date range too large (max ${MAX_RANGE_DAYS} days)`, 400);
      }
      
      // Check for future dates where inappropriate
      const now = new Date();
      if (req.path.includes('/analytics') || req.path.includes('/reports')) {
        if (start > now || end > now) {
          return sendError(res, 'Cannot query future dates for historical data', 400);
        }
      }
    } catch (error) {
      return sendError(res, 'Invalid date format', 400);
    }
  }
  
  next();
};

export default {
  searchQueryLimiter,
  paginationLimiter,
  dateRangeValidator,
};
