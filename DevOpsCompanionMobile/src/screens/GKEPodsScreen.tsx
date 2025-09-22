import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Platform,
  Modal,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { GKEService } from '../services/GKEService';
import StatusBadge from '../components/StatusBadge';
import LoadingIndicator from '../components/LoadingIndicator';
import EmptyState from '../components/EmptyState';

interface GKEPod {
  name: string;
  namespace: string;
  status: string;
  ready: string;
  age: string;
  cpu?: string;
  memory?: string;
  restarts?: number;
}

interface GKEPodsScreenProps {
  clusterName: string;
  location: string;
  namespace: string;
  onBack: () => void;
  onNavigateToAdvanced?: (resourceType: 'deployments' | 'services' | 'ingresses' | 'secrets' | 'service-accounts') => void;
}

export default function GKEPodsScreen({ 
  clusterName, 
  location, 
  namespace, 
  onBack,
  onNavigateToAdvanced 
}: GKEPodsScreenProps) {
  const [pods, setPods] = useState<GKEPod[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPod, setSelectedPod] = useState<GKEPod | null>(null);
  const [optionsModalVisible, setOptionsModalVisible] = useState(false);
  const [podDetailsModalVisible, setPodDetailsModalVisible] = useState(false);
  const [podDetails, setPodDetails] = useState<any>(null);
  const [showAdvancedOperations, setShowAdvancedOperations] = useState(false);

  const getAgeFromTimestamp = (timestamp: string): string => {
    try {
      const created = new Date(timestamp);
      const now = new Date();
      const diffMs = now.getTime() - created.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      
      if (diffDays > 0) {
        return `${diffDays}d${diffHours}h`;
      } else if (diffHours > 0) {
        return `${diffHours}h${diffMinutes}m`;
      } else {
        return `${diffMinutes}m`;
      }
    } catch (error) {
      return 'Unknown';
    }
  };

  const getReadyState = (pod: GKEPod): string => {
    try {
      // Check if pod has containers array
      if (pod.containers && Array.isArray(pod.containers)) {
        const totalContainers = pod.containers.length;
        const readyContainers = pod.containers.filter((container: any) => container.ready).length;
        return `${readyContainers}/${totalContainers}`;
      }
      
      // Fallback to status.ready if containers array not available
      if (pod.status?.ready !== undefined) {
        return pod.status.ready ? '1/1' : '0/1';
      }
      
      return '0/1';
    } catch (error) {
      return '0/1';
    }
  };

  useEffect(() => {
    loadPods();
  }, []);

  const loadPods = async () => {
    try {
      setIsLoading(true);
      console.log('Loading pods for cluster:', clusterName, 'namespace:', namespace);
      
      let data: GKEPod[];
      if (namespace === 'all') {
        // Load all pods across all namespaces
        console.log('Calling getAllPods API...');
        data = await GKEService.getAllPods(clusterName, location);
        console.log('Loaded all pods:', data.length, data);
      } else {
        // Load pods for specific namespace
        console.log('Calling getPods API for namespace:', namespace);
        data = await GKEService.getPods(clusterName, location, namespace);
        console.log('Loaded pods for namespace:', data.length, data);
      }
      
      if (!data || !Array.isArray(data)) {
        console.error('Invalid data received:', data);
        data = [];
      }
      
      setPods(data);
    } catch (error) {
      console.error('Failed to load pods:', error);
      Alert.alert('Error', `Failed to load pods: ${(error as Error).message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadPods();
    setRefreshing(false);
  };

  const handlePodOptions = (pod: GKEPod) => {
    setSelectedPod(pod);
    setOptionsModalVisible(true);
  };

  const handleRestartPod = async () => {
    if (!selectedPod) return;
    
    try {
      Alert.alert(
        'Restart Pod',
        `Are you sure you want to restart pod "${selectedPod.name}"?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Restart', 
            style: 'destructive',
            onPress: async () => {
              try {
                // Call restart pod API
                await GKEService.restartPod(clusterName, location, selectedPod.namespace, selectedPod.name);
                Alert.alert('Success', 'Pod restart initiated');
                setOptionsModalVisible(false);
                loadPods(); // Refresh the list
              } catch (error) {
                Alert.alert('Error', `Failed to restart pod: ${(error as Error).message}`);
              }
            }
          }
        ]
      );
    } catch (error) {
      Alert.alert('Error', `Failed to restart pod: ${(error as Error).message}`);
    }
  };

  const handleViewLogs = async () => {
    if (!selectedPod) return;
    
    try {
      const logs = await GKEService.getPodLogs(clusterName, location, selectedPod.namespace, selectedPod.name);
      setPodDetails({ type: 'logs', content: logs });
      setPodDetailsModalVisible(true);
      setOptionsModalVisible(false);
    } catch (error) {
      Alert.alert('Error', `Failed to get pod logs: ${(error as Error).message}`);
    }
  };

  const handleDescribePod = async () => {
    if (!selectedPod) return;
    
    try {
      console.log('GKEPodsScreen: Starting describe pod for:', selectedPod.name);
      const details = await GKEService.describePod(clusterName, location, selectedPod.namespace, selectedPod.name);
      console.log('GKEPodsScreen: Received details:', details.length, 'characters');
      console.log('GKEPodsScreen: Details preview:', details.substring(0, 100));
      setPodDetails({ type: 'describe', content: details });
      setPodDetailsModalVisible(true);
      setOptionsModalVisible(false);
    } catch (error) {
      console.error('GKEPodsScreen: Describe pod error:', error);
      Alert.alert('Error', `Failed to describe pod: ${(error as Error).message}`);
    }
  };

  const handleScaleDeployment = async () => {
    if (!selectedPod) return;
    
    try {
      console.log('GKEPodsScreen: Getting deployment name for pod:', selectedPod.name);
      
      // Get deployment name from pod's owner references or labels
      const deploymentName = await GKEService.getDeploymentNameFromPod(
        clusterName, 
        location, 
        selectedPod.namespace, 
        selectedPod.name
      );
      
      if (!deploymentName) {
        Alert.alert('Error', 'Could not find deployment name for this pod');
        return;
      }
      
      console.log('GKEPodsScreen: Found deployment name:', deploymentName);
      
      Alert.prompt(
        'Scale Deployment',
        `Enter new replica count for deployment "${deploymentName}":`,
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Scale',
            onPress: async (replicaCount) => {
              if (replicaCount && !isNaN(parseInt(replicaCount))) {
                try {
                  await GKEService.scaleDeployment(clusterName, location, selectedPod.namespace, deploymentName, parseInt(replicaCount));
                  Alert.alert('Success', `Deployment ${deploymentName} scaled to ${replicaCount} replicas`);
                  setOptionsModalVisible(false);
                  loadPods(); // Refresh the list
                } catch (error) {
                  Alert.alert('Error', `Failed to scale deployment: ${(error as Error).message}`);
                }
              } else {
                Alert.alert('Error', 'Please enter a valid number');
              }
            }
          }
        ],
        'plain-text',
        '1'
      );
    } catch (error) {
      console.error('GKEPodsScreen: Error getting deployment name:', error);
      Alert.alert('Error', `Failed to get deployment name: ${(error as Error).message}`);
    }
  };

  const PodCard = ({ pod }: { pod: GKEPod }) => (
    <View style={styles.podCard}>
      <View style={styles.podHeader}>
        <View style={styles.podInfo}>
          <Text style={styles.podName}>{pod.name}</Text>
          <View style={styles.podStats}>
            <Text style={styles.podStat}>Ready: {getReadyState(pod)}</Text>
            <Text style={styles.podStat}>Age: {pod.creation_timestamp ? getAgeFromTimestamp(pod.creation_timestamp) : 'Unknown'}</Text>
          </View>
          <View style={styles.podStats}>
            <Text style={styles.podStat}>CPU: {pod.cpu || '0 cores'}</Text>
            <Text style={styles.podStat}>Memory: {pod.memory || '0 MB'}</Text>
            <Text style={styles.podStat}>Restarts: {pod.status?.restart_count || 0}</Text>
          </View>
        </View>
        <View style={styles.podActions}>
          <StatusBadge status={pod.status?.phase || 'Unknown'} />
          <TouchableOpacity
            style={styles.optionsButton}
            onPress={() => handlePodOptions(pod)}
          >
            <Ionicons name="ellipsis-horizontal" size={20} color="#666" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  if (isLoading && pods.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <LoadingIndicator message="Loading pods..." fullScreen />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#2563eb" />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>
            {namespace === 'all' ? 'All Pods' : `Pods in ${namespace}`}
          </Text>
          <Text style={styles.headerSubtitle}>{pods.length} pod{pods.length !== 1 ? 's' : ''}</Text>
        </View>
        <TouchableOpacity onPress={onRefresh} style={styles.refreshButton}>
          <Ionicons name="refresh" size={24} color="#666" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={pods}
        keyExtractor={(item, index) => `${item.name}-${index}`}
        renderItem={({ item }) => <PodCard pod={item} />}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          <EmptyState
            icon="cube-outline"
            title="No pods found"
            subtitle="Pull to refresh or check your namespace configuration"
            onAction={onRefresh}
          />
        }
      />

      {/* Advanced Operations Section */}
      {onNavigateToAdvanced && (
        <View style={styles.advancedOperationsContainer}>
          <TouchableOpacity
            style={styles.advancedOperationsToggle}
            onPress={() => setShowAdvancedOperations(!showAdvancedOperations)}
          >
            <View style={styles.advancedOperationsHeader}>
              <Ionicons name="rocket" size={20} color="#2563eb" />
              <Text style={styles.advancedOperationsTitle}>Advanced Operations</Text>
            </View>
            <Ionicons 
              name={showAdvancedOperations ? "chevron-up" : "chevron-down"} 
              size={20} 
              color="#666" 
            />
          </TouchableOpacity>
          
          {showAdvancedOperations && (
            <View style={styles.advancedOperationsGrid}>
              <TouchableOpacity
                style={styles.advancedOperationButton}
                onPress={() => onNavigateToAdvanced('deployments')}
              >
                <Ionicons name="layers" size={24} color="#2563eb" />
                <Text style={styles.advancedOperationText}>Deployments</Text>
                <Text style={styles.advancedOperationSubtext}>View & Manage</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.advancedOperationButton}
                onPress={() => onNavigateToAdvanced('services')}
              >
                <Ionicons name="globe" size={24} color="#059669" />
                <Text style={styles.advancedOperationText}>Services</Text>
                <Text style={styles.advancedOperationSubtext}>View & Download</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.advancedOperationButton}
                onPress={() => onNavigateToAdvanced('ingresses')}
              >
                <Ionicons name="link" size={24} color="#7c3aed" />
                <Text style={styles.advancedOperationText}>Ingresses</Text>
                <Text style={styles.advancedOperationSubtext}>View & Manage</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.advancedOperationButton}
                onPress={() => onNavigateToAdvanced('secrets')}
              >
                <Ionicons name="lock-closed" size={24} color="#dc2626" />
                <Text style={styles.advancedOperationText}>Secrets</Text>
                <Text style={styles.advancedOperationSubtext}>View & Download</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.advancedOperationButton}
                onPress={() => onNavigateToAdvanced('service-accounts')}
              >
                <Ionicons name="person" size={24} color="#ea580c" />
                <Text style={styles.advancedOperationText}>Service Accounts</Text>
                <Text style={styles.advancedOperationSubtext}>View & Manage</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {/* Pod Options Modal */}
      <Modal
        visible={optionsModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setOptionsModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Pod Options</Text>
              <TouchableOpacity
                onPress={() => setOptionsModalVisible(false)}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <TouchableOpacity
                style={styles.optionButton}
                onPress={handleRestartPod}
              >
                <Ionicons name="refresh" size={20} color="#2563eb" />
                <Text style={styles.optionText}>Restart Pod</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.optionButton}
                onPress={handleViewLogs}
              >
                <Ionicons name="document-text" size={20} color="#059669" />
                <Text style={styles.optionText}>View Logs</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.optionButton}
                onPress={handleDescribePod}
              >
                <Ionicons name="information-circle" size={20} color="#7c3aed" />
                <Text style={styles.optionText}>Describe Pod</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.optionButton}
                onPress={handleScaleDeployment}
              >
                <Ionicons name="trending-up" size={20} color="#dc2626" />
                <Text style={styles.optionText}>Scale Deployment</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Pod Details Modal */}
      <Modal
        visible={podDetailsModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setPodDetailsModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {podDetails?.type === 'logs' ? 'Pod Logs' : 'Pod Details'}
              </Text>
              <TouchableOpacity
                onPress={() => setPodDetailsModalVisible(false)}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody}>
              <Text style={styles.detailsText}>
                {podDetails?.content || 'No details available'}
              </Text>
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
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e1e5e9',
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  refreshButton: {
    padding: 8,
  },
  listContainer: {
    padding: 16,
  },
  podCard: {
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
  podHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  podInfo: {
    flex: 1,
  },
  podName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 8,
  },
  podStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 4,
  },
  podStat: {
    fontSize: 13,
    color: '#666',
    marginRight: 16,
    marginBottom: 2,
  },
  podActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  optionsButton: {
    padding: 8,
    marginLeft: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingTop: 20,
    height: '85%',
    width: '98%',
    maxWidth: 600,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  closeButton: {
    padding: 4,
    marginLeft: 16,
  },
  modalBody: {
    padding: 24,
    flex: 1,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    marginBottom: 12,
  },
  optionText: {
    fontSize: 16,
    color: '#333',
    marginLeft: 12,
    fontWeight: '500',
  },
  detailsText: {
    fontSize: 14,
    color: '#333',
    fontFamily: 'monospace',
    lineHeight: 20,
  },
  advancedOperationsContainer: {
    backgroundColor: '#fff',
    margin: 16,
    borderRadius: 12,
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
  advancedOperationsToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  advancedOperationsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  advancedOperationsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginLeft: 8,
  },
  advancedOperationsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    padding: 16,
  },
  advancedOperationButton: {
    width: '48%',
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  advancedOperationText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginTop: 8,
    textAlign: 'center',
  },
  advancedOperationSubtext: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
    textAlign: 'center',
  },
});
