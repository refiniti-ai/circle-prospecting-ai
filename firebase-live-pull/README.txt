Firebase Hosting live pull (circleprospecting.ai)
Pulled: 2026-07-28
Firebase live channel last release: 2026-06-25 14:34:57 (from firebase hosting:channel:list)

These files are what Firebase Hosting is currently serving for the marketing site.
They are NOT the full repo — only static hosting assets.

Live bundle:
  index.html
  assets/index-CRG3IW9G.js
  assets/index-Bzx4oAEF.css

NOT included (served separately):
  Cloud Run API (circle-prospecting-ai-git) — /api/*, /go
  GHL email templates in docs/email-templates/ — manual paste only
  Firestore rules, storage rules — deploy via firebase deploy --only firestore,storage

To compare with local build:
  npm run build
  diff dist/assets vs firebase-live-pull/assets
