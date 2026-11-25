# TalkReady Database Schema

MongoDB is accessed through Mongoose. ObjectId relationships use refs and explicit owner fields.

## User

Fields: `name`, unique lowercase `email`, `passwordHash` (select false), `role`, `tokenVersion`, `education`, `experience`, `jobRole`, `careerGoal`, `skills[]`, nested preferences, timestamps.

Indexes: unique email.

## Settings

Fields: owner `user`, language/theme/interview preferences, notifications, privacy, offline settings, timestamps.

Indexes: unique user.

## Category

Fields: `key`, `label`, `description`, `isActive`, timestamps.

## JobRole

Fields: `key`, `label`, `description`, `isActive`, timestamps.

## Skill

Fields: unique lowercase `key`, `label`, `jobRoles[]`.

## Question

Fields: `seedKey`, question text, category, role, skill, difficulty, language, expected answer, keywords, tags, evaluation criteria, time limit, source, active flag, timestamps.

Indexes: category/role/skill/difficulty/language/active compound; text index; seed key index.

## Interview

Fields: owner `user`, optional `clientId`, duration, question count, category, difficulty, language, role, skills, mode/style, note/resume references, frozen question snapshots, status, elapsed data, timestamps, scores, `reportId`, and client evaluation.

Indexes: user/created; unique sparse user/client; report reference.

## Answer

Fields: interview, owner user, question id/index, answer text/status/source/time/voice metrics, attempt history, evaluation, timestamps.

Indexes: unique interview/question; user; interview.

## Report

Fields: unique `interview`, owner `user`, title, total/content/communication scores, question results, strengths, weaknesses, suggestions, communication analysis, method, timestamps.

Indexes: unique interview; user/created; interview/user.

## Note

Fields: owner user, title, content, topic, tags, timestamps.

Indexes: text title/content; user/topic/created compound.

## Resume

Fields: owner user, original/stored names, MIME type, size, file path, extracted text (select false), extracted education/skills/projects/experience, extraction status, timestamps.

Indexes: user/created.
