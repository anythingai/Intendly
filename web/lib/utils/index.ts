/**
 * @fileoverview Utility functions for the frontend application
 * @description Common utility functions used throughout the app
 */

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// ============================================================================
// UI Utilities
// ============================================================================

/**
 * Combine and merge CSS classes with Tailwind conflict resolution
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Generate a random ID
 */
export function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

/**
 * Debounce function calls
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

/**
 * Throttle function calls
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

// ============================================================================
// Number Formatting
// ============================================================================

/**
 * Format a number with appropriate decimal places
 */
export function formatNumber(
  value: number | string,
  options: {
    decimals?: number;
    compact?: boolean;
    currency?: string;
    percentage?: boolean;
  } = {}
): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  
  if (isNaN(num)) return '0';
  
  const { decimals = 2, compact = false, currency, percentage = false } = options;
  
  if (percentage) {
    return new Intl.NumberFormat('en-US', {
      style: 'percent',
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    }).format(num / 100);
  }
  
  if (currency) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
      notation: compact ? 'compact' : 'standard'
    }).format(num);
  }
  
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    notation: compact ? 'compact' : 'standard'
  }).format(num);
}

/**
 * Format token amount with proper decimals
 */
export function formatTokenAmount(
  amount: string | number | bigint,
  decimals: number = 18,
  displayDecimals: number = 4
): string {
  let value: bigint;
  
  if (typeof amount === 'bigint') {
    value = amount;
  } else if (typeof amount === 'string') {
    value = BigInt(amount);
  } else {
    value = BigInt(Math.floor(amount));
  }
  
  const divisor = BigInt(10 ** decimals);
  const quotient = value / divisor;
  const remainder = value % divisor;
  
  const integerPart = quotient.toString();
  const fractionalPart = remainder.toString().padStart(decimals, '0');
  
  let result = integerPart;
  
  if (displayDecimals > 0 && remainder > 0n) {
    const truncatedFractional = fractionalPart.substring(0, displayDecimals);
    const trimmedFractional = truncatedFractional.replace(/0+$/, '');
    
    if (trimmedFractional.length > 0) {
      result += `.${trimmedFractional}`;
    }
  }
  
  return result;
}

/**
 * Parse token amount to BigInt
 */
export function parseTokenAmount(amount: string, decimals: number = 18): bigint {
  if (!amount || amount === '0') return 0n;
  
  const [integerPart, fractionalPart = ''] = amount.split('.');
  const paddedFractional = fractionalPart.padEnd(decimals, '0').substring(0, decimals);
  
  const value = integerPart + paddedFractional;
  return BigInt(value);
}

/**
 * Format large numbers with K, M, B suffixes
 */
export function formatCompactNumber(value: number): string {
  const formatter = new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 2
  });
  
  return formatter.format(value);
}

// ============================================================================
// Time Utilities
// ============================================================================

/**
 * Format time duration
 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${Math.floor(seconds)}s`;
  } else if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
  } else if (seconds < 86400) {
    const hours = Math.floor(seconds / 3600);
    const remainingMinutes = Math.floor((seconds % 3600) / 60);
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
  } else {
    const days = Math.floor(seconds / 86400);
    const remainingHours = Math.floor((seconds % 86400) / 3600);
    return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
  }
}

/**
 * Format relative time (e.g., "2 minutes ago")
 */
export function formatRelativeTime(timestamp: number | Date): string {
  const date = typeof timestamp === 'number' ? new Date(timestamp) : timestamp;
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (diffInSeconds < 60) {
    return `${diffInSeconds}s ago`;
  } else if (diffInSeconds < 3600) {
    const minutes = Math.floor(diffInSeconds / 60);
    return `${minutes}m ago`;
  } else if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600);
    return `${hours}h ago`;
  } else {
    const days = Math.floor(diffInSeconds / 86400);
    return `${days}d ago`;
  }
}

/**
 * Format timestamp to readable date
 */
export function formatDate(
  timestamp: number | Date | string,
  options: Intl.DateTimeFormatOptions = {}
): string {
  let date: Date;
  
  if (typeof timestamp === 'string') {
    date = new Date(timestamp);
  } else if (typeof timestamp === 'number') {
    // Handle both milliseconds and seconds timestamps
    date = new Date(timestamp > 1e10 ? timestamp : timestamp * 1000);
  } else {
    date = timestamp;
  }
  
  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short'
  };
  
  return date.toLocaleDateString('en-US', { ...defaultOptions, ...options });
}

// ============================================================================
// Address Utilities
// ============================================================================

/**
 * Truncate an Ethereum address
 */
export function truncateAddress(
  address: string,
  startLength: number = 6,
  endLength: number = 4
): string {
  if (!address || address.length < startLength + endLength) {
    return address;
  }
  
  return `${address.substring(0, startLength)}...${address.substring(address.length - endLength)}`;
}

/**
 * Validate Ethereum address format
 */
export function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * Normalize address to lowercase
 */
export function normalizeAddress(address: string): string {
  return address.toLowerCase();
}

// ============================================================================
// String Utilities
// ============================================================================

/**
 * Capitalize first letter of a string
 */
export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Convert string to title case
 */
export function toTitleCase(str: string): string {
  return str.split(' ').map(capitalize).join(' ');
}

/**
 * Truncate string with ellipsis
 */
export function truncateString(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength - 3) + '...';
}

// ============================================================================
// Object Utilities
// ============================================================================

/**
 * Deep clone an object
 */
export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return new Date(obj.getTime()) as any;
  if (obj instanceof Array) return obj.map(item => deepClone(item)) as any;
  if (typeof obj === 'object') {
    const clonedObj = {} as any;
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        clonedObj[key] = deepClone(obj[key]);
      }
    }
    return clonedObj;
  }
  return obj;
}

/**
 * Pick specific properties from an object
 */
export function pick<T extends object, K extends keyof T>(
  obj: T,
  keys: K[]
): Pick<T, K> {
  const result = {} as Pick<T, K>;
  keys.forEach(key => {
    if (key in obj) {
      result[key] = obj[key];
    }
  });
  return result;
}

/**
 * Omit specific properties from an object
 */
export function omit<T extends object, K extends keyof T>(
  obj: T,
  keys: K[]
): Omit<T, K> {
  const result = { ...obj };
  keys.forEach(key => {
    delete result[key];
  });
  return result;
}

// ============================================================================
// Array Utilities
// ============================================================================

/**
 * Remove duplicates from array
 */
export function unique<T>(array: T[]): T[] {
  return [...new Set(array)];
}

/**
 * Group array items by a key
 */
export function groupBy<T, K extends keyof T>(
  array: T[],
  key: K
): Record<string, T[]> {
  return array.reduce((groups, item) => {
    const groupKey = String(item[key]);
    if (!groups[groupKey]) {
      groups[groupKey] = [];
    }
    groups[groupKey].push(item);
    return groups;
  }, {} as Record<string, T[]>);
}

/**
 * Sort array by multiple criteria
 */
export function sortBy<T>(
  array: T[],
  ...criteria: Array<keyof T | ((item: T) => any)>
): T[] {
  return [...array].sort((a, b) => {
    for (const criterion of criteria) {
      let aVal: any, bVal: any;
      
      if (typeof criterion === 'function') {
        aVal = criterion(a);
        bVal = criterion(b);
      } else {
        aVal = a[criterion];
        bVal = b[criterion];
      }
      
      if (aVal < bVal) return -1;
      if (aVal > bVal) return 1;
    }
    return 0;
  });
}

// ============================================================================
// Storage Utilities
// ============================================================================

/**
 * Safe localStorage wrapper
 */
export const storage = {
  get<T>(key: string, defaultValue?: T): T | null {
    if (typeof window === 'undefined') return defaultValue || null;
    
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue || null;
    } catch {
      return defaultValue || null;
    }
  },
  
  set(key: string, value: any): void {
    if (typeof window === 'undefined') return;
    
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Ignore storage errors
    }
  },
  
  remove(key: string): void {
    if (typeof window === 'undefined') return;
    
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Ignore storage errors
    }
  },
  
  clear(): void {
    if (typeof window === 'undefined') return;
    
    try {
      window.localStorage.clear();
    } catch {
      // Ignore storage errors
    }
  }
};

// ============================================================================
// Error Handling
// ============================================================================

/**
 * Safe JSON parse with error handling
 */
export function safeJsonParse<T>(json: string, defaultValue: T): T {
  try {
    return JSON.parse(json);
  } catch {
    return defaultValue;
  }
}

/**
 * Retry function with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: {
    retries?: number;
    delay?: number;
    backoff?: number;
  } = {}
): Promise<T> {
  const { retries = 3, delay = 1000, backoff = 2 } = options;
  
  let lastError: Error;
  
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      if (i === retries) {
        throw lastError;
      }
      
      await new Promise(resolve => 
        setTimeout(resolve, delay * Math.pow(backoff, i))
      );
    }
  }
  
  throw lastError!;
}

// ============================================================================
// Environment Detection
// ============================================================================

export const env = {
  isDevelopment: process.env.NODE_ENV === 'development',
  isProduction: process.env.NODE_ENV === 'production',
  isTest: process.env.NODE_ENV === 'test',
  isBrowser: typeof window !== 'undefined',
  isServer: typeof window === 'undefined'
};