USE social_greetings;

-- Admin profile seed
INSERT INTO profiles (id, username, display, password_hash, role, ban_status, ban_reason, ban_until, created_at)
VALUES ('u-admin', 'riogen02', 'Admin', '735dc0cbe264914cd718ae17e7e8d50220606d366736c5969585acddff35bf7b', 'admin', 'active', NULL, NULL, NOW())
ON DUPLICATE KEY UPDATE display = VALUES(display), password_hash = VALUES(password_hash), role = VALUES(role);

INSERT INTO greetings (id, from_name, from_id, to_username, message, type, created_at)
VALUES ('g1', 'Team', NULL, 'Everyone', 'Welcome to Social Greetings! Send a smile today.', 'banner', NOW())
ON DUPLICATE KEY UPDATE message = VALUES(message);

INSERT INTO banners (id, title, image, link, reactions, comments, created_at)
VALUES ('b1', 'Share a joyful greeting', '/images/banner-default.svg', '/greet', '[]', '[]', NOW())
ON DUPLICATE KEY UPDATE title = VALUES(title), image = VALUES(image), link = VALUES(link);

INSERT INTO notifications (id, kind, title, message, to_username, created_at)
VALUES ('n1', 'change', 'Site is live', 'Social Greetings is ready. Be kind and have fun!', NULL, NOW())
ON DUPLICATE KEY UPDATE title = VALUES(title), message = VALUES(message);
