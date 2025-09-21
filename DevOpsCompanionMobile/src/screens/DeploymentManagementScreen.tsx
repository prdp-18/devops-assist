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
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { BiometricService } from '../services/BiometricService';
import { GKEService, GKEDeployment } from '../services/GKEService';
import ActionModal from '../components/ActionModal';
import StatusBadge from '../components/StatusBadge';
import LoadingIndicator from '../components/LoadingIndicator';
import EmptyState from '../components/EmptyState';

interface DeploymentManagementScreenProps {
  route: {
    params: {
      clusterName: string;
      clusterLocation: string;
      namespace?: string;
    };
  };
  navigation: any;
}

export default function DeploymentManagementScreen({ route, navigation }: DeploymentManagementScreenProps) {
  const { clusterName, clusterLocation, namespace } = route.params;
  
  const [deployments, setDeployments] = useState<GKEDeployment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDeployment, setSelectedDeployment] = useState<GKEDeployment | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [scaleModalVisible, setScaleModalVisible] = useState(false);
  const [newReplicaCount, setNewReplicaCount] = useState('');

  useEffect(() => {
    loadDeployments();
  }, [clusterName, namespace]);

  const loadDeployments = async () => {
    try {
      setIsLoading(true);
      const data = await GKEService.getDeployments(clusterName, clusterLocation, namespace);
      setDeployments(data);
    } catch (error) {
      console.error('Failed to load deployments:', error);
      Alert.alert('Error', 'Failed to load deployments. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDeployments();
    setRefreshing(false);
  };

  const handleScaleDeployment = async (deployment: GKEDeployment) => {
    setSelectedDeployment(deployment);
    setNewReplicaCount(deployment.replicas.toString());
    setScaleModalVisible(true);
  };

  const executeScale = async () => {
    if (!selectedDeployment || !newReplicaCount.trim()) {
      Alert.alert('Error', 'Please enter a valid replica count');
      return;
    }

    const replicas = parseInt(newReplicaCount, 10);
    if (isNaN(replicas) || replicas < 0) {
      Alert.alert('Error', 'Please enter a valid number of replicas (0 or greater)');
      return;
    }

    try {
      const authenticated = await BiometricService.authenticateForCriticalAction(
        `scale deployment ${selectedDeployment.name} to ${replicas} replicas`
      );

      if (!authenticated) {
        Alert.alert('Authentication Required', 'Biometric authentication required for this action');
        return;
      }

      const success = await GKEService.scaleDeployment(
        clusterName,
        selectedDeployment.namespace,
        selectedDeployment.name,
        replicas,
        clusterLocation
      );

      if (success) {
        Alert.alert('Success', `Deployment ${selectedDeployment.name} scaled to ${replicas} replicas`);
        setScaleModalVisible(false);
        loadDeployments();
      } else {
        Alert.alert('Error', 'Failed to scale deployment');
      }
    } catch (error) {
      console.error('Scale deployment failed:', error);
      Alert.alert('Error', 'Failed to scale deployment. Please try again.');
    }
  };

  const getDeploymentStatus = (deployment: GKEDeployment) => {
    const [ready, total] = deployment.ready.split('/').map(Number);
    if (ready === total && total > 0) {
      return 'Running';
    } else if (total === 0) {
      return 'Stopped';
    } else {
      return 'Scaling';
    }
  };

  const DeploymentCard = ({ deployment }: { deployment: GKEDeployment }) => {
    const status = getDeploymentStatus(deployment);
    const [ready, total] = deployment.ready.split('/').map(Number);
    const readyPercentage = total > 0 ? Math.round((ready / total) * 100) : 0;

    return (
      <TouchableOpacity
        style={styles.deploymentCard}
        onPress={() => {
          setSelectedDeployment(deployment);
          setModalVisible(true);
        }}
      >
        <View style={styles.deploymentHeader}>
          <View style={styles.deploymentInfo}>
            <Text style={styles.deploymentName}>{deployment.name}</Text>
            <Text style={styles.deploymentNamespace}>{deployment.namespace}</Text>
          </View>
          <StatusBadge status={status} />
        </View>
        
        <View style={styles.deploymentStats}>
          <View style={styles.statItem}>
            <Ionicons name="checkmark-circle" size={16} color="#666" />
            <Text style={styles.statText}>{deployment.ready} ready</Text>
          </View>
          <View style={styles.statItem}>
            <Ionicons name="people" size={16} color="#666" />
            <Text style={styles.statText}>{deployment.replicas} replicas</Text>
          </View>
          <View style={styles.statItem}>
            <Ionicons name="time" size={16} color="#666" />
            <Text style={styles.statText}>{deployment.age}</Text>
          </View>
        </View>

        {/* Progress bar for ready replicas */}
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View 
              style={[
                styles.progressFill, 
                { width: `${readyPercentage}%` }
              ]} 
            />
          </View>
          <Text style={styles.progressText}>{readyPercentage}% ready</Text>
        </View>

        <View style={styles.deploymentDetails}>
          <Text style={styles.detailText}>Up-to-date: {deployment.upToDate}</Text>
          <Text style={styles.detailText}>Available: {deployment.available}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  const getModalActions = () => {
    if (!selectedDeployment) return [];

    return [
      {
        id: 'scale',
        title: 'Scale Deployment',
        icon: 'resize' as keyof typeof Ionicons.glyphMap,
        color: '#2563eb',
        onPress: () => handleScaleDeployment(selectedDeployment),
      },
      {
        id: 'details',
        title: 'View Details',
        icon: 'information-circle' as keyof typeof Ionicons.glyphMap,
        onPress: () => {
          Alert.alert(
            'Deployment Details',
            `Name: ${selectedDeployment.name}\n` +
            `Namespace: ${selectedDeployment.namespace}\n` +
            `Replicas: ${selectedDeployment.replicas}\n` +
            `Ready: ${selectedDeployment.ready}\n` +
            `Up-to-date: ${selectedDeployment.upToDate}\n` +
            `Available: ${selectedDeployment.available}\n` +
            `Age: ${selectedDeployment.age}`,
            [{ text: 'OK' }]
          );
        },
      },
    ];
  };

  const ScaleModal = () => (
    <Modal
      visible={scaleModalVisible}
      transparent={true}
      animationType="slide"
      onRequestClose={() => setScaleModalVisible(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              Scale {selectedDeployment?.name}
            </Text>
            <TouchableOpacity
              onPress={() => setScaleModalVisible(false)}
              style={styles.closeButton}
            >
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>
          
          <View style={styles.modalBody}>
            <Text style={styles.modalSubtitle}>
              Current replicas: {selectedDeployment?.replicas}
            </Text>
            
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>New replica count:</Text>
              <TextInput
                style={styles.input}
                value={newReplicaCount}
                onChangeText={setNewReplicaCount}
                placeholder="Enter number of replicas"
                keyboardType="numeric"
                autoFocus={true}
              />
            </View>

            <View style={styles.scaleActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setScaleModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.scaleButton}
                onPress={executeScale}
              >
                <Text style={styles.scaleButtonText}>Scale</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );

  if (isLoading && deployments.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <LoadingIndicator message="Loading deployments..." fullScreen />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color="#2563eb" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>
            {namespace ? `Deployments in ${namespace}` : 'All Deployments'}
          </Text>
          <Text style={styles.headerSubtitle}>
            {clusterName} • {deployments.length} deployment{deployments.length !== 1 ? 's' : ''}
          </Text>
        </View>
      </View>

      <FlatList
        data={deployments}
        keyExtractor={(item) => `${item.name}-${item.namespace}`}
        renderItem={({ item }) => <DeploymentCard deployment={item} />}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          <EmptyState
            icon="layers-outline"
            title="No deployments found"
            subtitle={namespace ? `No deployments found in namespace "${namespace}"` : 'No deployments found in cluster'}
            actionText="Refresh"
            onAction={onRefresh}
          />
        }
      />

      <ActionModal
        visible={modalVisible}
        title={selectedDeployment?.name || ''}
        subtitle="Deployment Actions"
        actions={getModalActions()}
        onClose={() => setModalVisible(false)}
      />

      <ScaleModal />
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
    padding: 24,
    paddingBottom: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  backButton: {
    marginRight: 16,
    padding: 4,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  listContainer: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  deploymentCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  deploymentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  deploymentInfo: {
    flex: 1,
  },
  deploymentName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  deploymentNamespace: {
    fontSize: 14,
    color: '#666',
  },
  deploymentStats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  statText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 4,
  },
  progressContainer: {
    marginBottom: 12,
  },
  progressBar: {
    height: 6,
    backgroundColor: '#e5e7eb',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 4,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#34c759',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'right',
  },
  deploymentDetails: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  detailText: {
    fontSize: 12,
    color: '#999',
    marginBottom: 2,
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
    margin: 24,
    maxWidth: 400,
    width: '100%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    padding: 4,
  },
  modalBody: {
    padding: 24,
  },
  modalSubtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
  },
  inputContainer: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 16,
    color: '#333',
    marginBottom: 8,
    fontWeight: '500',
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  scaleActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    marginRight: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  scaleButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    backgroundColor: '#2563eb',
    alignItems: 'center',
  },
  scaleButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
});
