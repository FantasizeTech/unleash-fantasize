# Fantasize Technology Unleash fork

Modified 2026-09-22 from Unleash v8.2.0 (66d4a45c1d24c4bc8a08d8c75d205bd61dc3aed0).
Licensed AGPL-3.0-or-later; see LICENSE. Original copyright notices are retained.

This fork adds OSS project creation, ID validation, project listing and general
settings updates, archive/revive/delete and feature movement using the existing
transactional services, permissions and audit log. CREATE_PROJECT is required to create, UPDATE_PROJECT to edit. Project count
uses the existing UNLEASH_PROJECTS_LIMIT (default 500). Project IDs are immutable.
Existing open-project access semantics are preserved; this is not private-project
or enterprise RBAC support. SDK tokens remain scoped by project and environment.

Source: https://github.com/FantasizeTech/unleash-fantasize

Existing projects, flags and tokens require no schema migration. Deploy to staging
first. Keep production login off. Store release images in Harbor and pass tests,
coverage and SonarQube before image build; verify images before deployment.
Only Jenkins runs CI; upstream GitHub Actions are not used.
