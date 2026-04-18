# Changesets

This workspace uses Changesets metadata for release intent and draft generation.

- Package-facing API or behavior changes under `packages/*` should include a changeset entry.
- Service-only changes under `apps/bff-server` still require root changelog updates, but do not have to publish packages.
