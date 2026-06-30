# syntax=docker/dockerfile:1

############################ Stage 0 — build #############################
# dist/ is gitignored and CI runs no pre-build step, so the SPA bundle is
# produced in-image: a single `docker build` yields a self-contained artifact.
ARG NODE_IMAGE=node:22-alpine
ARG NGINX_IMAGE=nginx:1.27-alpine

FROM ${NODE_IMAGE} AS build

# corepack ships with node 22 and pins pnpm from package.json#packageManager
# (pnpm@11.5.1), so the in-image build matches the lockfile resolution exactly.
RUN corepack enable
WORKDIR /app

# Lockfile-only layer first so the dependency install caches across source edits.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
# Transpile-only bundle (esbuild via vite) — deliberately NOT `pnpm build`,
# which also runs `tsc -b`. Type safety is a CI gate (`pnpm lint:types` /
# `pnpm check`), so the deployable artifact isn't blocked on an unrelated
# typecheck regression. The browser bundle never needs tsc's output.
# A deployed image must hit the REAL backend, so default the mock switch OFF
# (services fall back to fixtures only when VITE_USE_MOCK !== "false"). Pass
# --build-arg VITE_USE_MOCK=true for a gate-less demo/fixtures build.
ARG VITE_USE_MOCK=false
ENV VITE_USE_MOCK=${VITE_USE_MOCK}
RUN pnpm exec vite build

########################### Stage 1 — runtime ###########################
FROM ${NGINX_IMAGE} AS prod

# Vite `base` is /studio/, so the bundle must live under html/studio for its
# absolute asset URLs (/studio/assets/...) to resolve.
COPY --from=build /app/dist /usr/share/nginx/html/studio
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
