# Architecture

## Product model

The application is a modular monolith. Organizations enable business modules and install industry packs. Every business record is scoped by `organizationId`; branches provide a second optional boundary.

## Layers

- `apps/web`: mobile and desktop React client
- `apps/api`: REST API, authentication, persistence and audit boundary
- `packages/shared`: shared types, validation schemas and calculation primitives
- `packages/module-registry`: module catalog and dependency resolver
- `packages/industry-packs/upvc`: UPVC defaults and capability manifest

## Core rules

1. Client calculations are previews; the API recalculates authoritative totals.
2. Currency is stored as integer paise.
3. Dimensions are stored as integer millimetres.
4. Approved records retain immutable pricing and configuration snapshots.
5. Organization context is required for tenant-owned records.
6. Industry packs configure the core; they do not own customers, projects, invoices or payments.
7. Approved work changes through revisions or change orders, never silent edits.

## Initial lifecycle

`lead -> project -> measurement -> quote -> approval -> order -> BOM -> production -> installation -> invoice -> payment -> warranty`
