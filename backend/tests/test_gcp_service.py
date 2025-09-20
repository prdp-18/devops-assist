"""
DevOps Companion App - GCP Service Tests
Unit tests for the GCP service layer
"""

import pytest
from unittest.mock import patch, MagicMock
from datetime import datetime

from services.gcp_service import GCPService
from models.gcp_models import Pod, Cluster, Namespace


class TestGCPService:
    """Test GCP service functionality"""
    
    @patch('services.gcp_service.default')
    @patch('services.gcp_service.container_v1.ClusterManagerClient')
    @patch('services.gcp_service.monitoring_v3.MetricServiceClient')
    def test_init_success(self, mock_monitoring, mock_container, mock_default):
        """Test successful GCP service initialization"""
        mock_default.return_value = ('mock_credentials', 'mock_project_id')
        
        service = GCPService()
        
        assert service.project_id == 'mock_project_id'
        mock_container.assert_called_once()
        mock_monitoring.assert_called_once()
    
    @patch('services.gcp_service.default')
    def test_init_no_credentials(self, mock_default):
        """Test GCP service initialization without credentials"""
        from google.auth.exceptions import DefaultCredentialsError
        
        mock_default.side_effect = DefaultCredentialsError()
        
        with pytest.raises(Exception, match="GCP credentials not configured"):
            GCPService()
    
    @patch('services.gcp_service.default')
    @patch('services.gcp_service.container_v1.ClusterManagerClient')
    @patch('services.gcp_service.monitoring_v3.MetricServiceClient')
    def test_get_clusters_success(self, mock_monitoring, mock_container, mock_default):
        """Test successful cluster retrieval"""
        mock_default.return_value = ('mock_credentials', 'mock_project_id')
        
        # Mock cluster response
        mock_cluster = MagicMock()
        mock_cluster.name = 'test-cluster'
        mock_cluster.status.name = 'RUNNING'
        mock_cluster.current_node_count = 3
        mock_cluster.current_master_version = '1.24.0'
        mock_cluster.endpoint = 'https://test-cluster.endpoint'
        
        mock_client = MagicMock()
        mock_client.list_clusters.return_value.clusters = [mock_cluster]
        mock_container.return_value = mock_client
        
        service = GCPService()
        clusters = service.get_clusters('us-central1')
        
        assert len(clusters) == 1
        assert clusters[0].name == 'test-cluster'
        assert clusters[0].status == 'RUNNING'
        assert clusters[0].node_count == 3
    
    @patch('services.gcp_service.default')
    @patch('services.gcp_service.container_v1.ClusterManagerClient')
    @patch('services.gcp_service.monitoring_v3.MetricServiceClient')
    def test_get_clusters_not_found(self, mock_monitoring, mock_container, mock_default):
        """Test cluster retrieval when no clusters found"""
        mock_default.return_value = ('mock_credentials', 'mock_project_id')
        
        from google.api_core import exceptions as gcp_exceptions
        
        mock_client = MagicMock()
        mock_client.list_clusters.side_effect = gcp_exceptions.NotFound('Not found')
        mock_container.return_value = mock_client
        
        service = GCPService()
        clusters = service.get_clusters('us-central1')
        
        assert len(clusters) == 0
    
    @patch('services.gcp_service.default')
    @patch('services.gcp_service.container_v1.ClusterManagerClient')
    @patch('services.gcp_service.monitoring_v3.MetricServiceClient')
    def test_get_namespaces(self, mock_monitoring, mock_container, mock_default):
        """Test namespace retrieval"""
        mock_default.return_value = ('mock_credentials', 'mock_project_id')
        
        service = GCPService()
        namespaces = service.get_namespaces('test-cluster', 'us-central1')
        
        assert len(namespaces) == 4  # Default namespaces
        assert namespaces[0].name == 'default'
        assert namespaces[0].cluster_name == 'test-cluster'
        assert namespaces[0].cluster_region == 'us-central1'
    
    @patch('services.gcp_service.default')
    @patch('services.gcp_service.container_v1.ClusterManagerClient')
    @patch('services.gcp_service.monitoring_v3.MetricServiceClient')
    def test_get_pods(self, mock_monitoring, mock_container, mock_default):
        """Test pod retrieval"""
        mock_default.return_value = ('mock_credentials', 'mock_project_id')
        
        service = GCPService()
        pods = service.get_pods('test-cluster', 'us-central1', 'default')
        
        assert len(pods) == 2  # Mock pods
        assert pods[0].name == 'nginx-deployment-1234567890-abcde'
        assert pods[0].namespace == 'default'
        assert pods[0].cluster_name == 'test-cluster'
        assert pods[0].status.phase == 'Running'
    
    @patch('services.gcp_service.default')
    @patch('services.gcp_service.container_v1.ClusterManagerClient')
    @patch('services.gcp_service.monitoring_v3.MetricServiceClient')
    def test_restart_pod(self, mock_monitoring, mock_container, mock_default):
        """Test pod restart"""
        mock_default.return_value = ('mock_credentials', 'mock_project_id')
        
        service = GCPService()
        response = service.restart_pod('test-cluster', 'us-central1', 'default', 'test-pod')
        
        assert response.status == 'success'
        assert response.action == 'restart'
        assert response.pod_name == 'test-pod'
        assert response.namespace == 'default'
    
    @patch('services.gcp_service.default')
    @patch('services.gcp_service.container_v1.ClusterManagerClient')
    @patch('services.gcp_service.monitoring_v3.MetricServiceClient')
    def test_delete_pod(self, mock_monitoring, mock_container, mock_default):
        """Test pod deletion"""
        mock_default.return_value = ('mock_credentials', 'mock_project_id')
        
        service = GCPService()
        response = service.delete_pod('test-cluster', 'us-central1', 'default', 'test-pod')
        
        assert response.status == 'success'
        assert response.action == 'delete'
        assert response.pod_name == 'test-pod'
        assert response.namespace == 'default'
    
    @patch('services.gcp_service.default')
    @patch('services.gcp_service.container_v1.ClusterManagerClient')
    @patch('services.gcp_service.monitoring_v3.MetricServiceClient')
    def test_get_pod_metrics(self, mock_monitoring, mock_container, mock_default):
        """Test pod metrics retrieval"""
        mock_default.return_value = ('mock_credentials', 'mock_project_id')
        
        service = GCPService()
        metrics = service.get_pod_metrics('test-cluster', 'us-central1', 'default', 'test-pod')
        
        assert 'cpu_usage' in metrics
        assert 'memory_usage' in metrics
        assert 'network_rx' in metrics
        assert 'network_tx' in metrics
        assert metrics['cpu_usage'] == 0.15
        assert metrics['memory_usage'] == 75.0


if __name__ == "__main__":
    pytest.main([__file__])

