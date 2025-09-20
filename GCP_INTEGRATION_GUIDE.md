# GCP/GKE Integration Guide

## 🎉 **GCP Support Successfully Added!**

Your DevOps Companion App now supports **Google Cloud Platform (GCP)** and **Google Kubernetes Engine (GKE)** for comprehensive multi-cloud DevOps management.

## 🆕 **New Features Added**

### Backend API Extensions
- **GCP Service Layer**: Complete service for GKE operations
- **New API Endpoints**: 6 new endpoints for GCP/GKE management
- **Google Cloud SDK Integration**: Container and Monitoring APIs
- **Comprehensive Error Handling**: GCP-specific error management

### Mobile App Enhancements
- **GCP Cluster Screen**: Browse GKE clusters by region
- **Namespace Management**: View namespaces within clusters
- **Pod Management**: List, restart, and delete pods
- **Cloud Selector**: Toggle between AWS and GCP resources
- **Real-time Metrics**: CPU and memory utilization for pods

## 📱 **Mobile App Navigation Flow**

```
Login → Cloud Selector → GCP Clusters → Namespaces → Pods → Actions
```

### New Screens Added:
1. **GCPClusterScreen**: Lists GKE clusters with region selection
2. **GCPNamespaceScreen**: Shows namespaces within a cluster
3. **GCPPodListScreen**: Displays pods with restart/delete actions

## 🔧 **GCP Configuration**

### Backend Environment Variables
```bash
# Add to backend/.env
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
# OR use gcloud auth application-default login
```

### GCP Service Account Permissions
Your GCP service account needs these permissions:
- `container.clusters.list`
- `container.clusters.get`
- `container.pods.list`
- `container.pods.delete`
- `monitoring.metricDescriptors.list`
- `monitoring.timeSeries.list`

## 🚀 **API Endpoints Added**

### GCP/GKE Management
- `GET /api/gcp/clusters` - List GKE clusters
- `GET /api/gcp/clusters/{cluster}/namespaces` - List namespaces
- `GET /api/gcp/clusters/{cluster}/namespaces/{namespace}/pods` - List pods
- `POST /api/gcp/clusters/{cluster}/namespaces/{namespace}/pods/{pod}/restart` - Restart pod
- `DELETE /api/gcp/clusters/{cluster}/namespaces/{namespace}/pods/{pod}` - Delete pod
- `GET /api/gcp/clusters/{cluster}/namespaces/{namespace}/pods/{pod}/metrics` - Get metrics

## 🧪 **Testing Coverage**

### Backend Tests
- **GCP Service Tests**: Complete test coverage for all GCP operations
- **Mock Implementations**: Simulated GCP API responses for testing
- **Error Handling Tests**: GCP-specific error scenarios

### Mobile App Tests
- **GCP API Service Tests**: All GCP API calls tested
- **Authentication Tests**: Biometric auth for GCP operations
- **Error Handling**: Network and authentication error scenarios

## 📊 **Data Models**

### New TypeScript Interfaces
- `Pod`: Complete pod information with containers and resources
- `Cluster`: GKE cluster details with status and metrics
- `Namespace`: Kubernetes namespace information
- `PodActionResponse`: Action result responses
- `PodMetrics`: Resource utilization metrics

## 🔐 **Security Features**

### Biometric Authentication
- **Critical Actions**: Restart and delete operations require biometric confirmation
- **Secure Storage**: JWT tokens stored in device keychain
- **Multi-cloud Security**: Same security model for AWS and GCP

### IAM Integration
- **Service Account**: Uses GCP service account for API access
- **Minimal Permissions**: Only required GKE and monitoring permissions
- **No Credential Storage**: No GCP credentials stored on mobile device

## 🎯 **Usage Examples**

### View GCP Clusters
```typescript
const clusters = await getGCPClusters('us-central1');
```

### List Pods in Namespace
```typescript
const pods = await getGCPPods('my-cluster', 'default', 'us-central1');
```

### Restart Pod
```typescript
const result = await restartGCPPod('my-cluster', 'default', 'nginx-pod', 'us-central1');
```

## 🔄 **Development Workflow**

### Local Development
1. **Setup GCP Credentials**: `gcloud auth application-default login`
2. **Start Backend**: `./scripts/dev-setup.sh start`
3. **Test GCP APIs**: Use the new endpoints in your mobile app

### Production Deployment
1. **Configure Service Account**: Set up GCP service account with required permissions
2. **Deploy Infrastructure**: `./scripts/deploy.sh`
3. **Update Mobile App**: Build with new GCP features

## 📈 **Monitoring & Observability**

### CloudWatch Metrics (AWS)
- Lambda function invocations and errors
- API Gateway request count and latency

### Google Cloud Monitoring (GCP)
- GKE cluster metrics
- Pod resource utilization
- API call metrics

## 🚨 **Troubleshooting**

### Common GCP Issues

1. **Authentication Errors**
   ```bash
   gcloud auth application-default login
   ```

2. **Permission Denied**
   - Check service account permissions
   - Verify IAM roles are assigned

3. **Cluster Not Found**
   - Verify cluster name and region
   - Check if cluster exists in GCP Console

4. **Pod Operations Fail**
   - Ensure cluster is running
   - Check namespace exists
   - Verify pod name is correct

## 🎊 **What You Can Now Do**

✅ **Browse GKE Clusters** across multiple regions  
✅ **View Namespaces** within each cluster  
✅ **List Pods** with detailed container information  
✅ **Restart Pods** with biometric confirmation  
✅ **Delete Pods** with safety confirmations  
✅ **Monitor Resources** with CPU and memory metrics  
✅ **Switch Between Clouds** seamlessly in the mobile app  
✅ **Secure Operations** with the same security model as AWS  

## 🔮 **Future Enhancements**

The architecture is ready for:
- **Additional GCP Services**: Cloud Run, Compute Engine, etc.
- **More Kubernetes Operations**: Scale deployments, view logs, etc.
- **Advanced Monitoring**: Custom metrics and alerts
- **Multi-region Support**: Enhanced region management

---

**🎉 Congratulations!** Your DevOps Companion App is now a **true multi-cloud DevOps tool** that can manage both AWS Lightsail instances and GCP GKE pods from a single, secure mobile application!

