# Development guide

## Run the frontend

Use Node.js supported by the installed Vite version. From the repository root:

```powershell
Set-Location .\Frontend
npm install
Copy-Item .env.example .env
npm run dev
```

Set the following Vite variables in `Frontend/.env`:

| Variable | Purpose | Example |
|---|---|---|
| `VITE_API_URL` | Backend API base URL, including `/api` | `http://localhost:5000/api` |
| `VITE_USE_MOCK` | Select mock services when exactly `true`; otherwise use real API services | `true` |

Never put credentials or private keys in Vite variables: values are bundled into browser code.

## Mock and real service modes

- **Mock:** set `VITE_USE_MOCK=true`. Mock auth, questions, interviews, and reports are browser-local; this mode is useful without a backend.
- **Real:** set `VITE_USE_MOCK=false` and point `VITE_API_URL` at a backend that implements the shared contract. Some services support local/offline fallback for network errors; this is not a replacement for server authorization.
- Guest interviews and notes are stored locally. Authenticated offline changes may be queued for synchronization. Resume parsing and browser speech recognition are not guaranteed offline.
- After changing `.env`, restart the Vite dev server.

## Folder conventions

- `src/pages`: route-level screens.
- `src/routes`: route configuration and access guards.
- `src/components`: shared, feature-oriented UI.
- `src/context` and `src/hooks`: cross-page state and reusable React behavior.
- `src/services/api`: real/mock/offline-aware domain service facades.
- `src/services/mock`: mock implementations.
- `src/services/offline`: IndexedDB, local scoring, and synchronization.
- `src/assets/seed`: local seed data; do not duplicate question data in page components.
- `src/i18n`: locale JSON, with matching keys across `en.json`, `hi.json`, and `te.json`.

## Add common product data and UI

### Category, role, skill, or question

1. Add local question records to `src/assets/seed/questions.en.json` only when they are part of the seeded offline bank. Keep each question's category, role, skill, language, expected answer, keywords, criteria, and time limit complete.
2. Update backend seed data and contract validation in the backend project when applicable. The frontend seed alone does not populate a remote database.
3. Increment `SEED_VERSION` in `src/services/offline/localQuestions.js` when adding/changing seed records so existing clients refresh the cached bank.
4. Fetch remote taxonomy using `questionsApi`; do not hardcode a separate role or skill list in a page.

### Language

1. Add the same keys to all three locale JSON files, including validation, empty/error, and accessibility text.
2. Keep question-content language separate from UI language.
3. Add wording to `src/i18n/NEEDS_NATIVE_REVIEW.md` when a translation has not been reviewed by a native speaker.

### Page or route

1. Add the path to `src/config/routes.js`.
2. Lazy-load the page in `src/routes/AppRoutes.jsx`; apply the existing guest/account/admin guard appropriate to its data.
3. Add navigation only for a page that exists, and use translation keys for visible labels.
4. Keep HTTP requests in a service module. Add focused component/service tests alongside the feature.

### Setting

1. Define defaults and persistence in the existing settings service/context rather than a page-only constant.
2. Handle local guest/offline settings and authenticated server updates consistently.
3. Add translations, validation, feedback, and tests for persistence and failure.

## Checks and bundle review

```powershell
npm test -- --run
npm run build
npm run preview
```

The build output reports each generated asset's raw and gzip size. Check that route modules remain lazy and that charting libraries are dynamically imported on pages that use charts. `npm run preview` serves the production output locally; stop it with Ctrl+C after browser checks.

### Phase 11 verification record

- Frontend tests: **50 files, 155 tests passed**.
- Locale parity: **911 keys** across English, Hindi, and Telugu.
- Production build (real API mode): entry **386.38 kB raw / 100.95 kB gzip**, React vendor **142.47 / 45.86 kB**, router vendor **64.51 / 21.93 kB**, and lazy chart chunk **409.81 / 112.11 kB**. The generated PWA precache contained **68 files (1,280.93 KiB)**. The chart remains separately loaded rather than inflating the initial entry chunk.
- Mock-mode preview: completed a guest, one-question communication interview through a local rule-based score and detailed report. An offline hard reload of that report succeeded and showed the server-unreachable indicator.
- Responsive route smoke check: **52 route/viewport combinations** across 360, 768, 1024, and 1440 px rendered a page heading without horizontal overflow. This is a layout smoke check, not a keyboard-only or visual accessibility audit.
- No real backend was available. Admin authorization against a server, authenticated sync/resume flows, a full console audit, and keyboard/reduced-motion checks remain unverified. Lighthouse was not run, so no Lighthouse scores are claimed.
