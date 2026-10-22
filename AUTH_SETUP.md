# VIMO authentication setup

VIMO uses Supabase Auth for email/password accounts, email verification, password recovery, and optional authenticator-app two-factor authentication (TOTP). The browser only uses the Supabase project URL and publishable/anon key; never put a `service_role` key in this app.

## Configure Supabase

1. Create a Supabase project.
2. Copy `.env.example` to `.env` in the project root and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` from the Supabase project API settings. The legacy `VITE_SUPABASE_ANON_KEY` name is also supported.
3. In the Supabase SQL editor, run [`supabase/schema.sql`](./supabase/schema.sql). This creates a public profile row for each new account, enforces case-insensitive unique usernames, and lets signed-in users read profiles while only allowing each user to update their own.
4. In Supabase Auth settings, enable email/password sign-in and email confirmations. Set the site URL to the local Vite URL during development and add that URL to the redirect allow list. Add your production domain before deployment.
5. Configure SMTP in Supabase for production email delivery. The built-in mail service is intended for testing and has sending restrictions.
6. Restart Vite after changing `.env`:

   ```sh
   npm run dev
   ```

## Account behavior

- Registration asks for a username, email, and password. Usernames allow 3–24 lowercase letters, numbers, or underscores; the database enforces uniqueness without regard to case.
- Users sign in using their email and password. Username-based sign-in is not enabled.
- Email verification is sent by Supabase. The confirmation link returns to the app's site URL.
- Password recovery sends a link that returns to the app, where the user can set a new password.
- Signed-in users can optionally enable or disable authenticator-app TOTP from the Account and security dialog. Supabase enforces the second-factor challenge when an enrolled account signs in.

Use Supabase's Auth settings to set password policy, rate limits, CAPTCHA/bot protection, and session controls appropriate for deployment.
