# DevOps Companion App

A comprehensive multi-platform DevOps management platform for managing AWS Lightsail instances and Google Kubernetes Engine (GKE) clusters. Available as both a Progressive Web App (PWA) and native mobile application.

## 📱 Platform Support

- **🌐 Progressive Web App (PWA)**: Cross-platform web application with offline capabilities
- **📱 React Native Mobile App**: Native iOS and Android application with Expo framework
- **🖥️ Desktop**: Full desktop support via web browser or mobile app

## 🚀 Features

### 📱 Mobile Application (React Native + Expo)
- **Native Performance**: Optimized for iOS and Android with native components
- **Biometric Authentication**: Touch ID and Face ID support for secure access
- **Offline Caching**: Intelligent caching system for AWS instances and GKE resources
- **Real-time Updates**: Live status updates with pull-to-refresh functionality
- **Touch-Optimized UI**: Mobile-first design with gesture support
- **Cross-Platform**: Single codebase for iOS and Android
- **Expo Integration**: Easy development and deployment with Expo Go

### 📱 Progressive Web App (PWA)
- **Mobile-First Design**: Optimized for mobile devices with touch-friendly interface
- **Offline Capabilities**: Cached data and offline page for critical situations
- **Installable**: Add to home screen on iOS, Android, and desktop
- **Push Notifications**: Ready for critical DevOps alerts
- **Service Worker**: Background sync and caching for better performance
- **Cross-Platform**: Works on all devices without app store approval

### 🔐 Authentication & Security
- **JWT-based Authentication**: Secure token-based authentication system
- **Session Management**: Browser-based session storage with automatic token refresh
- **Role-based Access**: Configurable user permissions and access controls

### ☁️ AWS Lightsail Management
- **Instance Monitoring**: View all Lightsail instances with real-time status across multiple regions
- **Instance Control**: Reboot instances with confirmation dialogs and loading states
- **SSH Management**: Get SSH connection details including IP, username, and key information
- **System Commands**: Execute comprehensive system commands on instances via SSH
  - Memory usage (`free -h`)
  - Disk usage (`df -h`)
  - System status (`systemctl status`)
  - Service restart (`systemctl restart`)
  - Cache clearing (`sync && echo 3 > /proc/sys/vm/drop_caches`)
- **Multi-Region Support**: Automatic discovery across all AWS regions
- **Caching System**: Intelligent caching to reduce API calls and improve performance
- **Error Handling**: Detailed error messages with actionable feedback

### 🐳 Google Kubernetes Engine (GKE) Management
- **Hierarchical Navigation**: Complete cluster → namespace → pod → advanced operations flow
- **Cluster Management**: 
  - List and manage GKE clusters across regions/zones
  - Cluster health monitoring and status display
  - Node resource usage and capacity planning
- **Namespace Operations**: 
  - Browse and manage Kubernetes namespaces
  - Cross-namespace pod viewing with "-A" flag support
- **Pod Management**: 
  - View pods with detailed status, resource usage, and container information
  - Pod ready state display (e.g., "1/1", "3/3")
  - Age calculation and restart count tracking
  - Restart pods with automatic recreation
  - Delete pods with confirmation
  - View pod logs with configurable line count
  - Describe pods with detailed YAML output
  - Scale deployments with intelligent deployment name extraction
- **Node Management**:
  - View cluster nodes with status and resource information
  - Monitor node resource usage (CPU, memory)
  - Wide format node listing with additional details
- **Advanced Kubernetes Operations**:
  - **Deployment Management**: List, scale, rollout restart, edit with live YAML editor
  - **Service Management**: List, view YAML, download YAML files
  - **Ingress Management**: List, view YAML, download YAML files
  - **Secret Management**: List, view YAML, download YAML files
  - **Service Account Management**: List, view YAML, download YAML files
  - **Real-time YAML Editing**: Live editing and deployment of Kubernetes resources
  - **File Download**: Native file download for YAML resources

### 📊 Monitoring & Observability
- **Real-time Metrics**: CPU and memory utilization for GCP resources
- **Resource Usage**: Detailed resource limits, requests, and actual usage
- **Health Checks**: Built-in health monitoring for all services
- **Logging**: Comprehensive logging for troubleshooting and audit

### 🌐 Web Interface
- **Responsive Design**: Modern, mobile-friendly interface
- **Real-time Updates**: Live status updates and automatic refresh
- **Interactive Modals**: Detailed views for SSH info, logs, and resource descriptions
- **Copy-to-Clipboard**: Easy copying of SSH commands and connection details
- **Multi-cloud Support**: Seamless switching between AWS and GCP resources

## 📋 Prerequisites

### Required Tools
- **Python** 3.9+ (for backend development)
- **Modern Web Browser** (Chrome, Firefox, Safari, Edge)
- **Google Cloud SDK** (for GCP credentials configuration)

### Cloud Requirements
- **AWS Account** with appropriate permissions for Lightsail
- **GCP Account** with GKE clusters and appropriate service account permissions
- **SSH Keys** for Lightsail instance access (stored locally)

## 🏗️ Architecture

### Multi-Platform Architecture
```
┌─────────────────┐    HTTPS/JSON    ┌─────────────────┐    Cloud SDKs  ┌─────────────────┐
│   Web App       │ ──────────────► │   Backend API   │ ────────────► │   Cloud Services │
│  (HTML/CSS/JS)  │                  │   (FastAPI)     │              │ AWS: Lightsail   │
│                 │                  │                 │              │ GCP: GKE +       │
│                 │                  │                 │              │     Monitoring   │
└─────────────────┘                  └─────────────────┘              └─────────────────┘
┌─────────────────┐    HTTPS/JSON    ┌─────────────────┐
│   Mobile App    │ ──────────────► │   Backend API   │
│ (React Native)  │                  │   (FastAPI)     │
│                 │                  │                 │
└─────────────────┘                  └─────────────────┘
```

### Mobile App Architecture (React Native + Expo)
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   UI Layer      │    │  Service Layer  │    │   Storage Layer │
│                 │    │                 │    │                 │
│ • Screens       │◄──►│ • AuthService   │◄──►│ • AsyncStorage  │
│ • Components    │    │ • AWSService    │    │ • InstanceCache │
│ • Navigation    │    │ • GKEService    │    │ • BiometricAuth │
│ • Modals        │    │ • BiometricSvc  │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 📊 Development Status

### ✅ Completed Features

#### Web Application (PWA)
- ✅ **Complete AWS Lightsail Management**: Instance monitoring, SSH access, system commands
- ✅ **Complete GKE Management**: Hierarchical navigation, pod management, advanced operations
- ✅ **Real-time YAML Editing**: Live editing and deployment of Kubernetes resources
- ✅ **File Download System**: Native YAML file downloads
- ✅ **Authentication System**: JWT-based authentication with session management
- ✅ **Responsive Design**: Mobile-first design with touch-friendly interface

#### Mobile Application (React Native + Expo)
- ✅ **Core Infrastructure**: React Native + Expo framework setup
- ✅ **Authentication System**: JWT authentication with biometric support
- ✅ **AWS Lightsail Integration**: Complete instance management with caching
- ✅ **GKE Hierarchical Navigation**: Cluster → Namespace → Pod → Advanced Operations
- ✅ **Real-time Operations**: Pod restart, scaling, YAML editing
- ✅ **File Download**: Native file sharing for YAML resources
- ✅ **Mobile UI/UX**: Touch-optimized interface with proper modal handling
- ✅ **Keyboard Management**: iPhone-specific keyboard handling with caps lock toggle
- ✅ **Error Handling**: Comprehensive error messages and loading states

### 🔄 Recent Improvements (Latest Updates)

#### Mobile App Enhancements
- ✅ **Fixed Modal Positioning**: Centered modals with proper sizing
- ✅ **Enhanced Keyboard UX**: Caps lock toggle for iPhone users
- ✅ **Improved File Downloads**: Native file sharing with proper YAML downloads
- ✅ **Better Error Handling**: Detailed error messages with actionable feedback
- ✅ **Performance Optimizations**: Intelligent caching and reduced API calls
- ✅ **UI Polish**: Loading animations, proper button states, and visual feedback

#### GKE Functionality Overhaul
- ✅ **Complete Redesign**: Hierarchical navigation matching web app
- ✅ **Advanced Operations**: All Kubernetes resource types with proper actions
- ✅ **YAML Editor**: Live editing with keyboard dismissal and file operations
- ✅ **Pod Management**: Ready state display, age calculation, restart tracking
- ✅ **Deployment Scaling**: Intelligent deployment name extraction from pod metadata

### 🚧 Upcoming Features & Fixes

#### Mobile App Roadmap
- 🔄 **Push Notifications**: Critical DevOps alerts and status updates
- 🔄 **Offline Mode**: Enhanced offline capabilities with data synchronization
- 🔄 **Advanced Caching**: More intelligent caching strategies
- 🔄 **Performance Monitoring**: Real-time performance metrics and alerts
- 🔄 **Multi-Account Support**: Support for multiple AWS/GCP accounts

#### Web App Enhancements
- 🔄 **Enhanced Monitoring**: Advanced metrics and alerting system
- 🔄 **Team Collaboration**: Multi-user support with role-based access
- 🔄 **API Rate Limiting**: Improved rate limiting and request optimization
- 🔄 **Advanced Security**: Enhanced security features and audit logging

## 🚀 Quick Start

### 1. Clone and Setup

```bash
git clone https://github.com/prdp-18/devops-assist.git
cd devops-assist
```

### 2. Mobile App Setup (React Native + Expo)

**Prerequisites:**
- Node.js 18+ and npm
- Expo CLI: `npm install -g @expo/cli`
- Expo Go app on your mobile device (iOS/Android)

**Development Setup:**
```bash
# Navigate to mobile app directory
cd DevOpsCompanionMobile

# Install dependencies
npm install --legacy-peer-deps

# Start development server
npx expo start --tunnel

# Scan QR code with Expo Go app
```

**Production Build:**
```bash
# Build for iOS
npx expo build:ios

# Build for Android
npx expo build:android
```

### 3. PWA Installation (Recommended)

**For Mobile/Desktop:**
1. Open the web app in Chrome/Edge: `http://127.0.0.1:3000`
2. Look for the install prompt at the bottom
3. Click "Install" to add to home screen
4. App opens in standalone mode (no browser UI)

**For Mobile (Android Chrome):**
1. Open in mobile Chrome browser
2. Tap menu → "Add to Home screen"
3. App icon appears on home screen
4. Tap icon to open in standalone mode

### 2. Configure Environment

```bash
# Copy and update backend environment
cp backend/env.example backend/.env
# Edit backend/.env with your AWS credentials (access key and secret key)

# Configure GCP credentials
gcloud auth application-default login
gcloud config set project YOUR_PROJECT_ID
gcloud container clusters get-credentials YOUR_CLUSTER_NAME
```

### 3. Local Development

```bash
# Start backend server
cd backend
source venv/bin/activate
uvicorn main:app --host 127.0.0.1 --port 8000

# In another terminal, start frontend server
cd web-app
python -m http.server 3000 --bind 127.0.0.1

# Open web app in browser
open http://127.0.0.1:3000
```

## 🌐 Production Deployment

### 1. Deploy Backend

```bash
# Run backend directly
cd backend
source venv/bin/activate
uvicorn main:app --host 0.0.0.0 --port 8000
```

### 2. Deploy Frontend

```bash
# Serve frontend files
cd web-app
python -m http.server 3000 --bind 0.0.0.0
```

### 3. Test Deployment

```bash
# Test health endpoint
curl http://localhost:8000/health

# Test authentication
curl -X POST http://localhost:8000/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=admin&password=supersecret"
```

## 🌐 Web App Configuration

The web app automatically configures itself based on the environment:

- **Development**: Uses local backend (`http://127.0.0.1:8000`)
- **Production**: Uses deployed backend URL

## 🔧 Technical Specifications

### Mobile App Stack
- **Framework**: React Native 0.81.4
- **Development Platform**: Expo SDK 54
- **Navigation**: React Navigation 6.x
- **State Management**: React Hooks (useState, useEffect)
- **Authentication**: JWT with AsyncStorage
- **Biometric Auth**: Expo LocalAuthentication
- **File Operations**: Expo FileSystem + Expo Sharing
- **Clipboard**: Expo Clipboard
- **Platform Support**: iOS 13+, Android 8+

### Web App Stack
- **Frontend**: Vanilla HTML5, CSS3, JavaScript ES6+
- **Backend**: Python 3.9+ with FastAPI
- **Authentication**: JWT with session storage
- **Cloud SDKs**: AWS SDK (boto3), Google Cloud SDK
- **Deployment**: Uvicorn ASGI server

### Backend Environment Variables

```bash
# backend/.env
SECRET_KEY=your-jwt-secret-key
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
AWS_DEFAULT_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
GCP_PROJECT_ID=your-gcp-project-id
GCP_SERVICE_ACCOUNT_KEY=path-to-service-account-json
```

## 🔐 Security

### Authentication Flow
1. User enters credentials in web app
2. Backend validates credentials and returns JWT
3. JWT stored securely in browser session storage
4. All API requests include JWT in Authorization header
5. Critical actions require additional confirmation

### IAM Permissions
The backend service uses minimal IAM permissions:

**AWS Permissions:**
- `lightsail:RebootInstance`
- `lightsail:GetInstance`
- `lightsail:GetInstanceState`
- `lightsail:GetInstances`

**GCP Permissions:**
- `container.clusters.get`
- `container.clusters.list`
- `container.operations.get`
- `monitoring.metricDescriptors.list`
- `monitoring.timeSeries.list`

### Default Credentials
**⚠️ Change these in production!**
- Username: `admin`
- Password: `supersecret`

## 📊 API Endpoints

### Authentication
- `POST /token` - Get JWT token
- `GET /health` - Service health status

### AWS Lightsail Management
- `GET /api/instances` - List all Lightsail instances with metrics
- `POST /api/instances/{name}/reboot` - Reboot Lightsail instance
- `GET /api/instances/{name}/ssh-info` - Get SSH connection information
- `POST /api/instances/{name}/system-command` - Execute system commands via SSH

### GCP GKE Management

#### Cluster Operations
- `GET /api/gcp/clusters` - List GKE clusters
- `GET /api/gcp/clusters/{cluster}/namespaces` - List namespaces in cluster
- `GET /api/gcp/clusters/{cluster}/nodes` - List cluster nodes
- `GET /api/gcp/clusters/{cluster}/nodes/top` - Get node resource usage

#### Pod Operations
- `GET /api/gcp/clusters/{cluster}/namespaces/{namespace}/pods` - List pods in namespace
- `GET /api/gcp/clusters/{cluster}/pods/all` - List all pods across namespaces
- `POST /api/gcp/clusters/{cluster}/namespaces/{namespace}/pods/{pod}/restart` - Restart pod
- `DELETE /api/gcp/clusters/{cluster}/namespaces/{namespace}/pods/{pod}` - Delete pod
- `GET /api/gcp/clusters/{cluster}/namespaces/{namespace}/pods/{pod}/metrics` - Get pod metrics
- `GET /api/gcp/clusters/{cluster}/namespaces/{namespace}/pods/{pod}/logs` - Get pod logs
- `GET /api/gcp/clusters/{cluster}/namespaces/{namespace}/pods/{pod}/describe` - Describe pod

#### Deployment Operations
- `GET /api/gcp/clusters/{cluster}/deployments` - List deployments
- `GET /api/gcp/clusters/{cluster}/deployments/{deployment}/yaml` - Get deployment YAML
- `POST /api/gcp/clusters/{cluster}/deployments/{deployment}/rollout` - Rollout restart deployment
- `PUT /api/gcp/clusters/{cluster}/deployments/{deployment}/edit` - Edit deployment
- `POST /api/gcp/clusters/{cluster}/namespaces/{namespace}/deployments/{deployment}/scale` - Scale deployment

#### Service Operations
- `GET /api/gcp/clusters/{cluster}/services` - List services
- `GET /api/gcp/clusters/{cluster}/services/{service}/yaml` - Get service YAML

#### Ingress Operations
- `GET /api/gcp/clusters/{cluster}/ingresses` - List ingresses
- `GET /api/gcp/clusters/{cluster}/ingresses/{ingress}/yaml` - Get ingress YAML

#### Secret Operations
- `GET /api/gcp/clusters/{cluster}/secrets` - List secrets
- `GET /api/gcp/clusters/{cluster}/secrets/{secret}/yaml` - Get secret YAML

#### Service Account Operations
- `GET /api/gcp/clusters/{cluster}/serviceaccounts` - List service accounts
- `GET /api/gcp/clusters/{cluster}/serviceaccounts/{sa}/yaml` - Get service account YAML

## 🧪 Testing

### Backend Testing
```bash
cd backend
source venv/bin/activate
python -m pytest tests/
```

### Web App Testing
Open the web app in your browser and test the functionality manually.

### API Testing
```bash
# Test authentication
curl -X POST http://localhost:8000/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=admin&password=supersecret"

# Test AWS instances (requires valid token)
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:8000/api/instances

# Test GCP clusters (requires valid token)
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:8000/api/gcp/clusters
```

## 🚨 Troubleshooting

### Mobile App Issues

1. **Expo Build Errors**
   ```bash
   # Clear cache and reinstall
   npx expo install --fix
   npm install --legacy-peer-deps
   ```

2. **iOS Simulator Issues**
   ```bash
   # Reset iOS Simulator
   npx expo run:ios --clear
   ```

3. **Android Build Issues**
   ```bash
   # Clear Android cache
   npx expo run:android --clear
   ```

4. **Network Connection Issues**
   - Ensure backend is running on `0.0.0.0:8000` (not `127.0.0.1`)
   - Check Tailscale network connectivity
   - Verify API endpoints in `AuthService.ts`

5. **Keyboard Issues on iPhone**
   - Use caps lock toggle button in YAML editor
   - Tap "Done" button to dismiss keyboard
   - Ensure proper keyboard dismissal handlers

### Common Issues

1. **AWS Credentials Not Found**
   ```bash
   aws configure
   # Enter your AWS Access Key ID, Secret Access Key, and region
   ```

2. **GCP Credentials Not Found**
   ```bash
   gcloud auth application-default login
   # Or set GOOGLE_APPLICATION_CREDENTIALS environment variable
   ```

3. **Web App Can't Connect to Backend**
   - Check if backend is running: `curl http://127.0.0.1:8000/health`
   - Verify backend is accessible from browser
   - Check CORS configuration

4. **SSH Connection Issues**
   - Verify SSH keys are available in `~/.ssh/`
   - Check instance has public IP address
   - Ensure SSH key permissions are correct (600)

5. **GCP Cluster Access Issues**
   - Verify `gcloud` CLI is installed and configured
   - Check cluster credentials: `gcloud container clusters get-credentials CLUSTER_NAME`
   - Ensure kubectl is installed and working

### Logs

```bash
# Backend logs (local)
# Check uvicorn output in terminal

# Browser console logs
# Open browser developer tools to view console logs
```

## 🔄 Development Workflow

1. **Make Changes**: Edit code in backend or web app
2. **Test Locally**: Start backend and frontend servers
3. **Deploy**: Run backend and frontend on production servers
4. **Test Production**: Verify API endpoints work
5. **Update Web App**: Refresh browser to see changes

## 📈 Monitoring

### Application Metrics
- Backend service health and performance
- API request count and latency
- AWS Lightsail instance metrics
- GCP GKE cluster and pod metrics

### Logs
- Backend service logs (uvicorn output)
- Browser console logs
- Cloud provider logs (GCP Logging)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For issues and questions:
1. Check the troubleshooting section
2. Review application logs
3. Create an issue in the repository

---

**⚠️ Security Notice**: This app is designed for internal DevOps use. Ensure proper network security and access controls in production environments.

## 🔧 Advanced Configuration

### SSH Key Management
Ensure your SSH keys are available in the standard location:

#### **Download AWS Lightsail SSH Key:**
1. **Go to AWS Lightsail Console**
2. **Navigate to Account → SSH Keys**
3. **Download the default key pair**
4. **Save it as `LightsailDefaultKeyPair.pem` in your `~/.ssh/` directory**

```bash
# SSH keys should be in ~/.ssh/ directory
ls ~/.ssh/LightsailDefaultKeyPair.pem
chmod 600 ~/.ssh/LightsailDefaultKeyPair.pem

# Verify SSH key permissions
ls -la ~/.ssh/LightsailDefaultKeyPair.pem
# Should show: -rw------- (600 permissions)
```

#### **Alternative SSH Key Names:**
The app also supports these common AWS Lightsail key names:
- `lightsail-default-ohio`
- `lightsail-default-virginia` 
- `lightsail-default-oregon`
- `LightsailDefaultKeyPair`

### GCP Setup
1. Authenticate with GCP: `gcloud auth application-default login`
2. Set your project: `gcloud config set project YOUR_PROJECT_ID`
3. Connect to your cluster: `gcloud container clusters get-credentials YOUR_CLUSTER_NAME`

### Custom Regions
The app supports multiple AWS regions and GCP locations. Update the region/location parameters in API calls as needed.

### Resource Limits
Configure resource limits in the backend for:
- SSH command execution timeout
- API request timeout
- Memory usage limits
- Concurrent request limits

GKE Functionality Completely Redesigned!
I've completely redesigned the mobile GKE interface to match the web app's hierarchical navigation system. Here's what I've implemented:
🔄 New Hierarchical Navigation System
1. Cluster Level (GKEClustersScreen.tsx - Updated)
View Namespaces - Navigate to namespace list
View All Pods (-A) - View pods across all namespaces
View Nodes - Show cluster node details
View Cluster Health - Display cluster health metrics
2. Namespace Level (GKENamespacesScreen.tsx - New)
Lists all namespaces in the cluster
Each namespace has a "View Pods" button
Clean card-based layout matching web app
3. Pod Level (GKEPodsScreen.tsx - New)
Shows pods in the selected namespace
Pod options: Restart Pod, View Logs, Describe Pod, Scale Deployment
Advanced Operations section with buttons for:
Deployments (View & Manage)
Services (View & Download)
Ingresses (View & Manage)
Secrets (View & Download)
Service Accounts (View & Manage)
4. Advanced Operations Level (GKEAdvancedOperationsScreen.tsx - New)
Resource-specific management (deployments, services, etc.)
Download YAML functionality
Edit Deployment with live YAML editor
Real-time YAML editing and deployment
🔧 Enhanced GKEService
Added comprehensive API methods:
getPods(), restartPod(), getPodLogs(), describePod()
scaleDeployment(), getServices(), getIngresses()
getSecrets(), getServiceAccounts()
getResourceYaml(), updateResourceYaml()
�� Key Features Matching Web App
✅ Hierarchical Navigation - Proper drill-down from clusters → namespaces → pods → advanced ops
✅ Real-time Operations - Pod restart, scaling, YAML editing
✅ Advanced Operations - All resource types with proper actions
✅ YAML Editor - Live editing and deployment of Kubernetes resources
✅ Proper Navigation - Back buttons and breadcrumb-style navigation
✅ Loading States - Visual feedback for all operations
✅ Error Handling - Comprehensive error messages
🚀 Ready to Test!
The mobile GKE functionality now matches the web app's comprehensive feature set. You can:
Navigate through the hierarchy exactly like the web app
Perform all the same operations - pod management, scaling, YAML editing
Access advanced operations for all Kubernetes resource types
Edit and deploy resources with real-time YAML editing
The interface now provides the same powerful GKE management capabilities as the web version, with proper mobile-optimized navigation and touch-friendly controls! 🎉


 cd /home/pradeep/devops-toolkit/DevOpsCompanionMobile && pkill -f expo && npx expo start --tunnel

 cd /home/pradeep/devops-toolkit/DevOpsCompanionMobile && npm install --legacy-peer-deps

 $ cd /home/pradeep/devops-toolkit && ./setup-mobile.sh docker

  cd /home/pradeep/devops-toolkit && docker compose -f docker-compose.mobile.yml up --build -d

  uvicorn main:app --host 0.0.0.0 --port 8000