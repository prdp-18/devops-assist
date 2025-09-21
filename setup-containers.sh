#!/bin/bash

# DevOps Companion Container Setup Script
# This script helps set up the containerized environment

set -e

echo "🐳 DevOps Companion Container Setup"
echo "=================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

# Check if Docker is installed
check_docker() {
    print_info "Checking Docker installation..."
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed. Please install Docker first."
        exit 1
    fi
    print_status "Docker is installed"
}

# Check if Docker Compose is installed
check_docker_compose() {
    print_info "Checking Docker Compose installation..."
    if ! command -v docker-compose &> /dev/null; then
        print_error "Docker Compose is not installed. Please install Docker Compose first."
        exit 1
    fi
    print_status "Docker Compose is installed"
}

# Create necessary directories
create_directories() {
    print_info "Creating necessary directories..."
    
    mkdir -p ssh-keys
    mkdir -p logs
    mkdir -p database
    
    print_status "Directories created"
}

# Setup SSH keys
setup_ssh_keys() {
    print_info "Setting up SSH keys..."
    
    if [ ! -f "ssh-keys/LightsailDefaultKeyPair.pem" ]; then
        print_warning "SSH key not found. Please download your AWS Lightsail SSH key:"
        print_info "1. Go to AWS Lightsail Console"
        print_info "2. Navigate to Account → SSH Keys"
        print_info "3. Download the default key pair"
        print_info "4. Save as ssh-keys/LightsailDefaultKeyPair.pem"
        print_info "5. Run: chmod 600 ssh-keys/LightsailDefaultKeyPair.pem"
    else
        print_status "SSH key found"
        chmod 700 ssh-keys
        chmod 600 ssh-keys/*.pem
    fi
}

# Setup GCP credentials
setup_gcp_credentials() {
    print_info "Setting up GCP credentials..."
    
    if [ ! -f "gcp-credentials.json" ]; then
        print_warning "GCP credentials not found. Please set up GCP authentication:"
        print_info "Option 1: Service Account Key File"
        print_info "1. Create service account: gcloud iam service-accounts create devops-companion"
        print_info "2. Grant permissions: gcloud projects add-iam-policy-binding PROJECT_ID --member='serviceAccount:devops-companion@PROJECT_ID.iam.gserviceaccount.com' --role='roles/container.developer'"
        print_info "3. Create key: gcloud iam service-accounts keys create gcp-credentials.json --iam-account=devops-companion@PROJECT_ID.iam.gserviceaccount.com"
        print_info ""
        print_info "Option 2: Application Default Credentials"
        print_info "1. Run: gcloud auth application-default login"
        print_info "2. Set GCP_PROJECT_ID in .env file"
    else
        print_status "GCP credentials found"
    fi
}

# Setup environment file
setup_environment() {
    print_info "Setting up environment configuration..."
    
    if [ ! -f ".env" ]; then
        if [ -f "env.production" ]; then
            cp env.production .env
            print_status "Environment file created from template"
            print_warning "Please edit .env file with your actual values"
        else
            print_error "Environment template not found"
            exit 1
        fi
    else
        print_status "Environment file already exists"
    fi
}

# Build Docker images
build_images() {
    print_info "Building Docker images..."
    
    docker-compose build
    print_status "Docker images built successfully"
}

# Start services
start_services() {
    print_info "Starting services..."
    
    docker-compose up -d
    print_status "Services started"
}

# Check service health
check_health() {
    print_info "Checking service health..."
    
    # Wait for services to start
    sleep 10
    
    # Check backend health
    if curl -f http://localhost:8000/health &> /dev/null; then
        print_status "Backend API is healthy"
    else
        print_warning "Backend API health check failed"
    fi
    
    # Check frontend health
    if curl -f http://localhost:3000/health &> /dev/null; then
        print_status "Frontend is healthy"
    else
        print_warning "Frontend health check failed"
    fi
}

# Show service URLs
show_urls() {
    print_info "Service URLs:"
    echo "  Backend API: http://localhost:8000"
    echo "  Frontend PWA: http://localhost:3000"
    echo "  API Health: http://localhost:8000/health"
    echo "  API Docs: http://localhost:8000/docs"
}

# Main setup function
main() {
    echo ""
    check_docker
    check_docker_compose
    create_directories
    setup_ssh_keys
    setup_gcp_credentials
    setup_environment
    
    echo ""
    print_info "Ready to build and start services..."
    read -p "Continue? (y/N): " -n 1 -r
    echo ""
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        build_images
        start_services
        check_health
        show_urls
        
        echo ""
        print_status "Setup complete! 🎉"
        echo ""
        print_info "Useful commands:"
        echo "  View logs: docker-compose logs -f"
        echo "  Stop services: docker-compose down"
        echo "  Restart: docker-compose restart"
        echo "  Development mode: docker-compose -f docker-compose.yml -f docker-compose.dev.yml up"
    else
        print_info "Setup cancelled. Run this script again when ready."
    fi
}

# Run main function
main "$@"

