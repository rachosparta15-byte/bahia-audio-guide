"""
Bahia Palace Audio Guide — Batch Generator (FREE, using edge-tts)
==================================================================

WHAT THIS DOES
---------------
Reads guide_content.json (all stops, in English/French/Spanish/German)
and generates one MP3 file per stop, per language, using Microsoft
Edge's free neural text-to-speech engine (no API key, no signup, no cost).

HOW TO RUN THIS ON YOUR OWN COMPUTER
--------------------------------------
1. Install Python 3.9+ if you don't have it (python.org)
2. Open a terminal in this folder and run:
       pip install edge-tts
3. Make sure guide_content.json is in the same folder as this script.
4. Run:
       python generate_audio_edge_tts.py
5. Wait a few minutes — it will create an /audio folder like this:

       audio/
         en/00-gate.mp3
         en/01-avenue.mp3
         ...
         fr/00-gate.mp3
         ...
         es/...
         de/...

That's it — 17 stops x 4 languages = 68 real MP3 files, completely free.

NOTE: this script must be run on YOUR machine (or any normal computer/
server with open internet access). It will NOT run inside this chat —
Claude's sandbox here blocks the Microsoft speech servers, which is why
we're handing you this ready-to-run script instead.
"""

import asyncio
import json
import os

import edge_tts  # pip install edge-tts

# ---------------------------------------------------------------------
# Voice choice per language. These are natural-sounding MICROSOFT NEURAL
# voices, free and unlimited via edge-tts. Swap any of these for another
# voice name if you prefer a different tone — run `edge-tts --list-voices`
# to see hundreds of options (male/female, different accents, etc).
# ---------------------------------------------------------------------
# ---------------------------------------------------------------------
# Voice PROFILES. Each profile writes to its OWN output folder, so
# generating a new voice never touches or overwrites files you already
# made with a different voice. Keep both, compare them, pick your
# favorite later — nothing gets deleted automatically.
# ---------------------------------------------------------------------
VOICE_PROFILES = {
    "male": {
        "en": "en-US-GuyNeural",
        "fr": "fr-FR-HenriNeural",
        "es": "es-ES-AlvaroNeural",
        "de": "de-DE-ConradNeural",
        "it": "it-IT-DiegoNeural",
    },
    "female": {
        "en": "en-US-JennyNeural",
        "fr": "fr-FR-DeniseNeural",
        "es": "es-ES-ElviraNeural",
        "de": "de-DE-KatjaNeural",
        "it": "it-IT-ElsaNeural",
    },
}

# 👉 Change this line to switch which profile the script generates.
# Your existing "audio/" folder (male voice, first 5 EN files) stays
# untouched no matter what — this just controls where NEW files go.
ACTIVE_PROFILE = "male"

VOICES = VOICE_PROFILES[ACTIVE_PROFILE]

# Slightly slower rate reads better for a museum audio guide.
RATE = "-8%"

# Each profile gets its own folder: audio_male/ or audio_female/
# Your original audio/ folder (from before this update) is untouched.
OUTPUT_DIR = f"audio_{ACTIVE_PROFILE}"
CONTENT_FILE = "guide_content.json"

MAX_RETRIES = 5       # how many times to retry a single file on a network hiccup
RETRY_DELAY_SEC = 5   # wait time between retries (grows a bit each retry)


# A real spoken stop should never be this tiny. Any file smaller than
# this is almost certainly a truncated/corrupted download from a
# network hiccup mid-save — we regenerate it instead of trusting it.
MIN_VALID_SIZE_BYTES = 15_000  # ~15 KB, safely below any real stop

async def generate_one(text: str, voice: str, out_path: str):
    # Skip files that already exist AND look complete. Files that exist
    # but are suspiciously small (a network drop cut the download short
    # mid-save) get deleted and regenerated automatically.
    if os.path.exists(out_path):
        if os.path.getsize(out_path) >= MIN_VALID_SIZE_BYTES:
            print(f"  ⏭  already exists, skipping: {out_path}")
            return
        else:
            print(f"  ⚠ found a suspiciously small/corrupt file, redoing: {out_path}")
            os.remove(out_path)

    for attempt in range(1, MAX_RETRIES + 1):
        try:
            communicate = edge_tts.Communicate(text, voice, rate=RATE)
            await communicate.save(out_path)
            print(f"  ✓ {out_path}")
            return
        except Exception as e:
            # Catches DNS blips (getaddrinfo failed), dropped Wi-Fi,
            # temporary Microsoft server hiccups, etc.
            if attempt == MAX_RETRIES:
                print(f"  ✗ FAILED after {MAX_RETRIES} tries: {out_path}")
                print(f"      reason: {e}")
                print("      -> check your internet connection, then just")
                print("         re-run this script — it will skip finished")
                print("         files and only retry this one.")
                return
            wait = RETRY_DELAY_SEC * attempt
            print(f"  ! network hiccup on {out_path} (attempt {attempt}/{MAX_RETRIES}), "
                  f"retrying in {wait}s...")
            await asyncio.sleep(wait)


async def main():
    with open(CONTENT_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)

    stops = data["stops"]

    for lang, voice in VOICES.items():
        lang_dir = os.path.join(OUTPUT_DIR, lang)
        os.makedirs(lang_dir, exist_ok=True)
        print(f"\n=== Generating {lang.upper()} ({voice}) ===")

        for stop in stops:
            text = stop.get(lang)
            if not text:
                print(f"  ! skipped {stop['id']} (no {lang} text)")
                continue
            out_path = os.path.join(lang_dir, f"{stop['id']}.mp3")
            await generate_one(text, voice, out_path)

    print("\nAll done. Your MP3 files are inside the /audio folder,")
    print("organized as audio/<language>/<stop-id>.mp3")
    print("Match each file to its stop_id in guide_content.json when")
    print("you wire up the offline app.")


if __name__ == "__main__":
    asyncio.run(main())
