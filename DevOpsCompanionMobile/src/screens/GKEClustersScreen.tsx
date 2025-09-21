import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Modal,
  ScrollView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { AuthService } from '../services/AuthService';
import { BiometricService } from '../services/BiometricService';
import { GKEService, GKECluster } from '../services/GKEService';
import ActionModal from '../components/ActionModal';
import StatusBadge from '../components/StatusBadge';
import LoadingIndicator from '../components/LoadingIndicator';
import EmptyState from '../components/EmptyState';
import GKENamespacesScreen from './GKENamespacesScreen';
import GKEPodsScreen from './GKEPodsScreen';
import GKEAdvancedOperationsScreen from './GKEAdvancedOperationsScreen';


export default function GKEClustersScreen() {
  const [clusters, setClusters] = useState<GKECluster[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCluster, setSelectedCluster] = useState<GKECluster | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  
  // Navigation state
  const [currentView, setCurrentView] = useState<'clusters' | 'namespaces' | 'pods' | 'advanced'>('clusters');
  const [navigationStack, setNavigationStack] = useState<{
    clusterName?: string;
    location?: string;
    namespace?: string;
    resourceType?: 'deployments' | 'services' | 'ingresses' | 'secrets' | 'service-accounts';
  }>({});
  
  // Location selector
  const [selectedLocation, setSelectedLocation] = useState('us-central1');
  const [locationModalVisible, setLocationModalVisible] = useState(false);
  
  // Loading states for different actions
  const [isGettingHealth, setIsGettingHealth] = useState(false);
  const [isGettingNamespaces, setIsGettingNamespaces] = useState(false);
  const [isGettingNodes, setIsGettingNodes] = useState(false);

  useEffect(() => {
    loadClusters();
  }, [selectedLocation]);

  const loadClusters = async () => {
    try {
      setIsLoading(true);
      const data = await GKEService.getClusters(selectedLocation);
      console.log('Loaded clusters:', JSON.stringify(data, null, 2));
      setClusters(data);
    } catch (error) {
      console.error('Failed to load clusters:', error);
      Alert.alert('Error', 'Failed to load GKE clusters. Please check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadClusters();
    setRefreshing(false);
  };

  const handleViewClusterHealth = async (cluster: GKECluster) => {
    try {
      console.log('handleViewClusterHealth called for:', cluster.name, 'location:', selectedLocation);
      setIsGettingHealth(true);
      const health = await GKEService.getClusterHealth(cluster.name, selectedLocation);
      
      Alert.alert(
        'Cluster Health',
        `Cluster: ${cluster.name}\n\n` +
        `Pods:\n` +
        `  Total: ${health.totalPods}\n` +
        `  Running: ${health.runningPods}\n` +
        `  Pending: ${health.pendingPods}\n` +
        `  Failed: ${health.failedPods}\n\n` +
        `Nodes:\n` +
        `  Total: ${health.totalNodes}\n` +
        `  Ready: ${health.readyNodes}\n` +
        `  Not Ready: ${health.notReadyNodes}`,
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Failed to get cluster health:', error);
      Alert.alert('Error', 'Failed to get cluster health. Please try again.');
    } finally {
      setIsGettingHealth(false);
      setModalVisible(false); // Close modal after action completes
    }
  };

  const handleViewNamespaces = async (cluster: GKECluster) => {
    try {
      setIsGettingNamespaces(true);
      setNavigationStack({
        clusterName: cluster.name,
        location: selectedLocation,
      });
      setCurrentView('namespaces');
      setModalVisible(false);
    } catch (error) {
      console.error('Failed to navigate to namespaces:', error);
      Alert.alert('Error', `Failed to navigate to namespaces: ${(error as Error).message}`);
    } finally {
      setIsGettingNamespaces(false);
    }
  };

  const handleViewNodes = async (cluster: GKECluster) => {
    try {
      setIsGettingNodes(true);
      const nodes = await GKEService.getNodes(cluster.name, selectedLocation);
      
      const nodeInfo = nodes.slice(0, 5).map(node => 
        `${node.name}: ${node.status} (${node.machineType || 'unknown'})`
      ).join('\n');
      const moreCount = nodes.length > 5 ? `\n... and ${nodes.length - 5} more nodes` : '';
      
      Alert.alert(
        'Cluster Nodes',
        `Cluster: ${cluster.name}\n\n` +
        `Total Nodes: ${nodes.length}\n` +
        `Ready: ${nodes.filter(node => node.status === 'Ready').length}\n\n` +
        `Node Details:\n${nodeInfo}${moreCount}`,
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Failed to get nodes:', error);
      Alert.alert('Error', 'Failed to get cluster nodes. Please try again.');
    } finally {
      setIsGettingNodes(false);
      setModalVisible(false); // Close modal after action completes
    }
  };

  const handleViewDeployments = async (cluster: GKECluster) => {
    try {
      const deployments = await GKEService.getDeployments(cluster.name, selectedLocation);
      
      const deploymentInfo = deployments.slice(0, 5).map(deployment => 
        `${deployment.name}: ${deployment.ready}/${deployment.replicas} ready`
      ).join('\n');
      const moreCount = deployments.length > 5 ? `\n... and ${deployments.length - 5} more deployments` : '';

      Alert.alert(
        'Cluster Deployments',
        `Cluster: ${cluster.name}\n\n` +
        `Total Deployments: ${deployments.length}\n\n` +
        `Deployment Status:\n${deploymentInfo}${moreCount}`,
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Failed to get deployments:', error);
      Alert.alert('Error', 'Failed to get cluster deployments. Please try again.');
    } finally {
      setModalVisible(false); // Close modal after action completes
    }
  };

  const ClusterCard = ({ cluster }: { cluster: GKECluster }) => (
    <TouchableOpacity
      style={styles.clusterCard}
      onPress={() => {
        console.log('Cluster card clicked:', cluster.name);
        console.log('Setting selectedCluster and opening modal');
        setSelectedCluster(cluster);
        setModalVisible(true);
        console.log('Modal should now be visible');
      }}
    >
      <View style={styles.clusterHeader}>
        <View style={styles.clusterInfo}>
          <Text style={styles.clusterName}>{cluster.name}</Text>
          <Text style={styles.clusterLocation}>{selectedLocation}</Text>
        </View>
        <StatusBadge status={cluster.status} />
      </View>
      
      <View style={styles.clusterStats}>
        {/* Display cluster stats properly */}
        <View style={styles.statItem}>
          <Ionicons name="server" size={16} color="#666" />
          <Text style={[styles.statText, {color: '#333', fontSize: 14, fontWeight: '500'}]} numberOfLines={1}>
            {cluster.node_count || cluster.nodeCount || '0'} nodes
          </Text>
        </View>
        <View style={styles.statItem}>
          <Ionicons name="code-working" size={16} color="#666" />
          <Text style={[styles.statText, {color: '#333', fontSize: 14, fontWeight: '500'}]} numberOfLines={1}>
            v{cluster.version || 'unknown'}
          </Text>
        </View>
        <View style={styles.statItem}>
          <Ionicons name="globe" size={16} color="#666" />
          <Text style={[styles.statText, {color: '#333', fontSize: 14, fontWeight: '500'}]} numberOfLines={1}>
            {cluster.endpoint ? 'API Available' : 'No Endpoint'}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  // Navigation functions
  const navigateBack = () => {
    switch (currentView) {
      case 'namespaces':
        setCurrentView('clusters');
        setNavigationStack({});
        break;
      case 'pods':
        setCurrentView('namespaces');
        setNavigationStack(prev => ({ ...prev, namespace: undefined }));
        break;
      case 'advanced':
        setCurrentView('pods');
        setNavigationStack(prev => ({ ...prev, resourceType: undefined }));
        break;
    }
  };

  const navigateToPods = (namespace: string) => {
    setNavigationStack(prev => ({ ...prev, namespace }));
    setCurrentView('pods');
  };

  const navigateToAdvanced = (resourceType: 'deployments' | 'services' | 'ingresses' | 'secrets' | 'service-accounts') => {
    setNavigationStack(prev => ({ ...prev, resourceType }));
    setCurrentView('advanced');
  };

  const getModalActions = () => {
    if (!selectedCluster) return [];
    
    console.log('getModalActions called, selectedCluster:', selectedCluster.name);

    return [
      {
        id: 'health',
        title: isGettingHealth ? 'Getting Health...' : 'View Cluster Health',
        icon: 'pulse' as keyof typeof Ionicons.glyphMap,
        onPress: () => handleViewClusterHealth(selectedCluster),
        disabled: isGettingHealth || isGettingNamespaces || isGettingNodes,
        loading: isGettingHealth,
      },
      {
        id: 'namespaces',
        title: isGettingNamespaces ? 'Getting Namespaces...' : 'View Namespaces',
        icon: 'folder' as keyof typeof Ionicons.glyphMap,
        onPress: () => handleViewNamespaces(selectedCluster),
        disabled: isGettingHealth || isGettingNamespaces || isGettingNodes,
        loading: isGettingNamespaces,
      },
      {
        id: 'nodes',
        title: isGettingNodes ? 'Getting Nodes...' : 'View Nodes',
        icon: 'server' as keyof typeof Ionicons.glyphMap,
        onPress: () => handleViewNodes(selectedCluster),
        disabled: isGettingHealth || isGettingNamespaces || isGettingNodes,
        loading: isGettingNodes,
      },
      {
        id: 'all-pods',
        title: 'View All Pods (-A)',
        icon: 'cube' as keyof typeof Ionicons.glyphMap,
        onPress: () => {
          setNavigationStack({
            clusterName: selectedCluster.name,
            location: selectedLocation,
            namespace: 'all',
          });
          setCurrentView('pods');
          setModalVisible(false);
        },
        disabled: isGettingHealth || isGettingNamespaces || isGettingNodes,
      },
    ];
  };

  // Render different views based on navigation state
  if (currentView === 'namespaces' && navigationStack.clusterName && navigationStack.location) {
    return (
      <GKENamespacesScreen
        clusterName={navigationStack.clusterName}
        location={navigationStack.location}
        onBack={navigateBack}
        onViewPods={navigateToPods}
      />
    );
  }

  if (currentView === 'pods' && navigationStack.clusterName && navigationStack.location && navigationStack.namespace) {
    return (
      <GKEPodsScreen
        clusterName={navigationStack.clusterName}
        location={navigationStack.location}
        namespace={navigationStack.namespace}
        onBack={navigateBack}
        onNavigateToAdvanced={navigateToAdvanced}
      />
    );
  }

  if (currentView === 'advanced' && navigationStack.clusterName && navigationStack.location && navigationStack.namespace && navigationStack.resourceType) {
    return (
      <GKEAdvancedOperationsScreen
        clusterName={navigationStack.clusterName}
        location={navigationStack.location}
        namespace={navigationStack.namespace}
        resourceType={navigationStack.resourceType}
        onBack={navigateBack}
      />
    );
  }

  if (isLoading && clusters.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <LoadingIndicator message="Loading GKE clusters..." fullScreen />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>GKE Clusters</Text>
        <Text style={styles.headerSubtitle}>
          {clusters.length} cluster{clusters.length !== 1 ? 's' : ''}
        </Text>
      </View>

      {/* Location Selector */}
      <View style={styles.locationSelector}>
        <TouchableOpacity 
          style={styles.locationButton}
          onPress={() => setLocationModalVisible(true)}
        >
          <Ionicons name="location" size={20} color="#2563eb" />
          <Text style={styles.locationButtonText}>
            Location: {selectedLocation}
          </Text>
          <Ionicons name="chevron-down" size={16} color="#666" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={clusters}
        keyExtractor={(item) => item.name}
        renderItem={({ item }) => <ClusterCard cluster={item} />}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          <EmptyState
            icon="cube-outline"
            title="No clusters found"
            subtitle="Pull to refresh or check your GCP configuration"
            actionText="Refresh"
            onAction={onRefresh}
          />
        }
      />

      <ActionModal
        visible={modalVisible}
        title={selectedCluster?.name || ''}
        subtitle="Cluster Actions"
        actions={getModalActions()}
        onClose={() => {
          console.log('ActionModal closing - called from onClose prop');
          setModalVisible(false);
        }}
      />

      {/* Location Selection Modal */}
      <Modal
        visible={locationModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setLocationModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Location</Text>
              <TouchableOpacity
                onPress={() => setLocationModalVisible(false)}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.modalBody}>
              {Object.entries(
                GKEService.getDefaultLocations().reduce((groups, location) => {
                  if (!groups[location.group]) {
                    groups[location.group] = [];
                  }
                  groups[location.group].push(location);
                  return groups;
                }, {} as Record<string, Array<{ value: string; label: string; group: string }>>)
              ).map(([groupName, locations]) => (
                <View key={groupName} style={styles.locationGroup}>
                  <Text style={styles.locationGroupTitle}>{groupName}</Text>
                  {locations.map((location) => (
                    <TouchableOpacity
                      key={location.value}
                      style={[
                        styles.locationOption,
                        selectedLocation === location.value && styles.locationOptionSelected
                      ]}
                      onPress={() => {
                        setSelectedLocation(location.value);
                        setLocationModalVisible(false);
                      }}
                    >
                      <Text style={[
                        styles.locationOptionText,
                        selectedLocation === location.value && styles.locationOptionTextSelected
                      ]}>
                        {location.label}
                      </Text>
                      {selectedLocation === location.value && (
                        <Ionicons name="checkmark" size={20} color="#2563eb" />
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              ))}
            </ScrollView>
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
  listContainer: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  clusterCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
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
  clusterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  clusterInfo: {
    flex: 1,
  },
  clusterName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  clusterLocation: {
    fontSize: 14,
    color: '#666',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  clusterStats: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
    marginBottom: 4,
    flex: 0,
    minWidth: 0,
  },
  statText: {
    fontSize: 14,
    color: '#333',
    marginLeft: 4,
    flexShrink: 1,
    fontWeight: '500',
  },
  locationSelector: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  locationButtonText: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    marginLeft: 8,
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    padding: 4,
  },
  modalBody: {
    padding: 24,
  },
  locationGroup: {
    marginBottom: 24,
  },
  locationGroupTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  locationOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#f8fafc',
    marginBottom: 8,
  },
  locationOptionSelected: {
    backgroundColor: '#dbeafe',
    borderWidth: 1,
    borderColor: '#2563eb',
  },
  locationOptionText: {
    fontSize: 16,
    color: '#333',
  },
  locationOptionTextSelected: {
    color: '#2563eb',
    fontWeight: '500',
  },
});
