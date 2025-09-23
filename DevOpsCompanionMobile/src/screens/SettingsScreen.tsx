import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Switch,
  ScrollView,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { AuthService } from '../services/AuthService';
import { BiometricService } from '../services/BiometricService';
import { instanceCache } from '../services/InstanceCache';

interface SettingsScreenProps {
  onLogout: () => Promise<void>;
}

export default function SettingsScreen({ onLogout }: SettingsScreenProps) {
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [authMethod, setAuthMethod] = useState('');
  const [logoutModalVisible, setLogoutModalVisible] = useState(false);
  const [cacheStatus, setCacheStatus] = useState<{
    hasCachedInstances: boolean;
    cacheSize: number;
    lastUpdated: string | null;
  }>({
    hasCachedInstances: false,
    cacheSize: 0,
    lastUpdated: null,
  });

  useEffect(() => {
    checkBiometricAvailability();
    checkCacheStatus();
  }, []);

  const checkBiometricAvailability = async () => {
    try {
      const available = await BiometricService.isAvailable();
      setBiometricAvailable(available);
      
      if (available) {
        const method = await BiometricService.getAuthenticationMethodName();
        setAuthMethod(method);
      }
    } catch (error) {
      console.error('Failed to check biometric availability:', error);
    }
  };

  const checkCacheStatus = () => {
    try {
      const cachedInstances = instanceCache.getInstances();
      const hasValidCache = instanceCache.hasValidCache();
      
      setCacheStatus({
        hasCachedInstances: hasValidCache,
        cacheSize: cachedInstances ? cachedInstances.length : 0,
        lastUpdated: hasValidCache ? new Date().toLocaleString() : null,
      });
    } catch (error) {
      console.error('Failed to check cache status:', error);
    }
  };

  const handleLogout = async () => {
    console.log('SettingsScreen: Logout button pressed');
    setLogoutModalVisible(true);
  };

  const confirmLogout = async () => {
    try {
      console.log('SettingsScreen: User confirmed logout, calling onLogout...');
      setLogoutModalVisible(false);
      await onLogout();
      console.log('SettingsScreen: onLogout completed');
    } catch (error) {
      console.error('SettingsScreen: Logout failed:', error);
      Alert.alert('Error', 'Failed to logout');
    }
  };


  const handleClearCache = () => {
    Alert.alert(
      'Clear Cache',
      'Are you sure you want to clear the instance cache? This will force fresh data to be fetched on next load.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Clear Cache', 
          style: 'destructive',
          onPress: () => {
            try {
              instanceCache.clear();
              checkCacheStatus(); // Refresh cache status
              Alert.alert('Success', 'Cache cleared successfully');
            } catch (error) {
              console.error('Failed to clear cache:', error);
              Alert.alert('Error', 'Failed to clear cache');
            }
          }
        }
      ]
    );
  };

  const handleTestBiometric = async () => {
    try {
      const success = await BiometricService.authenticate('Test biometric authentication');
      Alert.alert(
        'Biometric Test',
        success ? 'Biometric authentication successful!' : 'Biometric authentication failed'
      );
    } catch (error) {
      Alert.alert('Error', 'Biometric test failed');
    }
  };


  const SettingItem = ({ 
    icon, 
    title, 
    subtitle, 
    onPress, 
    rightElement,
    danger = false 
  }: {
    icon: keyof typeof Ionicons.glyphMap;
    title: string;
    subtitle?: string;
    onPress?: () => void;
    rightElement?: React.ReactNode;
    danger?: boolean;
  }) => (
    <TouchableOpacity 
      style={styles.settingItem} 
      onPress={onPress}
      disabled={!onPress}
    >
      <View style={styles.settingLeft}>
        <View style={[styles.settingIcon, danger && styles.dangerIcon]}>
          <Ionicons 
            name={icon} 
            size={20} 
            color={danger ? '#ff3b30' : '#2563eb'} 
          />
        </View>
        <View style={styles.settingContent}>
          <Text style={[styles.settingTitle, danger && styles.dangerText]}>
            {title}
          </Text>
          {subtitle && (
            <Text style={styles.settingSubtitle}>{subtitle}</Text>
          )}
        </View>
      </View>
      {rightElement || (onPress && (
        <Ionicons name="chevron-forward" size={20} color="#999" />
      ))}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Settings</Text>
          <Text style={styles.headerSubtitle}>
            Configure your DevOps Companion
          </Text>
        </View>

        {/* Security Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Security</Text>
          
          <SettingItem
            icon="shield-checkmark"
            title="Biometric Authentication"
            subtitle={biometricAvailable ? `${authMethod} available` : 'Not available on this device'}
            rightElement={
              <Switch
                value={biometricEnabled}
                onValueChange={setBiometricEnabled}
                disabled={!biometricAvailable}
                trackColor={{ false: '#e5e7eb', true: '#dbeafe' }}
                thumbColor={biometricEnabled ? '#2563eb' : '#f3f4f6'}
              />
            }
          />

          {biometricAvailable && (
            <SettingItem
              icon="finger-print"
              title="Test Biometric"
              subtitle="Test your biometric authentication"
              onPress={handleTestBiometric}
            />
          )}
        </View>

        {/* Cache Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Cache Status</Text>
          
          <View style={styles.cacheStatusCard}>
            <View style={styles.cacheStatusHeader}>
              <Ionicons 
                name={cacheStatus.hasCachedInstances ? "checkmark-circle" : "close-circle"} 
                size={20} 
                color={cacheStatus.hasCachedInstances ? "#10b981" : "#ef4444"} 
              />
              <Text style={styles.cacheStatusTitle}>
                {cacheStatus.hasCachedInstances ? 'Cache Active' : 'No Cache'}
              </Text>
            </View>
            
            <View style={styles.cacheStatusDetails}>
              <Text style={styles.cacheStatusDetail}>
                <Text style={styles.cacheStatusLabel}>Instances:</Text> {cacheStatus.cacheSize}
              </Text>
              {cacheStatus.lastUpdated && (
                <Text style={styles.cacheStatusDetail}>
                  <Text style={styles.cacheStatusLabel}>Last Updated:</Text> {cacheStatus.lastUpdated}
                </Text>
              )}
            </View>
          </View>

          <SettingItem
            icon="refresh"
            title="Refresh Cache Status"
            subtitle="Update cache information"
            onPress={checkCacheStatus}
          />
          
          <SettingItem
            icon="trash"
            title="Clear Cache"
            subtitle="Remove all cached instance data"
            onPress={handleClearCache}
            danger={true}
          />
        </View>

        {/* Data Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Data</Text>
          
          {/* Cache management moved to Cache Status section above */}
        </View>

        {/* About Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          
          <SettingItem
            icon="information-circle"
            title="App Version"
            subtitle="1.0.0"
          />
          
          <SettingItem
            icon="code-slash"
            title="Backend API"
            subtitle="http://127.0.0.1:8000"
          />
          
          <SettingItem
            icon="rocket"
            title="DevOps Companion"
            subtitle="Mobile DevOps Management Platform"
          />
        </View>

        {/* Logout Section */}
        <View style={styles.section}>
          <SettingItem
            icon="log-out"
            title="Logout"
            subtitle="Sign out of your account"
            onPress={handleLogout}
            danger={true}
          />
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            DevOps Companion Mobile
          </Text>
          <Text style={styles.footerSubtext}>
            AWS Lightsail • Google Kubernetes Engine
          </Text>
        </View>
      </ScrollView>

      {/* Logout Confirmation Modal */}
      <Modal
        visible={logoutModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setLogoutModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Ionicons name="log-out" size={24} color="#ff3b30" />
              <Text style={styles.modalTitle}>Logout</Text>
            </View>
            
            <View style={styles.modalBody}>
              <Text style={styles.modalMessage}>
                Are you sure you want to logout?
              </Text>
            </View>
            
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setLogoutModalVisible(false)}
              >
                <Text style={styles.modalCancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.modalConfirmButton}
                onPress={confirmLogout}
              >
                <Text style={styles.modalConfirmButtonText}>Logout</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    padding: 24,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#666',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
    paddingHorizontal: 24,
  },
  settingItem: {
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f9ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  dangerIcon: {
    backgroundColor: '#fef2f2',
  },
  settingContent: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 2,
  },
  dangerText: {
    color: '#ff3b30',
  },
  settingSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 24,
  },
  footerText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  footerSubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 0,
    width: '80%',
    maxWidth: 400,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginLeft: 12,
  },
  modalBody: {
    padding: 20,
  },
  modalMessage: {
    fontSize: 16,
    color: '#666',
    lineHeight: 24,
  },
  modalActions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: '#f0f0f0',
  },
  modalCancelButtonText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  modalConfirmButton: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
  },
  modalConfirmButtonText: {
    fontSize: 16,
    color: '#ff3b30',
    fontWeight: '600',
  },
  cacheStatusCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  cacheStatusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  cacheStatusTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginLeft: 8,
  },
  cacheStatusDetails: {
    gap: 8,
  },
  cacheStatusDetail: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  cacheStatusLabel: {
    fontWeight: '500',
    color: '#374151',
  },
});
