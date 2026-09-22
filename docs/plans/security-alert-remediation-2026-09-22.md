# Open security alert remediation list

Generated: 2026-09-22

## Scope and source

This inventory was read from GitHub using the authenticated repository APIs
after the local checkout was updated to `origin/main` at `21899b6`.

## Local implementation status

Implemented locally on 2026-09-22:

- Removed API-key handoff storage from `sessionStorage`; the key now uses a
  short-lived, in-memory, one-time handoff referenced by an opaque navigation
  state ID.
- Enforced same-origin OAuth return paths both when storing and consuming the
  path.
- Replaced the ReDoS-prone business-display predicate and CI scanner patterns,
  and made HTML comment stripping linear while preserving line positions.
- Rejected prototype-special keys in mutable mock stores and removed the
  dynamic-delete patterns reported by CodeQL.
- Upgraded `react-router-dom` to `7.18.2`, Vitest to `4.1.11`, and E2E
  `adm-zip` to `0.6.1`; updated the remaining transitive dependencies through
  workspace overrides. Local `pnpm audit --prod` and full `pnpm audit` both
  report no known vulnerabilities.

GitHub alerts remain open until this branch is pushed and the repository's
CodeQL, Dependabot, and security workflows re-evaluate the new commit.

- Secret Scanning: **0 open**, **0 resolved** alerts. The URL filtered by
  `is:open results:generic` therefore does not currently return 39 Secret
  Scanning alerts through the repository API.
- Code Scanning: **12 open** alerts.
- Dependabot: **17 open** alerts.

The actionable total is **29 open alerts**. The discrepancy with 39 needs to
be resolved in the GitHub UI before treating the remaining ten as real current
alerts; they may be a stale view, a different repository, or a different alert
category.

The actions below are implementation plans, not declarations that an alert is
already fixed. Run the affected focused tests, `pnpm audit --prod`, and the
security workflow after each change; only then close or dismiss its GitHub
alert with the supporting evidence.

## Code Scanning

| Alert                                                                     | Severity | Finding                                                                          | Required remediation                                                                                                                                                                                                                                                                                                                          |
| ------------------------------------------------------------------------- | -------- | -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [#16](https://github.com/openbkn-ai/bkn-studio/security/code-scanning/16) | High     | `api-key-handoff.ts:32` stores a newly issued API key in `sessionStorage`.       | Do not persist API keys in Web Storage. Keep the key only in in-memory UI state on the issuing page, or exchange a short-lived, single-use opaque server-side handoff ID. Clear it after first display and add a test proving no key is written to storage.                                                                                   |
| [#15](https://github.com/openbkn-ai/bkn-studio/security/code-scanning/15) | High     | ReDoS risk in `scripts/scan-hardcoded-zh.mjs:309`.                               | Replace the nested/repeated identifier regular expression with deterministic parsing (split into segments and validate each segment) or a non-overlapping expression. This is CI-only input, but it should still have linear-time behaviour. Add a long adversarial-input regression test.                                                    |
| [#14](https://github.com/openbkn-ai/bkn-studio/security/code-scanning/14) | High     | ReDoS risk in `BusinessProvenanceScene.tsx:251`.                                 | Replace the repeated `"[object Object]"` matching expression with linear normalization: remove the fixed token, then validate the remaining separators. Bound input length before formatting and test a long repeated-token string. This path can render runtime data, so treat as a genuine production hardening item.                       |
| [#13](https://github.com/openbkn-ai/bkn-studio/security/code-scanning/13) | High     | Incomplete HTML comment stripping in `scripts/scan-hardcoded-zh.mjs:171`.        | Replace regex comment removal with a linear scanner that consumes from `<!--` through the next `-->`, including malformed-input handling. The script does not render HTML, so this is not an application XSS sink; document that fact if dismissing after the parser change.                                                                  |
| [#9](https://github.com/openbkn-ai/bkn-studio/security/code-scanning/9)   | High     | OAuth `return_to` value is read/written via `sessionStorage` in `oauth.ts:323`.  | The value should be a non-sensitive local path, not a credential. Enforce the existing safe-relative-path rule both before storage and after retrieval, then document/dismiss the clear-text-storage finding as a false positive if it contains no PII or token. Never place tokens, authorization codes, or a full external URL in this key. |
| [#7](https://github.com/openbkn-ai/bkn-studio/security/code-scanning/7)   | Medium   | Dynamic delete in `mock/state.ts:970` can be interpreted as prototype pollution. | Apply the shared safe-key remediation described below for `actionTypeId`; add a reserved-key test for `__proto__`, `constructor`, and `prototype`.                                                                                                                                                                                            |
| [#6](https://github.com/openbkn-ai/bkn-studio/security/code-scanning/6)   | Medium   | Dynamic delete in `mock/state.ts:939` can be interpreted as prototype pollution. | Apply the shared safe-key remediation for `actionTypeId` and cover the reserved-key cases.                                                                                                                                                                                                                                                    |
| [#5](https://github.com/openbkn-ai/bkn-studio/security/code-scanning/5)   | Medium   | Dynamic delete in `mock/state.ts:840` can be interpreted as prototype pollution. | Apply the shared safe-key remediation for `relationTypeId` and cover the reserved-key cases.                                                                                                                                                                                                                                                  |
| [#4](https://github.com/openbkn-ai/bkn-studio/security/code-scanning/4)   | Medium   | Dynamic delete in `mock/state.ts:817` can be interpreted as prototype pollution. | Apply the shared safe-key remediation for `relationTypeId` and cover the reserved-key cases.                                                                                                                                                                                                                                                  |
| [#3](https://github.com/openbkn-ai/bkn-studio/security/code-scanning/3)   | Medium   | Dynamic delete in `mock/state.ts:578` can be interpreted as prototype pollution. | Apply the shared safe-key remediation for `objectTypeId` and cover the reserved-key cases.                                                                                                                                                                                                                                                    |
| [#2](https://github.com/openbkn-ai/bkn-studio/security/code-scanning/2)   | Medium   | Dynamic delete in `mock/state.ts:575` can be interpreted as prototype pollution. | Apply the shared safe-key remediation for `objectTypeId` and cover the reserved-key cases.                                                                                                                                                                                                                                                    |
| [#1](https://github.com/openbkn-ai/bkn-studio/security/code-scanning/1)   | Medium   | Dynamic delete in `mock/state.ts:572` can be interpreted as prototype pollution. | Apply the shared safe-key remediation for `objectTypeId` and cover the reserved-key cases.                                                                                                                                                                                                                                                    |

For alerts #1 through #7, prefer replacing mutable `Record<string, ...>`
stores with `Map<string, ...>`. If that refactor is too broad, create stores
with `Object.create(null)` and reject `__proto__`, `constructor`, and
`prototype` in one shared key validator before every dynamic read, write, and
delete. The latter must be accompanied by tests that confirm the prototype is
unchanged.

## Dependabot

| Alert                                                                  | Severity | Dependency and scope                                                                                                 | Required remediation                                                                                                                                                                                                                                 |
| ---------------------------------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [#26](https://github.com/openbkn-ai/bkn-studio/security/dependabot/26) | High     | Direct development dependency `adm-zip` in `tests/e2e/package.json`; fixed in `0.6.1`.                               | Upgrade to `adm-zip >= 0.6.1`, regenerate the lockfile, and test E2E archive fixtures. This also addresses alert #12.                                                                                                                                |
| [#25](https://github.com/openbkn-ai/bkn-studio/security/dependabot/25) | High     | Transitive development dependency `js-yaml`; fixed in `4.3.2`.                                                       | Update the parent package(s) so the lockfile resolves `js-yaml >= 4.3.2`; use a temporary pnpm override only if compatible parent updates are unavailable. This also addresses #14 and #4.                                                           |
| [#24](https://github.com/openbkn-ai/bkn-studio/security/dependabot/24) | Medium   | Transitive development dependency `baseline-browser-mapping`; fixed in `2.11.0`.                                     | Upgrade the parent browser-target/tooling package and refresh the lockfile until the resolved version is at least `2.11.0`; confirm the production build still succeeds.                                                                             |
| [#23](https://github.com/openbkn-ai/bkn-studio/security/dependabot/23) | Medium   | Direct development dependency `vitest` in the lockfile; fixed in `4.1.11`.                                           | Upgrade the declared `vitest` dependency to `^4.1.11` or newer, update related Vitest packages, and run the focused and full unit-test commands. This also addresses #22 and #21.                                                                    |
| [#22](https://github.com/openbkn-ai/bkn-studio/security/dependabot/22) | Medium   | Direct development dependency `vitest` in `package.json`; fixed in `4.1.11`.                                         | Same remediation as #23: update the manifest and lockfile together; do not merely edit the lockfile.                                                                                                                                                 |
| [#21](https://github.com/openbkn-ai/bkn-studio/security/dependabot/21) | Medium   | Transitive development dependency `@vitest/mocker`; fixed in `4.1.11`.                                               | Resolve via the coordinated Vitest upgrade for #22/#23; verify mock and browser-test behaviour after the major-version change.                                                                                                                       |
| [#20](https://github.com/openbkn-ai/bkn-studio/security/dependabot/20) | Medium   | Direct development dependency `adm-zip` has a symlink-following extraction advisory with no published fixed version. | First upgrade to `0.6.1` for the other `adm-zip` advisories. If this alert remains, replace `adm-zip` in test tooling or ensure it never extracts untrusted archives and rejects symlink entries. Record the compensating control before dismissing. |
| [#19](https://github.com/openbkn-ai/bkn-studio/security/dependabot/19) | High     | Transitive development dependency `browserslist`; fixed in `4.28.7`.                                                 | Upgrade the parent build/tooling packages, or apply a tested pnpm override to `browserslist >= 4.28.7`; regenerate the lockfile and run the build.                                                                                                   |
| [#14](https://github.com/openbkn-ai/bkn-studio/security/dependabot/14) | High     | Transitive development dependency `js-yaml`; fixed in `4.3.1`.                                                       | Covered by upgrading `js-yaml` to `>= 4.3.2` for #25.                                                                                                                                                                                                |
| [#13](https://github.com/openbkn-ai/bkn-studio/security/dependabot/13) | High     | Runtime transitive dependency `react-router`; fixed in `7.18.2`.                                                     | Upgrade the declared `react-router-dom` dependency (and its resolved `react-router`) to at least `7.18.2`, then test all routes and form/action flows. This is production scope and should be prioritized.                                           |
| [#12](https://github.com/openbkn-ai/bkn-studio/security/dependabot/12) | High     | Direct development dependency `adm-zip`; fixed in `0.6.0`.                                                           | Covered by the stronger `adm-zip >= 0.6.1` upgrade for #26.                                                                                                                                                                                          |
| [#11](https://github.com/openbkn-ai/bkn-studio/security/dependabot/11) | Medium   | Transitive development dependency `postcss`; fixed in `8.5.23`.                                                      | Update the parent CSS/build toolchain or use a tested pnpm override to resolve `postcss >= 8.5.23`; run the production build. This also addresses #5.                                                                                                |
| [#5](https://github.com/openbkn-ai/bkn-studio/security/dependabot/5)   | High     | Transitive development dependency `postcss`; fixed in `8.5.18`.                                                      | Covered by resolving `postcss >= 8.5.23` for #11.                                                                                                                                                                                                    |
| [#4](https://github.com/openbkn-ai/bkn-studio/security/dependabot/4)   | High     | Transitive development dependency `js-yaml`; fixed in `4.3.0`.                                                       | Covered by resolving `js-yaml >= 4.3.2` for #25.                                                                                                                                                                                                     |
| [#3](https://github.com/openbkn-ai/bkn-studio/security/dependabot/3)   | High     | Transitive development dependency `brace-expansion` major line 1; fixed in `1.1.16`.                                 | Identify its parent with `pnpm why brace-expansion`, upgrade that parent, and verify the lockfile resolves `1.1.16` or later for the v1 subtree.                                                                                                     |
| [#2](https://github.com/openbkn-ai/bkn-studio/security/dependabot/2)   | High     | Transitive development dependency `brace-expansion` major line 3/4; fixed in `5.0.7`.                                | Identify the parent with `pnpm why brace-expansion`, upgrade it, and verify the relevant subtree resolves `5.0.7` or later. Do not force one major version across incompatible parents without testing.                                              |
| [#1](https://github.com/openbkn-ai/bkn-studio/security/dependabot/1)   | Low      | Transitive development dependency `esbuild`; fixed in `0.28.1`.                                                      | Upgrade Vite or the direct parent that brings in esbuild, or use a tested override to `esbuild >= 0.28.1`. Verify dev-server behaviour on Windows, where the advisory is relevant.                                                                   |

## Recommended execution order

1. Fix #16 and #13 first: an API key persisted in client storage and a
   production React Router advisory have the clearest production impact.
2. Upgrade direct dependencies (`react-router-dom`, `vitest`, `adm-zip`) and
   regenerate `pnpm-lock.yaml`; this should close several duplicate alerts.
3. Upgrade or override the remaining transitive build dependencies as a small,
   separately reviewed lockfile change.
4. Fix the two runtime CodeQL findings (#14 and #1--#7); handle the CI-only
   scanner findings (#13 and #15) next.
5. Re-run CodeQL, Dependabot, `pnpm audit --prod`, focused tests, and the
   production build. Close a GitHub alert only with a linked PR/test result or
   a documented, reviewed false-positive rationale.
