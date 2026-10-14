INSERT INTO exercises (
  id, name_ar, name_en, primary_muscles, secondary_muscles, movement_pattern, equipment, difficulty,
  instructions_ar, instructions_en, contraindications
) VALUES
(
  '10000000-0000-4000-8000-000000000001',
  'سكوات خلفي',
  'Back squat',
  ARRAY['quadriceps'],
  ARRAY['glutes'],
  'squat',
  ARRAY['barbell', 'rack'],
  'intermediate',
  ARRAY['نص تعليمي غير مراجع. ليس وصفة تدريبية.'],
  ARRAY['Unreviewed library stub. Not a coaching prescription.'],
  ARRAY[]::text[]
),
(
  '10000000-0000-4000-8000-000000000002',
  'ضغط صدر مستلق',
  'Bench press',
  ARRAY['chest'],
  ARRAY['triceps'],
  'horizontal_push',
  ARRAY['barbell', 'bench'],
  'intermediate',
  ARRAY['نص تعليمي غير مراجع. ليس وصفة تدريبية.'],
  ARRAY['Unreviewed library stub. Not a coaching prescription.'],
  ARRAY[]::text[]
)
ON CONFLICT (id) DO NOTHING;
