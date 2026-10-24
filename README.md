# CyberShield 360

**Multi-modal cybersecurity awareness, threat-analysis & incident-response platform.**

Analyze suspicious **URLs, messages, emails, images, QR codes and websites**, and
understand *what happened, why it matters, and what to do next* — with the risk and
confidence reported separately and always backed by evidence.

> It runs **100% offline out of the box**: SQLite database + mock AI/OCR/threat-intel
> providers + synthetic demo data. **No API keys, no cloud services, no internet
> required** to run and explore it.

- **Frontend:** React + Vite + TypeScript + Tailwind + shadcn/ui (dark-first)
- **Backend:** Python + FastAPI + SQLAlchemy (SQLite in dev, PostgreSQL in prod)

---

## ⚡ Fastest way to run (Windows, double-click)

After installing Python 3.11+ and Node.js 18+ (see [section 1](#1-what-you-need-installed)):

1. **One time:** double-click **`setup.bat`** — installs all packages.
2. **Run on your computer:** double-click **`run-local.bat`** → open **http://localhost:5173**.
3. **Share with teammates anywhere (internet):** double-click **`run-share.bat`** →
   it opens a window showing a public link like
   `https://something.trycloudflare.com` — share that. (HTTPS, so the phone
   **QR camera** works too.)

Keep the opened windows running while you use/share it; close them to stop.
Details & manual commands are in [section 4a](#4a-run-it-anytime--share-online). The
rest of this README explains the manual steps if you prefer them.

---

## Table of contents
1. [What you need installed](#1-what-you-need-installed)
2. [Get the project folder](#2-get-the-project-folder)
3. [Run the backend (API)](#3-run-the-backend-api)
4. [Run the frontend (website)](#4-run-the-frontend-website)
5. [Open the app](#5-open-the-app)
6. [Default login](#6-default-login)
7. [Stopping / restarting](#7-stopping--restarting)
8. [Running the tests (optional)](#8-running-the-tests-optional)
9. [Configuration (optional)](#9-configuration-optional)
10. [Troubleshooting](#10-troubleshooting)
11. [Project structure](#11-project-structure)
12. [More documentation](#12-more-documentation)

---

## 1. What you need installed

Install these two programs **once**. Everything else is downloaded automatically by
the setup commands below.

| Software | Minimum version | Tested with | Download |
|----------|-----------------|-------------|----------|
| **Python** | 3.11+ | 3.13 | https://www.python.org/downloads/ |
| **Node.js** (includes npm) | 18+ | 22 | https://nodejs.org/en/download |

> **Windows tip:** when installing Python, tick **"Add python.exe to PATH"** on the
> first screen of the installer. When installing Node.js, accept the defaults.

**Verify the installs** — open a terminal and run:

```bash
python --version      # should print Python 3.11 or newer  (try "py --version" on Windows if "python" is not found)
node --version        # should print v18 or newer
npm --version         # should print a version number
```

You do **not** need Docker, PostgreSQL, Redis, or any API keys to run the project
locally.

---

## 2. Get the project folder

If someone shared the project as a **ZIP**, extract it anywhere, e.g.:

- Windows: `C:\Users\<you>\Downloads\CyberShield360`
- macOS/Linux: `~/Downloads/CyberShield360`

Open the extracted folder. You should see two sub-folders: **`backend/`** and
**`frontend/`**. All commands below are run from inside one of those two folders.

> You will use **two terminals** at the same time — one for the backend, one for the
> frontend. Keep both open while using the app.

---

## 3. Run the backend (API)

Open a terminal (**Terminal 1**) and go into the `backend` folder.

```bash
cd path/to/CyberShield360/backend
```
*(On Windows, for example: `cd C:\Users\<you>\Downloads\CyberShield360\backend`)*

### 3a. Create and activate a virtual environment

A "virtual environment" keeps this project's Python packages separate from the rest
of your computer.

```bash
python -m venv .venv
```

Now **activate** it (use the line that matches your system):

| System / terminal | Command |
|-------------------|---------|
| **Windows – PowerShell** | `.venv\Scripts\Activate.ps1` |
| **Windows – Command Prompt (cmd)** | `.venv\Scripts\activate.bat` |
| **Windows – Git Bash** | `source .venv/Scripts/activate` |
| **macOS / Linux** | `source .venv/bin/activate` |

After activation your prompt shows `(.venv)` at the start.

> **Windows PowerShell error** `running scripts is disabled on this system`? Run this
> once, then activate again:
> `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`

### 3b. Install the backend packages

```bash
pip install -r requirements.txt
```
*(This downloads FastAPI, SQLAlchemy, and the rest — takes a minute or two.)*

### 3c. Start the backend

```bash
python -m uvicorn app.main:app --reload --port 8000
```

On first start it automatically creates the local SQLite database and fills it with
synthetic demo data. When you see a line like
`Uvicorn running on http://127.0.0.1:8000`, the API is ready.

- API base: **http://localhost:8000**
- Interactive API docs: **http://localhost:8000/docs**

**Leave this terminal running.**

---

## 4. Run the frontend (website)

Open a **second** terminal (**Terminal 2**) and go into the `frontend` folder.

```bash
cd path/to/CyberShield360/frontend
```

### 4a. Install the frontend packages (first time only)

```bash
npm install
```
*(Downloads React and the UI libraries — takes a minute or two.)*

### 4b. Start the frontend

```bash
npm run dev
```

When you see `Local: http://localhost:5173/`, it's ready. The frontend automatically
forwards API calls to the backend on port 8000, so both must be running.

**Leave this terminal running too.**

---

## 4a. Run it anytime / share online

### Windows (easiest — double-click)
| I want to… | Double-click | Result |
|------------|--------------|--------|
| Run on my PC | `run-local.bat` | Opens backend + frontend windows → http://localhost:5173 |
| Share with teammates anywhere | `run-share.bat` | Also starts a public tunnel → `https://xxxx.trycloudflare.com` |

`run-share.bat` downloads `cloudflared` the first time (~55 MB) into `tools\`, starts
the backend + frontend, waits ~10s, then opens a **"CyberShield PUBLIC LINK"** window.
Copy the `https://….trycloudflare.com` link from that window and send it to your team.

### Manual equivalent (any OS)
Three things must run at once (three terminals):
```bash
# 1) backend
cd backend && python -m uvicorn app.main:app --port 8000

# 2) frontend  (binds all interfaces; also reachable on your LAN)
cd frontend && npm run dev

# 3) public tunnel  (Windows path shown; see cloudflare.com for mac/linux binary)
tools\cloudflared.exe tunnel --url http://localhost:5173 --no-autoupdate
```

### Which link do I share?
- **Same computer only:** `http://localhost:5173`
- **Same Wi‑Fi / office network:** the `Network:` URL printed by the frontend
  (e.g. `http://172.20.10.11:5173`). Teammates must be on the same network, and
  Windows Firewall must allow the connection (approve the prompt, or allow Node.js).
- **Teammates anywhere (different places):** the **`https://….trycloudflare.com`**
  link from the tunnel. This is the one to use for remote testing.

### Good to know
- Keep your PC on with all windows running — closing any stops the share.
- The tunnel link is **public** and **changes every restart** (random). A fixed URL
  needs a free Cloudflare account; ask if you want that set up.
- It's a **dev server with demo data** — fine for testing, not production. Don't post
  the link publicly; the seeded admin is a known default.
- The QR **camera** needs HTTPS or localhost, so it works via the `trycloudflare.com`
  link and on `localhost`, but **not** over a plain `http://<LAN-IP>` address.

---

## 5. Open the app

Open your web browser and go to:

### 👉 http://localhost:5173

Things to try:
- **Scan a URL:** go to the Scanner and paste `http://account-verify-login.example/login`
  (a built-in demo "bad" link) → you'll get a **High/Critical** result with evidence.
- **Scan a message:** paste `URGENT: your account is suspended, verify your OTP at http://bit.ly/x`.
- **Website scan:** try `http://127.0.0.1/` → it is safely **blocked** (SSRF protection).
- **Learn**, **I was scammed**, and **Intelligence** sections work with demo content.

> All results use synthetic/offline demo data — this is a safe sandbox, not a live
> threat feed.

---

## 6. Default login

A development administrator account is created automatically:

- **Email:** `admin@cybershield.dev`
- **Password:** `ChangeMe!Dev12345`

Sign in (top-right) to save scan history and to open the **Admin** area (analytics +
feature toggles). You can also register your own normal account from the login page.

> These credentials exist **only** in development mode. They are never created in a
> production deployment.

---

## 7. Stopping / restarting

- **Stop a server:** click its terminal and press **Ctrl + C**.
- **Restart the backend later:** in Terminal 1, re-activate the venv (step 3a) and run
  the uvicorn command again (step 3c). You do **not** need to reinstall packages.
- **Restart the frontend later:** in Terminal 2, just run `npm run dev` again.
- **Reset all data:** stop the backend, delete the file
  `backend/cybershield.dev.sqlite3`, then start the backend again (it will re-seed).

---

## 8. Running the tests (optional)

**Backend** (from `backend/`, venv activated):
```bash
python -m pytest
```

**Frontend** (from `frontend/`):
```bash
npm test          # unit/component tests
npm run build     # type-check + production build
```

---

## 9. Configuration (optional)

The app runs with safe defaults and needs **no configuration** for local use. To
customize it, copy the example environment file and edit it:

```bash
# from the project root folder
# Windows (PowerShell):   Copy-Item .env.example .env
# macOS / Linux / Git Bash:
cp .env.example .env
```

A few useful settings (see `.env.example` for the full, commented list):

| Variable | Default | Meaning |
|----------|---------|---------|
| `DATABASE_PROVIDER` | `sqlite` | `sqlite` (dev) or `postgresql` (prod) |
| `DEMO_MODE` | `true` | Show synthetic demo data |
| `MOCK_LLM` / `MOCK_THREAT_INTELLIGENCE` | `true` | Run with no external AI / threat-intel APIs |
| `ENABLE_*` | `true` | Turn individual scanners/modules on or off |

Never commit a real `.env` file — only `.env.example` (with placeholders) is shared.

---

## 10. Troubleshooting

| Problem | Fix |
|---------|-----|
| `python` not recognized (Windows) | Use `py` instead of `python`, or reinstall Python with **"Add to PATH"** ticked. |
| PowerShell: *"running scripts is disabled"* | `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`, then activate the venv again. |
| `pip install` fails / old pip | Run `python -m pip install --upgrade pip` and retry. |
| Port **8000** already in use | Start the backend on another port: `python -m uvicorn app.main:app --reload --port 8001` — then in `frontend/vite.config.ts` change the proxy target to `http://localhost:8001` and restart the frontend. |
| Port **5173** already in use | Run `npm run dev -- --port 5174` and open that URL instead. |
| Frontend loads but data/login fails | Make sure the **backend terminal is still running** on port 8000. |
| Want a clean database | Stop the backend and delete `backend/cybershield.dev.sqlite3`, then start it again. |
| `ModuleNotFoundError` on backend start | The virtual environment isn't active — re-run the activate command from step 3a (prompt should show `(.venv)`). |

---

## 11. Project structure

```
CyberShield360/
├── README.md               ← you are here
├── .env.example            ← configuration template (optional)
├── docker-compose.yml      ← for production/Docker deployments (not needed locally)
├── backend/                ← FastAPI API
│   ├── app/                ← application code (api, services, db, providers)
│   ├── alembic/            ← database migrations (used in production)
│   ├── tests/              ← backend tests
│   └── requirements.txt    ← backend Python packages
├── frontend/               ← React + Vite + TypeScript UI
│   ├── src/                ← components, pages, design system
│   └── package.json        ← frontend packages
└── docs/                   ← architecture, API, security, deployment docs
```

---

## 12. More documentation

| Doc | What's inside |
|-----|----------------|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | How the system is structured |
| [docs/API.md](docs/API.md) | All API endpoints |
| [docs/DATABASE.md](docs/DATABASE.md) | Data model / ERD |
| [docs/SECURITY.md](docs/SECURITY.md) | Security controls |
| [docs/THREAT_MODEL.md](docs/THREAT_MODEL.md) | Threats & mitigations |
| [docs/CONFIGURATION.md](docs/CONFIGURATION.md) | All configuration options |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Docker & production deployment |
| [docs/TESTING.md](docs/TESTING.md) | Test strategy |
| [PROJECT_STATUS.md](PROJECT_STATUS.md) | Build status & decisions |

---

### Scope & safety
CyberShield 360 is a **defensive, educational** project. It provides *assessments,
not guarantees* — "no known malicious indicators" never means content is guaranteed
safe. All demonstrations use clearly-labeled synthetic examples. It is not legal advice.
```
