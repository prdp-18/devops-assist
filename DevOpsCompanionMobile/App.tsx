import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

// Import screens
import LoginScreen from './src/screens/LoginScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import AWSInstancesScreen from './src/screens/AWSInstancesScreen';
import GKEClustersScreen from './src/screens/GKEClustersScreen';
import SettingsScreen from './src/screens/SettingsScreen';

// Import services
import { AuthService } from './src/services/AuthService';
import { BiometricService } from './src/services/BiometricService';
import { ErrorHandler } from './src/services/ErrorHandler';

// Types
type RootStackParamList = {
  Login: undefined;
  MainTabs: undefined;
};

type TabParamList = {
  Dashboard: undefined;
  AWS: undefined;
  GKE: undefined;
  Settings: undefined;
};

const Stack = createStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

interface MainTabsProps {
  onLogout: () => Promise<void>;
}

function MainTabs({ onLogout }: MainTabsProps) {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap;

          if (route.name === 'Dashboard') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'AWS') {
            iconName = focused ? 'cloud' : 'cloud-outline';
          } else if (route.name === 'GKE') {
            iconName = focused ? 'cube' : 'cube-outline';
          } else if (route.name === 'Settings') {
            iconName = focused ? 'settings' : 'settings-outline';
          } else {
            iconName = 'help-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#2563eb',
        tabBarInactiveTintColor: 'gray',
        headerStyle: {
          backgroundColor: '#2563eb',
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      })}
    >
      <Tab.Screen 
        name="Dashboard" 
        options={{ title: 'Dashboard' }}
      >
        {(props) => <DashboardScreen {...props} />}
      </Tab.Screen>
      <Tab.Screen 
        name="AWS" 
        component={AWSInstancesScreen}
        options={{ title: 'AWS Lightsail' }}
      />
      <Tab.Screen 
        name="GKE" 
        component={GKEClustersScreen}
        options={{ title: 'GKE Clusters' }}
      />
      <Tab.Screen 
        name="Settings" 
        options={{ title: 'Settings' }}
      >
        {(props) => <SettingsScreen {...props} onLogout={onLogout} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
}

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // console.log('App component rendering, isLoading:', isLoading, 'isAuthenticated:', isAuthenticated);

  useEffect(() => {
    checkAuthentication();
    // Register global logout function for error handling
    ErrorHandler.setGlobalLogout(handleLogout);
  }, []);

  const checkAuthentication = async () => {
    try {
      console.log('Checking authentication...');
      const token = await AuthService.getStoredToken();
      console.log('Token found:', !!token);
      
      if (token) {
        // Verify token is still valid with strict validation
        console.log('Verifying token validity with strict checks...');
        const isValid = await AuthService.verifyToken(token);
        console.log('Token valid:', isValid);
        
        if (isValid) {
          setIsAuthenticated(true);
          console.log('User authenticated successfully');
        } else {
          console.log('Token expired or invalid, clearing stored token');
          await AuthService.clearStoredToken();
          setIsAuthenticated(false);
        }
      } else {
        console.log('No token found, user not authenticated');
        setIsAuthenticated(false);
      }
    } catch (error) {
      console.error('Authentication check failed:', error);
      // If verification fails, clear token and show login
      console.log('Clearing token due to verification error');
      await AuthService.clearStoredToken();
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async (username: string, password: string) => {
    try {
      const token = await AuthService.login(username, password);
      if (token) {
        setIsAuthenticated(true);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Login failed:', error);
      return false;
    }
  };

  const handleLogout = async () => {
    try {
      console.log('Logout initiated...');
      await AuthService.logout();
      console.log('Token cleared, setting isAuthenticated to false');
      setIsAuthenticated(false);
      console.log('Logout completed successfully');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaProvider>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f5f5f5' }}>
          <Text style={{ fontSize: 18, color: '#666' }}>Loading DevOps Companion...</Text>
        </View>
      </SafeAreaProvider>
    );
  }

  // console.log('Showing main app, isAuthenticated:', isAuthenticated);

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <StatusBar style="light" />
        {isAuthenticated ? (
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="MainTabs">
              {(props) => <MainTabs {...props} onLogout={handleLogout} />}
            </Stack.Screen>
          </Stack.Navigator>
        ) : (
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="Login">
              {(props) => (
                <LoginScreen 
                  {...props} 
                  onLogin={handleLogin}
                />
              )}
            </Stack.Screen>
          </Stack.Navigator>
        )}
      </NavigationContainer>
    </SafeAreaProvider>
  );
}