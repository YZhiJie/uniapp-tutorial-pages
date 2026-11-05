/**
 * 教程站点 Service Worker：提供离线访问能力。
 * - 页面导航（mode=navigate）：网络优先，离线时回退缓存（Back/Forward 直接命中缓存）
 * - 静态资源（JS/CSS/字体/图片）：Stale-While-Revalidate，二次访问秒开
 * - 仅处理同源 GET 请求；缓存条目超上限时按最久未访问淘汰
 */
var CACHE = 'uniapp-tutorial-v1'
var MAX_ENTRIES = 120
// 站点部署在子路径下，用作用域半径作为站点根，避免离线回退到域名根路径
var ROOT = self.registration.scope
var PRECACHE = [ROOT, ROOT + 'favicon.svg']

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches
      .open(CACHE)
      .then(function (cache) {
        return Promise.all(
          PRECACHE.map(function (url) {
            return cache.add(url).catch(function () {})
          })
        )
      })
      .then(function () {
        return self.skipWaiting()
      })
  )
})

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches
      .keys()
      .then(function (keys) {
        return Promise.all(
          keys.filter(function (key) {
            return key !== CACHE
          }).map(function (key) {
            return caches.delete(key)
          })
        )
      })
      .then(function () {
        return self.clients.claim()
      })
  )
})

function isNavigation(request) {
  return request.mode === 'navigate' || (request.method === 'GET' && request.destination === 'document')
}

function networkFirst(request) {
  return fetch(request)
    .then(function (response) {
      if (response && response.status === 200) {
        var copy = response.clone()
        caches.open(CACHE).then(function (cache) {
          cache.put(request, copy)
        })
      }
      return response
    })
    .catch(function () {
      return caches.match(request, { ignoreSearch: false }).then(function (cached) {
        return cached || caches.match(ROOT)
      })
    })
}

function staleWhileRevalidate(request) {
  return caches.open(CACHE).then(function (cache) {
    return cache.match(request).then(function (cached) {
      var network = fetch(request)
        .then(function (response) {
          if (response && (response.status === 200 || response.type === 'opaque')) {
            cache.put(request, response.clone())
            trimCache(cache)
          }
          return response
        })
        .catch(function () {
          return cached
        })
      return cached || network
    })
  })
}

function trimCache(cache) {
  cache.keys().then(function (keys) {
    var extra = keys.length - MAX_ENTRIES
    if (extra <= 0) return
    keys.slice(0, extra).forEach(function (request) {
      cache.delete(request)
    })
  })
}

self.addEventListener('fetch', function (event) {
  var request = event.request
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) {
    return
  }
  event.respondWith(isNavigation(request) ? networkFirst(request) : staleWhileRevalidate(request))
})
