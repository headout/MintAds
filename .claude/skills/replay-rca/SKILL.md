---
name: replay-rca
description: Root cause analysis for replay failures in the deterministic scraping extension. Diagnoses why a replay fails and produces generic, architecture-level fixes — not site-specific patches.
---

# Replay RCA — Root Cause Analysis

You are a diagnostic agent for the deterministic web scraping system. Your job is to find the exact root cause of a replay failure and produce a concrete fix.

---

## Core philosophy

### 1. Burn tokens, not iterations
Getting ground truth from the live page in one pass is always faster than multiple rounds of guessing from DB data alone. Run L1 (log triage) and L2 (DB) always, then run L3 (DevTools) for every failure class except a confirmed SESSION block.

### 2. Every fix must be generic — this is non-negotiable

**Before proposing any fix, apply the Generality Test:**

> "If we removed the site's domain name and all site-specific details from this fix, would it still make the replay engine better for all sites?"

| Fix type | Verdict | Action |
|---|---|---|
| Improves how the replayer handles a **class of elements** across all sites | Generic | ✅ Implement |
| Improves how the replayer handles a **browser/JS framework pattern** seen across sites | Generic | ✅ Implement |
| Improves how the replayer handles a **protection/auth pattern** (Cloudflare, sessions) | Generic | ✅ Implement |
| Targets a specific **CSS class, API endpoint, or DOM structure** of one site | Site-specific | ❌ Do not implement |
| Requires a special-case `if (url.includes('museodelprado'))` branch | Site-specific | ❌ Do not implement |

**The architecture must stay clean.** A site that can only be supported by a site-specific patch is a site we do not support — and that is an acceptable outcome. We do not trade architectural integrity for coverage.

### 3. Fixes compound across the entire site library
Every generic fix improves not just the failing site but:
- All sites already working (regression risk — flag it)
- All sites previously failed for the same reason (potential unblock — flag it)
- All sites not yet recorded

State this impact explicitly in the fix output. A fix that unblocks 3 previously-failed sites is worth more than one that only unblocks the current site.

### 4. Recognise when a site is out of scope
Some sites require deviations that cannot be made generic:
- Site-specific CAPTCHA solving flows
- Proprietary authentication that has no general pattern
- DOM structures that only work with hardcoded selectors

When this is the diagnosis, say so clearly: **"This site requires a site-specific workaround. Recommend marking out of scope."** Do not propose the workaround.

---

## What the user will provide

- **Replay progress log** — the extension's event stream (which actions ran, which failed, error metadata)
- **Site URL + flow instructions** — the exact step-by-step user flow
- **Credentials** (if needed)

The agent fetches everything else (DB data, live DOM, network requests) itself.

---

## Failure Taxonomy

| Class | Description | Skip DevTools? |
|---|---|---|
| **SESSION** | Cloudflare block, session expired, cookies wiped | Yes — page isn't served |
| **NAVIGATION** | Wrong page, intermediate redirect, URL mismatch | Only if confirmed at L1 |
| **SELECTOR** | Element not found — wrong selector or DOM changed | No |
| **INTERACTION** | Element found but action has no effect | No |
| **TIMING** | Element exists but async content not ready yet | No |
| **FRAME** | Action is inside an iframe, frame context wrong | No |
| **RECORDING GAP** | Missing action in recording | No |
| **EXTRACTION** | Replay succeeded but LLM got wrong/empty data | No — use Extraction branch |
| **OUT OF SCOPE** | Site requires a site-specific workaround with no general fix | Yes |

---

## Level 1 — Log Triage (no tools, always first)

Parse the replay progress log. Extract:

1. **Progress ratio** — `completed / total actions`
2. **Last successful action** — sequence number, action type
3. **First failed action** — sequence number, action type, selector level, error

| Pattern in log | Class | Confidence |
|---|---|---|
| 0/N, no actions started | SESSION | High |
| "Sorry, you have been blocked" | SESSION | High |
| NAVIGATION_WAIT timeout on action #1 | SESSION | High |
| `selector: NONE` on failed action | SELECTOR | High |
| Selector resolved, action had no effect | INTERACTION | Medium |
| Failed inside `frameSrc` | FRAME | Medium |
| 60s watchdog fired | TIMING or SESSION | Medium |
| NAVIGATE succeeded, next action fails | NAVIGATION | Medium |
| All actions completed, extraction empty/wrong | EXTRACTION | High |

**L1 Output:**
```
Progress ratio: N/M
Failure class: [CLASS]
Suspected root cause: [one sentence]
→ Proceed to: L2 (always) + L3 (unless SESSION confirmed)
```

---

## Level 2 — DB Investigation (Postgres MCP, always run)

Database runs on port 5433.

### Step 2a — Find the recording

```sql
SELECT r.id, r.phase, r.status, r.start_url, r.total_actions, r.created_at
FROM recordings r
JOIN workflows w ON w.id = r.workflow_id
WHERE w.sp_url ILIKE '%<site-domain>%'
ORDER BY r.created_at DESC
LIMIT 5;
```

### Step 2b — Pull ALL actions with selectors

Pull the complete list — not just neighbours. The full sequence is needed to spot recording gaps and understand flow context.

```sql
SELECT
  ra.sequence_number,
  ra.action_type,
  ra.wait_strategy,
  ra.wait_timeout_ms,
  ra.url_at_action,
  ra.frame_id,
  ra.frame_src,
  ra.value,
  es.primary_selector,
  es.css_path,
  es.aria_label,
  es.text_content,
  es.tag,
  es.element_id,
  es.data_testid,
  es.href,
  es.fingerprint
FROM recorded_actions ra
LEFT JOIN element_selectors es ON es.action_id = ra.id
WHERE ra.recording_id = '<recording_id>'
ORDER BY ra.sequence_number;
```

### Step 2c — Selector quality for the failed action

| Type | Stability |
|---|---|
| `element_id` set | High |
| `data_testid` set | High |
| `aria_label` specific | High |
| `primary_selector` ID-based | High |
| Class-based, stable name | Medium |
| `css_path` with `nth-of-type` / `nth-child` | Low — fragile |
| Dynamic suffix in class (e.g. `date-2489`) | Very Low — breaks every session |
| `text_content` only | Medium if unique |

### Step 2d — Wait strategy on the action BEFORE the failure

- `NONE` before dynamically-loaded content → TIMING
- `NAVIGATION_WAIT` but action is in iframe → FRAME
- `wait_timeout_ms` < 5000ms on a slow site → TIMING
- No SCROLL before a click that needs scroll-into-view → RECORDING GAP

### Step 2e — Map recording to the user's stated flow

Walk the full action list against the flow instructions. Check for:
- Missing steps (actions not recorded)
- Actions in wrong frame context (`frame_id`, `frame_src`)
- Missing login actions if login is required
- Missing SCROLL before out-of-viewport clicks

### Step 2f — Framework fingerprinting

Read CSS paths and class names across the recording to classify the site's JS framework. This determines which known generic patterns apply.

| Pattern in selectors | Framework |
|---|---|
| `#calendar`, `ui-datepicker`, `ui-state-active` | jQuery UI Datepicker |
| `rmdp-`, `rmdp-day`, `rmdp-week` | react-multi-date-picker (rmdp) |
| `data-radix-` | Radix UI |
| `flatpickr` | Flatpickr |
| `react-datepicker` | react-datepicker |
| `dp-`, `duet-` | Duet Date Picker |
| Magento `require()`, `mage/url` in inline scripts | Magento 2 |
| `cf_clearance` cookie in recording session | Cloudflare WAF |

**L2 Output:**
```
Recording ID: <id>  |  Total actions: N
Failed action: #N [type] targeting <tag>
  primary_selector: <value>
  aria_label: <value>
  wait_strategy before fail: <value>

Selector quality: High / Medium / Low / Fragile
Recording gap: Yes / No
Framework detected: [name]
Cloudflare present: Yes / No

Root cause (DB view): [explanation]
→ Proceeding to L3
```

---

## Level 3 — Live Page Investigation (DevTools MCP)

Run for every failure class except confirmed SESSION. This is where ground truth comes from.

### Step 3a — Navigate and set up

Follow the user's flow step by step up to the action BEFORE the failing one. Accept cookies, log in, dismiss overlays. Screenshot after each major step.

### Step 3b — Verify the failing element

```javascript
() => {
  const primarySel = '<primary_selector from DB>';
  const cssSel = '<css_path from DB>';
  const ariaLabel = '<aria_label from DB>';

  const inspect = (el) => !el ? { found: false } : {
    found: true,
    tag: el.tagName,
    id: el.id,
    className: el.className,
    ariaLabel: el.getAttribute('aria-label'),
    text: el.textContent?.trim().slice(0, 80),
    isVisible: el.offsetParent !== null,
    display: window.getComputedStyle(el).display,
    visibility: window.getComputedStyle(el).visibility,
    hasJQueryClickHandler: typeof jQuery !== 'undefined'
      ? !!(jQuery._data(el, 'events')?.click) : null,
    parentTag: el.parentElement?.tagName,
    parentClass: el.parentElement?.className,
    innerAnchor: el.querySelector('a')
      ? { text: el.querySelector('a').textContent?.trim(), href: el.querySelector('a').href }
      : null,
    children: Array.from(el.children).slice(0, 5)
      .map(c => ({ tag: c.tagName, cls: c.className, text: c.textContent?.trim().slice(0, 40) })),
  };

  return {
    byPrimary: inspect(document.querySelector(primarySel)),
    byCss: cssSel ? inspect(document.querySelector(cssSel)) : null,
    byAria: ariaLabel
      ? inspect(document.querySelector(`[aria-label="${ariaLabel}"]`)) : null,
  };
}
```

### Step 3c — Baseline network snapshot

Call `list_network_requests` (xhr + fetch) before triggering anything. This is the before-state.

### Step 3d — Trigger the action using the replayer's exact event sequence

```javascript
() => {
  const el = document.querySelector('<primary_selector>');
  if (!el) return { error: 'not found' };

  const rect = el.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const base = { bubbles: true, cancelable: true, clientX: cx, clientY: cy };

  el.dispatchEvent(new MouseEvent('mouseover', base));
  el.dispatchEvent(new MouseEvent('mouseenter', { ...base, bubbles: false }));
  el.dispatchEvent(new PointerEvent('pointerdown', { ...base, isPrimary: true }));
  el.dispatchEvent(new MouseEvent('mousedown', base));
  el.focus();
  el.dispatchEvent(new PointerEvent('pointerup', { ...base, isPrimary: true }));
  el.dispatchEvent(new MouseEvent('mouseup', base));
  el.dispatchEvent(new MouseEvent('click', { ...base, detail: 1 }));

  return { triggered: true, element: el.tagName + '#' + el.id + '.' + el.className };
}
```

### Step 3e — Observe DOM change after action (wait 2–3s)

```javascript
() => ({
  // Generic: what newly became visible?
  newlyVisible: Array.from(document.querySelectorAll('*'))
    .filter(el => el.offsetParent !== null && el.textContent?.trim().length > 5)
    .filter(el => ['SELECT', 'BUTTON', 'INPUT', 'UL', 'OL'].includes(el.tagName)
      || el.getAttribute('role') === 'listbox'
      || el.getAttribute('role') === 'option')
    .slice(0, 10)
    .map(el => ({ tag: el.tagName, cls: el.className, text: el.textContent?.trim().slice(0, 60) })),

  // Generic: any error state?
  errorText: document.querySelector('[role="alert"], .error, .alert')?.textContent?.trim(),

  // Generic: did any hidden→visible transition happen?
  hiddenToVisible: Array.from(document.querySelectorAll('[class*="hidden"],[style*="display"]'))
    .filter(el => el.offsetParent !== null)
    .slice(0, 5)
    .map(el => ({ cls: el.className, text: el.textContent?.trim().slice(0, 40) })),
})
```

### Step 3f — Capture network diff after action

Call `list_network_requests` again. The new requests since the baseline are the ones triggered by the action. For each relevant new request, call `get_network_request` with its `reqid` to get the full response body.

Focus on:
- URL pattern (what endpoint was called)
- Request body / query params
- HTTP status
- Response shape (what data structure came back)

### Step 3g — If click had no effect: test inner-element hypothesis

If the element is a container (`<td>`, `<div>`, `<li>`) and the click changed nothing, try clicking the interactive child directly:

```javascript
() => {
  const container = document.querySelector('<selector>');
  // Try: inner anchor, inner button, inner [role="option"]
  const inner = container?.querySelector('a, button, [role="option"], [tabindex="0"]');
  if (!inner) return { noInnerInteractive: true };
  inner.click();
  return { clickedInner: true, innerTag: inner.tagName, innerText: inner.textContent?.trim() };
}
```

If this works: the fix is generic — in `dispatchAction`, when the resolved element is a non-interactive container, descend to its first interactive child before dispatching.

**L3 Output:**
```
Element found (primary): Yes / No
Element found (css path): Yes / No
Element visible: Yes / No
jQuery handler bound: Yes / No / N/A
Inner interactive child: Yes ([tag]) / No

Action triggered → DOM changed: Yes / No
New visible elements: [list]
Network requests fired: [URL list with statuses]
Key response shape: [summary]

Root cause (live confirmed): [specific explanation]
```

---

## Generality Gate — Before Writing Any Fix

After L2 + L3 have identified the root cause, apply this gate before writing the fix:

### Step G1 — Name the pattern, not the site

Translate the root cause from site-specific language to framework/behaviour language:

| Site-specific (wrong framing) | Generic (correct framing) |
|---|---|
| "museodelprado's `cf_clearance` gets wiped" | "Cloudflare clearance cookies are wiped by browsingData.remove on any Cloudflare-protected site" |
| "museodelprado's jQuery UI `onSelect` doesn't fire" | "jQuery UI Datepicker only fires `onSelect` when a click lands on the inner `<a>`, not the `<td>` container" |
| "wait for `.museum-scheduling` to become visible" | "wait for any hidden section to become visible after an async API responds to a date selection" |
| "c2rio's rmdp ignores `detail:0` clicks" | "react-multi-date-picker ignores programmatic clicks with `detail:0`; requires `detail:1`" |

If you cannot translate the root cause into framework/behaviour language, the fix is site-specific and must not be implemented.

### Step G2 — Assess cross-site impact

Answer these three questions:

1. **How many other sites in our library use this same framework/pattern?** (Check Known Patterns table)
2. **Does this fix help sites that are already working?** (Regression risk — list them)
3. **Does this fix unblock sites that previously failed for this same reason?** (List them)

### Step G3 — Decide

| Outcome | Decision |
|---|---|
| Pattern is generic, fix improves the replayer for all sites with this pattern | ✅ Implement |
| Pattern is generic but fix has regression risk for working sites | ✅ Implement, with regression test note |
| Fix applies to only one site and cannot be expressed generically | ❌ Mark site out of scope |
| Site requires CAPTCHA solving, custom auth, or proprietary DOM hacks | ❌ Mark site out of scope |

---

## Fix Output Format

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RCA REPORT — [Site domain] — [Date]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FAILED ACTION:   #[N] [ACTION_TYPE] on <[tag]> "[element description]"
FAILURE CLASS:   [CLASS]
CONFIDENCE:      High / Medium

ROOT CAUSE:
  [2–3 sentences. Specific evidence from DB and DevTools.]

EVIDENCE:
  DB:   [recording data — selector, wait strategy, action sequence]
  Live: [DevTools observation — DOM state, network request, handler state]

─────────────────────────────────────────────
GENERALITY VERDICT
─────────────────────────────────────────────
Pattern name: [framework/behaviour pattern, not site name]
Generic: Yes / No

[If Yes:]
  Sites already using this framework/pattern: [list from Known Patterns]
  Sites this fix unblocks (previously failed): [list or None]
  Regression risk for working sites: [list or None]

[If No:]
  Reason: [why it cannot be made generic]
  Recommendation: Mark [site] as OUT OF SCOPE
  → STOP. Do not write implementation.

─────────────────────────────────────────────
FIX (only if Generality Verdict = Yes)
─────────────────────────────────────────────
Type: Code change / Re-record / Both

[Code change:]
  File: [path]
  Function: [name]
  Change: [before → after]
  Expressed as: "[Generic behaviour description — no site names]"

[Re-record:]
  Why: [what structural issue in the recording causes this]
  How to fix: [what to do differently — expressed generically]

SIDE EFFECTS TO VERIFY:
  [Flows or sites to re-test after this change]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Known Patterns Library

This is a **framework/behaviour pattern library**, not a site list. Each row describes a pattern that appears across multiple sites. When a new RCA confirms a pattern, add it here. When a fix is implemented, mark it Applied.

| Pattern | Frameworks / Sites that exhibit it | Root cause | Generic fix | Status |
|---|---|---|---|---|
| **Programmatic click ignored** | rmdp, some React components | `detail:0` on `MouseEvent` is treated as programmatic, not user-initiated | Dispatch `click` with `detail:1` | ✅ Applied |
| **Container click misses handler** | jQuery UI Datepicker (`<td>` → inner `<a>`), some custom list components | JS framework binds handler on inner interactive child, not container | In `dispatchAction`: if resolved element is non-interactive container with an interactive child (`a`, `button`, `[role]`), descend and click the child | 🔲 Pending |
| **Clearance cookie wiped on replay** | Any Cloudflare-protected site | `browsingData.remove({ cookies })` destroys `cf_clearance` → Cloudflare blocks next page load | Read + cache `cf_clearance` before clear; restore it after | 🔲 Pending |
| **Async content not awaited** | Magento 2, any site with multi-step AJAX chains on a trigger | Two or more AJAX calls fire sequentially after a click; DOM only updates after all complete | After a trigger click, wait for DOM mutation (any hidden section becoming visible) rather than fixed delay or element existence | 🔲 Pending |
| **Fragile CSS path selector** | Any site with dynamic class suffixes or nth-child paths | `css_path` breaks when DOM structure changes between sessions | Selector fallback order: ID → aria-label → text content → CSS path. Promote stable selectors during recording | 🔲 Ongoing |
| **Select populated async** | Any site where `<select>` options load after an API call | Region selector finds `<select>` immediately but `<option>` list is empty at capture time | In `sendLlmExtractRequest`: poll until `options.length > 0`, not just element existence | ✅ Applied |

---

## Escalation Flow

```
User: replay log + site URL + flow + credentials
                     │
                     ▼
            ┌────────────────┐
            │ L1 — Log triage│  (always, ~1 min)
            │ Progress ratio │
            │ Failure class  │
            └───────┬────────┘
                    │
        ┌───────────┴──────────────┐
        │                          │
   SESSION confirmed          Everything else
   (page not served)          (SELECTOR, INTERACTION,
        │                     TIMING, FRAME, GAP,
        ▼                     EXTRACTION, NAVIGATION)
   L2 (DB only)                    │
   Write SESSION fix.         ┌────┴─────────────────┐
   Done.                      │ L2 — DB (always run) │
                              │ Full action list      │
                              │ Selector quality      │
                              │ Framework fingerprint │
                              └────────┬─────────────┘
                                       │
                                       ▼
                              ┌─────────────────────┐
                              │ L3 — DevTools        │
                              │ Navigate site        │
                              │ Verify element in DOM│
                              │ Trigger action       │
                              │ Capture network diff │
                              │ Observe DOM change   │
                              └────────┬────────────┘
                                       │
                                       ▼
                              ┌─────────────────────┐
                              │ Generality Gate      │
                              │ Name the pattern     │
                              │ Generic? Yes / No    │
                              └────────┬────────────┘
                                       │
                         ┌─────────────┴──────────────┐
                         │                             │
                      Generic                    Not generic
                         │                             │
                   Write fix.                  Mark site OUT OF SCOPE.
                   Update patterns             Do not implement.
                   library.
                   Flag sites unblocked
                   + regression risk.
```
