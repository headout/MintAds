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

TASK: Generate a 30–40 second UGC-style video ad script from the catalog data provided.
Output: ONE raw JSON object. No markdown fences. No preamble. No trailing text. Just the JSON.

TONE: First-person creator voice. Casual, authentic, energetic — like a real traveller on their phone talking to camera. NOT corporate narration. NOT polished brand voice. Mimic how top travel creators on TikTok/Reels structure their content.

═══════════════════════════════════════════
SCENE STRUCTURE
═══════════════════════════════════════════
You decide the number of content scenes (4 or 5) based on what the experience needs.
Every ad ends with exactly one "cta" scene (end card — Remotion-rendered, NOT a fal.ai call).

Beat types and their constraints:
  "hook"    (4–6s)  — Scroll-stopping opener. EXACTLY ONE. Always scene_id 1.
  "body"    (6–10s) — Experience walkthrough. 2–3 body scenes per ad.
  "payoff"  (4–6s)  — Emotional peak or transformation. EXACTLY ONE. Last scene before cta.
  "cta"     (4s)    — End card. ALWAYS the final scene. photo_reference_indices MUST be []. NO vo_segment.

Valid ad structures:
  4 content scenes → hook + body + body + payoff + cta  (5 scenes total)
  5 content scenes → hook + body + body + body + payoff + cta  (6 scenes total)

Duration rules:
  • Each scene (excluding cta): 4–10 seconds
  • Sum of all scene durations INCLUDING cta: 30–40 seconds
  • Sum of non-cta scene durations: 26–36 seconds

═══════════════════════════════════════════
SHOT TYPES — assign one per scene
═══════════════════════════════════════════
  "ugc_creator"       — Creator is on camera. Two sub-modes controlled by "lip_sync" (see below).
  "b_roll"            — Cinematic experience footage. No creator visible. Venue, crowd, views, atmosphere.
  "pov"               — First-person perspective — what the creator sees. Shaky handheld. Creator's hands may appear.
  "experience_detail" — Close-up on one compelling detail: artwork, food, a ticket, a stunning vista close-up.

Assignment guidance:
  • Hook: strongly prefer "ugc_creator" with lip_sync: true — creator talking directly to camera grabs attention
  • Body scenes: NEVER use the same shot_type twice in a row. Mix b_roll, pov, experience_detail freely.
    One body scene CAN be "ugc_creator" (with lip_sync: false) for a natural creator reaction moment.
  • Payoff: prefer "ugc_creator" with lip_sync: true (creator closing to camera) or "b_roll" (cinematic reveal)
  • CTA: shot_type is irrelevant (Remotion end card) — set to "experience_detail" as a placeholder

Visual direction for each shot_type:
  "ugc_creator" (lip_sync: true)  → Creator speaks directly to camera. Describe: what they say, energy, gesture, framing. Mouth moves with VO.
  "ugc_creator" (lip_sync: false) → Creator visible but NOT speaking. Describe: natural reactions — awe, walking, looking around.
                                    Reactions must read as a real human having a genuine moment: a brief smile, a slow turn to take in the view,
                                    a quiet nod. NOT theatrical — no sustained exaggerated expressions, no frozen poses, no single emotion
                                    held for the entire clip. Direct the scene so the creator's body language evolves naturally over its duration.
  "b_roll"                        → Describe: what is being shown, camera movement (slow push, tracking, wide establishing), mood
  "pov"                           → Describe: what the camera (as creator's eyes) sees, movement, what is revealed
  "experience_detail"             → Describe: the specific detail, how it's framed (macro, tilt-up, reveal), lighting

═══════════════════════════════════════════
LIP SYNC — the lip_sync field
═══════════════════════════════════════════
Every scene MUST include "lip_sync": true or false.

Rules:
  lip_sync: true  — ONLY for shot_type "ugc_creator" scenes where the creator speaks directly to camera.
                    The audio engine will pass the VO segment audio to fal.ai so Seedance can drive
                    the creator's mouth movements. Visual direction MUST describe the creator talking.
  lip_sync: false — ALL other cases:
                    • shot_type is b_roll, pov, or experience_detail (no creator speaking)
                    • shot_type is ugc_creator but creator is reacting, walking, or looking around (not talking)
                    • cta scene (always false)

You decide when lip_sync is true. A ugc_creator scene where the creator is gesturing at a view
with no dialogue = lip_sync: false. A ugc_creator scene where the creator opens with "Okay so I just
got here and..." = lip_sync: true.

═══════════════════════════════════════════
PHOTO REFERENCES — photo_reference_indices
═══════════════════════════════════════════
photo_reference_indices is an ARRAY of 0-based indices into facts.photos[].
The video engine sends these photos to fal.ai as image references for that scene.
Multiple photos help the model generate richer, more context-aware video.

Rules per shot_type:
  "ugc_creator"       → 1–2 venue photo indices. The creator photo is automatically prepended as the first reference — do NOT add a creator photo index here. These are venue-only indices.
  "b_roll"            → 1–2 venue photo indices. Two complementary angles = richer generation.
  "pov"               → 1 venue photo index — the best single-angle shot of what the creator would see.
  "experience_detail" → 1 venue photo index — the most detail-rich or visually striking photo.
  "cta"               → MUST be []. Always.

Select photos by matching photo.keyword or photo.alt to the scene's purpose.
It is acceptable (and encouraged) to reuse the same photo index across scenes if one photo is the strongest reference for multiple scenes.

CRITICAL — Photo perspective for "ugc_creator" scenes:
The model places the creator INTO the photo's spatial context. An aerial or bird's-eye photo
makes the creator appear to float or fly in the air — a physically impossible result.

For "ugc_creator" scenes, ONLY select photos that are:
  ✓ Ground-level or eye-level shots
  ✓ Interior spaces, entrance areas, floor-level courtyards, visitor walkways
  ✓ Scenes where a human figure can plausibly stand on solid ground

For "ugc_creator" scenes, NEVER select photos that are:
  ✗ Aerial, bird's-eye, overhead, or drone shots
  ✗ Elevated panoramas where the ground is far below (rooftop views, cliff-top vistas)
  ✗ Photos whose keyword or alt text contains words like: "aerial", "panoramic from top",
    "overhead", "bird's eye", "from above", "drone", "bird eye", "view from", "roman forum and palatine hill" (that specific photo is aerial)

For "b_roll", "pov", and "experience_detail" scenes: ground-level, eye-level, and atmospheric shots are preferred.
Aerial, overhead, and drone photos are excluded for ALL shot types — Seedance produces unnatural camera motion
when given an aerial reference and the result looks AI-generated. If no good ground-level photo is available,
pick the closest alternative and describe the desired angle in the prompt instead.

═══════════════════════════════════════════
GLOBAL STYLE
═══════════════════════════════════════════
Each fal.ai call is a separate API call with no memory of the others. global_style is the only
mechanism ensuring visual coherence across all scenes. Be specific — vague descriptions produce inconsistent results.

creator_description:
  Describe the on-screen creator with enough specificity to reproduce the SAME person across all calls.
  Include: approximate age, apparent gender/presentation, specific clothing items and colours, accessories, energy level.
  Derive from the selected persona and the experience's location/cultural vibe.
  GOOD: "25-year-old solo female traveller, white linen shirt, slim-fit stone-wash jeans, small canvas daypack, warm Mediterranean tan, genuine excited energy"
  BAD:  "young traveller in casual clothes"

aesthetic:
  One sentence covering the shared visual style for ALL scenes. Include: camera style, lighting quality, colour temperature, mood.
  This string is prepended verbatim to every fal.ai scene prompt.
  GOOD: "UGC handheld 9:16, warm golden-hour Mediterranean light, slightly shaky authentic camera, cinematic grading"
  BAD:  "nice video"

background_music_volume:
  Array of floats (0.0–1.0), one value per non-cta scene IN SCENE ORDER.
  Length MUST equal the number of non-cta scenes (4 or 5).
  fal.ai generates silent clips (generate_audio: false for non-lip-sync scenes). Remotion layers background music
  over all clips and uses these values to control music volume per scene, ducking it under the ElevenLabs VO track.
  Rule of thumb: 0.15–0.25 for scenes with heavy VO (hook, body), 0.30–0.45 for payoff where music can breathe.
  Example for 4 content scenes: [0.2, 0.15, 0.2, 0.4]
  Example for 5 content scenes: [0.2, 0.15, 0.2, 0.2, 0.4]

═══════════════════════════════════════════
CLAIM TRACING (mandatory)
═══════════════════════════════════════════
- Every price, rating, review count, duration, or percentage on screen or in VO must come from facts.json
- Add to claim_sources ONLY numeric or measurable values: prices (€19.90), ratings (4.4★), review counts (26,773+), durations (90 min), percentages
- Do NOT add qualitative phrases ("skip the line", "walked straight in", "worth every cent") — those are creative copy, not traceable numeric claims
- claim_sources values must be ONLY the bare path — no annotations, no quotes, no extra text
  CORRECT: "€19.90" → "facts.price.display"
  CORRECT: "4.4★" → "facts.rating"
  CORRECT: "26,773+" → "facts.review_count"
  WRONG:   "skip the line" → "facts.has_skip_the_line"   ← qualitative phrase, not a number
  WRONG:   "timed entry" → "facts.inclusions[0]"          ← qualitative phrase, not a number
- Config-derived values (e.g. typical queue times) use: "known {value} (config)"
- Do NOT invent numbers. Do NOT round. Use exact values from facts.json.
- claim_sources MUST be non-empty — include at least the price and rating.

VO SEGMENTS:
- Write vo_segments for beats hook, body, payoff ONLY — NOT cta
- Sum of vo_segment target_duration_sec: 26–36s (covers all non-cta scenes)
- pause_after_sec: optional float — the natural pause after this segment before the next begins.
  Use 0.2–0.4s at beat boundaries (hook→body, body→payoff). Omit or set null for the last segment.
  The audio engine converts this to an SSML <break> tag for ElevenLabs.
- delivery_style: one sentence describing the voice energy and delivery across the whole ad.
  Example: "UGC creator — conversational, slight breathiness, natural pauses between thoughts."

═══════════════════════════════════════════
OUTPUT SCHEMA — output this exact structure
═══════════════════════════════════════════
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
      "creator_description": "specific creator description — age, presentation, exact clothing, accessories, energy",
      "aesthetic": "shared visual style sentence prepended to every fal.ai scene prompt",
      "background_music_volume": [0.2, 0.15, 0.2, 0.4]
    },
    "scenes": [
      {
        "scene_id": 1,
        "beat": "hook",
        "shot_type": "ugc_creator",
        "lip_sync": true,
        "duration_sec": 5,
        "visual_direction": "Detailed scene direction for fal.ai I2V. Describe subject, action, camera movement, framing. UGC handheld style.",
        "text_overlay": "string or null",
        "photo_reference_indices": [0]
      },
      {
        "scene_id": 2,
        "beat": "body",
        "shot_type": "b_roll",
        "lip_sync": false,
        "duration_sec": 9,
        "visual_direction": "...",
        "text_overlay": null,
        "photo_reference_indices": [1, 2]
      }
    ],
    "total_duration_sec": 35
  },
  "audio_script": {
    "vo_segments": [
      {
        "scene_id": 1,
        "beat": "hook",
        "vo_text": "Actual spoken VO text",
        "target_duration_sec": 5,
        "pacing": "fast, punchy",
        "pause_after_sec": 0.3
      }
    ],
    "tone": "energetic, conversational, UGC creator voice",
    "delivery_style": "UGC creator — conversational, not radio-announcer. Slight breathiness. Natural mid-sentence pauses.",
    "total_duration_target_sec": 31
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

const VALID_SHOT_TYPES = new Set(['ugc_creator', 'b_roll', 'pov', 'experience_detail']);

function validateStructural(script: ScriptJson, facts: FactsJson): string[] {
  const v: string[] = [];

  const scenes = script.video_script?.scenes;
  if (!Array.isArray(scenes) || scenes.length === 0) {
    v.push('video_script.scenes is empty or missing');
    return v; // can't continue without scenes
  }

  // Per-scene field checks
  for (const sc of scenes) {
    if (typeof sc.scene_id !== 'number') v.push('A scene is missing scene_id');
    if (!sc.beat) v.push(`Scene ${sc.scene_id} is missing beat`);
    if (typeof sc.duration_sec !== 'number' || sc.duration_sec <= 0)
      v.push(`Scene ${sc.scene_id} has invalid duration_sec`);
    if (sc.beat !== 'cta' && !sc.visual_direction)
      v.push(`Scene ${sc.scene_id} is missing visual_direction`);
    if (!sc.shot_type || !VALID_SHOT_TYPES.has(sc.shot_type))
      v.push(`Scene ${sc.scene_id} has invalid shot_type "${sc.shot_type}" — must be ugc_creator | b_roll | pov | experience_detail`);

    // lip_sync validation
    if (typeof sc.lip_sync !== 'boolean') {
      v.push(`Scene ${sc.scene_id} is missing lip_sync (must be true or false)`);
    } else if (sc.lip_sync === true && sc.beat === 'cta') {
      v.push(`Scene ${sc.scene_id} (cta): lip_sync must be false — the CTA is a Remotion end card, not a fal.ai clip`);
    } else if (sc.lip_sync === true && sc.shot_type !== 'ugc_creator') {
      v.push(`Scene ${sc.scene_id} has lip_sync: true but shot_type is "${sc.shot_type}" — lip_sync can only be true for ugc_creator scenes`);
    }

    // photo_reference_indices must be an array
    if (!Array.isArray(sc.photo_reference_indices)) {
      v.push(`Scene ${sc.scene_id}: photo_reference_indices must be an array`);
    } else if (sc.beat === 'cta' && sc.photo_reference_indices.length > 0) {
      v.push(`Scene ${sc.scene_id} (cta): photo_reference_indices must be [] for cta scenes`);
    } else {
      for (const idx of sc.photo_reference_indices) {
        if (typeof idx !== 'number' || idx < 0 || idx >= facts.photos.length)
          v.push(`Scene ${sc.scene_id}: photo_reference_indices[${idx}] is out of range (valid: 0–${facts.photos.length - 1})`);
      }
    }
  }

  // Beat composition
  const nonCtaScenes = scenes.filter(sc => sc.beat !== 'cta');
  const ctaScenes = scenes.filter(sc => sc.beat === 'cta');
  const hookScenes = scenes.filter(sc => sc.beat === 'hook');
  const payoffScenes = scenes.filter(sc => sc.beat === 'payoff');

  if (hookScenes.length !== 1) v.push(`Expected exactly 1 hook scene, got ${hookScenes.length}`);
  if (payoffScenes.length !== 1) v.push(`Expected exactly 1 payoff scene, got ${payoffScenes.length}`);
  if (ctaScenes.length !== 1) v.push(`Expected exactly 1 cta scene, got ${ctaScenes.length}`);

  if (nonCtaScenes.length < 4 || nonCtaScenes.length > 5)
    v.push(`Expected 4–5 non-cta content scenes, got ${nonCtaScenes.length}`);

  // Duration checks
  const totalVideo = scenes.reduce((s, sc) => s + (sc.duration_sec ?? 0), 0);
  if (totalVideo < 30 || totalVideo > 40)
    v.push(`Total video duration ${totalVideo}s is outside the 30–40s range`);

  const totalContent = nonCtaScenes.reduce((s, sc) => s + (sc.duration_sec ?? 0), 0);
  if (totalContent < 26 || totalContent > 36)
    v.push(`Non-cta scene total ${totalContent}s is outside the 26–36s range`);

  // VO segments
  const segs = script.audio_script?.vo_segments;
  if (!Array.isArray(segs) || segs.length === 0) {
    v.push('audio_script.vo_segments is empty or missing');
  } else {
    for (const seg of segs) {
      if (!seg.vo_text) v.push(`vo_segment for scene ${seg.scene_id} is missing vo_text`);
      if (typeof seg.target_duration_sec !== 'number' || seg.target_duration_sec <= 0)
        v.push(`vo_segment for scene ${seg.scene_id} has invalid target_duration_sec`);
    }

    const nonCtaSceneIds = new Set(nonCtaScenes.map(sc => sc.scene_id));
    for (const seg of segs) {
      if (!nonCtaSceneIds.has(seg.scene_id))
        v.push(`vo_segment references scene_id ${seg.scene_id} which has no matching non-cta scene`);
    }

    // Every lip_sync: true scene must have a matching vo_segment (audio engine needs it for fal.ai)
    const voSceneIds = new Set(segs.map(seg => seg.scene_id));
    for (const sc of nonCtaScenes) {
      if (sc.lip_sync === true && !voSceneIds.has(sc.scene_id))
        v.push(`Scene ${sc.scene_id} has lip_sync: true but no matching vo_segment — fal.ai has no audio to drive mouth movement`);
    }

    const totalVo = segs.reduce((s, seg) => s + (seg.target_duration_sec ?? 0), 0);
    if (totalVo < 26 || totalVo > 36)
      v.push(`Total VO duration ${totalVo}s is outside the 26–36s range`);

    // pause_after_sec must be a positive number if provided
    for (const seg of segs) {
      if (seg.pause_after_sec !== undefined && seg.pause_after_sec !== null) {
        if (typeof seg.pause_after_sec !== 'number' || seg.pause_after_sec <= 0 || seg.pause_after_sec > 2)
          v.push(`vo_segment scene ${seg.scene_id}: pause_after_sec must be a positive number ≤ 2`);
      }
    }
  }

  if (!script.audio_script?.delivery_style || script.audio_script.delivery_style.trim().length < 15)
    v.push('audio_script.delivery_style is missing or too vague (min 15 chars)');

  // End card
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
      const expectedLen = nonCtaScenes.length;
      if (gs.background_music_volume.length !== expectedLen)
        v.push(`global_style.background_music_volume must have ${expectedLen} values (one per non-cta scene), got ${gs.background_music_volume.length}`);
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

// Numeric/measurable claim: contains a digit (prices, ratings, counts, durations, %).
// Qualitative phrases (no digits) are creative copy — only verify the path exists, not the value.
function looksNumeric(claimText: string): boolean {
  return /\d/.test(claimText);
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

    // Only enforce value-match for numeric claims; qualitative phrases just need a valid path
    if (looksNumeric(claimText) && !claimMatchesValue(claimText, value)) {
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
    ...validateStructural(script, facts),
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
    const resp1 = await callClaude(systemPrompt, userMessage, 4096);
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
      const resp2 = await callClaude(systemPrompt, retryMessage, 4096);
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
