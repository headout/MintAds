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
  creator_description: string; // specific enough to reproduce the same person across all fal.ai calls
  aesthetic: string;           // shared visual style prefix prepended to every fal.ai scene prompt
  background_music_volume: number[]; // one float (0.0–1.0) per non-cta scene, in scene order
}

export interface SceneJson {
  scene_id: number;
  beat: 'hook' | 'body' | 'payoff' | 'cta';
  shot_type: ShotType;
  lip_sync: boolean; // true only when shot_type=ugc_creator AND creator speaks directly to camera
  duration_sec: number;
  visual_direction: string;
  text_overlay: {
    style: 'keyword';
    text: string;          // white setup words (may be empty string)
    keyword: string;       // bold italic colored payoff — 1–4 words
    keywordColor: string;  // hex color: #FFD700 | #00E5FF | #FF4A57
    position: 'top' | 'center' | 'bottom';
  } | null;
  photo_reference_indices: number[]; // 0-based into facts.photos[]; empty [] only for cta
}

export interface VoSegment {
  scene_id: number;
  beat: 'hook' | 'body' | 'payoff';
  vo_text: string;
  target_duration_sec: number;
  pacing: string;
  pause_after_sec?: number; // natural beat-boundary pause inserted as SSML <break> by audio engine
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
    delivery_style: string; // fed to ElevenLabs voice settings context; describes pacing/energy
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

export interface VoSegmentResult {
  scene_id: number;
  file_path: string;   // local path: /data/runs/{adId}/vo_001.mp3
  duration_sec: number;
  characters: number;
}

export interface AngleDef {
  id: string;
  name: string;
  description: string;
  example_line?: string | null;
  sub_format?: string | null;   // primary UGC sub-format auto-selected for this angle
  journey?: string | null;      // 'pre_trip' | 'in_trip' | 'both'
  brand_lean?: string | null;   // 'headout' | 'non_headout' | 'either'
}

export interface HookDef {
  id: string;
  name: string;
  template: string;
  description: string;
}

export interface OutputFile {
  format: string;       // '9:16', '1:1', '16:9'
  file_path: string;    // absolute local path
  file_size: number;    // bytes
  duration_sec: number;
}

export interface AssemblyResult {
  files: OutputFile[];
}
