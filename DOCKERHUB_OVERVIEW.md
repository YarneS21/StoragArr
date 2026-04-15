# StoragArr

## Short Description

Self-hosted media storage dashboard with library scanning, growth tracking, and bloat detection.

## Full Description

Storagarr is a self-hosted storage observability app for media libraries.
It scans mounted directories, tracks growth history, and highlights where space is being used so you can plan capacity before disks fill up.

Features:

- Library size scan per top-level folder
- Disk usage stats (used, free, total)
- Growth trend and simple forecast
- Duplicate/bloat folder detection
- Admin panel for adding and managing libraries
- Auto-rescan using filesystem watchers

This project has been vibe coded.

## Image

- Repository: yarnes/storagarr
- Tags: latest, vX.Y.Z
- Exposed port: 8282

## Quick Run

```bash
docker run -d \
  --name storagarr \
  -p 8282:8282 \
  -e JWT_SECRET=replace_with_long_random_secret \\
  -v /config/storagarr:/config \
  -v /media:/media:ro \
  --restart unless-stopped \
  yarnes/storagarr:latest
```

Open http://localhost:8282

## Docker Compose Example

```yaml
services:
  storagarr:
    image: yarnes/storagarr:latest
    container_name: storagarr
    environment:
      - JWT_SECRET=replace_with_long_random_secret
    ports:
      - "8282:8282"
    volumes:
      - /config/storagarr:/config
      - /media:/media:ro
    restart: unless-stopped
```

## Environment and Volumes

Storagarr stores runtime files in /config:

- users.json
- directories.json
- scans.json
- growth.json

Mount your media libraries read-only (recommended), for example /media.
Paths you add in the admin UI must exist inside the container.
If JWT_SECRET is omitted, Storagarr auto-generates one and stores it at /config/jwt-secret.txt.

## Upgrade

```bash
docker pull yarnes/storagarr:latest
docker compose up -d
```

## Versioned Deploy (recommended)

```bash
docker pull yarnes/storagarr:<version>
# then update your compose image tag and restart
```

## Security

- Set a strong JWT_SECRET value before exposing publicly.
- Use reverse proxy + HTTPS for internet-facing deployments.
- Keep /config protected and backed up.
