#!/usr/bin/env python3
"""Run the admitted project checks in both CI and the ADT development checkout."""
import json
import os
from pathlib import Path
import subprocess
import sys

root = Path(__file__).resolve().parents[1]
profile = json.loads((root / '.adt/test.json').read_text())
local = sys.argv[1:] == ['--local']
if sys.argv[1:] and not local:
    raise SystemExit('Only --local is supported')
if profile.get('ci_requires_docker') and not local:
    subprocess.run(['docker', 'info'], check=True, stdout=subprocess.DEVNULL)
for project in profile['projects']:
    env = dict(os.environ)
    env.pop('DRIVER', None)
    env.pop('SKIP_CONTAINER_TESTS', None)
    if local:
        env.update(project.get('local_env', {}))
    for argv in project['commands']:
        print('[TEST]', project['cwd'], argv, flush=True)
        subprocess.run(argv, cwd=root / project['cwd'], env=env, check=True)
