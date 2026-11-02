"""Regression check: no new server endpoints and no runtime feature libraries."""
import ast
import json
from pathlib import Path
import subprocess
import tomllib

ROOT = Path(__file__).resolve().parents[1]
baseline = json.loads((ROOT / 'UPSTREAM.json').read_text())['commit']


def original(path):
    return subprocess.check_output(['git', 'show', f'{baseline}:{path}'], cwd=ROOT).decode()


def routes(source):
    result = []
    for node in ast.walk(ast.parse(source)):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            for decorator in node.decorator_list:
                if isinstance(decorator, ast.Call) and isinstance(decorator.func, ast.Attribute):
                    if decorator.func.attr in {'get', 'post', 'patch', 'put', 'delete'}:
                        result.append(ast.dump(decorator, include_attributes=False))
    return sorted(result)


assert routes(original('server/main.py')) == routes((ROOT / 'server/main.py').read_text())
before = json.loads(original('package.json'))
after = json.loads((ROOT / 'package.json').read_text())
assert set(before['dependencies']) == set(after['dependencies']), 'Runtime library set changed'
assert tomllib.loads(original('pyproject.toml'))['project']['dependencies'] == tomllib.loads((ROOT / 'pyproject.toml').read_text())['project']['dependencies']
for file in (ROOT / 'client/extensions/notebook').glob('*'):
    source = file.read_text()
    for forbidden in ['v-html', 'innerHTML', 'eval(', 'localStorage', 'sessionStorage', 'http://', 'https://']:
        assert forbidden not in source, f'Unexpected extension capability: {file.name}'
print('PASS: server routes, runtime library set and extension capability boundaries')
