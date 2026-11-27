# Project architecture

TalkReady is a React 18 single-page application built with Vite. Its frontend is in `Frontend/src`; `00_SHARED_API_CONTRACT.md` is the proposed API contract for a separately deployed backend.

## Application flow

- `src/main.jsx` mounts the providers and router.
- `src/routes/AppRoutes.jsx` declares routes and lazy-loads page modules. `src/layouts/AppLayout.jsx` provides authenticated/guest navigation and shared status indicators.
- Page components call domain APIs in `src/services/api`, not HTTP directly. The API facade selects real or mock services and applies local fallbacks where supported.
- `src/context` owns cross-page auth, language, theme, offline, and active-interview state. Focused reusable UI lives under `src/components`.
- English, Hindi, and Telugu UI strings live in `src/i18n`. User-generated notes and question content are distinct from translated UI.

## Interview and practice data

The interview setup and communication-practice page both create normal interview resources through `interviewsApi`. The readiness page starts them; `InterviewContext` persists answers, submits them through `answersApi`, and requests the report evaluation. Communication practice supplies one communication-category question and drill metadata; it does not create a second scoring engine or endpoint.

Offline interviews and answers use IndexedDB through `src/services/offline/db.js`. `localInterviewStore.js` selects questions and saves snapshots; `localScorer.js` evaluates answers and aggregates local reports; `syncQueue.js` retries eligible account operations. Guests remain local. The daily communication streak is stored in the scoped `settings` object store.

`src/assets/seed/questions.en.json` is the local English question bank. If seed content changes, increment the question-cache seed version in `src/services/offline/localQuestions.js` so existing browsers receive the additions.

## Validation and testing

Run unit/component tests and a production build from `Frontend/`:

```powershell
npm test -- --run
npm run build
```

Tests use Vitest, Testing Library, jsdom, fake IndexedDB, and API mocks. Vite's production build prints the generated asset sizes and PWA precache summary.

## Known limitations

- Browser speech recognition is not universally supported and commonly relies on a browser-vendor network service. Voice features need a supported browser, microphone access, and internet; typed answers remain available.
- Resume parsing requires an authenticated user and a reachable backend.
- Communication-practice questions are currently English content, independently of the selected UI language.
- Real interview creation must accept a one-question communication interview and the backend question bank must include the communication seeds. Real admin routes must enforce admin authorization on the server.
- Lighthouse scores and the full real-backend click-through require a running deployment and a supported browser; do not infer those results from unit tests or a successful build.
