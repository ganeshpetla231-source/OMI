# TalkReady Backend Architecture

The backend is an Express 5 REST API using Mongoose and MongoDB.

## Request flow

`routes -> middleware (auth/validation/upload/sanitization) -> controllers -> services -> Mongoose models -> MongoDB`

Shared middleware provides JWT authentication, validation, pagination, error formatting, rate limits, Helmet security headers, CORS, and Mongo-key sanitization.

## Functional areas

- Authentication and account lifecycle
- Profile/settings and owner-isolated user data
- Question bank and rule-based generation
- Interview state machine and answer submission
- Rule-based scoring and report upsert
- Notes/resume parsing and resume question generation
- Dashboard/report aggregation and PDF streaming
- Cascade deletion for account learning data

## Data ownership

Every personal model includes `user`. Read/update/delete operations constrain queries to `req.user.id`. Resume files are stored outside public static routes and may only be accessed through protected APIs.

## Deployment

Run Node behind a reverse proxy with TLS. Supply a strong `JWT_SECRET`, Atlas/local MongoDB URI, allowed frontend origins, and a persistent writable upload volume. Back up MongoDB and resume uploads together.
