"""
DevOps Companion App - Backend Service
Main FastAPI application with authentication and health-check endpoint
"""

import os
from datetime import datetime, timedelta
from typing import Optional, List

import boto3
from botocore.exceptions import ClientError, NoCredentialsError

from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from jose import JWTError, jwt
from passlib.context import CryptContext
from dotenv import load_dotenv
from pydantic import BaseModel

# Import GCP models and services
from models.gcp_models import Pod, Cluster, Namespace, PodActionRequest, PodActionResponse
from services.gcp_service import GCPService

# Load environment variables
load_dotenv()

# Security configuration
SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))

# Password hashing context
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# OAuth2 scheme
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

# Pydantic models
class Instance(BaseModel):
    """AWS Lightsail instance model"""
    name: str
    state: str
    region: str
    cpu_utilization: float

# Create FastAPI application instance
app = FastAPI(
    title="DevOps Companion App",
    description="Backend service for DevOps Companion App with JWT authentication",
    version="1.0.0"
)

@app.get("/")
async def root():
    return {"message": "DevOps Companion API"}

@app.get("/health")
async def health_check():
    """Health check endpoint for Docker/Kubernetes"""
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    """
    Create a JWT access token
    
    Args:
        data (dict): Data to encode in the token
        expires_delta (Optional[timedelta]): Token expiration time
        
    Returns:
        str: Encoded JWT token
    """
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verify a password against its hash
    
    Args:
        plain_password (str): Plain text password
        hashed_password (str): Hashed password
        
    Returns:
        bool: True if password matches, False otherwise
    """
    return pwd_context.verify(plain_password, hashed_password)


def authenticate_user(username: str, password: str) -> bool:
    """
    Authenticate user with hardcoded credentials for Phase 2
    
    Args:
        username (str): Username to authenticate
        password (str): Password to authenticate
        
    Returns:
        bool: True if credentials are valid, False otherwise
    """
    # Hardcoded credentials for Phase 2
    if username == "admin" and password == "supersecret":
        return True
    return False


async def get_current_user(token: str = Depends(oauth2_scheme)):
    """
    Validate JWT token and extract user information
    
    Args:
        token (str): JWT token from Authorization header
        
    Returns:
        dict: User information from token
        
    Raises:
        HTTPException: 401 if token is invalid, expired, or malformed
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    return {"username": username}


@app.get("/health")
async def health_check():
    """
    Health check endpoint to verify service status
    
    Returns:
        JSONResponse: Status object with "ok" status
    """
    return JSONResponse(
        status_code=200,
        content={"status": "ok"}
    )


@app.post("/token")
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends()):
    """
    Authenticate user and return JWT access token
    
    Args:
        form_data (OAuth2PasswordRequestForm): Username and password from form
        
    Returns:
        dict: Access token and token type
        
    Raises:
        HTTPException: 401 if credentials are invalid
    """
    # Authenticate user with hardcoded credentials
    if not authenticate_user(form_data.username, form_data.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Create access token
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": form_data.username}, expires_delta=access_token_expires
    )
    
    return {"access_token": access_token, "token_type": "bearer"}


def get_cpu_utilization(cloudwatch_client, instance_name: str, region: str) -> float:
    """
    Get CPU utilization for a Lightsail instance from CloudWatch
    
    Args:
        cloudwatch_client: boto3 CloudWatch client
        instance_name (str): Name of the Lightsail instance
        region (str): AWS region
        
    Returns:
        float: Average CPU utilization percentage, 0.0 if no data available
    """
    try:
        end_time = datetime.utcnow()
        start_time = end_time - timedelta(minutes=5)
        
        response = cloudwatch_client.get_metric_data(
            MetricDataQueries=[
                {
                    'Id': 'cpu_utilization',
                    'MetricStat': {
                        'Metric': {
                            'Namespace': 'AWS/Lightsail',
                            'MetricName': 'CPUUtilization',
                            'Dimensions': [
                                {
                                    'Name': 'InstanceName',
                                    'Value': instance_name
                                }
                            ]
                        },
                        'Period': 300,  # 5 minutes
                        'Stat': 'Average'
                    },
                    'ReturnData': True
                }
            ],
            StartTime=start_time,
            EndTime=end_time
        )
        
        # Extract CPU utilization from response
        if response['MetricDataResults'] and response['MetricDataResults'][0]['Values']:
            values = response['MetricDataResults'][0]['Values']
            return round(sum(values) / len(values), 2)
        
        return 0.0
        
    except (ClientError, NoCredentialsError, Exception):
        # Return 0.0 if there's any error fetching metrics
        return 0.0


@app.get("/api/instances", response_model=List[Instance])
async def get_instances(region: str = "us-east-1", current_user: dict = Depends(get_current_user)):
    """
    Get list of AWS Lightsail instances with their state and CPU utilization
    
    Args:
        region (str): AWS region to search for instances (default: us-east-1)
        current_user (dict): Authenticated user information
        
    Returns:
        List[Instance]: List of Lightsail instances with metadata
        
    Raises:
        HTTPException: 500 if AWS service errors occur
    """
    try:
        # Initialize AWS clients
        lightsail_client = boto3.client('lightsail', region_name=region)
        cloudwatch_client = boto3.client('cloudwatch', region_name=region)
        
        # Get all Lightsail instances
        response = lightsail_client.get_instances()
        instances = []
        
        for instance in response.get('instances', []):
            instance_name = instance.get('name', '')
            instance_state = instance.get('state', {}).get('name', 'unknown')
            instance_region = instance.get('location', {}).get('regionName', region)
            
            # Get CPU utilization from CloudWatch
            cpu_utilization = get_cpu_utilization(cloudwatch_client, instance_name, instance_region)
            
            # Create Instance object
            instance_data = Instance(
                name=instance_name,
                state=instance_state,
                region=instance_region,
                cpu_utilization=cpu_utilization
            )
            instances.append(instance_data)
        
        return instances
        
    except NoCredentialsError:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="AWS credentials not configured"
        )
    except ClientError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"AWS service error: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unexpected error: {str(e)}"
        )


@app.post("/api/instances/{instance_name}/reboot")
async def reboot_instance(instance_name: str, region: str = "us-east-1", current_user: dict = Depends(get_current_user)):
    """
    Reboot a specific AWS Lightsail instance
    
    Args:
        instance_name (str): Name of the Lightsail instance to reboot
        region (str): AWS region where the instance is located (default: us-east-1)
        current_user (dict): Authenticated user information
        
    Returns:
        dict: Success response with status and message
        
    Raises:
        HTTPException: 404 if instance not found, 500 for AWS service errors
    """
    try:
        # Initialize AWS Lightsail client
        lightsail_client = boto3.client('lightsail', region_name=region)
        
        # Issue reboot command
        lightsail_client.reboot_instance(instanceName=instance_name)
        
        return {
            "status": "success",
            "message": f"Reboot command issued for {instance_name}"
        }
        
    except ClientError as e:
        if e.response['Error']['Code'] == 'NotFoundException':
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Instance {instance_name} not found"
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to issue reboot command due to an AWS service error."
            )
    except NoCredentialsError:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="AWS credentials not configured"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unexpected error: {str(e)}"
        )


@app.get("/api/instances/{instance_name}/ssh-info")
async def get_instance_ssh_info(instance_name: str, region: str = "us-east-1", current_user: dict = Depends(get_current_user)):
    """
    Get SSH connection information for a Lightsail instance
    
    Args:
        instance_name (str): Name of the Lightsail instance
        region (str): AWS region where the instance is located
        current_user (dict): Authenticated user information
        
    Returns:
        dict: SSH connection details including IP, username, and key info
    """
    try:
        lightsail_client = boto3.client('lightsail', region_name=region)
        
        # Get instance details
        response = lightsail_client.get_instance(instanceName=instance_name)
        instance = response.get('instance', {})
        
        # Get public IP
        public_ip = instance.get('publicIpAddress', 'Not available')
        
        # Get SSH key info
        ssh_key_name = instance.get('sshKeyName', 'Not available')
        
        # Determine username based on instance type
        blueprint_name = instance.get('blueprintName', '').lower()
        if 'wordpress' in blueprint_name:
            username = 'bitnami'  # WordPress instances use bitnami user
        elif 'ubuntu' in blueprint_name:
            username = 'ubuntu'
        elif 'amazon' in blueprint_name or 'linux' in blueprint_name:
            username = 'ec2-user'
        elif 'bitnami' in blueprint_name:
            username = 'bitnami'
        elif 'lamp' in blueprint_name:
            username = 'bitnami'  # LAMP instances also use bitnami
        else:
            username = 'bitnami'  # default to bitnami for Lightsail
            
        return {
            "instance_name": instance_name,
            "public_ip": public_ip,
            "username": username,
            "ssh_key_name": ssh_key_name,
            "ssh_command": f"ssh -i ~/.ssh/{ssh_key_name}.pem {username}@{public_ip}",
            "region": region
        }
        
    except ClientError as e:
        if e.response['Error']['Code'] == 'NotFoundException':
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Instance {instance_name} not found"
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"AWS service error: {str(e)}"
            )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unexpected error: {str(e)}"
        )


@app.post("/api/instances/{instance_name}/system-command")
async def execute_system_command(instance_name: str, command: str, region: str = "us-east-1", current_user: dict = Depends(get_current_user)):
    """
    Execute system commands on a Lightsail instance via SSH
    
    Args:
        instance_name (str): Name of the Lightsail instance
        command (str): System command to execute
        region (str): AWS region where the instance is located
        current_user (dict): Authenticated user information
        
    Returns:
        dict: Command execution result
    """
    try:
        import subprocess
        import tempfile
        import os
        
        # Get SSH connection info
        ssh_info_response = await get_instance_ssh_info(instance_name, region, current_user)
        ssh_info = ssh_info_response
        
        if ssh_info["public_ip"] == "Not available":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Instance does not have a public IP address"
            )
        
        # Create SSH command - use the actual key name from instance
        ssh_key_name = ssh_info['ssh_key_name']
        # Map common AWS Lightsail key names to local file names
        key_mapping = {
            'LightsailDefaultKeyPair': 'lightsail-default-ohio',
            'lightsail-default-ohio': 'lightsail-default-ohio',
            'lightsail-default-virginia': 'lightsail-default-virginia', 
            'lightsail-default-oregon': 'lightsail-default-oregon'
        }
        local_key_name = key_mapping.get(ssh_key_name, ssh_key_name)
        ssh_key_path = f"~/.ssh/{local_key_name}.pem"
        ssh_command = [
            "ssh", 
            "-i", ssh_key_path,
            "-o", "StrictHostKeyChecking=no",
            "-o", "UserKnownHostsFile=/dev/null",
            "-o", "ConnectTimeout=10",
            f"{ssh_info['username']}@{ssh_info['public_ip']}",
            command
        ]
        
        # Execute command
        result = subprocess.run(ssh_command, capture_output=True, text=True, timeout=30)
        
        return {
            "status": "success" if result.returncode == 0 else "error",
            "command": command,
            "return_code": result.returncode,
            "stdout": result.stdout,
            "stderr": result.stderr,
            "message": f"Command executed on {instance_name}"
        }
        
    except subprocess.TimeoutExpired:
        raise HTTPException(
            status_code=status.HTTP_408_REQUEST_TIMEOUT,
            detail="SSH command timed out"
        )
    except FileNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="SSH key file not found. Please ensure the SSH key is available locally."
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to execute command: {str(e)}"
        )


# GCP/GKE Endpoints
@app.get("/api/gcp/clusters", response_model=List[Cluster])
async def get_gcp_clusters(location: str = "us-central1", current_user: dict = Depends(get_current_user)):
    """
    Get list of GKE clusters in a region or zone
    
    Args:
        location (str): GCP region (e.g., us-central1) or zone (e.g., us-central1-a)
        current_user (dict): Authenticated user information
        
    Returns:
        List[Cluster]: List of GKE clusters
        
    Raises:
        HTTPException: 500 if GCP service errors occur
    """
    try:
        gcp_service = GCPService()
        clusters = gcp_service.get_clusters(location)
        return clusters
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"GCP service error: {str(e)}"
        )


@app.get("/api/gcp/clusters/{cluster_name}/namespaces", response_model=List[Namespace])
async def get_gcp_namespaces(cluster_name: str, cluster_location: str = "us-central1", current_user: dict = Depends(get_current_user)):
    """
    Get list of namespaces in a GKE cluster
    
    Args:
        cluster_name (str): Name of the GKE cluster
        cluster_location (str): Region of the GKE cluster
        current_user (dict): Authenticated user information
        
    Returns:
        List[Namespace]: List of namespaces
        
    Raises:
        HTTPException: 500 if GCP service errors occur
    """
    try:
        gcp_service = GCPService()
        namespaces = gcp_service.get_namespaces(cluster_name, cluster_location)
        return namespaces
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"GCP service error: {str(e)}"
        )


@app.get("/api/gcp/clusters/{cluster_name}/namespaces/{namespace}/pods", response_model=List[Pod])
async def get_gcp_pods(cluster_name: str, namespace: str, cluster_location: str = "us-central1", current_user: dict = Depends(get_current_user)):
    """
    Get list of pods in a GKE cluster namespace
    
    Args:
        cluster_name (str): Name of the GKE cluster
        namespace (str): Kubernetes namespace
        cluster_location (str): Region of the GKE cluster
        current_user (dict): Authenticated user information
        
    Returns:
        List[Pod]: List of pods
        
    Raises:
        HTTPException: 500 if GCP service errors occur
    """
    try:
        gcp_service = GCPService()
        pods = gcp_service.get_pods(cluster_name, cluster_location, namespace)
        return pods
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"GCP service error: {str(e)}"
        )


@app.post("/api/gcp/clusters/{cluster_name}/namespaces/{namespace}/pods/{pod_name}/restart", response_model=PodActionResponse)
async def restart_gcp_pod(cluster_name: str, namespace: str, pod_name: str, cluster_location: str = "us-central1", current_user: dict = Depends(get_current_user)):
    """
    Restart a pod in a GKE cluster
    
    Args:
        cluster_name (str): Name of the GKE cluster
        namespace (str): Kubernetes namespace
        pod_name (str): Name of the pod to restart
        cluster_location (str): Region of the GKE cluster
        current_user (dict): Authenticated user information
        
    Returns:
        PodActionResponse: Response with action status
        
    Raises:
        HTTPException: 500 if GCP service errors occur
    """
    try:
        gcp_service = GCPService()
        response = gcp_service.restart_pod(cluster_name, cluster_location, namespace, pod_name)
        return response
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"GCP service error: {str(e)}"
        )


@app.delete("/api/gcp/clusters/{cluster_name}/namespaces/{namespace}/pods/{pod_name}", response_model=PodActionResponse)
async def delete_gcp_pod(cluster_name: str, namespace: str, pod_name: str, cluster_location: str = "us-central1", current_user: dict = Depends(get_current_user)):
    """
    Delete a pod in a GKE cluster
    
    Args:
        cluster_name (str): Name of the GKE cluster
        namespace (str): Kubernetes namespace
        pod_name (str): Name of the pod to delete
        cluster_location (str): Region of the GKE cluster
        current_user (dict): Authenticated user information
        
    Returns:
        PodActionResponse: Response with action status
        
    Raises:
        HTTPException: 500 if GCP service errors occur
    """
    try:
        gcp_service = GCPService()
        response = gcp_service.delete_pod(cluster_name, cluster_location, namespace, pod_name)
        return response
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"GCP service error: {str(e)}"
        )


@app.get("/api/gcp/clusters/{cluster_name}/namespaces/{namespace}/pods/{pod_name}/metrics")
async def get_gcp_pod_metrics(cluster_name: str, namespace: str, pod_name: str, cluster_location: str = "us-central1", current_user: dict = Depends(get_current_user)):
    """
    Get metrics for a specific pod
    
    Args:
        cluster_name (str): Name of the GKE cluster
        namespace (str): Kubernetes namespace
        pod_name (str): Name of the pod
        cluster_location (str): Region of the GKE cluster
        current_user (dict): Authenticated user information
        
    Returns:
        dict: Pod metrics
        
    Raises:
        HTTPException: 500 if GCP service errors occur
    """
    try:
        gcp_service = GCPService()
        metrics = gcp_service.get_pod_metrics(cluster_name, cluster_location, namespace, pod_name)
        return metrics
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"GCP service error: {str(e)}"
        )


@app.get("/api/gcp/clusters/{cluster_name}/namespaces/{namespace}/pods/{pod_name}/logs")
async def get_gcp_pod_logs(cluster_name: str, namespace: str, pod_name: str, cluster_location: str = "us-central1", lines: int = 100, current_user: dict = Depends(get_current_user)):
    """
    Get logs for a specific pod
    
    Args:
        cluster_name (str): Name of the GKE cluster
        namespace (str): Kubernetes namespace
        pod_name (str): Name of the pod
        cluster_location (str): Location (region or zone) of the GKE cluster
        lines (int): Number of log lines to retrieve (default: 100)
        current_user (dict): Authenticated user information
        
    Returns:
        dict: Pod logs
        
    Raises:
        HTTPException: 500 if GCP service errors occur
    """
    try:
        gcp_service = GCPService()
        logs = gcp_service.get_pod_logs(cluster_name, cluster_location, namespace, pod_name, lines)
        return logs
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"GCP service error: {str(e)}"
        )


@app.get("/api/gcp/clusters/{cluster_name}/namespaces/{namespace}/pods/{pod_name}/describe")
async def describe_gcp_pod(cluster_name: str, namespace: str, pod_name: str, cluster_location: str = "us-central1", current_user: dict = Depends(get_current_user)):
    """
    Get detailed information about a specific pod
    
    Args:
        cluster_name (str): Name of the GKE cluster
        namespace (str): Kubernetes namespace
        pod_name (str): Name of the pod
        cluster_location (str): Location (region or zone) of the GKE cluster
        current_user (dict): Authenticated user information
        
    Returns:
        dict: Detailed pod information
        
    Raises:
        HTTPException: 500 if GCP service errors occur
    """
    try:
        gcp_service = GCPService()
        pod_info = gcp_service.describe_pod(cluster_name, cluster_location, namespace, pod_name)
        return pod_info
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"GCP service error: {str(e)}"
        )


@app.post("/api/gcp/clusters/{cluster_name}/namespaces/{namespace}/deployments/{deployment_name}/scale")
async def scale_gcp_deployment(cluster_name: str, namespace: str, deployment_name: str, replicas: int, cluster_location: str = "us-central1", current_user: dict = Depends(get_current_user)):
    """
    Scale a deployment to a specific number of replicas
    
    Args:
        cluster_name (str): Name of the GKE cluster
        namespace (str): Kubernetes namespace
        deployment_name (str): Name of the deployment
        replicas (int): Number of replicas to scale to
        cluster_location (str): Location (region or zone) of the GKE cluster
        current_user (dict): Authenticated user information
        
    Returns:
        dict: Scaling result
        
    Raises:
        HTTPException: 500 if GCP service errors occur
    """
    try:
        gcp_service = GCPService()
        result = gcp_service.scale_deployment(cluster_name, cluster_location, namespace, deployment_name, replicas)
        return result
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"GCP service error: {str(e)}"
        )


@app.get("/api/gcp/clusters/{cluster_name}/pods/all")
async def get_all_gcp_pods(cluster_name: str, cluster_location: str = "us-central1", current_user: dict = Depends(get_current_user)):
    """
    Get all pods across all namespaces in a GKE cluster
    
    Args:
        cluster_name (str): Name of the GKE cluster
        cluster_location (str): Location (region or zone) of the GKE cluster
        current_user (dict): Authenticated user information
        
    Returns:
        List[Pod]: List of all pods in the cluster
        
    Raises:
        HTTPException: 500 if GCP service errors occur
    """
    try:
        gcp_service = GCPService()
        pods = gcp_service.get_all_pods(cluster_name, cluster_location)
        return pods
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"GCP service error: {str(e)}"
        )


@app.get("/api/gcp/clusters/{cluster_name}/nodes")
async def get_gcp_nodes(cluster_name: str, cluster_location: str = "us-central1", wide: bool = False, current_user: dict = Depends(get_current_user)):
    """
    Get all nodes in a GKE cluster
    
    Args:
        cluster_name (str): Name of the GKE cluster
        cluster_location (str): Location (region or zone) of the GKE cluster
        wide (bool): Whether to include wide format (additional columns)
        current_user (dict): Authenticated user information
        
    Returns:
        List[dict]: List of nodes in the cluster
        
    Raises:
        HTTPException: 500 if GCP service errors occur
    """
    try:
        gcp_service = GCPService()
        nodes = gcp_service.get_nodes(cluster_name, cluster_location, wide)
        return nodes
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"GCP service error: {str(e)}"
        )


@app.get("/api/gcp/clusters/{cluster_name}/nodes/top")
async def get_gcp_nodes_top(cluster_name: str, cluster_location: str = "us-central1", current_user: dict = Depends(get_current_user)):
    """
    Get node resource usage (top nodes)
    
    Args:
        cluster_name (str): Name of the GKE cluster
        cluster_location (str): Location (region or zone) of the GKE cluster
        current_user (dict): Authenticated user information
        
    Returns:
        List[dict]: List of nodes with resource usage
        
    Raises:
        HTTPException: 500 if GCP service errors occur
    """
    try:
        gcp_service = GCPService()
        nodes_top = gcp_service.get_nodes_top(cluster_name, cluster_location)
        return nodes_top
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"GCP service error: {str(e)}"
        )


# Advanced Kubernetes Operations
@app.get("/api/gcp/clusters/{cluster_name}/deployments")
async def get_gcp_deployments(cluster_name: str, cluster_location: str, namespace: str = "default"):
    """Get deployments in a namespace"""
    try:
        gcp_service = GCPService()
        deployments = gcp_service.get_deployments(cluster_name, cluster_location, namespace)
        return deployments
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"GCP service error: {str(e)}")

@app.get("/api/gcp/clusters/{cluster_name}/deployments/{deployment_name}/yaml")
async def get_deployment_yaml(cluster_name: str, cluster_location: str, deployment_name: str, namespace: str = "default"):
    """Download deployment YAML"""
    try:
        gcp_service = GCPService()
        yaml_content = gcp_service.get_deployment_yaml(cluster_name, cluster_location, deployment_name, namespace)
        return {"yaml": yaml_content}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"GCP service error: {str(e)}")

@app.post("/api/gcp/clusters/{cluster_name}/deployments/{deployment_name}/rollout")
async def rollout_deployment(cluster_name: str, cluster_location: str, deployment_name: str, namespace: str = "default"):
    """Rollout restart deployment"""
    try:
        gcp_service = GCPService()
        result = gcp_service.rollout_deployment(cluster_name, cluster_location, deployment_name, namespace)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"GCP service error: {str(e)}")

@app.put("/api/gcp/clusters/{cluster_name}/deployments/{deployment_name}/edit")
async def edit_deployment(cluster_name: str, cluster_location: str, deployment_name: str, namespace: str = "default", yaml_data: dict = None):
    """Edit deployment using YAML"""
    try:
        gcp_service = GCPService()
        result = gcp_service.edit_deployment(cluster_name, cluster_location, deployment_name, namespace, yaml_data.get("yaml", ""))
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"GCP service error: {str(e)}")

@app.get("/api/gcp/clusters/{cluster_name}/services")
async def get_gcp_services(cluster_name: str, cluster_location: str, namespace: str = "default"):
    """Get services in a namespace"""
    try:
        gcp_service = GCPService()
        services = gcp_service.get_services(cluster_name, cluster_location, namespace)
        return services
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"GCP service error: {str(e)}")

@app.get("/api/gcp/clusters/{cluster_name}/services/{service_name}/yaml")
async def get_service_yaml(cluster_name: str, cluster_location: str, service_name: str, namespace: str = "default"):
    """Download service YAML"""
    try:
        gcp_service = GCPService()
        yaml_content = gcp_service.get_service_yaml(cluster_name, cluster_location, service_name, namespace)
        return {"yaml": yaml_content}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"GCP service error: {str(e)}")

@app.get("/api/gcp/clusters/{cluster_name}/ingresses")
async def get_gcp_ingresses(cluster_name: str, cluster_location: str, namespace: str = "default"):
    """Get ingresses in a namespace"""
    try:
        gcp_service = GCPService()
        ingresses = gcp_service.get_ingresses(cluster_name, cluster_location, namespace)
        return ingresses
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"GCP service error: {str(e)}")

@app.get("/api/gcp/clusters/{cluster_name}/ingresses/{ingress_name}/yaml")
async def get_ingress_yaml(cluster_name: str, cluster_location: str, ingress_name: str, namespace: str = "default"):
    """Download ingress YAML"""
    try:
        gcp_service = GCPService()
        yaml_content = gcp_service.get_ingress_yaml(cluster_name, cluster_location, ingress_name, namespace)
        return {"yaml": yaml_content}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"GCP service error: {str(e)}")

@app.get("/api/gcp/clusters/{cluster_name}/secrets")
async def get_gcp_secrets(cluster_name: str, cluster_location: str, namespace: str = "default"):
    """Get secrets in a namespace"""
    try:
        gcp_service = GCPService()
        secrets = gcp_service.get_secrets(cluster_name, cluster_location, namespace)
        return secrets
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"GCP service error: {str(e)}")

@app.get("/api/gcp/clusters/{cluster_name}/secrets/{secret_name}/yaml")
async def get_secret_yaml(cluster_name: str, cluster_location: str, secret_name: str, namespace: str = "default"):
    """Download secret YAML"""
    try:
        gcp_service = GCPService()
        yaml_content = gcp_service.get_secret_yaml(cluster_name, cluster_location, secret_name, namespace)
        return {"yaml": yaml_content}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"GCP service error: {str(e)}")

@app.get("/api/gcp/clusters/{cluster_name}/serviceaccounts")
async def get_gcp_service_accounts(cluster_name: str, cluster_location: str, namespace: str = "default"):
    """Get service accounts in a namespace"""
    try:
        gcp_service = GCPService()
        service_accounts = gcp_service.get_service_accounts(cluster_name, cluster_location, namespace)
        return service_accounts
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"GCP service error: {str(e)}")

@app.get("/api/gcp/clusters/{cluster_name}/serviceaccounts/{sa_name}/yaml")
async def get_service_account_yaml(cluster_name: str, cluster_location: str, sa_name: str, namespace: str = "default"):
    """Download service account YAML"""
    try:
        gcp_service = GCPService()
        yaml_content = gcp_service.get_service_account_yaml(cluster_name, cluster_location, sa_name, namespace)
        return {"yaml": yaml_content}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"GCP service error: {str(e)}")

# AWS Lambda handler for serverless deployment
from mangum import Mangum
handler = Mangum(app)
