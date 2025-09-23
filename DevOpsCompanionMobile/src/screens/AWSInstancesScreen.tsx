import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
  ActivityIndicator,
  Modal,
  ScrollView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { AuthService } from '../services/AuthService';
import { BiometricService } from '../services/BiometricService';
import { AWSService, AWSInstance } from '../services/AWSService';
import ActionModal from '../components/ActionModal';
import StatusBadge from '../components/StatusBadge';
import LoadingIndicator from '../components/LoadingIndicator';
import EmptyState from '../components/EmptyState';


// Helper function to sanitize text for React Native Web
const sanitizeText = (text: any): string => {
  try {
    if (text === null || text === undefined) return '';
    const str = String(text);
    // Very aggressive sanitization to prevent any text node issues
    return str
      .replace(/[\x00-\x1F\x7F-\x9F]/g, ' ') // Control characters
      .replace(/[^\x20-\x7E]/g, ' ') // Non-printable characters
      .replace(/[.]/g, ' ') // Remove all dots that might cause issues
      .replace(/\s+/g, ' ') // Multiple whitespace
      .trim() || ' '; // Ensure we always return at least a space
  } catch (error) {
    console.warn('Error sanitizing text:', error);
    return ' ';
  }
};

export default function AWSInstancesScreen() {
  const [instances, setInstances] = useState<AWSInstance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedInstance, setSelectedInstance] = useState<AWSInstance | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [outputModalVisible, setOutputModalVisible] = useState(false);
  const [outputContent, setOutputContent] = useState<any>(null); // Can be SSH info or command output
  const [isShowingCommandSelection, setIsShowingCommandSelection] = useState(false); // To show list of commands
  const [rebootModalVisible, setRebootModalVisible] = useState(false);
  const [rebootInstance, setRebootInstance] = useState<AWSInstance | null>(null);
  
  // Loading states for different actions
  const [isExecutingCommand, setIsExecutingCommand] = useState(false);
  const [isGettingSSHInfo, setIsGettingSSHInfo] = useState(false);
  const [isRebooting, setIsRebooting] = useState(false);
  const [executingCommandName, setExecutingCommandName] = useState<string | null>(null);

  useEffect(() => {
    loadInstances();
  }, []);

  // Debug modal visibility changes
  useEffect(() => {
    console.log('ActionModal visibility changed:', modalVisible);
  }, [modalVisible]);

  useEffect(() => {
    console.log('OutputModal visibility changed:', outputModalVisible);
  }, [outputModalVisible]);

  const loadInstances = async (forceRefresh: boolean = false) => {
    try {
      setIsLoading(true);
      console.log('Loading AWS instances, forceRefresh:', forceRefresh);
      
      // Use cache unless force refresh is requested
      const data = await AWSService.getAllInstancesFromAllRegions(!forceRefresh);
      console.log('Loaded instances:', data.length, data);
      setInstances(data);
      
    } catch (error) {
      console.error('Failed to load instances:', error);
      Alert.alert('Error', 'Failed to load AWS instances. Please check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadInstances(true); // Force refresh on pull-to-refresh
    setRefreshing(false);
  };

  const handleRebootInstance = async (instance: AWSInstance) => {
    console.log('handleRebootInstance called for:', instance.name);
    // Show confirmation modal first
    setRebootInstance(instance);
    setRebootModalVisible(true);
  };

  const confirmReboot = async () => {
    if (!rebootInstance) return;

    try {
      setIsRebooting(true);
      
      // Check if biometric authentication is available
      const isBiometricAvailable = await BiometricService.isAvailable();
      
      if (isBiometricAvailable) {
        // Require biometric authentication for critical actions on mobile
      const authenticated = await BiometricService.authenticateForCriticalAction(
          `reboot instance ${rebootInstance.name}`
      );

      if (!authenticated) {
        Alert.alert('Authentication Required', 'Biometric authentication required for this action');
        return;
        }
      }

      const success = await AWSService.rebootInstance(rebootInstance.name, rebootInstance.region);

      if (success) {
        Alert.alert('Success', `Reboot command issued for ${rebootInstance.name}`);
        loadInstances(); // Refresh the list
      } else {
        Alert.alert('Error', 'Failed to reboot instance');
      }
    } catch (error) {
      console.error('Reboot failed:', error);
      Alert.alert('Error', 'Failed to reboot instance. Please try again.');
    } finally {
      setIsRebooting(false);
      setRebootModalVisible(false);
      setRebootInstance(null);
    }
  };

  const handleViewSSHInfo = async (instance: AWSInstance) => {
    try {
      setIsGettingSSHInfo(true);
      console.log('handleViewSSHInfo called for:', instance.name, instance.region);
      
      // Close the action modal first
      setModalVisible(false);
      
      const sshInfoData = await AWSService.getSSHInfo(instance.name, instance.region);
      
      console.log('SSH info received:', sshInfoData);
      
      setOutputContent(sshInfoData);
      setIsShowingCommandSelection(false);
      setOutputModalVisible(true);
    } catch (error) {
      console.error('Failed to get SSH info:', error);
      Alert.alert('Error', `Failed to get SSH information: ${(error as Error).message || 'Unknown error'}`);
    } finally {
      setIsGettingSSHInfo(false);
    }
  };

  const handleShowSystemCommands = async (instance: AWSInstance) => {
    console.log('handleShowSystemCommands called for:', instance.name);
    
    // Close the action modal first
    setModalVisible(false);
    
    // Show the command selection modal
    setSelectedInstance(instance);
    setIsShowingCommandSelection(true);
    setOutputContent(null);
    setOutputModalVisible(true);
  };

  const handleExecuteSystemCommand = async (instance: AWSInstance, command: string) => {
    try {
      setIsExecutingCommand(true);
      setExecutingCommandName(command);
      
      // Execute the command and show results
      const result = await AWSService.executeSystemCommand(instance.name, command, instance.region);
      
      // Show the result in the same modal
      const isSuccess = result.exit_code === 0;
      const errorMessage = result.exit_code !== 0 ? result.output : '';
      
      setOutputContent({
        instance_name: instance.name,
        command: result.command,
        return_code: result.exit_code,
        status: isSuccess ? 'success' : (errorMessage || 'error'),
        stdout: result.output,
        stderr: errorMessage,
        execution_time: result.execution_time
      });
      setIsShowingCommandSelection(false);
      
    } catch (error) {
      console.error('System command execution failed:', error);
      
      // Show detailed error in the modal instead of alert
      const errorMessage = (error as Error).message || 'Unknown error';
      setOutputContent({
        instance_name: instance.name,
        command: command,
        return_code: -1,
        status: `Error: ${errorMessage}`,
        stdout: '',
        stderr: errorMessage,
        execution_time: 0
      });
      setIsShowingCommandSelection(false);
    } finally {
      setIsExecutingCommand(false);
      setExecutingCommandName(null);
    }
  };


  const showCommandSelection = async (instance: AWSInstance) => {
    try {
      // Show command selection modal
      const commonCommands = AWSService.getCommonCommands();
      const commandOptions = commonCommands.map(cmd => ({
        text: cmd.name,
        onPress: () => executeCommand(instance, cmd.command),
      }));

      commandOptions.push({
        text: 'Custom Command',
        onPress: () => showCustomCommandInput(instance),
      });

      Alert.alert(
        'Select Command',
        'Choose a system command to execute:',
        [
          ...commandOptions,
          { text: 'Cancel', style: 'cancel' },
        ]
      );
    } catch (error) {
      console.error('System command failed:', error);
      Alert.alert('Error', 'Failed to execute system command. Please try again.');
    }
  };

  const executeCommand = async (instance: AWSInstance, command: string) => {
    try {
      // Check if biometric authentication is available
      const isBiometricAvailable = await BiometricService.isAvailable();
      
      if (isBiometricAvailable) {
        // Require biometric authentication for system commands
        const authMethod = await BiometricService.getAuthenticationMethodName();
        const authenticated = await BiometricService.authenticateForCriticalAction(
          `Execute system command "${command}" on ${instance.name}`
        );
        
        if (!authenticated) {
          Alert.alert('Authentication Required', `Please authenticate with ${authMethod} to execute system commands.`);
          return;
        }
      } else {
        // Fallback: Show confirmation dialog if biometric is not available
        const confirmed = await new Promise<boolean>((resolve) => {
          Alert.alert(
            'Confirm System Command',
            `Are you sure you want to execute "${command}" on ${instance.name}?`,
            [
              { text: 'Cancel', onPress: () => resolve(false), style: 'cancel' },
              { text: 'Execute', onPress: () => resolve(true), style: 'destructive' }
            ]
          );
        });
        
        if (!confirmed) {
          return;
        }
      }

      console.log('Executing command:', command, 'on:', instance.name, instance.region);
      const result = await AWSService.executeSystemCommand(instance.name, command, instance.region);
      
      console.log('Command result:', result);
      
      Alert.alert(
        'Command Result',
        `Command: ${result.command}\n` +
        `Exit Code: ${result.exit_code}\n` +
        `Execution Time: ${result.execution_time}ms\n\n` +
        `Output:\n${result.output}`,
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Command execution failed:', error);
      Alert.alert('Error', `Failed to execute command: ${(error as Error).message || 'Unknown error'}`);
    }
  };

  const showCustomCommandInput = (instance: AWSInstance) => {
    Alert.prompt(
      'Custom Command',
      'Enter the command to execute:',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Execute',
          onPress: (command: string) => {
            if (command && command.trim()) {
              executeCommand(instance, command.trim());
            }
          },
        },
      ],
      'plain-text'
    );
  };

  const InstanceCard = ({ instance }: { instance: AWSInstance }) => {
    console.log('Rendering InstanceCard for:', instance.name);
    return (
    <TouchableOpacity
      style={styles.instanceCard}
      onPress={() => {
          console.log('AWS Instance card clicked:', instance.name);
          console.log('Setting selectedInstance and opening modal');
        setSelectedInstance(instance);
        setModalVisible(true);
      }}
        activeOpacity={0.7}
        accessible={true}
        accessibilityLabel={`AWS Instance ${instance.name}`}
        accessibilityRole="button"
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        delayPressIn={0}
        delayPressOut={0}
    >
      <View style={styles.instanceHeader}>
        <View style={styles.instanceInfo}>
          <Text style={styles.instanceName}>{instance.name}</Text>
          <Text style={styles.instanceRegion}>{instance.region}</Text>
        </View>
        <StatusBadge status={instance.state} />
      </View>
      
      <View style={styles.instanceStats}>
        <View style={styles.statItem}>
          <Ionicons name="speedometer" size={16} color="#666" />
          <Text style={styles.statText}>{instance.cpu_utilization}% CPU</Text>
        </View>
        {instance.public_ip && (
          <View style={styles.statItem}>
            <Ionicons name="globe" size={16} color="#666" />
            <Text style={styles.statText}>{instance.public_ip}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
  };

  const getModalActions = () => {
    console.log('getModalActions called, selectedInstance:', selectedInstance?.name);
    if (!selectedInstance) return [];

    return [
      {
        id: 'ssh-info',
        title: isGettingSSHInfo ? 'Getting SSH Info...' : 'View SSH Info',
        icon: 'terminal' as keyof typeof Ionicons.glyphMap,
        onPress: () => handleViewSSHInfo(selectedInstance),
        disabled: isGettingSSHInfo || isExecutingCommand || isRebooting,
        loading: isGettingSSHInfo,
      },
      {
        id: 'system-commands',
        title: 'Execute System Command',
        icon: 'terminal' as keyof typeof Ionicons.glyphMap,
        color: '#2563eb',
        onPress: () => handleShowSystemCommands(selectedInstance),
        disabled: isGettingSSHInfo || isExecutingCommand || isRebooting,
      },
      {
        id: 'reboot',
        title: isRebooting ? 'Rebooting...' : 'Reboot Instance',
        icon: 'refresh' as keyof typeof Ionicons.glyphMap,
        color: '#ff3b30',
        danger: true,
        onPress: () => handleRebootInstance(selectedInstance),
        disabled: isGettingSSHInfo || isExecutingCommand || isRebooting,
        loading: isRebooting,
      },
    ];
  };

  const getCategorizedCommands = () => {
    const commonCommands = AWSService.getCommonCommands();
    
    // Group commands by category
    const categories = commonCommands.reduce((acc, command) => {
      if (!acc[command.category]) {
        acc[command.category] = [];
      }
      acc[command.category].push(command);
      return acc;
    }, {} as Record<string, typeof commonCommands>);

    // Convert to array format with category names
    return Object.entries(categories).map(([categoryName, commands]) => ({
      name: categoryName,
      commands: commands,
    }));
  };

  const getSystemCommandActions = () => {
    if (!selectedInstance) return [];

    return [
      {
        id: 'back',
        title: '← Back',
        icon: 'arrow-back' as keyof typeof Ionicons.glyphMap,
        onPress: () => setOutputModalVisible(false),
      },
    ];
  };

  if (isLoading && instances.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <LoadingIndicator message="Loading AWS instances..." fullScreen />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>AWS Lightsail</Text>
        <Text style={styles.headerSubtitle}>
          {instances.length} instance{instances.length !== 1 ? 's' : ''}
        </Text>
      </View>

      <FlatList
        data={instances}
        keyExtractor={(item) => item.name}
        renderItem={({ item }) => {
          console.log('FlatList rendering item:', item.name);
          return <InstanceCard instance={item} />;
        }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          <EmptyState
            icon="cloud-outline"
            title="No instances found"
            subtitle="Pull to refresh or check your AWS configuration"
            actionText="Refresh"
            onAction={onRefresh}
          />
        }
      />

      <ActionModal
        visible={modalVisible}
        title={selectedInstance?.name || ''}
        subtitle="Instance Actions"
        actions={getModalActions()}
        onClose={() => {
          console.log('ActionModal onClose called');
          setModalVisible(false);
        }}
      />

      {/* Output Modal (SSH Info, Command Selection, or Command Output) */}
      <Modal
        visible={outputModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          console.log('OutputModal onRequestClose called');
          setOutputModalVisible(false);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {isShowingCommandSelection ? 'System Commands' : 
                 outputContent?.public_ip ? 'SSH Connection Info' : 
                 'Command Output'}
              </Text>
              <TouchableOpacity
                onPress={() => setOutputModalVisible(false)}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            <ScrollView 
              style={styles.modalBody} 
              showsVerticalScrollIndicator={true}
              contentContainerStyle={{ flexGrow: 1 }}
            >
              {/* Command Selection View */}
              {isShowingCommandSelection && (
                <View style={styles.commandSelectionContainer}>
                  {console.log('Rendering Command Selection for:', selectedInstance?.name)}
                  <Text style={styles.commandSelectionTitle}>Select a system command to execute:</Text>
                  
                  {getCategorizedCommands().map((category) => (
                    <View key={category.name} style={styles.commandCategory}>
                      <Text style={styles.commandCategoryTitle}>{category.name}</Text>
                      <View style={styles.commandButtonsContainer}>
                        {category.commands.map((command) => {
                          const isThisCommandExecuting = isExecutingCommand && executingCommandName === command.command;
                          return (
                            <TouchableOpacity
                              key={command.name}
                              style={[
                                styles.commandButton,
                                isThisCommandExecuting && styles.commandButtonLoading
                              ]}
                              onPress={() => handleExecuteSystemCommand(selectedInstance!, command.command)}
                              disabled={isExecutingCommand}
                            >
                              {isThisCommandExecuting ? (
                                <ActivityIndicator size="small" color="#2563eb" />
                              ) : (
                                <Ionicons name={command.icon as keyof typeof Ionicons.glyphMap} size={20} color="#2563eb" />
                              )}
                              <Text style={[
                                styles.commandButtonText,
                                isThisCommandExecuting && styles.commandButtonTextLoading
                              ]}>
                                {isThisCommandExecuting ? 'Executing...' : command.name}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>
                  ))}
                </View>
              )}

              {/* SSH Info Display */}
              {outputContent?.public_ip && (
                <View style={styles.sshInfoContainer}>
                  {console.log('Rendering SSH Info Display for:', outputContent.instance_name)}
                  <View style={styles.sshInfoItem}>
                    <Text style={styles.sshInfoLabel}>Instance:</Text>
                    <Text style={styles.sshInfoValue}>{sanitizeText(outputContent.instance_name)}</Text>
                  </View>
                  <View style={styles.sshInfoItem}>
                    <Text style={styles.sshInfoLabel}>Public IP:</Text>
                    <Text style={styles.sshInfoValue}>{sanitizeText(outputContent.public_ip)}</Text>
                  </View>
                  <View style={styles.sshInfoItem}>
                    <Text style={styles.sshInfoLabel}>Username:</Text>
                    <Text style={styles.sshInfoValue}>{sanitizeText(outputContent.username)}</Text>
                  </View>
                  <View style={styles.sshInfoItem}>
                    <Text style={styles.sshInfoLabel}>SSH Key:</Text>
                    <Text style={styles.sshInfoValue}>{sanitizeText(outputContent.ssh_key_name)}</Text>
                  </View>
                  <View style={styles.sshInfoItem}>
                    <Text style={styles.sshInfoLabel}>SSH Command:</Text>
                    <Text style={styles.sshCommand}>{sanitizeText(outputContent.ssh_command)}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.copyButton}
                    onPress={() => {
                      // Copy SSH command to clipboard (if available)
                      if (navigator && navigator.clipboard) {
                        navigator.clipboard.writeText(outputContent.ssh_command);
                        Alert.alert('Copied', 'SSH command copied to clipboard');
                      }
                    }}
                  >
                    <Ionicons name="copy" size={16} color="#2563eb" />
                    <Text style={styles.copyButtonText}>Copy SSH Command</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Command Execution Results Display */}
              {outputContent?.command && !isShowingCommandSelection && (
                <View style={styles.commandOutputContainer}>
                  <View style={styles.sshInfoItem}>
                    <Text style={[styles.sshInfoLabel, { color: '#2563eb', fontWeight: 'bold' }]}>Command:</Text>
                    <Text style={[styles.sshInfoValue, { color: '#333', fontFamily: 'monospace' }]}>{sanitizeText(outputContent.command)}</Text>
                  </View>
                  <View style={styles.sshInfoItem}>
                    <Text style={[styles.sshInfoLabel, { color: '#059669', fontWeight: 'bold' }]}>Return Code:</Text>
                    <Text style={[styles.sshInfoValue, { 
                      color: outputContent.return_code === 0 ? '#22c55e' : '#ef4444',
                      fontWeight: 'bold',
                      fontSize: 16
                    }]}>
                      {sanitizeText(outputContent.return_code)}
                    </Text>
                  </View>
                  <View style={styles.sshInfoItem}>
                    <Text style={[styles.sshInfoLabel, { color: '#dc2626', fontWeight: 'bold' }]}>Status:</Text>
                    <Text style={[styles.sshInfoValue, { 
                      color: outputContent.status === 'success' ? '#22c55e' : '#ef4444',
                      fontWeight: 'bold',
                      textTransform: 'uppercase'
                    }]}>
                      {sanitizeText(outputContent.status)}
                    </Text>
                  </View>
                  {outputContent.stdout && sanitizeText(outputContent.stdout) && (
                    <View style={styles.sshInfoItem}>
                      <Text style={[styles.sshInfoLabel, { color: '#059669', fontWeight: 'bold' }]}>STDOUT:</Text>
                      <View style={styles.commandOutputTextContainer}>
                        <Text style={[styles.commandOutput, { color: '#333', fontFamily: 'monospace' }]}>
                          {sanitizeText(outputContent.stdout) || 'No output'}
                        </Text>
                      </View>
                    </View>
                  )}
                  {outputContent.stderr && sanitizeText(outputContent.stderr) && (
                    <View style={styles.sshInfoItem}>
                      <Text style={[styles.sshInfoLabel, { color: '#dc2626', fontWeight: 'bold' }]}>STDERR:</Text>
                      <View style={styles.commandOutputTextContainer}>
                        <Text style={[styles.commandOutput, { color: '#333', fontFamily: 'monospace' }]}>
                          {sanitizeText(outputContent.stderr) || 'No error output'}
                        </Text>
                      </View>
                    </View>
                  )}
                  <View style={styles.commandOutputActions}>
                    <TouchableOpacity
                      style={[styles.copyButton, { flex: 1, marginRight: 8 }]}
                      onPress={() => {
                        // Copy command output to clipboard (if available)
                        const output = `Command: ${outputContent.command}\nReturn Code: ${outputContent.return_code}\nStatus: ${outputContent.status}\n\n${outputContent.stdout ? `STDOUT:\n${outputContent.stdout}\n\n` : ''}${outputContent.stderr ? `STDERR:\n${outputContent.stderr}` : ''}`;
                        if (navigator && navigator.clipboard) {
                          navigator.clipboard.writeText(output);
                          Alert.alert('Copied', 'Command output copied to clipboard');
                        }
                      }}
                    >
                      <Ionicons name="copy" size={16} color="#2563eb" />
                      <Text style={styles.copyButtonText}>Copy Output</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                      style={[styles.copyButton, { flex: 1, marginLeft: 8, backgroundColor: '#f8fafc' }]}
                      onPress={() => {
                        // Go back to command selection
                        setIsShowingCommandSelection(true);
                        setOutputContent(null);
                      }}
                    >
                      <Ionicons name="arrow-back" size={16} color="#2563eb" />
                      <Text style={styles.copyButtonText}>Run Another</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
              </ScrollView>
            </View>
          </View>
        </Modal>

      {/* Reboot Confirmation Modal */}
      <Modal
        visible={rebootModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setRebootModalVisible(false)}
      >
        <View style={styles.rebootModalOverlay}>
          <View style={styles.rebootModalContent}>
            <View style={styles.rebootModalHeader}>
              <Ionicons name="refresh" size={24} color="#ff3b30" />
              <Text style={styles.rebootModalTitle}>Reboot your instance?</Text>
            </View>
            
            <View style={styles.rebootModalBody}>
              <Text style={styles.rebootWarningText}>
                Rebooting makes any website or service on your instance temporarily unavailable.
              </Text>
              
              {rebootInstance && (
                <View style={styles.rebootInstanceInfo}>
                  <Text style={styles.rebootInstanceLabel}>Instance:</Text>
                  <Text style={styles.rebootInstanceName}>{rebootInstance.name}</Text>
                  <Text style={styles.rebootInstanceRegion}>{rebootInstance.region}</Text>
                </View>
              )}
              
              <Text style={styles.rebootQuestionText}>
                Do you want to reboot your instance?
              </Text>
            </View>
            
            <View style={styles.rebootModalActions}>
              <TouchableOpacity
                style={styles.rebootCancelButton}
                onPress={() => setRebootModalVisible(false)}
                disabled={isRebooting}
              >
                <Text style={styles.rebootCancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.rebootConfirmButton,
                  isRebooting && styles.rebootConfirmButtonLoading
                ]}
                onPress={confirmReboot}
                disabled={isRebooting}
              >
                {isRebooting ? (
                  <>
                    <ActivityIndicator size="small" color="#fff" style={{ marginRight: 8 }} />
                    <Text style={styles.rebootConfirmButtonText}>Rebooting...</Text>
                  </>
                ) : (
                  <Text style={styles.rebootConfirmButtonText}>Reboot</Text>
                )}
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
  instanceCard: {
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
  instanceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  instanceInfo: {
    flex: 1,
  },
  instanceName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  instanceRegion: {
    fontSize: 14,
    color: '#666',
  },
  stateBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  stateText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  instanceStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 4,
  },
  // SSH Info Modal Styles
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
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  closeButton: {
    padding: 4,
    marginLeft: 16,
  },
  modalBody: {
    padding: 32,
    flex: 1,
  },
  sshInfoContainer: {
    gap: 20,
  },
  sshInfoItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  sshInfoLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  sshInfoValue: {
    fontSize: 18,
    color: '#666',
    flex: 2,
    textAlign: 'right',
  },
  sshCommand: {
    fontSize: 16,
    color: '#2563eb',
    flex: 2,
    textAlign: 'right',
    fontFamily: 'monospace',
    backgroundColor: '#f8fafc',
    padding: 8,
    borderRadius: 4,
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    marginTop: 16,
  },
  copyButtonText: {
    fontSize: 16,
    color: '#2563eb',
    marginLeft: 8,
    fontWeight: '500',
  },
  commandOutputContainer: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginTop: 8,
  },
  commandOutput: {
    fontSize: 14,
    color: '#333',
    fontFamily: 'monospace',
    lineHeight: 20,
  },
  commandSelectionContainer: {
    padding: 16,
  },
  commandSelectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 20,
    textAlign: 'center',
  },
  commandCategory: {
    marginBottom: 24,
  },
  commandCategoryTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  commandButtonsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'center',
  },
  commandButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    minWidth: 100,
    flex: 1,
    maxWidth: 140,
    justifyContent: 'center',
  },
  commandButtonText: {
    fontSize: 14,
    color: '#2563eb',
    fontWeight: '500',
    marginLeft: 8,
  },
  commandButtonLoading: {
    opacity: 0.7,
    backgroundColor: '#f0f9ff',
  },
  commandButtonTextLoading: {
    color: '#1d4ed8',
    fontStyle: 'italic',
  },
  commandOutputTextContainer: {
    backgroundColor: '#f8fafc',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
    minHeight: 100,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  commandOutputActions: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 8,
  },
  // Reboot Confirmation Modal Styles
  rebootModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  rebootModalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    width: '100%',
    maxWidth: 400,
    ...(Platform.OS === 'web' ? {
      boxShadow: '0px 10px 10px rgba(0, 0, 0, 0.25)',
    } : {
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 10,
      },
      shadowOpacity: 0.25,
      shadowRadius: 10,
      elevation: 10,
    }),
  },
  rebootModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  rebootModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginLeft: 12,
  },
  rebootModalBody: {
    padding: 24,
    paddingTop: 16,
  },
  rebootWarningText: {
    fontSize: 16,
    color: '#666',
    lineHeight: 24,
    marginBottom: 20,
  },
  rebootInstanceInfo: {
    backgroundColor: '#f8fafc',
    padding: 16,
    borderRadius: 8,
    marginBottom: 20,
  },
  rebootInstanceLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  rebootInstanceName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  rebootInstanceRegion: {
    fontSize: 14,
    color: '#2563eb',
  },
  rebootQuestionText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
    textAlign: 'center',
  },
  rebootModalActions: {
    flexDirection: 'row',
    padding: 24,
    paddingTop: 16,
    gap: 12,
  },
  rebootCancelButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#f59e0b',
    backgroundColor: '#fff',
  },
  rebootCancelButtonText: {
    fontSize: 16,
    color: '#f59e0b',
    fontWeight: '600',
    textAlign: 'center',
  },
  rebootConfirmButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#ef4444',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rebootConfirmButtonLoading: {
    opacity: 0.8,
  },
  rebootConfirmButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
    textAlign: 'center',
  },
});
