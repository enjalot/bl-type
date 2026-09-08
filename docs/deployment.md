# Publishing BL Type

- App: https://enjalot-bl-type.hf.space/
- Space: https://huggingface.co/spaces/enjalot/bl-type
- Source: https://github.com/enjalot/bl-type
- Asset release: [../deploy/asset-release.json](../deploy/asset-release.json)

The application has no runtime backend. The Space is `sdk: static`; its compiled frontend, fonts, and third-party notices are separate from the generated GCS assets. Text, assignments, and exports stay in the browser. The UI footer and Space card link to the GitHub source.

## Update the frontend

Use Node.js 22.12+ or Node.js 24 LTS and a Python environment with `huggingface_hub`. Authenticate as `enjalot` using `hf auth login` or `HF_TOKEN`.

```bash
npm ci
python scripts/publish_space.py
```

The script builds the hosted profile, validates an explicit frontend file allowlist and 2 MB size ceiling, and publishes it to the public Static Space. It does not upload source datasets, credentials, logs, or the Git working directory. An existing Space must already be public/static. Subsequent publications replace the known `assets/` and `fonts/` files; no other Space content is deleted. The local publication receipt is written to ignored `artifacts/space-publication.json`.

The default `npm run build:hosted` pins the release in `deploy/asset-release.json`. `VITE_ASSET_ORIGIN` can override it for testing. Vite serves local assets during development when `public/data/catalog.json` exists; fresh clones use the pinned GCS release. Keep worker code and fonts in the frontend, and resolve vector URLs against the same asset release as the map. Image decoding sets anonymous CORS before loading, allowing contrast normalization and embedded exports across origins.

## Publish a new data release

Generate and validate the source assets locally first. Choose a new release ID whenever bytes change; old releases use year-long immutable caching and must not be overwritten.

```bash
python scripts/package_assets.py --release YYYYMMDDa
gcloud storage cp --recursive --if-generation-match=0 \
  --cache-control='public,max-age=31536000,immutable' \
  --manifest-path=artifacts/gcs-upload.csv \
  artifacts/releases/YYYYMMDDa gs://fun-data/bl-type/
```

Packaging copies only `public/data` and `public/glyphs`, hashes each file, creates `manifest.json`, and updates the small release pointer in `deploy/asset-release.json`. GCS upload is create-only. If interrupted, audit the upload receipt and resume missing objects without overwriting a release. Preserve the existing bucket IAM/CORS settings. Uploads use normal inherited bucket access; no ACL changes are needed.

Verify all upload results and public GETs for catalog, map, vector binary, WebP, PNG, and SVG with a cross-origin Origin header. Verify manifest and file checksums. Only then publish the frontend pointing at the new release. The whole dataset stays outside both GitHub Git and the Space Git repository.

## Verify

```bash
npm run assets:download
npm test
npm run build:hosted
BASE_URL=https://enjalot-bl-type.hf.space node tests/browser.mjs
BASE_URL=https://enjalot-bl-type.hf.space node tests/tone-browser.mjs
BASE_URL=https://enjalot-bl-type.hf.space \
ASSET_ORIGIN=https://storage.googleapis.com/fun-data/bl-type/20260908a \
node tests/assignment-browser.mjs
```

Browser scripts use the original workstation's cached Chromium by default; set `CHROME_PATH` for another installation. Some minimal Linux hosts need Playwright's system libraries. Create `artifacts/` first when running the scripts in a fresh clone. Check the HF wrapper as well as the direct app for matching, keyboard focus, and downloads. The frontend is static and requests no paid hardware.
