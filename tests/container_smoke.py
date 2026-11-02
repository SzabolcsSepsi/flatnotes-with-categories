"""Exercise the built image, entrypoint, non-root process and prefixed auth API."""
import json
import secrets
import socket
import subprocess
import time
from urllib.error import HTTPError
from urllib.request import Request, urlopen

name = 'flatnotes-synthetic-' + secrets.token_hex(6)
secret = secrets.token_urlsafe(48)
password = secrets.token_urlsafe(24)
with socket.socket() as sock:
    sock.bind(('127.0.0.1', 0))
    port = sock.getsockname()[1]
base = f'http://127.0.0.1:{port}/notebook'


def request(path, token=None, data=None):
    headers = {'Content-Type': 'application/json'}
    if token:
        headers['Authorization'] = 'Bearer ' + token
    req = Request(base + path, headers=headers, data=json.dumps(data).encode() if data else None)
    try:
        with urlopen(req, timeout=5) as response:
            return response.status, response.read(), response.headers
    except HTTPError as error:
        return error.code, error.read(), error.headers


container = None
try:
    container = subprocess.check_output([
        'docker', 'run', '--detach', '--name', name, '--publish', f'127.0.0.1:{port}:8080',
        '--env', 'FLATNOTES_AUTH_TYPE=password', '--env', 'FLATNOTES_USERNAME=synthetic-user',
        '--env', 'FLATNOTES_PASSWORD=' + password, '--env', 'FLATNOTES_SECRET_KEY=' + secret,
        '--env', 'FLATNOTES_PATH_PREFIX=/notebook', '--env', 'PUID=1001', '--env', 'PGID=1001',
        'flatnotes-local:test'], text=True).strip()
    for _ in range(150):
        try:
            if request('/health')[0] == 200:
                break
        except OSError:
            time.sleep(.1)
    else:
        raise RuntimeError('Container startup timed out')
    for path in ['/api/notes/Home', '/api/search?term=*', '/api/tags', '/attachments/probe.html', '/api/attachments/probe.html']:
        assert request(path)[0] == 401, path
    status, body, _ = request('/api/token', data={'username':'synthetic-user','password':password})
    assert status == 200
    token = json.loads(body)['access_token']
    assert request('/api/notes',token,{'title':'Home','content':'# Synthetic note'})[0] == 200
    status, body, headers = request('/api/notes/Home',token)
    assert status == 200 and json.loads(body)['content'] == '# Synthetic note'
    assert headers['Cache-Control'] == 'no-store'
    assert b'<base href="/notebook/"' in request('/')[1]
    proc = subprocess.check_output(['docker','exec',container,'cat','/proc/1/status'],text=True)
    uid = next(line for line in proc.splitlines() if line.startswith('Uid:')).split()[1]
    assert uid == '1001', 'Application must run under the selected non-root UID'
    print('PASS: built-container startup, custom UID, prefix, authentication and private response headers')
finally:
    if container:
        subprocess.run(['docker','rm','--force','--volumes',container],check=True,stdout=subprocess.DEVNULL)
