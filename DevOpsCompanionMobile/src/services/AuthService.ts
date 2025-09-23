import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// Use different URLs based on platform
const API_BASE_URL = Platform.OS === 'web' 
  ? 'http://127.0.0.1:8000'  // Web uses localhost
  : 'http://100.72.113.113:8000';  // Mobile uses Tailscale IP address
const TOKEN_KEY = 'devops_companion_token';

// Web-compatible storage functions
const isWeb = Platform.OS === 'web';

const webStorage = {
  async setItem(key: string, value: string): Promise<void> {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, value);
    }
  },
  
  async getItem(key: string): Promise<string | null> {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(key);
    }
    return null;
  },
  
  async removeItem(key: string): Promise<void> {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(key);
    }
  }
};

export class AuthService {
  /**
   * Login with username and password
   */
  static async login(username: string, password: string): Promise<string | null> {
    try {
      console.log('AuthService: Attempting login to:', `${API_BASE_URL}/token`);
      console.log('AuthService: Username:', username);
      
      const response = await fetch(`${API_BASE_URL}/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`,
      });

      console.log('AuthService: Response status:', response.status);
      console.log('AuthService: Response ok:', response.ok);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('AuthService: Login failed with status:', response.status, 'Error:', errorText);
        throw new Error(`Login failed: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      console.log('AuthService: Login successful, token received');
      
      const token = data.access_token;

      if (token) {
        await this.storeToken(token);
        console.log('AuthService: Token stored successfully');
        return token;
      }

      console.error('AuthService: No token in response');
      return null;
    } catch (error) {
      console.error('AuthService: Login error:', error);
      throw error;
    }
  }

  /**
   * Store JWT token securely
   */
  static async storeToken(token: string): Promise<void> {
    try {
      if (isWeb) {
        await webStorage.setItem(TOKEN_KEY, token);
      } else {
        await SecureStore.setItemAsync(TOKEN_KEY, token);
      }
    } catch (error) {
      console.error('Failed to store token:', error);
      throw error;
    }
  }

  /**
   * Get stored JWT token
   */
  static async getStoredToken(): Promise<string | null> {
    try {
      if (isWeb) {
        return await webStorage.getItem(TOKEN_KEY);
      } else {
        return await SecureStore.getItemAsync(TOKEN_KEY);
      }
    } catch (error) {
      console.error('Failed to get stored token:', error);
      return null;
    }
  }

  /**
   * Clear stored token
   */
  static async clearStoredToken(): Promise<void> {
    try {
      if (isWeb) {
        await webStorage.removeItem(TOKEN_KEY);
      } else {
        await SecureStore.deleteItemAsync(TOKEN_KEY);
      }
    } catch (error) {
      console.error('Failed to clear token:', error);
    }
  }

  /**
   * Verify if token is still valid by checking JWT expiration and making API call
   */
  static async verifyToken(token: string): Promise<boolean> {
    try {
      // First, check if token is a valid JWT format and not expired
      if (!this.isValidJWTFormat(token)) {
        return false;
      }

      // Check if JWT is expired locally (without API call)
      if (this.isJWTExpired(token)) {
        return false;
      }

      // If JWT looks valid, make an API call to verify with server
      const response = await fetch(`${API_BASE_URL}/api/gcp/clusters`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      // Only consider token valid if we get 200 (success)
      const isValid = response.ok && response.status === 200;
      
      return isValid;
    } catch (error) {
      console.error('Token verification failed:', error);
      return false;
    }
  }

  /**
   * Check if token is a valid JWT format
   */
  private static isValidJWTFormat(token: string): boolean {
    try {
      // JWT should have 3 parts separated by dots
      const parts = token.split('.');
      if (parts.length !== 3) {
        return false;
      }

      // Each part should be base64 encoded
      for (const part of parts) {
        if (!part || part.length === 0) {
          return false;
        }
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if JWT token is expired locally
   */
  private static isJWTExpired(token: string): boolean {
    try {
      // Decode JWT payload (second part)
      const parts = token.split('.');
      if (parts.length !== 3) {
        return true; // Invalid format, consider expired
      }

      // Decode base64 payload
      const payload = JSON.parse(atob(parts[1]));
      
      // Check if token has expiration
      if (!payload.exp) {
        return true; // No expiration, consider expired
      }

      // Check if token is expired
      const currentTime = Math.floor(Date.now() / 1000);
      const isExpired = payload.exp < currentTime;
      
      return isExpired;
    } catch (error) {
      console.error('Error checking JWT expiration:', error);
      return true; // If we can't parse, consider expired
    }
  }

  /**
   * Make authenticated API request
   */
  static async authenticatedRequest(
    endpoint: string,
    method: string = 'GET',
    body?: any
  ): Promise<any> {
    const token = await this.getStoredToken();
    
    if (!token) {
      throw new Error('No authentication token found');
    }

    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };

    const options: RequestInit = {
      method,
      headers,
    };

    if (body && method !== 'GET') {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
    
    console.log('AuthService: Raw response received:', {
      status: response.status,
      ok: response.ok,
      url: response.url,
      headers: Object.fromEntries(response.headers.entries())
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`API request failed: ${response.status} ${response.statusText}`, errorText);
      
      // If we get a 401 Unauthorized, the token is invalid/expired
      if (response.status === 401) {
        console.log('Token expired or invalid (401), clearing stored token');
        await this.clearStoredToken();
        // Throw a specific error that can be caught by the app
        throw new Error('TOKEN_EXPIRED');
      }
      
      throw new Error(`Failed to fetch ${endpoint.split('/').pop()}: ${response.status}`);
    }

    const jsonData = await response.json();
    console.log('AuthService: Parsed JSON data:', jsonData);
    return jsonData;
  }

  /**
   * Logout user
   */
  static async logout(): Promise<void> {
    await this.clearStoredToken();
  }

  /**
   * Check if user is authenticated
   */
  static async isAuthenticated(): Promise<boolean> {
    const token = await this.getStoredToken();
    if (!token) return false;
    
    return await this.verifyToken(token);
  }
}
