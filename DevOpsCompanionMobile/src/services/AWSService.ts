import { AuthService } from './AuthService';
import { instanceCache } from './InstanceCache';

export interface AWSInstance {
  name: string;
  state: string;
  region: string;
  cpu_utilization: number;
  public_ip?: string;
  private_ip?: string;
  instance_type?: string;
  created_at?: string;
}

export interface SSHInfo {
  instance_name: string;
  public_ip: string;
  username: string;
  ssh_command: string;
  private_key_path?: string;
}

export interface SystemCommandResult {
  command: string;
  output: string;
  exit_code: number;
  execution_time: number;
}

export class AWSService {
  /**
   * Get all AWS Lightsail instances from a specific region or all regions
   */
  static async getInstances(region?: string): Promise<AWSInstance[]> {
    try {
      const url = region ? `/api/instances?region=${region}` : '/api/instances';
      const response = await AuthService.authenticatedRequest(url);
      
      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(`Failed to fetch instances: ${response.status} - ${errorText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Failed to get AWS instances:', error);
      throw error;
    }
  }

  /**
   * Get instances from all regions
   */
  static async getAllInstancesFromAllRegions(useCache: boolean = true): Promise<AWSInstance[]> {
    // Check cache first if requested
    if (useCache) {
      const cachedInstances = instanceCache.getInstances();
      if (cachedInstances) {
        // console.log(`Using cached instances: ${cachedInstances.length} instances`);
        return cachedInstances;
      }
    }

    const regions = [
      'us-east-1', 'us-east-2', 'us-west-2',
      'eu-west-1', 'eu-west-2', 'eu-central-1',
      'ap-southeast-1', 'ap-southeast-2', 'ap-northeast-1',
      'ca-central-1'
    ];

    const allInstances: AWSInstance[] = [];
    
    // Process regions in parallel for better performance
    const regionPromises = regions.map(async (region) => {
      try {
        const instances = await this.getInstances(region);
        // console.log(`Found ${instances.length} instances in ${region}`);
        return instances;
      } catch (error) {
        // Only log as warning for 500 errors (region not supported/configured)
        if (error.message && error.message.includes('500')) {
          console.warn(`Region ${region} not supported or not configured:`, error.message);
        } else {
          console.warn(`Failed to get instances from ${region}:`, error);
        }
        return []; // Return empty array for failed regions
      }
    });
    
    try {
      const results = await Promise.all(regionPromises);
      
      // Flatten all results
      results.forEach(instances => {
        allInstances.push(...instances);
      });
      
      // console.log(`Total instances found: ${allInstances.length}`);
      
      // Cache the results
      instanceCache.setInstances(allInstances);
      
      return allInstances;
    } catch (error) {
      console.error('Error in getAllInstancesFromAllRegions:', error);
      throw error;
    }
  }

  /**
   * Reboot a specific Lightsail instance
   */
  static async rebootInstance(instanceName: string, region?: string): Promise<boolean> {
    try {
      const url = region ? `/api/instances/${instanceName}/reboot?region=${region}` : `/api/instances/${instanceName}/reboot`;
      const response = await AuthService.authenticatedRequest(url, { method: 'POST' });
      
      return response.ok;
    } catch (error) {
      console.error('Failed to reboot instance:', error);
      throw error;
    }
  }

  /**
   * Get SSH connection information for an instance
   */
  static async getSSHInfo(instanceName: string, region?: string): Promise<SSHInfo> {
    try {
      const url = region ? `/api/instances/${instanceName}/ssh-info?region=${region}` : `/api/instances/${instanceName}/ssh-info`;
      const response = await AuthService.authenticatedRequest(url);
      
      if (!response.ok) {
        throw new Error(`Failed to get SSH info: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Failed to get SSH info:', error);
      throw error;
    }
  }

  /**
   * Execute a system command on an instance via SSH
   */
  static async executeSystemCommand(
    instanceName: string,
    command: string,
    region?: string
  ): Promise<SystemCommandResult> {
    try {
      // Send command as URL parameter like the web-app does
      let url = `/api/instances/${instanceName}/system-command?command=${encodeURIComponent(command)}`;
      if (region) {
        url += `&region=${region}`;
      }
      
      const response = await AuthService.authenticatedRequest(url, {
        method: 'POST',
      });
      
      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        let errorMessage = `Failed to execute command: ${response.status}`;
        
        try {
          const errorData = JSON.parse(errorText);
          if (errorData.detail) {
            errorMessage = errorData.detail;
          }
        } catch {
          // If not JSON, use the raw text
          if (errorText && errorText.trim()) {
            errorMessage = errorText;
          }
        }
        
        throw new Error(errorMessage);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Failed to execute system command:', error);
      throw error;
    }
  }

  /**
   * Get instance details
   */
  static async getInstanceDetails(instanceName: string): Promise<AWSInstance> {
    try {
      const response = await AuthService.authenticatedRequest(
        `/api/instances/${instanceName}`
      );
      
      if (!response.ok) {
        throw new Error(`Failed to get instance details: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Failed to get instance details:', error);
      throw error;
    }
  }

  /**
   * Get instance state
   */
  static async getInstanceState(instanceName: string): Promise<{ state: string }> {
    try {
      const response = await AuthService.authenticatedRequest(
        `/api/instances/${instanceName}/state`
      );
      
      if (!response.ok) {
        throw new Error(`Failed to get instance state: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Failed to get instance state:', error);
      throw error;
    }
  }

  /**
   * Common system commands for quick access
   */
  static getCommonCommands(): Array<{ name: string; command: string; description: string; icon: string; category: string }> {
    return [
      // System Maintenance
      {
        name: 'Sync',
        command: 'sudo sync',
        description: 'Synchronize cached writes to persistent storage',
        icon: 'sync',
        category: 'System Maintenance',
      },
      {
        name: 'Drop Caches',
        command: 'sudo sh -c \'echo 3 > /proc/sys/vm/drop_caches\'',
        description: 'Clear system caches to free memory',
        icon: 'trash',
        category: 'System Maintenance',
      },
      
      // Bitnami Services
      {
        name: 'Bitnami Status',
        command: 'sudo /opt/bitnami/ctlscript.sh status',
        description: 'Check status of all Bitnami services',
        icon: 'checkmark-circle',
        category: 'Bitnami Services',
      },
      {
        name: 'Bitnami Start',
        command: 'sudo /opt/bitnami/ctlscript.sh start',
        description: 'Start all Bitnami services',
        icon: 'play-circle',
        category: 'Bitnami Services',
      },
      {
        name: 'Bitnami Restart',
        command: 'sudo /opt/bitnami/ctlscript.sh restart',
        description: 'Restart all Bitnami services',
        icon: 'refresh-circle',
        category: 'Bitnami Services',
      },
      
      // System Info
      {
        name: 'Memory Usage',
        command: 'free -h',
        description: 'Check memory usage',
        icon: 'server',
        category: 'System Info',
      },
      {
        name: 'Disk Usage',
        command: 'df -h',
        description: 'Check disk usage',
        icon: 'hardware-chip',
        category: 'System Info',
      },
      {
        name: 'System Uptime',
        command: 'uptime',
        description: 'Check system uptime and load',
        icon: 'time',
        category: 'System Info',
      },
      {
        name: 'System Info',
        command: 'uname -a && uptime && df -h',
        description: 'Get comprehensive system information',
        icon: 'information-circle',
        category: 'System Info',
      },
      {
        name: 'Running Processes',
        command: 'ps aux | head -20',
        description: 'List running processes',
        icon: 'list',
        category: 'System Info',
      },
      {
        name: 'System Logs',
        command: 'tail -n 50 /var/log/syslog',
        description: 'View recent system logs',
        icon: 'document-text',
        category: 'System Info',
      },
    ];
  }
}
