#!/usr/bin/env python3
"""Stage an immutable, checksummed public-asset release; never uploads files."""
import argparse
import hashlib
import json
from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parents[1]

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--release', required=True)
    args = parser.parse_args()
    if not args.release or any(c not in 'abcdefghijklmnopqrstuvwxyz0123456789-' for c in args.release):
        parser.error('Use a lowercase release ID containing letters, digits and hyphens')
    origin = f'https://storage.googleapis.com/fun-data/bl-type/{args.release}'
    stage = ROOT / 'artifacts/releases' / args.release
    stage.mkdir(parents=True, exist_ok=False)
    entries = []
    for folder in ['data', 'glyphs']:
        for source in sorted((ROOT / 'public' / folder).iterdir()):
            if not source.is_file() or source.is_symlink():
                raise ValueError(f'Unexpected asset: {source.name}')
            allowed = {'.json', '.bin'} if folder == 'data' else {'.webp', '.png', '.svg'}
            if source.suffix not in allowed:
                raise ValueError(f'Unexpected asset extension: {source.name}')
            relative = source.relative_to(ROOT / 'public')
            target = stage / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(source, target)
            entries.append({'path': relative.as_posix(), 'bytes': target.stat().st_size,
                            'sha256': hashlib.sha256(target.read_bytes()).hexdigest()})
    manifest = {'format': 'bl-type-assets-v1', 'release': args.release, 'origin': origin,
                'sourceDataset': 'https://huggingface.co/datasets/biglam/british-library-book-images',
                'files': entries}
    data = (json.dumps(manifest, separators=(',', ':')) + '\n').encode()
    (stage / 'manifest.json').write_bytes(data)
    receipt = {'release': args.release, 'origin': origin, 'manifest': origin + '/manifest.json',
               'manifestSha256': hashlib.sha256(data).hexdigest(),
               'files': len(entries), 'bytes': sum(e['bytes'] for e in entries)}
    (ROOT / 'deploy/asset-release.json').write_text(json.dumps(receipt, indent=2) + '\n')
    print(json.dumps({'stage': str(stage), **receipt}, indent=2))

if __name__ == '__main__':
    main()
