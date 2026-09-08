---
title: BL Type
emoji: 🔤
colorFrom: yellow
colorTo: gray
sdk: static
app_file: index.html
fullWidth: true
header: mini
short_description: Build an alphabet from historic British Library images
datasets:
  - biglam/british-library-book-images
tags:
  - typography
  - digital-humanities
  - umap
  - image-embeddings
---

# BL Type

Type with letters found in historic British Library book illustrations. Mix images, match a complete alphabet by style, normalize the ink, and export a PNG, SVG, or OTF font.

**[Source code and instructions on GitHub](https://github.com/enjalot/bl-type)** · **[Open the app directly](https://enjalot-bl-type.hf.space/)**

The style explorer uses UMAP on letter-centered SigLIP embeddings. Selecting a reference shows its nearest match in every other letter, with explicit assignment and undo/redo. Automatic EVoC groups are exploratory suggestions, not identified historical typefaces. Retrieval candidates include incorrect letters; a small reviewed seed set supplies defaults.

The app runs entirely in your browser. This static Space serves the frontend and fonts. Public Google Cloud Storage serves the extracted glyphs, catalog, and style vectors; there is no inference server. Text and alphabet choices stay in browser storage, and exports are generated locally. The asset host receives normal requests for the images and data you load.

This is an independent experiment, not an official British Library product. Image provenance comes from Daniel van Strien's [British Library Book Images dataset](https://huggingface.co/datasets/biglam/british-library-book-images). Derived punctuation cuts are labelled in the inspector. Lowercase uses the uppercase image sets; vectorization traces the available 256 px thumbnails.

Interface fonts retain their SIL Open Font License notices under `fonts/`. Bundled software notices are in [THIRD-PARTY-NOTICES.txt](https://enjalot-bl-type.hf.space/THIRD-PARTY-NOTICES.txt).
