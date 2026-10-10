# Documentation

## Start here
- [Architecture](architecture.md): components, responsibilities and key flows
- [Local setup](development/setup.md): from a fresh clone to a running stack
- [Repository layout](development/repository-layout.md): what lives where, and the rules for moving things

## Development
- [Testing](development/testing.md): every suite, what it covers and how to run it; CI
- [Test coverage matrix](development/test-matrix.md): page, feature and role → test → result
- [Seed accounts and data](development/seed-data.md): test accounts for every state, how to create, verify and reset them
- [Environment variables](development/environment.md): web and API settings (the single reference)
- [API reference](api/README.md): endpoint groups and conventions; full OpenAPI document in `docs/api/openapi.json`
- [Database migrations](database/migrations.md): Alembic as the only schema authority, revision rules
- [Schema reconciliation](database/schema-reconciliation.md): how the Lovable-era schema references were resolved

## Deployment and operations
- [Deployment](deployment.md): images, first production rollout, releases, rollback
- [External services](external-services.md): what each integration needs and its verification status
- [Security](security.md): controls, scans, accepted risks, required owner actions
- [Database operations](operations/database.md): backup, restore, data copy
- [Observability](operations/observability.md): logs, metrics, error tracking
- [Moderation](operations/moderation.md): granting the moderator role, reviewing reports
- [Pending production actions](operations/production-actions.md)
- [Mobile (Android)](mobile/android-checklist.md), [icons](mobile/icon-requirements.md), [icon setup](mobile/android-icon-setup.md)

## Project history
- [Status](STATUS.md): issues and their state
- [Audit (2026-10)](audit/2026-10-audit.md): the original technical audit, kept as written
- [Functional audit (2026-10-10)](audit/2026-10-functional-audit.md): routes, elements and endpoints by status
