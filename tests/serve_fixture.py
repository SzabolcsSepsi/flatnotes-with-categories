"""Disposable loopback test server with file-signalled graceful shutdown."""
from pathlib import Path
import sys
import threading
import time

import uvicorn

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'server'))
server = uvicorn.Server(uvicorn.Config('main:app', host='127.0.0.1', port=int(sys.argv[1])))
stop_file = Path(sys.argv[2])


def stop_when_requested():
    while not stop_file.exists():
        time.sleep(.05)
    server.should_exit = True


threading.Thread(target=stop_when_requested, daemon=True).start()
server.run()
