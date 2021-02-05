const CACHE_NAME = 'OCAPI_SETTINGS'
const URLS_TO_CACHE = [
    '/',
    '/assets/icons/icon-16x16.png',
    '/assets/icons/icon-32x32.png',
    '/assets/icons/icon-192x192.png',
    '/assets/favicon.ico',
    '/assets/ocapi.js',
    '/assets/symbols.svg'
]

// Cache all statics at installation time
self.addEventListener('install', event => {
    console.log('Installing service worker ...')
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            return cache.addAll(URLS_TO_CACHE)
        })
    )
})

// Refresh cache at activation time
self.addEventListener('activate', event => {
    console.log('Activating service worker ...')
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(cacheNames.map(cacheName => {
                return caches.delete(cacheName)
            }))
        })
    )
})