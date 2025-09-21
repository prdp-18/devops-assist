# DevOps Companion Mobile App

A React Native/Expo mobile application for managing AWS Lightsail instances and Google Kubernetes Engine (GKE) clusters on the go.

## 🚀 Features

### 📱 Mobile-First Design
- **Native Performance**: Built with React Native and Expo
- **Touch-Optimized**: Designed specifically for mobile interactions
- **Offline Capable**: Cached data for offline access
- **Cross-Platform**: Works on iOS and Android

### 🔐 Security Features
- **JWT Authentication**: Secure token-based authentication
- **Biometric Protection**: Face ID/Touch ID for critical actions
- **Secure Storage**: JWT tokens stored in device keychain
- **PIN Protection**: Fallback authentication method

### ☁️ DevOps Management
- **AWS Lightsail**: View, reboot, and manage instances
- **GKE Clusters**: Monitor pods, nodes, and deployments
- **SSH Access**: Get connection details and execute commands
- **Real-time Status**: Live updates of infrastructure health

## 📋 Prerequisites

### Development Environment
- **Node.js** 18+ 
- **Expo CLI**: `npm install -g @expo/cli`
- **Expo Go App** (for testing on device)
- **Backend API** running on `http://127.0.0.1:8000`

### Mobile Device Requirements
- **iOS**: iOS 13+ with Face ID/Touch ID
- **Android**: Android 8+ with fingerprint/biometric support
- **Network**: Access to backend API

## 🏗️ Architecture

```
┌─────────────────┐    HTTPS/JSON    ┌─────────────────┐    Cloud SDKs  ┌─────────────────┐
│   Mobile App    │ ──────────────► │   Backend API   │ ────────────► │   Cloud Services │
│ (React Native)  │                  │   (FastAPI)     │              │ AWS: Lightsail   │
│                 │                  │                 │              │ GCP: GKE +       │
│                 │                  │                 │              │     Monitoring   │
└─────────────────┘                  └─────────────────┘              └─────────────────┘
```

## 🚀 Quick Start

### 1. Install Dependencies
```bash
cd DevOpsCompanionMobile
npm install
```

### 2. Start Development Server
```bash
# Start Expo development server
npm start

# Or start with specific platform
npm run android  # Android
npm run ios      # iOS (requires macOS)
npm run web      # Web browser
```

### 3. Test on Device
1. **Install Expo Go** on your mobile device
2. **Scan QR code** from terminal/browser
3. **App loads** on your device

### 4. Configure Backend
Ensure your backend API is running on `http://127.0.0.1:8000` or update the API URL in `src/services/AuthService.ts`.

## 📱 App Structure

```
src/
├── components/          # Reusable UI components
├── screens/            # App screens
│   ├── LoginScreen.tsx
│   ├── DashboardScreen.tsx
│   ├── AWSInstancesScreen.tsx
│   ├── GKEClustersScreen.tsx
│   └── SettingsScreen.tsx
├── services/           # API and external services
│   ├── AuthService.ts
│   └── BiometricService.ts
├── types/              # TypeScript type definitions
│   └── navigation.ts
├── utils/              # Utility functions
└── navigation/         # Navigation configuration
```

## 🔧 Configuration

### API Configuration
Update the API base URL in `src/services/AuthService.ts`:
```typescript
const API_BASE_URL = 'http://your-backend-url:8000';
```

### Biometric Authentication
The app automatically detects available biometric methods:
- **iOS**: Face ID, Touch ID
- **Android**: Fingerprint, Face unlock

### Security Settings
- JWT tokens stored securely in device keychain
- Biometric authentication required for critical actions
- Automatic token refresh and validation

## 🧪 Testing

### Development Testing
```bash
# Start development server
npm start

# Test on iOS simulator
npm run ios

# Test on Android emulator
npm run android
```

### Device Testing
1. **Install Expo Go** on your device
2. **Scan QR code** from development server
3. **Test all features**:
   - Login with credentials
   - View AWS instances
   - Manage GKE clusters
   - Test biometric authentication

### API Testing
Ensure backend API is accessible:
```bash
curl http://127.0.0.1:8000/health
curl -X POST http://127.0.0.1:8000/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=admin&password=supersecret"
```

## 📦 Building for Production

### EAS Build (Recommended)
```bash
# Install EAS CLI
npm install -g eas-cli

# Login to Expo
eas login

# Configure build
eas build:configure

# Build for Android
eas build --platform android

# Build for iOS
eas build --platform ios
```

### Local Build
```bash
# Create production build
expo build:android
expo build:ios
```

## 🚀 Deployment

### App Store Distribution
1. **Build production app** using EAS Build
2. **Submit to stores**:
   - Google Play Store (Android)
   - Apple App Store (iOS)
3. **Configure app store** metadata and screenshots

### Enterprise Distribution
- **Internal distribution** via EAS Build
- **Ad-hoc distribution** for testing
- **Custom app stores** for enterprise

## 🔐 Security Considerations

### Authentication
- JWT tokens expire automatically
- Secure storage in device keychain
- Biometric authentication for critical actions

### Network Security
- HTTPS required for production
- Certificate pinning recommended
- API rate limiting

### Data Protection
- No sensitive data stored locally
- Encrypted communication
- Secure token storage

## 🐛 Troubleshooting

### Common Issues

1. **Metro bundler errors**
   ```bash
   npx expo start --clear
   ```

2. **Build failures**
   ```bash
   rm -rf node_modules
   npm install
   ```

3. **API connection issues**
   - Check backend is running
   - Verify API URL configuration
   - Check network connectivity

4. **Biometric authentication not working**
   - Ensure device supports biometrics
   - Check app permissions
   - Test with device settings

### Debug Mode
```bash
# Enable debug mode
expo start --dev-client

# View logs
expo logs
```

## 📊 Performance

### Optimization Features
- **Lazy loading** of screens
- **Image optimization** for assets
- **Efficient state management**
- **Minimal bundle size**

### Monitoring
- **Performance metrics** via Expo Analytics
- **Crash reporting** with Sentry
- **User analytics** and behavior tracking

## 🤝 Contributing

1. **Fork the repository**
2. **Create feature branch**
3. **Make changes**
4. **Test thoroughly**
5. **Submit pull request**

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For issues and questions:
1. Check the troubleshooting section
2. Review Expo documentation
3. Create an issue in the repository

---

**⚠️ Security Notice**: This app is designed for internal DevOps use. Ensure proper network security and access controls in production environments.
