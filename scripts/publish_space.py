#!/usr/bin/env python3
"""Build and publish only the static frontend to the public enjalot/bl-type Space."""
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
from huggingface_hub import HfApi
from huggingface_hub.errors import RepositoryNotFoundError

ROOT = Path(__file__).resolve().parents[1]
REPO = 'enjalot/bl-type'

def main():
    # Respect normal HF auth; support the workstation's existing login when HF_HOME differs.
    api = HfApi()
    if not api.token and not os.environ.get('HF_TOKEN'):
        cached = Path.home() / '.cache/huggingface/token'
        if cached.exists():
            api = HfApi(token=cached.read_text().strip())
    if api.whoami()['name'] != 'enjalot':
        raise RuntimeError('Publish using the enjalot Hugging Face account')
    try:
        info = api.space_info(REPO)
        if info.sdk != 'static' or info.private:
            raise RuntimeError('Existing Space is not public/static; refusing to replace it')
    except RepositoryNotFoundError:
        pass
    subprocess.run(['npm', 'run', 'build:hosted'], cwd=ROOT, check=True)
    files = [p for p in (ROOT / 'dist').rglob('*') if p.is_file()]
    for path in files:
        relative = path.relative_to(ROOT / 'dist')
        if relative.parts[0] not in {'assets', 'fonts', 'index.html', 'THIRD-PARTY-NOTICES.txt'}:
            raise RuntimeError(f'Unexpected frontend file: {relative}')
    size = sum(p.stat().st_size for p in files)
    if size > 2_000_000 or len(files) > 30:
        raise RuntimeError('Frontend is unexpectedly large; generated assets must stay on GCS')
    with tempfile.TemporaryDirectory(prefix='bl-type-space-') as folder:
        stage = Path(folder)
        shutil.copytree(ROOT / 'dist', stage, dirs_exist_ok=True)
        shutil.copyfile(ROOT / 'deploy/SPACE_README.md', stage / 'README.md')
        api.create_repo(REPO, repo_type='space', space_sdk='static', private=False, exist_ok=True)
        # Only these known app directories are replaced on subsequent deployments.
        commit = api.upload_folder(repo_id=REPO, repo_type='space', folder_path=stage,
                                   delete_patterns=['assets/*', 'fonts/*'],
                                   commit_message='Publish BL Type static frontend with external GCS assets')
        receipt = {'space': f'https://huggingface.co/spaces/{REPO}',
                   'app': 'https://enjalot-bl-type.static.hf.space/',
                   'commit': commit.oid, 'frontendBytes': size, 'frontendFiles': len(files),
                   'assetRelease': json.loads((ROOT / 'deploy/asset-release.json').read_text())['release']}
        (ROOT / 'artifacts').mkdir(exist_ok=True)
        (ROOT / 'artifacts/space-publication.json').write_text(json.dumps(receipt, indent=2) + '\n')
        print(json.dumps(receipt, indent=2))

if __name__ == '__main__':
    main()
