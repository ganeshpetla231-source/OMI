# TalkReady Backend

## Prerequisites

- Node.js 20 LTS or newer
- MongoDB Community Server for local/offline use, or MongoDB Atlas
- npm

## Setup

1. `cd Backend`
2. Copy `.env.example` to `.env`.
3. Set `MONGODB_URI`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `CLIENT_URL`/`CLIENT_URLS`, and `MAX_FILE_SIZE_MB`.
4. `npm install`
5. `npm run seed`
6. `npm run dev`

For local/offline use: `MONGODB_URI=mongodb://127.0.0.1:27017/talkready`.
For Atlas: use an Atlas connection string and keep credentials only in `.env`.

## Scripts

- `npm run dev` - start with nodemon
- `npm start` - start normally
- `npm test` - run Jest tests
- `npm run test:coverage` - run tests with coverage
- `npm run e2e` - run the clean-database end-to-end QA flow
- `npm run seed` - seed categories, roles, skills, questions, and admin

## Folder structure

- `config` environment and database configuration
- `controllers` HTTP adapters
- `middleware` auth, validation, upload, sanitization, and error handling
- `models` Mongoose schemas
- `routes` Express route definitions
- `services` business logic and aggregations
- `tests` Jest/Supertest suites
- `docs` API, schema, architecture, and Postman artifacts

See `docs/API_CONTRACT.md`, `docs/DATABASE_SCHEMA.md`, and `docs/PROJECT_ARCHITECTURE.md`.
