CREATE DATABASE IF NOT EXISTS social_greetings;
USE social_greetings;

CREATE TABLE IF NOT EXISTS profiles (
  id CHAR(36) PRIMARY KEY,
  username VARCHAR(80) NOT NULL UNIQUE,
  display VARCHAR(120) NOT NULL,
  avatar_url TEXT NULL,
  password_hash TEXT NOT NULL,
  role ENUM('admin','user') NOT NULL DEFAULT 'user',
  ban_status ENUM('active','temporary','permanent') NOT NULL DEFAULT 'active',
  ban_reason TEXT NULL,
  ban_until DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS greetings (
  id CHAR(36) PRIMARY KEY,
  from_name VARCHAR(120) NOT NULL,
  from_id CHAR(36) NULL,
  to_username VARCHAR(80) NOT NULL,
  message TEXT NOT NULL,
  type ENUM('banner','private') NOT NULL DEFAULT 'banner',
  media_url TEXT NULL,
  media_type ENUM('image','video') NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS banners (
  id CHAR(36) PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  image TEXT NOT NULL,
  link TEXT NOT NULL DEFAULT '/greet',
  reactions JSON NULL,
  comments JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS friends (
  id CHAR(36) PRIMARY KEY,
  from_username VARCHAR(80) NOT NULL,
  to_username VARCHAR(80) NOT NULL,
  status ENUM('pending','accepted') NOT NULL DEFAULT 'pending',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY ux_friends_pair (from_username, to_username)
);

CREATE TABLE IF NOT EXISTS conversations (
  id CHAR(36) PRIMARY KEY,
  user_a VARCHAR(80) NOT NULL,
  user_b VARCHAR(80) NOT NULL,
  requested_by VARCHAR(80) NOT NULL,
  status ENUM('pending','approved','declined') NOT NULL DEFAULT 'pending',
  kind ENUM('direct','group') NOT NULL DEFAULT 'direct',
  group_name VARCHAR(120) NULL,
  group_avatar_url TEXT NULL,
  pinned_by JSON NULL,
  blocked_by JSON NULL,
  member_usernames JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id CHAR(36) PRIMARY KEY,
  conversation_id CHAR(36) NOT NULL,
  from_username VARCHAR(80) NOT NULL,
  body TEXT NOT NULL,
  image_url TEXT NULL,
  media_type ENUM('image','video') NULL,
  status ENUM('sent','deleted') NOT NULL DEFAULT 'sent',
  deleted_by_username VARCHAR(80) NULL,
  deleted_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notifications (
  id CHAR(36) PRIMARY KEY,
  kind ENUM('event','change','friend','message') NOT NULL DEFAULT 'change',
  title VARCHAR(180) NOT NULL,
  message TEXT NOT NULL,
  to_username VARCHAR(80) NULL,
  action_url TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

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

CREATE TABLE IF NOT EXISTS site_settings (
  id INT PRIMARY KEY,
  theme ENUM('joyful','snow','autumn') NOT NULL DEFAULT 'joyful',
  celebration_title VARCHAR(200) NULL,
  celebration_message TEXT NULL,
  celebration_date VARCHAR(120) NULL
);

INSERT INTO site_settings (id, theme, celebration_title, celebration_message, celebration_date)
VALUES (1, 'joyful', '', '', '')
ON DUPLICATE KEY UPDATE theme = VALUES(theme);
