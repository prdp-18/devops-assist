import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
  TextInput,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { BiometricService } from '../services/BiometricService';
import { GKEService, GKEPod, GKELogs, GKEPodDescription } from '../services/GKEService';
import ActionModal from '../components/ActionModal';
import StatusBadge from '../components/StatusBadge';
import LoadingIndicator from '../components/LoadingIndicator';
import EmptyState from '../components/EmptyState';

interface PodManagementScreenProps {
  route: {
    params: {
      clusterName: string;
      clusterLocation: string;
      namespace: string;
    };
  };
  navigation: any;
}

export default function PodManagementScreen({ route, navigation }: PodManagementScreenProps) {
  const { clusterName, clusterLocation, namespace } = route.params;
  
  const [pods, setPods] = useState<GKEPod[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPod, setSelectedPod] = useState<GKEPod | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [logsModalVisible, setLogsModalVisible] = useState(false);
  const [podLogs, setPodLogs] = useState<GKELogs | null>(null);
  const [logsLoading, setLogsLoading] = useState(false);

  useEffect(() => {
    loadPods();
  }, [clusterName, namespace]);

  const loadPods = async () => {
    try {
      setIsLoading(true);
      const data = await GKEService.getPods(clusterName, namespace, clusterLocation);
      setPods(data);
    } catch (error) {
      console.error('Failed to load pods:', error);
      Alert.alert('Error', 'Failed to load pods. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadPods();
    setRefreshing(false);
  };

  const handleRestartPod = async (pod: GKEPod) => {
    try {
      const authenticated = await BiometricService.authenticateForCriticalAction(
        `restart pod ${pod.name}`
      );

      if (!authenticated) {
        Alert.alert('Authentication Required', 'Biometric authentication required for this action');
        return;
      }

      Alert.alert(
        'Confirm Pod Restart',
        `Are you sure you want to restart pod "${pod.name}"?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Restart',
            style: 'destructive',
            onPress: async () => {
              try {
                const success = await GKEService.restartPod(
                  clusterName,
                  namespace,
                  pod.name,
                  clusterLocation
                );
                
                if (success) {
                  Alert.alert('Success', `Pod ${pod.name} restart initiated`);
                  loadPods();
                } else {
                  Alert.alert('Error', 'Failed to restart pod');
                }
              } catch (error) {
                console.error('Restart failed:', error);
                Alert.alert('Error', 'Failed to restart pod. Please try again.');
              }
            },
          },
        ]
      );
    } catch (error) {
      console.error('Restart pod failed:', error);
      Alert.alert('Error', 'Failed to restart pod. Please try again.');
    }
  };

  const handleDeletePod = async (pod: GKEPod) => {
    try {
      const authenticated = await BiometricService.authenticateForCriticalAction(
        `delete pod ${pod.name}`
      );

      if (!authenticated) {
        Alert.alert('Authentication Required', 'Biometric authentication required for this action');
        return;
      }

      Alert.alert(
        'Confirm Pod Deletion',
        `Are you sure you want to delete pod "${pod.name}"?\n\nThis action cannot be undone.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              try {
                const success = await GKEService.deletePod(
                  clusterName,
                  namespace,
                  pod.name,
                  clusterLocation
                );
                
                if (success) {
                  Alert.alert('Success', `Pod ${pod.name} deleted`);
                  loadPods();
                } else {
                  Alert.alert('Error', 'Failed to delete pod');
                }
              } catch (error) {
                console.error('Delete failed:', error);
                Alert.alert('Error', 'Failed to delete pod. Please try again.');
              }
            },
          },
        ]
      );
    } catch (error) {
      console.error('Delete pod failed:', error);
      Alert.alert('Error', 'Failed to delete pod. Please try again.');
    }
  };

  const handleViewLogs = async (pod: GKEPod) => {
    try {
      setLogsLoading(true);
      setLogsModalVisible(true);
      
      const logs = await GKEService.getPodLogs(
        clusterName,
        namespace,
        pod.name,
        clusterLocation,
        100
      );
      
      setPodLogs(logs);
    } catch (error) {
      console.error('Failed to get pod logs:', error);
      Alert.alert('Error', 'Failed to get pod logs. Please try again.');
      setLogsModalVisible(false);
    } finally {
      setLogsLoading(false);
    }
  };

  const handleViewPodDescription = async (pod: GKEPod) => {
    try {
      const description = await GKEService.getPodDescription(
        clusterName,
        namespace,
        pod.name,
        clusterLocation
      );
      
      // Format the description for display
      const formattedDescription = `
Pod Name: ${description.name}
Namespace: ${description.namespace}
Status: ${description.status?.phase || 'Unknown'}
Node: ${description.spec?.nodeName || 'Unknown'}
IP: ${description.status?.podIP || 'Unknown'}

Containers:
${description.spec?.containers?.map((container: any) => 
  `  - ${container.name}: ${container.image}`
).join('\n') || 'No containers found'}

Events:
${description.events?.slice(0, 5).map((event: any) => 
  `  ${event.type}: ${event.message}`
).join('\n') || 'No recent events'}
      `.trim();
      
      Alert.alert(
        'Pod Description',
        formattedDescription,
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Failed to get pod description:', error);
      Alert.alert('Error', 'Failed to get pod description. Please try again.');
    }
  };

  const PodCard = ({ pod }: { pod: GKEPod }) => (
    <TouchableOpacity
      style={styles.podCard}
      onPress={() => {
        setSelectedPod(pod);
        setModalVisible(true);
      }}
    >
      <View style={styles.podHeader}>
        <View style={styles.podInfo}>
          <Text style={styles.podName}>{pod.name}</Text>
          <Text style={styles.podNamespace}>{pod.namespace}</Text>
        </View>
        <StatusBadge status={pod.status} />
      </View>
      
      <View style={styles.podStats}>
        <View style={styles.statItem}>
          <Ionicons name="checkmark-circle" size={16} color="#666" />
          <Text style={styles.statText}>{pod.ready}</Text>
        </View>
        <View style={styles.statItem}>
          <Ionicons name="refresh" size={16} color="#666" />
          <Text style={styles.statText}>{pod.restarts} restarts</Text>
        </View>
        <View style={styles.statItem}>
          <Ionicons name="time" size={16} color="#666" />
          <Text style={styles.statText}>{pod.age}</Text>
        </View>
      </View>
      
      {pod.ip && (
        <View style={styles.podDetails}>
          <Text style={styles.detailText}>IP: {pod.ip}</Text>
          {pod.node && <Text style={styles.detailText}>Node: {pod.node}</Text>}
        </View>
      )}
    </TouchableOpacity>
  );

  const getModalActions = () => {
    if (!selectedPod) return [];

    return [
      {
        id: 'logs',
        title: 'View Logs',
        icon: 'document-text' as keyof typeof Ionicons.glyphMap,
        onPress: () => handleViewLogs(selectedPod),
      },
      {
        id: 'describe',
        title: 'Pod Description',
        icon: 'information-circle' as keyof typeof Ionicons.glyphMap,
        onPress: () => handleViewPodDescription(selectedPod),
      },
      {
        id: 'restart',
        title: 'Restart Pod',
        icon: 'refresh' as keyof typeof Ionicons.glyphMap,
        color: '#ff9500',
        onPress: () => handleRestartPod(selectedPod),
      },
      {
        id: 'delete',
        title: 'Delete Pod',
        icon: 'trash' as keyof typeof Ionicons.glyphMap,
        color: '#ff3b30',
        danger: true,
        onPress: () => handleDeletePod(selectedPod),
      },
    ];
  };

  const LogsModal = () => (
    <Modal
      visible={logsModalVisible}
      transparent={true}
      animationType="slide"
      onRequestClose={() => setLogsModalVisible(false)}
    >
      <View style={styles.logsModalOverlay}>
        <View style={styles.logsModalContent}>
          <View style={styles.logsModalHeader}>
            <Text style={styles.logsModalTitle}>
              {selectedPod?.name} Logs
            </Text>
            <TouchableOpacity
              onPress={() => setLogsModalVisible(false)}
              style={styles.closeButton}
            >
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>
          
          <View style={styles.logsContent}>
            {logsLoading ? (
              <LoadingIndicator message="Loading logs..." />
            ) : podLogs ? (
              <Text style={styles.logsText}>
                {podLogs.logs.join('\n')}
              </Text>
            ) : (
              <Text style={styles.noLogsText}>No logs available</Text>
            )}
          </View>
        </View>
      </View>
    </Modal>
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
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color="#2563eb" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Pods in {namespace}</Text>
          <Text style={styles.headerSubtitle}>
            {clusterName} • {pods.length} pod{pods.length !== 1 ? 's' : ''}
          </Text>
        </View>
      </View>

      <FlatList
        data={pods}
        keyExtractor={(item) => `${item.name}-${item.namespace}`}
        renderItem={({ item }) => <PodCard pod={item} />}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          <EmptyState
            icon="layers-outline"
            title="No pods found"
            subtitle={`No pods found in namespace "${namespace}"`}
            actionText="Refresh"
            onAction={onRefresh}
          />
        }
      />

      <ActionModal
        visible={modalVisible}
        title={selectedPod?.name || ''}
        subtitle="Pod Actions"
        actions={getModalActions()}
        onClose={() => setModalVisible(false)}
      />

      <LogsModal />
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
  podCard: {
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
  podHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  podInfo: {
    flex: 1,
  },
  podName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  podNamespace: {
    fontSize: 14,
    color: '#666',
  },
  podStats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
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
  podDetails: {
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
  logsModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  logsModalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  logsModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  logsModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    padding: 4,
  },
  logsContent: {
    flex: 1,
    padding: 24,
  },
  logsText: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: '#333',
    lineHeight: 16,
  },
  noLogsText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 32,
  },
});
