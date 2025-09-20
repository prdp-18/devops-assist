"""
DevOps Companion App - Backend Tests
Unit tests for the FastAPI backend
"""

import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock
import json

from main import app

client = TestClient(app)


class TestHealthEndpoint:
    """Test health check endpoint"""
    
    def test_health_check(self):
        """Test health check returns OK status"""
        response = client.get("/health")
        assert response.status_code == 200
        assert response.json() == {"status": "ok"}


class TestAuthentication:
    """Test authentication endpoints"""
    
    def test_login_success(self):
        """Test successful login with valid credentials"""
        response = client.post(
            "/token",
            data={"username": "admin", "password": "supersecret"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"
    
    def test_login_invalid_credentials(self):
        """Test login with invalid credentials"""
        response = client.post(
            "/token",
            data={"username": "admin", "password": "wrongpassword"}
        )
        assert response.status_code == 401
        assert "Incorrect username or password" in response.json()["detail"]
    
    def test_login_missing_credentials(self):
        """Test login with missing credentials"""
        response = client.post(
            "/token",
            data={"username": "admin"}
        )
        assert response.status_code == 422  # Validation error


class TestInstanceEndpoints:
    """Test instance management endpoints"""
    
    @patch('main.boto3.client')
    def test_get_instances_success(self, mock_boto_client):
        """Test successful retrieval of instances"""
        # Mock AWS clients
        mock_lightsail = MagicMock()
        mock_cloudwatch = MagicMock()
        mock_boto_client.side_effect = [mock_lightsail, mock_cloudwatch]
        
        # Mock Lightsail response
        mock_lightsail.get_instances.return_value = {
            'instances': [
                {
                    'name': 'test-instance',
                    'state': {'name': 'running'},
                    'location': {'regionName': 'us-east-1'}
                }
            ]
        }
        
        # Mock CloudWatch response
        mock_cloudwatch.get_metric_data.return_value = {
            'MetricDataResults': [
                {
                    'Values': [50.0, 60.0, 55.0]
                }
            ]
        }
        
        # Get auth token first
        auth_response = client.post(
            "/token",
            data={"username": "admin", "password": "supersecret"}
        )
        token = auth_response.json()["access_token"]
        
        # Test get instances
        response = client.get(
            "/api/instances",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200
        instances = response.json()
        assert len(instances) == 1
        assert instances[0]["name"] == "test-instance"
        assert instances[0]["state"] == "running"
        assert instances[0]["cpu_utilization"] == 55.0
    
    def test_get_instances_unauthorized(self):
        """Test get instances without authentication"""
        response = client.get("/api/instances")
        assert response.status_code == 401
    
    @patch('main.boto3.client')
    def test_reboot_instance_success(self, mock_boto_client):
        """Test successful instance reboot"""
        # Mock AWS client
        mock_lightsail = MagicMock()
        mock_boto_client.return_value = mock_lightsail
        
        # Mock successful reboot
        mock_lightsail.reboot_instance.return_value = {}
        
        # Get auth token first
        auth_response = client.post(
            "/token",
            data={"username": "admin", "password": "supersecret"}
        )
        token = auth_response.json()["access_token"]
        
        # Test reboot instance
        response = client.post(
            "/api/instances/test-instance/reboot",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        assert "test-instance" in data["message"]
    
    def test_reboot_instance_unauthorized(self):
        """Test reboot instance without authentication"""
        response = client.post("/api/instances/test-instance/reboot")
        assert response.status_code == 401


class TestErrorHandling:
    """Test error handling scenarios"""
    
    @patch('main.boto3.client')
    def test_aws_credentials_error(self, mock_boto_client):
        """Test handling of AWS credentials error"""
        from botocore.exceptions import NoCredentialsError
        
        # Mock AWS client to raise NoCredentialsError
        mock_boto_client.side_effect = NoCredentialsError()
        
        # Get auth token first
        auth_response = client.post(
            "/token",
            data={"username": "admin", "password": "supersecret"}
        )
        token = auth_response.json()["access_token"]
        
        # Test get instances with credentials error
        response = client.get(
            "/api/instances",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 500
        assert "AWS credentials not configured" in response.json()["detail"]
    
    @patch('main.boto3.client')
    def test_instance_not_found_error(self, mock_boto_client):
        """Test handling of instance not found error"""
        from botocore.exceptions import ClientError
        
        # Mock AWS client to raise ClientError for instance not found
        mock_lightsail = MagicMock()
        mock_boto_client.return_value = mock_lightsail
        
        error_response = {
            'Error': {
                'Code': 'NotFoundException',
                'Message': 'Instance not found'
            }
        }
        mock_lightsail.reboot_instance.side_effect = ClientError(
            error_response, 'RebootInstance'
        )
        
        # Get auth token first
        auth_response = client.post(
            "/token",
            data={"username": "admin", "password": "supersecret"}
        )
        token = auth_response.json()["access_token"]
        
        # Test reboot non-existent instance
        response = client.post(
            "/api/instances/non-existent-instance/reboot",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 500
        assert "AWS service error" in response.json()["detail"]


if __name__ == "__main__":
    pytest.main([__file__])

