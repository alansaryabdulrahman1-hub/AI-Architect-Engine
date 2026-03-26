# Workspace

## Overview

pnpm workspace monorepo using TypeScript. This is an AI-powered architectural planning engine ("مخطط AI") that helps users generate detailed architectural floor plans using OpenAI.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **AI**: OpenAI via Replit AI Integrations (gpt-5.2, streaming SSE)
- **Frontend**: React + Vite, Tailwind CSS v4, RTL Arabic UI, react-markdown, framer-motion

## Architecture (مخطط AI)

The app allows users to enter building details (type, subtype, area, floors, extra requirements) and generates a detailed AI architectural plan via streaming SSE.

- `artifacts/arch-planner/` — React+Vite frontend (RTL Arabic UI, dark theme)
- `artifacts/api-server/` — Express API server with AI routes
- `lib/integrations-openai-ai-server/` — OpenAI integration (gpt-5.2 streaming)
- `lib/db/src/schema/architecture_sessions.ts` — Architecture sessions table
- `lib/db/src/schema/conversations.ts` — Conversations table
- `lib/db/src/schema/messages.ts` — Messages table

## Structure

```text
artifacts-monorepo/
├── artifacts/              # Deployable applications
│   ├── api-server/         # Express API server
│   └── arch-planner/       # AI Architecture Planner frontend
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   ├── db/                 # Drizzle ORM schema + DB connection
│   ├── integrations-openai-ai-server/ # OpenAI server-side integration
│   └── integrations-openai-ai-react/  # OpenAI React hooks
├── scripts/                # Utility scripts
├── pnpm-workspace.yaml     # pnpm workspace
├── tsconfig.base.json      # Shared TS options
├── tsconfig.json           # Root TS project references
└── package.json            # Root package
```

## API Endpoints

All routes under `/api`:

- `GET /api/healthz` — Health check
- `GET /api/architecture/sessions` — List all planning sessions
- `POST /api/architecture/sessions` — Create session + stream AI plan (SSE)
- `GET /api/architecture/sessions/:id` — Get session
- `DELETE /api/architecture/sessions/:id` — Delete session
- `GET /api/architecture/sessions/:id/dxf` — Download DXF file for AutoCAD
- `POST /api/architecture/sessions/:id/followup` — Follow-up question (SSE stream)
- `GET /api/openai/conversations` — List conversations
- `POST /api/openai/conversations` — Create conversation
- `GET /api/openai/conversations/:id` — Get conversation with messages
- `GET /api/openai/conversations/:id/messages` — List messages

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all lib packages as project references.

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build` in all packages
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly` using project references

## Packages

### `artifacts/arch-planner` (`@workspace/arch-planner`)

React+Vite frontend with full RTL Arabic support. Dark professional theme inspired by modern AI tools.

- Sidebar with session history
- Comprehensive form with all-required engineering fields:
  - Building type/subtype, area, floors (3 options: ground_only, ground_first, ground_first_annex)
  - Plot dimensions (4 sides + chord), setbacks (front/side/back)
  - Program: bedroom count, kitchen type (open/closed), stair location (central/side/back)
  - Environment: facade direction (N/S/E/W), AC type (split/concealed/central), ground level difference
- Arabic validation errors, area overflow blocking, irregular plot alert
- Image upload support (sketches, site photos, design references) — up to 5 images, converted to base64
- Real-time streaming AI plan generation with vision-capable image analysis
- Session view with chat layout: AI plan at top, sticky input at bottom, follow-up messages in between
- AI-generated image cards: 2D floor plan + 3D exterior view (DALL-E 3), with loading/error states
- DXF download button for AutoCAD-compatible file export (parses coordinates from AI plan)
- Code block copy buttons for AutoLISP scripts

### `artifacts/api-server` (`@workspace/api-server`)

Express 5 API server.

- Routes: `/api/architecture/` and `/api/openai/` — see API Endpoints above
- Uses `@workspace/integrations-openai-ai-server` for OpenAI gpt-5.2 streaming
- Uses `@workspace/db` for data persistence

### `lib/db` (`@workspace/db`)

Database layer using Drizzle ORM with PostgreSQL. Tables: `conversations`, `messages`, `architecture_sessions`. Architecture sessions include `floor_plan_image_url` and `exterior_image_url` nullable columns for AI-generated images.

### `lib/api-spec` (`@workspace/api-spec`)

OpenAPI 3.1 spec + Orval codegen. Run: `pnpm --filter @workspace/api-spec run codegen`

### `lib/integrations-openai-ai-server` (`@workspace/integrations-openai-ai-server`)

Server-side OpenAI integration with pre-configured client. Uses `AI_INTEGRATIONS_OPENAI_BASE_URL` and `AI_INTEGRATIONS_OPENAI_API_KEY` env vars (set by Replit).

## Environment Variables

- `DATABASE_URL`, `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE` — PostgreSQL (auto-set by Replit)
- `AI_INTEGRATIONS_OPENAI_BASE_URL` — OpenAI proxy URL (auto-set by Replit AI Integrations)
- `AI_INTEGRATIONS_OPENAI_API_KEY` — OpenAI API key (auto-set by Replit AI Integrations)
- `PORT` — Service port (auto-set per artifact)
