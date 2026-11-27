# TalkReady user manual

## Start practicing

1. Open TalkReady and choose **Try as guest** or create/sign in to an account.
2. From the dashboard, choose **Start first interview** for a general interview or open **Communication practice** for a focused drill.
3. In communication practice, choose Text or Voice when voice is supported and online. Select a drill and start its one-question interview.
4. Review the readiness screen. For voice, test the microphone and speaker when offered; otherwise switch to Text mode.
5. Answer the question, submit it, and finish the interview. The result screen links to detailed results and explains the evaluation method.
6. Open Reports to review scores, answer feedback, communication measurements, and progress. Local/offline reports are identified as device-scored.

## Communication drills

- **Self-introduction:** give a concise introduction connected to a role or goal.
- **STAR method:** fill in Situation, Task, Action, and Result. The combined answer is scored by the normal communication-category evaluator, which checks STAR structure.
- **Filler-word reduction:** type or speak and watch the filler count. Try replacing filler words with a short pause.
- **Speaking pace:** use Voice mode to see measured words per minute. Browser recognition may need internet and is not supported everywhere.
- **Daily speaking challenge:** answer the rotating communication question. Completing an answered attempt updates the locally stored streak; skipped or blank attempts do not.

Practice questions are currently in English. Changing the UI language does not translate question-bank content.

## Notes, resumes, and offline use

- Notes can be created and edited offline. Account changes wait in the sync queue until the server is reachable.
- Resume upload and server-side parsing require an account and internet. The browser validates the file first; the server remains authoritative.
- The app can use cached questions and local scoring for the core interview flow offline. Local data is stored in this browser profile; clearing browser storage can remove it.
- Voice recognition is a browser service and may require internet. If it is unsupported or unavailable, use Text mode. TalkReady does not save microphone audio.

## Settings and account

Use Settings to change the UI language, theme, interview defaults, offline synchronization, and data preferences. Export data before deleting it if you want to keep a copy. Destructive account/data actions require the confirmation shown by the app and may require internet.

## Manual end-to-end QA checklist

Run against a disposable test account and a backend configured with the shared API contract. Record the browser, viewport, backend version, and any failures; do not treat a mock run as real-backend validation.

1. **Guest and offline interview**
   - Enter as guest, open an interview setup, and start an interview using cached questions.
   - In browser developer tools, switch Network to Offline and hard reload.
   - Confirm the app shell loads, answer and finish the interview, then open its local report.
   - Restore network and verify the sync queue's status. Guest data should remain local and should not be uploaded.
2. **Account, resume, and voice**
   - Restore network, register a disposable account, and upload a small supported PDF.
   - Confirm progress, extracted sections/status, and question generation.
   - Start a voice interview in a supported browser, allow microphone access only when asked, and verify transcript editing and saved pace/filler/pause metrics.
   - Open the report and use the PDF download/print action.
3. **Progress and preferences**
   - Open report history and progress; verify CSV export.
   - Change the theme and UI language. Confirm navigation, practice controls, reports, and settings update together; question content may remain English.
4. **Data deletion**
   - Export user data first. Use the typed confirmation for Delete all data and verify local data is cleared while the account remains.
   - Test account deletion only with a disposable account and the required password confirmation.
5. **Admin authorization**
   - With an admin account, create/edit/delete a test question and confirm it is available in the question bank.
   - With a student account, open `/admin` directly and confirm the 403 experience. Verify the backend independently rejects non-admin API calls.
6. **Responsive and accessibility sweep**
   - Repeat core flows at viewport widths 360, 768, 1024, and 1440 px.
   - Keyboard through navigation, setup, dialogs, answer controls, and report actions; check focus return, visible focus, labels, contrast in both themes, and reduced-motion behavior.
   - Capture console errors and React warnings. Run Lighthouse on the deployed/preview app and record the actual PWA, Accessibility, and Performance scores; no scores should be inferred from this checklist.
