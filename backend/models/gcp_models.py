"""
DevOps Companion App - GCP Models
Pydantic models for GCP/GKE resources
"""

from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime


class PodResource(BaseModel):
    """Pod resource usage"""
    cpu_usage: Optional[float] = None
    memory_usage: Optional[float] = None
    cpu_limit: Optional[float] = None
    memory_limit: Optional[float] = None
    cpu_request: Optional[float] = None
    memory_request: Optional[float] = None


class PodStatus(BaseModel):
    """Pod status information"""
    phase: str
    reason: Optional[str] = None
    message: Optional[str] = None
    ready: bool = False
    restart_count: int = 0
    age: Optional[str] = None


class PodContainer(BaseModel):
    """Pod container information"""
    name: str
    image: str
    ready: bool
    restart_count: int
    resources: PodResource


class Pod(BaseModel):
    """GKE Pod model"""
    name: str
    namespace: str
    cluster_location: str
    status: PodStatus
    containers: List[PodContainer]
    node_name: Optional[str] = None
    creation_timestamp: Optional[str] = None


class Cluster(BaseModel):
    """GKE Cluster model"""
    name: str
    region: str
    status: str
    node_count: int
    version: str
    endpoint: str


class Namespace(BaseModel):
    """Kubernetes Namespace model"""
    name: str
    cluster_name: str
    cluster_location: str
    status: str
    creation_timestamp: datetime
    labels: Dict[str, str] = {}


class PodActionRequest(BaseModel):
    """Request model for pod actions"""
    action: str  # restart, delete, scale
    pod_name: str
    namespace: str
    cluster_name: str
    cluster_location: str
    replicas: Optional[int] = None  # For scale action


class PodActionResponse(BaseModel):
    """Response model for pod actions"""
    status: str
    message: str
    action: str
    pod_name: str
    namespace: str
