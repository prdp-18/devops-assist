import { AuthService } from './AuthService';

export interface GKECluster {
  name: string;
  location?: string;
  region?: string;
  status: string;
  nodeCount?: number;
  node_count?: number;
  version: string;
  endpoint?: string;
  masterAuth?: any;
}

export interface GKENode {
  name: string;
  status: string;
  role: string;
  version: string;
  internalIP: string;
  externalIP?: string;
  machineType?: string;
  zone?: string;
}

export interface GKEPod {
  name: string;
  namespace: string;
  status: string;
  ready: string;
  restarts: number;
  age: string;
  ip?: string;
  node?: string;
  image?: string;
}

export interface GKEDeployment {
  name: string;
  namespace: string;
  ready: string;
  upToDate: string;
  available: string;
  age: string;
  replicas: number;
}

export interface GKELogs {
  podName: string;
  namespace: string;
  logs: string[];
  timestamp: string;
}

export interface GKEPodDescription {
  name: string;
  namespace: string;
  status: any;
  spec: any;
  metadata: any;
  events: any[];
}

export class GKEService {
  /**
   * Get all GKE clusters for a specific location
   */
  static async getClusters(location?: string): Promise<GKECluster[]> {
    try {
      const endpoint = location 
        ? `/api/gcp/clusters?location=${location}`
        : '/api/gcp/clusters';
        
      const response = await AuthService.authenticatedRequest(endpoint);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch clusters: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Failed to get GKE clusters:', error);
      throw error;
    }
  }

  /**
   * Get default GKE regions and zones
   */
  static getDefaultLocations(): Array<{ value: string; label: string; group: string }> {
    return [
      // Regions
      { value: 'us-central1', label: 'us-central1 (Iowa)', group: 'Regions' },
      { value: 'us-east1', label: 'us-east1 (S. Carolina)', group: 'Regions' },
      { value: 'us-west1', label: 'us-west1 (Oregon)', group: 'Regions' },
      { value: 'europe-west1', label: 'europe-west1 (Belgium)', group: 'Regions' },
      { value: 'europe-west2', label: 'europe-west2 (London)', group: 'Regions' },
      { value: 'asia-east1', label: 'asia-east1 (Taiwan)', group: 'Regions' },
      { value: 'asia-southeast1', label: 'asia-southeast1 (Singapore)', group: 'Regions' },
      
      // Zones
      { value: 'us-central1-a', label: 'us-central1-a', group: 'Zones' },
      { value: 'us-central1-b', label: 'us-central1-b', group: 'Zones' },
      { value: 'us-central1-c', label: 'us-central1-c', group: 'Zones' },
      { value: 'us-east1-b', label: 'us-east1-b', group: 'Zones' },
      { value: 'us-east1-c', label: 'us-east1-c', group: 'Zones' },
      { value: 'us-east1-d', label: 'us-east1-d', group: 'Zones' },
      { value: 'us-west1-a', label: 'us-west1-a', group: 'Zones' },
      { value: 'us-west1-b', label: 'us-west1-b', group: 'Zones' },
      { value: 'us-west1-c', label: 'us-west1-c', group: 'Zones' },
      { value: 'europe-west1-b', label: 'europe-west1-b', group: 'Zones' },
      { value: 'europe-west1-c', label: 'europe-west1-c', group: 'Zones' },
      { value: 'europe-west1-d', label: 'europe-west1-d', group: 'Zones' },
    ];
  }

  /**
   * Get namespaces in a cluster
   */
  static async getNamespaces(clusterName: string, clusterLocation: string): Promise<string[]> {
    try {
      const response = await AuthService.authenticatedRequest(
        `/api/gcp/clusters/${clusterName}/namespaces?cluster_location=${clusterLocation}`
      );
      
      if (!response.ok) {
        throw new Error(`Failed to fetch namespaces: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Failed to get namespaces:', error);
      throw error;
    }
  }

  /**
   * Get nodes in a cluster
   */
  static async getNodes(clusterName: string, clusterLocation: string): Promise<GKENode[]> {
    try {
      const response = await AuthService.authenticatedRequest(
        `/api/gcp/clusters/${clusterName}/nodes?cluster_location=${clusterLocation}`
      );
      
      if (!response.ok) {
        throw new Error(`Failed to fetch nodes: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Failed to get nodes:', error);
      throw error;
    }
  }

  /**
   * Get pods in a specific namespace
   */
  static async getPods(
    clusterName: string,
    namespace: string,
    clusterLocation: string
  ): Promise<GKEPod[]> {
    try {
      const response = await AuthService.authenticatedRequest(
        `/api/gcp/clusters/${clusterName}/namespaces/${namespace}/pods?cluster_location=${clusterLocation}`
      );
      
      if (!response.ok) {
        throw new Error(`Failed to fetch pods: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Failed to get pods:', error);
      throw error;
    }
  }

  /**
   * Get all pods across all namespaces
   */
  static async getAllPods(clusterName: string, clusterLocation: string): Promise<GKEPod[]> {
    try {
      const response = await AuthService.authenticatedRequest(
        `/api/gcp/clusters/${clusterName}/pods/all?cluster_location=${clusterLocation}`
      );
      
      if (!response.ok) {
        throw new Error(`Failed to fetch all pods: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Failed to get all pods:', error);
      throw error;
    }
  }

  /**
   * Restart a pod
   */
  static async restartPod(
    clusterName: string,
    namespace: string,
    podName: string,
    clusterLocation: string
  ): Promise<boolean> {
    try {
      const response = await AuthService.authenticatedRequest(
        `/api/gcp/clusters/${clusterName}/namespaces/${namespace}/pods/${podName}/restart?cluster_location=${clusterLocation}`,
        { method: 'POST' }
      );
      
      return response.ok;
    } catch (error) {
      console.error('Failed to restart pod:', error);
      throw error;
    }
  }

  /**
   * Delete a pod
   */
  static async deletePod(
    clusterName: string,
    namespace: string,
    podName: string,
    clusterLocation: string
  ): Promise<boolean> {
    try {
      const response = await AuthService.authenticatedRequest(
        `/api/gcp/clusters/${clusterName}/namespaces/${namespace}/pods/${podName}?cluster_location=${clusterLocation}`,
        { method: 'DELETE' }
      );
      
      return response.ok;
    } catch (error) {
      console.error('Failed to delete pod:', error);
      throw error;
    }
  }

  /**
   * Get pod logs
   */
  static async getPodLogs(
    clusterName: string,
    namespace: string,
    podName: string,
    clusterLocation: string,
    lines: number = 100
  ): Promise<GKELogs> {
    try {
      const response = await AuthService.authenticatedRequest(
        `/api/gcp/clusters/${clusterName}/namespaces/${namespace}/pods/${podName}/logs?cluster_location=${clusterLocation}&lines=${lines}`
      );
      
      if (!response.ok) {
        throw new Error(`Failed to fetch pod logs: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Failed to get pod logs:', error);
      throw error;
    }
  }

  /**
   * Get pod description/details
   */
  static async getPodDescription(
    clusterName: string,
    namespace: string,
    podName: string,
    clusterLocation: string
  ): Promise<GKEPodDescription> {
    try {
      const response = await AuthService.authenticatedRequest(
        `/api/gcp/clusters/${clusterName}/namespaces/${namespace}/pods/${podName}/describe?cluster_location=${clusterLocation}`
      );
      
      if (!response.ok) {
        throw new Error(`Failed to fetch pod description: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Failed to get pod description:', error);
      throw error;
    }
  }

  /**
   * Get deployments
   */
  static async getDeployments(
    clusterName: string,
    clusterLocation: string,
    namespace?: string
  ): Promise<GKEDeployment[]> {
    try {
      const endpoint = namespace 
        ? `/api/gcp/clusters/${clusterName}/namespaces/${namespace}/deployments?cluster_location=${clusterLocation}`
        : `/api/gcp/clusters/${clusterName}/deployments?cluster_location=${clusterLocation}`;
        
      const response = await AuthService.authenticatedRequest(endpoint);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch deployments: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Failed to get deployments:', error);
      throw error;
    }
  }

  /**
   * Scale a deployment
   */
  static async scaleDeployment(
    clusterName: string,
    namespace: string,
    deploymentName: string,
    replicas: number,
    clusterLocation: string
  ): Promise<boolean> {
    try {
      const response = await AuthService.authenticatedRequest(
        `/api/gcp/clusters/${clusterName}/namespaces/${namespace}/deployments/${deploymentName}/scale?cluster_location=${clusterLocation}`,
        {
          method: 'POST',
          body: JSON.stringify({ replicas }),
        }
      );
      
      return response.ok;
    } catch (error) {
      console.error('Failed to scale deployment:', error);
      throw error;
    }
  }

  /**
   * Get cluster health summary
   */
  static async getClusterHealth(clusterName: string, clusterLocation: string): Promise<{
    totalPods: number;
    runningPods: number;
    pendingPods: number;
    failedPods: number;
    totalNodes: number;
    readyNodes: number;
    notReadyNodes: number;
  }> {
    try {
      const [pods, nodes] = await Promise.all([
        this.getAllPods(clusterName, clusterLocation),
        this.getNodes(clusterName, clusterLocation),
      ]);

      const runningPods = pods.filter(pod => pod.status === 'Running').length;
      const pendingPods = pods.filter(pod => pod.status === 'Pending').length;
      const failedPods = pods.filter(pod => pod.status === 'Failed').length;
      
      const readyNodes = nodes.filter(node => node.status === 'Ready').length;
      const notReadyNodes = nodes.filter(node => node.status !== 'Ready').length;

      return {
        totalPods: pods.length,
        runningPods,
        pendingPods,
        failedPods,
        totalNodes: nodes.length,
        readyNodes,
        notReadyNodes,
      };
    } catch (error) {
      console.error('Failed to get cluster health:', error);
      throw error;
    }
  }

  /**
   * Get pods for a specific namespace
   */
  static async getPods(clusterName: string, clusterLocation: string, namespace: string): Promise<GKEPod[]> {
    try {
      const response = await AuthService.authenticatedRequest(
        `/api/gcp/clusters/${clusterName}/namespaces/${namespace}/pods?cluster_location=${clusterLocation}`
      );
      return response;
    } catch (error) {
      console.error('Failed to get pods:', error);
      throw error;
    }
  }

  /**
   * Restart a pod
   */
  static async restartPod(clusterName: string, clusterLocation: string, namespace: string, podName: string): Promise<void> {
    try {
      await AuthService.authenticatedRequest(
        `/api/gcp/clusters/${clusterName}/namespaces/${namespace}/pods/${podName}/restart?cluster_location=${clusterLocation}`,
        'POST'
      );
    } catch (error) {
      console.error('Failed to restart pod:', error);
      throw error;
    }
  }

  /**
   * Get pod logs
   */
  static async getPodLogs(clusterName: string, clusterLocation: string, namespace: string, podName: string): Promise<string> {
    try {
      const response = await AuthService.authenticatedRequest(
        `/api/gcp/clusters/${clusterName}/namespaces/${namespace}/pods/${podName}/logs?cluster_location=${clusterLocation}`
      );
      return response.logs || '';
    } catch (error) {
      console.error('Failed to get pod logs:', error);
      throw error;
    }
  }

  /**
   * Describe a pod
   */
  static async describePod(clusterName: string, clusterLocation: string, namespace: string, podName: string): Promise<string> {
    try {
      const response = await AuthService.authenticatedRequest(
        `/api/gcp/clusters/${clusterName}/namespaces/${namespace}/pods/${podName}/describe?cluster_location=${clusterLocation}`
      );
      return response.description || '';
    } catch (error) {
      console.error('Failed to describe pod:', error);
      throw error;
    }
  }

  /**
   * Scale a deployment
   */
  static async scaleDeployment(clusterName: string, clusterLocation: string, namespace: string, deploymentName: string, replicas: number): Promise<void> {
    try {
      await AuthService.authenticatedRequest(
        `/api/gcp/clusters/${clusterName}/namespaces/${namespace}/deployments/${deploymentName}/scale?cluster_location=${clusterLocation}`,
        'POST',
        { replicas }
      );
    } catch (error) {
      console.error('Failed to scale deployment:', error);
      throw error;
    }
  }

  /**
   * Get services for a namespace
   */
  static async getServices(clusterName: string, clusterLocation: string, namespace: string): Promise<any[]> {
    try {
      const response = await AuthService.authenticatedRequest(
        `/api/gcp/clusters/${clusterName}/namespaces/${namespace}/services?cluster_location=${clusterLocation}`
      );
      return response;
    } catch (error) {
      console.error('Failed to get services:', error);
      throw error;
    }
  }

  /**
   * Get ingresses for a namespace
   */
  static async getIngresses(clusterName: string, clusterLocation: string, namespace: string): Promise<any[]> {
    try {
      const response = await AuthService.authenticatedRequest(
        `/api/gcp/clusters/${clusterName}/namespaces/${namespace}/ingresses?cluster_location=${clusterLocation}`
      );
      return response;
    } catch (error) {
      console.error('Failed to get ingresses:', error);
      throw error;
    }
  }

  /**
   * Get secrets for a namespace
   */
  static async getSecrets(clusterName: string, clusterLocation: string, namespace: string): Promise<any[]> {
    try {
      const response = await AuthService.authenticatedRequest(
        `/api/gcp/clusters/${clusterName}/namespaces/${namespace}/secrets?cluster_location=${clusterLocation}`
      );
      return response;
    } catch (error) {
      console.error('Failed to get secrets:', error);
      throw error;
    }
  }

  /**
   * Get service accounts for a namespace
   */
  static async getServiceAccounts(clusterName: string, clusterLocation: string, namespace: string): Promise<any[]> {
    try {
      const response = await AuthService.authenticatedRequest(
        `/api/gcp/clusters/${clusterName}/namespaces/${namespace}/service-accounts?cluster_location=${clusterLocation}`
      );
      return response;
    } catch (error) {
      console.error('Failed to get service accounts:', error);
      throw error;
    }
  }

  /**
   * Get resource YAML
   */
  static async getResourceYaml(clusterName: string, clusterLocation: string, namespace: string, resourceType: string, resourceName: string): Promise<string> {
    try {
      const response = await AuthService.authenticatedRequest(
        `/api/gcp/clusters/${clusterName}/namespaces/${namespace}/${resourceType}/${resourceName}/yaml?cluster_location=${clusterLocation}`
      );
      return response.yaml || '';
    } catch (error) {
      console.error('Failed to get resource YAML:', error);
      throw error;
    }
  }

  /**
   * Update resource YAML
   */
  static async updateResourceYaml(clusterName: string, clusterLocation: string, namespace: string, resourceType: string, resourceName: string, yaml: string): Promise<void> {
    try {
      await AuthService.authenticatedRequest(
        `/api/gcp/clusters/${clusterName}/namespaces/${namespace}/${resourceType}/${resourceName}/yaml?cluster_location=${clusterLocation}`,
        'PUT',
        { yaml }
      );
    } catch (error) {
      console.error('Failed to update resource YAML:', error);
      throw error;
    }
  }
}
