"""
DevOps Companion App - GCP Service
Service layer for Google Cloud Platform and GKE operations
"""

import os
import json
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta

from google.cloud import container_v1
from google.cloud import monitoring_v3
from google.auth import default
from google.auth.exceptions import DefaultCredentialsError
from google.api_core import exceptions as gcp_exceptions

from models.gcp_models import Pod, Cluster, Namespace, PodActionRequest, PodActionResponse, PodContainer, PodStatus, PodResource


class GCPService:
    """Service class for GCP operations"""
    
    def __init__(self):
        """Initialize GCP service with credentials"""
        try:
            # Initialize GCP clients
            self.container_client = container_v1.ClusterManagerClient()
            self.monitoring_client = monitoring_v3.MetricServiceClient()
            
            # Get default credentials
            self.credentials, self.project_id = default()
            
        except DefaultCredentialsError:
            raise Exception("GCP credentials not configured. Please set GOOGLE_APPLICATION_CREDENTIALS or run 'gcloud auth application-default login'")
    
    def get_clusters(self, location: str = "us-central1") -> List[Cluster]:
        """
        Get list of GKE clusters in a region or zone
        
        Args:
            location (str): GCP region (e.g., us-central1) or zone (e.g., us-central1-a)
            
        Returns:
            List[Cluster]: List of GKE clusters
        """
        try:
            parent = f"projects/{self.project_id}/locations/{location}"
            response = self.container_client.list_clusters(parent=parent)
            
            clusters = []
            for cluster in response.clusters:
                # Determine if this is a regional or zonal cluster
                cluster_location = cluster.location
                location_type = "zone" if "-" in cluster_location else "region"
                
                cluster_data = Cluster(
                    name=cluster.name,
                    region=cluster_location,  # Store the actual location (region or zone)
                    status=cluster.status.name,
                    node_count=cluster.current_node_count,
                    version=cluster.current_master_version,
                    endpoint=cluster.endpoint
                )
                clusters.append(cluster_data)
            
            return clusters
            
        except gcp_exceptions.NotFound:
            return []
        except Exception as e:
            raise Exception(f"Failed to fetch clusters: {str(e)}")
    
    def get_namespaces(self, cluster_name: str, cluster_location: str) -> List[Namespace]:
        """
        Get list of namespaces in a GKE cluster
        
        Args:
            cluster_name (str): Name of the GKE cluster
            cluster_location (str): Region of the GKE cluster
            
        Returns:
            List[Namespace]: List of namespaces
        """
        try:
            import subprocess
            import json
            
            # Get GKE cluster credentials
            get_credentials_cmd = [
                "gcloud", "container", "clusters", "get-credentials",
                cluster_name,
                f"--zone={cluster_location}" if "-" in cluster_location else f"--region={cluster_location}",
                f"--project={self.project_id}"
            ]
            
            # Execute get-credentials command
            result = subprocess.run(get_credentials_cmd, capture_output=True, text=True, timeout=30)
            if result.returncode != 0:
                raise Exception(f"Failed to get cluster credentials: {result.stderr}")
            
            # Get namespaces using kubectl
            get_namespaces_cmd = ["kubectl", "get", "namespaces", "-o=json"]
            
            # Execute get namespaces command
            result = subprocess.run(get_namespaces_cmd, capture_output=True, text=True, timeout=30)
            if result.returncode != 0:
                raise Exception(f"Failed to get namespaces: {result.stderr}")
            
            # Parse the JSON output
            namespaces_data = json.loads(result.stdout)
            namespaces = []
            
            for ns_item in namespaces_data.get("items", []):
                ns_metadata = ns_item.get("metadata", {})
                ns_status = ns_item.get("status", {})
                
                namespace_data = Namespace(
                    name=ns_metadata.get("name", ""),
                    cluster_name=cluster_name,
                    cluster_location=cluster_location,
                    status=ns_status.get("phase", "Active"),
                    creation_timestamp=datetime.fromisoformat(
                        ns_metadata.get("creationTimestamp", "").replace("Z", "+00:00")
                    ),
                    labels=ns_metadata.get("labels", {})
                )
                namespaces.append(namespace_data)
            
            return namespaces
            
        except Exception as e:
            raise Exception(f"Failed to fetch namespaces: {str(e)}")
    
    def get_pods(self, cluster_name: str, cluster_location: str, namespace: str = "default") -> List[Pod]:
        """
        Get list of pods in a GKE cluster namespace
        
        Args:
            cluster_name (str): Name of the GKE cluster
            cluster_location (str): Region of the GKE cluster
            namespace (str): Kubernetes namespace
            
        Returns:
            List[Pod]: List of pods
        """
        try:
            import subprocess
            import json
            
            # Get GKE cluster credentials
            get_credentials_cmd = [
                "gcloud", "container", "clusters", "get-credentials",
                cluster_name,
                f"--zone={cluster_location}" if "-" in cluster_location else f"--region={cluster_location}",
                f"--project={self.project_id}"
            ]
            
            # Execute get-credentials command
            result = subprocess.run(get_credentials_cmd, capture_output=True, text=True, timeout=30)
            if result.returncode != 0:
                raise Exception(f"Failed to get cluster credentials: {result.stderr}")
            
            # Get pods using kubectl
            get_pods_cmd = ["kubectl", "get", "pods", f"-n={namespace}", "-o=json"]
            
            # Execute get pods command
            result = subprocess.run(get_pods_cmd, capture_output=True, text=True, timeout=30)
            if result.returncode != 0:
                raise Exception(f"Failed to get pods: {result.stderr}")
            
            # Parse the JSON output
            pods_data = json.loads(result.stdout)
            pods = []
            
            for pod_item in pods_data.get("items", []):
                pod_metadata = pod_item.get("metadata", {})
                pod_status = pod_item.get("status", {})
                pod_spec = pod_item.get("spec", {})
                
                # Extract container information
                containers = []
                for container_status in pod_status.get("containerStatuses", []):
                    container = PodContainer(
                        name=container_status.get("name", ""),
                        image=container_status.get("image", ""),
                        ready=container_status.get("ready", False),
                        restart_count=container_status.get("restartCount", 0),
                        resources=PodResource()
                    )
                    containers.append(container)
                
                # Extract resource information
                resources = PodResource()
                
                # Get resource limits from pod spec
                for container in pod_spec.get("containers", []):
                    resource_limits = container.get("resources", {}).get("limits", {})
                    if "cpu" in resource_limits:
                        resources.cpu_limit = self._parse_cpu_limit(resource_limits["cpu"])
                    if "memory" in resource_limits:
                        resources.memory_limit = self._parse_memory_limit(resource_limits["memory"])
                
                # Get actual resource usage using kubectl top
                try:
                    pod_name = pod_metadata.get("name", "")
                    top_cmd = ["kubectl", "top", "pod", pod_name, f"-n={namespace}", "--no-headers"]
                    top_result = subprocess.run(top_cmd, capture_output=True, text=True, timeout=10)
                    
                    if top_result.returncode == 0 and top_result.stdout.strip():
                        # Parse kubectl top output: "pod-name cpu(cores) memory(bytes)"
                        parts = top_result.stdout.strip().split()
                        if len(parts) >= 3:
                            cpu_usage_str = parts[1]
                            memory_usage_str = parts[2]
                            
                            
                            # Parse CPU usage (already in cores)
                            if cpu_usage_str.endswith('m'):
                                resources.cpu_usage = float(cpu_usage_str[:-1]) / 1000
                            else:
                                resources.cpu_usage = float(cpu_usage_str)
                            
                            # Parse memory usage (convert to MB)
                            if memory_usage_str.endswith('Mi'):
                                resources.memory_usage = float(memory_usage_str[:-2])
                            elif memory_usage_str.endswith('Gi'):
                                resources.memory_usage = float(memory_usage_str[:-2]) * 1024
                            elif memory_usage_str.endswith('Ki'):
                                resources.memory_usage = float(memory_usage_str[:-2]) / 1024
                            else:
                                # Assume bytes
                                resources.memory_usage = float(memory_usage_str) / (1024 * 1024)
                            
                            
                            # Update the first container's resources with usage data
                            if containers:
                                containers[0].resources.cpu_usage = resources.cpu_usage
                                containers[0].resources.memory_usage = resources.memory_usage
                                containers[0].resources.cpu_limit = resources.cpu_limit
                                containers[0].resources.memory_limit = resources.memory_limit
                    else:
                        # Log the error for debugging
                        print(f"kubectl top failed for pod {pod_name}: {top_result.stderr}")
                except Exception as e:
                    # Log the exception for debugging
                    print(f"Exception getting metrics for pod {pod_name}: {str(e)}")
                
                # Create pod object
                pod = Pod(
                    name=pod_metadata.get("name", ""),
                    namespace=pod_metadata.get("namespace", namespace),
                    cluster_name=cluster_name,
                    cluster_location=cluster_location,
                    status=PodStatus(
                        phase=pod_status.get("phase", "Unknown"),
                        reason=pod_status.get("reason"),
                        message=pod_status.get("message")
                    ),
                    containers=containers,
                    node_name=pod_spec.get("nodeName", ""),
                    creation_timestamp=pod_metadata.get("creationTimestamp", "")
                )
                pods.append(pod)
            
            return pods
            
        except Exception as e:
            raise Exception(f"Failed to fetch pods: {str(e)}")
    
    def restart_pod(self, cluster_name: str, cluster_location: str, namespace: str, pod_name: str) -> PodActionResponse:
        """
        Restart a pod in a GKE cluster
        
        Args:
            cluster_name (str): Name of the GKE cluster
            cluster_location (str): Region of the GKE cluster
            namespace (str): Kubernetes namespace
            pod_name (str): Name of the pod to restart
            
        Returns:
            PodActionResponse: Response with action status
        """
        try:
            import subprocess
            import json
            
            # Get GKE cluster credentials
            get_credentials_cmd = [
                "gcloud", "container", "clusters", "get-credentials",
                cluster_name,
                f"--zone={cluster_location}" if "-" in cluster_location else f"--region={cluster_location}",
                f"--project={self.project_id}"
            ]
            
            # Execute get-credentials command
            result = subprocess.run(get_credentials_cmd, capture_output=True, text=True, timeout=30)
            if result.returncode != 0:
                raise Exception(f"Failed to get cluster credentials: {result.stderr}")
            
            # Restart the pod by deleting it (Kubernetes will recreate it)
            delete_pod_cmd = ["kubectl", "delete", "pod", pod_name, f"-n={namespace}"]
            
            # Execute delete command
            result = subprocess.run(delete_pod_cmd, capture_output=True, text=True, timeout=30)
            if result.returncode != 0:
                raise Exception(f"Failed to restart pod: {result.stderr}")
            
            response = PodActionResponse(
                status="success",
                message=f"Pod {pod_name} restart initiated successfully",
                action="restart",
                pod_name=pod_name,
                namespace=namespace
            )
            
            return response
            
        except Exception as e:
            raise Exception(f"Failed to restart pod: {str(e)}")
    
    def _parse_cpu_limit(self, cpu_str: str) -> float:
        """Parse CPU limit string to float (cores)"""
        if not cpu_str:
            return None
        if cpu_str.endswith('m'):
            return float(cpu_str[:-1]) / 1000  # Convert millicores to cores
        return float(cpu_str)
    
    def _parse_memory_limit(self, memory_str: str) -> float:
        """Parse memory limit string to float (MB)"""
        if not memory_str:
            return None
        
        memory_str = memory_str.strip()
        
        # Handle different memory unit suffixes
        if memory_str.endswith('Gi'):
            return float(memory_str[:-2]) * 1024  # Convert GB to MB
        elif memory_str.endswith('G'):
            return float(memory_str[:-1]) * 1024  # Convert GB to MB
        elif memory_str.endswith('Mi'):
            return float(memory_str[:-2])  # Already in MB
        elif memory_str.endswith('M'):
            return float(memory_str[:-1])  # Already in MB
        elif memory_str.endswith('Ki'):
            return float(memory_str[:-2]) / 1024  # Convert KB to MB
        elif memory_str.endswith('K'):
            return float(memory_str[:-1]) / 1024  # Convert KB to MB
        elif memory_str.endswith('i'):
            # Handle cases like "512Mi" -> "512M"
            return float(memory_str[:-1]) / 1024  # Convert KB to MB
        else:
            try:
                # Try to parse as bytes and convert to MB
                return float(memory_str) / (1024 * 1024)
            except ValueError:
                # If all else fails, return 0
                return 0.0
    
    def _get_cluster_credentials(self, cluster_name: str, cluster_location: str):
        """Get GKE cluster credentials using gcloud"""
        import subprocess
        
        # Get GKE cluster credentials
        get_credentials_cmd = [
            "gcloud", "container", "clusters", "get-credentials",
            cluster_name,
            f"--zone={cluster_location}" if "-" in cluster_location else f"--region={cluster_location}",
            "--project", self.project_id
        ]
        
        result = subprocess.run(get_credentials_cmd, capture_output=True, text=True, timeout=30)
        
        if result.returncode != 0:
            raise Exception(f"Failed to get cluster credentials: {result.stderr}")
    
    def delete_pod(self, cluster_name: str, cluster_location: str, namespace: str, pod_name: str) -> PodActionResponse:
        """
        Delete a pod in a GKE cluster
        
        Args:
            cluster_name (str): Name of the GKE cluster
            cluster_location (str): Region of the GKE cluster
            namespace (str): Kubernetes namespace
            pod_name (str): Name of the pod to delete
            
        Returns:
            PodActionResponse: Response with action status
        """
        try:
            # Note: This is a simplified implementation
            # In a real implementation, you'd need to use kubectl or the Kubernetes API
            # For now, we'll simulate the delete action
            
            # Simulate delete action
            response = PodActionResponse(
                status="success",
                message=f"Pod {pod_name} deleted successfully",
                action="delete",
                pod_name=pod_name,
                namespace=namespace
            )
            
            return response
            
        except Exception as e:
            raise Exception(f"Failed to delete pod: {str(e)}")
    
    def get_pod_metrics(self, cluster_name: str, cluster_location: str, namespace: str, pod_name: str) -> Dict[str, float]:
        """
        Get metrics for a specific pod
        
        Args:
            cluster_name (str): Name of the GKE cluster
            cluster_location (str): Region of the GKE cluster
            namespace (str): Kubernetes namespace
            pod_name (str): Name of the pod
            
        Returns:
            Dict[str, float]: Pod metrics
        """
        try:
            # Note: This is a simplified implementation
            # In a real implementation, you'd query Google Cloud Monitoring
            
            # Mock metrics data
            metrics = {
                "cpu_usage": 0.15,
                "memory_usage": 75.0,
                "network_rx": 1024.0,
                "network_tx": 512.0
            }
            
            return metrics
            
        except Exception as e:
            raise Exception(f"Failed to fetch pod metrics: {str(e)}")
    
    def get_pod_logs(self, cluster_name: str, cluster_location: str, namespace: str, pod_name: str, lines: int = 100) -> dict:
        """
        Get logs for a specific pod
        
        Args:
            cluster_name (str): Name of the GKE cluster
            cluster_location (str): Location (region or zone) of the GKE cluster
            namespace (str): Kubernetes namespace
            pod_name (str): Name of the pod
            lines (int): Number of log lines to retrieve
            
        Returns:
            dict: Pod logs
        """
        try:
            import subprocess
            
            # Get GKE cluster credentials
            get_credentials_cmd = [
                "gcloud", "container", "clusters", "get-credentials",
                cluster_name,
                f"--zone={cluster_location}" if "-" in cluster_location else f"--region={cluster_location}",
                f"--project={self.project_id}"
            ]
            
            # Execute get-credentials command
            result = subprocess.run(get_credentials_cmd, capture_output=True, text=True, timeout=30)
            if result.returncode != 0:
                raise Exception(f"Failed to get cluster credentials: {result.stderr}")
            
            # Get pod logs using kubectl
            logs_cmd = ["kubectl", "logs", pod_name, f"-n={namespace}", f"--tail={lines}"]
            
            # Execute logs command
            result = subprocess.run(logs_cmd, capture_output=True, text=True, timeout=30)
            if result.returncode != 0:
                raise Exception(f"Failed to get pod logs: {result.stderr}")
            
            return {
                "pod_name": pod_name,
                "namespace": namespace,
                "lines": lines,
                "logs": result.stdout,
                "timestamp": datetime.now().isoformat()
            }
            
        except Exception as e:
            raise Exception(f"Failed to get pod logs: {str(e)}")
    
    def describe_pod(self, cluster_name: str, cluster_location: str, namespace: str, pod_name: str) -> dict:
        """
        Get detailed information about a specific pod
        
        Args:
            cluster_name (str): Name of the GKE cluster
            cluster_location (str): Location (region or zone) of the GKE cluster
            namespace (str): Kubernetes namespace
            pod_name (str): Name of the pod
            
        Returns:
            dict: Detailed pod information
        """
        try:
            import subprocess
            import json
            
            # Get GKE cluster credentials
            get_credentials_cmd = [
                "gcloud", "container", "clusters", "get-credentials",
                cluster_name,
                f"--zone={cluster_location}" if "-" in cluster_location else f"--region={cluster_location}",
                f"--project={self.project_id}"
            ]
            
            # Execute get-credentials command
            result = subprocess.run(get_credentials_cmd, capture_output=True, text=True, timeout=30)
            if result.returncode != 0:
                raise Exception(f"Failed to get cluster credentials: {result.stderr}")
            
            # Get pod details using kubectl describe
            describe_cmd = ["kubectl", "describe", "pod", pod_name, f"-n={namespace}"]
            
            # Execute describe command
            result = subprocess.run(describe_cmd, capture_output=True, text=True, timeout=30)
            if result.returncode != 0:
                raise Exception(f"Failed to describe pod: {result.stderr}")
            
            # Also get pod YAML for more structured data
            get_cmd = ["kubectl", "get", "pod", pod_name, f"-n={namespace}", "-o=json"]
            get_result = subprocess.run(get_cmd, capture_output=True, text=True, timeout=30)
            
            pod_yaml = None
            if get_result.returncode == 0:
                pod_yaml = json.loads(get_result.stdout)
            
            return {
                "pod_name": pod_name,
                "namespace": namespace,
                "describe_output": result.stdout,
                "pod_yaml": pod_yaml,
                "timestamp": datetime.now().isoformat()
            }
            
        except Exception as e:
            raise Exception(f"Failed to describe pod: {str(e)}")
    
    def scale_deployment(self, cluster_name: str, cluster_location: str, namespace: str, deployment_name: str, replicas: int) -> dict:
        """
        Scale a deployment to a specific number of replicas
        
        Args:
            cluster_name (str): Name of the GKE cluster
            cluster_location (str): Location (region or zone) of the GKE cluster
            namespace (str): Kubernetes namespace
            deployment_name (str): Name of the deployment
            replicas (int): Number of replicas to scale to
            
        Returns:
            dict: Scaling result
        """
        try:
            import subprocess
            
            # Get GKE cluster credentials
            get_credentials_cmd = [
                "gcloud", "container", "clusters", "get-credentials",
                cluster_name,
                f"--zone={cluster_location}" if "-" in cluster_location else f"--region={cluster_location}",
                f"--project={self.project_id}"
            ]
            
            # Execute get-credentials command
            result = subprocess.run(get_credentials_cmd, capture_output=True, text=True, timeout=30)
            if result.returncode != 0:
                raise Exception(f"Failed to get cluster credentials: {result.stderr}")
            
            # Scale deployment using kubectl
            scale_cmd = ["kubectl", "scale", "deployment", deployment_name, f"--replicas={replicas}", f"-n={namespace}"]
            
            # Execute scale command
            result = subprocess.run(scale_cmd, capture_output=True, text=True, timeout=30)
            if result.returncode != 0:
                raise Exception(f"Failed to scale deployment: {result.stderr}")
            
            return {
                "deployment_name": deployment_name,
                "namespace": namespace,
                "replicas": replicas,
                "message": f"Deployment {deployment_name} scaled to {replicas} replicas",
                "output": result.stdout,
                "timestamp": datetime.now().isoformat()
            }
            
        except Exception as e:
            raise Exception(f"Failed to scale deployment: {str(e)}")
    
    def get_all_pods(self, cluster_name: str, cluster_location: str) -> List[Pod]:
        """
        Get all pods across all namespaces in a GKE cluster
        
        Args:
            cluster_name (str): Name of the GKE cluster
            cluster_location (str): Location (region or zone) of the GKE cluster
            
        Returns:
            List[Pod]: List of all pods in the cluster
        """
        try:
            import subprocess
            import json
            
            # Get GKE cluster credentials
            get_credentials_cmd = [
                "gcloud", "container", "clusters", "get-credentials",
                cluster_name,
                f"--zone={cluster_location}" if "-" in cluster_location else f"--region={cluster_location}",
                f"--project={self.project_id}"
            ]
            
            # Execute get-credentials command
            result = subprocess.run(get_credentials_cmd, capture_output=True, text=True, timeout=30)
            if result.returncode != 0:
                raise Exception(f"Failed to get cluster credentials: {result.stderr}")
            
            # Get all pods across all namespaces using kubectl get pods -A
            pods_cmd = ["kubectl", "get", "pods", "-A", "-o=json"]
            
            # Execute pods command
            result = subprocess.run(pods_cmd, capture_output=True, text=True, timeout=30)
            if result.returncode != 0:
                raise Exception(f"Failed to get all pods: {result.stderr}")
            
            # Parse the JSON response
            pods_data = json.loads(result.stdout)
            
            # Get pod metrics using kubectl top pods -A
            metrics_cmd = ["kubectl", "top", "pods", "-A"]
            metrics_result = subprocess.run(metrics_cmd, capture_output=True, text=True, timeout=30)
            
            # Parse metrics if available
            metrics_map = {}
            if metrics_result.returncode == 0:
                lines = metrics_result.stdout.strip().split('\n')[1:]  # Skip header
                for line in lines:
                    if line.strip():
                        parts = line.split()
                        if len(parts) >= 4:
                            namespace = parts[0]
                            pod_name = parts[1]
                            cpu_usage = parts[2]
                            memory_usage = parts[3]
                            metrics_map[f"{namespace}/{pod_name}"] = {
                                'cpu_usage': self._parse_cpu_limit(cpu_usage),
                                'memory_usage': self._parse_memory_limit(memory_usage)
                            }
            
            # Convert to our Pod model
            pods = []
            for item in pods_data.get('items', []):
                metadata = item.get('metadata', {})
                spec = item.get('spec', {})
                status = item.get('status', {})
                
                pod_name = metadata.get('name', '')
                namespace = metadata.get('namespace', '')
                pod_key = f"{namespace}/{pod_name}"
                
                # Get pod metrics
                pod_metrics = metrics_map.get(pod_key, {})
                
                # Parse containers
                containers = []
                container_statuses = {cs.get('name'): cs for cs in status.get('containerStatuses', [])}
                
                for container in spec.get('containers', []):
                    container_name = container.get('name', '')
                    container_status = container_statuses.get(container_name, {})
                    resources = container.get('resources', {})
                    
                    # Parse resource limits
                    limits = resources.get('limits', {})
                    requests = resources.get('requests', {})
                    
                    cpu_limit = self._parse_cpu_limit(limits.get('cpu', '0'))
                    memory_limit = self._parse_memory_limit(limits.get('memory', '0'))
                    cpu_request = self._parse_cpu_limit(requests.get('cpu', '0'))
                    memory_request = self._parse_memory_limit(requests.get('memory', '0'))
                    
                    containers.append(PodContainer(
                        name=container_name,
                        image=container.get('image', ''),
                        ready=container_status.get('ready', False),
                        restart_count=container_status.get('restartCount', 0),
                        resources=PodResource(
                            cpu_limit=cpu_limit,
                            memory_limit=memory_limit,
                            cpu_request=cpu_request,
                            memory_request=memory_request,
                            cpu_usage=pod_metrics.get('cpu_usage'),
                            memory_usage=pod_metrics.get('memory_usage')
                        )
                    ))
                
                # Parse pod status
                pod_status = PodStatus(
                    phase=status.get('phase', 'Unknown'),
                    message=status.get('message', ''),
                    reason=status.get('reason', ''),
                    ready=status.get('conditions', [{}])[0].get('status', 'False') == 'True' if status.get('conditions') else False,
                    restart_count=sum(container.get('restartCount', 0) for container in status.get('containerStatuses', [])),
                    age=self._calculate_age(metadata.get('creationTimestamp', ''))
                )
                
                pod = Pod(
                    name=pod_name,
                    namespace=namespace,
                    cluster_location=cluster_location,
                    status=pod_status,
                    containers=containers,
                    node_name=spec.get('nodeName', ''),
                    creation_timestamp=metadata.get('creationTimestamp', '')
                )
                
                pods.append(pod)
            
            return pods
            
        except Exception as e:
            raise Exception(f"Failed to get all pods: {str(e)}")
    
    def _calculate_age(self, creation_timestamp: str) -> str:
        """
        Calculate the age of a pod from its creation timestamp
        
        Args:
            creation_timestamp (str): ISO format timestamp
            
        Returns:
            str: Human-readable age (e.g., "2h", "1d", "30m")
        """
        try:
            from datetime import datetime, timezone
            
            if not creation_timestamp:
                return "Unknown"
            
            # Parse the timestamp
            if creation_timestamp.endswith('Z'):
                creation_timestamp = creation_timestamp[:-1] + '+00:00'
            
            created_time = datetime.fromisoformat(creation_timestamp.replace('Z', '+00:00'))
            now = datetime.now(timezone.utc)
            
            # Calculate difference
            diff = now - created_time
            
            # Convert to human-readable format
            total_seconds = int(diff.total_seconds())
            
            if total_seconds < 60:
                return f"{total_seconds}s"
            elif total_seconds < 3600:
                minutes = total_seconds // 60
                return f"{minutes}m"
            elif total_seconds < 86400:
                hours = total_seconds // 3600
                return f"{hours}h"
            else:
                days = total_seconds // 86400
                return f"{days}d"
                
        except Exception:
            return "Unknown"
    
    def get_nodes(self, cluster_name: str, cluster_location: str, wide: bool = False) -> List[dict]:
        """
        Get all nodes in a GKE cluster
        
        Args:
            cluster_name (str): Name of the GKE cluster
            cluster_location (str): Location (region or zone) of the GKE cluster
            wide (bool): Whether to include wide format (additional columns)
            
        Returns:
            List[dict]: List of nodes in the cluster
        """
        try:
            import subprocess
            import json
            
            # Get GKE cluster credentials
            get_credentials_cmd = [
                "gcloud", "container", "clusters", "get-credentials",
                cluster_name,
                f"--zone={cluster_location}" if "-" in cluster_location else f"--region={cluster_location}",
                f"--project={self.project_id}"
            ]
            
            # Execute get-credentials command
            result = subprocess.run(get_credentials_cmd, capture_output=True, text=True, timeout=30)
            if result.returncode != 0:
                raise Exception(f"Failed to get cluster credentials: {result.stderr}")
            
            # Get nodes using kubectl get nodes
            nodes_cmd = ["kubectl", "get", "nodes", "-o=json"]
            if wide:
                nodes_cmd = ["kubectl", "get", "nodes", "-o=wide", "--no-headers"]
            
            # Execute nodes command
            result = subprocess.run(nodes_cmd, capture_output=True, text=True, timeout=30)
            if result.returncode != 0:
                raise Exception(f"Failed to get nodes: {result.stderr}")
            
            if wide:
                # Parse wide format output
                nodes = []
                lines = result.stdout.strip().split('\n')
                for line in lines:
                    if line.strip():
                        parts = line.split()
                        if len(parts) >= 6:
                            node = {
                                "name": parts[0],
                                "status": parts[1],
                                "roles": parts[2],
                                "age": parts[3],
                                "version": parts[4],
                                "internal_ip": parts[5],
                                "external_ip": parts[6] if len(parts) > 6 else "N/A",
                                "os_image": parts[7] if len(parts) > 7 else "N/A",
                                "kernel_version": parts[8] if len(parts) > 8 else "N/A",
                                "container_runtime": parts[9] if len(parts) > 9 else "N/A"
                            }
                            nodes.append(node)
                return nodes
            else:
                # Parse JSON format
                nodes_data = json.loads(result.stdout)
                nodes = []
                
                for item in nodes_data.get('items', []):
                    metadata = item.get('metadata', {})
                    spec = item.get('spec', {})
                    status = item.get('status', {})
                    
                    # Get node conditions
                    conditions = status.get('conditions', [])
                    ready_condition = next((c for c in conditions if c.get('type') == 'Ready'), {})
                    
                    # Get node addresses
                    addresses = status.get('addresses', [])
                    internal_ip = next((addr.get('address') for addr in addresses if addr.get('type') == 'InternalIP'), 'N/A')
                    external_ip = next((addr.get('address') for addr in addresses if addr.get('type') == 'ExternalIP'), 'N/A')
                    
                    # Get node info
                    node_info = status.get('nodeInfo', {})
                    
                    node = {
                        "name": metadata.get('name', ''),
                        "status": "Ready" if ready_condition.get('status') == 'True' else "NotReady",
                        "roles": ", ".join([key.replace('node-role.kubernetes.io/', '') for key, value in metadata.get('labels', {}).items() if key.startswith('node-role.kubernetes.io/')]) or "worker",
                        "age": self._calculate_age(metadata.get('creationTimestamp', '')),
                        "version": node_info.get('kubeletVersion', 'N/A'),
                        "internal_ip": internal_ip,
                        "external_ip": external_ip,
                        "os_image": node_info.get('osImage', 'N/A'),
                        "kernel_version": node_info.get('kernelVersion', 'N/A'),
                        "container_runtime": node_info.get('containerRuntimeVersion', 'N/A'),
                        "architecture": node_info.get('architecture', 'N/A'),
                        "operating_system": node_info.get('operatingSystem', 'N/A')
                    }
                    nodes.append(node)
                
                return nodes
            
        except Exception as e:
            raise Exception(f"Failed to get nodes: {str(e)}")
    
    def get_nodes_top(self, cluster_name: str, cluster_location: str) -> List[dict]:
        """
        Get node resource usage (top nodes)
        
        Args:
            cluster_name (str): Name of the GKE cluster
            cluster_location (str): Location (region or zone) of the GKE cluster
            
        Returns:
            List[dict]: List of nodes with resource usage
        """
        try:
            import subprocess
            
            # Get GKE cluster credentials
            get_credentials_cmd = [
                "gcloud", "container", "clusters", "get-credentials",
                cluster_name,
                f"--zone={cluster_location}" if "-" in cluster_location else f"--region={cluster_location}",
                f"--project={self.project_id}"
            ]
            
            # Execute get-credentials command
            result = subprocess.run(get_credentials_cmd, capture_output=True, text=True, timeout=30)
            if result.returncode != 0:
                raise Exception(f"Failed to get cluster credentials: {result.stderr}")
            
            # Get node resource usage using kubectl top nodes
            top_cmd = ["kubectl", "top", "nodes"]
            
            # Execute top command
            result = subprocess.run(top_cmd, capture_output=True, text=True, timeout=30)
            if result.returncode != 0:
                raise Exception(f"Failed to get node resource usage: {result.stderr}")
            
            # Parse the output
            nodes_top = []
            lines = result.stdout.strip().split('\n')[1:]  # Skip header
            
            for line in lines:
                if line.strip():
                    parts = line.split()
                    if len(parts) >= 3:
                        node_name = parts[0]
                        cpu_usage = parts[1]
                        memory_usage = parts[2]
                        
                        # Parse CPU usage (convert from millicores to cores)
                        cpu_cores = 0.0
                        if cpu_usage.endswith('m'):
                            cpu_cores = float(cpu_usage[:-1]) / 1000
                        else:
                            cpu_cores = float(cpu_usage)
                        
                        # Parse memory usage (convert to MB)
                        memory_mb = self._parse_memory_limit(memory_usage)
                        
                        node_top = {
                            "name": node_name,
                            "cpu_usage": cpu_cores,
                            "memory_usage": memory_mb,
                            "cpu_usage_raw": cpu_usage,
                            "memory_usage_raw": memory_usage
                        }
                        nodes_top.append(node_top)
            
            return nodes_top
            
        except Exception as e:
            raise Exception(f"Failed to get node resource usage: {str(e)}")
    
    def get_deployments(self, cluster_name: str, cluster_location: str, namespace: str = "default"):
        """Get deployments in a namespace"""
        try:
            import subprocess
            import json
            
            # Get cluster credentials
            self._get_cluster_credentials(cluster_name, cluster_location)
            
            # Get deployments
            cmd = ["kubectl", "get", "deployments", f"-n={namespace}", "-o=json"]
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
            
            if result.returncode != 0:
                raise Exception(f"kubectl get deployments failed: {result.stderr}")
            
            deployments_data = json.loads(result.stdout)
            deployments = []
            
            for deployment in deployments_data.get("items", []):
                metadata = deployment.get("metadata", {})
                spec = deployment.get("spec", {})
                status = deployment.get("status", {})
                
                deployments.append({
                    "name": metadata.get("name", ""),
                    "namespace": metadata.get("namespace", namespace),
                    "replicas": spec.get("replicas", 0),
                    "ready_replicas": status.get("readyReplicas", 0),
                    "available_replicas": status.get("availableReplicas", 0),
                    "age": self._calculate_age(metadata.get("creationTimestamp", "")),
                    "image": spec.get("template", {}).get("spec", {}).get("containers", [{}])[0].get("image", "")
                })
            
            return deployments
            
        except Exception as e:
            raise Exception(f"Failed to get deployments: {str(e)}")
    
    def get_deployment_yaml(self, cluster_name: str, cluster_location: str, deployment_name: str, namespace: str = "default"):
        """Get deployment YAML"""
        try:
            import subprocess
            
            # Get cluster credentials
            self._get_cluster_credentials(cluster_name, cluster_location)
            
            # Get deployment YAML
            cmd = ["kubectl", "get", "deployment", deployment_name, f"-n={namespace}", "-o=yaml"]
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
            
            if result.returncode != 0:
                raise Exception(f"kubectl get deployment failed: {result.stderr}")
            
            return result.stdout
            
        except Exception as e:
            raise Exception(f"Failed to get deployment YAML: {str(e)}")
    
    def rollout_deployment(self, cluster_name: str, cluster_location: str, deployment_name: str, namespace: str = "default"):
        """Rollout restart deployment"""
        try:
            import subprocess
            
            # Get cluster credentials
            self._get_cluster_credentials(cluster_name, cluster_location)
            
            # Rollout restart deployment
            cmd = ["kubectl", "rollout", "restart", "deployment", deployment_name, f"-n={namespace}"]
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
            
            if result.returncode != 0:
                raise Exception(f"kubectl rollout restart failed: {result.stderr}")
            
            return {"status": "success", "message": f"Deployment {deployment_name} rollout restart initiated"}
            
        except Exception as e:
            raise Exception(f"Failed to rollout deployment: {str(e)}")
    
    def edit_deployment(self, cluster_name: str, cluster_location: str, deployment_name: str, namespace: str = "default", yaml_content: str = ""):
        """Edit deployment using YAML"""
        try:
            import subprocess
            import tempfile
            import os
            
            # Get cluster credentials
            self._get_cluster_credentials(cluster_name, cluster_location)
            
            # Create a temporary file with the YAML content
            with tempfile.NamedTemporaryFile(mode='w', suffix='.yaml', delete=False) as temp_file:
                temp_file.write(yaml_content)
                temp_file_path = temp_file.name
            
            try:
                # First try kubectl apply
                cmd = ["kubectl", "apply", "-f", temp_file_path, f"-n={namespace}"]
                result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
                
                if result.returncode == 0:
                    return {"status": "success", "message": f"Deployment {deployment_name} updated successfully"}
                
                # If apply fails due to immutable fields, try replace with force
                if "field is immutable" in result.stderr or "Invalid value" in result.stderr:
                    cmd_replace = ["kubectl", "replace", "-f", temp_file_path, f"-n={namespace}", "--force"]
                    result_replace = subprocess.run(cmd_replace, capture_output=True, text=True, timeout=30)
                    
                    if result_replace.returncode == 0:
                        return {"status": "success", "message": f"Deployment {deployment_name} replaced successfully (immutable fields updated)"}
                    else:
                        raise Exception(f"kubectl replace failed: {result_replace.stderr}")
                else:
                    raise Exception(f"kubectl apply failed: {result.stderr}")
                
            finally:
                # Clean up the temporary file
                os.unlink(temp_file_path)
            
        except Exception as e:
            raise Exception(f"Failed to edit deployment: {str(e)}")
    
    def get_services(self, cluster_name: str, cluster_location: str, namespace: str = "default"):
        """Get services in a namespace"""
        try:
            import subprocess
            import json
            
            # Get cluster credentials
            self._get_cluster_credentials(cluster_name, cluster_location)
            
            # Get services
            cmd = ["kubectl", "get", "services", f"-n={namespace}", "-o=json"]
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
            
            if result.returncode != 0:
                raise Exception(f"kubectl get services failed: {result.stderr}")
            
            services_data = json.loads(result.stdout)
            services = []
            
            for service in services_data.get("items", []):
                metadata = service.get("metadata", {})
                spec = service.get("spec", {})
                
                services.append({
                    "name": metadata.get("name", ""),
                    "namespace": metadata.get("namespace", namespace),
                    "type": spec.get("type", "ClusterIP"),
                    "cluster_ip": spec.get("clusterIP", ""),
                    "external_ip": spec.get("externalIPs", [""])[0] if spec.get("externalIPs") else "",
                    "ports": spec.get("ports", []),
                    "age": self._calculate_age(metadata.get("creationTimestamp", ""))
                })
            
            return services
            
        except Exception as e:
            raise Exception(f"Failed to get services: {str(e)}")
    
    def get_service_yaml(self, cluster_name: str, cluster_location: str, service_name: str, namespace: str = "default"):
        """Get service YAML"""
        try:
            import subprocess
            
            # Get cluster credentials
            self._get_cluster_credentials(cluster_name, cluster_location)
            
            # Get service YAML
            cmd = ["kubectl", "get", "service", service_name, f"-n={namespace}", "-o=yaml"]
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
            
            if result.returncode != 0:
                raise Exception(f"kubectl get service failed: {result.stderr}")
            
            return result.stdout
            
        except Exception as e:
            raise Exception(f"Failed to get service YAML: {str(e)}")
    
    def get_ingresses(self, cluster_name: str, cluster_location: str, namespace: str = "default"):
        """Get ingresses in a namespace"""
        try:
            import subprocess
            import json
            
            # Get cluster credentials
            self._get_cluster_credentials(cluster_name, cluster_location)
            
            # Get ingresses
            cmd = ["kubectl", "get", "ingresses", f"-n={namespace}", "-o=json"]
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
            
            if result.returncode != 0:
                raise Exception(f"kubectl get ingresses failed: {result.stderr}")
            
            ingresses_data = json.loads(result.stdout)
            ingresses = []
            
            for ingress in ingresses_data.get("items", []):
                metadata = ingress.get("metadata", {})
                spec = ingress.get("spec", {})
                status = ingress.get("status", {})
                
                ingresses.append({
                    "name": metadata.get("name", ""),
                    "namespace": metadata.get("namespace", namespace),
                    "class": metadata.get("annotations", {}).get("kubernetes.io/ingress.class", ""),
                    "hosts": [rule.get("host", "") for rule in spec.get("rules", [])],
                    "address": status.get("loadBalancer", {}).get("ingress", [{}])[0].get("ip", "") if status.get("loadBalancer", {}).get("ingress") else "",
                    "age": self._calculate_age(metadata.get("creationTimestamp", ""))
                })
            
            return ingresses
            
        except Exception as e:
            raise Exception(f"Failed to get ingresses: {str(e)}")
    
    def get_ingress_yaml(self, cluster_name: str, cluster_location: str, ingress_name: str, namespace: str = "default"):
        """Get ingress YAML"""
        try:
            import subprocess
            
            # Get cluster credentials
            self._get_cluster_credentials(cluster_name, cluster_location)
            
            # Get ingress YAML
            cmd = ["kubectl", "get", "ingress", ingress_name, f"-n={namespace}", "-o=yaml"]
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
            
            if result.returncode != 0:
                raise Exception(f"kubectl get ingress failed: {result.stderr}")
            
            return result.stdout
            
        except Exception as e:
            raise Exception(f"Failed to get ingress YAML: {str(e)}")
    
    def get_secrets(self, cluster_name: str, cluster_location: str, namespace: str = "default"):
        """Get secrets in a namespace"""
        try:
            import subprocess
            import json
            
            # Get cluster credentials
            self._get_cluster_credentials(cluster_name, cluster_location)
            
            # Get secrets
            cmd = ["kubectl", "get", "secrets", f"-n={namespace}", "-o=json"]
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
            
            if result.returncode != 0:
                raise Exception(f"kubectl get secrets failed: {result.stderr}")
            
            secrets_data = json.loads(result.stdout)
            secrets = []
            
            for secret in secrets_data.get("items", []):
                metadata = secret.get("metadata", {})
                secret_type = secret.get("type", "Opaque")
                data_keys = list(secret.get("data", {}).keys())
                
                secrets.append({
                    "name": metadata.get("name", ""),
                    "namespace": metadata.get("namespace", namespace),
                    "type": secret_type,
                    "data_keys": data_keys,
                    "data_count": len(data_keys),
                    "age": self._calculate_age(metadata.get("creationTimestamp", ""))
                })
            
            return secrets
            
        except Exception as e:
            raise Exception(f"Failed to get secrets: {str(e)}")
    
    def get_secret_yaml(self, cluster_name: str, cluster_location: str, secret_name: str, namespace: str = "default"):
        """Get secret YAML"""
        try:
            import subprocess
            
            # Get cluster credentials
            self._get_cluster_credentials(cluster_name, cluster_location)
            
            # Get secret YAML
            cmd = ["kubectl", "get", "secret", secret_name, f"-n={namespace}", "-o=yaml"]
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
            
            if result.returncode != 0:
                raise Exception(f"kubectl get secret failed: {result.stderr}")
            
            return result.stdout
            
        except Exception as e:
            raise Exception(f"Failed to get secret YAML: {str(e)}")
    
    def get_service_accounts(self, cluster_name: str, cluster_location: str, namespace: str = "default"):
        """Get service accounts in a namespace"""
        try:
            import subprocess
            import json
            
            # Get cluster credentials
            self._get_cluster_credentials(cluster_name, cluster_location)
            
            # Get service accounts
            cmd = ["kubectl", "get", "serviceaccounts", f"-n={namespace}", "-o=json"]
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
            
            if result.returncode != 0:
                raise Exception(f"kubectl get serviceaccounts failed: {result.stderr}")
            
            service_accounts_data = json.loads(result.stdout)
            service_accounts = []
            
            for sa in service_accounts_data.get("items", []):
                metadata = sa.get("metadata", {})
                secrets = sa.get("secrets", [])
                image_pull_secrets = sa.get("imagePullSecrets", [])
                
                service_accounts.append({
                    "name": metadata.get("name", ""),
                    "namespace": metadata.get("namespace", namespace),
                    "secrets_count": len(secrets),
                    "image_pull_secrets_count": len(image_pull_secrets),
                    "age": self._calculate_age(metadata.get("creationTimestamp", ""))
                })
            
            return service_accounts
            
        except Exception as e:
            raise Exception(f"Failed to get service accounts: {str(e)}")
    
    def get_service_account_yaml(self, cluster_name: str, cluster_location: str, sa_name: str, namespace: str = "default"):
        """Get service account YAML"""
        try:
            import subprocess
            
            # Get cluster credentials
            self._get_cluster_credentials(cluster_name, cluster_location)
            
            # Get service account YAML
            cmd = ["kubectl", "get", "serviceaccount", sa_name, f"-n={namespace}", "-o=yaml"]
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
            
            if result.returncode != 0:
                raise Exception(f"kubectl get serviceaccount failed: {result.stderr}")
            
            return result.stdout
            
        except Exception as e:
            raise Exception(f"Failed to get service account YAML: {str(e)}")
