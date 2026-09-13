# MySQL migration files

This folder contains the MySQL migration set for the Social Greetings Next.js app.

The app uses a server-side MySQL API route for CRUD operations. Copy `.env.example` to `.env.local`, set the connection values, and keep database credentials server-only:

- `DB_HOST`
- `DB_PORT`
- `DB_NAME`
- `DB_USER`
- `DB_PASSWORD`
- `NEXT_PUBLIC_DB_ENABLED=true`

Suggested import order:

1. `001_schema.sql`
2. `002_seed.sql`
3. `003_permissions.sql`
4. `004_group_profiles.sql`
5. `005_chat_media_controls.sql`
6. `006_password_requests.sql`

Restart the Next.js server after changing `.env.local`. The browser-local fallback remains available when `NEXT_PUBLIC_DB_ENABLED=false`.
