"""Read-only upstream release check. A newer release fails visibly; never merges."""
import json
import os
from pathlib import Path
from urllib.request import Request, urlopen

root = Path(__file__).resolve().parents[1]
baseline = json.loads((root / 'UPSTREAM.json').read_text())
headers = {'Accept': 'application/vnd.github+json', 'User-Agent': 'flatnotes-upstream-check'}
if os.environ.get('GITHUB_TOKEN'):
    headers['Authorization'] = 'Bearer ' + os.environ['GITHUB_TOKEN']
request = Request('https://api.github.com/repos/dullage/flatnotes/releases/latest', headers=headers)
with urlopen(request, timeout=30) as response:
    latest = json.load(response)['tag_name']
if latest != baseline['tag']:
    raise SystemExit(f'Upstream release {latest} requires review; integrated baseline is {baseline["tag"]}. Follow MAINTENANCE.md.')
print('Upstream release matches the recorded baseline.')
