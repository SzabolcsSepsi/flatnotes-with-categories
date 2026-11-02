"""Fail on new advisories, changed authentication assumptions or expired reviews."""
import ast
from datetime import date
import json
import importlib.metadata
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
policy = json.loads((ROOT / 'security/advisory-exceptions.json').read_text())
if date.today() > date.fromisoformat(policy['expires']):
    raise SystemExit('Advisory applicability review expired. Re-review before release.')
tree = ast.parse((ROOT / 'server/auth/local/local.py').read_text())
assignments = [n for n in ast.walk(tree) if isinstance(n, ast.Assign)]
assert any(any(isinstance(t, ast.Name) and t.id == 'JWT_ALGORITHM' for t in n.targets)
           and isinstance(n.value, ast.Constant) and n.value.value == 'HS256' for n in assignments)
calls = [n for n in ast.walk(tree) if isinstance(n, ast.Call) and isinstance(n.func, ast.Attribute)
         and isinstance(n.func.value, ast.Name) and n.func.value.id == 'jwt']
assert sorted(c.func.attr for c in calls) == ['decode', 'encode']
for call in calls:
    key = call.args[1] if len(call.args) > 1 else None
    assert isinstance(key, ast.Attribute) and key.attr == 'secret_key'
    expected = 'algorithms' if call.func.attr == 'decode' else 'algorithm'
    value = next(k.value for k in call.keywords if k.arg == expected)
    if expected == 'algorithms':
        assert isinstance(value, ast.List) and len(value.elts) == 1
        value = value.elts[0]
    assert isinstance(value, ast.Attribute) and value.attr == 'JWT_ALGORITHM'
report = json.loads(Path(sys.argv[1]).read_text(encoding='utf-8-sig'))
assert isinstance(report.get('dependencies'), list) and report['dependencies'], 'Missing audit inventory'
def normalized(name):
    return name.lower().replace('_', '-').replace('.', '-')
installed = {normalized(d.metadata['Name']) for d in importlib.metadata.distributions()}
reported = {normalized(d['name']) for d in report['dependencies']}
assert not installed - reported, 'Incomplete audit coverage: ' + ', '.join(sorted(installed - reported))
unreviewed = []
accepted = set()
for dependency in report.get('dependencies', []):
    if dependency.get('skip_reason'):
        unreviewed.append(dependency['name'] + ': audit skipped')
    for vulnerability in dependency.get('vulns', []):
        identifiers = {vulnerability['id'], *vulnerability.get('aliases', [])}
        match = next((e for e in policy['exceptions'] if e['package'] == dependency['name']
                      and e['version'] == dependency['version'] and identifiers.intersection(e['identifiers'])), None)
        if not match:
            unreviewed.append(dependency['name'] + ': ' + vulnerability['id'])
        else:
            accepted.add((dependency['name'], vulnerability['id']))
if unreviewed:
    print('\n'.join(unreviewed))
    raise SystemExit(1)
print(f'No unreviewed Python findings; {len(accepted)} findings matched expiring applicability exceptions in two packages. This is not a zero-advisory report.')
