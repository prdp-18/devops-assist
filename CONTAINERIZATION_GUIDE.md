# 🐳 DevOps Companion Containerization Guide

This guide explains how to containerize your DevOps Companion application and handle SSH keys and GCP Application Default Credentials (ADC) properly.

## 📋 Table of Contents

1. [Overview](#overview)
2. [SSH Keys in Containers](#ssh-keys-in-containers)
3. [GCP Application Default Credentials](#gcp-application-default-credentials)
4. [Docker Setup](#docker-setup)
5. [Production Deployment](#production-deployment)
6. [Security Considerations](#security-considerations)
7. [Troubleshooting](#troubleshooting)

## 🎯 Overview

The DevOps Companion application consists of:
- **Backend API**: FastAPI service for AWS/GCP management
- **Frontend PWA**: Progressive Web App with offline capabilities
- **Redis**: Session management and caching
- **Nginx**: Web server for frontend

## 🔑 SSH Keys in Containers

### How SSH Keys Work in Containers

SSH keys are used to authenticate with AWS Lightsail instances. Here's how they work:

#### **1. SSH Key Structure**
```
ssh-keys/
├── LightsailDefaultKeyPair.pem    # AWS Lightsail default key
├── lightsail-default-ohio.pem     # Region-specific keys
├── lightsail-default-virginia.pem
└── lightsail-default-oregon.pem
```

#### **2. Container SSH Key Mounting**
```yaml
volumes:
  - ./ssh-keys:/home/appuser/.ssh:ro  # Read-only mount
```

#### **3. SSH Key Permissions**
```bash
# Set proper permissions
chmod 700 /home/appuser/.ssh
chmod 600 /home/appuser/.ssh/*.pem
```

#### **4. SSH Key Usage in Code**
```python
# In your backend code
ssh_key_path = f"/home/appuser/.ssh/{key_name}.pem"
ssh_command = [
    "ssh", 
    "-i", ssh_key_path,
    "-o", "StrictHostKeyChecking=no",
    f"{username}@{public_ip}",
    command
]
```

### **SSH Key Setup Steps**

1. **Download AWS Lightsail SSH Keys**
   ```bash
   # Create SSH keys directory
   mkdir -p ssh-keys
   
   # Download from AWS Lightsail Console
   # Account → SSH Keys → Download
   # Save as ssh-keys/LightsailDefaultKeyPair.pem
   ```

2. **Set Proper Permissions**
   ```bash
   chmod 700 ssh-keys
   chmod 600 ssh-keys/*.pem
   ```

3. **Test SSH Connection**
   ```bash
   ssh -i ssh-keys/LightsailDefaultKeyPair.pem ubuntu@your-instance-ip
   ```

## ☁️ GCP Application Default Credentials

### How ADC Works in Containers

Application Default Credentials (ADC) provide authentication for Google Cloud services without hardcoding credentials.

#### **1. ADC Hierarchy**
```
1. GOOGLE_APPLICATION_CREDENTIALS environment variable
2. gcloud auth application-default login
3. Service account attached to the resource
4. Compute Engine default service account
5. Google Cloud SDK default service account
```

#### **2. Container ADC Options**

**Option A: Service Account Key File (Development)**
```yaml
environment:
  - GOOGLE_APPLICATION_CREDENTIALS=/app/gcp-credentials.json
volumes:
  - ./gcp-credentials.json:/app/gcp-credentials.json:ro
```

**Option B: Workload Identity (Production)**
```yaml
environment:
  - GOOGLE_APPLICATION_CREDENTIALS=/var/secrets/google/key.json
volumes:
  - /var/secrets/google:/var/secrets/google:ro
```

**Option C: Metadata Server (GKE/Cloud Run)**
```yaml
# No volumes needed - uses metadata server
environment:
  - GCP_PROJECT_ID=your-project-id
```

#### **3. ADC Setup Steps**

**For Development:**
```bash
# 1. Create service account
gcloud iam service-accounts create devops-companion \
    --display-name="DevOps Companion Service Account"

# 2. Grant necessary permissions
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
    --member="serviceAccount:devops-companion@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
    --role="roles/container.developer"

# 3. Create and download key
gcloud iam service-accounts keys create gcp-credentials.json \
    --iam-account=devops-companion@YOUR_PROJECT_ID.iam.gserviceaccount.com
```

**For Production (GKE):**
```bash
# 1. Enable Workload Identity
gcloud container clusters update YOUR_CLUSTER \
    --workload-pool=YOUR_PROJECT_ID.svc.id.goog

# 2. Create Kubernetes service account
kubectl create serviceaccount devops-companion-sa

# 3. Bind to Google service account
gcloud iam service-accounts add-iam-policy-binding \
    devops-companion@YOUR_PROJECT_ID.iam.gserviceaccount.com \
    --role roles/iam.workloadIdentityUser \
    --member "serviceAccount:YOUR_PROJECT_ID.svc.id.goog[default/devops-companion-sa]"
```

## 🐳 Docker Setup

### **1. Build and Run**

```bash
# Build all services
docker-compose build

# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop all services
docker-compose down
```

### **2. Environment Configuration**

```bash
# Copy environment template
cp env.production .env

# Edit with your values
nano .env
```

### **3. Service-Specific Commands**

```bash
# Backend only
docker-compose up backend

# Frontend only
docker-compose up frontend

# Scale backend
docker-compose up --scale backend=3
```

### **4. Development Mode**

```bash
# Mount source code for development
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up
```

## 🚀 Production Deployment

### **1. Docker Swarm**

```bash
# Initialize swarm
docker swarm init

# Deploy stack
docker stack deploy -c docker-compose.yml devops-companion

# Scale services
docker service scale devops-companion_backend=3
```

### **2. Kubernetes**

```bash
# Create namespace
kubectl create namespace devops-companion

# Deploy with Helm
helm install devops-companion ./helm-chart \
    --namespace devops-companion \
    --set image.tag=latest
```

### **3. Cloud Deployment**

**AWS ECS:**
```bash
# Build and push to ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 123456789012.dkr.ecr.us-east-1.amazonaws.com
docker tag devops-companion-backend:latest 123456789012.dkr.ecr.us-east-1.amazonaws.com/devops-companion-backend:latest
docker push 123456789012.dkr.ecr.us-east-1.amazonaws.com/devops-companion-backend:latest
```

**Google Cloud Run:**
```bash
# Build and deploy
gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/devops-companion
gcloud run deploy devops-companion \
    --image gcr.io/YOUR_PROJECT_ID/devops-companion \
    --platform managed \
    --region us-central1
```

## 🔒 Security Considerations

### **1. Secrets Management**

**Docker Secrets:**
```yaml
secrets:
  aws_credentials:
    file: ./secrets/aws-credentials.json
  gcp_credentials:
    file: ./secrets/gcp-credentials.json

services:
  backend:
    secrets:
      - aws_credentials
      - gcp_credentials
```

**Kubernetes Secrets:**
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: devops-companion-secrets
type: Opaque
data:
  aws-access-key: <base64-encoded>
  aws-secret-key: <base64-encoded>
  gcp-credentials: <base64-encoded>
```

### **2. Network Security**

```yaml
# Internal network only
networks:
  devops-network:
    driver: bridge
    internal: true

# Firewall rules
services:
  backend:
    networks:
      - devops-network
    # No external ports for internal services
```

### **3. Container Security**

```dockerfile
# Use non-root user
USER appuser

# Read-only filesystem
RUN chmod 755 /app && chown -R appuser:appuser /app

# Security scanning
RUN pip install safety && safety check
```

## 🐛 Troubleshooting

### **Common Issues**

**1. SSH Key Permission Denied**
```bash
# Check permissions
docker exec -it devops-companion-backend ls -la /home/appuser/.ssh/

# Fix permissions
docker exec -it devops-companion-backend chmod 600 /home/appuser/.ssh/*.pem
```

**2. GCP Authentication Failed**
```bash
# Check credentials
docker exec -it devops-companion-backend gcloud auth list

# Test ADC
docker exec -it devops-companion-backend gcloud auth application-default print-access-token
```

**3. Container Won't Start**
```bash
# Check logs
docker-compose logs backend

# Debug container
docker run -it --rm devops-companion-backend /bin/bash
```

**4. Network Connectivity**
```bash
# Test internal connectivity
docker exec -it devops-companion-backend curl http://redis:6379
docker exec -it devops-companion-frontend curl http://backend:8000/health
```

### **Debug Commands**

```bash
# Inspect container
docker inspect devops-companion-backend

# Check environment variables
docker exec devops-companion-backend env

# Test SSH connection
docker exec devops-companion-backend ssh -i /home/appuser/.ssh/LightsailDefaultKeyPair.pem -o ConnectTimeout=5 ubuntu@test-ip

# Test GCP connection
docker exec devops-companion-backend gcloud container clusters list
```

## 📊 Monitoring

### **Health Checks**

```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 40s
```

### **Logging**

```yaml
logging:
  driver: "json-file"
  options:
    max-size: "10m"
    max-file: "3"
```

### **Metrics**

```python
# Add to backend
from prometheus_client import Counter, Histogram, generate_latest

REQUEST_COUNT = Counter('requests_total', 'Total requests', ['method', 'endpoint'])
REQUEST_DURATION = Histogram('request_duration_seconds', 'Request duration')

@app.middleware("http")
async def metrics_middleware(request: Request, call_next):
    start_time = time.time()
    response = await call_next(request)
    duration = time.time() - start_time
    
    REQUEST_COUNT.labels(method=request.method, endpoint=request.url.path).inc()
    REQUEST_DURATION.observe(duration)
    
    return response
```

## 🎯 Best Practices

1. **Use multi-stage builds** for smaller images
2. **Mount secrets as volumes** instead of environment variables
3. **Use health checks** for all services
4. **Implement proper logging** and monitoring
5. **Use non-root users** in containers
6. **Scan images** for vulnerabilities
7. **Use specific image tags** instead of `latest`
8. **Implement resource limits** for production

---

**⚠️ Security Notice**: Always use proper secrets management in production. Never commit credentials to version control.

