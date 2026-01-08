import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import { isDevelopment } from '../config/env';
import { ErrorCategory } from '../utils/errors';

const logLevels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

const logColors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'blue',
};

winston.addColors(logColors);

// Console format for development
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let metaStr = '';
    if (Object.keys(meta).length > 0) {
      metaStr = `\n${JSON.stringify(meta, null, 2)}`;
    }
    return `${timestamp} [${level}]: ${message}${metaStr}`;
  })
);

// JSON format for production
const jsonFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Create transports
const transports: winston.transport[] = [];

// Console transport (always)
transports.push(
  new winston.transports.Console({
    format: isDevelopment ? consoleFormat : jsonFormat,
  })
);

// File transports (production)
if (!isDevelopment) {
  // Error logs
  transports.push(
    new DailyRotateFile({
      filename: 'logs/error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      maxSize: '20m',
      maxFiles: '14d',
      format: jsonFormat,
    })
  );

  // Combined logs
  transports.push(
    new DailyRotateFile({
      filename: 'logs/combined-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '14d',
      format: jsonFormat,
    })
  );
}

// Create logger instance
const logger = winston.createLogger({
  level: isDevelopment ? 'debug' : 'info',
  levels: logLevels,
  transports,
  exitOnError: false,
});

// Logger service with structured logging
export class LoggerService {
  static info(message: string, meta?: Record<string, any>) {
    logger.info(message, meta);
  }

  static warn(message: string, meta?: Record<string, any>) {
    logger.warn(message, meta);
  }

  static error(message: string, error?: Error | any, meta?: Record<string, any>) {
    const errorMeta = {
      ...meta,
      ...(error && {
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack,
          code: error.code,
          category: error.category,
          correlationId: error.correlationId,
        },
      }),
    };
    logger.error(message, errorMeta);
  }

  static http(message: string, meta?: Record<string, any>) {
    logger.http(message, meta);
  }

  static debug(message: string, meta?: Record<string, any>) {
    logger.debug(message, meta);
  }

  // Log error with category
  static logError(
    error: Error | any,
    context?: Record<string, any>
  ) {
    const errorInfo = {
      name: error.name,
      message: error.message,
      stack: error.stack,
      category: error.category || ErrorCategory.SYSTEM,
      code: error.code || 'UNKNOWN',
      correlationId: error.correlationId,
      isOperational: error.isOperational,
      context: { ...error.context, ...context },
    };

    logger.error('Application error occurred', errorInfo);
  }

  // Log external API call
  static logExternalAPICall(
    service: string,
    method: string,
    success: boolean,
    duration: number,
    meta?: Record<string, any>
  ) {
    const message = `External API call to ${service}.${method} ${success ? 'succeeded' : 'failed'}`;
    const logMeta = {
      service,
      method,
      success,
      duration: `${duration}ms`,
      ...meta,
    };

    if (success) {
      logger.info(message, logMeta);
    } else {
      logger.error(message, logMeta);
    }
  }

  // Log database query
  static logDatabaseQuery(
    operation: string,
    table: string,
    duration: number,
    success: boolean,
    meta?: Record<string, any>
  ) {
    logger.debug(`Database ${operation} on ${table}`, {
      operation,
      table,
      duration: `${duration}ms`,
      success,
      ...meta,
    });
  }
}

export default logger;
