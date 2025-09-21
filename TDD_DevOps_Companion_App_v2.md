# Technical Design Document: DevOps Companion App
**Version:** 2.0

**Date:** September 20, 2025

**Status:** Updated with Multi-Cloud Scope

## 1. Overview
This document provides a detailed technical design for the DevOps Companion mobile application. It is intended for frontend, backend, and infrastructure engineers and serves as the single source of truth for the system's development.

### 1.1. Problem Statement
DevOps engineers need a secure, efficient, and portable way to perform critical management actions on multi-cloud infrastructure directly from a mobile device. Access to a laptop is not always feasible during on-call incidents or when away from a desk, creating a need for a reliable mobile control plane for services like AWS Lightsail and Google Kubernetes Engine (GKE).

### 1.2. Proposed Solution
A system composed of a secure backend API that acts as a trusted intermediary and a cross-platform mobile application. The mobile app provides the user interface for monitoring resources and triggering actions, while the backend is responsible for securely executing those actions against the cloud provider's APIs.

### 1.3. Core Concept: A Mobile "Single Pane of Glass" 📱
The core concept is to create a unified mobile command center for DevOps. The application will consolidate essential management tasks for multiple cloud providers into a single, intuitive interface. Instead of juggling different cloud console apps, the DevOps Companion will provide curated, high-value workflows for the most common operational needs, such as:

- Instance health checks and reboots on AWS Lightsail.
- Pod and deployment management on Google Kubernetes Engine (GKE), including viewing logs, restarting, and scaling.
- Secure execution of system commands on virtual instances.

This approach prioritizes action-oriented design over comprehensive feature parity with desktop consoles, focusing on what an engineer needs to do right now from their phone.

## 2. System Architecture & Components
The architecture consists of the mobile client, the backend API, and the cloud provider platforms.

```mermaid
graph TD
    A[Mobile Client <br> (React Native)] -->|1. API Requests (HTTPS/JSON)| B{Backend API <br> (FastAPI on Lambda/Server)};
    B -->|2. AWS & GCP SDK Calls| C[Cloud Providers <br> (AWS Lightsail, GCP GKE)];
    C -->|3. API Responses| B;
    B -->|4. Formatted JSON Response| A;
```

### 2.1. Component Breakdown

#### Frontend - Mobile Client
- **Technology:** React Native with TypeScript.
- **Responsibilities:**
  - Secure user authentication and JWT storage using the device keychain.
  - Rendering intuitive interfaces for AWS instances and complex Kubernetes resources (pods, deployments, nodes).
  - Presenting modals for detailed information like pod logs or SSH connection details.
  - Sending authenticated API requests to the Backend API.
  - Implementing local biometric/PIN protection for critical actions.

#### Backend - API Server
- **Technology:** Python with FastAPI.
- **Responsibilities:**
  - Exposing a secure RESTful API.
  - Authenticating all requests via JWT validation.
  - Translating API calls into specific AWS SDK (boto3) and Google Cloud SDK calls.
  - Aggregating and formatting data from cloud providers into a mobile-friendly JSON structure.

## 3. API Contract Specification
**Authentication:** All `/api/*` endpoints require an `Authorization: Bearer <JWT>` header.

### Authentication
- `POST /token`: Authenticates a user and returns a JWT.
- `GET /health`: Returns the health status of the API service.

### AWS Lightsail
- `GET /api/instances`: Lists all Lightsail instances.
- `POST /api/instances/{name}/reboot`: Reboots a specific Lightsail instance.
- `GET /api/instances/{name}/ssh-info`: Retrieves SSH connection details for an instance.
- `POST /api/instances/{name}/system-command`: Executes a system command on an instance via SSH.

### Google Kubernetes Engine (GKE)

#### Clusters & Nodes
- `GET /api/gcp/clusters`: Lists all accessible GKE clusters.
- `GET /api/gcp/clusters/{cluster}/namespaces`: Lists namespaces within a specific cluster.
- `GET /api/gcp/clusters/{cluster}/nodes`: Lists nodes for a specific cluster.

#### Pods
- `GET /api/gcp/clusters/{cluster}/namespaces/{namespace}/pods`: Lists pods within a specific namespace.
- `POST /api/gcp/clusters/{cluster}/namespaces/{namespace}/pods/{pod}/restart`: Restarts a specific pod.
- `DELETE /api/gcp/clusters/{cluster}/namespaces/{namespace}/pods/{pod}`: Deletes a specific pod.
- `GET /api/gcp/clusters/{cluster}/namespaces/{namespace}/pods/{pod}/logs`: Retrieves logs from a specific pod.
- `GET /api/gcp/clusters/{cluster}/namespaces/{namespace}/pods/{pod}/describe`: Gets detailed information for a pod.

#### Deployments
- `GET /api/gcp/clusters/{cluster}/deployments`: Lists all deployments.
- `POST /api/gcp/clusters/{cluster}/namespaces/{namespace}/deployments/{deployment}/scale`: Scales a deployment to a specified replica count.

## 4. Security & IAM Design

### Client Security
The mobile app must use the device's native keychain for storing the JWT. Critical actions (e.g., reboot, delete pod) must be protected by a biometric (Face/Touch ID) or PIN confirmation prompt before the API call is sent.

### Transport Security
All communication between the client and backend must be over HTTPS (TLS).

### IAM Permissions (Least Privilege)
The backend service role/account must only have the following permissions:

#### AWS Permissions:
```json
{
    "Effect": "Allow",
    "Action": [
        "lightsail:RebootInstance",
        "lightsail:GetInstance",
        "lightsail:GetInstanceState",
        "lightsail:GetInstances"
    ],
    "Resource": "*"
}
```

#### GCP Permissions:
- `container.clusters.get`
- `container.clusters.list`
- `container.operations.get`
