# The master files are not on this branch

`guide_content.json` (the complete narration script, 17 stops in five
languages) and `generate_audio_edge_tts.py` (the tool that turns it into the
mp3s) are build inputs, not runtime assets. Nothing the browser loads has ever
fetched either of them.

They are removed from the deployed branch because **everything on this branch is
published**. This is a zero-config Cloudflare Pages site whose output directory
is the repository root, so any file here is reachable at its own URL.

Three attempts failed before this one, each because of an assumption nobody
checked:

  1. `.vercelignore` — read only by the Vercel CLI when it uploads a folder.
     This deploys from Git, so the list is never consulted.
  2. `vercel.json` — this site is not on Vercel at all. It is Cloudflare Pages
     (`bahia-audio-guide-4bx.pages.dev`), which ignored it and published the
     fix itself as static content.
  3. A `.source/` directory — a leading dot does not exclude a folder from a
     Pages upload. `/.source/guide_content.json` answered 200 with all 62KB.

Each attempt looked right and was verified only by HTTP status, which is how
the third one nearly passed: `/guide_content.json` returned 200 either way,
because Pages answers unknown paths with index.html. **Read the body, not the
code.**

## Getting them back

They are in git history, at 9784ae4:

    git show 9784ae4:.source/guide_content.json > guide_content.json
    git show 9784ae4:.source/generate_audio_edge_tts.py > generate_audio_edge_tts.py

Regenerate the audio, commit the mp3s, and delete the two files again before
pushing.

## The durable fix

Set the Pages **build output directory** to a subfolder and move the site into
it. Then the repository root stops being the public root and this whole class
of accident goes away. It is a dashboard setting; until it is made, the rule is
that this branch contains only what the public may have.

## After every deploy

    curl -s https://guide.visitbahiapalace.com/guide_content.json | head -c 40

Expect HTML. JSON means the product is being given away.
