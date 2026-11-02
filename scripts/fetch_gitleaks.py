"""Fetch a pinned official test tool and verify the release archive digest."""
import hashlib
import io
import os
from pathlib import Path
import platform
import tarfile
from urllib.request import urlopen
import zipfile

ROOT = Path(__file__).resolve().parents[1]
VERSION = '8.30.1'
ASSETS = {
    'Windows': ('windows_x64.zip', 'd29144deff3a68aa93ced33dddf84b7fdc26070add4aa0f4513094c8332afc4e'),
    'Linux': ('linux_x64.tar.gz', '551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb'),
}
suffix, expected = ASSETS[platform.system()]
assert platform.machine().lower() in {'amd64', 'x86_64'}, 'Only x64 test hosts supported'
with urlopen(f'https://github.com/gitleaks/gitleaks/releases/download/v{VERSION}/gitleaks_{VERSION}_{suffix}', timeout=60) as response:
    archive = response.read(40 * 1024 * 1024)
assert hashlib.sha256(archive).hexdigest() == expected, 'Tool archive checksum mismatch'
filename = 'gitleaks.exe' if os.name == 'nt' else 'gitleaks'
if suffix.endswith('.zip'):
    with zipfile.ZipFile(io.BytesIO(archive)) as package:
        binary = package.read(filename)
else:
    with tarfile.open(fileobj=io.BytesIO(archive), mode='r:gz') as package:
        member = package.getmember(filename)
        assert member.isfile() and member.size < 100 * 1024 * 1024
        binary = package.extractfile(member).read()
destination = ROOT / '.qa/tools' / filename
destination.parent.mkdir(parents=True, exist_ok=True)
destination.write_bytes(binary)
destination.chmod(0o755)
print('Pinned Gitleaks tool ready in .qa/tools.')
