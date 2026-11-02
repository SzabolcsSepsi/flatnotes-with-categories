"""Resolve official image tags to immutable digests. Review the diff before use."""
import json
from pathlib import Path
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
IMAGES = [('docker.io', 'library/node', '24-alpine'),
          ('docker.io', 'library/python', '3.13-slim-trixie'),
          ('ghcr.io', 'astral-sh/uv', '0.13.6')]


def digest(registry, name, tag):
    if registry == 'docker.io':
        auth_url = f'https://auth.docker.io/token?service=registry.docker.io&scope=repository:{name}:pull'
        host = 'registry-1.docker.io'
    else:
        auth_url = f'https://ghcr.io/token?service=ghcr.io&scope=repository:{name}:pull'
        host = registry
    with urlopen(auth_url, timeout=30) as response:
        token = json.load(response)['token']
    req = Request(f'https://{host}/v2/{name}/manifests/{tag}', method='HEAD', headers={
        'Authorization': 'Bearer ' + token,
        'Accept': 'application/vnd.oci.image.index.v1+json, application/vnd.docker.distribution.manifest.list.v2+json'})
    with urlopen(req, timeout=30) as response:
        value = response.headers['Docker-Content-Digest']
    if not value or not value.startswith('sha256:') or len(value) != 71:
        raise ValueError('Invalid registry digest')
    return value


if __name__ == '__main__':
    records = {f'{r}/{n}:{t}': digest(r, n, t) for r, n, t in IMAGES}
    path = ROOT / 'Dockerfile'
    content = path.read_text(encoding='utf-8')
    import re
    for image, value in records.items():
        short = image.replace('docker.io/library/', '')
        # Replace only exact known FROM / COPY --from image references.
        if 'astral-sh/uv' in image:
            content = re.sub(r'ghcr\.io/astral-sh/uv:[^\s]+', short + '@' + value, content)
        else:
            content = re.sub(re.escape(short) + r'(?:@sha256:[0-9a-f]{64})?(?=\s|$)', short + '@' + value, content)
    path.write_text(content, encoding='utf-8', newline='\n')
    print(json.dumps(records, indent=2))
