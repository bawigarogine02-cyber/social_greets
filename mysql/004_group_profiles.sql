USE social_greetings;

ALTER TABLE conversations
  ADD COLUMN group_avatar_url TEXT NULL;
