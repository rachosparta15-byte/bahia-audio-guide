// sw.js — makes the audio guide work with ZERO internet after first load.
//
// HOW IT WORKS:
// 1. Client opens the page ONCE while they have wifi/data (hotel, airport,
//    or even the ticket booth if you offer wifi there).
// 2. This service worker downloads and stores every file listed below
//    directly on their phone (audio + app files).
// 3. From then on, even in airplane mode / dead zone inside the palace,
//    the page and every audio track plays from local storage — no network
//    request ever leaves the phone.
//
// You do not need to touch this file's logic — just make sure the file
// lists below match whatever files you actually upload.

const CACHE_NAME = "bahia-audio-guide-v3";

const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
];

// Build the full audio file list automatically for both voices,
// all 4 languages, all stop ids.
const STOP_IDS = [
  "00-gate","01-avenue","02-ticket","03-threshold","04-restoration",
  "05-petit-riad","06b-fireplaces","06-blue-courtyard","07-corridor",
  "08-map","09-grand-riad","10-fountain","11-harem","12-grand-courtyard",
  "13-ceiling","14-ba-ahmed","exit"
];
const LANGS = ["en","fr","es","de","it"];
const VOICES = ["female","male"];

const AUDIO_FILES = [];
VOICES.forEach(v=>{
  LANGS.forEach(l=>{
    STOP_IDS.forEach(id=>{
      AUDIO_FILES.push(`./audio_${v}/${l}/${id}.mp3`);
    });
  });
});

const ALL_FILES = [...APP_SHELL, ...AUDIO_FILES];

// --- INSTALL: download and cache everything ---
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // addAll fails hard if ONE file 404s — so we cache file by file
      // and just log/skip any that are missing, instead of breaking
      // the whole install (useful while you're still adding languages).
      return Promise.all(
        ALL_FILES.map((url) =>
          cache.add(url).catch((err) => {
            console.warn("Skipped (not found yet):", url);
          })
        )
      );
    }).then(() => self.skipWaiting())
  );
});

// --- ACTIVATE: clean up old cache versions ---
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// --- FETCH ---
// App shell (page + json): NETWORK-FIRST so updates always show, with the
// cached copy as an offline fallback.
// Audio (heavy, never changes): CACHE-FIRST so it plays instantly offline
// inside the palace with zero network.
self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);
  const isAudio = url.pathname.includes("/audio_");

  if (isAudio) {
    event.respondWith(
      caches.match(req).then((cached) => cached || fetch(req))
    );
    return;
  }

  // network-first for everything else (html, json, manifest)
  event.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
        return res;
      })
      .catch(() => caches.match(req))
  );
});
