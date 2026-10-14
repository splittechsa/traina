ALTER TABLE food_items
  ADD COLUMN owner_user_id uuid REFERENCES users (id);

ALTER TABLE food_entries
  ADD COLUMN label text;

CREATE INDEX food_items_owner_idx ON food_items (owner_user_id);

CREATE TABLE food_favorites (
  user_id uuid NOT NULL REFERENCES users (id),
  food_item_id uuid NOT NULL REFERENCES food_items (id),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, food_item_id)
);

ALTER TABLE exercises
  ADD COLUMN owner_user_id uuid REFERENCES users (id);

CREATE INDEX exercises_owner_idx ON exercises (owner_user_id);

ALTER TABLE community_comments
  ADD COLUMN parent_comment_id uuid REFERENCES community_comments (id);

CREATE INDEX community_comments_post_idx ON community_comments (post_id, created_at);

CREATE TABLE community_follows (
  follower_user_id uuid NOT NULL REFERENCES users (id),
  followed_user_id uuid NOT NULL REFERENCES users (id),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_user_id, followed_user_id),
  CHECK (follower_user_id <> followed_user_id)
);

CREATE TABLE community_blocks (
  blocker_user_id uuid NOT NULL REFERENCES users (id),
  blocked_user_id uuid NOT NULL REFERENCES users (id),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_user_id, blocked_user_id),
  CHECK (blocker_user_id <> blocked_user_id)
);

CREATE INDEX community_posts_created_idx ON community_posts (created_at DESC);

INSERT INTO exercises (
  id, name_ar, name_en, primary_muscles, secondary_muscles, movement_pattern, equipment, difficulty,
  instructions_ar, instructions_en, contraindications
) VALUES
(
  '10000000-0000-4000-8000-000000000003',
  'رفعة الأرض',
  'Deadlift',
  ARRAY['posterior_chain'],
  ARRAY['grip'],
  'hinge',
  ARRAY['barbell'],
  'intermediate',
  ARRAY['تسمية حركة فقط. ليست وصفة تدريبية مراجعة.'],
  ARRAY['Movement label only. Not a reviewed coaching prescription.'],
  ARRAY[]::text[]
),
(
  '10000000-0000-4000-8000-000000000004',
  'ضغط كتف واقف',
  'Overhead press',
  ARRAY['shoulders'],
  ARRAY['triceps'],
  'vertical_push',
  ARRAY['barbell'],
  'intermediate',
  ARRAY['تسمية حركة فقط. ليست وصفة تدريبية مراجعة.'],
  ARRAY['Movement label only. Not a reviewed coaching prescription.'],
  ARRAY[]::text[]
),
(
  '10000000-0000-4000-8000-000000000005',
  'سحب انحناء',
  'Bent-over row',
  ARRAY['back'],
  ARRAY['biceps'],
  'horizontal_pull',
  ARRAY['barbell'],
  'intermediate',
  ARRAY['تسمية حركة فقط. ليست وصفة تدريبية مراجعة.'],
  ARRAY['Movement label only. Not a reviewed coaching prescription.'],
  ARRAY[]::text[]
),
(
  '10000000-0000-4000-8000-000000000006',
  'عقلة',
  'Pull-up',
  ARRAY['back'],
  ARRAY['biceps'],
  'vertical_pull',
  ARRAY['bodyweight'],
  'intermediate',
  ARRAY['تسمية حركة فقط. ليست وصفة تدريبية مراجعة.'],
  ARRAY['Movement label only. Not a reviewed coaching prescription.'],
  ARRAY[]::text[]
),
(
  '10000000-0000-4000-8000-000000000007',
  'رفعة رومانية',
  'Romanian deadlift',
  ARRAY['hamstrings'],
  ARRAY['glutes'],
  'hinge',
  ARRAY['barbell'],
  'intermediate',
  ARRAY['تسمية حركة فقط. ليست وصفة تدريبية مراجعة.'],
  ARRAY['Movement label only. Not a reviewed coaching prescription.'],
  ARRAY[]::text[]
),
(
  '10000000-0000-4000-8000-000000000008',
  'طعن أمامي',
  'Walking lunge',
  ARRAY['quadriceps'],
  ARRAY['glutes'],
  'lunge',
  ARRAY['bodyweight'],
  'beginner',
  ARRAY['تسمية حركة فقط. ليست وصفة تدريبية مراجعة.'],
  ARRAY['Movement label only. Not a reviewed coaching prescription.'],
  ARRAY[]::text[]
),
(
  '10000000-0000-4000-8000-000000000009',
  'ضغط أرضي',
  'Push-up',
  ARRAY['chest'],
  ARRAY['triceps'],
  'horizontal_push',
  ARRAY['bodyweight'],
  'beginner',
  ARRAY['تسمية حركة فقط. ليست وصفة تدريبية مراجعة.'],
  ARRAY['Movement label only. Not a reviewed coaching prescription.'],
  ARRAY[]::text[]
),
(
  '10000000-0000-4000-8000-000000000010',
  'بلانك',
  'Plank',
  ARRAY['core'],
  ARRAY[]::text[],
  'brace',
  ARRAY['bodyweight'],
  'beginner',
  ARRAY['تسمية حركة فقط. ليست وصفة تدريبية مراجعة.'],
  ARRAY['Movement label only. Not a reviewed coaching prescription.'],
  ARRAY[]::text[]
)
ON CONFLICT (id) DO NOTHING;
