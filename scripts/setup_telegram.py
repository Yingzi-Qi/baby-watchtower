"""Pair one Telegram recipient without exposing the token or requiring a chat ID."""
import getpass
import json
import secrets
import subprocess
import time
import urllib.request

REPO = 'Yingzi-Qi/baby-watchtower'

def main():
    subprocess.run(['gh', 'auth', 'status'], check=True, capture_output=True)
    token = getpass.getpass('BotFather token (hidden): ').strip()
    def api(method, data=None):
        request = urllib.request.Request('https://api.telegram.org/bot' + token + '/' + method,
            data=json.dumps(data or {}).encode(), headers={'Content-Type': 'application/json'})
        with urllib.request.urlopen(request, timeout=35) as response:
            result = json.load(response)
        if not result.get('ok'):
            raise RuntimeError('Telegram request failed')
        return result['result']
    bot = api('getMe')
    if api('getWebhookInfo').get('url'):
        raise RuntimeError('This bot already uses a webhook. Create a dedicated monitoring bot.')
    code = secrets.token_urlsafe(24)
    print('\nSend this private link to the person who should receive alerts:')
    print('https://t.me/' + bot['username'] + '?start=' + code)
    print('They can open it on any device and tap Start. Waiting up to 10 minutes…', flush=True)
    until = time.monotonic() + 600
    offset = 0
    chat_id = None
    while time.monotonic() < until and chat_id is None:
        for update in api('getUpdates', {'offset': offset, 'timeout': 25, 'allowed_updates': ['message']}):
            offset = update['update_id'] + 1
            message = update.get('message', {})
            if message.get('text') == '/start ' + code and message.get('chat', {}).get('type') == 'private':
                chat_id = str(message['chat']['id'])
                break
    if chat_id is None:
        raise RuntimeError('Pairing expired. Run setup again to generate a new link.')
    for name, value in [('TELEGRAM_BOT_TOKEN', token), ('TELEGRAM_CHAT_ID', chat_id)]:
        subprocess.run(['gh', 'secret', 'set', name, '--repo', REPO], input=value, text=True, capture_output=True, check=True)
    api('sendMessage', {'chat_id': chat_id, 'text': 'Baby Watchtower connected. You will receive confirmed incident and recovery alerts.\nhttps://yingzi-qi.github.io/baby-watchtower/'})
    print('Connected. A confirmation was sent in Telegram. Monitoring will use these settings on its next run.')

if __name__ == '__main__':
    try:
        main()
    except (Exception, KeyboardInterrupt):
        print('Setup did not complete. Check GitHub access, the bot token and Telegram connection, then retry. Existing secrets may have been partially updated; rerun setup to finish.')
        raise SystemExit(1)
