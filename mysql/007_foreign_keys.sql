USE social_greetings;

-- Referential integrity constraints for user-owned records.
-- These do not replace HTML escaping / sanitization for XSS defense; they prevent orphans and invalid cross-table references.

CREATE INDEX IF NOT EXISTS idx_greetings_from_id ON greetings (from_id);
CREATE INDEX IF NOT EXISTS idx_greetings_to_username ON greetings (to_username);
CREATE INDEX IF NOT EXISTS idx_friends_from_username ON friends (from_username);
CREATE INDEX IF NOT EXISTS idx_friends_to_username ON friends (to_username);
CREATE INDEX IF NOT EXISTS idx_conversations_user_a ON conversations (user_a);
CREATE INDEX IF NOT EXISTS idx_conversations_user_b ON conversations (user_b);
CREATE INDEX IF NOT EXISTS idx_conversations_requested_by ON conversations (requested_by);
CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation_id ON chat_messages (conversation_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_from_username ON chat_messages (from_username);
CREATE INDEX IF NOT EXISTS idx_chat_messages_deleted_by_username ON chat_messages (deleted_by_username);
CREATE INDEX IF NOT EXISTS idx_notifications_to_username ON notifications (to_username);
CREATE INDEX IF NOT EXISTS idx_password_requests_username ON password_requests (username);

-- Note: greetings.to_username is intentionally not constrained to profiles.
-- Public greetings use a value like 'Everyone', which is not a profile row.
ALTER TABLE greetings
  ADD CONSTRAINT fk_greetings_from_profile
    FOREIGN KEY (from_id) REFERENCES profiles(id)
    ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE friends
  ADD CONSTRAINT fk_friends_from_profile
    FOREIGN KEY (from_username) REFERENCES profiles(username)
    ON UPDATE CASCADE ON DELETE CASCADE,
  ADD CONSTRAINT fk_friends_to_profile
    FOREIGN KEY (to_username) REFERENCES profiles(username)
    ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE conversations
  ADD CONSTRAINT fk_conversations_user_a_profile
    FOREIGN KEY (user_a) REFERENCES profiles(username)
    ON UPDATE CASCADE ON DELETE CASCADE,
  ADD CONSTRAINT fk_conversations_user_b_profile
    FOREIGN KEY (user_b) REFERENCES profiles(username)
    ON UPDATE CASCADE ON DELETE CASCADE,
  ADD CONSTRAINT fk_conversations_requested_by_profile
    FOREIGN KEY (requested_by) REFERENCES profiles(username)
    ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE chat_messages
  ADD CONSTRAINT fk_chat_messages_conversation
    FOREIGN KEY (conversation_id) REFERENCES conversations(id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  ADD CONSTRAINT fk_chat_messages_from_profile
    FOREIGN KEY (from_username) REFERENCES profiles(username)
    ON UPDATE CASCADE ON DELETE CASCADE,
  ADD CONSTRAINT fk_chat_messages_deleted_by_profile
    FOREIGN KEY (deleted_by_username) REFERENCES profiles(username)
    ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE notifications
  ADD CONSTRAINT fk_notifications_to_profile
    FOREIGN KEY (to_username) REFERENCES profiles(username)
    ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE password_requests
  ADD CONSTRAINT fk_password_requests_profile
    FOREIGN KEY (username) REFERENCES profiles(username)
    ON UPDATE CASCADE ON DELETE CASCADE;
