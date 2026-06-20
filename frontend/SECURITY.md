# Security — dependency advisories

This file records reviewed dependency vulnerabilities and the decisions taken,
so scanner findings on the frontend toolchain have a documented rationale.

Last reviewed: **2026-06-20** · `vite@5.4.21`, `vitest@2.1.9`

## Threat-model context

All findings below are in **dev/test-only `devDependencies`**. `vite` and
`vitest` are build/test tooling — they are **not shipped in the production
bundle** (the deploy artifact is static HTML/JS/CSS). Deployed-app users have
zero exposure to any of these.

The Vite dev server is **localhost-only**: `vite.config.ts` sets no `host` and
`"dev": "vite"` passes no `--host`. The network-exposure precondition behind
nearly every advisory below is therefore not met.

---

## vite — 15 advisories: ALL already patched in 5.4.21 (no action)

A scanner flagged 15 Vite GHSA advisories. We are on `vite@5.4.21`, the latest
5.x patch. Every one is either already fixed at ≤5.4.21 or never affected 5.x:

| Advisory | 5.x patched in |
|---|---|
| GHSA-64vr-g452-qvp3 (CVE-2024-45812) | 5.4.6 |
| GHSA-9cwx-2883-4wfx (CVE-2024-45811) | 5.4.6 |
| GHSA-c27g-q93r-2cwf (CVE-2024-52011) | 5.4.9 |
| GHSA-vg6x-rcgg-rjx6 (CVE-2025-24010) | 5.4.12 |
| GHSA-x574-m823-4x7w (CVE-2025-30208) | 5.4.15 |
| GHSA-4r4m-qw57-chr8 (CVE-2025-31125) | 5.4.16 |
| GHSA-xcj6-pq6g-qj4x (CVE-2025-31486) | 5.4.17 |
| GHSA-356w-63v5-8wf4 (CVE-2025-32395) | 5.4.18 |
| GHSA-859w-5945-r5v3 (CVE-2025-46565) | 5.4.19 |
| GHSA-g4jq-h2w9-997c (CVE-2025-58751) | 5.4.20 |
| GHSA-jqfw-vq24-v9c3 (CVE-2025-58752) | 5.4.20 |
| GHSA-93m4-6634-74q7 (CVE-2025-62522) | 5.4.21 |
| GHSA-4w7w-66w2-5vf9 | 5.x not affected (6.4/7/8 only) |
| GHSA-fx2h-pf6j-xcff (CVE-2026-53571) | 5.x not affected (6.4/7/8 only) |
| GHSA-v6wh-96g9-6wx3 | 5.x not affected (6.4/7/8 only) |

**Decision: no action.** These are false positives against our installed version.

## esbuild GHSA-67mh-4wv8-2f99 — accepted (dev-only, localhost)

Transitive via `vite` 5.x (bundles esbuild ≤0.24.2). A website can send requests
to a running dev server and read responses. Moderate; dev-server only.

**Decision: accept.** Dev-only dependency, dev server bound to localhost,
internal demo tool. Fix requires a breaking major bump to vite 6+/8+.

## vitest GHSA-5xrq-8626-4rwp (CVE-2026-47429) — accepted (UI server unused)

`vitest@2.1.9` is within the affected range (`< 3.2.6`). The vulnerability is in
the **Vitest UI server** (arbitrary file read/exec when the UI API is reachable).
This project does **not** use it: `@vitest/ui` is not installed and no script
runs `vitest --ui` (`test` = `vitest run`, `test:watch` = `vitest`). The
vulnerable UI server is never started, so the attack surface does not exist here.

**Decision: accept.** Test-only dependency, vulnerable feature unused/uninstalled.

---

## Clearing the audit later (optional, not security-urgent)

To get a green `npm audit`, bump the toolchain in one coordinated change:
`vite@^7`, `vitest@^3.2.6`, and `@vitejs/plugin-react@^5`. This clears the
esbuild and vitest advisories. It is a breaking major upgrade, so treat it as a
maintenance task rather than a security fix — none of the above is exploitable
in this project's deployment.
