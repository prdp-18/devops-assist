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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { GKEService } from '../services/GKEService';
import { ErrorHandler } from '../services/ErrorHandler';
import StatusBadge from '../components/StatusBadge';
import LoadingIndicator from '../components/LoadingIndicator';
import EmptyState from '../components/EmptyState';

interface GKENamespace {
  name: string;
  id: string;
  status?: string;
  creationTimestamp?: string;
  labels?: any;
}

interface GKENamespacesScreenProps {
  clusterName: string;
  location: string;
  onBack: () => void;
  onViewPods: (namespace: string, pods?: any[]) => void;
}

export default function GKENamespacesScreen({ 
  clusterName, 
  location, 
  onBack, 
  onViewPods 
}: GKENamespacesScreenProps) {
  const [namespaces, setNamespaces] = useState<GKENamespace[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [namespacePodCounts, setNamespacePodCounts] = useState<Record<string, number>>({});
  const [allPods, setAllPods] = useState<any[]>([]);

  useEffect(() => {
    loadNamespaces();
  }, []);

  useEffect(() => {
    if (namespaces.length > 0) {
      loadPodCounts();
    }
  }, [namespaces]);

  const loadNamespaces = async () => {
    try {
      setIsLoading(true);
      console.log('Loading namespaces for cluster:', clusterName, 'location:', location);
      const data = await GKEService.getNamespaces(clusterName, location);
      console.log('Loaded namespaces:', data.length, data);
      
      // Handle namespace objects from API response
      const namespaceObjects = data.map((namespace, index) => {
        // If namespace is already an object, use it directly
        if (typeof namespace === 'object' && namespace !== null) {
          return {
            name: namespace.name || 'Unknown',
            id: `${namespace.name || 'unknown'}-${index}`,
            status: namespace.status,
            creationTimestamp: namespace.creation_timestamp,
            labels: namespace.labels
          };
        }
        // If namespace is a string, convert it to object
        return {
          name: namespace,
          id: `${namespace}-${index}`,
          status: undefined,
          creationTimestamp: undefined,
          labels: undefined
        };
      });
      setNamespaces(namespaceObjects);
    } catch (error) {
      console.error('Failed to load namespaces:', error);
      await ErrorHandler.handleApiError(error as Error, 'Loading namespaces');
    } finally {
      setIsLoading(false);
    }
  };

  const loadPodCounts = async () => {
    try {
      console.log('Loading pod counts for namespaces...');
      
      // Get all pods at once instead of individual calls per namespace
      const allPods = await GKEService.getAllPods(clusterName, location);
      console.log('Loaded all pods for counting:', allPods.length);
      
      // Store the pod data for later use
      setAllPods(allPods);
      
      // Group pods by namespace
      const podCounts: Record<string, number> = {};
      namespaces.forEach(namespace => {
        podCounts[namespace.name] = allPods.filter(pod => pod.namespace === namespace.name).length;
        console.log(`Namespace ${namespace.name}: ${podCounts[namespace.name]} pods`);
      });
      
      setNamespacePodCounts(podCounts);
      console.log('Pod counts loaded:', podCounts);
    } catch (error) {
      console.error('Failed to load pod counts:', error);
      // Set all counts to 0 on error
      const podCounts: Record<string, number> = {};
      namespaces.forEach(namespace => {
        podCounts[namespace.name] = 0;
      });
      setNamespacePodCounts(podCounts);
    }
  };

const onRefresh = async () => {
    setRefreshing(true);
    await loadNamespaces();
    setRefreshing(false);
  };

  const NamespaceCard = ({ namespace }: { namespace: GKENamespace }) => {
    const podCount = namespacePodCounts[namespace.name] ?? '...';
    
    return (
      <TouchableOpacity
        style={styles.namespaceCard}
        onPress={() => onViewPods(namespace.name, allPods)}
        activeOpacity={0.7}
      >
        <View style={styles.namespaceHeader}>
          <View style={styles.namespaceInfo}>
            <Text style={styles.namespaceName}>{namespace.name}</Text>
            <Text style={styles.namespaceType}>
              Kubernetes Namespace • {podCount} pod{podCount !== 1 ? 's' : ''}
            </Text>
          </View>
          <View style={styles.namespaceActions}>
            <TouchableOpacity
              style={styles.viewPodsButton}
              onPress={() => onViewPods(namespace.name, allPods)}
            >
              <Ionicons name="cube" size={16} color="#2563eb" />
              <Text style={styles.viewPodsText}>View Pods</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (isLoading && namespaces.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <LoadingIndicator message="Loading namespaces..." fullScreen />
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
          <Text style={styles.headerTitle}>Namespaces</Text>
          <Text style={styles.headerSubtitle}>in {clusterName}</Text>
        </View>
        <TouchableOpacity onPress={onRefresh} style={styles.refreshButton}>
          <Ionicons name="refresh" size={24} color="#666" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={namespaces}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <NamespaceCard namespace={item} />}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          <EmptyState
            icon="folder-outline"
            title="No namespaces found"
            subtitle="Pull to refresh or check your cluster configuration"
            onAction={onRefresh}
          />
        }
      />
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
  namespaceCard: {
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
  namespaceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  namespaceInfo: {
    flex: 1,
  },
  namespaceName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 4,
  },
  namespaceType: {
    fontSize: 13,
    color: '#7f8c8d',
  },
  namespaceActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  viewPodsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f9ff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e0f2fe',
  },
  viewPodsText: {
    fontSize: 13,
    color: '#2563eb',
    marginLeft: 4,
    fontWeight: '500',
  },
});
