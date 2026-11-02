"""Black-box tests against the built application, using disposable synthetic data.

Run with the project's Python: python tests/security_smoke.py
No test HTTP client package is required. Never point this at an existing server.
"""
import base64
import json
import os
from pathlib import Path
import secrets
import socket
import subprocess
import sys
import tempfile
import time
import unittest
from urllib.error import HTTPError
from urllib.parse import quote
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
MARKER = 'SYNTHETIC_PRIVATE_MARKER'
CONTENTS = '# Contents\n## Projects\n- [[Guide]]\n### Reference\n- [[Überblick & 10%]]\n'
HOME = '# Home\n- [ ] 2026-12-15 — Later\n- [ ] 2026-01-03 — Earlier\n- [x] 2026-01-02 — Complete\n'


class Server:
    def __init__(self, mode='password', prefix=''):
        test_root = ROOT / '.qa'
        test_root.mkdir(exist_ok=True)
        self.temp = tempfile.TemporaryDirectory(prefix='synthetic-', dir=test_root)
        self.data = Path(self.temp.name)
        for title, content in {'Contents': CONTENTS, 'Home': HOME, 'Guide': '# Guide\nSynthetic text',
                               'Überblick & 10%': 'Unicode note', MARKER: MARKER}.items():
            (self.data / f'{title}.md').write_text(content, encoding='utf-8')
        (self.data / 'attachments').mkdir()
        (self.data / 'attachments' / 'probe.html').write_text('<script>window.__attachmentProbe=1</script>')
        (self.data / 'attachments' / 'probe.svg').write_text('<svg xmlns="http://www.w3.org/2000/svg" onload="window.__attachmentProbe=1"/>')
        (self.data / 'attachments' / 'pixel.png').write_bytes(base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aK1sAAAAASUVORK5CYII='))
        self.password = secrets.token_urlsafe(24)
        self.secret = secrets.token_urlsafe(40)
        self.totp_key = secrets.token_urlsafe(24)
        self.mode, self.prefix = mode, prefix
        with socket.socket() as sock:
            sock.bind(('127.0.0.1', 0))
            self.port = sock.getsockname()[1]
        self.base = f'http://127.0.0.1:{self.port}{prefix}'

    def __enter__(self):
        env = os.environ.copy()
        env.update(FLATNOTES_PATH=str(self.data), FLATNOTES_AUTH_TYPE=self.mode,
                   FLATNOTES_USERNAME='synthetic-user', FLATNOTES_PASSWORD=self.password,
                   FLATNOTES_SECRET_KEY=self.secret, FLATNOTES_TOTP_KEY=self.totp_key,
                   FLATNOTES_PATH_PREFIX=self.prefix, PYTHONUTF8='1')
        self.log = open(self.data / 'server.log', 'w+', encoding='utf-8')
        self.process = subprocess.Popen([sys.executable, 'tests/serve_fixture.py',
                                        str(self.port), str(self.data / '.stop')], cwd=ROOT, env=env,
                                       stdout=self.log, stderr=subprocess.STDOUT)
        for _ in range(150):
            if self.process.poll() is not None:
                raise RuntimeError('Synthetic server failed to start; inspect its temporary log locally.')
            try:
                if self.request('/health')[0] == 200:
                    return self
            except OSError:
                time.sleep(.1)
        self.__exit__(None, None, None)
        raise RuntimeError('Synthetic server startup timeout')

    def request(self, path, method='GET', data=None, token=None, cookie=None, headers=None):
        request_headers = dict(headers or {})
        if data is not None:
            request_headers['Content-Type'] = 'application/json'
            data = json.dumps(data).encode()
        if token:
            request_headers['Authorization'] = 'Bearer ' + token
        if cookie:
            request_headers['Cookie'] = 'token=' + cookie
        req = Request(self.base + path, data=data, headers=request_headers, method=method)
        try:
            with urlopen(req, timeout=5) as response:
                return response.status, response.read(), response.headers
        except HTTPError as error:
            return error.code, error.read(), error.headers

    def token(self):
        password = self.password
        if self.mode == 'totp':
            from pyotp import TOTP
            password += TOTP(base64.b32encode(self.totp_key.encode())).now()
        status, data, _ = self.request('/api/token', 'POST', {'username': 'synthetic-user', 'password': password})
        assert status == 200, status
        return json.loads(data)['access_token']

    def __exit__(self, *_):
        if hasattr(self, 'process'):
            (self.data / '.stop').touch()
            try:
                self.process.wait(timeout=10)
            except subprocess.TimeoutExpired:
                self.process.terminate()
                self.process.wait(timeout=10)
        if hasattr(self, 'log'):
            self.log.close()
        for attempt in range(10):
            try:
                self.temp.cleanup()
                break
            except PermissionError:
                if attempt == 9:
                    raise
                time.sleep(.1)


class SecuritySmoke(unittest.TestCase):
    def check_private(self, server):
        paths = ['/api/notes/Contents', '/api/notes/Home', '/api/search?term=*', '/api/tags',
                 '/api/attachments/probe.html', '/attachments/probe.svg']
        for path in paths:
            for token in [None, 'invalid.jwt.value']:
                status, data, headers = server.request(path, token=token)
                self.assertEqual(status, 401, path)
                self.assertNotIn(b'Projects', data)
                self.assertEqual(headers['Cache-Control'], 'no-store')
        for method, path, data in [('POST', '/api/notes', {'title': 'Blocked', 'content': MARKER}),
                                  ('PATCH', '/api/notes/Home', {'newContent': MARKER}),
                                  ('DELETE', '/api/notes/Home', None),
                                  ('POST', '/api/attachments', None)]:
            self.assertEqual(server.request(path, method, data)[0], 401)
        token = server.token()
        for path in paths:
            self.assertEqual(server.request(path, token=token)[0], 200, path)
        self.assertEqual(server.request('/api/notes/Home', cookie=token)[0], 200)
        for name in ['probe.html', 'probe.svg']:
            for prefix in ['/attachments/', '/api/attachments/']:
                status, _, headers = server.request(prefix + name, token=token)
                self.assertEqual(status, 200)
                self.assertTrue(headers['Content-Disposition'].startswith('attachment;'))
                self.assertEqual(headers['Content-Type'], 'application/octet-stream')
                self.assertEqual(headers['X-Content-Type-Options'], 'nosniff')
                self.assertIn('sandbox', headers['Content-Security-Policy'])
        self.assertTrue(server.request('/attachments/pixel.png', token=token)[2]['Content-Type'].startswith('image/png'))
        for title in ['../outside', '..', 'a\\b', 'a\x00b', 'a\nb', 'x' * 241]:
            self.assertIn(server.request('/api/notes', 'POST', {'title': title, 'content': MARKER}, token=token)[0], [400, 422])
        for path in ['/api/notes/%2e%2e%2foutside', '/attachments/%2e%2e%2foutside', '/data/Home.md', '/.env']:
            self.assertIn(server.request(path, token=token)[0], [400, 404])
        from jose import jwt
        expired = jwt.encode({'sub': 'synthetic-user', 'exp': 1}, server.secret, algorithm='HS256')
        self.assertEqual(server.request('/api/notes/Home', token=expired)[0], 401)
        from datetime import datetime, timedelta, timezone
        future = int((datetime.now(timezone.utc) + timedelta(minutes=5)).timestamp())
        for algorithm, secret in [('HS512', server.secret), ('HS256', 'different-private-secret')]:
            wrong = jwt.encode({'sub': 'synthetic-user', 'exp': future}, secret, algorithm=algorithm)
            self.assertEqual(server.request('/api/notes/Home', token=wrong)[0], 401)
        for algorithm in ['none', 'RS256', 'ES256']:
            def b64(value):
                return base64.urlsafe_b64encode(json.dumps(value).encode()).rstrip(b'=').decode()
            wrong = b64({'alg': algorithm, 'typ': 'JWT'}) + '.' + b64({'sub':'synthetic-user','exp':future}) + '.'
            self.assertEqual(server.request('/api/notes/Home', token=wrong)[0], 401)
        self.assertEqual(server.request('/api/notes/' + quote('Überblick & 10%', safe=''), token=token)[0], 200)
        server.request('/api/search?term=' + MARKER, token=token)
        server.request('/api/notes/' + MARKER, token=token)
        time.sleep(.1)
        server.log.flush()
        log = (server.data / 'server.log').read_text(encoding='utf-8')
        for sensitive in [MARKER, token, server.password, server.secret, server.totp_key,
                          base64.b32encode(server.totp_key.encode()).decode()]:
            self.assertNotIn(sensitive, log)
        self.assertEqual(server.request('/api/config')[0], 200)  # public generic configuration, as upstream

    def test_password(self):
        with Server() as server:
            self.check_private(server)

    def test_totp_and_prefix(self):
        with Server('totp', '/notebook') as server:
            self.check_private(server)

    def test_read_only_is_public_but_never_writable(self):
        with Server('read_only') as server:
            self.assertEqual(server.request('/api/notes/Home')[0], 200)
            for method, path, data in [('POST', '/api/notes', {'title': 'No', 'content': ''}),
                                      ('PATCH', '/api/notes/Home', {'newContent': MARKER}),
                                      ('DELETE', '/api/notes/Home', None),
                                      ('POST', '/api/attachments', None)]:
                self.assertIn(server.request(path, method, data)[0], [404, 405])
            self.assertEqual((server.data / 'Home.md').read_text(encoding='utf-8'), HOME)


if __name__ == '__main__':
    unittest.main(verbosity=2)
