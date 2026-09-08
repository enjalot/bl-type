# BL Type

A local font playground built from the British Library images already processed for the basemap work. Type a sentence, shuffle historical initials, pin individual tiles, explore a letter-centered UMAP and EVoC style groups, and export the result.

**[Open the app](https://enjalot-bl-type.hf.space/)** · **[Hugging Face Space](https://huggingface.co/spaces/enjalot/bl-type)** · **[GitHub source](https://github.com/enjalot/bl-type)**

## Run

Requires Node.js 22.12+ (or 24 LTS).

```bash
git clone https://github.com/enjalot/bl-type.git
cd bl-type
npm ci
npm run dev
```

Open **http://localhost:5186**, or **http://gsv.local:5186** on this workstation's local network. Vite listens on all interfaces and allows `gsv.local`. A fresh clone loads the published, immutable GCS asset release automatically. There is no search service, Python server, or GPU dependency for using the app.

To keep a verified local asset copy for offline use and data-dependent tests:

```bash
npm run assets:download
npm test
npm run dev
```

The download is approximately 420 MB / 24,633 files. The downloader verifies the pinned manifest and each file's SHA-256, skips matching local copies, and refuses to replace modified files unless passed `--force`. Generated files are ignored by Git. Local assets take precedence when the catalog exists. `VITE_ASSET_ORIGIN` can explicitly select another release/origin.

## Hosting

The public frontend runs in a **free Hugging Face Static Space**. Glyphs, catalog, and centered vectors live in the existing `fun-data` GCS bucket under the release pinned in [deploy/asset-release.json](deploy/asset-release.json). The source repository and Space contain no generated images or vectors. Fonts are included with their SIL Open Font License notices.

```bash
npm run build:hosted
npm run preview
```

The hosted build always uses the pinned external asset release and omits the large data directories, producing a frontend of about 550 KB. Ordinary `npm run build` includes local assets when available. All normalization, matching, and exports run in the browser. See [deployment instructions](docs/deployment.md) and the earlier [hosting comparison](docs/hosting.md).

## The playground

- Original: source WebP thumbnails for a ransom-note composition. Derived punctuation cuts are identified in the inspector.
- Paper off: paper-normalized luminance rendered as transparent ink; ink and paper colors are adjustable.
- Vector: actual SVG contours from a per-image Otsu threshold and polygon simplification. Traces preserve ornaments and holes.
- **Normalize contrast** balances each raster tile’s ink and paper levels, preserving texture. Original tiles become grayscale when enabled; turn it off for untouched sources. **Fade** (0–85%) softens the whole tile against the paper in all three modes. SVG/PNG exports include both settings; OTF stores outlines only. Processing happens on demand in the browser and adds no dataset assets.
- Mix each occurrence, or use one image per character. A pinned tile always wins over shuffling. Map filters do not affect the composition.
- Click a rendered letter or alphabet cell to choose its character. Candidate clicks only inspect; **Use this A** explicitly pins the tile. **Find style matches** opens that candidate in the map. Hide bad candidates and restore exclusions from Your alphabet.
- **Explore styles**: hover over a dot to preview its source image. Click it to find the closest image in every other letter. Drag to pan, scroll or use buttons to zoom. Keyboard arrows preview visible dots; Enter selects.
- Filter by letter or reviewed seeds. Optional EVoC group filters are under **Explore automatic style groups**. The original-embedding UMAP is available for comparison. Filtering does not refit the map.
- Nearest matches always use exact cosine similarity of the full centered vectors, not 2D positions. The miniature alphabet immediately below the map shows the reference and the nearest image for every other letter. Each miniature has an individual Use button. **Use nearest alphabet** beside the reference, or **Assign all 26 letters** below the map, assigns that complete alphabet and replaces existing A–Z pins; punctuation is preserved. **Fill unpinned only** keeps existing pins. More matches and alternatives remain available in a collapsible section. Letter/group filters only affect the map; the reviewed checkbox and hidden exclusions also constrain matching.
- Hovering a miniature highlights its map point in blue. Hovering an annotated map point highlights its miniature too; other matches stay orange and the reference stays gold.
- **Undo / Redo** restore up to 100 assignment steps, including individual and bulk assignments, unpinning, hiding/restoring candidates, shuffling, casting mode, and imported alphabet choices. A bulk assignment is one step. New changes after undo discard the redo branch; no-op assignments do not. History survives browser reloads. Keyboard shortcuts: Ctrl/Cmd+Z to undo, Ctrl/Cmd+Shift+Z or Ctrl+Y to redo. Editable controls retain their native text undo; prose and visual styling are outside the assignment history.
- Save/open an alphabet JSON, with local browser persistence. Export the visible composition as an embedded SVG or PNG. Export an installable OTF containing one representative for each supported character; pin letters to control the font precisely.

Lowercase shares the uppercase images. Unsupported characters remain visible as labelled system-font fallbacks. Digits and punctuation are experimental; several are crops or collages of actual marks in the scans, with the operation and original row recorded. OTF uses proportional advances, one outline per character, no kerning, and no contextual random alternates. Long individual words may wrap between letters to fit the specimen.

## Data and provenance

The source is `biglam/british-library-book-images`, a CC0 collection assembled from British Library book scans by Daniel van Strien. This is an independent project, not an official British Library product.

- Source dataset: https://huggingface.co/datasets/biglam/british-library-book-images
- Source vectors: `/data/latent-basemap/substrates/bl-siglip2-1m/substrate.f16.npy`
- Source identities: `/data/latent-scope-3d/points/bl/points.parquet`
- Source thumbnails: `/data/images/british-library-book-images/thumbs`
- Local encoder/index: `/data/latent-craft/experiments/bl-search-20260907b`

The final pass runs 78 text prompts against all 1,080,814 images using SigLIP 2 and the existing FAISS SQ8 index, 256 probes, 512 results per query. Letter queries use the exact `letter a` pattern. A broader initial 130-query experiment is preserved in `extraction/search-broad.json`; those general “ornate initial” prompts retrieved too many unrelated or ambiguous images to make good defaults.

`extraction/search.json` keeps every retrieved match, query, rank, similarity, and reciprocal rank fusion score. Up to 180 pixel-distinct candidates per character are prepared for the browser: 8,180 original tiles plus 30 derived punctuation/digit tiles, in 61 sets. These are **retrieval candidates, not 8,210 verified letters**. The first 12 primary-query results per letter were visually checked; explicit exclusions and the source-fragment recipes live in `scripts/curate.py`. The app prefers that small reviewed seed alphabet for its defaults. Retrieval is not exhaustive and scores are not recognition probabilities.

The existing source images are at most 256 px along their longest edge. Vectorization traces those pixels; it does not recover the lost detail of the full scan. Where available, the inspector links to the original image for later higher-resolution work.

## Rebuild the data

On the original workstation, the prepared Python environment is `.venv`. It reuses read-only packages from the existing basemap environment through a `.pth` file and installs OpenCV locally. For a standalone environment, install `numpy pillow pyarrow torch transformers faiss-cpu scikit-learn opencv-python-headless umap-learn evoc==0.3.1` (the model export was produced with Transformers 5.14.0).

```bash
.venv/bin/python scripts/extract.py
.venv/bin/python scripts/curate.py
.venv/bin/python scripts/build_style_map.py
```

Extraction reuses its cached search results. To rerun retrieval or expand the candidate pool:

```bash
.venv/bin/python scripts/extract.py --refresh --top-k 1024 --keep 512
.venv/bin/python scripts/curate.py
.venv/bin/python scripts/build_style_map.py
```

`--refresh` is required when changing retrieval depth. Only output files inside this project are written. The curation script requires the local `extraction/primary-probe.json` receipt, which is not part of the application repository. Regenerating data requires the source datasets and offline pipeline inputs described above; downloading the published assets is the portable way to run and test the app. The optional probe scripts use the existing local search service at port 8804.

## Style map, version 2

The previous map used two-dimensional PCA on handcrafted morphology/paper-tone features plus 20 PCA components of letter-centered embeddings, clustered with k-means into eight “studies.” Its legacy fields remain in `catalog.json` for reproducibility, but are no longer used by the UI.

The new map includes 4,659 unique original image tiles from the A–Z candidate pools. Twenty-one duplicate cross-letter assignments are resolved by reviewed status, then exact letter-query similarity, then alphabetical tie-breaking. Each image contributes once. Derived crops, digits and punctuation are excluded because we do not have corresponding letter/crop embeddings for them.

For each assigned letter, compute the mean of its unit-normalized SigLIP embeddings; subtract that mean from each vector and unit-normalize the residual:

```
r_i = normalize(normalize(e_i) - mean(normalize(e_j) for j in the same letter))
```

The mean uses all retained candidates assigned to that letter, not only the small reviewed seed pool. This suppresses an average letter component but does not establish a pure style representation: character labels can be wrong, style can correlate with the letter centroid, and residual content can remain.

- **UMAP:** full 1,152-dimensional unit residuals; cosine distance; 30 neighbors; min_dist 0.12; 350 epochs; random seed 17. A separate UMAP with identical parameters on the original unit embeddings provides the comparison view. UMAP caches are keyed by actual input bytes and parameters.
- **Neighbors:** exact dot products of the full residual vectors in a web worker. The 21 MB float32 matrix loads lazily with the style explorer. The worker returns five nearest candidates per letter, excluding self/same source, hidden candidates, and optionally unreviewed tiles. No 2D distances or PCA truncation enter matching.
- **EVoC 0.3.1:** fit to those same full residual vectors; noise_level 0.5, base_min_cluster_size 20, 30 neighbors, 100 epochs, seed 17. It discovers layers of 40, 25 and 11 groups with 2,025, 1,973 and 1,632 ungrouped images respectively. The UI defaults to the existing 25-group layer, chosen as the discovered layer closest to 24 groups; no fixed cluster count was requested from the algorithm. Ungrouped tiles remain accessible. These groups have not been validated as historical typefaces.
- **Diagnostic:** the mean same-letter share among ten exact nearest neighbors falls from 95.73% in original embeddings to 27.86% in residual embeddings. This measures reduced local character grouping, not better style accuracy. The UI does not treat it as a style-quality score.

[EVoC documentation](https://evoc.readthedocs.io/en/latest/) describes its specialized embedding graph and density clustering, related to UMAP and HDBSCAN. No controlled HDBSCAN comparison was performed here.

Assets: `public/data/style-map.json`, its content-addressed vector binary, `extraction/letter-centered-embeddings.npz`, and `extraction/style-map-receipt.json`. Rebuild after changing the catalogue using `scripts/build_style_map.py`. The older PCA catalogue is not overwritten.

## Checks

```bash
.venv/bin/python scripts/validate_style_map.py
npm test
npm run build
LD_LIBRARY_PATH=/tmp/playwright-libs/usr/lib/x86_64-linux-gnu node tests/browser.mjs
LD_LIBRARY_PATH=/tmp/playwright-libs/usr/lib/x86_64-linux-gnu node tests/style-browser.mjs
LD_LIBRARY_PATH=/tmp/playwright-libs/usr/lib/x86_64-linux-gnu node tests/assignment-browser.mjs
```

Set `BASE_URL` to test a deployment and `ASSET_ORIGIN` to its pinned release when running map/assignment checks. The browser check uses the workstation's cached Chromium; set `CHROME_PATH` for another installation. It exercises typing, randomization, pin precedence, letter navigation, hidden candidates, all three render modes, PNG/SVG/OTF downloads, JSON round trips, persistence, the style map, unsupported text, and mobile overflow. The style browser check covers hover/keyboard preview, selection versus use, projection and letter/group/review filters, cross-letter matching, pin preservation, undo, zoom, and map lifecycle. The assignment check verifies nearest-alphabet replacement, linked blue hover, atomic multi-step undo/redo, persisted history, branching, native text undo, and mobile miniature layout. Independent NumPy oracles validate the browser cosine rankings. Generated screenshots and example exports are in `artifacts/`.
