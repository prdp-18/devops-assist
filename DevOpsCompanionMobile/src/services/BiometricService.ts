import * as LocalAuthentication from 'expo-local-authentication';

export class BiometricService {
  /**
   * Check if biometric authentication is available
   */
  static async isAvailable(): Promise<boolean> {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      return hasHardware && isEnrolled;
    } catch (error) {
      console.error('Biometric availability check failed:', error);
      return false;
    }
  }

  /**
   * Get available authentication types
   */
  static async getAvailableTypes(): Promise<LocalAuthentication.AuthenticationType[]> {
    try {
      return await LocalAuthentication.supportedAuthenticationTypesAsync();
    } catch (error) {
      console.error('Failed to get authentication types:', error);
      return [];
    }
  }

  /**
   * Authenticate with biometrics
   */
  static async authenticate(
    reason: string = 'Authenticate to perform critical action'
  ): Promise<boolean> {
    try {
      const isAvailable = await this.isAvailable();
      if (!isAvailable) {
        throw new Error('Biometric authentication not available');
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: reason,
        cancelLabel: 'Cancel',
        fallbackLabel: 'Use Passcode',
        disableDeviceFallback: false,
      });

      return result.success;
    } catch (error) {
      console.error('Biometric authentication failed:', error);
      return false;
    }
  }

  /**
   * Authenticate for critical DevOps operations
   */
  static async authenticateForCriticalAction(action: string): Promise<boolean> {
    const reason = `Confirm ${action} operation`;
    return await this.authenticate(reason);
  }

  /**
   * Check if Face ID is available (iOS)
   */
  static async isFaceIDAvailable(): Promise<boolean> {
    try {
      const types = await this.getAvailableTypes();
      return types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION);
    } catch (error) {
      console.error('Face ID check failed:', error);
      return false;
    }
  }

  /**
   * Check if Touch ID is available (iOS) or Fingerprint (Android)
   */
  static async isTouchIDAvailable(): Promise<boolean> {
    try {
      const types = await this.getAvailableTypes();
      return types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT);
    } catch (error) {
      console.error('Touch ID check failed:', error);
      return false;
    }
  }

  /**
   * Get user-friendly authentication method name
   */
  static async getAuthenticationMethodName(): Promise<string> {
    try {
      const isFaceID = await this.isFaceIDAvailable();
      const isTouchID = await this.isTouchIDAvailable();

      if (isFaceID) {
        return 'Face ID';
      } else if (isTouchID) {
        return 'Touch ID';
      } else {
        return 'Biometric';
      }
    } catch (error) {
      console.error('Failed to get authentication method name:', error);
      return 'Biometric';
    }
  }
}
