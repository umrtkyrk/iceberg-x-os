# Upstream refresh: 15 November 2026

Source: yemrealtanay/iceberg-x-os main at 1a2a6cf4ecb8a5beca036f60d185b46f929309be.
Target: a review branch in umrtkyrk/iceberg-x-os, proposed into forum-mvp.

Imports scoring v2, disciplines/rubrics/scorecard editing and score history,
Cube scores/check-ins/quest integration, staff directory sorting, activity
tracking, mentor signals and workspace dark-theme updates. Feature flags retain
their upstream defaults; importing code does not enable a production rollout.

Preserves private rooms, member-only files, emoji/reactions, message replies,
editing/deletion, read/typing status, unread badges, liker lists and fork workflow
rules. Schema resolution includes both upstream scoring/activity relations and
private-chat relations. Dark-mode styling covers private chat surfaces too.

The empty local installer baseline now includes the reviewed portal schema
through 20261116160000_scoring_v2_engine. Existing databases with unapplied
non-forum migrations are still refused and require a separate reviewed upgrade.
Historical SQL files are imported unchanged. Database test fixtures remove only
Forum models from the full schema, retaining new scoring/activity model references.

Validation: backend/frontend production builds, general backend tests, 17 backend
forum tests, 24 frontend forum tests, feature-flag-off checks, real PostgreSQL
forum/chat/file/unread integration and guarded migration suites passed. Migration
checks cover empty setup, full schema parity, preserved older data and idempotent
upgrade. No production database change, deployment or upstream write performed.
