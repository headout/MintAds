import fs from 'fs/promises';
import path from 'path';
import { db } from './db';
import { callClaude } from './services/claude-client';
import type {
  FactsJson,
  UserInput,
  ScriptJson,
  ClaimReport,
  ClaimEntry,
  ScriptEngineResult,
  AngleDef,
  HookDef,
  GlobalStyle,
} from './types';

const DATA_RUNS_DIR = path.resolve(__dirname, '../../data/runs');
const COST_PER_1K_INPUT = 0.003;
const COST_PER_1K_OUTPUT = 0.015;

// ---------------------------------------------------------------------------
// Ad ID
// ---------------------------------------------------------------------------

export function generateAdId(facts: FactsJson, userInput: UserInput): string {
  const poi = facts.city
    .replace(/[^a-zA-Z0-9]+/g, '')
    .replace(/^(.)/, c => c.toUpperCase());
  const angle = userInput.angle.replace(/[^a-zA-Z0-9]/g, '');
  const hook = userInput.hook.replace(/[^a-zA-Z0-9_]/g, '');
  return `HDO_META_${poi}_${angle}_${hook}_UGC_EN_v01`;
}

// ---------------------------------------------------------------------------
// Prompt builders
// ---------------------------------------------------------------------------

function buildSystemPrompt(): string {
  return `You are a UGC ad scriptwriter for Headout, a travel experiences marketplace.

TASK: Generate a structured 15–25 second UGC-style video ad script from the catalog data provided.
Output: ONE raw JSON object. No markdown fences. No preamble. No trailing text. Just the JSON.

TONE: First-person creator voice. Casual, authentic, energetic — like a real traveller on their phone talking to camera. NOT corporate narration. NOT polished brand voice.

SCENE STRUCTURE (required):
- beat "hook" (2–4s): Scroll-stopping opener. Dramatize a problem, trigger FOMO, or pattern interrupt.
- beat "body" (6–10s): Creator walks through the experience. Use real facts to build value.
- beat "payoff" (4–6s): The reveal or transformation moment. Emotional peak.
- beat "cta" (3–5s): End card only. photo_reference_index MUST be null. No vo_segment for this beat.

CLAIM TRACING (mandatory — violating this breaks the pipeline):
- Every price, rating, review count, duration, or named feature on screen or in VO must come from facts.json
- Add EVERY factual claim to claim_sources as: "claim text as it appears" → "facts.field.path"
- claim_sources values must be ONLY the bare path — no annotations, no quotes, no extra text
  CORRECT: "€25.35" → "facts.price.display"
  CORRECT: "timed entry" → "facts.inclusions[0]"
  WRONG:   "timed entry" → "facts.inclusions[0] — 'Timed entry to the Colosseum'"
- Config-derived values (e.g. typical queue times) use: "known {value} (config)"
- Do NOT invent numbers. Do NOT round. Use exact values from facts.json.
- claim_sources MUST be non-empty.

PHOTO REFERENCE:
- photo_reference_index is 0-based into facts.photos[]
- Match the photo to the scene using photo.keyword or photo.alt
- For beat "cta" (end card), photo_reference_index MUST be null

VO SEGMENTS:
- Write vo_segments for beats hook, body, payoff only — NOT cta (end card has no VO)
- Sum of vo_segment target_duration_sec must be 12–22s
- Sum of all scene duration_sec must be 15–25s

GLOBAL STYLE (required — consumed by the video engine for ALL 3 Higgsfield calls):
Each Higgsfield scene is a separate API call with no memory of the others. global_style is the
only mechanism ensuring visual coherence across all segments. Be specific.

- creator_description: describe the on-screen creator with enough specificity to reproduce the
  SAME person across 3 independent calls. Include: approximate age, apparent gender, specific
  clothing items and colours, accessories, energy level. Derive from the persona and experience
  location/vibe.
  GOOD: "25-year-old solo female traveller, white linen shirt, slim-fit stone-wash jeans,
        small canvas daypack, warm Mediterranean tan, genuine excited energy"
  BAD:  "young traveller in casual clothes"

- aesthetic: one sentence covering the shared visual style for all scenes. Include: camera
  style, lighting quality and colour temperature, mood. This string is prepended verbatim to
  every Higgsfield prompt.
  GOOD: "UGC handheld 9:16, warm golden-hour Mediterranean light, slightly shaky camera,
        cinematic but authentic, continuous visual theme across all cuts"
  BAD:  "nice video"

- background_music_volume: array of floats (0.0–1.0), one entry per non-cta scene in order
  [hook, body, payoff]. Higgsfield bakes background music into each clip; Remotion uses these
  values to duck the clip audio under the ElevenLabs VO.
  Rule of thumb: 0.15–0.25 for hook/body (VO is dominant), 0.30–0.45 for payoff (music
  can breathe). Must have exactly 3 values.

OUTPUT SCHEMA (output this exact structure, nothing else):
{
  "ad_id": "HDO_META_{City}_{AngleId}_{HookId}_UGC_EN_v01",
  "metadata": {
    "experience_id": "string",
    "persona": "string",
    "journey_type": "string",
    "brand": "string",
    "angle": "string",
    "hook": "string",
    "video_format": "string"
  },
  "video_script": {
    "global_style": {
      "creator_description": "specific creator description — age, gender, exact clothing, accessories, energy",
      "aesthetic": "shared visual style sentence for all Higgsfield calls",
      "background_music_volume": [0.2, 0.2, 0.4]
    },
    "scenes": [
      {
        "scene_id": 1,
        "beat": "hook",
        "duration_sec": 3,
        "visual_direction": "Detailed Higgsfield I2V direction. UGC handheld style. Include creator action and camera movement.",
        "text_overlay": "string or null",
        "photo_reference_index": 0
      }
    ],
    "total_duration_sec": 20
  },
  "audio_script": {
    "vo_segments": [
      {
        "scene_id": 1,
        "beat": "hook",
        "vo_text": "Actual spoken VO text",
        "target_duration_sec": 3,
        "pacing": "fast, punchy"
      }
    ],
    "tone": "energetic, conversational, UGC creator voice",
    "total_duration_target_sec": 16
  },
  "end_card": {
    "price_display": "string",
    "rating_display": "string",
    "review_count_display": "string",
    "cta_text": "string",
    "brand_logo": true,
    "cancellation_text": "string"
  },
  "claim_sources": {
    "claim text as it appears on screen or in VO": "facts.field.path or config annotation"
  }
}`;
}

function buildUserMessage(
  facts: FactsJson,
  userInput: UserInput,
  angleDef: AngleDef,
  hookDef: HookDef,
): string {
  const personaDescriptions: Record<string, string> = {
    solo: 'Solo Traveller — personal discovery, "I" language, independent explorer energy',
    couple: 'Couple — shared romantic moments, "we" language, adventurous or intimate',
    art_enthusiast: 'Art Enthusiast — aesthetic depth, artistic appreciation, visual beauty',
    cultural: 'Cultural Traveller — historical significance, authentic local perspective',
    family: 'Family — safety, ease, kid-friendly framing, value for money',
    budget: 'Budget Traveller — smart spending, value framing, cost-per-memory',
  };

  const journeyDescriptions: Record<string, string> = {
    pre_trip: 'Pre-Trip (aspirational/dreamy — viewer is planning, not yet there)',
    in_trip: 'In-Trip (urgent/actionable — viewer is currently in the city)',
  };

  const brandDescriptions: Record<string, string> = {
    headout: 'Headout-branded — "Book on Headout" CTA, platform is the hero',
    non_headout: 'Experience-led — generic CTA, experience is the hero, brand stays background',
  };

  const lines = [
    'EXPERIENCE DATA (facts.json):',
    JSON.stringify(facts, null, 2),
    '',
    'USER INPUTS:',
    `- Persona: ${personaDescriptions[userInput.persona] ?? userInput.persona}`,
    `- Journey Type: ${journeyDescriptions[userInput.journey_type] ?? userInput.journey_type}`,
    `- Brand Mode: ${brandDescriptions[userInput.brand] ?? userInput.brand}`,
    `- Angle: ${angleDef.id} — ${angleDef.name}: ${angleDef.description}`,
    ...(angleDef.example_line ? [`  Example line: "${angleDef.example_line}"`] : []),
    `- Hook: ${hookDef.id} — ${hookDef.name}: ${hookDef.description}`,
    `  Hook template: "${hookDef.template}"`,
    `- Video Format: ${userInput.video_format}`,
    ...(userInput.additional_details ? [`\nAdditional creative direction: ${userInput.additional_details}`] : []),
    '',
    'Generate the ad script JSON now.',
  ];

  return lines.join('\n');
}

function buildRetryMessage(originalUserMessage: string, violations: string[]): string {
  return (
    originalUserMessage +
    '\n\n---\nCORRECTION REQUIRED: Your previous response had these validation violations:\n' +
    violations.map(v => `• ${v}`).join('\n') +
    '\n\nRegenerate the complete script fixing ALL violations. Every factual claim must strictly trace to facts.json.'
  );
}

function parseScriptJson(text: string): ScriptJson {
  const cleaned = text
    .replace(/^```(?:json)?\s*/m, '')
    .replace(/\s*```\s*$/m, '')
    .trim();
  try {
    return JSON.parse(cleaned) as ScriptJson;
  } catch (err) {
    throw new Error(
      `Failed to parse script JSON: ${(err as Error).message}\nRaw response (first 300 chars): ${text.slice(0, 300)}`,
    );
  }
}

// ---------------------------------------------------------------------------
// Validator
// ---------------------------------------------------------------------------

function resolvePath(obj: unknown, dotPath: string): { found: boolean; value: unknown } {
  // Normalise: strip leading "facts.", then expand bracket notation
  // "highlights[1]" → ["highlights", 1]   "price.display" → ["price", "display"]
  const segments = dotPath.replace(/^facts\./, '').split('.');
  const parts: Array<string | number> = [];
  for (const seg of segments) {
    const m = seg.match(/^([^\[]+)(?:\[(\d+)\])?$/);
    if (!m) { parts.push(seg); continue; }
    parts.push(m[1]);
    if (m[2] !== undefined) parts.push(parseInt(m[2], 10));
  }

  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || current === undefined) return { found: false, value: undefined };
    if (Array.isArray(current)) {
      if (typeof part !== 'number') return { found: false, value: undefined };
      current = current[part];
    } else if (typeof current === 'object') {
      current = (current as Record<string, unknown>)[String(part)];
    } else {
      return { found: false, value: undefined };
    }
  }
  return { found: current !== undefined, value: current };
}

function claimMatchesValue(claimText: string, factsValue: unknown): boolean {
  if (factsValue === null || factsValue === undefined) return false;
  if (Array.isArray(factsValue)) return true; // existence check only for arrays
  if (typeof factsValue === 'boolean') return true; // boolean: existence check only

  const norm = (s: string) => s.toLowerCase().replace(/[€$£,★*+]/g, '');
  const claimNorm = norm(claimText);
  const valueStr = norm(String(factsValue));

  // Direct substring match
  if (claimNorm.includes(valueStr) || valueStr.includes(claimNorm)) return true;

  // Word-overlap fallback: at least one significant word (>3 chars) from claim in value
  const significantWords = claimNorm.split(/\s+/).filter(w => w.length > 3);
  return significantWords.some(w => valueStr.includes(w));
}

function validateStructural(script: ScriptJson): string[] {
  const v: string[] = [];

  const scenes = script.video_script?.scenes;
  if (!Array.isArray(scenes) || scenes.length === 0) {
    v.push('video_script.scenes is empty or missing');
  } else {
    for (const sc of scenes) {
      if (typeof sc.scene_id !== 'number') v.push('A scene is missing scene_id');
      if (!sc.beat) v.push(`Scene ${sc.scene_id} is missing beat`);
      if (typeof sc.duration_sec !== 'number' || sc.duration_sec <= 0)
        v.push(`Scene ${sc.scene_id} has invalid duration_sec`);
      if (!sc.visual_direction) v.push(`Scene ${sc.scene_id} is missing visual_direction`);
    }

    const totalVideo = scenes.reduce((s, sc) => s + (sc.duration_sec ?? 0), 0);
    if (totalVideo < 15 || totalVideo > 30)
      v.push(`Total video duration ${totalVideo}s is outside the 15–30s range`);
  }

  const segs = script.audio_script?.vo_segments;
  if (!Array.isArray(segs) || segs.length === 0) {
    v.push('audio_script.vo_segments is empty or missing');
  } else {
    for (const seg of segs) {
      if (!seg.vo_text) v.push(`vo_segment for scene ${seg.scene_id} is missing vo_text`);
      if (typeof seg.target_duration_sec !== 'number' || seg.target_duration_sec <= 0)
        v.push(`vo_segment for scene ${seg.scene_id} has invalid target_duration_sec`);
    }

    const nonCtaSceneIds = new Set(
      (scenes ?? []).filter(sc => sc.beat !== 'cta').map(sc => sc.scene_id),
    );
    for (const seg of segs) {
      if (!nonCtaSceneIds.has(seg.scene_id))
        v.push(`vo_segment references scene_id ${seg.scene_id} which has no matching non-cta scene`);
    }

    const totalVo = segs.reduce((s, seg) => s + (seg.target_duration_sec ?? 0), 0);
    if (totalVo < 12 || totalVo > 28)
      v.push(`Total VO duration ${totalVo}s is outside the 12–28s range`);
  }

  const ec = script.end_card;
  if (!ec?.price_display) v.push('end_card.price_display is missing');
  if (!ec?.rating_display) v.push('end_card.rating_display is missing');
  if (!ec?.cta_text) v.push('end_card.cta_text is missing');

  if (!script.ad_id) {
    v.push('ad_id is missing');
  } else if (!/^HDO_/.test(script.ad_id)) {
    v.push(`ad_id "${script.ad_id}" does not follow the HDO_ naming convention`);
  }

  if (!script.claim_sources || Object.keys(script.claim_sources).length === 0)
    v.push('claim_sources is empty or missing');

  // global_style
  const gs = script.video_script?.global_style as GlobalStyle | undefined;
  if (!gs) {
    v.push('video_script.global_style is missing');
  } else {
    if (!gs.creator_description || gs.creator_description.trim().length < 20)
      v.push('global_style.creator_description is missing or too vague (min 20 chars)');
    if (!gs.aesthetic || gs.aesthetic.trim().length < 10)
      v.push('global_style.aesthetic is missing or too vague (min 10 chars)');
    if (!Array.isArray(gs.background_music_volume)) {
      v.push('global_style.background_music_volume must be an array');
    } else {
      if (gs.background_music_volume.length !== 3)
        v.push(`global_style.background_music_volume must have exactly 3 values (hook, body, payoff), got ${gs.background_music_volume.length}`);
      for (const val of gs.background_music_volume) {
        if (typeof val !== 'number' || val < 0 || val > 1)
          v.push(`global_style.background_music_volume contains invalid value "${val}" — must be 0.0–1.0`);
      }
    }
  }

  return v;
}

function extractFactsPath(sourceField: string): string | null {
  // Claude sometimes annotates paths: "facts.highlights[1] — 'full quote'" or "facts.x — false"
  // Extract just the path portion before any whitespace or annotation markers
  const m = sourceField.match(/^(facts\.[^\s—–(]+)/);
  return m ? m[1] : null;
}

function validateClaimCompleteness(script: ScriptJson, facts: FactsJson): string[] {
  const v: string[] = [];

  for (const [claimText, sourceField] of Object.entries(script.claim_sources ?? {})) {
    if (!sourceField.startsWith('facts.')) continue; // config/known values — skip

    const cleanPath = extractFactsPath(sourceField);
    if (!cleanPath) {
      v.push(`Claim "${claimText}" has unparseable source field "${sourceField}"`);
      continue;
    }

    const { found, value } = resolvePath(facts, cleanPath);
    if (!found) {
      v.push(`Claim "${claimText}" references non-existent field "${cleanPath}"`);
      continue;
    }

    if (!claimMatchesValue(claimText, value)) {
      v.push(
        `Claim "${claimText}" references "${cleanPath}" (facts value: "${String(value)}") — values don't match`,
      );
    }
  }

  return v;
}

function extractFactualValues(text: string): string[] {
  const patterns = [
    /[€$£][0-9][0-9,]*(?:\.[0-9]+)?/g,          // currency: €25.35 not €25.35.
    /[0-9][0-9,]*(?:\.[0-9]+)?\s*(?:EUR|USD|GBP|AED)/g,
    /[0-9]+\.[0-9]+\s*[★*]/g,                    // ratings: 4.4★
    /[0-9]+\.[0-9]+\s*\/\s*5/g,                  // ratings: 4.4/5
    /[0-9][0-9,]*\s*\+?\s*(?:reviews?|travellers?|visitors?)/gi,
    /[0-9]+(?:[–\-][0-9]+)?\s*hours?/g,
    /[0-9]+\s*min(?:utes?)?/g,
    /[0-9]+%/g,                                   // percentages
  ];
  const found: string[] = [];
  for (const p of patterns) {
    const matches = text.match(p);
    if (matches) found.push(...matches);
  }
  return [...new Set(found)];
}

function validateOrphans(script: ScriptJson): string[] {
  const v: string[] = [];
  const claimKeys = Object.keys(script.claim_sources ?? {});
  const claimValues = Object.values(script.claim_sources ?? {});

  const textSources: Array<[string, string]> = [];

  for (const sc of script.video_script?.scenes ?? []) {
    if (sc.text_overlay) textSources.push([sc.text_overlay, `scene ${sc.scene_id} text_overlay`]);
  }
  for (const seg of script.audio_script?.vo_segments ?? []) {
    if (seg.vo_text) textSources.push([seg.vo_text, `vo_segment scene ${seg.scene_id}`]);
  }
  const ec = script.end_card;
  if (ec) {
    for (const [field, label] of [
      [ec.price_display, 'end_card.price_display'],
      [ec.rating_display, 'end_card.rating_display'],
      [ec.review_count_display, 'end_card.review_count_display'],
      [ec.cancellation_text, 'end_card.cancellation_text'],
    ] as Array<[string, string]>) {
      if (field) textSources.push([field, label]);
    }
  }

  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();

  for (const [text, location] of textSources) {
    for (const extracted of extractFactualValues(text)) {
      const extractedNorm = norm(extracted);
      const covered =
        claimKeys.some(k => norm(k).includes(extractedNorm) || extractedNorm.includes(norm(k))) ||
        claimValues.some(val => norm(val).includes(extractedNorm));
      if (!covered) {
        v.push(`Unclaimed factual assertion "${extracted}" found in ${location}`);
      }
    }
  }

  return v;
}

function runValidator(script: ScriptJson, facts: FactsJson): string[] {
  return [
    ...validateStructural(script),
    ...validateClaimCompleteness(script, facts),
    ...validateOrphans(script),
  ];
}

// ---------------------------------------------------------------------------
// Claim report
// ---------------------------------------------------------------------------

function buildClaimReport(script: ScriptJson, facts: FactsJson): ClaimReport {
  const claims: ClaimEntry[] = [];

  const textSources: Array<[string, string]> = [];
  for (const sc of script.video_script?.scenes ?? []) {
    if (sc.text_overlay) textSources.push([sc.text_overlay, `scene_${sc.scene_id}_text_overlay`]);
  }
  for (const seg of script.audio_script?.vo_segments ?? []) {
    if (seg.vo_text) textSources.push([seg.vo_text, `vo_segment_scene_${seg.scene_id}`]);
  }
  const ec = script.end_card;
  if (ec) {
    const ecText = [
      ec.price_display,
      ec.rating_display,
      ec.review_count_display,
      ec.cta_text,
      ec.cancellation_text,
    ]
      .filter(Boolean)
      .join(' ');
    if (ecText) textSources.push([ecText, 'end_card']);
  }

  for (const [claimText, sourceField] of Object.entries(script.claim_sources ?? {})) {
    const appearsIn = textSources
      .filter(([text]) => text.includes(claimText))
      .map(([, label]) => label);

    let sourceValue = sourceField;
    let verified = false;

    if (sourceField.startsWith('facts.')) {
      const cleanPath = extractFactsPath(sourceField) ?? sourceField;
      const { found, value } = resolvePath(facts, cleanPath);
      sourceValue = found ? String(value) : '(field not found)';
      verified = found && claimMatchesValue(claimText, value);
    } else {
      // config/known value — mark as verified
      verified = true;
    }

    claims.push({ claim_text: claimText, appears_in: appearsIn, source_field: sourceField, source_value: sourceValue, verified });
  }

  const verified_claims = claims.filter(c => c.verified).length;
  return {
    ad_id: script.ad_id,
    claims,
    total_claims: claims.length,
    verified_claims,
    unverified_claims: claims.length - verified_claims,
  };
}

// ---------------------------------------------------------------------------
// Cost
// ---------------------------------------------------------------------------

function computeCostUsd(inputTokens: number, outputTokens: number): number {
  return (inputTokens / 1000) * COST_PER_1K_INPUT + (outputTokens / 1000) * COST_PER_1K_OUTPUT;
}

// ---------------------------------------------------------------------------
// Stage log helpers (mirrors headout-client pattern)
// ---------------------------------------------------------------------------

async function openStageLog(
  runId: number,
  adId: string,
  stage: string,
  service: string,
  params?: object,
): Promise<number> {
  const result = await db.query(
    `INSERT INTO stage_logs (run_id, ad_id, stage, status, service, model, cost_usd, params)
     VALUES ($1, $2, $3, 'in_progress', $4, 'claude-sonnet-4-6', 0, $5)
     RETURNING id`,
    [runId, adId, stage, service, JSON.stringify(params ?? {})],
  );
  if (!result.rows.length) throw new Error('openStageLog: INSERT returned no rows');
  return result.rows[0].id as number;
}

async function closeStageLog(
  logId: number,
  durationMs: number,
  costUsd: number,
  result: object,
): Promise<void> {
  await db.query(
    `UPDATE stage_logs
     SET status = 'completed', completed_at = NOW(), duration_ms = $1, cost_usd = $2, result = $3
     WHERE id = $4`,
    [durationMs, costUsd, JSON.stringify(result), logId],
  );
}

async function failStageLog(logId: number, durationMs: number, error: string): Promise<void> {
  await db.query(
    `UPDATE stage_logs
     SET status = 'failed', completed_at = NOW(), duration_ms = $1, result = $2
     WHERE id = $3`,
    [durationMs, JSON.stringify({ error }), logId],
  );
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function generateScript(
  facts: FactsJson,
  userInput: UserInput,
  angleDef: AngleDef,
  hookDef: HookDef,
  runId: number,
  adId: string,
): Promise<ScriptEngineResult> {
  const systemPrompt = buildSystemPrompt();
  const userMessage = buildUserMessage(facts, userInput, angleDef, hookDef);

  // --- Attempt 1 ---
  const logId1 = await openStageLog(runId, adId, 'script_gen', 'claude', { attempt: 1 });
  const t1 = Date.now();
  let script: ScriptJson;
  let totalInputTokens: number;
  let totalOutputTokens: number;

  try {
    const resp1 = await callClaude(systemPrompt, userMessage);
    totalInputTokens = resp1.input_tokens;
    totalOutputTokens = resp1.output_tokens;
    const cost1 = computeCostUsd(resp1.input_tokens, resp1.output_tokens);
    await closeStageLog(logId1, Date.now() - t1, cost1, {
      input_tokens: resp1.input_tokens,
      output_tokens: resp1.output_tokens,
      attempt: 1,
    });
    script = parseScriptJson(resp1.text);
  } catch (err) {
    await failStageLog(logId1, Date.now() - t1, (err as Error).message).catch(() => {});
    throw err;
  }

  // --- Validation (first pass) ---
  const valLogId1 = await openStageLog(runId, adId, 'script_validation', 'validator', { attempt: 1 });
  const tv1 = Date.now();
  let violations = runValidator(script, facts);

  if (violations.length > 0) {
    await closeStageLog(valLogId1, Date.now() - tv1, 0, { violations, passed: false, attempt: 1 });

    // --- Attempt 2 (retry with violations) ---
    const retryMessage = buildRetryMessage(userMessage, violations);
    const logId2 = await openStageLog(runId, adId, 'script_gen', 'claude', { attempt: 2, violations });
    const t2 = Date.now();

    try {
      const resp2 = await callClaude(systemPrompt, retryMessage);
      totalInputTokens += resp2.input_tokens;
      totalOutputTokens += resp2.output_tokens;
      const cost2 = computeCostUsd(resp2.input_tokens, resp2.output_tokens);
      await closeStageLog(logId2, Date.now() - t2, cost2, {
        input_tokens: resp2.input_tokens,
        output_tokens: resp2.output_tokens,
        attempt: 2,
      });
      script = parseScriptJson(resp2.text);
    } catch (err) {
      await failStageLog(logId2, Date.now() - t2, (err as Error).message).catch(() => {});
      throw err;
    }

    // --- Validation (second pass) ---
    const valLogId2 = await openStageLog(runId, adId, 'script_validation', 'validator', { attempt: 2 });
    const tv2 = Date.now();
    violations = runValidator(script, facts);

    if (violations.length > 0) {
      await failStageLog(valLogId2, Date.now() - tv2, violations.join('; ')).catch(() => {});
      throw new Error(
        `Script validation failed after retry:\n${violations.map(v => `• ${v}`).join('\n')}`,
      );
    }

    await closeStageLog(valLogId2, Date.now() - tv2, 0, { passed: true, attempt: 2 });
  } else {
    await closeStageLog(valLogId1, Date.now() - tv1, 0, { passed: true, attempt: 1 });
  }

  // --- Build claim report ---
  const claimReport = buildClaimReport(script, facts);

  // --- Persist ---
  const runDir = path.join(DATA_RUNS_DIR, adId);
  await fs.mkdir(runDir, { recursive: true });
  await fs.writeFile(path.join(runDir, 'script.json'), JSON.stringify(script, null, 2));
  await fs.writeFile(path.join(runDir, 'claim_report.json'), JSON.stringify(claimReport, null, 2));

  await db.query(
    'UPDATE runs SET script = $1, claim_report = $2 WHERE id = $3',
    [JSON.stringify(script), JSON.stringify(claimReport), runId],
  );

  // Update total cost
  const totalCost = computeCostUsd(totalInputTokens, totalOutputTokens);
  await db.query(
    'UPDATE runs SET total_cost_usd = total_cost_usd + $1 WHERE id = $2',
    [totalCost, runId],
  );

  return { script, claim_report: claimReport };
}
