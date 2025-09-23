import { Alert } from 'react-native';
import { AuthService } from './AuthService';

// Global logout function that can be called from anywhere
let globalLogoutFunction: (() => Promise<void>) | null = null;

export class ErrorHandler {
  /**
   * Set the global logout function (called from App.tsx)
   */
  static setGlobalLogout(logoutFn: () => Promise<void>) {
    globalLogoutFunction = logoutFn;
  }

  /**
   * Handle API errors, especially token expiration
   */
  static async handleApiError(error: Error, context: string = 'API request') {
    console.error(`${context} failed:`, error.message);

    // Check if it's a token expiration error
    if (error.message === 'TOKEN_EXPIRED') {
      console.log('Token expired detected, triggering logout...');
      
      if (globalLogoutFunction) {
        try {
          await globalLogoutFunction();
          Alert.alert(
            'Session Expired',
            'Your session has expired. Please log in again.',
            [{ text: 'OK' }]
          );
        } catch (logoutError) {
          console.error('Failed to logout:', logoutError);
        }
      } else {
        console.error('No global logout function set');
        Alert.alert(
          'Session Expired',
          'Your session has expired. Please restart the app and log in again.',
          [{ text: 'OK' }]
        );
      }
      return true; // Indicates that logout was handled
    }

    // For other errors, show a generic error message
    Alert.alert(
      'Error',
      `${context} failed: ${error.message}`,
      [{ text: 'OK' }]
    );
    return false; // Indicates that this was not a token expiration
  }

  /**
   * Wrap API calls to automatically handle token expiration
   */
  static async wrapApiCall<T>(
    apiCall: () => Promise<T>,
    context: string = 'API request'
  ): Promise<T | null> {
    try {
      return await apiCall();
    } catch (error) {
      const wasTokenExpired = await this.handleApiError(error as Error, context);
      return null;
    }
  }
}
