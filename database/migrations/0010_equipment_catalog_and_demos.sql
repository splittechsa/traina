CREATE TABLE IF NOT EXISTS equipment_manufacturers (
  id text PRIMARY KEY CHECK (id ~ '^[a-z0-9_]+$'),
  name text NOT NULL UNIQUE,
  name_ar text NOT NULL,
  categories text[] NOT NULL DEFAULT '{}',
  catalog_status text NOT NULL DEFAULT 'registry_only'
    CHECK (catalog_status IN ('registry_only', 'verified_models')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS equipment_models (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manufacturer_id text NOT NULL REFERENCES equipment_manufacturers(id) ON DELETE RESTRICT,
  model_name text NOT NULL,
  category text NOT NULL,
  movement_pattern text,
  source_url text,
  review_status text NOT NULL DEFAULT 'unverified'
    CHECK (review_status IN ('unverified', 'verified')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (manufacturer_id, model_name)
);

CREATE INDEX IF NOT EXISTS equipment_models_manufacturer_idx
  ON equipment_models (manufacturer_id, category, model_name);

ALTER TABLE exercises
  ADD COLUMN IF NOT EXISTS demo_type text NOT NULL DEFAULT 'none'
    CHECK (demo_type IN ('none', 'procedural', 'glb')),
  ADD COLUMN IF NOT EXISTS demo_profile text,
  ADD COLUMN IF NOT EXISTS demo_model_uri text,
  ADD COLUMN IF NOT EXISTS demo_license_spdx text,
  ADD COLUMN IF NOT EXISTS demo_attribution text,
  ADD COLUMN IF NOT EXISTS demo_review_status text NOT NULL DEFAULT 'unreviewed'
    CHECK (demo_review_status IN ('unreviewed', 'reviewed'));

INSERT INTO equipment_manufacturers (id, name, name_ar, categories) VALUES
  ('panatta', 'Panatta', 'باناتا', ARRAY['strength_machine']),
  ('matrix', 'Matrix', 'ماتريكس', ARRAY['strength_machine', 'cardio']),
  ('life_fitness', 'Life Fitness', 'لايف فتنس', ARRAY['strength_machine', 'cardio']),
  ('technogym', 'Technogym', 'تكنوجيم', ARRAY['strength_machine', 'cardio']),
  ('hammer_strength', 'Hammer Strength', 'هامر سترنث', ARRAY['plate_loaded', 'strength_machine']),
  ('precor', 'Precor', 'بريكور', ARRAY['strength_machine', 'cardio']),
  ('hoist', 'Hoist', 'هويست', ARRAY['strength_machine']),
  ('cybex', 'Cybex', 'سايبكس', ARRAY['strength_machine', 'cardio']),
  ('nautilus', 'Nautilus', 'نوتيلوس', ARRAY['strength_machine', 'cardio']),
  ('gym80', 'gym80', 'جيم 80', ARRAY['strength_machine', 'plate_loaded']),
  ('atlantis', 'Atlantis Strength', 'أتلانتس سترنث', ARRAY['strength_machine', 'plate_loaded']),
  ('arsenal_strength', 'Arsenal Strength', 'أرسنال سترنث', ARRAY['strength_machine', 'plate_loaded']),
  ('prime_fitness', 'Prime Fitness', 'برايم فتنس', ARRAY['strength_machine', 'plate_loaded']),
  ('star_trac', 'Star Trac', 'ستار تراك', ARRAY['strength_machine', 'cardio']),
  ('freemotion', 'FreeMotion', 'فري موشن', ARRAY['strength_machine', 'cable', 'cardio']),
  ('keiser', 'Keiser', 'كايزر', ARRAY['pneumatic', 'cardio']),
  ('watson', 'Watson Gym Equipment', 'واتسون', ARRAY['strength_machine', 'plate_loaded']),
  ('booty_builder', 'Booty Builder', 'بوتي بيلدر', ARRAY['strength_machine']),
  ('rogue', 'Rogue Fitness', 'روغ فتنس', ARRAY['free_weight', 'functional']),
  ('eleiko', 'Eleiko', 'إليكو', ARRAY['free_weight', 'powerlifting']),
  ('sorinex', 'Sorinex', 'سورينكس', ARRAY['free_weight', 'functional']),
  ('rep_fitness', 'REP Fitness', 'ريب فتنس', ARRAY['free_weight', 'functional']),
  ('titan_fitness', 'Titan Fitness', 'تايتن فتنس', ARRAY['free_weight', 'functional']),
  ('concept2', 'Concept2', 'كونسبت 2', ARRAY['cardio', 'functional']),
  ('assault_fitness', 'Assault Fitness', 'أسولت فتنس', ARRAY['cardio', 'functional']),
  ('torque_fitness', 'Torque Fitness', 'تورك فتنس', ARRAY['functional', 'cardio']),
  ('woodway', 'Woodway', 'وودواي', ARRAY['cardio']),
  ('stairmaster', 'StairMaster', 'ستير ماستر', ARRAY['cardio'])
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  name_ar = EXCLUDED.name_ar,
  categories = EXCLUDED.categories;

UPDATE exercises
SET
  demo_type = 'procedural',
  demo_profile = CASE movement_pattern
    WHEN 'squat' THEN 'squat'
    WHEN 'lunge' THEN 'lunge'
    WHEN 'hinge' THEN 'hinge'
    WHEN 'horizontal_push' THEN 'horizontal_push'
    WHEN 'vertical_push' THEN 'vertical_push'
    WHEN 'horizontal_pull' THEN 'horizontal_pull'
    WHEN 'vertical_pull' THEN 'vertical_pull'
    WHEN 'conditioning' THEN 'conditioning'
    WHEN 'jump' THEN 'jump'
    WHEN 'brace' THEN 'brace'
    WHEN 'squat_to_press' THEN 'squat_to_press'
    WHEN 'knee_flexion' THEN 'knee_flexion'
    ELSE 'neutral'
  END
WHERE demo_type = 'none';
