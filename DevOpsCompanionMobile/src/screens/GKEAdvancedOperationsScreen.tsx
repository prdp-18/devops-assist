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
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  ActivityIndicator,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { GKEService } from '../services/GKEService';
import { BiometricService } from '../services/BiometricService';
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
  
  // Undo/Redo functionality
  const [yamlHistory, setYamlHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  
  // Loading states for advanced operations
  const [isDownloadingYaml, setIsDownloadingYaml] = useState(false);
  const [isViewingYaml, setIsViewingYaml] = useState(false);
  const [isEditingYamlFile, setIsEditingYamlFile] = useState(false);
  const [isSavingYaml, setIsSavingYaml] = useState(false);

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
      setIsDownloadingYaml(true);
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
        Alert.alert('Success', `Downloaded ${filename} successfully`);
      } else {
        // Fallback: copy to clipboard
        await Clipboard.setStringAsync(yaml);
        Alert.alert('Success', `YAML copied to clipboard (${filename})`);
      }
      
      setActionsModalVisible(false);
    } catch (error) {
      Alert.alert('Error', `Failed to download YAML: ${(error as Error).message}`);
    } finally {
      setIsDownloadingYaml(false);
    }
  };

  const handleViewYaml = async () => {
    if (!selectedResource) return;
    
    try {
      setIsViewingYaml(true);
      const yaml = await GKEService.getResourceYaml(clusterName, location, selectedResource.namespace, resourceType, selectedResource.name);
      setYamlContent(yaml);
      // Initialize history with the loaded YAML
      setYamlHistory([yaml]);
      setHistoryIndex(0);
      setIsEditingYaml(false); // Set to view mode
      setYamlModalVisible(true);
      setActionsModalVisible(false);
    } catch (error) {
      Alert.alert('Error', `Failed to get YAML: ${(error as Error).message}`);
    } finally {
      setIsViewingYaml(false);
    }
  };

  const handleEditResource = async () => {
    if (!selectedResource) return;
    
    try {
      setIsEditingYamlFile(true);
      const yaml = await GKEService.getResourceYaml(clusterName, location, selectedResource.namespace, resourceType, selectedResource.name);
      setYamlContent(yaml);
      // Initialize history with the loaded YAML
      setYamlHistory([yaml]);
      setHistoryIndex(0);
      setIsEditingYaml(true);
      setYamlModalVisible(true);
      setActionsModalVisible(false);
    } catch (error) {
      Alert.alert('Error', `Failed to get YAML for editing: ${(error as Error).message}`);
    } finally {
      setIsEditingYamlFile(false);
    }
  };

  // Add to history when YAML content changes
  const addToHistory = (content: string) => {
    setYamlHistory(prev => {
      const newHistory = prev.slice(0, historyIndex + 1);
      newHistory.push(content);
      // Keep only last 50 changes to prevent memory issues
      if (newHistory.length > 50) {
        newHistory.shift();
      } else {
        setHistoryIndex(newHistory.length - 1);
      }
      return newHistory;
    });
  };

  // Undo function
  const undoYaml = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setYamlContent(yamlHistory[newIndex]);
    }
  };

  // Redo function
  const redoYaml = () => {
    if (historyIndex < yamlHistory.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setYamlContent(yamlHistory[newIndex]);
    }
  };

  // Handle YAML content changes with history
  const handleYamlChange = (text: string) => {
    setYamlContent(text);
    // Debounce history updates to avoid too many entries
    setTimeout(() => {
      addToHistory(text);
    }, 1000);
  };

  // Enhanced Kubernetes YAML validation
  const validateKubernetesYaml = (yaml: string): string[] => {
    const errors: string[] = [];
    const lines = yaml.split('\n');
    
    try {
      // Check for Deployment-specific validation
      if (yaml.includes('kind: Deployment')) {
        let hasSpec = false;
        let hasSelector = false;
        let hasTemplate = false;
        let hasTemplateLabels = false;
        let hasContainers = false;
        let selectorMatch = false;
        let containersIsArray = false;
        
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          
          if (line.startsWith('spec:')) {
            hasSpec = true;
          }
          
          if (hasSpec && line.startsWith('selector:')) {
            hasSelector = true;
          }
          
          if (hasSpec && line.startsWith('template:')) {
            hasTemplate = true;
          }
          
          if (hasTemplate && line.startsWith('labels:')) {
            hasTemplateLabels = true;
          }
          
          // Check for containers field
          if (hasTemplate && line.startsWith('containers:')) {
            hasContainers = true;
            // Check if next line starts with '-' (indicating array)
            if (i + 1 < lines.length && lines[i + 1].trim().startsWith('-')) {
              containersIsArray = true;
            }
          }
          
          // Check for mapping values error (common YAML issue)
          if (line.includes(':') && !line.endsWith(':') && !line.includes(' ')) {
            // This might be a mapping values error
            const nextLine = i + 1 < lines.length ? lines[i + 1].trim() : '';
            if (nextLine && !nextLine.startsWith('-') && !nextLine.startsWith(' ') && nextLine.includes(':')) {
              errors.push(`• Line ${i + 1}: Possible mapping values error - check indentation and structure`);
            }
          }
          
          // Check if selector matches template labels
          if (hasSelector && hasTemplateLabels) {
            // This is a simplified check - in real implementation, you'd parse the YAML properly
            const selectorLine = lines.find(l => l.trim().startsWith('selector:'));
            const labelsLine = lines.find(l => l.trim().startsWith('labels:'));
            
            if (selectorLine && labelsLine) {
              // Basic check - if both exist, assume they match for now
              // In a real implementation, you'd parse the actual key-value pairs
              selectorMatch = true;
            }
          }
        }
        
        if (!hasSpec) {
          errors.push('• Missing required field: spec');
        }
        
        if (!hasSelector) {
          errors.push('• Missing required field: spec.selector');
        }
        
        if (!hasTemplate) {
          errors.push('• Missing required field: spec.template');
        }
        
        if (!hasTemplateLabels) {
          errors.push('• Missing required field: spec.template.metadata.labels');
        }
        
        if (!hasContainers) {
          errors.push('• Missing required field: spec.template.spec.containers');
        }
        
        if (hasContainers && !containersIsArray) {
          errors.push('• spec.template.spec.containers must be an array (list items should start with "-")');
        }
        
        if (hasSelector && hasTemplateLabels && !selectorMatch) {
          errors.push('• spec.selector does not match spec.template.metadata.labels');
        }
      }
      
      // Check for Service-specific validation
      if (yaml.includes('kind: Service')) {
        let hasSpec = false;
        let hasSelector = false;
        let hasPorts = false;
        
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          
          if (line.startsWith('spec:')) {
            hasSpec = true;
          }
          
          if (hasSpec && line.startsWith('selector:')) {
            hasSelector = true;
          }
          
          if (hasSpec && line.startsWith('ports:')) {
            hasPorts = true;
          }
        }
        
        if (!hasSpec) {
          errors.push('• Missing required field: spec');
        }
        
        if (!hasPorts) {
          errors.push('• Missing required field: spec.ports');
        }
      }
      
      // Check for ConfigMap-specific validation
      if (yaml.includes('kind: ConfigMap')) {
        let hasData = false;
        
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          
          if (line.startsWith('data:')) {
            hasData = true;
            break;
          }
        }
        
        if (!hasData) {
          errors.push('• Missing required field: data');
        }
      }
      
      // Check for Secret-specific validation
      if (yaml.includes('kind: Secret')) {
        let hasData = false;
        
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          
          if (line.startsWith('data:')) {
            hasData = true;
            break;
          }
        }
        
        if (!hasData) {
          errors.push('• Missing required field: data');
        }
      }
      
    } catch (error) {
      errors.push('• YAML parsing error: ' + (error as Error).message);
    }
    
    return errors;
  };

  const handleSaveYaml = async () => {
    if (!selectedResource || !yamlContent) return;
    
    try {
      setIsSavingYaml(true);
      
      // Basic YAML validation
      const trimmedYaml = yamlContent.trim();
      if (!trimmedYaml) {
        Alert.alert('Validation Error', 'YAML content cannot be empty');
        return;
      }
      
      // Check for basic YAML structure
      if (!trimmedYaml.includes('apiVersion:') || !trimmedYaml.includes('kind:')) {
        Alert.alert('Validation Error', 'Invalid YAML: Missing required fields (apiVersion, kind)');
        return;
      }
      
      // Enhanced YAML validation for Kubernetes resources
      const validationErrors = validateKubernetesYaml(trimmedYaml);
      if (validationErrors.length > 0) {
        Alert.alert(
          'YAML Validation Failed', 
          `The YAML contains errors that would cause the deployment to fail:\n\n${validationErrors.join('\n')}\n\nPlease fix these errors before saving. The deployment will not be modified.`,
          [{ text: 'OK' }]
        );
        return;
      }
      
      // Check for common YAML syntax issues
      const lines = trimmedYaml.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmedLine = line.trim();
        
        // Check for tabs (should use spaces)
        if (line.includes('\t')) {
          Alert.alert('Validation Error', `YAML syntax error on line ${i + 1}: Tabs are not allowed in YAML. Please use spaces for indentation.`);
          return;
        }
        
        // Check for missing colons after keys
        if (trimmedLine && !trimmedLine.startsWith('-') && !trimmedLine.startsWith('#') && 
            !trimmedLine.includes(':') && !trimmedLine.startsWith(' ') && 
            !trimmedLine.includes('{') && !trimmedLine.includes('}') &&
            !trimmedLine.includes('[') && !trimmedLine.includes(']')) {
          Alert.alert('Validation Error', `YAML syntax error on line ${i + 1}: "${trimmedLine}"\n\nThis line appears to be missing a colon (:) after the key. YAML requires colons to separate keys from values.\n\nLine ${i + 1}: ${trimmedLine}`);
          return;
        }
      }
      
      // Check if biometric authentication is available
      const isBiometricAvailable = await BiometricService.isAvailable();
      
      if (isBiometricAvailable) {
        // Require biometric authentication for YAML editing
        const authMethod = await BiometricService.getAuthenticationMethodName();
        const authenticated = await BiometricService.authenticateForCriticalAction(
          `Edit ${resourceType.slice(0, -1)} "${selectedResource.name}"`
        );
        
        if (!authenticated) {
          Alert.alert('Authentication Required', `Please authenticate with ${authMethod} to edit YAML files.`);
          return;
        }
      } else {
        // Fallback: Show confirmation dialog if biometric is not available
        const confirmed = await new Promise<boolean>((resolve) => {
          Alert.alert(
            'Confirm YAML Edit',
            `Are you sure you want to update ${resourceType.slice(0, -1)} "${selectedResource.name}"?`,
            [
              { text: 'Cancel', onPress: () => resolve(false), style: 'cancel' },
              { text: 'Update', onPress: () => resolve(true), style: 'destructive' }
            ]
          );
        });
        
        if (!confirmed) {
          return;
        }
      }

      console.log('Sending YAML to backend:', trimmedYaml.substring(0, 200) + '...');
      await GKEService.updateResourceYaml(clusterName, location, selectedResource.namespace, resourceType, selectedResource.name, trimmedYaml);
      Alert.alert('Success', `${resourceType.slice(0, -1)} updated successfully`);
      setYamlModalVisible(false);
      setIsEditingYaml(false);
      loadResources(); // Refresh the list
        } catch (error) {
          console.error('YAML save error:', error);
          const errorMessage = (error as Error).message;
          
          // Check if this is a validation error from the server
          if (errorMessage.includes('500') && errorMessage.includes('invalid')) {
            Alert.alert(
              'Deployment Validation Failed', 
              'The server rejected the YAML changes because they would create an invalid deployment. The original deployment remains unchanged.\n\nThis is the same behavior as kubectl - invalid changes are not applied to protect your cluster.\n\nPlease review the YAML and fix any validation errors before trying again.',
              [{ text: 'OK' }]
            );
          } else if (errorMessage.includes('yaml: line') && errorMessage.includes('could not find expected')) {
            Alert.alert(
              'YAML Syntax Error', 
              'The YAML contains syntax errors. Common issues:\n\n• Missing colons (:) after keys\n• Incorrect indentation\n• Invalid list formatting\n• Special characters in values\n\nPlease check the line mentioned in the error and ensure proper YAML syntax.\n\nThe deployment was not modified.',
              [{ text: 'OK' }]
            );
          } else if (errorMessage.includes('yaml: line') && errorMessage.includes('mapping values are not allowed')) {
            Alert.alert(
              'YAML Syntax Error', 
              'The YAML contains syntax errors. Please check:\n\n• Proper indentation (use spaces, not tabs)\n• Correct colon placement\n• Proper list formatting\n• No trailing spaces after colons\n\nLine numbers in the error message can help identify the issue.\n\nThe deployment was not modified.',
              [{ text: 'OK' }]
            );
          } else if (errorMessage.includes('yaml: line')) {
            Alert.alert(
              'YAML Parsing Error', 
              `YAML syntax error detected. Please check the formatting around the mentioned line.\n\nError: ${errorMessage}\n\nCommon fixes:\n• Ensure proper indentation\n• Check for missing colons\n• Verify list formatting\n• Remove any invalid characters\n\nThe deployment was not modified.`,
              [{ text: 'OK' }]
            );
          } else if (errorMessage.includes('selector') && errorMessage.includes('does not match')) {
            Alert.alert(
              'Deployment Configuration Error', 
              'The deployment selector does not match the template labels. This is a common Kubernetes validation error.\n\nFix:\n• Ensure spec.selector.matchLabels matches spec.template.metadata.labels\n• Both must have the same key-value pairs\n\nThe deployment was not modified.',
              [{ text: 'OK' }]
            );
          } else if (errorMessage.includes('cannot unmarshal object into Go struct field') && errorMessage.includes('containers')) {
            Alert.alert(
              'Container Configuration Error', 
              'The containers field is malformed. This usually happens when:\n\n• containers is not formatted as an array\n• Missing "-" before container items\n• Incorrect indentation\n\nFix:\n• Ensure containers: is followed by a list starting with "-"\n• Check indentation is correct\n\nThe deployment was not modified.',
              [{ text: 'OK' }]
            );
          } else if (errorMessage.includes('mapping values are not allowed in this context')) {
            Alert.alert(
              'YAML Structure Error', 
              'YAML structure error detected. This usually means:\n\n• Incorrect indentation\n• Missing colons after keys\n• Invalid nesting structure\n• Mixed list and mapping syntax\n\nFix:\n• Check indentation (use spaces, not tabs)\n• Ensure proper colon placement\n• Verify list items start with "-"\n\nThe deployment was not modified.',
              [{ text: 'OK' }]
            );
          } else {
            Alert.alert(
              'Save Failed', 
              `Failed to update ${resourceType.slice(0, -1)}: ${errorMessage}\n\nThe deployment was not modified.`,
              [{ text: 'OK' }]
            );
          }
        } finally {
          setIsSavingYaml(false);
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
          <Text style={styles.resourceDetail}>
            Ports: {Array.isArray(resource.ports) 
              ? resource.ports.map((port: any) => `${port.port}:${port.targetPort}/${port.protocol}`).join(', ')
              : resource.ports
            }
          </Text>
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
                style={[styles.actionButton, isViewingYaml && styles.actionButtonDisabled]}
                onPress={handleViewYaml}
                disabled={isViewingYaml}
              >
                {isViewingYaml ? (
                  <ActivityIndicator size="small" color="#2563eb" />
                ) : (
                  <Ionicons name="eye" size={20} color="#2563eb" />
                )}
                <Text style={[styles.actionText, isViewingYaml && styles.actionTextDisabled]}>
                  {isViewingYaml ? 'Loading...' : 'View YAML'}
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.actionButton, isDownloadingYaml && styles.actionButtonDisabled]}
                onPress={handleDownloadYaml}
                disabled={isDownloadingYaml}
              >
                {isDownloadingYaml ? (
                  <ActivityIndicator size="small" color="#059669" />
                ) : (
                  <Ionicons name="download" size={20} color="#059669" />
                )}
                <Text style={[styles.actionText, isDownloadingYaml && styles.actionTextDisabled]}>
                  {isDownloadingYaml ? 'Downloading...' : 'Download YAML'}
                </Text>
              </TouchableOpacity>
              
              {resourceType === 'deployments' && (
                <TouchableOpacity
                  style={[styles.actionButton, isEditingYamlFile && styles.actionButtonDisabled]}
                  onPress={handleEditResource}
                  disabled={isEditingYamlFile}
                >
                  {isEditingYamlFile ? (
                    <ActivityIndicator size="small" color="#2563eb" />
                  ) : (
                    <Ionicons name="create" size={20} color="#2563eb" />
                  )}
                  <Text style={[styles.actionText, isEditingYamlFile && styles.actionTextDisabled]}>
                    {isEditingYamlFile ? 'Loading...' : 'Edit Deployment'}
                  </Text>
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
        <TouchableWithoutFeedback onPress={() => Keyboard.dismiss()}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback onPress={() => {}}>
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
                  <View style={styles.yamlEditorContainer}>
                    {/* Line Numbers */}
                    <View style={styles.lineNumbersContainer}>
                      {yamlContent.split('\n').map((_, index) => (
                        <Text key={index} style={styles.lineNumber}>
                          {index + 1}
                        </Text>
                      ))}
                    </View>
                    {/* YAML Content */}
                    <TextInput
                      ref={textInputRef}
                      style={[styles.yamlInput, { fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' }]}
                      value={yamlContent}
                      onChangeText={handleYamlChange}
                      multiline
                      textAlignVertical="top"
                      onSubmitEditing={() => {
                        // Return key adds newline
                        const newContent = yamlContent + '\n';
                        setYamlContent(newContent);
                        addToHistory(newContent);
                      }}
                      returnKeyType="default"
                      blurOnSubmit={false}
                      keyboardType="default"
                      autoCapitalize="none"
                      autoCorrect={false}
                      enablesReturnKeyAutomatically={false}
                    />
                  </View>
                </View>
              ) : (
                <TextInput
                  style={[styles.yamlText, { fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' }]}
                  value={yamlContent}
                  editable={false}
                  multiline={true}
                  scrollEnabled={true}
                  textBreakStrategy="simple"
                  dataDetectorTypes={[]}
                  selectTextOnFocus={false}
                  selectionColor="#2563eb"
                />
              )}
            </ScrollView>
            {isEditingYaml ? (
              <View style={styles.yamlActions}>
                <TouchableOpacity
                  style={[styles.undoButton, historyIndex <= 0 && styles.undoButtonDisabled]}
                  onPress={undoYaml}
                  disabled={historyIndex <= 0}
                >
                  <Ionicons name="arrow-undo" size={14} color={historyIndex <= 0 ? "#9ca3af" : "#2563eb"} />
                  <Text style={[styles.undoButtonText, historyIndex <= 0 && styles.undoButtonTextDisabled]}>
                    Undo
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.redoButton, historyIndex >= yamlHistory.length - 1 && styles.redoButtonDisabled]}
                  onPress={redoYaml}
                  disabled={historyIndex >= yamlHistory.length - 1}
                >
                  <Ionicons name="arrow-redo" size={14} color={historyIndex >= yamlHistory.length - 1 ? "#9ca3af" : "#2563eb"} />
                  <Text style={[styles.redoButtonText, historyIndex >= yamlHistory.length - 1 && styles.redoButtonTextDisabled]}>
                    Redo
                  </Text>
                </TouchableOpacity>
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
                  style={[styles.saveButton, isSavingYaml && styles.saveButtonDisabled]}
                  onPress={() => {
                    Keyboard.dismiss();
                    handleSaveYaml();
                  }}
                  disabled={isSavingYaml}
                >
                  {isSavingYaml ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Ionicons name="save" size={14} color="#fff" />
                  )}
                  <Text style={styles.saveButtonText}>
                    {isSavingYaml ? 'Saving...' : 'Save Changes'}
                  </Text>
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
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
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
  actionButtonDisabled: {
    opacity: 0.6,
    backgroundColor: '#f1f5f9',
  },
  actionTextDisabled: {
    color: '#64748b',
  },
  saveButtonDisabled: {
    opacity: 0.6,
    backgroundColor: '#dc2626',
  },
  textInputContainer: {
    flex: 1,
    position: 'relative',
  },
  yamlEditorContainer: {
    flex: 1,
    flexDirection: 'row',
  },
  lineNumbersContainer: {
    backgroundColor: '#f1f5f9',
    paddingVertical: 12,
    paddingHorizontal: 6,
    borderTopLeftRadius: 8,
    borderBottomLeftRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRightWidth: 0,
    minWidth: 40,
    alignItems: 'flex-end',
  },
  lineNumber: {
    fontSize: 12,
    fontFamily: 'monospace',
    color: '#64748b',
    lineHeight: 20,
    textAlign: 'right',
    minWidth: 25,
    width: 25,
  },
  yamlInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'monospace',
    color: '#333',
    backgroundColor: '#f8fafc',
    padding: 12,
    borderTopRightRadius: 8,
    borderBottomRightRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderLeftWidth: 0,
    textAlignVertical: 'top',
    paddingBottom: 50, // Space for Done button
  },
  yamlText: {
    fontSize: 14,
    fontFamily: 'monospace',
    color: '#333',
    lineHeight: 20,
    flex: 1,
    textAlignVertical: 'top',
    padding: 0,
    margin: 0,
  },
  yamlActions: {
    flexDirection: 'row',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    gap: 8,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cancelButtonText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  undoButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f0f9ff',
    borderRadius: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2563eb',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  undoButtonDisabled: {
    backgroundColor: '#f9fafb',
    borderColor: '#e5e7eb',
  },
  undoButtonText: {
    fontSize: 14,
    color: '#2563eb',
    fontWeight: '500',
    marginLeft: 6,
  },
  undoButtonTextDisabled: {
    color: '#9ca3af',
  },
  redoButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f0f9ff',
    borderRadius: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2563eb',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  redoButtonDisabled: {
    backgroundColor: '#f9fafb',
    borderColor: '#e5e7eb',
  },
  redoButtonText: {
    fontSize: 14,
    color: '#2563eb',
    fontWeight: '500',
    marginLeft: 6,
  },
  redoButtonTextDisabled: {
    color: '#9ca3af',
  },
  saveButton: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#2563eb',
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '500',
    marginLeft: 6,
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
