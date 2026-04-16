# Deploying SupplyLine MRO Suite to Hostinger

A step-by-step guide to putting this app online on a Hostinger VPS for
testing / demo purposes.

---

## TL;DR

- You need a **Hostinger VPS** (not Shared, not Cloud Hosting, not Premium Web).
  Those plans can't run Docker, Python/Flask long-running processes, or Socket.IO.
- Cost: roughly **$6 – $15 / month** for a VPS that's more than enough for a demo.
- Time to deploy: **~30–60 minutes** end-to-end.
- The app is already Docker Compose-ready, so deployment is basically:
  rent VPS → install Docker → clone repo → `docker compose up -d`.

---

## 1. Pick the right Hostinger plan

| Plan                              | Works? | Notes                                         |
| --------------------------------- | :----: | --------------------------------------------- |
| Premium / Business Web Hosting    |   ❌   | No Docker, no Python app servers              |
| Cloud Hosting (managed)           |   ❌   | Same story — PHP/Node managed stack only      |
| **VPS — KVM 1** (1 vCPU / 4 GB)   |   ✅   | Fine for demo, can run both containers        |
| **VPS — KVM 2** (2 vCPU / 8 GB)   |   ✅   | Recommended; more comfortable headroom        |

When creating the VPS, choose an **OS template** of **Ubuntu 22.04 LTS** or
**Ubuntu 24.04 LTS** with Docker pre-installed if that option is offered.
Otherwise a plain Ubuntu image is fine — we'll install Docker ourselves.

Keep the **root password** and **server IP address** Hostinger gives you —
you'll need them.

---

## 2. Point a domain at the server (optional but recommended)

You don't strictly need a domain — you can demo over `http://<server-ip>`. But
a domain is nicer, is required for free SSL, and fixes some browser quirks
around Socket.IO cookies.

1. Buy/choose a domain (Hostinger sells them; any registrar works).
2. Create a DNS **A record** pointing `demo.example.com` (or `@` for apex) at
   your VPS's public IPv4 address.
3. Wait a few minutes for DNS to propagate. Verify with:
   ```bash
   dig +short demo.example.com
   ```

If you skip this step, wherever the guide says `demo.example.com`, substitute
your server IP.

---

## 3. SSH into the VPS

From your laptop:

```bash
ssh root@<your-vps-ip>
```

Accept the host key and enter the root password.

First thing — update the server and create a non-root user:

```bash
apt update && apt upgrade -y
adduser deploy
usermod -aG sudo deploy
rsync --archive --chown=deploy:deploy ~/.ssh /home/deploy    # copy SSH key if you used one
```

From now on, prefer `ssh deploy@<your-vps-ip>` and use `sudo` when needed.

---

## 4. Install Docker and Docker Compose

```bash
# Docker Engine + the `docker compose` plugin (one command on Ubuntu 22.04+)
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
# log out and back in so the group change takes effect
exit
```

SSH back in, then verify:

```bash
docker --version
docker compose version
```

---

## 5. Open the firewall

Hostinger VPS images typically come with `ufw` available:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp      # HTTP
sudo ufw allow 443/tcp     # HTTPS (if you set up SSL)
sudo ufw enable
```

If Hostinger also has a **cloud firewall** in their control panel, make sure
ports 22, 80, and 443 are allowed there too.

---

## 6. Clone the repo

```bash
cd /opt
sudo mkdir supplyline && sudo chown $USER:$USER supplyline
cd supplyline
git clone https://github.com/PapaBear1981/SupplyLine-V2.git .
# or whatever your repo URL is
```

---

## 7. Create the `.env` file

The project ships with `.env.example`. Copy it and fill in the **required**
secrets:

```bash
cp .env.example .env

# Generate two strong random keys:
python3 -c "import secrets; print('SECRET_KEY=' + secrets.token_urlsafe(64))" >> .env
python3 -c "import secrets; print('JWT_SECRET_KEY=' + secrets.token_urlsafe(64))" >> .env

# Open it and remove the placeholder SECRET_KEY / JWT_SECRET_KEY lines you
# copied from .env.example so only the real ones remain.
nano .env
```

At minimum, make sure your `.env` ends up with:

```ini
FLASK_ENV=production
FLASK_DEBUG=False

SECRET_KEY=<the-long-random-value-you-generated>
JWT_SECRET_KEY=<another-long-random-value>

# Once you have a domain + HTTPS, set this to https://demo.example.com
# For a quick IP-only demo, use http://<your-vps-ip>
PUBLIC_URL=https://demo.example.com

# Let the frontend (served on port 80) talk to the API
CORS_ORIGINS=https://demo.example.com,http://<your-vps-ip>

# Secure cookies once you enable HTTPS
SESSION_COOKIE_SECURE=True

# Set a real admin password; do not leave the default
INITIAL_ADMIN_PASSWORD=<pick-a-strong-one>
```

**Do not commit `.env`** — it's already in `.gitignore`.

---

## 8. Build and start the app

```bash
docker compose build
docker compose up -d
docker compose ps
docker compose logs -f backend   # Ctrl-C to stop tailing
```

You should see the backend come up on port 5000 (inside the compose network)
and the frontend nginx container listening on host port **80**.

Smoke test from the VPS itself:

```bash
curl http://localhost/              # should return the React index.html
curl http://localhost/api/health    # should return {"status":"healthy",...}
```

From your laptop:

```
http://<your-vps-ip>/
```

You should see the login page. Default admin is `ADMIN001` with the password
you set as `INITIAL_ADMIN_PASSWORD`. **Change it immediately after first login.**

---

## 9. Add HTTPS (strongly recommended)

Browsers block a lot of modern features (secure cookies, service workers,
some WebSocket scenarios) over plain HTTP. For a demo on the public internet,
get a free Let's Encrypt certificate.

The least-friction approach is to put **Caddy** in front of the frontend
container. It handles certificate issuance and renewal automatically.

### Option A: Caddy as a system service (simplest)

```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
  | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
  | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install -y caddy
```

Now change the frontend's published port in `docker-compose.yml` so Caddy
can own port 80/443. Edit `docker-compose.yml`:

```yaml
  frontend:
    ...
    ports:
      - "8080:80"     # was "${FRONTEND_PORT:-80}:80"
```

Restart the stack:

```bash
docker compose up -d
```

Then create `/etc/caddy/Caddyfile`:

```caddy
demo.example.com {
    encode gzip
    reverse_proxy localhost:8080
}
```

Reload Caddy:

```bash
sudo systemctl reload caddy
```

Caddy will automatically fetch a Let's Encrypt cert the first time someone
hits `https://demo.example.com`. Update your `.env` so `PUBLIC_URL` and
`CORS_ORIGINS` use `https://demo.example.com` and restart the backend:

```bash
docker compose up -d --force-recreate backend
```

### Option B: Certbot + the nginx already in the frontend container

Possible, but more fiddly because the nginx config is baked into the image.
Stick with Caddy for a quick demo.

---

## 10. Make sure it stays up after reboots

Docker is set to start on boot by default on Ubuntu, and every service in
`docker-compose.yml` has `restart: unless-stopped`. So after a VPS reboot,
your stack comes back automatically. Verify:

```bash
sudo reboot
# wait a minute, SSH back in
docker compose ps
```

---

## 11. Data persistence, backups, resetting the demo

- The SQLite database lives in the **`supplyline-database`** named Docker
  volume. It survives container rebuilds.
- Uploaded avatars etc. live in **`supplyline-static-uploads`**.
- The app already takes automatic backups inside the container (see
  `AUTO_BACKUP_*` in `.env.example`). For extra safety, snapshot the volume:

  ```bash
  docker run --rm -v supplyline-database:/data -v $PWD:/backup alpine \
    tar czf /backup/db-$(date +%F).tgz -C /data .
  ```

- **Reset the demo** (wipe all data, start fresh):

  ```bash
  docker compose down
  docker volume rm supplyline-database supplyline-flask-session supplyline-static-uploads
  docker compose up -d
  ```

---

## 12. Useful day-to-day commands

```bash
# Update to the latest code
cd /opt/supplyline
git pull
docker compose build
docker compose up -d

# Tail logs
docker compose logs -f backend
docker compose logs -f frontend

# Shell into the backend container
docker compose exec backend bash

# Stop everything
docker compose down
```

---

## 13. Cost recap

| Item                         | Cost (approx., varies with promos)   |
| ---------------------------- | ------------------------------------ |
| Hostinger VPS KVM 1 (demo)   | ~$6–$10 / month                      |
| Hostinger VPS KVM 2 (comfy)  | ~$8–$13 / month                      |
| Domain (.com)                | ~$10–$15 / year                      |
| Let's Encrypt SSL            | Free                                 |
| Bandwidth / traffic          | Included in VPS plan                 |

Expect **~$6–$15 / month all-in** for a demo-grade deployment. If you commit
to a 24- or 48-month term Hostinger often has much lower promo prices; the
renewal price is what matters long-term, so check that before buying.

---

## 14. Production hardening (later)

For a demo the steps above are enough. Before exposing this to real users
you should additionally:

- Switch the database from SQLite to PostgreSQL (set `DATABASE_URL` in `.env`).
- Put the VPS behind Cloudflare for DDoS protection and caching.
- Rotate `SECRET_KEY` / `JWT_SECRET_KEY` any time they're exposed.
- Set up off-site backups (S3, Backblaze B2, or Hostinger object storage).
- Configure fail2ban for SSH, disable root SSH, SSH keys only.
- Review `SECURITY_SETUP.md` and `SECURITY_ANALYSIS.md` in this repo.

---

## Troubleshooting

- **`docker compose up` fails with "permission denied" on the socket** —
  you forgot to log out/in after `usermod -aG docker $USER`.
- **Frontend loads but API calls 404** — the frontend container's nginx
  proxies `/api` to `backend:5000`. If the backend isn't healthy
  (`docker compose ps` shows it unhealthy), check `docker compose logs backend`.
- **"Invalid CORS origin"** — your `CORS_ORIGINS` in `.env` must include the
  exact scheme + host you're browsing from, e.g. `https://demo.example.com`.
  After editing, `docker compose up -d --force-recreate backend`.
- **Socket.IO disconnects right after connecting** — usually either CORS or
  a reverse proxy that isn't forwarding the `Upgrade` header. Caddy's
  `reverse_proxy` handles this by default.
- **Login returns 401 with the default admin password** — that default only
  applies on a fresh database. If you logged in once and changed the password,
  you need that password (or reset the demo per §11).
