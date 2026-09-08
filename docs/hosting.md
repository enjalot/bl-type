# BL Type hosting review — 2026-09-08

This is the pre-publication comparison. The selected Static Space + GCS deployment is now documented in [deployment.md](deployment.md); the observations below describe the state at review time.

No application files or generated assets have been committed: `/home/enjalot/code/bl-type` is not a Git repository, nor is any parent directory. Generated glyphs, data, and extraction intermediates are now ignored for a future repository. The local assets remain intact. No upload, bucket mutation, or Space creation was performed during this review.

## Measured payload

| Part | Files | Bytes |
| --- | ---: | ---: |
| Glyphs: source WebP, paper-off PNG, vector SVG | 24,630 | 394,334,939 |
| Catalog, style map, centered vectors | 3 | 25,704,710 |
| Fonts and licenses | 8 | 294,354 |
| Compiled JavaScript, worker, CSS | 3 | 247,901 |
| Complete static build including index | 24,645 | 420,582,388 |

Moving glyphs and data to an external origin would leave about **543 KB** of frontend files, before transport compression. This is an estimate from subtracting those directories; the current build still bundles all public assets. Images load as needed; the 21,468,672-byte vector matrix loads for nearest-letter matching. The full 421 MB is not a per-visit download.

## Recommended first deployment: Static Space + fun-data

Use a free Hugging Face **Static HTML Space** (`sdk: static`) for the frontend and a new immutable prefix such as `gs://fun-data/bl-type/<release>/` for the glyphs/data. Keep only source code, configuration, and fonts in application Git. No Python service, paid runtime, or GPU is needed. Static Spaces are served directly without compute and support Vite through `app_build_command` and `app_file: dist/index.html`. A prebuilt upload can instead use `app_file: index.html`.

Sources: [Static Spaces](https://huggingface.co/docs/hub/spaces-sdks-static), [configuration](https://huggingface.co/docs/hub/spaces-config-reference).

A fresh anonymous bucket metadata request confirmed `fun-data` is US multi-region (`MULTI_REGIONAL`), with wildcard GET/HEAD CORS. An existing BL manifest returned HTTP 200, `Access-Control-Allow-Origin: *`, and `Cache-Control: public,max-age=31536000,immutable` when probed with a prospective `.hf.space` Origin. This matches the already published `latent-craft-bl` arrangement documented in `../latent-craft/docs/bl-demo-publication.md`. That existing Space uses Docker for search; BL Type can use static hosting because matching runs in the browser.

`storage.googleapis.com` is the public GCS origin with built-in caching, rather than a separately provisioned Cloud CDN/load balancer. Keeping it that way avoids adding a fixed infrastructure baseline for this small app. Built-in cache hits still incur normal outbound transfer charges. [GCS caching](https://cloud.google.com/storage/docs/caching).

At the existing US multi-region planning rate of $0.026/GiB-month, the approximately 0.391 GiB asset payload costs about **$0.01/month at rest**. First-tier internet transfer to common US/Europe destinations is **$0.12/GiB**, before allowances; Standard GETs are **$0.40 per million**. An illustrative 1,000 visits transferring 30 MiB each is $3.52 in transfer, plus requests. This is a scenario, not a measured average session or an account invoice. [GCS pricing](https://cloud.google.com/storage/pricing).

## Hosting the assets on HF instead

HF's pricing page includes CDN and egress at no additional cost; free public storage is best-effort and subject to account capacity and reuse policies. At only 420 MB, this is a plausible zero-incremental-cost option, but availability and actual browser behavior should be verified for the chosen account before treating it as a guaranteed service. [Pricing](https://huggingface.co/pricing), [storage policy](https://huggingface.co/docs/hub/storage-limits).

- **Public HF Bucket + Static Space** keeps large data outside Git entirely. Buckets support public objects and do not inherit the Git repository layout limits. This best matches an all-HF deployment with separate application and asset storage. Test public resolver URLs, CORS for canvas/masks, cache behavior, and export downloads before migrating. Never embed a publishing token or a temporary signed CDN redirect in the frontend. [Buckets](https://huggingface.co/docs/hub/storage-buckets).
- **Separate public dataset repository + Static Space** makes the curated letter collection reusable and provides versioned releases. Include a dataset card and provenance. The current `glyphs/` directory has 24,630 entries, exceeding HF's 10,000-files-per-folder limit; split by extension (8,210 per folder) or ID prefix and update the resolver. Hub anonymous resolver requests have rate limits, so consider image request fan-out and shared-IP visitors. [Repository limits](https://huggingface.co/docs/hub/storage-limits#repository-limitations-and-recommendations), [rate limits](https://huggingface.co/docs/hub/rate-limits).
- **Everything inside the Space repository** would also require the folder split and would put the large assets in that Git repository. It is therefore a poorer match for the requested separation.

## Work needed before publishing

1. Add one configurable asset-origin resolver for catalog, glyphs, style-map JSON, and the vector worker. Preserve local assets as the development default.
2. Set image `crossOrigin` before `src` for contrast-normalization canvas reads. Verify CSS masks and all SVG/PNG/OTF exports against the external origin.
3. Build a frontend-only artifact with fonts, omitting `public/glyphs` and `public/data`. An ordinary Vite build currently copies both even though Git ignores them.
4. Stage an immutable, checksummed asset release and a small static Space package. Upload the asset release, verify public samples, then publish the frontend pointing to that exact release.
5. Verify the live app in both the HF wrapper and direct `.hf.space` view, including matching, saved alphabets, normalization, and downloads.

GitHub Pages remains an equally suitable frontend host with the same external assets; project subpaths additionally need base-aware app/font URLs. No paid service is needed for frontend hosting in either case.
