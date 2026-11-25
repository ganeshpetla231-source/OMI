# TalkReady API Contract

Base URL: `{{baseUrl}}/api`
Authentication: `Authorization: Bearer {{token}}`
Success format:

```json
{"success":true,"message":"string","data":{}}
```

Paginated format: `data` plus `pagination: {page, limit, total, totalPages, hasNext, hasPrev}`.
Errors: `{"success":false,"message":"string","errors":[]}`.

## Health

- `GET /health`
- `GET /health/database`

## Authentication

- `POST /auth/register` public, auth rate limited
- `POST /auth/login` public, auth rate limited
- `POST /auth/logout` protected
- `GET /auth/me` protected
- `PUT /auth/change-password` protected

## Profile and settings

- `GET /profile`
- `PUT /profile`
- `DELETE /profile` body `{password}`
- `GET /profile/preferences`
- `PUT /profile/preferences`
- `GET /settings`
- `PUT /settings`
- `DELETE /settings/data` body `{confirm:"DELETE"}`

## Questions

- `GET /questions`
- `GET /questions/categories`
- `GET /questions/roles`
- `GET /questions/skills`
- `GET /questions/random`
- `GET /questions/:id`
- `POST /questions/generate` protected

## Admin questions

- `GET /admin/dashboard`
- `POST /admin/questions`
- `PUT /admin/questions/:id`
- `DELETE /admin/questions/:id`

## Interviews

- `POST /interviews`
- `GET /interviews`
- `GET /interviews/:id`
- `PUT /interviews/:id`
- `DELETE /interviews/:id`
- `POST /interviews/:id/start`
- `POST /interviews/:id/pause`
- `POST /interviews/:id/resume`
- `POST /interviews/:id/complete`

## Answers

- `POST /answers`
- `GET /answers/:id`
- `POST /answers/:id/retry`
- `GET /interviews/:interviewId/answers`
- `POST /interviews/:id/evaluate`

## Notes

- `POST /notes`
- `GET /notes`
- `GET /notes/:id`
- `PUT /notes/:id`
- `DELETE /notes/:id`

## Resumes

Multipart upload field: `resume`. PDF/DOCX/DOC only. PDF and DOCX signatures are verified; DOC is stored as unsupported.

- `POST /resumes`
- `GET /resumes`
- `GET /resumes/:id`
- `DELETE /resumes/:id`

## Dashboard

- `GET /dashboard/stats`
- `GET /dashboard/activity?limit=5`
- `GET /dashboard/skills`
- `GET /dashboard/recommendations`
- `GET /dashboard/overview`
- `GET /dashboard` compatibility summary alias

## Reports and progress

- `GET /reports`
- `GET /reports/progress?period=week|month`
- `GET /reports/:id`
- `GET /reports/:id/download`

Reports are automatically upserted after interview evaluation and recomputation.

## Status behavior

- `401` missing/invalid/expired authentication
- `403` authenticated but forbidden
- `404` missing route or owned resource
- `413` resume exceeds the configured size
- `415` resume type/signature is unsupported
