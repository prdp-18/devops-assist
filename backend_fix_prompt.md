# Backend AI Prompt: Fix GKE Namespaces API 500 Error

## 🚨 **Critical Issue**
The GKE namespaces API is returning 500 Internal Server Error, preventing the mobile app from loading namespaces.

## 📊 **Error Details**
```
Status: 500 Internal Server Error
Endpoint: /api/gcp/clusters/{cluster_name}/namespaces?cluster_location={location}
Error: "Failed to fetch namespaces: Failed to get namespaces: Error from server (InternalError): an error on the server (\"/api/v1/namespaces?limit=500\": the server is currently unable to handle the request\") has prevented the request from succeeding (get namespaces)"
```

## 🎯 **TDD Approach Required**

### **Step 1: Write Failing Tests First**
Create comprehensive test cases that reproduce the current failure:

```python
# tests/test_gke_namespaces.py
import pytest
from unittest.mock import patch, MagicMock
from your_app.services.gke_service import GKEService
from your_app.exceptions import GKEClusterError, GKETimeoutError

class TestGKENamespacesAPI:
    
    def test_get_namespaces_success(self):
        """Test successful namespace retrieval"""
        # Arrange
        mock_kubectl_response = {
            "items": [
                {"metadata": {"name": "default"}},
                {"metadata": {"name": "kube-system"}},
                {"metadata": {"name": "gke-managed-system"}}
            ]
        }
        
        with patch('your_app.services.gke_service.kubectl') as mock_kubectl:
            mock_kubectl.get_namespaces.return_value = mock_kubectl_response
            
            # Act
            result = GKEService.get_namespaces("cluster-1", "us-central1-a")
            
            # Assert
            assert result["status"] == "success"
            assert len(result["namespaces"]) == 3
            assert result["namespaces"][0]["name"] == "default"
    
    def test_get_namespaces_500_error(self):
        """Test handling of 500 Internal Server Error"""
        # Arrange
        with patch('your_app.services.gke_service.kubectl') as mock_kubectl:
            mock_kubectl.get_namespaces.side_effect = Exception("Internal Server Error: the server is currently unable to handle the request")
            
            # Act & Assert
            with pytest.raises(GKEClusterError) as exc_info:
                GKEService.get_namespaces("cluster-1", "us-central1-a")
            
            assert "server is currently unable to handle the request" in str(exc_info.value)
    
    def test_get_namespaces_timeout_error(self):
        """Test handling of timeout errors"""
        # Arrange
        with patch('your_app.services.gke_service.kubectl') as mock_kubectl:
            mock_kubectl.get_namespaces.side_effect = TimeoutError("Request timeout")
            
            # Act & Assert
            with pytest.raises(GKETimeoutError) as exc_info:
                GKEService.get_namespaces("cluster-1", "us-central1-a")
    
    def test_get_namespaces_retry_mechanism(self):
        """Test retry mechanism for transient failures"""
        # Arrange
        with patch('your_app.services.gke_service.kubectl') as mock_kubectl:
            # First two calls fail, third succeeds
            mock_kubectl.get_namespaces.side_effect = [
                Exception("Internal Server Error"),
                Exception("Internal Server Error"),
                {"items": [{"metadata": {"name": "default"}}]}
            ]
            
            # Act
            result = GKEService.get_namespaces("cluster-1", "us-central1-a", max_retries=3)
            
            # Assert
            assert result["status"] == "success"
            assert mock_kubectl.get_namespaces.call_count == 3
    
    def test_get_namespaces_fallback_empty_list(self):
        """Test fallback to empty list when cluster is unavailable"""
        # Arrange
        with patch('your_app.services.gke_service.kubectl') as mock_kubectl:
            mock_kubectl.get_namespaces.side_effect = Exception("Cluster unavailable")
            
            # Act
            result = GKEService.get_namespaces("cluster-1", "us-central1-a", fallback_empty=True)
            
            # Assert
            assert result["status"] == "success"
            assert result["namespaces"] == []
            assert result["warning"] == "Cluster temporarily unavailable, returning empty namespace list"
```

### **Step 2: Implement Robust Error Handling**

```python
# services/gke_service.py
import logging
import time
from typing import Dict, List, Optional
from dataclasses import dataclass
from enum import Enum

logger = logging.getLogger(__name__)

class GKEErrorType(Enum):
    CLUSTER_UNAVAILABLE = "cluster_unavailable"
    TIMEOUT = "timeout"
    AUTHENTICATION = "authentication"
    PERMISSION_DENIED = "permission_denied"
    INTERNAL_ERROR = "internal_error"

@dataclass
class GKEError:
    error_type: GKEErrorType
    message: str
    details: Optional[Dict] = None
    retry_after: Optional[int] = None

class GKEService:
    
    @staticmethod
    def get_namespaces(
        cluster_name: str, 
        cluster_location: str, 
        max_retries: int = 3,
        fallback_empty: bool = True
    ) -> Dict:
        """
        Get namespaces from GKE cluster with robust error handling
        
        Args:
            cluster_name: Name of the GKE cluster
            cluster_location: Location of the GKE cluster
            max_retries: Maximum number of retry attempts
            fallback_empty: Whether to return empty list on failure
            
        Returns:
            Dict containing namespaces or error information
        """
        last_error = None
        
        for attempt in range(max_retries + 1):
            try:
                logger.info(f"Attempting to fetch namespaces from cluster {cluster_name} (attempt {attempt + 1})")
                
                # Make the actual kubectl call
                namespaces_data = kubectl.get_namespaces(
                    cluster_name=cluster_name,
                    cluster_location=cluster_location,
                    limit=500
                )
                
                # Process and validate the response
                namespaces = GKEService._process_namespaces_response(namespaces_data)
                
                logger.info(f"Successfully fetched {len(namespaces)} namespaces")
                return {
                    "status": "success",
                    "namespaces": namespaces,
                    "cluster_name": cluster_name,
                    "cluster_location": cluster_location
                }
                
            except Exception as e:
                last_error = e
                error_info = GKEService._analyze_error(e)
                
                logger.warning(f"Attempt {attempt + 1} failed: {error_info.message}")
                
                # Don't retry for certain error types
                if error_info.error_type in [GKEErrorType.AUTHENTICATION, GKEErrorType.PERMISSION_DENIED]:
                    break
                
                # Wait before retry (exponential backoff)
                if attempt < max_retries:
                    wait_time = min(2 ** attempt, 10)  # Max 10 seconds
                    logger.info(f"Waiting {wait_time} seconds before retry...")
                    time.sleep(wait_time)
        
        # All retries failed
        logger.error(f"All attempts failed. Last error: {last_error}")
        
        if fallback_empty:
            logger.info("Returning empty namespace list as fallback")
            return {
                "status": "success",
                "namespaces": [],
                "warning": "Cluster temporarily unavailable, returning empty namespace list",
                "cluster_name": cluster_name,
                "cluster_location": cluster_location
            }
        else:
            raise GKEClusterError(f"Failed to fetch namespaces after {max_retries + 1} attempts: {last_error}")
    
    @staticmethod
    def _analyze_error(error: Exception) -> GKEError:
        """Analyze error and determine error type and retry strategy"""
        error_message = str(error).lower()
        
        if "timeout" in error_message or "timed out" in error_message:
            return GKEError(
                error_type=GKEErrorType.TIMEOUT,
                message="Request timed out",
                retry_after=5
            )
        elif "unauthorized" in error_message or "authentication" in error_message:
            return GKEError(
                error_type=GKEErrorType.AUTHENTICATION,
                message="Authentication failed"
            )
        elif "forbidden" in error_message or "permission denied" in error_message:
            return GKEError(
                error_type=GKEErrorType.PERMISSION_DENIED,
                message="Permission denied"
            )
        elif "internal server error" in error_message or "unable to handle the request" in error_message:
            return GKEError(
                error_type=GKEErrorType.INTERNAL_ERROR,
                message="GKE cluster internal error",
                retry_after=10
            )
        else:
            return GKEError(
                error_type=GKEErrorType.CLUSTER_UNAVAILABLE,
                message="Cluster temporarily unavailable",
                retry_after=5
            )
    
    @staticmethod
    def _process_namespaces_response(data: Dict) -> List[Dict]:
        """Process and validate kubectl response"""
        if not isinstance(data, dict) or "items" not in data:
            raise ValueError("Invalid response format from kubectl")
        
        namespaces = []
        for item in data.get("items", []):
            if "metadata" in item and "name" in item["metadata"]:
                namespaces.append({
                    "name": item["metadata"]["name"],
                    "creation_timestamp": item["metadata"].get("creationTimestamp"),
                    "labels": item["metadata"].get("labels", {}),
                    "annotations": item["metadata"].get("annotations", {})
                })
        
        return namespaces
```

### **Step 3: Update API Endpoint**

```python
# api/gke_routes.py
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import JSONResponse
from your_app.services.gke_service import GKEService
from your_app.exceptions import GKEClusterError, GKETimeoutError

router = APIRouter()

@router.get("/clusters/{cluster_name}/namespaces")
async def get_namespaces(
    cluster_name: str,
    cluster_location: str,
    fallback_empty: bool = True
):
    """
    Get namespaces from GKE cluster
    
    Args:
        cluster_name: Name of the GKE cluster
        cluster_location: Location of the GKE cluster
        fallback_empty: Whether to return empty list on failure (default: True)
    """
    try:
        result = GKEService.get_namespaces(
            cluster_name=cluster_name,
            cluster_location=cluster_location,
            fallback_empty=fallback_empty
        )
        
        # Return success response
        return JSONResponse(
            status_code=200,
            content=result
        )
        
    except GKEClusterError as e:
        logger.error(f"GKE cluster error: {e}")
        return JSONResponse(
            status_code=503,  # Service Unavailable
            content={
                "detail": f"GKE cluster error: {str(e)}",
                "error_type": "cluster_unavailable",
                "retry_after": 30
            }
        )
        
    except GKETimeoutError as e:
        logger.error(f"GKE timeout error: {e}")
        return JSONResponse(
            status_code=504,  # Gateway Timeout
            content={
                "detail": f"GKE timeout error: {str(e)}",
                "error_type": "timeout",
                "retry_after": 10
            }
        )
        
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        return JSONResponse(
            status_code=500,
            content={
                "detail": f"Unexpected error: {str(e)}",
                "error_type": "internal_error"
            }
        )
```

### **Step 4: Add Health Check Endpoint**

```python
# api/health_routes.py
@router.get("/health/gke/{cluster_name}")
async def gke_health_check(cluster_name: str, cluster_location: str):
    """Health check for GKE cluster connectivity"""
    try:
        # Try to get namespaces with minimal retry
        result = GKEService.get_namespaces(
            cluster_name=cluster_name,
            cluster_location=cluster_location,
            max_retries=1,
            fallback_empty=False
        )
        
        return {
            "status": "healthy",
            "cluster_name": cluster_name,
            "cluster_location": cluster_location,
            "namespaces_count": len(result["namespaces"])
        }
        
    except Exception as e:
        return {
            "status": "unhealthy",
            "cluster_name": cluster_name,
            "cluster_location": cluster_location,
            "error": str(e)
        }
```

## 🧪 **Test Execution Plan**

1. **Run the failing tests** to confirm they reproduce the issue
2. **Implement the error handling** code above
3. **Run tests again** to ensure they pass
4. **Test with real GKE cluster** to verify behavior
5. **Monitor logs** for error patterns and retry behavior

## 📋 **Expected Outcomes**

After implementation:
- ✅ **500 errors handled gracefully** with retry mechanism
- ✅ **Fallback to empty list** when cluster is unavailable
- ✅ **Proper error categorization** and logging
- ✅ **Mobile app continues working** even when GKE is down
- ✅ **Health check endpoint** for monitoring cluster status
- ✅ **Comprehensive test coverage** for all error scenarios

## 🚀 **Deployment Steps**

1. **Deploy backend changes** to staging environment
2. **Run integration tests** against real GKE cluster
3. **Monitor error logs** for 24 hours
4. **Deploy to production** with monitoring
5. **Update mobile app** to handle new error responses

This TDD approach ensures robust error handling and prevents the mobile app from breaking when GKE clusters experience temporary issues.
