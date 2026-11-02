import logging
import os

formatter = logging.Formatter(
    "%(asctime)s [%(levelname)s]: %(message)s", "%Y-%m-%d %H:%M:%S"
)
log_level = os.environ.get("LOGLEVEL", "INFO").upper()

# Internal
logger = logging.getLogger()
handler = logging.StreamHandler()
handler.setFormatter(formatter)
logger.addHandler(handler)
logger.setLevel(log_level)


# Uvicorn
class HealthEndpointFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        if not record.args or len(record.args) < 3:
            return False
        if record.args[2] == '/health':
            return False
        # Titles/search terms are present in URLs. Keep only method and status.
        args = list(record.args)
        args[2] = '<private>'
        record.args = tuple(args)
        return True


uvicorn_logger = logging.getLogger("uvicorn.access")
uvicorn_logger.addFilter(HealthEndpointFilter())
for handler in uvicorn_logger.handlers:
    handler.setFormatter(formatter)
uvicorn_logger.setLevel(log_level)
