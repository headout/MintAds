// Shared types used across all pipeline stages

export interface FactsJson {
  experience_id: string;
  title: string;
  short_title: string | null;
  city: string;
  country: string;
  category: string;
  price: {
    amount: number;
    currency: string;
    display: string;
  };
  duration: {
    min_minutes: number | null;
    max_minutes: number | null;
    display: string | null;
  };
  rating: number;
  review_count: number;
  description: string;
  usps: string[];
  highlights: string[];
  inclusions: string[];
  has_free_cancellation: boolean;
  has_skip_the_line: boolean;
  photos: Array<{
    index: number;
    url: string;
    alt: string;
    keyword: string;
  }>;
  top_reviews: Array<{
    text: string;
    star_rating: number;
    reviewer_name: string;
  }>;
}

export interface UserInput {
  experience_id: string;
  persona: string;
  journey_type: 'pre_trip' | 'in_trip';
  brand: 'headout' | 'non_headout';
  angle: string;
  hook: string;
  video_format: '9:16' | '1:1' | '16:9' | 'all';
  additional_details?: string;
}

// --- Script Engine types ---

export type ShotType = 'ugc_creator' | 'b_roll' | 'pov' | 'experience_detail';

export interface GlobalStyle {
  creator_description: string; // specific enough to reproduce the same person via SoulId across all Higgsfield calls
  aesthetic: string;           // shared visual style prefix prepended to every scene's visual_direction
  background_music_volume: number[]; // one float (0.0–1.0) per non-cta scene, in scene order
}

export interface SceneJson {
  scene_id: number;
  beat: 'hook' | 'body' | 'payoff' | 'cta';
  shot_type: ShotType;
  duration_sec: number;
  visual_direction: string;
  text_overlay: string | null;
  photo_reference_indices: number[]; // 0-based into facts.photos[]; empty [] only for cta
}

export interface VoSegment {
  scene_id: number;
  beat: string;
  vo_text: string;
  target_duration_sec: number;
  pacing: string;
}

export interface ScriptJson {
  ad_id: string;
  metadata: {
    experience_id: string;
    persona: string;
    journey_type: string;
    brand: string;
    angle: string;
    hook: string;
    video_format: string;
  };
  video_script: {
    scenes: SceneJson[];
    total_duration_sec: number;
    global_style: GlobalStyle;
  };
  audio_script: {
    vo_segments: VoSegment[];
    tone: string;
    total_duration_target_sec: number;
  };
  end_card: {
    price_display: string;
    rating_display: string;
    review_count_display: string;
    cta_text: string;
    brand_logo: boolean;
    cancellation_text: string;
  };
  claim_sources: Record<string, string>;
}

export interface ClaimEntry {
  claim_text: string;
  appears_in: string[];
  source_field: string;
  source_value: string;
  verified: boolean;
}

export interface ClaimReport {
  ad_id: string;
  claims: ClaimEntry[];
  total_claims: number;
  verified_claims: number;
  unverified_claims: number;
}

export interface ScriptEngineResult {
  script: ScriptJson;
  claim_report: ClaimReport;
}

export interface VideoClipResult {
  scene_id: number;
  beat: string;
  shot_type: ShotType;
  file_path: string;
  remote_url: string;
  duration_sec: number;
}

export interface AngleDef {
  id: string;
  name: string;
  description: string;
  example_line?: string | null;
}

export interface HookDef {
  id: string;
  name: string;
  template: string;
  description: string;
}
