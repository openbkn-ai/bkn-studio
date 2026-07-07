# EF Studio Node Modules Isolation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix issue #49 so the execution-factory dev `ef-studio` container cannot delete or rebuild the host machine's `node_modules`.

**Architecture:** Keep source code bind-mounted for fast local iteration, but mount container dependency directories as Docker named volumes. Keep `pnpm install` lockfile-aware and volume-backed, so dependency writes stay inside Docker volumes and interrupted first-time installs can resume without touching the host checkout.

**Tech Stack:** Docker Compose, Node 22 Alpine, pnpm via corepack, Vite dev server, PowerShell verification script.

---

## Context

Issue: https://github.com/openbkn-ai/bkn-studio/issues/49

The affected compose file currently lives outside the `bkn-studio` git repository:

- `D:\workspace\openbkn\execution-factory-dev\docker-compose.yml`

The current `ef-studio` service bind-mounts the host Studio checkout into `/workspace`:

```yaml
volumes:
  - ../bknstudio/bkn-studio:/workspace
```

The same service then runs:

```sh
pnpm install && ./node_modules/.bin/vite --host 127.0.0.1 --port 5175 --force
```

Because `/workspace` is the host checkout, `/workspace/node_modules` is also the host `node_modules`. Inside Docker Desktop this means a Linux container can rewrite dependency files that the Windows host expects to run locally.

## Desired Behavior

- The container can read and serve the source tree from the host checkout.
- The container writes `/workspace/node_modules` to a Docker named volume, not the host filesystem.
- The container writes the pnpm store to a Docker named volume, not the host filesystem.
- The container installs dependencies into the mounted dependency volume using the lockfile and prefers the persistent pnpm store.
- Host `node_modules/.bin/vite` remains untouched after `docker compose up`.

## File Structure

- Modify: `D:\workspace\openbkn\execution-factory-dev\docker-compose.yml`
  - Add `ef_studio_node_modules` named volume mounted at `/workspace/node_modules`.
  - Add `ef_studio_pnpm_store` named volume mounted at `/pnpm/store`.
  - Add pnpm environment variables.
  - Replace host-writing install behavior with a Docker-volume-backed install command.
- Create: `D:\workspace\openbkn\execution-factory-dev\scripts\verify_ef_studio_node_modules_isolation.ps1`
  - Verifies compose config contains the isolation mounts.
  - Verifies the host `node_modules/.bin/vite` path is not a directory mount target for `ef-studio`.
  - Optionally records host `node_modules/.bin/vite` timestamp before/after compose startup.
- Create: `D:\workspace\openbkn\bknstudio\bkn-studio\docs\superpowers\plans\2026-07-07-issue-49-ef-studio-node-modules-isolation.md`
  - This implementation plan.

## Task 1: Add a Verification Script

**Files:**
- Create: `D:\workspace\openbkn\execution-factory-dev\scripts\verify_ef_studio_node_modules_isolation.ps1`

- [ ] **Step 1: Write the failing verification script**

Create the script with checks that fail against the current compose file:

```powershell
param(
  [string]$ComposeFile = (Join-Path $PSScriptRoot "..\docker-compose.yml")
)

$ErrorActionPreference = "Stop"
$composePath = (Resolve-Path $ComposeFile).Path
$composeText = Get-Content -Raw -Encoding UTF8 $composePath

function Assert-Contains {
  param(
    [string]$Text,
    [string]$Pattern,
    [string]$Message
  )
  if ($Text -notmatch $Pattern) {
    throw $Message
  }
}

Assert-Contains $composeText "ef_studio_node_modules:/workspace/node_modules" `
  "ef-studio must mount /workspace/node_modules to a Docker named volume."

Assert-Contains $composeText "ef_studio_pnpm_store:/pnpm/store" `
  "ef-studio must mount the pnpm store to a Docker named volume."

Assert-Contains $composeText "PNPM_STORE_DIR:\s*/pnpm/store" `
  "ef-studio must set PNPM_STORE_DIR to the Docker volume path."

Assert-Contains $composeText "pnpm install --frozen-lockfile --prefer-offline" `
  "ef-studio startup must install into the Docker volume with a reproducible lockfile-aware command."

Write-Host "ef-studio node_modules isolation checks passed."
```

- [ ] **Step 2: Run the script to verify it fails before implementation**

Run:

```powershell
powershell -ExecutionPolicy Bypass -File D:\workspace\openbkn\execution-factory-dev\scripts\verify_ef_studio_node_modules_isolation.ps1
```

Expected before implementation:

```text
ef-studio must mount /workspace/node_modules to a Docker named volume.
```

## Task 2: Isolate ef-studio Dependencies in Docker Compose

**Files:**
- Modify: `D:\workspace\openbkn\execution-factory-dev\docker-compose.yml`

- [ ] **Step 1: Update ef-studio environment**

Add pnpm paths:

```yaml
environment:
  PNPM_HOME: /pnpm
  PNPM_STORE_DIR: /pnpm/store
```

- [ ] **Step 2: Replace host-writing install behavior**

Replace:

```sh
corepack enable && corepack prepare pnpm@11.5.1 --activate && pnpm install && ./node_modules/.bin/vite --host 127.0.0.1 --port 5175 --force & node /opt/vite-loopback-proxy.mjs
```

With:

```sh
corepack enable &&
corepack prepare pnpm@11.5.1 --activate &&
pnpm config set store-dir /pnpm/store &&
pnpm install --frozen-lockfile --prefer-offline &&
./node_modules/.bin/vite --host 127.0.0.1 --port 5175 --force &
node /opt/vite-loopback-proxy.mjs
```

This keeps dependency writes inside named volumes, avoids deleting host dependencies, and lets a partially completed first install resume on the next container start.

- [ ] **Step 3: Add dependency named volumes**

Under `ef-studio.volumes`, add:

```yaml
- ef_studio_node_modules:/workspace/node_modules
- ef_studio_pnpm_store:/pnpm/store
```

Under top-level `volumes`, add:

```yaml
ef_studio_node_modules:
ef_studio_pnpm_store:
```

## Task 3: Verify the Fix

**Files:**
- Test: `D:\workspace\openbkn\execution-factory-dev\scripts\verify_ef_studio_node_modules_isolation.ps1`

- [ ] **Step 1: Run static verification**

Run:

```powershell
powershell -ExecutionPolicy Bypass -File D:\workspace\openbkn\execution-factory-dev\scripts\verify_ef_studio_node_modules_isolation.ps1
```

Expected:

```text
ef-studio node_modules isolation checks passed.
```

- [ ] **Step 2: Render compose config**

Run:

```powershell
docker compose -f D:\workspace\openbkn\execution-factory-dev\docker-compose.yml config ef-studio
```

Expected:

```text
ef-studio service includes:
- ef_studio_node_modules:/workspace/node_modules
- ef_studio_pnpm_store:/pnpm/store
```

- [ ] **Step 3: Optional runtime verification**

If Docker is available, record the host Vite binary timestamp before and after startup:

```powershell
$vite = "D:\workspace\openbkn\bknstudio\bkn-studio\node_modules\.bin\vite"
$before = (Get-Item $vite).LastWriteTimeUtc
docker compose -f D:\workspace\openbkn\execution-factory-dev\docker-compose.yml up -d ef-studio
Start-Sleep -Seconds 20
$after = (Get-Item $vite).LastWriteTimeUtc
if ($before -ne $after) { throw "Host vite binary was modified" }
```

## Self-Review

- Spec coverage: The plan covers host dependency isolation, lockfile-aware volume-backed install, pnpm store isolation, and verification.
- Placeholder scan: No placeholder tasks remain.
- Type consistency: File paths and volume names are consistent across tasks.
