# Free and easy deployment (Render + Neon + GitHub Actions)

No server to manage and no credit card expected. One service runs the website and API.

| Part | Service | Free limit |
|---|---|---|
| Website + API | Render free web service | Sleeps after 15 min idle unless kept awake (below) |
| Database | Neon free Postgres | 0.5 GB, 100 compute-hours a month |
| News refresh | GitHub Actions (`content-refresh.yml`) | Every 3 hours |

## 1. Push the code
    git add -A
    git commit -m "Add free deployment"
    git push

## 2. Create the database
1. Sign up at https://neon.com and create a project in a Singapore region.
2. Copy the connection string (`postgresql://...`).

## 3. Create the site
1. Sign up at https://render.com with GitHub.
2. New > Blueprint > pick this repository.
3. Paste the Neon connection string as `DATABASE_URL`, then Apply.
4. Wait for the first build, then open `https://<name>.onrender.com`.

## 4. Turn on news refresh
1. GitHub repo > Settings > Secrets and variables > Actions > New repository secret.
2. Name `DATABASE_URL`, value: the Neon connection string.
3. Actions tab > Content refresh > Run workflow, to fill the news now.

## Keep it fast (stop the sleep)
1. Sign up at https://cron-job.org (free).
2. Create a cron job: URL `https://<name>.onrender.com/health`, every 10 minutes.

`/health` doesn't touch the database, so this doesn't use Neon hours. Render gives
750 free hours a month, enough for this one service to run all month, so don't run
a second free service in the same Render workspace.

## 5. Make yourself admin (optional)
Register on the site, then in the Neon SQL editor run:

    UPDATE users SET role = 'ADMIN' WHERE email = 'you@example.com';

## Updating
`git push` redeploys automatically.

## Limits
- Without the keep-awake job, the first visit after 15 idle minutes takes about a minute.
- GitHub pauses scheduled workflows after 60 days without repository activity.
- The extension connects to https://cybershield360-ae6b.onrender.com by default. If your Render address is different, change `apiBase`/`appUrl` in `extension/shared/storage.js` and the host in `extension/manifest.json`, or set Backend URL in the extension's Settings.
