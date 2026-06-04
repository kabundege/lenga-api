# 🚀 Getting started with Strapi

Strapi comes with a full featured [Command Line Interface](https://docs.strapi.io/dev-docs/cli) (CLI) which lets you scaffold and manage your project in seconds.

### `develop`

Start your Strapi application with autoReload enabled. [Learn more](https://docs.strapi.io/dev-docs/cli#strapi-develop)

```
npm run develop
# or
yarn develop
```

### `start`

Start your Strapi application with autoReload disabled. [Learn more](https://docs.strapi.io/dev-docs/cli#strapi-start)

```
npm run start
# or
yarn start
```

### `build`

Build your admin panel. [Learn more](https://docs.strapi.io/dev-docs/cli#strapi-build)

```
npm run build
# or
yarn build
```

## ⚙️ Deployment

Production deploys run via GitHub Actions on push to `main` (see [`.github/workflows/ci.yml`](.github/workflows/ci.yml)). The workflow builds a Docker image, pushes to Docker Hub, then SSHs to the server to replace the `lenga-api` container.

### Production data layout

| Asset | Location | Survives `docker rm`? |
|-------|----------|------------------------|
| SQLite `data.db` | Docker volume `lenga-data` → `/app/.tmp` | Yes (volume is re-mounted on `docker run`) |
| Media uploads | `/app/public/uploads` in the container | No (restored from backup after each deploy) |

Default production settings use `DATABASE_CLIENT=sqlite` and `-v lenga-data:/app/.tmp`.

### CI backup and restore (automatic)

On every deploy, the SSH script in the `deploy` job:

1. **Backs up** (before `docker stop`) when the container already exists:
   - Copies `data.db` from the `lenga-data` volume into a timestamped folder under `BACKUP_ROOT`
   - Archives `public/uploads` from the running container to `uploads.tar.gz`
   - Fails the deploy if either file is missing or empty (`set -euo pipefail`)
2. **Replaces** the container (`docker stop` / `docker rm` / `docker run` with `lenga-data` mounted)
3. **Restores** (after `docker run`) when a backup was taken:
   - Extracts `uploads.tar.gz` into `/app/public` in the new container
   - Restores `data.db` to the volume **only** if the live file is missing or zero bytes, then restarts the container
4. Logs DB size and sample upload paths for smoke checks

First deploy (no existing container) skips backup and restore.

#### GitHub configuration

**Secrets** (repository settings): `DEPLOY_HOST`, `DEPLOY_SSH_KEY`, `DEPLOY_USER`, `DOCKERHUB_USERNAME`, `DOCKERHUB_PASSWORD`, `IMAGE_NAME`, `IMAGE_TAG`, `CONTAINER_NAME`, and related deploy values.

**Variables** (optional):

| Variable | Default | Purpose |
|----------|---------|---------|
| `BACKUP_ROOT` | `~/lenga-backups` | Directory on the server for timestamped backup folders |
| `DEPLOY_DOCKER_RUN_EXTRA_ARGS` | (empty) | Extra `docker run` flags (e.g. env files, additional volumes) |

Use an absolute path for `BACKUP_ROOT` if you prefer (e.g. `/home/ubuntu/lenga-backups`). Tilde expansion may not apply when the variable is set literally.

#### Verify after a CI deploy

On the server:

```bash
# Latest backup folder
ls -lt ~/lenga-backups | head

BACKUP_DIR=~/lenga-backups/<timestamp>   # from deploy logs: "Backup: ..."
ls -lah "$BACKUP_DIR"
# Expect: data.db, uploads.tar.gz (both non-zero)

# Live container
docker exec lenga-api ls -la /app/.tmp/data.db
docker exec lenga-api sh -c 'ls /app/public/uploads | wc -l'

# Optional: inspect backup archive
tar tzf "$BACKUP_DIR/uploads.tar.gz" | head -10
```

In GitHub Actions, open the **Deploy on server** job and look for `Backup:` and `Deploy complete; backup at ...`.

### Manual backup (before a risky change)

Use this when deploying outside CI or before manual container work.

```bash
TS=$(date +%Y%m%d-%H%M%S)
BACKUP_DIR=~/lenga-backups/$TS
mkdir -p "$BACKUP_DIR"

# Database (from lenga-data volume; sudo only if copying from host path)
docker run --rm \
  -v lenga-data:/data:ro \
  -v "$BACKUP_DIR":/backup \
  alpine cp /data/data.db /backup/data.db

# Uploads (requires running lenga-api container)
docker exec lenga-api tar czf /tmp/uploads.tar.gz -C /app/public uploads
docker cp lenga-api:/tmp/uploads.tar.gz "$BACKUP_DIR/uploads.tar.gz"
docker exec lenga-api rm -f /tmp/uploads.tar.gz

ls -lah "$BACKUP_DIR"
```

Confirm both files exist:

```bash
test -s "$BACKUP_DIR/data.db" && test -s "$BACKUP_DIR/uploads.tar.gz" && echo OK
```

Optional integrity check:

```bash
docker run --rm -v "$BACKUP_DIR":/backup:ro keinos/sqlite3 \
  sqlite3 /backup/data.db "PRAGMA integrity_check;"
```

### Manual restore

**Uploads** into a running container:

```bash
BACKUP_DIR=~/lenga-backups/<timestamp>

docker cp "$BACKUP_DIR/uploads.tar.gz" lenga-api:/tmp/uploads.tar.gz
docker exec lenga-api sh -c 'mkdir -p /app/public && tar xzf /tmp/uploads.tar.gz -C /app/public'
docker exec lenga-api rm -f /tmp/uploads.tar.gz
```

**Database** (only if `data.db` on the volume is missing or corrupt; stop Strapi first if possible):

```bash
docker stop lenga-api
docker run --rm \
  -v lenga-data:/data \
  -v "$BACKUP_DIR":/backup:ro \
  alpine cp /backup/data.db /data/data.db
docker start lenga-api
```

### Optional improvement: persistent uploads volume

Uploads are recreated on each deploy via tarball restore. To persist them like the database, create a volume once and add to `DEPLOY_DOCKER_RUN_EXTRA_ARGS`:

```text
-v lenga-uploads:/app/public/uploads
```

Seed the volume from a backup or the current container before the first deploy with that flag. CI backup/restore remains useful as a safety net.

### Run with Nginx (Docker Compose)

This project includes an Nginx reverse proxy in `docker-compose.yml`:

- Nginx listens on port `80`
- Requests are proxied to Strapi at `api:1337`
- Upload body size is set to `100M` in `nginx/default.conf`

Run:

```
docker compose up --build -d
```

## 📚 Learn more

- [Resource center](https://strapi.io/resource-center) - Strapi resource center.
- [Strapi documentation](https://docs.strapi.io) - Official Strapi documentation.
- [Strapi tutorials](https://strapi.io/tutorials) - List of tutorials made by the core team and the community.
- [Strapi blog](https://strapi.io/blog) - Official Strapi blog containing articles made by the Strapi team and the community.
- [Changelog](https://strapi.io/changelog) - Find out about the Strapi product updates, new features and general improvements.

Feel free to check out the [Strapi GitHub repository](https://github.com/strapi/strapi). Your feedback and contributions are welcome!

## ✨ Community

- [Discord](https://discord.strapi.io) - Come chat with the Strapi community including the core team.
- [Forum](https://forum.strapi.io/) - Place to discuss, ask questions and find answers, show your Strapi project and get feedback or just talk with other Community members.
- [Awesome Strapi](https://github.com/strapi/awesome-strapi) - A curated list of awesome things related to Strapi.

---

<sub>🤫 Psst! [Strapi is hiring](https://strapi.io/careers).</sub>
