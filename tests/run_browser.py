"""Start a fresh synthetic app, run browser checks, stop it gracefully."""
import os
import subprocess
from security_smoke import ROOT, Server

for script, mode in [('browser_smoke.mjs', 'password'),
                     ('sidebar_controls.mjs', 'password'),
                     ('sidebar_readonly.mjs', 'read_only')]:
    with Server(mode=mode, prefix='/notebook') as server:
        env = os.environ.copy()
        env.update(TEST_BASE_URL=server.base, TEST_PASSWORD=server.password)
        result = subprocess.run(['node', 'tests/' + script], cwd=ROOT, env=env)
        if result.returncode:
            raise SystemExit(result.returncode)
