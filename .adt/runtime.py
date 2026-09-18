#!/usr/bin/env python3
"""Build source and smoke-test it with disposable Docker services (CI only)."""
import argparse
import json
import os
from pathlib import Path
import subprocess
import hashlib
import tempfile
import time
import urllib.request
import uuid

ROOT = Path(__file__).resolve().parents[1]
STATE = Path(os.environ.get('RUNNER_TEMP', tempfile.gettempdir())) / ('adt-smoke-' + hashlib.sha256(
    (str(ROOT) + os.environ.get('GITHUB_RUN_ID', '') + os.environ.get('GITHUB_RUN_ATTEMPT', '')).encode()).hexdigest()[:24] + '.json')


def run(argv, **kwargs):
    return subprocess.run(argv, check=True, text=True, **kwargs)


def docker(*args):
    return run(['docker', *args], capture_output=True).stdout.strip()


def cleanup():
    if not STATE.exists(): return
    state = json.loads(STATE.read_text())
    uid = state['uid']
    if not isinstance(uid, str) or len(uid) != 42 or not uid.startswith('adt-smoke-'):
        raise RuntimeError('Invalid smoke ownership record')
    for kind, args in [('containers', ['rm', '-f']), ('volumes', ['volume', 'rm']), ('networks', ['network', 'rm'])]:
        for name in reversed(state[kind]):
            if not name.startswith(uid): raise RuntimeError('Unowned smoke resource')
            inspect = ['volume', 'inspect'] if kind == 'volumes' else ['network', 'inspect'] if kind == 'networks' else ['container', 'inspect']
            result = subprocess.run(['docker', *inspect, name], capture_output=True, text=True)
            if result.returncode:
                if 'no such' in result.stderr.lower(): continue
                raise RuntimeError('Cannot verify smoke resource ownership')
            item = json.loads(result.stdout)[0]
            labels = item.get('Config', {}).get('Labels', {}) if kind == 'containers' else item.get('Labels', {})
            if not labels or labels.get('adt.smoke') != uid: raise RuntimeError('Unowned smoke resource')
            docker(*args, name)
    STATE.unlink()



def wait(probe, timeout=180):
    until = time.monotonic() + timeout
    while time.monotonic() < until:
        try:
            if probe(): return
        except (subprocess.CalledProcessError, OSError, ValueError): pass
        time.sleep(2)
    raise RuntimeError('Container/dependency readiness timed out')


def health(url, expected):
    with urllib.request.urlopen(url, timeout=5) as response:
        body = response.read().decode()
        value = json.loads(body) if 'json' in expected else None
        return (response.geturl() == url and response.status == expected['status'] and
                ('body' not in expected or body.strip() == expected['body']) and
                ('json' not in expected or isinstance(value, dict) and all(value.get(k) == v for k,v in expected['json'].items())))


def smoke(env, image):
    if STATE.exists(): raise RuntimeError('Previous smoke resources remain; run cleanup first')
    uid = 'adt-smoke-' + uuid.uuid4().hex
    state = {'uid': uid, 'containers': [], 'volumes': [], 'networks': []}
    workloads = []
    def record(kind, name):
        state[kind].append(name)
        STATE.write_text(json.dumps(state)); STATE.chmod(0o600)
        return name
    def start(item, alias, image, publish=False):
        container = record('containers', uid + '-' + alias)
        args = ['run', '-d', '--name', container, '--network', uid, '--network-alias', alias, '--label', 'adt.smoke=' + uid,
                '--user', str(item['run_as']) + ':' + str(item['run_as']), '--cap-drop', 'ALL',
                '--security-opt', 'no-new-privileges']
        if publish: args += ['-p', '127.0.0.1::' + str(item['port'])]
        for k,v in dict(item['env'], **item['ci_env']).items(): args += ['-e', k + '=' + v]
        for volume in item['volumes']:
            name = record('volumes', container + '-' + volume['name'])
            docker('volume', 'create', '--label', 'adt.smoke=' + uid, name)
            # Only this run's freshly created data volume is initialized as root.
            docker('run', '--rm', '--name', record('containers', uid + '-init-' + uuid.uuid4().hex[:8]),
                   '--label', 'adt.smoke=' + uid, '-v', name + ':/data', 'busybox:1.37', 'chown',
                   str(item['run_as']) + ':' + str(item['run_as']), '/data')
            args += ['-v', name + ':' + volume['mount']]
        command = item.get('command', [])
        if command: args += ['--entrypoint', command[0]]
        args += [image] + command[1:] + item.get('args', [])
        docker(*args)
        workloads.append((container, item))
        return container
    try:
        docker('network', 'create', '--label', 'adt.smoke=' + uid, record('networks', uid))
        for item in env['services']:
            start(item, item['name'], item['image'])
            wait(lambda: docker('run', '--rm', '--name', record('containers', uid + '-probe-' + uuid.uuid4().hex[:8]),
                                 '--label', 'adt.smoke=' + uid, '--network', uid, 'busybox:1.37',
                                 'nc', '-z', '-w', '2', item['name'], str(item['port'])) == '', timeout=item.get('startup_seconds', 600))
        app = env['app']; container = start(app, 'app', image, publish=True)
        binding = docker('port', container, str(app['port']) + '/tcp')
        url = 'http://' + binding
        wait(lambda: health(url + app['health']['path'], app['health']), timeout=app.get('startup_seconds', 600))
        if app['health'].get('frontend_path'):
            with urllib.request.urlopen(url + app['health']['frontend_path'], timeout=10) as response:
                if response.status != 200 or '<html' not in response.read().decode().lower():
                    raise RuntimeError('Frontend not included in image')
        # Verify persistent mounts survive restart, using only this run's disposable volumes.
        for workload, item in workloads:
            for volume in item['volumes']:
                vol = workload + '-' + volume['name']
                marker = '.adt-smoke-persistence'
                def data_probe(script):
                    return docker('run', '--rm', '--name', record('containers', uid + '-data-' + uuid.uuid4().hex[:8]),
                                  '--label', 'adt.smoke=' + uid, '--user', str(item['run_as']), '-v', vol + ':/data',
                                  'busybox:1.37', 'sh', '-c', script)
                data_probe('echo retained > /data/' + marker)
                docker('restart', workload)
                if data_probe('cat /data/' + marker) != 'retained': raise RuntimeError('Test data did not survive restart')
        url = 'http://' + docker('port', container, str(app['port']) + '/tcp')
        wait(lambda: health(url + app['health']['path'], app['health']), timeout=app.get('startup_seconds', 600))
        print('ADT container, dependencies and persistent mounts verified', flush=True)
    finally:
        cleanup()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('mode', choices=['build', 'smoke', 'cleanup'])
    parser.add_argument('--image')
    args = parser.parse_args()
    if args.mode == 'cleanup': cleanup(); return
    if not args.image: parser.error('--image is required')
    env = json.loads((ROOT / '.adt/runtime.json').read_text())
    if args.mode == 'build':
        for step in env['build']['commands']:
            run(step['argv'], cwd=ROOT / step['cwd'])
        run(['docker', 'build', '--pull', '-f', env['build']['dockerfile'], '-t', args.image,
             env['build']['context']], cwd=ROOT)
    else:
        smoke(env, args.image)


if __name__ == '__main__': main()
