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

## Hosted checker (prepared; requires deployment)

`render.yaml` provisions one paid Starter Docker web service and a 1 GB persistent
disk. Review current Render pricing before creating it. Free instances sleep and
block SMTP; they are unsuitable for this checker. Keep exactly one instance with
this disk-based state store. `Dockerfile` builds the interface and includes Node
22 and Python 3 for Gmail delivery.

The service checks every 60 seconds. A check already in progress is shared;
public `POST /api/check` starts a check or returns the remaining global cooldown.
`GET /api/dashboard` returns saved results and runner status. Requests only check
the hardcoded monitored websites: users cannot supply target URLs or credentials.
The UI polls while a manually requested check runs. `/healthz` fails when checks
stop producing fresh results, allowing Render health checks to restart the service.
This is recovery, not independent outage notification: configure an external
uptime monitor for alerts if the whole host becomes unreachable.

Deployment/cutover:

1. Connect Render and approve the service/disk costs. Deploy the Blueprint with
   `GMAIL_USER`, `GMAIL_APP_PASSWORD`, and `ALERT_EMAIL_TO` as private environment
   variables. GitHub secrets cannot be read back for migration; re-enter the app
   password securely in Render. Optional Telegram secrets use the existing names.
2. Stop the GitHub monitoring workflow immediately before starting the hosted
   checker to prevent duplicate alerts. On first boot only, `STATE_SEED_URL`
   imports incident/delivery history from the monitor-state branch. A failed
   import aborts startup instead of silently discarding history. Existing disk
   state is never overwritten. Export the final GitHub state for rollback.
3. Verify `/healthz`, initial results, public refresh, and scheduled checks. The
   hosted service also serves the dashboard directly, with same-origin API calls.
4. For the existing GitHub Pages URL, set `public/runtime-config.json` to
   `{"backendUrl":"https://ACTUAL-HOST/api"}`, build, and publish `docs` with a
   Pages-only deployment workflow (remove scheduled checks and state writes).
   Until that cutover is verified, the published dashboard retains its existing
   GitHub results mode; no fabricated backend URL is configured.
5. If rollback is needed, export the latest hosted state before restoring GitHub
   monitoring. Never run both schedulers with alert credentials at the same time.

No provider guarantees zero downtime. The UI marks hosted results stale after
three minutes. Long checks/alert delivery can extend the one-minute interval;
only one observation is active at a time, with a three-minute process deadline.
