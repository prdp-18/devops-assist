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
   * Verify if token is still valid
   */
  static async verifyToken(token: string): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE_URL}/health`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      return response.ok;
    } catch (error) {
      console.error('Token verification failed:', error);
      return false;
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
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`API request failed: ${response.status} ${response.statusText}`, errorText);
      throw new Error(`Failed to fetch ${endpoint.split('/').pop()}: ${response.status}`);
    }

    return response.json();
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
