import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface StatusBadgeProps {
  status: string;
  size?: 'small' | 'medium' | 'large';
  showIcon?: boolean;
}

export default function StatusBadge({ 
  status, 
  size = 'medium', 
  showIcon = false 
}: StatusBadgeProps) {
  const getStatusConfig = (status: string) => {
    if (!status || typeof status !== 'string') {
      return {
        color: '#8e8e93',
        backgroundColor: '#f5f5f5',
        text: 'Unknown',
      };
    }
    
    const normalizedStatus = status.toLowerCase();
    
    if (normalizedStatus.includes('running') || normalizedStatus.includes('ready') || normalizedStatus.includes('active')) {
      return {
        color: '#34c759',
        backgroundColor: '#d4f8d4',
        text: 'Running',
      };
    }
    
    if (normalizedStatus.includes('stopped') || normalizedStatus.includes('notready') || normalizedStatus.includes('failed')) {
      return {
        color: '#ff3b30',
        backgroundColor: '#fef2f2',
        text: 'Stopped',
      };
    }
    
    if (normalizedStatus.includes('pending') || normalizedStatus.includes('waiting')) {
      return {
        color: '#ff9500',
        backgroundColor: '#fff4e6',
        text: 'Pending',
      };
    }
    
    if (normalizedStatus.includes('warning') || normalizedStatus.includes('degraded')) {
      return {
        color: '#ff9500',
        backgroundColor: '#fff4e6',
        text: 'Warning',
      };
    }
    
    // Default case
    return {
      color: '#8e8e93',
      backgroundColor: '#f5f5f5',
      text: status,
    };
  };

  const config = getStatusConfig(status);
  
  const getSizeStyles = () => {
    switch (size) {
      case 'small':
        return {
          paddingHorizontal: 6,
          paddingVertical: 2,
          fontSize: 10,
          borderRadius: 4,
        };
      case 'large':
        return {
          paddingHorizontal: 12,
          paddingVertical: 6,
          fontSize: 14,
          borderRadius: 8,
        };
      default: // medium
        return {
          paddingHorizontal: 8,
          paddingVertical: 4,
          fontSize: 12,
          borderRadius: 6,
        };
    }
  };

  const sizeStyles = getSizeStyles();

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: config.backgroundColor,
          paddingHorizontal: sizeStyles.paddingHorizontal,
          paddingVertical: sizeStyles.paddingVertical,
          borderRadius: sizeStyles.borderRadius,
        },
      ]}
    >
      <Text
        style={[
          styles.text,
          {
            color: config.color,
            fontSize: sizeStyles.fontSize,
          },
        ]}
      >
        {config.text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
  },
  text: {
    fontWeight: '600',
    textTransform: 'capitalize',
  },
});
