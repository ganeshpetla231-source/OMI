# TalkReady

TalkReady is an offline-first mock interview practice application.

Students can organize study notes and use them to generate offline practice questions. Resume upload and server-side extraction are available to signed-in users while online.

The Profile and Settings pages support guest/offline persistence, interview defaults, app-wide English/Telugu/Hindi selection, data export, and confirmed data deletion. Offline edits for signed-in accounts are queued for synchronization; account and server-data deletion require an internet connection.

Admins can review usage and manage questions at `/admin`; `/admin/questions` provides validated create/edit/duplicate/delete and JSON import/export tools. These routes are guarded by the frontend role check, while the API remains responsible for enforcing admin authorization.

Communication practice is available at `/practice`, with self-introduction, guided STAR, filler-word, speaking-pace, and daily challenge drills using the normal interview and report flow. Practice question content is currently English; voice recognition needs a supported browser and usually internet.

Hindi and Telugu translations are complete in key coverage. New Profile and Settings translations are listed for native-speaker review in [`Frontend/src/i18n/NEEDS_NATIVE_REVIEW.md`](./Frontend/src/i18n/NEEDS_NATIVE_REVIEW.md).

## Frontend setup

The React/Vite frontend lives in [`Frontend/`](./Frontend/).

```powershell
cd Frontend
npm install
Copy-Item .env.example .env
npm run dev
```

Set `VITE_API_URL` to the backend API base URL and `VITE_USE_MOCK` to `true` or `false` in `Frontend/.env`. Authentication and guest mode are implemented in Phase 1; mock accounts are stored in this browser and mock passwords are stored as salted Web Crypto PBKDF2 digests.

For mock-mode manual testing, set `VITE_USE_MOCK=true` in `Frontend/.env`, then run `npm run dev`. Register an account, refresh to verify session restoration, sign out and back in, or choose **Try as guest** to verify the persistent guest notice.

Run the frontend checks from `Frontend/`:

```powershell
npm test
npm run build
```

## API contract

[`00_SHARED_API_CONTRACT.md`](./00_SHARED_API_CONTRACT.md) is the proposed shared contract draft. Its open draft decisions should be reviewed before implementing backend feature endpoints.

## Project documentation

- [Project architecture](./docs/PROJECT_ARCHITECTURE.md)
- [Development guide](./docs/DEVELOPMENT_GUIDE.md)
- [User manual and manual QA checklist](./docs/USER_MANUAL.md)

## Known limitations

- Voice recognition may depend on the browser vendor's network service and is not available in every browser. Text interview mode is the fallback.
- Resume extraction requires an authenticated account and an available backend.
- Local mock questions and practice question content do not populate or translate the remote question bank.
- The frontend admin guard is only a usability layer; the server must enforce permissions.
- Lighthouse scores and a real-backend end-to-end run have not been reported unless run against a deployment; see the manual QA checklist.
