// sw.js — makes the audio guide work with ZERO internet after first load.
//
// HOW IT WORKS:
// 1. The visitor unlocks the guide ONCE while they have wifi/data (hotel,
//    airport, or the ticket booth). See the access gate in index.html.
// 2. Only THEN does the page register this worker and ask it to download
//    every audio file onto the phone.
// 3. From then on, even in airplane mode / a dead zone inside the palace,
//    the page and every track play from local storage — no network request
//    ever leaves the phone.
//
// WHY THE DOWNLOAD IS NOT IN `install` ANYMORE:
// It used to be, which meant merely opening the page pulled all 47MB — so
// anyone who found the URL got the entire paid product before anything could
// check whether they had bought it. The audio is now fetched only when the
// page sends a CACHE_AUDIO message, which it does after the gate has said
// yes. Registration alone downloads nothing but the app shell.
//
// You do not need to touch this file's logic — just make sure the file
// lists below match whatever files you actually upload.

const CACHE_NAME = "bahia-audio-guide-v4";

const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
];

// Build the full audio file list for both voices, all 5 languages, all stops.
const STOP_IDS = [
  "00-gate","01-avenue","02-ticket","03-threshold","04-restoration",
  "05-petit-riad","06b-fireplaces","06-blue-courtyard","07-corridor",
  "08-map","09-grand-riad","10-fountain","11-harem","12-grand-courtyard",
  "13-ceiling","14-ba-ahmed","exit"
];
const LANGS = ["en","fr","es","de","it"];
const VOICES = ["female","male"];

function audioFilesFor(lang) {
  const out = [];
  VOICES.forEach((v) => STOP_IDS.forEach((id) => out.push(`./audio_${v}/${lang}/${id}.mp3`)));
  return out;
}

/**
 * Every audio file, with the visitor's chosen language first.
 *
 * Ordering matters on a hotel wifi that might drop halfway: the language they
 * are actually going to listen to lands first, so a partial download is still
 * a usable guide rather than a random third of five languages.
 */
function orderedAudioFiles(preferredLang) {
  const first = LANGS.includes(preferredLang) ? preferredLang : "en";
  const rest = LANGS.filter((l) => l !== first);
  return [first, ...rest].flatMap(audioFilesFor);
}

// --- INSTALL: app shell only. The audio waits for the gate. ---
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      // Cached file by file rather than addAll, which fails hard if ONE file
      // 404s and would take the whole install down with it.
      Promise.all(
        APP_SHELL.map((url) =>
          cache.add(url).catch(() => console.warn("Skipped (not found):", url))
        )
      )
    ).then(() => self.skipWaiting())
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

// --- AUDIO DOWNLOAD, on request from the page ---

/** Guards against two CACHE_AUDIO messages racing into a double download. */
let downloading = false;

async function post(msg) {
  // includeUncontrolled: on a first-ever registration the page may not be
  // controlled yet, and it is precisely that page waiting on the progress bar.
  const clients = await self.clients.matchAll({ includeUncontrolled: true });
  clients.forEach((c) => c.postMessage(msg));
}

async function cacheAudio(preferredLang) {
  if (downloading) return;
  downloading = true;

  try {
    const cache = await caches.open(CACHE_NAME);
    const files = orderedAudioFiles(preferredLang);
    const total = files.length;
    let done = 0;
    let failed = 0;

    // Batched rather than one-at-a-time (too slow) or all-at-once (170
    // parallel requests stalls a phone on weak hotel wifi).
    const BATCH = 4;
    for (let i = 0; i < files.length; i += BATCH) {
      const batch = files.slice(i, i + BATCH);
      await Promise.all(
        batch.map(async (url) => {
          // Already cached from an earlier session — skip the network, and
          // let a returning visitor's progress bar fill almost instantly.
          const hit = await cache.match(url);
          if (!hit) {
            try {
              await cache.add(url);
            } catch {
              failed++;
            }
          }
          done++;
        })
      );
      await post({ type: "AUDIO_PROGRESS", done, total, failed });
    }

    await post({ type: "AUDIO_DONE", total, failed });
  } catch (err) {
    console.error("[sw] audio caching failed:", err);
    await post({ type: "AUDIO_ERROR" });
  } finally {
    downloading = false;
  }
}

self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type === "CACHE_AUDIO") {
    event.waitUntil(cacheAudio(data.lang));
  }
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

  // Never cache the redeem call — it is cross-origin, it is a POST, and its
  // answer is about this device right now.
  if (req.method !== "GET") return;

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
