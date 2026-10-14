CREATE TABLE community_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_user_id uuid NOT NULL REFERENCES users (id),
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  visibility text NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'members')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX community_posts_author_idx ON community_posts (author_user_id, created_at DESC);

CREATE TABLE community_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES community_posts (id),
  author_user_id uuid NOT NULL REFERENCES users (id),
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 1000),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE community_reactions (
  post_id uuid NOT NULL REFERENCES community_posts (id),
  user_id uuid NOT NULL REFERENCES users (id),
  kind text NOT NULL CHECK (kind IN ('support')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id, kind)
);

CREATE TABLE community_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_user_id uuid NOT NULL REFERENCES users (id),
  post_id uuid NOT NULL REFERENCES community_posts (id),
  reason text NOT NULL CHECK (char_length(reason) BETWEEN 1 AND 500),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  created_at timestamptz NOT NULL DEFAULT now()
);
