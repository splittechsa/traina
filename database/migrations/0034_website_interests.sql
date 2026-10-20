CREATE TABLE website_interests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL CHECK (char_length(email) BETWEEN 3 AND 254),
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  goal text NOT NULL CHECK (goal IN ('strength', 'fitness', 'nutrition')),
  locale text NOT NULL CHECK (locale IN ('ar', 'en')),
  consent_version text NOT NULL DEFAULT 'interest-v1',
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'closed')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX website_interests_email_idx ON website_interests (lower(email));
CREATE INDEX website_interests_created_idx ON website_interests (created_at DESC, id);
