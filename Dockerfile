# syntax=docker/dockerfile:1
#
# ProfileKit container image — optional self-hosted path.
#
# ProfileKit's primary deployment target is Vercel (api/[endpoint].js).
# This image is for anyone who wants to run ProfileKit on their own
# infrastructure instead. The Vercel path is unaffected.
#
# Zero npm dependencies (see package.json — no "dependencies" /
# "devDependencies" blocks), so there is no `npm install` step. The image
# is just a Node 22 runtime + the source. Builds in seconds.

FROM node:22-slim

# Pre-existing unprivileged user shipped by the node image.
WORKDIR /app

# Copy only what the runtime needs. Tests / docs / build helpers stay out
# of the image — see .dockerignore for the exclusion list.
COPY package.json server.js ./
COPY src/ ./src/
COPY api/ ./api/
COPY public/ ./public/

ENV NODE_ENV=production \
    PORT=3000

EXPOSE 3000

# Liveness / readiness probe. Node's built-in fetch (>=22) keeps the image
# dependency-free — no curl / wget install needed.
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://localhost:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

USER node

CMD ["node", "server.js"]
