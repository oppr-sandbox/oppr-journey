# OPPR Customer Journey Tool

A visual customer journey mapping tool for analyzing multi-platform enterprise software experiences. Built for UX teams to map, annotate, and improve cross-platform user flows with AI-powered analysis.

## Features

- **Visual Journey Canvas** — Drag-and-drop screenshot nodes, text annotations, attention blocks, and improvement suggestions on an interactive React Flow canvas
- **Screenshot Management** — Global repository with folders, tags, platform badges; drag screenshots onto the canvas to create nodes
- **Multi-Persona Support** — Define personas with colors, assign them to screens, highlight persona-specific flows
- **AI Analysis (Gemini)** — Chat with AI about your journey, generate gap analysis reports, AI UX walkthroughs that comment on every screen, AI-generated improvement suggestions
- **Improvement Tracking** — Create improvement nodes, connect them to screens, 3-state workflow (Open / In Progress / Closed), assignees, interactive task checklists with progress tracking
- **Improvements Hub** — Cross-board dashboard with table and Kanban views, drag-and-drop status changes, statistics, filters, inline detail expansion
- **Board Versioning** — Clone boards to create versioned snapshots, apply AI-proposed changes as new versions
- **Comments System** — Per-node comments and per-improvement comment threads
- **AI Prompt Configuration** — Customize all AI prompts from the dashboard
- **Tools Context** — Define tool/product descriptions that get injected into all AI analyses
- **Slack Integration** — Notifications when improvements are created or status changes (optional)
- **Team Management** — Clerk-based authentication, user profiles, @oppr.ai domain restriction

## Tech Stack

- **Frontend**: Next.js 16, React 19, TypeScript, Tailwind CSS 4
- **Canvas**: React Flow (@xyflow/react v12)
- **Backend**: Convex (real-time database, serverless functions)
- **Auth**: Clerk
- **AI**: Google Gemini API
- **State**: Zustand + Zundo (undo/redo)

## Prerequisites

- Node.js 18+
- npm
- A [Convex](https://convex.dev) account
- A [Clerk](https://clerk.com) account
- A [Google AI Studio](https://aistudio.google.com) API key (for Gemini)

## Local Development Setup

### 1. Clone and install

```bash
git clone https://github.com/your-org/oppr-journey.git
cd oppr-journey
npm install
```

### 2. Set up Clerk

1. Create a Clerk application at [clerk.com](https://clerk.com)
2. In your Clerk dashboard, go to **User & Authentication > Email, Phone, Username**
3. Optionally restrict sign-ups to your domain (e.g., `@oppr.ai`)
4. Copy your **Publishable Key** and **Secret Key**

### 3. Set up Convex

```bash
npx convex dev
```

This will:
- Prompt you to log in to Convex (create a free account if needed)
- Create a new project
- Generate your deployment URL
- Start syncing your schema and functions

Leave this running in a terminal — it watches for changes.

### 4. Configure environment variables

Copy the example file:

```bash
cp .env.local.example .env.local
```

Fill in your values:

```env
NEXT_PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud
CONVEX_DEPLOYMENT=dev:your-deployment
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxx
CLERK_SECRET_KEY=sk_test_xxx
```

### 5. Set Convex environment variables

In the [Convex dashboard](https://dashboard.convex.dev), go to your project > **Settings > Environment Variables** and add:

| Variable | Required | Description |
|----------|----------|-------------|
| `GEMINI_API_KEY` | Yes | Google AI Studio API key for Gemini |
| `SLACK_ENABLED` | No | Set to `"true"` to enable Slack notifications |
| `SLACK_BOT_TOKEN` | No | Slack bot token (`xoxb-...`) |
| `SLACK_CHANNEL_ID` | No | Slack channel ID to post to |
| `APP_BASE_URL` | No | Your deployed app URL (for Slack links) |

### 6. Start the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 7. Seed sample data (optional)

To populate sample journey boards:

```bash
npx convex run seedIAMJourney:seed
npx convex run seedLOGSJourney:seed
```

## Production Deployment

### Deploy Convex to Production

```bash
npx convex deploy
```

This creates a production deployment. Note the production URL.

Set the same environment variables (GEMINI_API_KEY, etc.) in the **production** deployment's settings in the Convex dashboard.

### Deploy to Vercel

1. Push your code to GitHub
2. Import the repository in [Vercel](https://vercel.com/new)
3. Set these environment variables in Vercel:

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_CONVEX_URL` | Your **production** Convex URL |
| `CONVEX_DEPLOYMENT` | `prod:your-deployment-name` |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Your Clerk publishable key |
| `CLERK_SECRET_KEY` | Your Clerk secret key |

4. Deploy

### Post-Deployment

- Update `APP_BASE_URL` in Convex env vars to your Vercel URL (for Slack links)
- Update Clerk's allowed redirect URLs to include your Vercel domain
- Run the status migration if upgrading from an older version:
  ```bash
  npx convex run improvements:migrateStatusValues
  ```

## Project Structure

```
convex/                  # Backend (Convex functions)
  schema.ts              # Database schema (17 tables)
  boards.ts              # Board CRUD, archive, cleanup
  nodes.ts / edges.ts    # Canvas nodes and edges
  improvements.ts        # Improvement tracking
  improvementTodos.ts    # Interactive task checklists
  improvementComments.ts # Per-improvement comments
  gemini.ts              # AI actions (chat, reports, walkthrough, improvements)
  slack.ts               # Slack notification actions
  versions.ts            # Board versioning and cloning
  promptTemplates.ts     # Configurable AI prompts
  tools.ts               # Tool/product context definitions
  users.ts               # User management
  ...

src/app/
  page.tsx               # Dashboard (journeys, improvements, screenshots, users, config)
  board/[boardId]/       # Canvas view
  sign-in/ sign-up/      # Clerk auth pages

src/components/
  board/                 # Canvas components
    FlowCanvas.tsx       # Main canvas with React Flow
    Toolbar.tsx          # Canvas toolbar
    ImprovementsPanel.tsx # Right panel improvements tab
    ...
  dashboard/             # Dashboard tab components
    ImprovementsHub.tsx  # Cross-board improvements view
    ConfigurationPanel.tsx
    ...
  nodes/                 # Custom React Flow node types
    ScreenshotNode.tsx
    ImprovementNode.tsx
    AttentionNode.tsx
    ...
  shared/                # Reusable components
    ImprovementTodoList.tsx
    ImprovementCommentThread.tsx
    ...

src/store/               # Zustand stores
src/lib/                 # Utilities
```

## License

Private — OPPR internal tool.
