# Avin Business Suite

Avin Business Suite is a modular, multi-organization platform for estimates, projects, purchasing, production, installation, billing, and service. UPVC is the first industry pack; the core domain is intentionally industry-neutral.

## Current foundation

- React, Vite, TypeScript, Tailwind CSS and Zustand web application
- Express, TypeScript, Mongoose, Zod and JWT API
- Organization-scoped data model and request context
- Module registry with dependency validation
- Organizations, users, memberships, clients, brands, projects and quotations
- Shared money, measurement and formula utilities
- Initial UPVC industry-pack manifest
- API health and bootstrap endpoints

## Requirements

- Node.js 20 or newer
- npm 10 or newer
- MongoDB locally or a MongoDB Atlas connection string

## Setup

```bash
copy .env.example .env
npm install
npm run dev
```

Web: `http://localhost:5173`

API: `http://localhost:4000/api/v1/health`

## Validation

```bash
npm run typecheck
npm test
npm run build
```

See `docs/ARCHITECTURE.md` and `docs/ROADMAP.md` for implementation boundaries and next phases.
