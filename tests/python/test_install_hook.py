import json
import os
import subprocess
import tempfile
import unittest


class TestInstallHook(unittest.TestCase):
    SCRIPT = os.path.join(os.path.dirname(__file__), '..', '..', 'scripts', 'install-hook.sh')

    def test_adds_stop_hook_preserving_existing(self):
        with tempfile.TemporaryDirectory() as d:
            settings = os.path.join(d, 'settings.json')
            with open(settings, 'w') as f:
                json.dump({
                    'hooks': {
                        'SessionStart': [{'hooks': [{'type': 'command', 'command': 'echo hi'}]}],
                    },
                    'theme': 'dark',
                }, f)
            subprocess.run(['bash', self.SCRIPT, settings, '/tmp/fake-push.py'], check=True)
            with open(settings) as f:
                result = json.load(f)
            # existing hooks + top-level keys preserved
            self.assertIn('SessionStart', result['hooks'])
            self.assertEqual(result['theme'], 'dark')
            # Stop hook added, pointing at the script
            stop = result['hooks']['Stop']
            self.assertEqual(len(stop), 1)
            cmd = stop[0]['hooks'][0]['command']
            self.assertIn('/tmp/fake-push.py', cmd)

    def test_idempotent_second_run_does_not_duplicate(self):
        with tempfile.TemporaryDirectory() as d:
            settings = os.path.join(d, 'settings.json')
            with open(settings, 'w') as f:
                json.dump({'hooks': {}}, f)
            subprocess.run(['bash', self.SCRIPT, settings, '/tmp/fake-push.py'], check=True)
            subprocess.run(['bash', self.SCRIPT, settings, '/tmp/fake-push.py'], check=True)
            with open(settings) as f:
                result = json.load(f)
            self.assertEqual(len(result['hooks']['Stop']), 1)


if __name__ == '__main__':
    unittest.main()
