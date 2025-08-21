/**
 * @fileoverview Logging utility with structured JSON logging
 * @description Winston-based logger with multiple transports and log levels
 */

import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import config from '../config/index.js';

// Custom log levels
const logLevels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Custom colors for console output
const logColors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

winston.addColors(logColors);

// Custom format for console output
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.colorize({ all: true }),
  winston.format.printf((info) => {
    const { timestamp, level, message, service, ...metadata } = info;
    
    let msg = `${timestamp} [${level}]`;
    if (service) {
      msg += ` [${service}]`;
    }
    msg += `: ${message}`;
    
    // Add metadata if present
    if (Object.keys(metadata).length > 0) {
      msg += ` ${JSON.stringify(metadata)}`;
    }
    
    return msg;
  })
);

// Format for file output (structured JSON)
const fileFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Create transports
const transports: winston.transport[] = [];

// Console transport for development
if (config.isDevelopment) {
  transports.push(
    new winston.transports.Console({
      format: consoleFormat,
    })
  );
}

// File transport for all environments
if (config.logging.filePath) {
  // General log file (rotated daily)
  transports.push(
    new DailyRotateFile({
      filename: `${config.logging.filePath}/app-%DATE%.log`,
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: config.logging.maxSize,
      maxFiles: config.logging.maxFiles,
      format: fileFormat,
    })
  );

  // Error log file
  transports.push(
    new DailyRotateFile({
      filename: `${config.logging.filePath}/error-%DATE%.log`,
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: config.logging.maxSize,
      maxFiles: config.logging.maxFiles,
      level: 'error',
      format: fileFormat,
    })
  );
}

// Create logger instance
const logger = winston.createLogger({
  level: config.logging.level,
  levels: logLevels,
  format: fileFormat,
  transports,
  // Handle uncaught exceptions and rejections
  exceptionHandlers: config.logging.filePath ? [
    new DailyRotateFile({
      filename: `${config.logging.filePath}/exceptions-%DATE%.log`,
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: config.logging.maxSize,
      maxFiles: config.logging.maxFiles,
      format: fileFormat,
    })
  ] : [],
  rejectionHandlers: config.logging.filePath ? [
    new DailyRotateFile({
      filename: `${config.logging.filePath}/rejections-%DATE%.log`,
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: config.logging.maxSize,
      maxFiles: config.logging.maxFiles,
      format: fileFormat,
    })
  ] : [],
});

// Logger interface for better type safety
export interface LoggerContext {
  service?: string;
  userId?: string;
  intentHash?: string;
  solverId?: string;
  requestId?: string;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
  duration?: number;
  statusCode?: number;
  error?: Error;
  [key: string]: any;
}

export class Logger {
  private service: string;

  constructor(service: string = 'backend') {
    this.service = service;
  }

  private log(level: string, message: string, context: LoggerContext = {}): void {
    logger.log(level, message, {
      service: this.service,
      timestamp: new Date().toISOString(),
      ...context,
    });
  }

  error(message: string, context: LoggerContext = {}): void {
    this.log('error', message, context);
  }

  warn(message: string, context: LoggerContext = {}): void {
    this.log('warn', message, context);
  }

  info(message: string, context: LoggerContext = {}): void {
    this.log('info', message, context);
  }

  http(message: string, context: LoggerContext = {}): void {
    this.log('http', message, context);
  }

  debug(message: string, context: LoggerContext = {}): void {
    this.log('debug', message, context);
  }

  // Specialized logging methods
  
  /**
   * Log intent-related operations
   */
  intent(action: string, intentHash: string, context: LoggerContext = {}): void {
    this.info(`Intent ${action}`, {
      intentHash,
      action,
      ...context,
    });
  }

  /**
   * Log bid-related operations
   */
  bid(action: string, intentHash: string, solverId: string, context: LoggerContext = {}): void {
    this.info(`Bid ${action}`, {
      intentHash,
      solverId,
      action,
      ...context,
    });
  }

  /**
   * Log HTTP requests
   */
  request(
    method: string,
    url: string,
    statusCode: number,
    duration: number,
    context: LoggerContext = {}
  ): void {
    const level = statusCode >= 400 ? 'warn' : 'http';
    this.log(level, `${method} ${url} ${statusCode}`, {
      method,
      url,
      statusCode,
      duration,
      ...context,
    });
  }

  /**
   * Log WebSocket events
   */
  websocket(event: string, connectionId?: string, context: LoggerContext = {}): void {
    this.info(`WebSocket ${event}`, {
      event,
      connectionId,
      ...context,
    });
  }

  /**
   * Log database operations
   */
  database(operation: string, table: string, duration?: number, context: LoggerContext = {}): void {
    this.debug(`Database ${operation}`, {
      operation,
      table,
      duration,
      ...context,
    });
  }

  /**
   * Log blockchain operations
   */
  blockchain(operation: string, txHash?: string, context: LoggerContext = {}): void {
    this.info(`Blockchain ${operation}`, {
      operation,
      txHash,
      ...context,
    });
  }

  /**
   * Log performance metrics
   */
  metric(name: string, value: number, unit: string = 'ms', context: LoggerContext = {}): void {
    this.info(`Metric: ${name}`, {
      metric: name,
      value,
      unit,
      ...context,
    });
  }

  /**
   * Log security events
   */
  security(event: string, severity: 'low' | 'medium' | 'high' = 'medium', context: LoggerContext = {}): void {
    const level = severity === 'high' ? 'error' : severity === 'medium' ? 'warn' : 'info';
    this.log(level, `Security: ${event}`, {
      securityEvent: event,
      severity,
      ...context,
    });
  }

  /**
   * Create child logger with additional context
   */
  child(additionalContext: LoggerContext): Logger {
    const childLogger = new Logger(this.service);
    
    // Override log method to include additional context
    const originalLog = childLogger.log.bind(childLogger);
    childLogger.log = (level: string, message: string, context: LoggerContext = {}) => {
      originalLog(level, message, { ...additionalContext, ...context });
    };

    return childLogger;
  }
}

// Create default logger instances for each service
export const relayerLogger = new Logger('relayer');
export const coordinatorLogger = new Logger('coordinator');
export const websocketLogger = new Logger('websocket');
export const databaseLogger = new Logger('database');
export const blockchainLogger = new Logger('blockchain');

// Generic logger
export const appLogger = new Logger('app');

// Express middleware for request logging
export const requestLoggingMiddleware = (serviceName: string) => {
  const serviceLogger = new Logger(serviceName);
  
  return (req: any, res: any, next: any) => {
    const start = Date.now();
    
    // Add request ID for tracing
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    req.requestId = requestId;
    
    // Create child logger with request context
    req.logger = serviceLogger.child({
      requestId,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    });

    // Log request start
    req.logger.http('Request started', {
      method: req.method,
      url: req.originalUrl,
      query: req.query,
      body: req.method !== 'GET' ? req.body : undefined,
    });

    // Override res.end to log response
    const originalEnd = res.end;
    res.end = function(chunk: any, encoding: any) {
      const duration = Date.now() - start;
      
      req.logger.request(
        req.method,
        req.originalUrl,
        res.statusCode,
        duration,
        {
          responseSize: chunk ? chunk.length : 0,
        }
      );

      originalEnd.call(res, chunk, encoding);
    };

    next();
  };
};

export default appLogger;