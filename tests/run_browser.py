"""Start a fresh synthetic app, run browser checks, stop it gracefully."""
import os
import subprocess
from security_smoke import ROOT, Server

with Server(prefix='/notebook') as server:
    env = os.environ.copy()
    env.update(TEST_BASE_URL=server.base, TEST_PASSWORD=server.password)
    result = subprocess.run(['node', 'tests/browser_smoke.mjs'], cwd=ROOT, env=env)
    raise SystemExit(result.returncode)
