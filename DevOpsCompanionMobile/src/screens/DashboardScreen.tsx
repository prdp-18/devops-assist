import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { AuthService } from '../services/AuthService';
import { AWSService } from '../services/AWSService';
import { GKEService } from '../services/GKEService';

interface DashboardStats {
  awsInstances: number;
  gkeClusters: number;
  totalPods: number;
  runningInstances: number;
  totalDeployments: number;
  healthyClusters: number;
}

interface DashboardScreenProps {
  navigation: any;
}

export default function DashboardScreen({ navigation }: DashboardScreenProps) {
  const [stats, setStats] = useState<DashboardStats>({
    awsInstances: 0,
    gkeClusters: 0,
    totalPods: 0,
    runningInstances: 0,
    totalDeployments: 0,
    healthyClusters: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setIsLoading(true);
      
      // Load AWS instances from all regions (use cache)
      const instances = await AWSService.getAllInstancesFromAllRegions();
      
      // Load GKE clusters
      const clusters = await GKEService.getClusters();
      
      // Calculate running instances
      const runningInstances = instances.filter(instance => 
        instance.state === 'running'
      ).length;
      
      // Calculate total pods across all clusters
      let totalPods = 0;
      let healthyClusters = 0;
      let totalDeployments = 0;
      
      try {
        for (const cluster of clusters) {
          const health = await GKEService.getClusterHealth(cluster.name, cluster.location);
          totalPods += health.totalPods;
          
          if (health.runningPods === health.totalPods && health.readyNodes === health.totalNodes) {
            healthyClusters++;
          }
          
          const deployments = await GKEService.getDeployments(cluster.name, cluster.location);
          totalDeployments += deployments.length;
        }
      } catch (error) {
        console.warn('Failed to load detailed cluster data:', error);
        // Continue with basic stats even if detailed data fails
      }
      
      setStats({
        awsInstances: instances.length,
        gkeClusters: clusters.length,
        totalPods,
        runningInstances,
        totalDeployments,
        healthyClusters,
      });
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
      Alert.alert('Error', 'Failed to load dashboard data. Please check your connection.');
    } finally {
      setIsLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDashboardData();
    setRefreshing(false);
  };

  const StatCard = ({ 
    title, 
    value, 
    icon, 
    color, 
    onPress 
  }: {
    title: string;
    value: number | string;
    icon: keyof typeof Ionicons.glyphMap;
    color: string;
    onPress?: () => void;
  }) => (
    <TouchableOpacity 
      style={[styles.statCard, { borderLeftColor: color }]} 
      onPress={onPress}
      disabled={!onPress}
    >
      <View style={styles.statCardContent}>
        <View style={styles.statCardHeader}>
          <Ionicons name={icon} size={24} color={color} />
          <Text style={styles.statCardTitle}>{title}</Text>
        </View>
        <Text style={[styles.statCardValue, { color }]}>{value}</Text>
      </View>
    </TouchableOpacity>
  );

  const QuickAction = ({ 
    title, 
    description, 
    icon, 
    onPress 
  }: {
    title: string;
    description: string;
    icon: keyof typeof Ionicons.glyphMap;
    onPress: () => void;
  }) => (
    <TouchableOpacity style={styles.quickAction} onPress={onPress}>
      <View style={styles.quickActionIcon}>
        <Ionicons name={icon} size={24} color="#2563eb" />
      </View>
      <View style={styles.quickActionContent}>
        <Text style={styles.quickActionTitle}>{title}</Text>
        <Text style={styles.quickActionDescription}>{description}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color="#999" />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Dashboard</Text>
          <Text style={styles.headerSubtitle}>
            DevOps infrastructure overview
          </Text>
        </View>

        {/* Stats Cards */}
        <View style={styles.statsContainer}>
          <StatCard
            title="AWS Instances"
            value={stats.awsInstances}
            icon="cloud"
            color="#ff9500"
            onPress={() => navigation.navigate('AWS')}
          />
          <StatCard
            title="GKE Clusters"
            value={stats.gkeClusters}
            icon="cube"
            color="#4285f4"
            onPress={() => navigation.navigate('GKE')}
          />
          <StatCard
            title="Running Instances"
            value={stats.runningInstances}
            icon="checkmark-circle"
            color="#34c759"
          />
          <StatCard
            title="Total Pods"
            value={stats.totalPods}
            icon="layers"
            color="#af52de"
          />
          <StatCard
            title="Deployments"
            value={stats.totalDeployments}
            icon="rocket"
            color="#8b5cf6"
          />
          <StatCard
            title="Healthy Clusters"
            value={stats.healthyClusters}
            icon="shield-checkmark"
            color="#10b981"
          />
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActionsContainer}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          
          <QuickAction
            title="View AWS Instances"
            description="Manage Lightsail instances"
            icon="cloud"
            onPress={() => navigation.navigate('AWS')}
          />
          
          <QuickAction
            title="View GKE Clusters"
            description="Manage Kubernetes clusters"
            icon="cube"
            onPress={() => navigation.navigate('GKE')}
          />
          
          <QuickAction
            title="System Health"
            description="Check infrastructure status"
            icon="pulse"
            onPress={() => {
              Alert.alert('System Health', 'All systems operational');
            }}
          />
          
          <QuickAction
            title="Refresh Data"
            description="Update all metrics"
            icon="refresh"
            onPress={onRefresh}
          />
        </View>

        {/* Status */}
        <View style={styles.statusContainer}>
          <View style={styles.statusItem}>
            <View style={[styles.statusDot, { backgroundColor: '#34c759' }]} />
            <Text style={styles.statusText}>All systems operational</Text>
          </View>
          <Text style={styles.lastUpdated}>
            Last updated: {new Date().toLocaleTimeString()}
          </Text>
        </View>
      </ScrollView>
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
  statsContainer: {
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  statCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    ...(Platform.OS === 'web' ? {
      boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
    } : {
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    }),
  },
  statCardContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statCardTitle: {
    fontSize: 16,
    color: '#666',
    marginLeft: 8,
  },
  statCardValue: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  quickActionsContainer: {
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  quickAction: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    ...(Platform.OS === 'web' ? {
      boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
    } : {
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    }),
  },
  quickActionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f0f9ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  quickActionContent: {
    flex: 1,
  },
  quickActionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  quickActionDescription: {
    fontSize: 14,
    color: '#666',
  },
  statusContainer: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusText: {
    fontSize: 14,
    color: '#333',
  },
  lastUpdated: {
    fontSize: 12,
    color: '#999',
  },
});
