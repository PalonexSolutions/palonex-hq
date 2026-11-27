CREATE TABLE palonex_private.admin_user (
  id text PRIMARY KEY,
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  "emailVerified" boolean NOT NULL,
  image text,
  "createdAt" timestamptz NOT NULL,
  "updatedAt" timestamptz NOT NULL
);

CREATE TABLE palonex_private.admin_account (
  id text PRIMARY KEY,
  "accountId" text NOT NULL,
  "providerId" text NOT NULL,
  "userId" text NOT NULL REFERENCES palonex_private.admin_user(id) ON DELETE CASCADE,
  "accessToken" text,
  "refreshToken" text,
  "idToken" text,
  "accessTokenExpiresAt" timestamptz,
  "refreshTokenExpiresAt" timestamptz,
  scope text,
  password text,
  "createdAt" timestamptz NOT NULL,
  "updatedAt" timestamptz NOT NULL,
  UNIQUE ("providerId", "accountId")
);
CREATE INDEX admin_account_user_idx ON palonex_private.admin_account ("userId");

CREATE TABLE palonex_private.admin_session (
  id text PRIMARY KEY,
  "expiresAt" timestamptz NOT NULL,
  token text NOT NULL UNIQUE,
  "createdAt" timestamptz NOT NULL,
  "updatedAt" timestamptz NOT NULL,
  "ipAddress" text,
  "userAgent" text,
  "userId" text NOT NULL REFERENCES palonex_private.admin_user(id) ON DELETE CASCADE
);
CREATE INDEX admin_session_user_idx ON palonex_private.admin_session ("userId");
CREATE INDEX admin_session_expiry_idx ON palonex_private.admin_session ("expiresAt");

CREATE TABLE palonex_private.admin_verification (
  id text PRIMARY KEY,
  identifier text NOT NULL,
  value text NOT NULL,
  "expiresAt" timestamptz NOT NULL,
  "createdAt" timestamptz NOT NULL,
  "updatedAt" timestamptz NOT NULL
);

CREATE TABLE palonex_private.admin_staff (
  user_id text PRIMARY KEY REFERENCES palonex_private.admin_user(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT true,
  provisioned_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE palonex_private.admin_login_limits (
  key text NOT NULL,
  window_start timestamptz NOT NULL,
  hits integer NOT NULL CHECK (hits > 0),
  PRIMARY KEY (key, window_start)
);
CREATE INDEX admin_login_limits_window_idx ON palonex_private.admin_login_limits(window_start);

CREATE TABLE palonex_private.enquiry_notes (
  id uuid PRIMARY KEY,
  enquiry_id uuid NOT NULL REFERENCES palonex_private.enquiries(id) ON DELETE CASCADE,
  actor_id text NOT NULL,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX enquiry_notes_enquiry_idx ON palonex_private.enquiry_notes(enquiry_id, created_at DESC);

CREATE TABLE palonex_private.enquiry_audit (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  enquiry_id uuid NOT NULL REFERENCES palonex_private.enquiries(id) ON DELETE CASCADE,
  actor_id text NOT NULL,
  action text NOT NULL CHECK (action IN ('status_changed', 'note_added')),
  previous_status text CHECK (previous_status IN ('NEW','IN_PROGRESS','RESOLVED','ARCHIVED')),
  new_status text CHECK (new_status IN ('NEW','IN_PROGRESS','RESOLVED','ARCHIVED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (action='status_changed' AND previous_status IS NOT NULL AND new_status IS NOT NULL AND previous_status <> new_status)
    OR (action='note_added' AND previous_status IS NULL AND new_status IS NULL)
  )
);
CREATE INDEX enquiry_audit_enquiry_idx ON palonex_private.enquiry_audit(enquiry_id, id DESC);
