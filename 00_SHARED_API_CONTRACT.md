# TalkReady Shared API Contract (Proposed Draft)

> **Status: proposed draft.** This contract is being established from the frontend and backend phase prompts because no prior contract file was supplied. It makes the prompt's explicit requirements concrete; any item labeled "draft" is an agreed proposal for this project and should be reviewed before backend endpoints are implemented.

## 1. Conventions

- API prefix: `/api`.
- JSON requests and responses use UTF-8.
- Protected routes accept `Authorization: Bearer <JWT>`.
- Success envelope: `{ "success": true, "message": "OK", "data": <value>, "pagination": <optional> }`.
- Error envelope: `{ "success": false, "message": "Human-readable message", "errors": [] }`. `errors` contains field validation details when available.
- Paginated responses include `pagination: { page, limit, total, pages }`.
- IDs are opaque strings. Dates are ISO-8601 strings.
- All enum values below are case-sensitive strings.

## 1.4 Shared enums

These are the canonical values for request validation and frontend constants.

| Enum | Values |
|---|---|
| `UserRole` | `student`, `admin` |
| `Category` | `hr`, `technical`, `general`, `communication`, `coding` |
| `Difficulty` | `beginner`, `intermediate`, `advanced` |
| `InterviewMode` | `text`, `voice` |
| `InterviewStyle` | `standard`, `friendly`, `strict`, `rapid-fire` |
| `InterviewStatus` | `draft`, `in_progress`, `paused`, `completed` |
| `Language` | `en`, `te`, `hi` |
| `Theme` | `light`, `dark`, `system` |
| `EvaluationMethod` | `rule-based-v1` |
| `AnswerStatus` | `answered`, `skipped` |
| `AnswerSource` | `text`, `voice`, `offline` |
| `QuestionSource` | `bank`, `notes`, `resume`, `template` |
| `ResumeExtractionStatus` | `pending`, `completed`, `partial`, `failed`, `unsupported` |

`Role` and `Skill` options are data, not enums: fetch them from the API. The category labels may be localized by clients; category keys remain as listed above.

## 2. Shared resource shapes

Fields marked optional may be omitted when unavailable. Password hashes, resume file paths, and extracted resume text are never exposed.

- **User:** `{ id, name, email, role, education, experience, jobRole, careerGoal, skills, preferences, createdAt, updatedAt }`
- **Question:** `{ id, text, category, jobRole, difficulty, language, skill, tags, expectedAnswer, keywords, evaluationCriteria, timeLimitSeconds, isActive }`
- **Interview question snapshot:** `{ questionId, text, expectedAnswer, keywords, timeLimitSeconds, skill, difficulty, source }`
- **Interview:** `{ id, clientId, category, jobRole, difficulty, mode, style, language, duration, questionCount, questions, status, currentIndex, elapsedSeconds, startedAt, pausedAt, completedAt, totalScore, reportId, createdAt, updatedAt }`
- **Answer:** `{ id, interviewId, questionId, questionIndex, answerText, status, source, timeTakenSeconds, voiceMetrics, attempt, evaluation, createdAt, updatedAt }`
- **Evaluation:** `{ score, contentScore, communicationScore, method, breakdown, matchedKeywords, missingKeywords, strengths, weaknesses, suggestions, explanation, sampleAnswer }`
- **Report:** `{ id, interviewId, title, scores, questionResults, strengths, weaknesses, suggestions, communicationAnalysis, method, createdAt, updatedAt }`
- **Note:** `{ id, title, content, topic, tags, createdAt, updatedAt }`
- **Resume:** `{ id, originalName, mimeType, sizeBytes, extracted, extractionStatus, createdAt, updatedAt }`
- **Settings:** `{ language, theme, interviewPreferences, offline: { autoSync, keepRecordings }, notifications }`

Draft interview setup constraints: `duration` is one of `5`, `10`, `15`, `30` minutes; `questionCount` is one of `5`, `10`, `15`. Interview status transitions are `draft -> in_progress -> paused -> in_progress -> completed`; completion is idempotent.

## 3. Endpoint index

All paths below are relative to `/api`. Endpoints explicitly named by the phase prompts are fixed in this draft; paths marked **draft** fill gaps where prompts refer only to endpoint numbers and must be reviewed before implementing those backend phases.

| No. | Method | Path | Access / purpose |
|---:|---|---|---|
| 1 | POST | `/auth/register` | Public; returns `{ user, token }`, HTTP 201 |
| 2 | POST | `/auth/login` | Public; returns `{ user, token }` |
| 3 | POST | `/auth/logout` | Authenticated |
| 4 | GET | `/auth/me` | Authenticated |
| 5 | PUT | `/auth/change-password` | Authenticated; returns a fresh token |
| 6 | GET | `/profile` | Authenticated |
| 7 | PUT | `/profile` | Authenticated; partial profile update |
| 8 | PUT | `/profile/skills` | Authenticated |
| 9 | PUT | `/profile/preferences` | Authenticated |
| 10 | DELETE | `/profile` | Authenticated; body `{ password }` |
| 11 | GET | `/dashboard/stats` | Authenticated |
| 12 | GET | `/dashboard/activity` | Authenticated |
| 13 | GET | `/dashboard/skills` | Authenticated |
| 14 | GET | `/dashboard/recommendations` | Authenticated |
| 15 | GET | `/questions` | Public; filters and pagination |
| 16 | GET | `/questions/categories` | Public; register before `/:id` |
| 17 | GET | `/questions/roles` | Public |
| 18 | GET | `/questions/skills` | Public |
| 19 | GET | `/questions/:id` | Public |
| 20 | POST | `/questions/generate` | Authenticated |
| 21 | GET | `/questions/random` | Public; count 1–20 |
| 22 | POST | `/interviews` | Authenticated; supports idempotent `clientId` |
| 23 | GET | `/interviews` | Authenticated; paginated list |
| 24 | GET | `/interviews/:id` | Authenticated; full interview |
| 25 | PUT | `/interviews/:id` | Authenticated; autosave allowed fields |
| 26 | DELETE | `/interviews/:id` | Authenticated |
| 27 | POST | `/interviews/:id/start` | Authenticated |
| 28 | POST | `/interviews/:id/pause` | Authenticated |
| 29 | POST | `/interviews/:id/complete` | Authenticated; idempotent |
| 30 | POST | `/interviews/:id/answers` | Authenticated; single or bulk submission |
| 31 | GET | `/interviews/:id/answers` | Authenticated; **draft** |
| 32 | GET | `/interviews/:id/answers/:answerId` | Authenticated; **draft** |
| 33 | POST | `/interviews/:id/evaluate` | Authenticated; idempotent evaluation |
| 34 | POST | `/interviews/:id/answers/:answerId/retry` | Authenticated |
| 35 | POST | `/notes` | Authenticated |
| 36 | GET | `/notes` | Authenticated; paginated, searchable |
| 37 | GET | `/notes/:id` | Authenticated |
| 38 | DELETE | `/notes/:id` | Authenticated |
| 35b | PUT | `/notes/:id` | Authenticated; agreed note update |
| 39 | POST | `/resumes` | Authenticated; multipart upload |
| 40 | GET | `/resumes` | Authenticated |
| 41 | GET | `/resumes/:id` | Authenticated |
| 42 | DELETE | `/resumes/:id` | Authenticated |
| 43 | GET | `/reports` | Authenticated; paginated summaries |
| 44 | GET | `/reports/:id` | Authenticated |
| 45 | GET | `/reports/:id/pdf` | Authenticated; PDF download |
| 46 | GET | `/reports/progress` | Authenticated; register before `/:id` |
| 47 | GET | `/settings` | Authenticated; creates defaults if absent |
| 48 | PUT | `/settings` | Authenticated; partial nested merge |
| 49 | DELETE | `/settings/data` | Authenticated; body `{ confirm: "DELETE" }` |
| 50 | GET | `/admin/dashboard` | Admin |
| 51 | POST | `/admin/questions` | Admin |
| 52 | PUT | `/admin/questions/:id` | Admin |
| 53 | DELETE | `/admin/questions/:id` | Admin |
| 54 | GET | `/health` | Public |
| 55 | GET | `/health/database` | Public |

**Draft details requiring confirmation before the corresponding backend phases:** endpoint 31–32 paths, dashboard/report subresource paths, pagination parameter names/defaults, and most request/response field requirements. The Phase 5 scoring weights and local language behavior are proposed in section 4 above and should be mirrored by the backend.

## 4. Selected request and response rules

- **Rule-based scoring proposal (Phase 5):** score components are keyword coverage 30%, relevance 25%, completeness 15%, clarity/structure 15%, and communication 15%. `contentScore` is the weighted mean of the first four components; `score` is the weighted sum of all five. Component values are percentages from 0 to 100. Difficulty word-count thresholds and deterministic text rules are implemented in the frontend local scorer; backend parity tests must use the same examples before production use.
- **Local scoring language behavior:** English answers use case-folded tokenization, light suffix stemming, and a small stop-word list. Telugu and Hindi use exact token matching without English stemming or stop-word removal, and the explanation identifies this fallback.
- **Local scoring method:** local evaluations use `local-rule-based-v1`; server evaluations use `rule-based-v1`. Skipped and empty answers score 0. Interview aggregate scores are the rounded arithmetic mean across all question results, including skipped and unanswered questions as zero.
- Registration body: `{ name, email, password }`. `name` is trimmed and 2–60 characters; `email` is valid and case-insensitive; `password` is at least 8 characters and contains a letter and a number. The server always assigns `student`. HTTP 201 response data is `{ user, token }`.
- Login body: `{ email, password }`. HTTP 200 response data is `{ user, token }`. Unknown email and wrong password return the same HTTP 401 message: `"Invalid email or password."`.
- `GET /auth/me` returns the authenticated user in `data`.
- `POST /auth/logout` returns HTTP 200 after invalidating the current token.
- Change password body: `{ currentPassword, newPassword }`; the new password is at least 8 characters, contains a letter and a number, and differs from the current password. HTTP 200 response data includes a replacement `token`.
- Validation errors use HTTP 400 and `errors: [{ field, message }]`. Duplicate registration email uses HTTP 409.
- An expired or invalid bearer token returns HTTP 401 with `"Session expired, please log in again."`. Credential errors on login and an incorrect current password on change-password do not invalidate an otherwise active client session.
- Question list query supports `page`, `limit`, `category`, `jobRole`, `difficulty`, `skill`, `language`, and `search`.
- Generate body supports setup filters, `count`, optional `skills`, `noteId`, and `resumeId`.
- Answer submissions contain `questionId`, `questionIndex`, `answerText`, `status`, `source`, `timeTakenSeconds`, and optional `voiceMetrics`; answer text is at most 5,000 characters.
- Unknown routes return HTTP 404 with `{ success:false, message:"Route not found", errors:[] }`.
- Expired or invalid authentication returns HTTP 401. Invalid input returns HTTP 400, duplicate resources HTTP 409, and unexpected failures HTTP 500 with a generic message.

## 5. Status and compatibility

This draft is the frontend's working contract for Phases 0–1. Authentication endpoints 1–5 are implemented against it. Before backend feature work begins, review every remaining **draft** item and update this document and both implementations together; do not silently change a path, enum, or response shape.
