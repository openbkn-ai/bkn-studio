# Copyright (c) 2026 OpenBKN
# SPDX-License-Identifier: LicenseRef-OpenBKN
# Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
# Conditions. See LICENSE for the full text.

param(
  [string]$BaseUrl = "http://host.docker.internal:5173",
  [string]$ApiBaseUrl = "http://host.docker.internal:9000/api"
)

$workspace = (Resolve-Path (Join-Path $PSScriptRoot "../..")).Path

docker run --rm `
  -v "${workspace}:/workspace" `
  -w /workspace/tests/e2e `
  -e "E2E_BASE_URL=$BaseUrl" `
  -e "E2E_API_BASE_URL=$ApiBaseUrl" `
  -e "E2E_BUSINESS_DOMAIN=bd_public" `
  --add-host=host.docker.internal:host-gateway `
  mcr.microsoft.com/playwright:v1.52.0-jammy `
  bash -lc "npm install && npx playwright test specs/execution-factory/operator.at.spec.ts --reporter=list"
