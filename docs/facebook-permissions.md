# Facebook Login Permissions Setup

Use `FACEBOOK_SCOPE` to control requested scopes during development.

- Default: `public_profile,email`
- If your app lacks Advanced Access for `email`, set `FACEBOOK_SCOPE=public_profile` temporarily.

Checklist in Facebook Developers:
- Products > Facebook Login: Enabled
- Facebook Login > Settings > Valid OAuth Redirect URIs:
  - http://localhost:3000/api/auth/callback/facebook
  - or your IP: http://192.168.1.194:3000/api/auth/callback/facebook
- Settings > Basic > App Domains:
  - localhost, 127.0.0.1, or your IP
- Roles: add your testing account as Developer/Tester
- App Review > Permissions and Features:
  - Toggle Advanced Access for `email` (no review required)
