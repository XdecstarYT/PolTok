# Creative suite v2 — team contract
Context: Owner panel creative tools (src/features/owner/**), card engine (src/lib/cards/**: 58 designs, CardStyle theming, renderCard(designId,data,style?), kit.ts helpers incl. inkOn/wordmark, store-only zip writer), AI (server/ai.js compose tasks post/message/restyle/rewrite/social, shared/compose.js validation, Groq free tier ≤10k-char prompts, auto-model + retries), Social pack (src/features/owner/SocialPack.tsx, shared/social.js).
## Ownership
A DESIGN    src/lib/cards/** (engine + designs)                         — visual quality overhaul
B MOTION    src/lib/motion/** (new), src/features/owner/motion/** (new)  — animated cards & video export
C DIRECTOR  server/ai.js (compose area), shared/compose.js, src/features/owner/** EXCEPT SocialPack.tsx, motion/**, studio/**
D BRAND     src/features/owner/SocialPack.tsx (+ new src/features/owner/brand/**), shared/social.js
The Card Studio editor (src/features/owner/studio/**) is owned by A for engine-facing controls.
Keep renderCard / renderCardCanvas signatures backward compatible (others call them). Add new exports freely.
Real data only on data cards; AI text must never invent facts or fake real people's posts.
Test: `npm run build && NODE_ENV=production PORT=<891X> node server/index.js &` then `kill $!` only (A 8911, B 8912, C 8913, D 8914). tsc + npm test must pass. No git commits. Final report <200 words.
