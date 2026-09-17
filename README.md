# Baby Watchtower

Website: https://yingzi-qi.github.io/baby-watchtower/

Public monitoring dashboard for Litscan and Perps Latency. GitHub Pages hosts the interface; GitHub Actions runs the public, read-only probes and retains incident state on the monitor-state branch.

## Monitoring
Checks are scheduled every five minutes even when the dashboard is closed. GitHub can delay or skip scheduled jobs under load. Results older than 15 minutes are marked stale. This is best-effort monitoring, not an uptime SLA. Two failed observations confirm an incident and two passing observations resolve it. Unknown observations never imply recovery. The public repository and dashboard contain only code and results from public endpoints.

Checks include page availability, JavaScript entry point availability, benchmark health, summary schema/freshness, sample schema, missing/stale successful venue measurements and recent measurement failures. Litscan's rendered charts and application data are not verified. Browser rendering, TLS expiry, internal logs and private services still need additional probes.

## Telegram
Add TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID under repository Settings → Secrets and variables → Actions. Create a bot with @BotFather and start the bot from the destination chat. Never put secrets in source, workflow YAML, issues or frontend data. Credentials stay in Actions secrets and are available only to the monitoring process.
Notifications are sent when incidents open or recover. Failed sends retry next run; network ambiguity can cause duplicate messages. Alerts remain disabled until both secrets exist.

## Updates
npm ci
npm run build
npm test

Commit the source and rebuilt docs/ folder. The push workflow rebuilds it; scheduled runs reuse docs/ and replace its observation data. GitHub Actions is the only production state writer. Do not run the checker on the monitor-state branch concurrently outside the workflow. Keep workflow triggers limited to trusted main, manual dispatch and schedule.

## Sharing
Share the GitHub Pages URL. No login is required. Repository edit access is separate.

## Email

The recipient is stored as the private GitHub Actions secret `ALERT_EMAIL_TO`.
To enable delivery, add `RESEND_API_KEY` (a sending key) and `ALERT_EMAIL_FROM`
(an address on a verified Resend sending domain) in repository Settings → Secrets
and variables → Actions. Do not put credentials or recipient addresses in source.
Resend's default testing sender cannot email arbitrary recipients.
Email has separate incident/recovery delivery tracking from Telegram and retries
failed requests. Already resolved incidents are skipped when email is first enabled.
API acceptance does not guarantee inbox delivery; use Resend delivery logs to check
bounces. Idempotency keys reduce duplicates within Resend's retention window.

## Telegram

The recipient only needs Telegram on their own device. No GitHub access is needed.
The repository owner creates a dedicated bot at https://t.me/BotFather with `/newbot`.
On a computer with Python 3 and GitHub CLI authenticated as a repository administrator,
run this from a downloaded or cloned copy of the repository:

```sh
python3 scripts/setup_telegram.py
```

Paste the bot token at the hidden prompt. Send the generated private pairing link
to the intended recipient; they tap Start. The helper automatically finds their
chat ID, stores both GitHub secrets, and sends a confirmation. The link expires
when the helper exits (after 10 minutes); don't share it publicly. This sets one
recipient and replaces any previously configured Telegram recipient. The helper
uses getUpdates, so use a dedicated bot without another polling process or webhook.
Monitoring then runs on GitHub without either person's device staying online.

### Gmail sender

Alternatively, set `GMAIL_USER` to the sending Gmail address and
`GMAIL_APP_PASSWORD` to a Google App Password in GitHub Actions secrets.
Two-step verification must be enabled and App Passwords available for that account.
Never use the normal account password. Gmail takes precedence over Resend when
fully configured. The first configured monitoring run sends a confirmation email;
SMTP acceptance does not guarantee inbox delivery. Python 3 is required (available
on GitHub's Ubuntu runner). Delivery uses authenticated TLS on port 465. SMTP has
no idempotency guarantee: an ambiguous timeout or failure to persist state can
cause duplicate mail on retry. Failed deliveries retry on subsequent checks.
