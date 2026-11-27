CREATE TABLE palonex_private.enquiries (
  id uuid PRIMARY KEY,
  submission_id uuid NOT NULL UNIQUE,
  fingerprint text NOT NULL,
  full_name text NOT NULL CHECK (char_length(full_name) BETWEEN 2 AND 100),
  email text NOT NULL CHECK (char_length(email) <= 254),
  organization text CHECK (char_length(organization) <= 150),
  category text NOT NULL CHECK (category IN ('general','partnership','product','collaboration','careers','other')),
  subject text NOT NULL CHECK (char_length(subject) BETWEEN 4 AND 150),
  message text NOT NULL CHECK (char_length(message) BETWEEN 10 AND 5000),
  privacy_version text NOT NULL,
  consented_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'NEW' CHECK (status IN ('NEW','IN_PROGRESS','RESOLVED','ARCHIVED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  status_changed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX enquiries_created_idx ON palonex_private.enquiries (created_at DESC, id DESC);
CREATE INDEX enquiries_status_created_idx ON palonex_private.enquiries (status, created_at DESC, id DESC);
CREATE INDEX enquiries_category_created_idx ON palonex_private.enquiries (category, created_at DESC, id DESC);

CREATE TABLE palonex_private.enquiry_rate_limits (
  key text NOT NULL,
  window_start timestamptz NOT NULL,
  hits integer NOT NULL CHECK (hits > 0),
  PRIMARY KEY (key, window_start)
);
CREATE INDEX enquiry_rate_limits_window_idx ON palonex_private.enquiry_rate_limits (window_start);

CREATE TABLE palonex_private.enquiry_notifications (
  enquiry_id uuid NOT NULL REFERENCES palonex_private.enquiries(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('company','acknowledgement')),
  attempts integer NOT NULL DEFAULT 0,
  available_at timestamptz NOT NULL DEFAULT now(),
  lease_id uuid,
  first_attempt_at timestamptz,
  sent_at timestamptz,
  failed_at timestamptz,
  PRIMARY KEY (enquiry_id, kind)
);
CREATE INDEX enquiry_notifications_pending_idx
  ON palonex_private.enquiry_notifications (available_at) WHERE sent_at IS NULL AND failed_at IS NULL;
