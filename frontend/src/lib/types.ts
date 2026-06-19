// Shapes mirror the Chunk 7 REST API (verified against backend/src/routes/*).

export type JourneyType = 'pre_trip' | 'in_trip';
export type Brand = 'headout' | 'non_headout';
export type VideoFormat = '9:16' | '1:1' | '16:9' | 'all';

/** Run-level lifecycle, written by the orchestrator. */
export type RunStatus =
  | 'pending'
  | 'ingesting'
  | 'scripting'
  | 'generating'
  | 'assembling'
  | 'exporting'
  | 'completed'
  | 'failed';

/** Per-stage status in stage_logs. */
export type StageStatus = 'pending' | 'in_progress' | 'completed' | 'failed';

// --- Config (dropdowns) ---

export interface Angle {
  id: string;
  name: string;
  description: string;
  example_line: string;
  sub_format: string | null;
  journey: string | null;
  brand_lean: string | null;
}

export interface Hook {
  id: string;
  name: string;
  template: string;
  description: string;
}

export interface Persona {
  id: string;
  name: string;
  description: string;
}

/** Recommended vs. merely-works groupings for dependent dropdowns. */
export interface RecommendationGroup {
  recommended: string[];
  works: string[];
}
export type AngleHookMap = Record<string, RecommendationGroup>;
export type PersonaAngleMap = Record<string, RecommendationGroup>;

// --- Generate ---

export interface GenerateInput {
  experience_id: string;
  persona: string;
  journey_type: JourneyType;
  brand: Brand;
  angle: string;
  hook: string;
  video_format: VideoFormat;
  additional_details?: string;
}

export interface GenerateResponse {
  ad_id: string;
  run_id: number;
}

// --- Status ---

export interface StageLog {
  stage: string;
  status: StageStatus;
  service: string | null;
  cost_usd: number;
  duration_ms: number | null;
  started_at: string | null;
  completed_at: string | null;
}

export interface StatusResponse {
  ad_id: string;
  run_id: number;
  status: RunStatus;
  current_stage: string | null;
  total_cost_usd: number;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
  stages: StageLog[];
}

// --- Output ---

export interface VideoAsset {
  format: string; // "9:16" | "1:1" | "16:9"
  url: string; // already absolute path under /data — use verbatim
  duration_sec: number;
  file_size: number;
}

export interface CostStage {
  stage: string;
  service: string | null;
  model: string | null;
  cost_usd: number;
}

export interface CostBreakdown {
  total: number;
  by_service: Record<string, number>;
  by_stage: CostStage[];
}

export interface ClaimEntry {
  claim_text: string;
  appears_in?: string[];
  source_field?: string | null;
  source_value?: string | null;
  verified: boolean;
}

export interface ClaimReport {
  ad_id?: string;
  claims: ClaimEntry[];
  total_claims?: number;
  verified_claims?: number;
  unverified_claims?: number;
}

/** Only the fields the Output page reads; the API returns more. */
export interface OutputScript {
  ad_id?: string;
  metadata?: {
    experience_id?: string;
    persona?: string;
    journey_type?: string;
    brand?: string;
    angle?: string;
    hook?: string;
    video_format?: string;
  };
  end_card?: {
    price_display?: string;
    rating_display?: string;
    review_count_display?: string;
    cta_text?: string;
    cancellation_text?: string;
  };
  [key: string]: unknown;
}

export interface OutputFacts {
  title?: string;
  city?: string;
  country?: string;
  [key: string]: unknown;
}

export interface OutputResponse {
  ad_id: string;
  run_id: number;
  experience_id: string;
  status: RunStatus;
  completed_at: string | null;
  videos: VideoAsset[];
  cost_breakdown: CostBreakdown;
  claim_report: ClaimReport | null;
  script: OutputScript | null;
  facts: OutputFacts | null;
}

// --- History ---

export interface RunListItem {
  ad_id: string;
  experience_id: string;
  angle: string;
  hook: string;
  persona: string;
  video_format: string;
  status: RunStatus;
  total_cost_usd: number;
  created_at: string;
  completed_at: string | null;
  duration_sec: number | null;
}

export interface ListRunsParams {
  status?: RunStatus;
  experience_id?: string;
  limit?: number;
  offset?: number;
}
