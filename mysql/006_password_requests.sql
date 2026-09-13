USE social_greetings;

ALTER TABLE notifications
  ADD COLUMN action_url TEXT NULL;

CREATE TABLE IF NOT EXISTS password_requests (
  id CHAR(36) PRIMARY KEY,
  username VARCHAR(80) NOT NULL,
  status ENUM('pending','approved','denied','used') NOT NULL DEFAULT 'pending',
  change_key_hash CHAR(64) NULL,
  key_expires_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  approved_at DATETIME NULL,
  used_at DATETIME NULL
);