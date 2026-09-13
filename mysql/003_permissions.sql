-- Example privileges for a PHP/Node/Vite app user.
-- Replace `social_app` with your application database user.

CREATE USER IF NOT EXISTS 'social_app'@'localhost' IDENTIFIED BY 'change_me_securely';
GRANT SELECT, INSERT, UPDATE, DELETE ON social_greetings.* TO 'social_app'@'localhost';
FLUSH PRIVILEGES;
 