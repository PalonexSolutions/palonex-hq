CREATE TABLE palonex_private.identity_user (
  id text PRIMARY KEY,
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  "emailVerified" boolean NOT NULL,
  image text,
  "createdAt" timestamptz NOT NULL,
  "updatedAt" timestamptz NOT NULL,
  "consentVersion" text NOT NULL,
  "consentedAt" timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended'))
);

CREATE TABLE palonex_private.identity_account (
  id text PRIMARY KEY,
  "accountId" text NOT NULL,
  "providerId" text NOT NULL,
  "userId" text NOT NULL REFERENCES palonex_private.identity_user(id) ON DELETE CASCADE,
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
CREATE INDEX identity_account_user_idx ON palonex_private.identity_account ("userId");

CREATE TABLE palonex_private.identity_session (
  id text PRIMARY KEY,
  "expiresAt" timestamptz NOT NULL,
  token text NOT NULL UNIQUE,
  "createdAt" timestamptz NOT NULL,
  "updatedAt" timestamptz NOT NULL,
  "ipAddress" text,
  "userAgent" text,
  "userId" text NOT NULL REFERENCES palonex_private.identity_user(id) ON DELETE CASCADE
);
CREATE INDEX identity_session_user_idx ON palonex_private.identity_session ("userId");
CREATE INDEX identity_session_expiry_idx ON palonex_private.identity_session ("expiresAt");

CREATE TABLE palonex_private.identity_verification (
  id text PRIMARY KEY,
  identifier text NOT NULL,
  value text NOT NULL,
  "expiresAt" timestamptz NOT NULL,
  "createdAt" timestamptz NOT NULL,
  "updatedAt" timestamptz NOT NULL
);


CREATE INDEX identity_user_created_idx ON palonex_private.identity_user ("createdAt" DESC, id DESC);
CREATE INDEX identity_verification_identifier_idx ON palonex_private.identity_verification(identifier);

CREATE TABLE palonex_private.identity_role (
  user_id text NOT NULL REFERENCES palonex_private.identity_user(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('intern','trainer','moderator')),
  granted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, role)
);

CREATE TABLE palonex_private.identity_rate (
  key text NOT NULL,
  window_start timestamptz NOT NULL,
  hits integer NOT NULL CHECK (hits > 0),
  PRIMARY KEY (key, window_start)
);
CREATE INDEX identity_rate_window_idx ON palonex_private.identity_rate(window_start);

CREATE TABLE palonex_private.identity_mail (
  id uuid PRIMARY KEY,
  user_id text NOT NULL REFERENCES palonex_private.identity_user(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('verify','reset')),
  digest text NOT NULL UNIQUE,
  payload text,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  available_at timestamptz NOT NULL DEFAULT now(),
  attempts integer NOT NULL DEFAULT 0,
  sent_at timestamptz,
  lease uuid
);
CREATE INDEX identity_mail_pending_idx ON palonex_private.identity_mail(available_at) WHERE payload IS NOT NULL;
CREATE UNIQUE INDEX identity_mail_live_idx ON palonex_private.identity_mail(user_id,kind) WHERE consumed_at IS NULL;
CREATE INDEX identity_mail_expiry_idx ON palonex_private.identity_mail(expires_at);

CREATE TABLE palonex_private.identity_audit (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id text NOT NULL REFERENCES palonex_private.identity_user(id) ON DELETE CASCADE,
  actor_id text NOT NULL,
  previous_status text NOT NULL CHECK (previous_status IN ('active','suspended')),
  new_status text NOT NULL CHECK (new_status IN ('active','suspended')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (previous_status <> new_status)
);
CREATE INDEX identity_audit_user_idx ON palonex_private.identity_audit(user_id, id DESC);
