#!/bin/bash

# DevOps Companion Mobile Setup Script
# This script sets up the mobile development environment

set -e

echo "🚀 Setting up DevOps Companion Mobile Development Environment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    print_error "Docker is not running. Please start Docker first."
    exit 1
fi

print_status "Docker is running ✅"

# Check if .env file exists
if [ ! -f ".env" ]; then
    print_warning ".env file not found. Creating from env.example..."
    if [ -f "env.example" ]; then
        cp env.example .env
        print_success "Created .env file from env.example"
        print_warning "Please edit .env file with your actual credentials"
    else
        print_error "env.example file not found. Please create .env file manually."
        exit 1
    fi
fi

# Check if required environment variables are set
source .env
if [ -z "$AWS_ACCESS_KEY_ID" ] || [ -z "$AWS_SECRET_ACCESS_KEY" ]; then
    print_warning "AWS credentials not set in .env file"
fi

if [ -z "$GCP_PROJECT_ID" ]; then
    print_warning "GCP Project ID not set in .env file"
fi

# Create necessary directories
print_status "Creating necessary directories..."
mkdir -p logs
mkdir -p ssh-keys

# Function to start with Docker Compose
start_with_docker() {
    print_status "Starting services with Docker Compose..."
    docker-compose -f docker-compose.mobile.yml up --build -d
    
    print_success "Services started with Docker Compose!"
    print_status "Backend API: http://localhost:8000"
    print_status "Expo DevTools: http://localhost:19000"
    print_status "Expo Tunnel: Check logs for tunnel URL"
    
    echo ""
    print_status "To view logs: docker-compose -f docker-compose.mobile.yml logs -f"
    print_status "To stop: docker-compose -f docker-compose.mobile.yml down"
}

# Function to start with local Expo
start_with_expo() {
    print_status "Starting with local Expo development server..."
    cd DevOpsCompanionMobile
    
    print_status "Installing dependencies..."
    npm install
    
    print_status "Starting Expo with tunnel mode..."
    print_warning "This will create a public URL accessible from your iPhone"
    echo ""
    
    # Start backend first
    print_status "Starting backend in background..."
    cd ../backend
    if command -v python3 &> /dev/null; then
        python3 -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload &
        BACKEND_PID=$!
        print_success "Backend started with PID: $BACKEND_PID"
    else
        print_error "Python3 not found. Please start backend manually."
        exit 1
    fi
    
    # Start Expo
    cd ../DevOpsCompanionMobile
    print_status "Starting Expo development server..."
    npx expo start --tunnel
    
    # Cleanup function
    cleanup() {
        print_status "Stopping services..."
        if [ ! -z "$BACKEND_PID" ]; then
            kill $BACKEND_PID 2>/dev/null || true
        fi
        exit 0
    }
    
    trap cleanup SIGINT SIGTERM
}

# Function to show mobile testing instructions
show_mobile_instructions() {
    echo ""
    print_success "🎉 Mobile Development Environment Ready!"
    echo ""
    print_status "📱 To test on your iPhone:"
    echo "1. Install 'Expo Go' app from App Store"
    echo "2. Scan the QR code that appears in your terminal"
    echo "3. Or manually enter the tunnel URL in Expo Go"
    echo ""
    print_status "🔧 Development URLs:"
    echo "• Backend API: http://localhost:8000"
    echo "• Expo DevTools: http://localhost:19000"
    echo "• Expo Metro: http://localhost:19001"
    echo ""
    print_status "📋 Available commands:"
    echo "• ./setup-mobile.sh docker    - Start with Docker Compose"
    echo "• ./setup-mobile.sh expo      - Start with local Expo"
    echo "• ./setup-mobile.sh tunnel    - Start with tunnel mode only"
    echo ""
}

# Main script logic
case "${1:-}" in
    "docker")
        start_with_docker
        show_mobile_instructions
        ;;
    "expo")
        start_with_expo
        ;;
    "tunnel")
        print_status "Starting Expo with tunnel mode..."
        cd DevOpsCompanionMobile
        npm install
        npx expo start --tunnel
        ;;
    *)
        echo "DevOps Companion Mobile Setup"
        echo ""
        echo "Usage: $0 [option]"
        echo ""
        echo "Options:"
        echo "  docker  - Start with Docker Compose (recommended for production-like testing)"
        echo "  expo    - Start with local Expo development server"
        echo "  tunnel  - Start Expo with tunnel mode only"
        echo ""
        echo "Examples:"
        echo "  $0 docker"
        echo "  $0 expo"
        echo "  $0 tunnel"
        echo ""
        print_warning "Choose an option to continue..."
        ;;
esac
