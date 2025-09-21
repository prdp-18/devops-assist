export type RootStackParamList = {
  Login: undefined;
  MainTabs: undefined;
};

export type TabParamList = {
  Dashboard: undefined;
  AWS: undefined;
  GKE: undefined;
  Settings: undefined;
};

export type AWSStackParamList = {
  InstancesList: undefined;
  InstanceDetails: {
    instanceName: string;
    region: string;
  };
  SSHInfo: {
    instanceName: string;
    region: string;
  };
  SystemCommand: {
    instanceName: string;
    region: string;
  };
  CommandHistory: {
    instanceName: string;
    region: string;
  };
};

export type GKEStackParamList = {
  ClustersList: undefined;
  ClusterDetails: {
    clusterName: string;
    location: string;
  };
  NamespacesList: {
    clusterName: string;
    location: string;
  };
  PodsList: {
    clusterName: string;
    location: string;
    namespace: string;
  };
  PodDetails: {
    clusterName: string;
    location: string;
    namespace: string;
    podName: string;
  };
  PodLogs: {
    clusterName: string;
    location: string;
    namespace: string;
    podName: string;
  };
  DeploymentsList: {
    clusterName: string;
    location: string;
    namespace?: string;
  };
  DeploymentDetails: {
    clusterName: string;
    location: string;
    namespace: string;
    deploymentName: string;
  };
  ClusterHealth: {
    clusterName: string;
    location: string;
  };
};

export type SystemCommandScreenParams = {
  instanceName: string;
  region: string;
  command?: string;
};
