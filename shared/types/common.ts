/**
 * @fileoverview Common utility types and shared definitions
 * @description General purpose types used across the application
 */

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Make all properties optional recursively
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/**
 * Make specific properties required
 */
export type RequireFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

/**
 * Make specific properties optional
 */
export type OptionalFields<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

/**
 * Extract the values of an object type
 */
export type ValueOf<T> = T[keyof T];

/**
 * Create a union of all possible dot-notation paths through an object
 */
export type PathsToStringProps<T> = T extends string
  ? []
  : {
      [K in Extract<keyof T, string>]: [K, ...PathsToStringProps<T[K]>];
    }[Extract<keyof T, string>];

/**
 * Convert a tuple type to a dot-notation string
 */
export type Join<T extends string[], D extends string = '.'> = T extends readonly [
  infer F,
  ...infer R
]
  ? F extends string
    ? string extends F
      ? string
      : R extends readonly string[]
      ? `${F}${'' extends Join<R, D> ? '' : D}${Join<R, D>}`
      : never
    : never
  : '';

/**
 * Get dot-notation paths to all string properties
 */
export type DotNotationPaths<T> = Join<PathsToStringProps<T>>;

// ============================================================================
// Generic Response Types
// ============================================================================

/**
 * Standard success response
 */
export interface SuccessResponse<T = any> {
  success: true;
  data: T;
  message?: string;
  timestamp: string;
}

/**
 * Standard error response
 */
export interface ErrorResponse {
  success: false;
  error: string;
  code?: string;
  details?: Record<string, any>;
  timestamp: string;
}

/**
 * Union of success and error responses
 */
export type ApiResult<T = any> = SuccessResponse<T> | ErrorResponse;

/**
 * Async result type
 */
export type AsyncResult<T, E = Error> = Promise<
  | { success: true; data: T }
  | { success: false; error: E; message?: string }
>;

// ============================================================================
// Common Enums
// ============================================================================

/**
 * Environment types
 */
export enum Environment {
  DEVELOPMENT = 'development',
  STAGING = 'staging',
  PRODUCTION = 'production',
  TEST = 'test'
}

/**
 * Log levels
 */
export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug',
  TRACE = 'trace'
}

/**
 * Service status enumeration
 */
export enum ServiceStatus {
  HEALTHY = 'healthy',
  DEGRADED = 'degraded',
  UNHEALTHY = 'unhealthy',
  UNKNOWN = 'unknown'
}

/**
 * Priority levels
 */
export enum Priority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

// ============================================================================
// Time and Date Types
// ============================================================================

/**
 * ISO 8601 timestamp string
 */
export type ISOTimestamp = string & { readonly brand: unique symbol };

/**
 * Helper to create typed ISO timestamp
 */
export const createISOTimestamp = (timestamp: string): ISOTimestamp => 
  timestamp as ISOTimestamp;

/**
 * Unix timestamp (seconds since epoch)
 */
export type UnixTimestamp = number & { readonly brand: unique symbol };

/**
 * Helper to create typed Unix timestamp
 */
export const createUnixTimestamp = (timestamp: number): UnixTimestamp => 
  timestamp as UnixTimestamp;

/**
 * Duration in milliseconds
 */
export type Duration = number & { readonly brand: unique symbol };

/**
 * Helper to create typed duration
 */
export const createDuration = (ms: number): Duration => ms as Duration;

/**
 * Time range specification
 */
export interface TimeRange {
  start: Date | ISOTimestamp;
  end: Date | ISOTimestamp;
}

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Feature flag configuration
 */
export interface FeatureFlags {
  enableDebugMode: boolean;
  enableAnalytics: boolean;
  enableMockSolver: boolean;
  enableMetrics: boolean;
  enableDarkMode: boolean;
  enableNotifications: boolean;
  [key: string]: boolean;
}

/**
 * Rate limiting configuration
 */
export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  keyGenerator?: (req: any) => string;
}

/**
 * Retry configuration
 */
export interface RetryConfig {
  maxAttempts: number;
  baseDelay: number; // milliseconds
  maxDelay: number; // milliseconds
  backoffFactor: number;
  jitter: boolean;
}

// ============================================================================
// Event Types
// ============================================================================

/**
 * Generic event interface
 */
export interface BaseEvent {
  type: string;
  timestamp: string;
  source?: string;
  version?: string;
}

/**
 * Event handler function type
 */
export type EventHandler<T extends BaseEvent = BaseEvent> = (event: T) => void | Promise<void>;

/**
 * Event listener configuration
 */
export interface EventListenerConfig {
  once?: boolean;
  priority?: Priority;
  filter?: (event: BaseEvent) => boolean;
}

// ============================================================================
// Validation Types
// ============================================================================

/**
 * Validation rule
 */
export interface ValidationRule<T = any> {
  name: string;
  message: string;
  validate: (value: T) => boolean | Promise<boolean>;
}

/**
 * Validation result
 */
export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings?: ValidationWarning[];
}

/**
 * Validation error
 */
export interface ValidationError {
  field: string;
  rule: string;
  message: string;
  value?: any;
}

/**
 * Validation warning
 */
export interface ValidationWarning {
  field: string;
  message: string;
  value?: any;
}

// ============================================================================
// Monitoring and Metrics
// ============================================================================

/**
 * Metric data point
 */
export interface MetricDataPoint {
  timestamp: number;
  value: number;
  tags?: Record<string, string>;
}

/**
 * Time series data
 */
export interface TimeSeries {
  name: string;
  unit?: string;
  points: MetricDataPoint[];
  metadata?: Record<string, any>;
}

/**
 * Performance metrics
 */
export interface PerformanceMetrics {
  requestCount: number;
  errorCount: number;
  averageResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  throughput: number; // requests per second
  memoryUsage?: number; // bytes
  cpuUsage?: number; // percentage
}

// ============================================================================
// Cache Types
// ============================================================================

/**
 * Cache entry
 */
export interface CacheEntry<T = any> {
  key: string;
  value: T;
  expiresAt?: number;
  createdAt: number;
  hits?: number;
}

/**
 * Cache configuration
 */
export interface CacheConfig {
  ttl: number; // Time to live in milliseconds
  maxSize?: number; // Maximum number of entries
  enableStats?: boolean;
  compressionThreshold?: number; // Compress values larger than this
}

// ============================================================================
// Health Check Types
// ============================================================================

/**
 * Component health status
 */
export interface ComponentHealth {
  name: string;
  status: ServiceStatus;
  latency?: number;
  lastCheck: string;
  error?: string;
  metadata?: Record<string, any>;
}

/**
 * System health summary
 */
export interface SystemHealth {
  status: ServiceStatus;
  components: ComponentHealth[];
  uptime: number;
  version: string;
  timestamp: string;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Common HTTP status codes
 */
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  ACCEPTED: 202,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504,
} as const;

/**
 * Common time constants
 */
export const TIME = {
  SECOND: 1000,
  MINUTE: 60 * 1000,
  HOUR: 60 * 60 * 1000,
  DAY: 24 * 60 * 60 * 1000,
  WEEK: 7 * 24 * 60 * 60 * 1000,
} as const;

/**
 * Common size constants (in bytes)
 */
export const SIZE = {
  KB: 1024,
  MB: 1024 * 1024,
  GB: 1024 * 1024 * 1024,
  TB: 1024 * 1024 * 1024 * 1024,
} as const;