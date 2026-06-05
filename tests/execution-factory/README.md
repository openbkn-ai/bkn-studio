# Execution Factory Tests (bkn-studio mirror)

Convenience copy of backend test assets. **Canonical location:**

`bkn-foundry/bkn-foundry/adp/execution-factory/tests/`

See that directory's [README.md](../../../../bkn-foundry/bkn-foundry/adp/execution-factory/tests/README.md) for the full OpenBKN run guide.

See [SOURCES.md](./SOURCES.md) for origin paths and coverage mapping.

## Directory layout

```
tests/execution-factory/
|-- SOURCES.md              # where each suite came from
|-- agent-at/               # mirror of foundry Agent AT (may drift)
|-- operator-web-ui/        # DIP operator-web Jest snapshots (reference)
|-- http/                   # operator-integration REST .http files
|-- fixtures/               # JSON/YAML payloads
|-- tool/                   # Python operator_client.py CLI
`-- (vitest in src/modules/execution-factory/services/*.test.ts)
```

## 1. Frontend mock unit tests (L1, PR gate)

```bash
cd bkn-studio/bkn-studio
corepack pnpm test:execution-factory
```

CI: `.github/workflows/ci-execution-factory.yml` runs the same command on PRs touching `src/modules/execution-factory/`.

## 2. Backend smoke (canonical path)

```powershell
cd bkn-foundry/bkn-foundry/adp/execution-factory/tests
$env:OPENBKN_TOKEN = "<token>"
.\scripts\run-openbkn-smoke.ps1
```

## 3. HTTP interface tests

HTTP files also live at `operator-integration/server/tests/http/` in foundry.

1. Start `agent-operator-integration` (e.g. `http://127.0.0.1:9000`)
2. Edit `http/env.http` with Bearer token + `x-business-domain`
3. Run requests in `operator.http`, `toolbox.http`, `mcp.http`, `skill.http`, `function-ai.http`

## 4. Python operator CLI

```bash
cd tests/execution-factory/tool
pip install requests pyyaml
copy config.local.yaml.example config.local.yaml
python operator_client.py --config=config.local.yaml list
```

## 5. Full Agent AT (KWeaver platform)

Run from **foundry** canonical path:

```powershell
cd bkn-foundry/bkn-foundry/adp/execution-factory/tests
pip install -r requirements/requirements.txt
copy config\env.openbkn.example.ini config\env.ini
py -m pytest testcases/data-operator-hub/api/operator/test_get_operator_category.py -q
```

Requires Hydra auth + MySQL + `eisoo` package. See `agent-at/LOCAL_SETUP.md` in this mirror.

## 6. DIP operator-web Jest (run in original repo)

```bash
cd e:/00_code_workspace/keweaver/web/apps/operator-web
yarn test
```

## 7. UI manual check

```bash
corepack pnpm dev
```

Routes: `/execution-factory/units`, `/catalog`, `/mcp`, `/skills`, `/skills/:id/edit`.
