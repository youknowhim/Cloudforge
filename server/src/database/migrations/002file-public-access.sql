/*
  share_to_emails holds the recipient list as a JSON array of emails.

  It must be JSONB, not JSON: the containment operator `@>` used by
  getFiles/getFileById to test membership is only defined for jsonb.
*/

ALTER TABLE files
ADD COLUMN IF NOT EXISTS share_to_emails JSONB NULL DEFAULT '[]'::jsonb;

ALTER TABLE files
ALTER COLUMN share_to_emails TYPE JSONB
USING COALESCE(share_to_emails, '[]')::jsonb;

ALTER TABLE files
ALTER COLUMN share_to_emails SET DEFAULT '[]'::jsonb;
