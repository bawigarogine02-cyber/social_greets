USE social_greetings;

ALTER TABLE conversations
  ADD COLUMN pinned_by JSON NULL,
  ADD COLUMN blocked_by JSON NULL;

ALTER TABLE chat_messages
  ADD COLUMN image_url TEXT NULL,
  ADD COLUMN media_type ENUM('image','video') NULL,
  ADD COLUMN status ENUM('sent','deleted') NOT NULL DEFAULT 'sent',
  ADD COLUMN deleted_by_username VARCHAR(80) NULL,
  ADD COLUMN deleted_at DATETIME NULL;

ALTER TABLE greetings
  ADD COLUMN media_url TEXT NULL,
  ADD COLUMN media_type ENUM('image','video') NULL;