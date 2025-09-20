/**
 * DevOps Companion App - Service Worker
 * Provides offline capabilities and caching for the DevOps Companion PWA
 */

const CACHE_NAME = 'devops-companion-v1.0.0';
const STATIC_CACHE_NAME = 'devops-companion-static-v1.0.0';
const DYNAMIC_CACHE_NAME = 'devops-companion-dynamic-v1.0.0';

// Static assets to cache
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/css/styles.css',
  '/js/app.js'
];

// API endpoints to cache
const API_CACHE_PATTERNS = [
  '/api/instances',
  '/api/gcp/clusters',
  '/health'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('Service Worker: Installation complete');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('Service Worker: Installation failed', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== STATIC_CACHE_NAME && cacheName !== DYNAMIC_CACHE_NAME) {
              console.log('Service Worker: Deleting old cache', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('Service Worker: Activation complete');
        return self.clients.claim();
      })
  );
});

// Fetch event - serve from cache or network
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }
  
  // Skip chrome-extension and other non-http requests
  if (!url.protocol.startsWith('http')) {
    return;
  }
  
  event.respondWith(handleRequest(request));
});

async function handleRequest(request) {
  const url = new URL(request.url);
  
  try {
    // Handle API requests with network-first strategy
    if (url.pathname.startsWith('/api/')) {
      return await handleApiRequest(request);
    }
    
    // Handle static assets with cache-first strategy
    if (isStaticAsset(url.pathname)) {
      return await handleStaticAsset(request);
    }
    
    // Handle HTML pages with network-first strategy
    if (request.headers.get('accept').includes('text/html')) {
      return await handleHtmlRequest(request);
    }
    
    // Default: try network first, fallback to cache
    return await fetchWithFallback(request);
    
  } catch (error) {
    console.error('Service Worker: Request failed', error);
    
    // Return offline page for HTML requests
    if (request.headers.get('accept').includes('text/html')) {
      return await getOfflinePage();
    }
    
    // Return cached response if available
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Return error response
    return new Response('Offline - Resource not available', {
      status: 503,
      statusText: 'Service Unavailable'
    });
  }
}

async function handleApiRequest(request) {
  try {
    // Try network first for API requests
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      // Cache successful API responses
      const cache = await caches.open(DYNAMIC_CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    // Fallback to cache for API requests
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Return offline data for specific API endpoints
    return getOfflineApiResponse(request);
  }
}

async function handleStaticAsset(request) {
  // Cache-first strategy for static assets
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }
  
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(STATIC_CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    throw error;
  }
}

async function handleHtmlRequest(request) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    return await getOfflinePage();
  }
}

async function fetchWithFallback(request) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    throw error;
  }
}

function isStaticAsset(pathname) {
  return pathname.match(/\.(css|js|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/);
}

async function getOfflinePage() {
  const cache = await caches.open(STATIC_CACHE_NAME);
  const offlinePage = await cache.match('/offline.html');
  
  if (offlinePage) {
    return offlinePage;
  }
  
  // Return a simple offline page
  return new Response(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>DevOps Companion - Offline</title>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { 
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          display: flex; 
          justify-content: center; 
          align-items: center; 
          height: 100vh; 
          margin: 0; 
          background: #f5f5f5;
        }
        .offline-container {
          text-align: center;
          background: white;
          padding: 40px;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .offline-icon {
          font-size: 48px;
          margin-bottom: 20px;
        }
        h1 { color: #333; margin-bottom: 10px; }
        p { color: #666; margin-bottom: 20px; }
        .retry-btn {
          background: #2563eb;
          color: white;
          border: none;
          padding: 12px 24px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 16px;
        }
        .retry-btn:hover { background: #1d4ed8; }
      </style>
    </head>
    <body>
      <div class="offline-container">
        <div class="offline-icon">📱</div>
        <h1>DevOps Companion</h1>
        <p>You're currently offline. Some features may not be available.</p>
        <button class="retry-btn" onclick="window.location.reload()">Retry</button>
      </div>
    </body>
    </html>
  `, {
    headers: { 'Content-Type': 'text/html' }
  });
}

function getOfflineApiResponse(request) {
  const url = new URL(request.url);
  
  // Return cached data for specific endpoints
  if (url.pathname === '/api/instances') {
    return new Response(JSON.stringify({
      message: 'Offline mode - Cached data may be outdated',
      instances: [],
      offline: true
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  if (url.pathname === '/api/gcp/clusters') {
    return new Response(JSON.stringify({
      message: 'Offline mode - Cached data may be outdated',
      clusters: [],
      offline: true
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  return new Response(JSON.stringify({
    error: 'Service unavailable',
    message: 'You are offline and this data is not cached',
    offline: true
  }), {
    status: 503,
    headers: { 'Content-Type': 'application/json' }
  });
}

// Background sync for critical operations
self.addEventListener('sync', (event) => {
  console.log('Service Worker: Background sync triggered', event.tag);
  
  if (event.tag === 'critical-operation') {
    event.waitUntil(handleCriticalOperationSync());
  }
});

async function handleCriticalOperationSync() {
  try {
    // Handle any queued critical operations when back online
    console.log('Service Worker: Syncing critical operations');
    // Implementation would depend on your specific needs
  } catch (error) {
    console.error('Service Worker: Background sync failed', error);
  }
}

// Push notifications for critical alerts
self.addEventListener('push', (event) => {
  console.log('Service Worker: Push notification received');
  
  const options = {
    body: event.data ? event.data.text() : 'DevOps Companion Alert',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    vibrate: [200, 100, 200],
    data: {
      url: '/'
    },
    actions: [
      {
        action: 'view',
        title: 'View Details',
        icon: '/icons/view-icon.png'
      },
      {
        action: 'dismiss',
        title: 'Dismiss',
        icon: '/icons/dismiss-icon.png'
      }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification('DevOps Companion', options)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('Service Worker: Notification clicked', event.action);
  
  event.notification.close();
  
  if (event.action === 'view') {
    event.waitUntil(
      clients.openWindow(event.notification.data.url)
    );
  }
});

// Handle notification close
self.addEventListener('notificationclose', (event) => {
  console.log('Service Worker: Notification closed');
});
