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
