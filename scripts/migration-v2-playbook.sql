-- Migration: Angle & Hook Playbook v2
-- Adds sub_format / journey / brand_lean columns to angles,
-- replaces all angle/hook/persona rows with v2 data,
-- inserts recommendation maps into config.
-- Safe to run on a live DB — runs table has no FK into angles/hooks/personas.

BEGIN;

-- 1. New columns on angles
ALTER TABLE angles
  ADD COLUMN IF NOT EXISTS sub_format  TEXT,
  ADD COLUMN IF NOT EXISTS journey     TEXT DEFAULT 'both',
  ADD COLUMN IF NOT EXISTS brand_lean  TEXT DEFAULT 'either';

-- 2. Clear lookup tables (no FK constraints from runs — angle_id/hook_id/persona are plain TEXT)
TRUNCATE angles, hooks, personas;

-- 3. Angles (9)
INSERT INTO angles (id, name, description, motivation, example_line, sub_format, journey, brand_lean, sort_order) VALUES
('A1',  'Iconic Moment',
  'Sell the awe of being there — the view, the reveal, the ''I can''t believe I''m here'' moment. Pure wanderlust. Brand in background.',
  'Emotion (awe) — Anticipation & savoring',
  '"This is what 7am at the Taj Mahal feels like."',
  'VO + B-roll', 'pre_trip', 'either', 1),

('A2',  'Bucket-List / FOMO',
  'Frame it as un-missable. Pain of regret. Loss aversion. You''re so close — don''t skip it.',
  'Emotion (anxiety) — Loss aversion / regret',
  '"You flew 8 hours to Rome and DIDN''T go inside the Colosseum?"',
  'POV / come-with-me', 'pre_trip', 'either', 2),

('A3',  'Skip-the-Line',
  'Queues waste your trip. Dramatise the 3-hour line, then show the walk-in. Friction removed.',
  'Practical value — Time-value, friction, de-risk',
  '"They waited 3 hours. We walked straight in."',
  'Before/after', 'both', 'headout', 3),

('A4',  'Is It Worth It?',
  'Meet the price objection head-on. Show what you get. Prove the value. Close on free cancellation.',
  'Practical value — Risk reversal, value framing',
  '"$68 for the Vatican — worth it? Watch this."',
  'VO + B-roll (verdict)', 'both', 'either', 4),

('A5',  'Everyone''s Booking This',
  'Borrow the crowd''s confidence: rating + review count + real travellers. Social proof at scale.',
  'Public — Social proof (Cialdini)',
  '"4.8★ from 2M+ travellers. Here''s why."',
  'Photo-dump + review overlay', 'both', 'either', 5),

('A7',  'Insider Secret',
  'A hack only locals or pros know: best time, hidden entrance, the detail tourists miss. Share like a friend let you in.',
  'Practical value + Social currency — Authority + curiosity gap',
  '"The one thing every tourist gets wrong at the Colosseum."',
  'Tutorial / Listicle', 'both', 'either', 6),

('A8',  'The Trip Changed Me',
  'The emotional payoff — the before/after of a person, not a product. A personal story of the moment that moved them.',
  'Stories + Emotion — Peak-end memory, narrative transport',
  '"I almost skipped the Sistine Chapel. That would have been a mistake."',
  'Text-on-screen storytime', 'pre_trip', 'non_headout', 7),

('A10', 'Be the One Who Knows',
  'Make the traveller the hero. The trip and photos their friends will envy. Sharing it raises their status.',
  'Social currency — Identity signaling, self-enhancement',
  '"This is the trip everyone will ask you about."',
  'Photo-dump envy reel', 'pre_trip', 'either', 8),

('A14', 'In Town Tonight?',
  'Speak to someone already there with a free evening. Book in 60 seconds. Urgent, spontaneous, tonight.',
  'Triggers — Scarcity + spontaneity (recency)',
  '"Bored tonight? I booked this in a minute — best decision of the trip."',
  'POV / come-with-me', 'in_trip', 'headout', 9);

-- 4. Hooks (9)
INSERT INTO hooks (id, name, template, description, sort_order) VALUES
('problem',       'Problem',              'Going to {city} and dreading the {POI} queue?',             'Open on the pain the viewer fears. Problem-aware audience.',            1),
('outcome',       'Outcome / Result',     'This is how you skip every line at {POI}.',                'Lead with the end state fast. Skip the setup.',                         2),
('fomo',          'FOMO',                 'You''re in {city} and NOT doing {POI}??',                   'Don''t-miss / you''re-so-close. Social/esteem driver.',                 3),
('mistake',       'Mistake',              'The biggest mistake people make at {POI}.',                 'The #1 thing tourists get wrong. Authority pattern interrupt.',          4),
('curiosity',     'Curiosity / Secret',   'Why do locals never queue at {POI}?',                      'Open a loop they have to close. Insider tease.',                        5),
('social_proof',  'Social Proof',         '4.8 stars from 12,000 travellers — here''s why.',           'Lead with ratings / reviews / the crowd. De-risk with numbers.',        6),
('relatable_pov', 'Relatable POV',        'POV: your first morning in {city}.',                       'Drop them straight into the scene. First-person visceral opener.',      7),
('listicle',      'Listicle',             '3 things to book before you land in {city}.',               'A save-able numbered promise. High retention + share.',                 8),
('wish_i_knew',   'Things I Wish I Knew', 'Things I wish I knew before visiting {POI}.',              'Practical share-to-help tips. High save/share rate.',                   9);

-- 5. Personas (8)
INSERT INTO personas (id, name, description, sort_order) VALUES
('history_geeks',      'History Geeks',        'Depth, the real story, ''stand where it happened''. Values accuracy and insider detail.',       1),
('art_culture_lovers', 'Art & Culture Lovers',  'Beauty, the masterpiece moment, meaning. Aesthetic depth and artistic appreciation.',          2),
('first_timers',       'First-Timers',          'See the must-dos, don''t mess it up, de-risk. Practical value and crowd-sourced confidence.',  3),
('couples',            'Couples',               'A shared moment, romance, the photo. Emotion-led, ''we'' language, aspirational.',             4),
('solo_travellers',    'Solo Travellers',        'Discovery, freedom, the story to tell. Social currency and personal narrative.',               5),
('families',           'Families',              'Everyone happy, no stress, value, safety. Practical framing, kid-friendly.',                  6),
('luxe_lovers',        'Luxe Lovers',           'Exclusivity, status, the best, seamless. Identity signaling and self-enhancement.',            7),
('thrill_seekers',     'Thrill Seekers',        'Adrenaline, novelty, ''I actually did that''. Emotion + social currency.',                    8);

-- 6. Config — recommendation maps + existing entries
INSERT INTO config (key, value) VALUES
('brand_assets',  '{"logo_url": "/static/headout-logo-white.png", "primary_color": "#ff5a5f", "secondary_color": "#1a1a2e"}'),
('voice_config',  '{"voice_id": "JBFqnCBsd6RMkjVDRZzb", "voice_name": "George", "model_id": "eleven_multilingual_v2", "stability": 0.35, "similarity_boost": 0.75, "style": 0.5}'),
('cost_rates',    '{"seedance_per_sec": 0.2419, "claude_input_per_1k": 0.003, "claude_output_per_1k": 0.015, "elevenlabs_per_1k_chars": 0.03}'),

('angle_hook_map', '{
  "A1":  {"recommended": ["outcome", "relatable_pov"],                       "works": ["fomo", "curiosity", "listicle"]},
  "A2":  {"recommended": ["fomo", "relatable_pov"],                           "works": ["outcome", "mistake", "curiosity", "social_proof", "listicle", "wish_i_knew"]},
  "A3":  {"recommended": ["problem", "outcome"],                              "works": ["fomo", "mistake", "curiosity", "relatable_pov", "wish_i_knew"]},
  "A4":  {"recommended": ["curiosity", "social_proof"],                       "works": ["problem", "outcome", "mistake", "wish_i_knew"]},
  "A5":  {"recommended": ["social_proof"],                                    "works": ["outcome", "fomo", "relatable_pov", "listicle"]},
  "A7":  {"recommended": ["mistake", "curiosity", "listicle", "wish_i_knew"], "works": ["outcome", "relatable_pov"]},
  "A8":  {"recommended": ["relatable_pov"],                                   "works": ["problem", "outcome", "fomo"]},
  "A10": {"recommended": ["fomo", "relatable_pov", "curiosity"],              "works": ["outcome", "social_proof", "listicle"]},
  "A14": {"recommended": ["problem", "outcome", "relatable_pov"],             "works": ["fomo"]}
}'),

('persona_angle_map', '{
  "history_geeks":      {"recommended": ["A7", "A8"],        "works": ["A1", "A2", "A3", "A4", "A5", "A10"]},
  "art_culture_lovers": {"recommended": ["A1", "A7"],        "works": ["A2", "A3", "A4", "A5", "A10"]},
  "first_timers":       {"recommended": ["A2", "A3", "A5"],  "works": ["A4", "A14"]},
  "couples":            {"recommended": ["A1", "A2", "A8"],  "works": ["A3", "A4", "A5", "A7", "A10", "A14"]},
  "solo_travellers":    {"recommended": ["A2", "A7"],        "works": ["A1", "A4", "A5", "A8", "A10", "A14"]},
  "families":           {"recommended": ["A3", "A4", "A5"],  "works": ["A1", "A2", "A7", "A14"]},
  "luxe_lovers":        {"recommended": ["A1", "A7", "A10"], "works": ["A2", "A4", "A5", "A8"]},
  "thrill_seekers":     {"recommended": ["A1", "A2", "A10"], "works": ["A3", "A4", "A5", "A7", "A8", "A14"]}
}')

ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

COMMIT;
