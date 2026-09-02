/* Daybook service worker — cache-first for the shell, so it opens offline. */
var CACHE = "daybook-v2";
var SHELL = [
  "./", "./index.html", "./app.js", "./manifest.webmanifest",
  "./icons/icon-180.png", "./icons/icon-192.png", "./icons/icon-512.png", "./icons/icon-32.png"
];

self.addEventListener("install", function(e){
  e.waitUntil(
    caches.open(CACHE).then(function(c){
      return Promise.all(SHELL.map(function(u){
        return c.add(u).catch(function(){});   /* one bad URL must not fail the install */
      }));
    }).then(function(){ return self.skipWaiting() })
  );
});

self.addEventListener("activate", function(e){
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.map(function(x){ return x===CACHE ? null : caches.delete(x) }));
    }).then(function(){ return self.clients.claim() })
  );
});

self.addEventListener("fetch", function(e){
  var req = e.request;
  if(req.method !== "GET") return;
  var url = new URL(req.url);

  /* Google Fonts: use the cache, refresh in the background. */
  if(url.origin.indexOf("fonts.googleapis.com")>-1 || url.origin.indexOf("fonts.gstatic.com")>-1){
    e.respondWith(
      caches.open(CACHE).then(function(c){
        return c.match(req).then(function(hit){
          var net = fetch(req).then(function(res){
            if(res && (res.ok || res.type==="opaque")) c.put(req, res.clone());
            return res;
          }).catch(function(){ return hit });
          return hit || net;
        });
      })
    );
    return;
  }

  if(url.origin !== location.origin) return;

  /* Navigations fall back to the cached shell when offline. */
  if(req.mode === "navigate"){
    e.respondWith(
      fetch(req).catch(function(){
        return caches.match("./index.html").then(function(hit){
          return hit || new Response("Offline", {status:503, headers:{"Content-Type":"text/plain"}});
        });
      })
    );
    return;
  }

  e.respondWith(
    caches.match(req).then(function(hit){
      return hit || fetch(req).then(function(res){
        if(res && res.ok && res.type==="basic"){
          var copy=res.clone();
          caches.open(CACHE).then(function(c){ c.put(req, copy) });
        }
        return res;
      });
    })
  );
});
