# Not published

`guide_content.json` is the complete narration script — 17 stops in five
languages. It is the product. Nothing in `index.html` ever fetched it: the page
renders short teasers from its own `STOPS` array, and the audio is served as
mp3 files. So publishing it gave the whole thing away for free, next to a gate
we had just built to stop exactly that.

It sat at `https://guide.visitbahiapalace.com/guide_content.json` returning 200
for as long as this project has existed. Two earlier attempts to block it did
nothing:

  * `.vercelignore` is read by the Vercel CLI when it uploads a folder. This
    deploys from Git, so the list is never consulted.
  * `vercel.json` was worse — this site is not on Vercel at all. It is
    Cloudflare Pages (`bahia-audio-guide-4bx.pages.dev`), which ignored the
    file and cheerfully served it as static content.

Cloudflare Pages publishes the build output directory, and `_redirects` cannot
mask a file that exists — static assets win. So the only thing that actually
works is the file not being in the published output. A leading-dot directory is
excluded from the upload, which is why this folder is named `.source`.

VERIFY AFTER EVERY DEPLOY. One line, against the thing customers pay for:

    curl -s -o /dev/null -w "%{http_code}\n" https://guide.visitbahiapalace.com/guide_content.json

Expect 404. Anything else means the product is being given away again.
