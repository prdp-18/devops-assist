import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface ActionItem {
  id: string;
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  color?: string;
  onPress: () => void;
  danger?: boolean;
  disabled?: boolean;
  loading?: boolean;
}

interface ActionModalProps {
  visible: boolean;
  title: string;
  subtitle?: string;
  actions: ActionItem[];
  onClose: () => void;
  showCloseButton?: boolean;
}

export default function ActionModal({
  visible,
  title,
  subtitle,
  actions,
  onClose,
  showCloseButton = true,
}: ActionModalProps) {
  const [canInteract, setCanInteract] = useState(false);
  const [lastClickTime, setLastClickTime] = useState(0);

  useEffect(() => {
    if (visible) {
      // Prevent auto-triggering by adding a small delay
      console.log('ActionModal: Modal opened, setting canInteract to false initially');
      setCanInteract(false);
      const timer = setTimeout(() => {
        console.log('ActionModal: Setting canInteract to true after delay');
        setCanInteract(true);
      }, 500); // 500ms delay - longer to prevent auto-clicking
      
      return () => clearTimeout(timer);
    }
  }, [visible]);

  const handleActionPress = (action: ActionItem, event: any) => {
    const currentTime = Date.now();
    console.log('ActionModal: handleActionPress called for action:', action.id, 'canInteract:', canInteract);
    
    if (!canInteract) {
      console.log('ActionModal: Ignoring action press - not ready for interaction yet');
      return;
    }
    
    // Prevent rapid clicking (double-click protection)
    if (currentTime - lastClickTime < 1000) {
      console.log('ActionModal: Ignoring rapid click - too soon after last click');
      return;
    }
    
    setLastClickTime(currentTime);
    
    // In React Native, we can't rely on isTrusted property
    // Instead, we use the canInteract state and timing checks
    
    if (!action.disabled) {
      console.log('ActionModal: Calling action.onPress()');
      action.onPress();
      // Don't close modal automatically - let the action handle closing
      // This prevents the modal from closing before async actions can set loading state
    } else {
      console.log('ActionModal: Action is disabled');
    }
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <View style={styles.modalTitleContainer}>
              <Text style={styles.modalTitle}>{title}</Text>
              {subtitle && (
                <Text style={styles.modalSubtitle}>{subtitle}</Text>
              )}
            </View>
            {showCloseButton && (
              <TouchableOpacity
                onPress={onClose}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            )}
          </View>

          <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
            {actions.map((action) => (
              <TouchableOpacity
                key={action.id}
                style={[
                  styles.actionButton,
                  action.danger && styles.dangerButton,
                  action.disabled && styles.disabledButton,
                  action.loading && styles.loadingButton,
                ]}
                onPress={(event) => {
                  console.log('TouchableOpacity onPress triggered for:', action.id, 'event:', event);
                  handleActionPress(action, event);
                }}
                disabled={action.disabled || action.loading || !canInteract}
                activeOpacity={0.7}
              >
                {action.loading ? (
                  <ActivityIndicator
                    size="small"
                    color={
                      action.danger
                        ? '#ff3b30'
                        : action.color || '#2563eb'
                    }
                  />
                ) : (
                  <Ionicons
                    name={action.icon}
                    size={20}
                    color={
                      action.disabled
                        ? '#999'
                        : action.danger
                        ? '#ff3b30'
                        : action.color || '#2563eb'
                    }
                  />
                )}
                <Text
                  style={[
                    styles.actionButtonText,
                    action.danger && styles.dangerText,
                    action.disabled && styles.disabledText,
                    action.loading && styles.loadingText,
                  ]}
                >
                  {action.title}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
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
  modalTitleContainer: {
    flex: 1,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  closeButton: {
    padding: 4,
    marginLeft: 16,
  },
  modalBody: {
    padding: 24,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    marginBottom: 12,
  },
  actionButtonText: {
    fontSize: 16,
    color: '#2563eb',
    marginLeft: 12,
    fontWeight: '500',
  },
  dangerButton: {
    backgroundColor: '#fef2f2',
  },
  dangerText: {
    color: '#ff3b30',
  },
  disabledButton: {
    backgroundColor: '#f5f5f5',
  },
  disabledText: {
    color: '#999',
  },
  loadingButton: {
    opacity: 0.8,
  },
  loadingText: {
    fontStyle: 'italic',
  },
});
