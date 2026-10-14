-- Sahhti core schema. PostgreSQL 16+.
-- No seed rows. No credential columns. Ledger and audit tables are append-only.

CREATE OR REPLACE FUNCTION sahhti_forbid_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'append-only table cannot be updated or deleted';
END;
$$;

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text,
  phone_e164 text,
  status text NOT NULL CHECK (status IN ('pending', 'active', 'suspended', 'deleted')),
  locale text NOT NULL DEFAULT 'ar' CHECK (locale IN ('ar', 'en')),
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE UNIQUE INDEX users_email_active_idx ON users (lower(email)) WHERE email IS NOT NULL AND deleted_at IS NULL;
CREATE UNIQUE INDEX users_phone_active_idx ON users (phone_e164) WHERE phone_e164 IS NOT NULL AND deleted_at IS NULL;

CREATE TABLE user_profiles (
  user_id uuid PRIMARY KEY REFERENCES users (id),
  display_name text,
  birth_date date,
  age_years_reported integer CHECK (age_years_reported BETWEEN 13 AND 100),
  age_reported_on date,
  height_mm integer CHECK (height_mm BETWEEN 1000 AND 2500),
  weight_grams integer CHECK (weight_grams BETWEEN 30000 AND 300000),
  training_experience text,
  discipline text,
  sessions_per_week integer CHECK (sessions_per_week BETWEEN 1 AND 14),
  environment text,
  activity_level text,
  dietary_preferences text[] NOT NULL DEFAULT '{}',
  allergies text[] NOT NULL DEFAULT '{}',
  supplements text[] NOT NULL DEFAULT '{}',
  injuries text[] NOT NULL DEFAULT '{}',
  has_gym_membership boolean NOT NULL DEFAULT false,
  locale text NOT NULL DEFAULT 'ar' CHECK (locale IN ('ar', 'en')),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE onboarding_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users (id),
  version integer NOT NULL CHECK (version > 0),
  payload jsonb NOT NULL,
  requires_review boolean NOT NULL,
  risk_flags text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, version)
);

CREATE TABLE user_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users (id),
  goal text NOT NULL,
  status text NOT NULL CHECK (status IN ('active', 'completed', 'abandoned')),
  started_on date NOT NULL,
  ended_on date
);

CREATE INDEX user_goals_user_idx ON user_goals (user_id, status);

CREATE TABLE consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users (id),
  purpose text NOT NULL,
  policy_version text NOT NULL,
  granted_at timestamptz NOT NULL,
  revoked_at timestamptz
);

CREATE TABLE device_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users (id),
  token_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz
);

CREATE INDEX device_sessions_user_idx ON device_sessions (user_id, expires_at);

CREATE TABLE role_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users (id),
  role text NOT NULL,
  gym_organization_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX role_assignments_global_idx
  ON role_assignments (user_id, role)
  WHERE gym_organization_id IS NULL;

CREATE UNIQUE INDEX role_assignments_tenant_idx
  ON role_assignments (user_id, role, gym_organization_id)
  WHERE gym_organization_id IS NOT NULL;

CREATE TABLE exercises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name_ar text NOT NULL,
  name_en text NOT NULL,
  primary_muscles text[] NOT NULL,
  secondary_muscles text[] NOT NULL DEFAULT '{}',
  movement_pattern text NOT NULL,
  equipment text[] NOT NULL DEFAULT '{}',
  difficulty text NOT NULL CHECK (difficulty IN ('beginner', 'intermediate', 'advanced')),
  instructions_ar text[] NOT NULL DEFAULT '{}',
  instructions_en text[] NOT NULL DEFAULT '{}',
  contraindications text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE exercise_alternatives (
  exercise_id uuid NOT NULL REFERENCES exercises (id),
  alternative_id uuid NOT NULL REFERENCES exercises (id),
  PRIMARY KEY (exercise_id, alternative_id),
  CHECK (exercise_id <> alternative_id)
);

CREATE TABLE programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users (id),
  discipline text NOT NULL,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE program_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id uuid NOT NULL REFERENCES programs (id),
  version integer NOT NULL CHECK (version > 0),
  source text NOT NULL CHECK (source IN ('explicit', 'approved_rules')),
  template jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (program_id, version)
);

CREATE TABLE workout_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users (id),
  program_version_id uuid REFERENCES program_versions (id),
  name text NOT NULL,
  discipline text NOT NULL,
  status text NOT NULL CHECK (status IN ('scheduled', 'in_progress', 'paused', 'completed', 'abandoned')),
  planned_exercises jsonb NOT NULL,
  scheduled_for timestamptz NOT NULL,
  started_at timestamptz,
  completed_at timestamptz
);

CREATE INDEX workout_sessions_user_started_idx ON workout_sessions (user_id, started_at DESC);

CREATE TABLE workout_sets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES workout_sessions (id),
  exercise_id uuid NOT NULL REFERENCES exercises (id),
  set_index integer NOT NULL CHECK (set_index > 0),
  reps integer NOT NULL CHECK (reps >= 0),
  load_grams integer NOT NULL CHECK (load_grams >= 0),
  rpe_tenths integer CHECK (rpe_tenths BETWEEN 0 AND 100),
  completed_at timestamptz NOT NULL,
  UNIQUE (session_id, id)
);

CREATE INDEX workout_sets_session_idx ON workout_sets (session_id, set_index);

CREATE TABLE personal_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users (id),
  exercise_id uuid NOT NULL REFERENCES exercises (id),
  session_id uuid NOT NULL REFERENCES workout_sessions (id),
  set_id uuid NOT NULL REFERENCES workout_sets (id),
  load_grams integer NOT NULL CHECK (load_grams >= 0),
  reps integer NOT NULL CHECK (reps >= 0),
  achieved_at timestamptz NOT NULL,
  UNIQUE (user_id, exercise_id, set_id)
);

CREATE TABLE food_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  provenance text NOT NULL,
  version text NOT NULL,
  UNIQUE (name, version)
);

CREATE TABLE food_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid NOT NULL REFERENCES food_sources (id),
  name_ar text NOT NULL,
  name_en text NOT NULL,
  energy_kcal integer NOT NULL CHECK (energy_kcal >= 0),
  protein_mg integer NOT NULL CHECK (protein_mg >= 0),
  carbohydrate_mg integer NOT NULL CHECK (carbohydrate_mg >= 0),
  fat_mg integer NOT NULL CHECK (fat_mg >= 0),
  per_quantity text NOT NULL,
  barcode text
);

CREATE INDEX food_items_name_en_idx ON food_items (name_en);
CREATE INDEX food_items_barcode_idx ON food_items (barcode) WHERE barcode IS NOT NULL;

CREATE TABLE nutrition_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users (id),
  energy_kcal integer NOT NULL CHECK (energy_kcal >= 0),
  protein_mg integer NOT NULL CHECK (protein_mg >= 0),
  carbohydrate_mg integer NOT NULL CHECK (carbohydrate_mg >= 0),
  fat_mg integer NOT NULL CHECK (fat_mg >= 0),
  formula_id text NOT NULL,
  formula_version integer NOT NULL,
  formula_status text NOT NULL CHECK (formula_status = 'approved'),
  effective_from date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE food_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users (id),
  food_item_id uuid REFERENCES food_items (id),
  logged_on date NOT NULL,
  energy_kcal integer NOT NULL CHECK (energy_kcal >= 0),
  protein_mg integer NOT NULL CHECK (protein_mg >= 0),
  carbohydrate_mg integer NOT NULL CHECK (carbohydrate_mg >= 0),
  fat_mg integer NOT NULL CHECK (fat_mg >= 0),
  source text NOT NULL CHECK (source IN ('manual', 'barcode', 'image_estimate', 'recipe')),
  estimate boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX food_entries_user_day_idx ON food_entries (user_id, logged_on);

CREATE TABLE coaching_methodologies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  status text NOT NULL CHECK (status IN ('draft', 'in_review', 'approved', 'retired')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE coaching_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  methodology_id uuid NOT NULL REFERENCES coaching_methodologies (id),
  rule_key text NOT NULL,
  author_user_id uuid NOT NULL REFERENCES users (id),
  UNIQUE (methodology_id, rule_key)
);

CREATE TABLE coaching_rule_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id uuid NOT NULL REFERENCES coaching_rules (id),
  version integer NOT NULL CHECK (version > 0),
  status text NOT NULL CHECK (status IN ('draft', 'in_review', 'approved', 'rejected', 'retired')),
  priority integer NOT NULL CHECK (priority >= 0),
  effective_from timestamptz NOT NULL,
  effective_until timestamptz,
  conditions jsonb NOT NULL,
  actions jsonb NOT NULL,
  safety_blocks text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (rule_id, version)
);

CREATE TABLE coaching_rule_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_version_id uuid NOT NULL REFERENCES coaching_rule_versions (id),
  decision text NOT NULL CHECK (decision IN ('approved', 'rejected')),
  reviewer_user_id uuid NOT NULL REFERENCES users (id),
  decided_at timestamptz NOT NULL
);

CREATE TABLE coaching_rule_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_version_id uuid NOT NULL REFERENCES coaching_rule_versions (id),
  citation text NOT NULL,
  reviewed_on date,
  review_status text NOT NULL CHECK (review_status IN ('unreviewed', 'reviewed'))
);

CREATE TABLE rule_evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users (id),
  mode text NOT NULL CHECK (mode IN ('production', 'simulation')),
  persistable boolean NOT NULL,
  result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE user_plan_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users (id),
  evaluation_id uuid NOT NULL REFERENCES rule_evaluations (id),
  version integer NOT NULL CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, version)
);

CREATE TABLE coach_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users (id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE coach_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES coach_conversations (id),
  role text NOT NULL CHECK (role IN ('member', 'assistant', 'tool')),
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX coach_messages_conversation_idx ON coach_messages (conversation_id, created_at);

CREATE TABLE coach_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users (id),
  layer text NOT NULL CHECK (layer IN ('profile', 'goal', 'training', 'nutrition', 'progress', 'preference', 'conversation')),
  summary text NOT NULL,
  confirmed_by_user boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE coach_tool_executions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users (id),
  conversation_id uuid REFERENCES coach_conversations (id),
  tool_name text NOT NULL,
  persisted boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  store text NOT NULL CHECK (store IN ('app_store', 'play_store', 'web', 'promotional')),
  billing_period text NOT NULL CHECK (billing_period IN ('none', 'month', 'year')),
  active boolean NOT NULL DEFAULT false
);

CREATE TABLE subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users (id),
  product_id uuid REFERENCES products (id),
  status text NOT NULL CHECK (status IN ('free', 'trialing', 'active', 'grace_period', 'billing_retry', 'canceled', 'expired', 'refunded', 'revoked')),
  store text CHECK (store IN ('app_store', 'play_store', 'web', 'promotional')),
  current_period_end timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  last_event_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX subscriptions_user_idx ON subscriptions (user_id, status);

CREATE TABLE subscription_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL REFERENCES subscriptions (id),
  event_id text NOT NULL,
  event_type text NOT NULL,
  occurred_at timestamptz NOT NULL,
  verified boolean NOT NULL CHECK (verified),
  payload jsonb NOT NULL,
  UNIQUE (subscription_id, event_id)
);

CREATE TABLE payment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  provider_event_id text NOT NULL,
  user_id uuid REFERENCES users (id),
  cash_collected_minor bigint NOT NULL CHECK (cash_collected_minor >= 0),
  store_fee_minor bigint NOT NULL CHECK (store_fee_minor >= 0),
  tax_minor bigint NOT NULL CHECK (tax_minor >= 0),
  currency char(3) NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_event_id)
);

CREATE TABLE financial_ledger_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key text NOT NULL UNIQUE,
  payment_event_id text NOT NULL,
  account text NOT NULL CHECK (account IN ('cash_clearing', 'store_fee_payable', 'tax_payable', 'gym_commission_payable', 'platform_revenue')),
  direction text NOT NULL CHECK (direction IN ('debit', 'credit')),
  amount_minor bigint NOT NULL CHECK (amount_minor >= 0),
  currency char(3) NOT NULL,
  contract_id uuid,
  gym_organization_id uuid,
  policy_version integer,
  attribution_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX financial_ledger_gym_idx ON financial_ledger_entries (gym_organization_id, created_at);
CREATE INDEX financial_ledger_payment_idx ON financial_ledger_entries (payment_event_id);

CREATE TRIGGER financial_ledger_no_mutation
  BEFORE UPDATE OR DELETE ON financial_ledger_entries
  FOR EACH ROW EXECUTE FUNCTION sahhti_forbid_mutation();

CREATE VIEW commission_ledger AS
  SELECT * FROM financial_ledger_entries
  WHERE account = 'gym_commission_payable';

CREATE OR REPLACE FUNCTION sahhti_forbid_view_write() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'write commission lines through financial_ledger_entries';
END;
$$;

CREATE TRIGGER commission_ledger_no_write
  INSTEAD OF INSERT OR UPDATE OR DELETE ON commission_ledger
  FOR EACH ROW EXECUTE FUNCTION sahhti_forbid_view_write();

CREATE TABLE gym_organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legal_name text NOT NULL,
  display_name text NOT NULL,
  city text NOT NULL,
  status text NOT NULL CHECK (status IN ('onboarding', 'active', 'suspended')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE gym_branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES gym_organizations (id),
  name text NOT NULL,
  city text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE gym_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES gym_organizations (id),
  status text NOT NULL CHECK (status IN ('draft', 'active', 'expired', 'terminated')),
  commission_model text NOT NULL CHECK (commission_model IN ('first_payment_only', 'recurring_revenue')),
  commission_base text NOT NULL CHECK (commission_base IN ('gross', 'net_of_store_fee', 'net_of_store_fee_and_tax')),
  rate_bps integer NOT NULL CHECK (rate_bps BETWEEN 0 AND 10000),
  attribution_window_days integer NOT NULL CHECK (attribution_window_days BETWEEN 1 AND 3650),
  currency char(3) NOT NULL DEFAULT 'SAR',
  policy_version integer NOT NULL CHECK (policy_version > 0),
  effective_from date NOT NULL,
  effective_until date
);

CREATE TABLE gym_partner_users (
  user_id uuid NOT NULL REFERENCES users (id),
  organization_id uuid NOT NULL REFERENCES gym_organizations (id),
  branch_id uuid REFERENCES gym_branches (id),
  role text NOT NULL CHECK (role IN ('gym_owner', 'gym_branch_manager')),
  PRIMARY KEY (user_id, organization_id)
);

CREATE TABLE gym_referral_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  organization_id uuid NOT NULL REFERENCES gym_organizations (id),
  branch_id uuid NOT NULL REFERENCES gym_branches (id),
  contract_id uuid NOT NULL REFERENCES gym_contracts (id),
  status text NOT NULL CHECK (status IN ('active', 'revoked')),
  expires_at timestamptz
);

CREATE TABLE gym_referral_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code_id uuid NOT NULL REFERENCES gym_referral_codes (id),
  user_id uuid REFERENCES users (id),
  scanned_at timestamptz NOT NULL,
  source text NOT NULL CHECK (source IN ('qr', 'deep_link'))
);

CREATE TABLE gym_attributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES users (id),
  organization_id uuid NOT NULL REFERENCES gym_organizations (id),
  branch_id uuid NOT NULL REFERENCES gym_branches (id),
  contract_id uuid NOT NULL REFERENCES gym_contracts (id),
  referral_code text NOT NULL,
  attributed_at timestamptz NOT NULL,
  locked boolean NOT NULL CHECK (locked)
);

CREATE TABLE commission_settlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES gym_organizations (id),
  period_start date NOT NULL,
  period_end date NOT NULL,
  currency char(3) NOT NULL,
  amount_minor bigint NOT NULL CHECK (amount_minor >= 0),
  status text NOT NULL CHECK (status IN ('draft', 'approved', 'paid', 'void')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_user_id uuid NOT NULL REFERENCES users (id),
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX posts_created_idx ON posts (created_at DESC) WHERE deleted_at IS NULL;

CREATE TABLE post_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES posts (id),
  author_user_id uuid NOT NULL REFERENCES users (id),
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_user_id uuid NOT NULL REFERENCES users (id),
  post_id uuid REFERENCES posts (id),
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users (id),
  status text NOT NULL CHECK (status IN ('open', 'pending', 'resolved', 'closed')),
  priority text NOT NULL CHECK (priority IN ('low', 'normal', 'high')),
  subject text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid REFERENCES users (id),
  action text NOT NULL,
  resource_type text NOT NULL,
  resource_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER audit_logs_no_mutation
  BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION sahhti_forbid_mutation();

CREATE INDEX audit_logs_created_idx ON audit_logs (created_at);

CREATE TABLE outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aggregate_type text NOT NULL,
  aggregate_id uuid NOT NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz
);

CREATE INDEX outbox_unpublished_idx ON outbox (created_at) WHERE published_at IS NULL;

CREATE TABLE feature_flags (
  key text PRIMARY KEY,
  enabled boolean NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE role_assignments
  ADD CONSTRAINT role_assignments_gym_fk
  FOREIGN KEY (gym_organization_id) REFERENCES gym_organizations (id);

ALTER TABLE financial_ledger_entries
  ADD CONSTRAINT financial_ledger_gym_fk FOREIGN KEY (gym_organization_id) REFERENCES gym_organizations (id),
  ADD CONSTRAINT financial_ledger_contract_fk FOREIGN KEY (contract_id) REFERENCES gym_contracts (id),
  ADD CONSTRAINT financial_ledger_attribution_fk FOREIGN KEY (attribution_id) REFERENCES gym_attributions (id);
