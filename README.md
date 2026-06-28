# HarvestGen People

People is a church member relationship management system for Harvest Generation Church. It serves as the central source of truth for all member data, integrating with connected systems (Shepherd LMS, Drip & Brew Café POS) via a REST API.

**Tech Stack:** Next.js 14 (App Router), TypeScript, Tailwind CSS, shadcn/ui, Supabase (Postgres + Auth + Storage).

---

## Prerequisites

Before you begin, ensure you have the following installed:
- [Node.js](https://nodejs.org/en/) (v20 or higher recommended)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (running in the background)
- [Supabase CLI](https://supabase.com/docs/guides/cli/getting-started) (`brew install supabase/tap/supabase` on Mac)

---

## Project Setup

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Set up Environment Variables**
   Copy the example environment file to create your local `.env` configuration:
   ```bash
   cp .env.example .env.local
   # Note: For Docker builds to work seamlessly locally, ensure your variables are also in a `.env` file.
   cp .env.example .env
   ```

3. **Start the Local Supabase Stack**
   Use the Supabase CLI to spin up the local database, auth, and storage instances via Docker:
   ```bash
   supabase start
   ```
   *(This will output your local API keys and URLs. Ensure these match the values in your `.env` file).*

---

## Running Locally (Development Mode)

To run the Next.js development server with Hot Module Replacement (HMR):

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser. Changes to the code will automatically reload the page.

---

## Running via Docker (Production Simulation)

To run the application exactly as it would behave in a production environment, we use a highly optimized, multi-stage Docker build.

1. **Build the Docker Image**
   This compiles the Next.js app and strips away unnecessary files (like the massive `node_modules` folder):
   ```bash
   docker build -t people-hg .
   ```

2. **Run the Docker Container**
   ```bash
   docker run -p 3000:3000 people-hg
   ```
   The app will be available at [http://localhost:3000](http://localhost:3000).

> **Note on Environment Variables in Docker:** 
> Next.js "bakes" `NEXT_PUBLIC_` environment variables into the frontend bundle during the build step (`npm run build`). For local Docker testing, we allow the `Dockerfile` to read your local `.env` file so the container connects to your local Supabase instance. When deploying to production (e.g., Vercel, AWS), you must provide the production environment variables during the build process.

---

## Architecture Rules & Guidelines

When contributing to this project, please adhere to the rules established in:
- `SPEC.md`: Outlines the API endpoints, database schema, and design system.
- `GEMINI.md`: Core rules for Supabase SSR, App Router conventions, and strict TypeScript usage.
- `AGENTS.md`: Outlines the specific roles (Architect, Backend, Frontend, DevOps) for maintaining separations of concern.
