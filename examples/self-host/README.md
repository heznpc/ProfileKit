# Self-hosting ProfileKit (Docker)

This is the optional self-hosted path. The primary deployment target is
still Vercel (`api/[endpoint].js`) — nothing here replaces that.

## Quick start

From this directory:

```bash
docker compose up --build --scale web=3
```

ProfileKit is now reachable at <http://localhost:8080>, with three app
replicas behind one nginx load balancer.

To prove the load balancer is round-robining:

```bash
for i in 1 2 3 4 5; do
  curl -s -D - "http://localhost:8080/api/divider?style=wave" -o /dev/null \
    | grep -i x-profilekit-instance
done
```

The `X-ProfileKit-Instance` header rotates across the three replica
container IDs.

## What's running

| Service | Role |
|---|---|
| `web` × 3 | App replicas. Each runs `node server.js` from the repo-root Dockerfile. 128 MB memory + 0.5 CPU limit each — mirrors the Vercel function budget. |
| `lb`     | nginx round-robin load balancer. Port 8080 (host) → 80 (LB) → 3000 (each replica). |

## With GitHub-backed cards

`/api/stats`, `/api/languages`, `/api/pin`, `/api/reviews` need a GitHub
token. Set one before bringing the stack up:

```bash
export GITHUB_TOKEN=ghp_...
docker compose up --build --scale web=3
```

The other 24 cards (hero, divider, wave, terminal, etc.) work without a
token.

## Known limitation — token pool is per-process

`src/common/github-token.js` stores rate-limit state (which token is
cooled-down for how long) in process memory. With N replicas, each
replica maintains its own pool state. A token that gets a 429 on
replica A will keep being tried on replica B and C until each replica
independently observes its own 429.

For low-volume self-hosts that's invisible. For high-volume self-hosts
(many concurrent README embeds), point each replica at a separate
GitHub token via the `GITHUB_TOKENS=` or `GITHUB_TOKEN_1..N` form, or
front the deployment with a shared rate-limit store (Redis) — out of
scope for this example.

## Scaling further

```bash
docker compose up --build --scale web=10
```

nginx picks up the new replicas automatically because the upstream uses
Docker's embedded DNS with per-request re-resolution (see
`nginx/nginx.conf`).
