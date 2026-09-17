import json
import os
import smtplib
import ssl
import sys
from email.message import EmailMessage
from email.utils import formatdate

def send(payload):
    message = EmailMessage()
    message['From'] = os.environ['GMAIL_USER']
    message['To'] = os.environ['ALERT_EMAIL_TO']
    message['Subject'] = payload['subject']
    message['Date'] = formatdate(localtime=False)
    message.set_content(payload['text'])
    with smtplib.SMTP_SSL('smtp.gmail.com', 465, timeout=20, context=ssl.create_default_context()) as server:
        server.login(os.environ['GMAIL_USER'], ''.join(os.environ['GMAIL_APP_PASSWORD'].split()))
        refused = server.send_message(message)
        if refused:
            raise RuntimeError('Recipient rejected')

if __name__ == '__main__':
    try:
        send(json.load(sys.stdin))
    except Exception:
        print('Gmail delivery failed. Check credentials and account settings.', file=sys.stderr)
        sys.exit(1)
