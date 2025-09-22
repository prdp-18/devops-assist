import React, { useState, useEffect, useRef } from 'react';
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
  TextInput,
  Keyboard,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { GKEService } from '../services/GKEService';
import StatusBadge from '../components/StatusBadge';
import LoadingIndicator from '../components/LoadingIndicator';
import EmptyState from '../components/EmptyState';

interface GKEResource {
  name: string;
  namespace: string;
  status?: string;
  replicas?: string;
  age?: string;
  type?: string;
  image?: string;
  ports?: string;
  clusterIP?: string;
  externalIP?: string;
}

interface GKEAdvancedOperationsScreenProps {
  clusterName: string;
  location: string;
  namespace: string;
  resourceType: 'deployments' | 'services' | 'ingresses' | 'secrets' | 'service-accounts';
  onBack: () => void;
}

export default function GKEAdvancedOperationsScreen({ 
  clusterName, 
  location, 
  namespace, 
  resourceType,
  onBack 
}: GKEAdvancedOperationsScreenProps) {
  const [resources, setResources] = useState<GKEResource[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedResource, setSelectedResource] = useState<GKEResource | null>(null);
  const [actionsModalVisible, setActionsModalVisible] = useState(false);
  const [yamlModalVisible, setYamlModalVisible] = useState(false);
  const [yamlContent, setYamlContent] = useState('');
  const [isEditingYaml, setIsEditingYaml] = useState(false);
  const textInputRef = useRef<TextInput>(null);

  useEffect(() => {
    loadResources();
  }, [resourceType]);

  const loadResources = async () => {
    try {
      setIsLoading(true);
      console.log('Loading', resourceType, 'for cluster:', clusterName, 'namespace:', namespace);
      
      let data: any[] = [];
      switch (resourceType) {
        case 'deployments':
          data = await GKEService.getDeployments(clusterName, location, namespace);
          break;
        case 'services':
          data = await GKEService.getServices(clusterName, location, namespace);
          break;
        case 'ingresses':
          data = await GKEService.getIngresses(clusterName, location, namespace);
          break;
        case 'secrets':
          data = await GKEService.getSecrets(clusterName, location, namespace);
          break;
        case 'service-accounts':
          data = await GKEService.getServiceAccounts(clusterName, location, namespace);
          break;
      }
      
      console.log('Loaded', resourceType, ':', data.length, data);
      setResources(data);
    } catch (error) {
      console.error('Failed to load', resourceType, ':', error);
      Alert.alert('Error', `Failed to load ${resourceType}: ${(error as Error).message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadResources();
    setRefreshing(false);
  };

  const handleResourceActions = (resource: GKEResource) => {
    setSelectedResource(resource);
    setActionsModalVisible(true);
  };

  const handleDownloadYaml = async () => {
    if (!selectedResource) return;
    
    try {
      const yaml = await GKEService.getResourceYaml(clusterName, location, selectedResource.namespace, resourceType, selectedResource.name);
      
      // Create filename based on resource type and name
      const filename = `${selectedResource.name}-${resourceType}.yaml`;
      
      // Write YAML content to a temporary file
      const fileUri = FileSystem.documentDirectory + filename;
      await FileSystem.writeAsStringAsync(fileUri, yaml);
      
      // Share/download the file
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'text/yaml',
          dialogTitle: `Download ${filename}`,
        });
        Alert.alert('Success', `Downloaded ${filename}`);
      } else {
        // Fallback: copy to clipboard
        await Clipboard.setStringAsync(yaml);
        Alert.alert('Success', `YAML copied to clipboard (${filename})`);
      }
      
      setActionsModalVisible(false);
    } catch (error) {
      Alert.alert('Error', `Failed to download YAML: ${(error as Error).message}`);
    }
  };

  const handleViewYaml = async () => {
    if (!selectedResource) return;
    
    try {
      const yaml = await GKEService.getResourceYaml(clusterName, location, selectedResource.namespace, resourceType, selectedResource.name);
      setYamlContent(yaml);
      setIsEditingYaml(false); // Set to view mode
      setYamlModalVisible(true);
      setActionsModalVisible(false);
    } catch (error) {
      Alert.alert('Error', `Failed to get YAML: ${(error as Error).message}`);
    }
  };

  const handleEditResource = async () => {
    if (!selectedResource) return;
    
    try {
      const yaml = await GKEService.getResourceYaml(clusterName, location, selectedResource.namespace, resourceType, selectedResource.name);
      setYamlContent(yaml);
      setIsEditingYaml(true);
      setYamlModalVisible(true);
      setActionsModalVisible(false);
    } catch (error) {
      Alert.alert('Error', `Failed to get YAML for editing: ${(error as Error).message}`);
    }
  };

  const handleSaveYaml = async () => {
    if (!selectedResource || !yamlContent) return;
    
    try {
      await GKEService.updateResourceYaml(clusterName, location, selectedResource.namespace, resourceType, selectedResource.name, yamlContent);
      Alert.alert('Success', `${resourceType.slice(0, -1)} updated successfully`);
      setYamlModalVisible(false);
      setIsEditingYaml(false);
      loadResources(); // Refresh the list
    } catch (error) {
      Alert.alert('Error', `Failed to update ${resourceType.slice(0, -1)}: ${(error as Error).message}`);
    }
  };

  const getResourceIcon = () => {
    switch (resourceType) {
      case 'deployments': return 'layers';
      case 'services': return 'globe';
      case 'ingresses': return 'link';
      case 'secrets': return 'lock-closed';
      case 'service-accounts': return 'person';
      default: return 'cube';
    }
  };

  const getResourceTitle = () => {
    switch (resourceType) {
      case 'deployments': return 'Deployments';
      case 'services': return 'Services';
      case 'ingresses': return 'Ingresses';
      case 'secrets': return 'Secrets';
      case 'service-accounts': return 'Service Accounts';
      default: return 'Resources';
    }
  };

  const ResourceCard = ({ resource }: { resource: GKEResource }) => (
    <View style={styles.resourceCard}>
      <View style={styles.resourceHeader}>
        <View style={styles.resourceInfo}>
          <Text style={styles.resourceName}>{resource.name}</Text>
          {resource.status && <StatusBadge status={resource.status} />}
        </View>
        <TouchableOpacity
          style={styles.actionsButton}
          onPress={() => handleResourceActions(resource)}
        >
          <Ionicons name="ellipsis-horizontal" size={20} color="#666" />
        </TouchableOpacity>
      </View>
      
      <View style={styles.resourceDetails}>
        {resource.replicas && (
          <Text style={styles.resourceDetail}>Replicas: {resource.replicas}</Text>
        )}
        {resource.age && (
          <Text style={styles.resourceDetail}>Age: {resource.age}</Text>
        )}
        {resource.image && (
          <Text style={styles.resourceDetail}>Image: {resource.image}</Text>
        )}
        {resource.ports && (
          <Text style={styles.resourceDetail}>Ports: {resource.ports}</Text>
        )}
        {resource.clusterIP && (
          <Text style={styles.resourceDetail}>Cluster IP: {resource.clusterIP}</Text>
        )}
        {resource.externalIP && (
          <Text style={styles.resourceDetail}>External IP: {resource.externalIP}</Text>
        )}
      </View>
    </View>
  );

  if (isLoading && resources.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <LoadingIndicator message={`Loading ${getResourceTitle()}...`} fullScreen />
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
          <View style={styles.headerTitleRow}>
            <Ionicons name={getResourceIcon()} size={20} color="#2563eb" />
            <Text style={styles.headerTitle}>{getResourceTitle()}</Text>
          </View>
          <Text style={styles.headerSubtitle}>in {namespace}</Text>
        </View>
        <TouchableOpacity onPress={onRefresh} style={styles.refreshButton}>
          <Ionicons name="refresh" size={24} color="#666" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={resources}
        keyExtractor={(item, index) => `${item.name}-${index}`}
        renderItem={({ item }) => <ResourceCard resource={item} />}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          <EmptyState
            icon={getResourceIcon()}
            title={`No ${getResourceTitle().toLowerCase()} found`}
            subtitle="Pull to refresh or check your namespace configuration"
            onAction={onRefresh}
          />
        }
      />

      {/* Resource Actions Modal */}
      <Modal
        visible={actionsModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setActionsModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{selectedResource?.name}</Text>
              <TouchableOpacity
                onPress={() => setActionsModalVisible(false)}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={handleViewYaml}
              >
                <Ionicons name="eye" size={20} color="#2563eb" />
                <Text style={styles.actionText}>View YAML</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.actionButton}
                onPress={handleDownloadYaml}
              >
                <Ionicons name="download" size={20} color="#059669" />
                <Text style={styles.actionText}>Download YAML</Text>
              </TouchableOpacity>
              
              {resourceType === 'deployments' && (
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={handleEditResource}
                >
                  <Ionicons name="create" size={20} color="#2563eb" />
                  <Text style={styles.actionText}>Edit Deployment</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>

      {/* YAML Modal */}
      <Modal
        visible={yamlModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setYamlModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {isEditingYaml ? 'Edit' : 'View'} YAML
              </Text>
              <TouchableOpacity
                onPress={() => {
                  Keyboard.dismiss();
                  setYamlModalVisible(false);
                }}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody}>
              {isEditingYaml ? (
                <View style={styles.textInputContainer}>
                  <TextInput
                    ref={textInputRef}
                    style={styles.yamlInput}
                    value={yamlContent}
                    onChangeText={setYamlContent}
                    multiline
                    textAlignVertical="top"
                    fontFamily="monospace"
                    onBlur={() => Keyboard.dismiss()}
                    onSubmitEditing={() => {
                      // Default behavior - add newline
                      setYamlContent(prev => prev + '\n');
                    }}
                    returnKeyType="default"
                    blurOnSubmit={false}
                    keyboardType="default"
                    autoCapitalize="none"
                    autoCorrect={false}
                    enablesReturnKeyAutomatically={false}
                  />
                  <View style={styles.keyboardControls}>
                    <TouchableOpacity
                      style={styles.enterButton}
                      onPress={() => {
                        // Add newline to YAML content
                        setYamlContent(prev => prev + '\n');
                      }}
                    >
                      <Ionicons name="return-up" size={16} color="#fff" />
                      <Text style={styles.enterButtonText}>ENTER</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.doneButton}
                      onPress={() => Keyboard.dismiss()}
                    >
                      <Ionicons name="checkmark" size={16} color="#fff" />
                      <Text style={styles.doneButtonText}>DONE</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <Text style={styles.yamlText}>
                  {yamlContent}
                </Text>
              )}
            </ScrollView>
            {isEditingYaml ? (
              <View style={styles.yamlActions}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => {
                    Keyboard.dismiss();
                    setYamlModalVisible(false);
                    setIsEditingYaml(false);
                  }}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.saveButton}
                  onPress={() => {
                    Keyboard.dismiss();
                    handleSaveYaml();
                  }}
                >
                  <Ionicons name="save" size={16} color="#fff" />
                  <Text style={styles.saveButtonText}>Save Changes</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.yamlActions}>
                <TouchableOpacity
                  style={styles.copyButton}
                  onPress={async () => {
                    try {
                      await Clipboard.setStringAsync(yamlContent);
                      Alert.alert('Success', 'YAML copied to clipboard!');
                    } catch (error) {
                      Alert.alert('Error', 'Failed to copy to clipboard');
                    }
                  }}
                >
                  <Ionicons name="copy" size={16} color="#fff" />
                  <Text style={styles.copyButtonText}>Copy to Clipboard</Text>
                </TouchableOpacity>
              </View>
            )}
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
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginLeft: 8,
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
  resourceCard: {
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
  resourceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  resourceInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  resourceName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
    marginRight: 8,
  },
  actionsButton: {
    padding: 8,
  },
  resourceDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  resourceDetail: {
    fontSize: 13,
    color: '#666',
    marginRight: 16,
    marginBottom: 4,
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
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    marginBottom: 12,
  },
  actionText: {
    fontSize: 16,
    color: '#333',
    marginLeft: 12,
    fontWeight: '500',
  },
  textInputContainer: {
    flex: 1,
    position: 'relative',
  },
  yamlInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'monospace',
    color: '#333',
    backgroundColor: '#f8fafc',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    textAlignVertical: 'top',
    paddingBottom: 50, // Space for Done button
  },
  doneButton: {
    backgroundColor: '#dc2626',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minWidth: 80,
  },
  doneButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  keyboardControls: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    flexDirection: 'row',
    gap: 12,
    zIndex: 1000,
  },
  enterButton: {
    backgroundColor: '#059669',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minWidth: 80,
  },
  enterButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  yamlText: {
    fontSize: 14,
    fontFamily: 'monospace',
    color: '#333',
    lineHeight: 20,
  },
  yamlActions: {
    flexDirection: 'row',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  saveButton: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#2563eb',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '500',
    marginLeft: 8,
  },
  copyButton: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#059669',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copyButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '500',
    marginLeft: 8,
  },
});
