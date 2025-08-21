/**
 * @fileoverview JWT token management and solver authentication
 * @description Handles authentication with the coordinator service
 */

import axios, { AxiosInstance } from 'axios';
import type { AuthConfig, AuthToken, SolverConfig } from '../types/index.js';

export class AuthManager {
  private config: AuthConfig;
  private httpClient: AxiosInstance;
  private currentToken: AuthToken | null = null;

  constructor(config: SolverConfig) {
    this.config = {
      solverPrivateKey: config.solverPrivateKey,
      coordinatorUrl: config.coordinatorUrl
    };

    this.httpClient = axios.create({
      baseURL: this.config.coordinatorUrl,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }

  /**
   * Authenticate with the coordinator and get JWT token
   */
  async authenticate(): Promise<void> {
    try {
      // For now, we'll use a simple authentication mechanism
      // In production, this would involve signing a challenge with the private key
      const response = await this.httpClient.post('/auth/solver', {
        solverPrivateKey: this.config.solverPrivateKey
      });

      if (response.data && response.data.token) {
        this.currentToken = {
          token: response.data.token,
          expiresAt: Date.now() + (response.data.expiresIn * 1000) // Convert to ms
        };
      } else {
        throw new Error('Invalid authentication response');
      }
    } catch (error) {
      throw new Error(`Authentication failed: ${(error as Error).message}`);
    }
  }

  /**
   * Get current valid token, refreshing if necessary
   */
  async getToken(): Promise<AuthToken> {
    if (!this.currentToken || this.isTokenExpired()) {
      await this.authenticate();
    }

    if (!this.currentToken) {
      throw new Error('Failed to obtain authentication token');
    }

    return this.currentToken;
  }

  /**
   * Check if current token is expired
   */
  private isTokenExpired(): boolean {
    if (!this.currentToken) {
      return true;
    }

    // Add 5 minute buffer to prevent race conditions
    const bufferMs = 5 * 60 * 1000;
    return Date.now() + bufferMs >= this.currentToken.expiresAt;
  }

  /**
   * Get authenticated HTTP client
   */
  async getAuthenticatedClient(): Promise<AxiosInstance> {
    const token = await this.getToken();
    
    const client = axios.create({
      baseURL: this.config.coordinatorUrl,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token.token}`
      }
    });

    return client;
  }

  /**
   * Clear current token (force re-authentication on next request)
   */
  clearToken(): void {
    this.currentToken = null;
  }
}