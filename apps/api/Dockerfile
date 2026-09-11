# Build from the repository root:  docker build -f apps/api/Dockerfile .

ARG NODE_IMAGE=node:22-alpine
ARG PNPM_VERSION=10.29.3

# ---- base: node + pnpm -------------------------------------------------------
FROM ${NODE_IMAGE} AS base
ARG PNPM_VERSION
RUN npm install -g pnpm@${PNPM_VERSION} && npm cache clean --force
WORKDIR /app

# ---- build: install everything with the lockfile, bundle the API ------------
FROM base AS build
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store pnpm fetch
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --offline
RUN pnpm --filter @seen/api build
# Production node_modules for the API only (shared is bundled into dist, so it is not needed at runtime).
RUN pnpm --filter @seen/api deploy --prod --legacy /prod/api

# ---- runtime: small, non-root, healthchecked ----------------------------------
FROM ${NODE_IMAGE} AS runtime
ENV NODE_ENV=production \
    PORT=3000
WORKDIR /app
COPY --from=build --chown=node:node /prod/api/node_modules ./node_modules
COPY --from=build --chown=node:node /prod/api/package.json ./package.json
COPY --from=build --chown=node:node /app/apps/api/dist ./dist
COPY --from=build --chown=node:node /app/apps/api/drizzle ./drizzle
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/health >/dev/null || exit 1
CMD ["node", "dist/index.js"]
