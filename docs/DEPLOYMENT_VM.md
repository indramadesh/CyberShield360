# Deploying CyberShield 360 on a free VM (Oracle Always Free) + Caddy

This gives you **free, always-on, HTTPS** hosting on your own domain, with **no cold
starts**, updatable any time with `git pull && ./deploy/deploy.sh`.

Stack on one VM: **Caddy** (auto HTTPS + static frontend + reverse proxy) →
**FastAPI backend** → **Postgres**, via `deploy/docker-compose.prod.yml`.

## Prerequisites
- An **Oracle Cloud** account (Always Free tier). _(Any always-on Linux VM works — DigitalOcean, a home server, etc. — the steps are the same after "create VM".)_
- A **domain** (a few $/yr) **or** a free subdomain. You'll point it at the VM's IP.
- This repo **pushed to git** (so you can `git clone` on the VM and `git pull` to update).

## 1. Create the VM
- Oracle Cloud → **Compute → Instances → Create**.
- Image: **Ubuntu 22.04**. Shape: **Ampere A1 (VM.Standard.A1.Flex)** — e.g. 1 OCPU / 6 GB (Always Free), or `VM.Standard.E2.1.Micro`.
- Add your SSH public key. Create. Note the **public IP**.

## 2. Open the ports (two places!)
**a) Oracle Security List / NSG** (cloud firewall): add **Ingress** rules allowing TCP **80**, **443** (and **22** for SSH) from `0.0.0.0/0`.
**b) The VM's own firewall** (Ubuntu images block by default). SSH in and run:
```bash
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistent save        # persist across reboots
```

## 3. Install Docker, Compose, Node, git
```bash
sudo apt-get update
sudo apt-get install -y docker.io docker-compose-v2 git curl
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs
sudo usermod -aG docker $USER && newgrp docker   # run docker without sudo
```

## 4. Point your domain at the VM
At your DNS provider, add an **A record**: `yourdomain.com` → **VM public IP**
(add `www` too if you want). Wait a few minutes for it to resolve
(`ping yourdomain.com` should show the VM IP). HTTPS needs this before step 6.

## 5. Get the code + configure
```bash
git clone <your-repo-url> cybershield && cd cybershield
cp deploy/.env.prod.example deploy/.env.prod
nano deploy/.env.prod
```
Set in `deploy/.env.prod`:
- `DOMAIN=yourdomain.com`, `ACME_EMAIL=you@example.com`
- a strong `POSTGRES_PASSWORD` **and** the same password inside `DATABASE_URL`
- a long random `SECRET_KEY` (e.g. `openssl rand -hex 32`)
- `CORS_ORIGINS=https://yourdomain.com`

## 6. Deploy
```bash
chmod +x deploy/deploy.sh
./deploy/deploy.sh
```
This builds the extension + frontend, builds the backend image, runs DB migrations,
and starts everything. Caddy fetches a free HTTPS certificate automatically.
Open **https://yourdomain.com** (give it ~30s on first run).

## 7. Create your admin account (production has no seeded admin)
Register a normal account on the site, then promote it:
```bash
docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env.prod exec backend \
  python -c "from app.db.session import SessionLocal; from app.db.models.user import User; \
s=SessionLocal(); u=s.query(User).filter(User.email=='you@example.com').first(); \
u.role='ADMIN'; s.commit(); print('promoted', u.email)"
```

## Updating any time
```bash
cd cybershield
git pull
./deploy/deploy.sh      # rebuilds + migrates + restarts; HTTPS stays valid
```
Live within a minute; users get it on their next page load. (Config/flags/thresholds
you can change with no redeploy via the in-app Admin page.)

## The browser extension in production
In the extension's **Settings**, set **Backend URL** = `https://yourdomain.com` and click
**Grant access to backend host**. Re-download the ZIP from
`https://yourdomain.com/browser-protection` whenever you ship a new extension version.

## Operations
- Logs: `docker compose -f deploy/docker-compose.prod.yml logs -f backend`
- Backup DB: `docker compose -f deploy/docker-compose.prod.yml exec db pg_dump -U cybershield cybershield > backup.sql`
- Restart: `docker compose -f deploy/docker-compose.prod.yml restart`

## Recommended hardening (free)
- Put **Cloudflare** (free plan) in front: proxied DNS → free CDN, DDoS protection,
  and it hides the VM's IP. (Use Cloudflare SSL "Full (strict)" with Caddy's cert.)
- Keep the OS patched (`sudo apt-get upgrade`), use SSH keys only, consider `fail2ban`.
- Rotate `SECRET_KEY`/DB password if ever exposed; never commit `deploy/.env.prod`.

## Notes / limits
- Always Free VMs are genuinely free and don't expire, but Oracle may reclaim **idle**
  instances — keep it in use, or upgrade to Pay-As-You-Go (still $0 within Always Free limits).
- This single-VM setup fits low/moderate traffic. For scale, split frontend to a CDN
  and move Postgres to a managed service later — no code changes (env only).
