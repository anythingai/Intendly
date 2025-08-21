/**
 * @fileoverview API client for backend integration
 * @description HTTP client for communicating with the relayer and coordinator services
 */

import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { 
  ApiResponse, 
  ApiError, 
  CreateIntentRequest, 
  CreateIntentResponse,
  GetIntentResponse,
  SubmitBidRequest,
  SubmitBidResponse,
  GetBestBidResponse,
  HealthCheckResponse,
  PaginatedResponse,
  PaginationQuery
} from '../../types/index.js';

// ============================================================================
// API Configuration
// ============================================================================

export interface ApiClientConfig {
  baseURL: string;
  timeout?: number;
  retries?: number;
  retryDelay?: number;
  headers?: Record<string, string>;
}

const DEFAULT_CONFIG: Required<Omit<ApiClientConfig, 'baseURL'>> = {
  timeout: 30000, // 30 seconds
  retries: 3,
  retryDelay: 1000, // 1 second
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
};

// ============================================================================
// API Client Class
// ============================================================================

export class ApiClient {
  private client: AxiosInstance;
  private config: Required<ApiClientConfig>;

  constructor(config: ApiClientConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.client = this.createAxiosInstance();
  }

  private createAxiosInstance(): AxiosInstance {
    const instance = axios.create({
      baseURL: this.config.baseURL,
      timeout: this.config.timeout,
      headers: this.config.headers
    });

    // Request interceptor
    instance.interceptors.request.use(
      (config) => {
        // Add timestamp to prevent caching
        if (config.method === 'get') {
          config.params = {
            ...config.params,
            _t: Date.now()
          };
        }
        
        // Add user agent for tracking
        config.headers['User-Agent'] = 'IntentTrading-Frontend/1.0.0';
        
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor
    instance.interceptors.response.use(
      (response) => response,
      async (error) => {
        const { config, response } = error;
        
        // Don't retry if we've already retried too many times
        if (!config || config.__retryCount >= this.config.retries) {
          return Promise.reject(this.formatError(error));
        }
        
        // Don't retry for 4xx errors (client errors)
        if (response?.status >= 400 && response?.status < 500) {
          return Promise.reject(this.formatError(error));
        }
        
        // Retry for network errors or 5xx errors
        config.__retryCount = (config.__retryCount || 0) + 1;
        
        await this.delay(this.config.retryDelay * config.__retryCount);
        return instance(config);
      }
    );

    return instance;
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private formatError(error: any): ApiError {
    if (error.response?.data) {
      return error.response.data;
    }
    
    return {
      status: 'error',
      message: error.message || 'Network error occurred',
      code: error.code || 'NETWORK_ERROR',
      timestamp: new Date().toISOString()
    };
  }

  // ============================================================================
  // Generic HTTP Methods
  // ============================================================================

  private async request<T>(config: AxiosRequestConfig): Promise<T> {
    try {
      const response: AxiosResponse<ApiResponse<T>> = await this.client(config);
      
      if (response.data.status === 'error') {
        throw response.data;
      }
      
      return response.data.data as T;
    } catch (error) {
      throw this.formatError(error);
    }
  }

  async get<T>(url: string, params?: any): Promise<T> {
    return this.request<T>({ method: 'GET', url, params });
  }

  async post<T>(url: string, data?: any): Promise<T> {
    return this.request<T>({ method: 'POST', url, data });
  }

  async put<T>(url: string, data?: any): Promise<T> {
    return this.request<T>({ method: 'PUT', url, data });
  }

  async delete<T>(url: string): Promise<T> {
    return this.request<T>({ method: 'DELETE', url });
  }

  // ============================================================================
  // Intent API Methods
  // ============================================================================

  /**
   * Create a new intent
   */
  async createIntent(request: CreateIntentRequest): Promise<CreateIntentResponse> {
    return this.post<CreateIntentResponse>('/api/intents', request);
  }

  /**
   * Get intent by hash
   */
  async getIntent(intentHash: string): Promise<GetIntentResponse> {
    return this.get<GetIntentResponse>(`/api/intents/${intentHash}`);
  }

  /**
   * Get intent status
   */
  async getIntentStatus(intentHash: string): Promise<{ status: string; updatedAt: string }> {
    return this.get(`/api/intents/${intentHash}/status`);
  }

  /**
   * Cancel an intent
   */
  async cancelIntent(intentHash: string): Promise<{ success: boolean }> {
    return this.post(`/api/intents/${intentHash}/cancel`);
  }

  /**
   * Get user's intent history
   */
  async getUserIntents(
    userAddress: string, 
    pagination?: PaginationQuery
  ): Promise<PaginatedResponse<GetIntentResponse>> {
    return this.get(`/api/users/${userAddress}/intents`, pagination);
  }

  // ============================================================================
  // Bid API Methods
  // ============================================================================

  /**
   * Submit a bid for an intent
   */
  async submitBid(request: SubmitBidRequest): Promise<SubmitBidResponse> {
    return this.post<SubmitBidResponse>('/api/bids', request);
  }

  /**
   * Get best bid for an intent
   */
  async getBestBid(intentHash: string): Promise<GetBestBidResponse> {
    return this.get<GetBestBidResponse>(`/api/intents/${intentHash}/best-bid`);
  }

  /**
   * Get all bids for an intent
   */
  async getIntentBids(intentHash: string): Promise<SubmitBidResponse[]> {
    return this.get(`/api/intents/${intentHash}/bids`);
  }

  /**
   * Get bid rankings for an intent
   */
  async getBidRankings(intentHash: string): Promise<any[]> {
    return this.get(`/api/intents/${intentHash}/rankings`);
  }

  // ============================================================================
  // Analytics API Methods
  // ============================================================================

  /**
   * Get system metrics
   */
  async getMetrics(): Promise<any> {
    return this.get('/api/metrics');
  }

  /**
   * Get trading statistics
   */
  async getTradingStats(): Promise<any> {
    return this.get('/api/stats/trading');
  }

  /**
   * Get solver performance
   */
  async getSolverStats(): Promise<any> {
    return this.get('/api/stats/solvers');
  }

  /**
   * Get market data
   */
  async getMarketData(): Promise<any> {
    return this.get('/api/market');
  }

  // ============================================================================
  // Token API Methods
  // ============================================================================

  /**
   * Get token list
   */
  async getTokenList(chainId?: number): Promise<any[]> {
    return this.get('/api/tokens', { chainId });
  }

  /**
   * Get token info
   */
  async getTokenInfo(address: string, chainId?: number): Promise<any> {
    return this.get(`/api/tokens/${address}`, { chainId });
  }

  /**
   * Search tokens
   */
  async searchTokens(query: string, chainId?: number): Promise<any[]> {
    return this.get('/api/tokens/search', { query, chainId });
  }

  // ============================================================================
  // Health and Status Methods
  // ============================================================================

  /**
   * Health check
   */
  async healthCheck(): Promise<HealthCheckResponse> {
    return this.get<HealthCheckResponse>('/api/health');
  }

  /**
   * Get server status
   */
  async getStatus(): Promise<any> {
    return this.get('/api/status');
  }

  /**
   * Get API version
   */
  async getVersion(): Promise<{ version: string; buildTime: string }> {
    return this.get('/api/version');
  }
}

// ============================================================================
// Default API Client Instance
// ============================================================================

const apiConfig: ApiClientConfig = {
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
  timeout: 30000,
  retries: 3,
  retryDelay: 1000
};

export const apiClient = new ApiClient(apiConfig);

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Create a custom API client with different configuration
 */
export const createApiClient = (config: ApiClientConfig): ApiClient => {
  return new ApiClient(config);
};

/**
 * Check if error is an API error
 */
export const isApiError = (error: any): error is ApiError => {
  return error && typeof error === 'object' && error.status === 'error';
};

/**
 * Extract error message from API error
 */
export const getErrorMessage = (error: any): string => {
  if (isApiError(error)) {
    return error.message;
  }
  
  if (error instanceof Error) {
    return error.message;
  }
  
  return 'An unknown error occurred';
};

/**
 * Check if API is available
 */
export const checkApiAvailability = async (): Promise<boolean> => {
  try {
    await apiClient.healthCheck();
    return true;
  } catch (error) {
    console.warn('API not available:', getErrorMessage(error));
    return false;
  }
};

// ============================================================================
// Error Handling Utilities
// ============================================================================

export class ApiClientError extends Error {
  constructor(
    message: string,
    public code: string,
    public status?: number,
    public details?: any
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

export class NetworkError extends ApiClientError {
  constructor(message: string = 'Network connection failed') {
    super(message, 'NETWORK_ERROR');
  }
}

export class TimeoutError extends ApiClientError {
  constructor(message: string = 'Request timeout') {
    super(message, 'TIMEOUT_ERROR');
  }
}

export class ValidationError extends ApiClientError {
  constructor(message: string, errors: any[]) {
    super(message, 'VALIDATION_ERROR', 400, { errors });
  }
}

export class NotFoundError extends ApiClientError {
  constructor(resource: string) {
    super(`${resource} not found`, 'NOT_FOUND_ERROR', 404);
  }
}

export class UnauthorizedError extends ApiClientError {
  constructor(message: string = 'Unauthorized access') {
    super(message, 'UNAUTHORIZED_ERROR', 401);
  }
}

export class ServerError extends ApiClientError {
  constructor(message: string = 'Internal server error') {
    super(message, 'SERVER_ERROR', 500);
  }
}