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
