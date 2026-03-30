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
- Three-section collapsible form:
  - **Core Geometry (mandatory):** Building type/subtype, area, floors, plot dimensions (4 sides), irregular land toggle + conditional chord field, setbacks (front/side/back), facade direction, ground level difference
  - **Site & Environmental Context (new, optional):** Deed number, plot number, neighbor status per boundary (east/west/south), soil type (rocky/sandy/clay/mixed), budget range (low/medium/high/premium)
  - **Design Preferences (optional, AI suggests when omitted):** Bedroom count, kitchen type (open/closed), stair location (central/side/back), AC type (split/concealed/central)
- Arabic validation errors, area overflow blocking, irregular plot alert
- Image upload support (sketches, site photos, design references) — up to 5 images, converted to base64
- Real-time streaming AI plan generation with vision-capable image analysis
- Session view with layout: User Summary → Architectural Package Status → AI Plan → DXF Download → Image Previews → Discussion → Sticky Chat Input
- **Architectural Package status indicator**: Shows real-time status of all 4 outputs (Plan, DXF, 2D Image, 3D Exterior) with checkmarks as each completes; disappears when all assets are ready
- AI-generated image cards: 2D floor plan + 3D exterior view (DALL-E 3), with coordinate-aware prompts and loading/error states
- DXF download: Auto-generated after plan completion (stored in DB), served instantly. Legacy sessions fall back to on-demand generation. AutoCAD-compatible with ASCII encoding, ACADVER/DWGCODEPAGE(ANSI_1252)/INSUNITS/LUNITS/LUPREC headers, STYLE table (Standard/txt.shx font), proper layer structure
- **Generation phases UI**: During plan generation, shows animated phase indicators (land geometry analysis → spatial layout → architectural design → coordinates → AutoCAD script → engineering rules review) based on elapsed time
- Code block copy buttons for AutoLISP scripts

### `artifacts/api-server` (`@workspace/api-server`)

Express 5 API server.

- Routes: `/api/architecture/` and `/api/openai/` — see API Endpoints above
- Uses `@workspace/integrations-openai-ai-server` for OpenAI gpt-5.2 streaming
- Uses `@workspace/db` for data persistence

### `lib/db` (`@workspace/db`)

Database layer using Drizzle ORM with PostgreSQL. Tables: `conversations`, `messages`, `architecture_sessions`. Architecture sessions include nullable columns for: pre-generated DXF content (dxf_content), AI-generated images (floor_plan_image_url, exterior_image_url), site context (deed_number, plot_number, neighbor_east/west/south, soil_type, budget_range, is_irregular_land), and optional design preferences (ac_type, stair_location, bedroom_count, kitchen_type).

### `lib/api-spec` (`@workspace/api-spec`)

OpenAPI 3.1 spec + Orval codegen. Run: `pnpm --filter @workspace/api-spec run codegen`

### `lib/integrations-openai-ai-server` (`@workspace/integrations-openai-ai-server`)

Server-side OpenAI integration with pre-configured client. Uses `AI_INTEGRATIONS_OPENAI_BASE_URL` and `AI_INTEGRATIONS_OPENAI_API_KEY` env vars (set by Replit).

## Environment Variables

- `DATABASE_URL`, `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE` — PostgreSQL (auto-set by Replit)
- `AI_INTEGRATIONS_OPENAI_BASE_URL` — OpenAI proxy URL (auto-set by Replit AI Integrations)
- `AI_INTEGRATIONS_OPENAI_API_KEY` — OpenAI API key (auto-set by Replit AI Integrations)
- `PORT` — Service port (auto-set per artifact)
