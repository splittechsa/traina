ALTER TABLE exercises
  ADD COLUMN IF NOT EXISTS disciplines text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS environments text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS equipment_brands text[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS exercises_disciplines_gin_idx ON exercises USING gin (disciplines);
CREATE INDEX IF NOT EXISTS exercises_environments_gin_idx ON exercises USING gin (environments);
CREATE INDEX IF NOT EXISTS exercises_equipment_brands_gin_idx ON exercises USING gin (equipment_brands);

UPDATE exercises
SET
  disciplines = CASE
    WHEN 'bodyweight' = ANY(equipment) THEN ARRAY['calisthenics', 'crossfit', 'general_fitness']
    ELSE ARRAY['bodybuilding', 'powerlifting', 'crossfit']
  END,
  environments = CASE
    WHEN 'bodyweight' = ANY(equipment) THEN ARRAY['home', 'gym', 'outdoor']
    ELSE ARRAY['gym']
  END
WHERE cardinality(disciplines) = 0;

INSERT INTO exercises (
  id, name_ar, name_en, primary_muscles, secondary_muscles, movement_pattern, equipment, difficulty,
  instructions_ar, instructions_en, contraindications, disciplines, environments, equipment_brands
) VALUES
(
  '10000000-0000-4000-8000-000000000011', 'بيربي', 'Burpee',
  ARRAY['full_body'], ARRAY['core'], 'conditioning', ARRAY['bodyweight'], 'intermediate',
  ARRAY['تسمية حركة فقط. اطلب إرشاد مدرب مؤهل عند الحاجة.'],
  ARRAY['Movement label only. Ask a qualified coach when needed.'], ARRAY[]::text[],
  ARRAY['crossfit', 'general_fitness'], ARRAY['home', 'gym', 'outdoor'], ARRAY[]::text[]
),
(
  '10000000-0000-4000-8000-000000000012', 'قفز الصندوق', 'Box jump',
  ARRAY['quadriceps'], ARRAY['glutes'], 'jump', ARRAY['plyo_box'], 'intermediate',
  ARRAY['تسمية حركة فقط. تأكد من ثبات الصندوق والمساحة.'],
  ARRAY['Movement label only. Confirm the box and area are stable.'], ARRAY[]::text[],
  ARRAY['crossfit', 'functional_training'], ARRAY['home', 'gym'], ARRAY[]::text[]
),
(
  '10000000-0000-4000-8000-000000000013', 'تأرجح الكيتل بيل', 'Kettlebell swing',
  ARRAY['posterior_chain'], ARRAY['core'], 'hinge', ARRAY['kettlebell'], 'intermediate',
  ARRAY['تسمية حركة فقط. ليست وصفة تدريبية مراجعة.'],
  ARRAY['Movement label only. Not a reviewed coaching prescription.'], ARRAY[]::text[],
  ARRAY['crossfit', 'functional_training'], ARRAY['home', 'gym'], ARRAY[]::text[]
),
(
  '10000000-0000-4000-8000-000000000014', 'ثرستر بالبار', 'Barbell thruster',
  ARRAY['quadriceps', 'shoulders'], ARRAY['triceps'], 'squat_to_press', ARRAY['barbell'], 'advanced',
  ARRAY['تسمية حركة فقط. ليست وصفة تدريبية مراجعة.'],
  ARRAY['Movement label only. Not a reviewed coaching prescription.'], ARRAY[]::text[],
  ARRAY['crossfit'], ARRAY['gym'], ARRAY[]::text[]
),
(
  '10000000-0000-4000-8000-000000000015', 'متوازي', 'Parallel-bar dip',
  ARRAY['chest', 'triceps'], ARRAY['shoulders'], 'vertical_push', ARRAY['dip_bars'], 'intermediate',
  ARRAY['تسمية حركة فقط. ليست وصفة تدريبية مراجعة.'],
  ARRAY['Movement label only. Not a reviewed coaching prescription.'], ARRAY[]::text[],
  ARRAY['calisthenics'], ARRAY['home', 'gym', 'outdoor'], ARRAY[]::text[]
),
(
  '10000000-0000-4000-8000-000000000016', 'هولو هولد', 'Hollow-body hold',
  ARRAY['core'], ARRAY[]::text[], 'brace', ARRAY['bodyweight'], 'beginner',
  ARRAY['تسمية حركة فقط. ليست وصفة تدريبية مراجعة.'],
  ARRAY['Movement label only. Not a reviewed coaching prescription.'], ARRAY[]::text[],
  ARRAY['calisthenics', 'general_fitness'], ARRAY['home', 'gym', 'outdoor'], ARRAY[]::text[]
),
(
  '10000000-0000-4000-8000-000000000017', 'ضغط بايك', 'Pike push-up',
  ARRAY['shoulders'], ARRAY['triceps'], 'vertical_push', ARRAY['bodyweight'], 'intermediate',
  ARRAY['تسمية حركة فقط. ليست وصفة تدريبية مراجعة.'],
  ARRAY['Movement label only. Not a reviewed coaching prescription.'], ARRAY[]::text[],
  ARRAY['calisthenics'], ARRAY['home', 'gym', 'outdoor'], ARRAY[]::text[]
),
(
  '10000000-0000-4000-8000-000000000018', 'سحب أفقي بوزن الجسم', 'Inverted row',
  ARRAY['back'], ARRAY['biceps'], 'horizontal_pull', ARRAY['bar'], 'beginner',
  ARRAY['تسمية حركة فقط. تأكد من ثبات البار.'],
  ARRAY['Movement label only. Confirm the bar is secure.'], ARRAY[]::text[],
  ARRAY['calisthenics'], ARRAY['home', 'gym', 'outdoor'], ARRAY[]::text[]
),
(
  '10000000-0000-4000-8000-000000000019', 'ضغط الأرجل على الجهاز', 'Machine leg press',
  ARRAY['quadriceps'], ARRAY['glutes'], 'squat', ARRAY['machine'], 'beginner',
  ARRAY['اضبط المقعد والمدى حسب الجهاز وتعليمات النادي.'],
  ARRAY['Adjust the seat and range for the specific machine and gym instructions.'], ARRAY[]::text[],
  ARRAY['bodybuilding', 'general_fitness'], ARRAY['gym'],
  ARRAY['panatta', 'matrix', 'life_fitness', 'technogym', 'hammer_strength', 'precor']
),
(
  '10000000-0000-4000-8000-000000000020', 'ضغط الصدر على الجهاز', 'Machine chest press',
  ARRAY['chest'], ARRAY['triceps'], 'horizontal_push', ARRAY['machine'], 'beginner',
  ARRAY['اضبط المقعد والمقابض حسب الجهاز وتعليمات النادي.'],
  ARRAY['Adjust the seat and handles for the specific machine and gym instructions.'], ARRAY[]::text[],
  ARRAY['bodybuilding', 'general_fitness'], ARRAY['gym'],
  ARRAY['panatta', 'matrix', 'life_fitness', 'technogym', 'hammer_strength', 'precor', 'hoist', 'cybex']
),
(
  '10000000-0000-4000-8000-000000000021', 'سحب علوي على الجهاز', 'Machine lat pulldown',
  ARRAY['back'], ARRAY['biceps'], 'vertical_pull', ARRAY['machine'], 'beginner',
  ARRAY['اضبط مسند الفخذ والمقبض حسب الجهاز وتعليمات النادي.'],
  ARRAY['Adjust the thigh pad and handle for the specific machine and gym instructions.'], ARRAY[]::text[],
  ARRAY['bodybuilding', 'general_fitness'], ARRAY['gym'],
  ARRAY['panatta', 'matrix', 'life_fitness', 'technogym', 'hammer_strength', 'precor', 'nautilus']
),
(
  '10000000-0000-4000-8000-000000000022', 'ثني الرجل على الجهاز', 'Machine leg curl',
  ARRAY['hamstrings'], ARRAY[]::text[], 'knee_flexion', ARRAY['machine'], 'beginner',
  ARRAY['اضبط محور الركبة والوسادة حسب الجهاز وتعليمات النادي.'],
  ARRAY['Align the knee axis and pad for the specific machine and gym instructions.'], ARRAY[]::text[],
  ARRAY['bodybuilding', 'general_fitness'], ARRAY['gym'],
  ARRAY['panatta', 'matrix', 'life_fitness', 'technogym', 'precor', 'hoist', 'cybex', 'nautilus']
)
ON CONFLICT (id) DO NOTHING;
