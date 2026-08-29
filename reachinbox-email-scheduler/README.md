# 🚀 ReachInbox — Production-Grade Email Scheduler

> **No cron jobs are used anywhere in this system.** All scheduling is driven entirely by BullMQ delayed jobs with persistent Redis storage and atomic PostgreSQL state claiming.

A full-stack, distributed email scheduling platform built with TypeScript, Node.js, Express, PostgreSQL (Prisma), Redis, BullMQ, Nodemailer (Ethereal), Elasticsearch, React (Vite + Tailwind CSS), Google OAuth 2.0, Slack OAuth & Alerts, and Bull Board queue monitoring.

---

## 📑 Table of Contents
1. [Architecture Overview](#-architecture-overview)
2. [Tech Stack](#-tech-stack)
3. [Folder Structure](#-folder-structure)
4. [Prerequisites](#-prerequisites)
5. [Quick Start with Docker](#-quick-start-with-docker)
6. [Environment Variables](#-environment-variables)
7. [Running the Application](#-running-the-application)
8. [Core Architectural Mechanics](#-core-architectural-mechanics)
   - [BullMQ Scheduling (No Cron)](#1-bullmq-scheduling-no-cron)
   - [Backend Restart Persistence](#2-backend-restart-persistence)
   - [Strict Idempotency Strategy](#3-strict-idempotency-strategy)
   - [Worker Concurrency & Safety](#4-worker-concurrency--safety)
   - [Distributed Minimum Delay](#5-distributed-minimum-delay)
   - [Redis-Backed Hourly Rate Limiting & Rescheduling](#6-redis-backed-hourly-rate-limiting--rescheduling)
   - [Slack OAuth & Rate-Limit Alerts](#7-slack-oauth--rate-limit-alerts)
   - [Elasticsearch Search Engine](#8-elasticsearch-search-engine)
   - [Bull Board Monitoring](#9-bull-board-monitoring)
   - [Handling 1,000+ Emails & Backpressure](#10-handling-1000-emails--backpressure)
9. [API Reference](#-api-reference)
10. [Automated Testing & 1000-Email Load Test](#-automated-testing--1000-email-load-test)
11. [Assumptions & Trade-offs](#-assumptions--trade-offs)
12. [Step-by-Step Demo Guide](#-step-by-step-demo-guide)

---

## 🏛 Architecture Overview

```mermaid
flowchart TD
    subgraph Client ["Frontend (React + Vite + Tailwind)"]
        UI[Dashboard / Compose Modal / CSV Parser]
        GoogleLogin[Google OAuth Login]
        SlackConnect[Slack OAuth Integration]
    end

    subgraph Backend ["Backend API (Express + TypeScript)"]
        API[REST API Controllers]
        Passport[Passport Google OAuth 2.0]
        EmailSvc[Email Service]
        SlackSvc[Slack Service]
        ESSvc[Elasticsearch Service]
        BullBoardUI["Bull Board (/admin/queues)"]
    end

    subgraph Persistence ["Persistent Storage Layer"]
        PG[(PostgreSQL - Prisma)]
        RedisCache[(Redis - AOF Persistent)]
        ESNode[(Elasticsearch)]
    end

    subgraph Queue ["Queue & Workers (BullMQ)"]
        BullQueue["BullMQ 'email-queue' (Delayed Jobs)"]
        Worker["BullMQ Worker (Configurable Concurrency = 10)"]
    end

    subgraph External ["External Services"]
        GoogleAuthAPI["Google OAuth API"]
        SlackAPI["Slack Web API"]
        EtherealSMTP["Ethereal SMTP Servers"]
    end

    UI -->|1. Upload CSV & Schedule| API
    GoogleLogin <-->|OAuth Flow| GoogleAuthAPI
    API -->|Session & Auth| PG
    API -->|2. Store Email Record| PG
    API -->|3. Index Doc| ESNode
    API -->|4. Add Delayed Job| BullQueue
    BullQueue -->|Persist Jobs| RedisCache
    
    Worker -->|5. Pop Ready Job| BullQueue
    Worker -->|6. Atomic Claim SCHEDULED->PROCESSING| PG
    Worker -->|7. Atomic Lua Rate Limit Check| RedisCache
    
    Worker -->|8a. Rate Limit Exceeded| RedisCache
    Worker -->|8b. Reschedule Next Hour| BullQueue
    Worker -->|8c. Alert| SlackAPI
    
    Worker -->|9a. Rate Limit OK| EtherealSMTP
    Worker -->|9b. Set Status = SENT| PG
    Worker -->|9c. Update Doc = SENT| ESNode
    
    SlackConnect <-->|OAuth Flow| SlackAPI
    BullBoardUI -->|Monitor| BullQueue
```

---

## 🧰 Tech Stack

- **Backend**: Node.js, Express.js, TypeScript (Strict Mode)
- **Database & ORM**: PostgreSQL 16, Prisma ORM
- **Queue & In-Memory Store**: Redis 7, BullMQ
- **Search Engine**: Elasticsearch 8.13, Kibana
- **Email Delivery**: Nodemailer, Ethereal Email SMTP
- **Authentication**: Passport.js (Google OAuth 2.0 Strategy), Express Session (Redis Store)
- **Integrations**: Slack Web API (`@slack/web-api`), Bull Board (`@bull-board/express`)
- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, TanStack React Query, Lucide Icons, PapaParse
- **Testing**: Vitest, TSX

---

## 📁 Folder Structure

```
reachinbox-email-scheduler/
├── apps/
│   ├── backend/
│   │   ├── prisma/
│   │   │   ├── migrations/
│   │   │   └── schema.prisma
│   │   ├── src/
│   │   │   ├── config/          # Environment (Zod), Prisma, Redis, ES, Bull Board, Passport
│   │   │   ├── controllers/     # Auth, Email, Sender, Slack controllers (thin)
│   │   │   ├── middleware/      # Error handler, requireAuth session guard
│   │   │   ├── queues/          # BullMQ queue definitions, worker processor
│   │   │   ├── routes/          # Express route definitions
│   │   │   ├── scripts/         # 1000-email load test script
│   │   │   ├── services/        # Email, Sender, RateLimiter, Delay, Slack, Elasticsearch
│   │   │   ├── test/            # Vitest unit & integration test suite
│   │   │   ├── types/           # Shared TypeScript interfaces & types
│   │   │   ├── server.ts        # Express app entry point
│   │   │   └── worker.ts        # Standalone worker process entry point
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── vitest.config.ts
│   │
│   └── frontend/
│       ├── src/
│       │   ├── components/      # Header, ComposeModal (CSV parser), Tables, Badges
│       │   ├── hooks/           # useAuth, useEmails, useSlack, useSenders
│       │   ├── layouts/         # AppLayout
│       │   ├── pages/           # LoginPage, DashboardPage, SettingsPage
│       │   ├── services/        # Typed Axios API client
│       │   ├── types/           # Frontend TypeScript types
│       │   ├── App.tsx          # React Router configuration & protected routes
│       │   ├── main.tsx         # TanStack Query & DOM mount
│       │   └── index.css        # Tailwind styles
│       ├── package.json
│       ├── tailwind.config.js
│       └── vite.config.ts
│
├── docker-compose.yml           # Postgres, Redis, Elasticsearch, Kibana
├── .env.example
├── README.md
└── package.json
```

---

## 📋 Prerequisites

- **Node.js**: 18.x or 20.x or higher
- **npm** or **pnpm**
- **Docker** & **Docker Compose** (for PostgreSQL, Redis, Elasticsearch, Kibana)

---

## 🐳 Quick Start with Docker

Start all persistent backing services with Docker Compose:

```bash
docker compose up -d
```

Verify services are healthy:
```bash
docker compose ps
```
- **PostgreSQL**: `localhost:5432`
- **Redis**: `localhost:6379`
- **Elasticsearch**: `localhost:9200`
- **Kibana**: `localhost:5601`

---

## ⚙️ Environment Variables

Copy `.env.example` into `apps/backend/.env`:

```bash
cp .env.example apps/backend/.env
```

| Variable | Description | Default / Example |
|---|---|---|
| `NODE_ENV` | Application environment | `development` |
| `PORT` | Backend server port | `4000` |
| `FRONTEND_URL` | Frontend URL for CORS & OAuth redirects | `http://localhost:5173` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://reachinbox:reachinbox_secret@localhost:5432/reachinbox?schema=public` |
| `REDIS_HOST` | Redis host | `localhost` |
| `REDIS_PORT` | Redis port | `6379` |
| `REDIS_PASSWORD` | Redis auth password | `redis_secret` |
| `ELASTICSEARCH_URL` | Elasticsearch URL | `http://localhost:9200` |
| `WORKER_CONCURRENCY` | Concurrent jobs per worker | `10` |
| `MIN_EMAIL_DELAY_MS` | Global delay between sends for same sender | `2000` |
| `MAX_EMAILS_PER_HOUR_PER_SENDER` | Hourly limit per sender | `100` |
| `GOOGLE_CLIENT_ID` | Google OAuth Client ID | From Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | Google OAuth Client Secret | From Google Cloud Console |
| `GOOGLE_CALLBACK_URL` | Google OAuth redirect callback | `http://localhost:4000/api/auth/google/callback` |
| `SLACK_CLIENT_ID` | Slack App Client ID | From Slack App Dashboard |
| `SLACK_CLIENT_SECRET` | Slack App Client Secret | From Slack App Dashboard |
| `SLACK_REDIRECT_URI` | Slack OAuth redirect URI | `http://localhost:4000/api/slack/callback` |
| `SESSION_SECRET` | Secret used to sign session cookies | 32+ character random string |

---

## 🚀 Running the Application

### 1. Database Migration
```bash
cd apps/backend
npx prisma migrate dev --name init
```

### 2. Start Backend & Worker
```bash
# In apps/backend:
npm run dev
```

### 3. Start Frontend
```bash
# In apps/frontend:
npm run dev
```
Open **`http://localhost:5173`** in your browser.

---

## 🧠 Core Architectural Mechanics

### 1. BullMQ Scheduling (No Cron)
- **Zero cron jobs or polling intervals.**
- When scheduling emails with start time $T_{start}$ and delay $D$, job $i$ is calculated as:
  $$\text{delay}_i = \max(0, T_{start} - T_{now}) + (i \times D)$$
- BullMQ stores delayed jobs in a Redis sorted set (`ZSET`) keyed by execution timestamp. Redis triggers ready jobs precisely when the delay expires with sub-millisecond accuracy.

### 2. Backend Restart Persistence
- If the backend crashes or is restarted:
  1. All scheduled and delayed jobs remain safely persisted in Redis (AOF / RDB enabled).
  2. PostgreSQL maintains the persistent source of truth (`status: SCHEDULED`, `bullJobId`, `idempotencyKey`).
  3. Upon restart, workers resume processing queued jobs at their scheduled execution times without losing a single job or double-firing.

### 3. Strict Idempotency Strategy
- **Guaranteed Unique IDs**: Every email record has a unique ID and `idempotencyKey` unique index.
- **BullMQ `jobId = email.id`**: Ensures a job for an email cannot be enqueued twice in BullMQ.
- **State Check**: If an email is already marked `SENT` in PostgreSQL, the worker immediately skips sending.
- **Atomic Database Claiming**:
  ```ts
  const claim = await prisma.email.updateMany({
    where: { id: emailId, status: 'SCHEDULED' },
    data: { status: 'PROCESSING' }
  });
  if (claim.count === 0) return; // Another worker claimed it or already sent
  ```

### 4. Worker Concurrency & Safety
- Worker concurrency defaults to `WORKER_CONCURRENCY=10` (or configured via environment variable).
- Multiple workers across different server instances coordinate safely using atomic PostgreSQL updates and Redis distributed state. No shared in-memory state is used.

### 5. Distributed Minimum Delay
- Enforces `MIN_EMAIL_DELAY_MS=2000` per sender across all concurrent workers.
- Coordinated via Redis atomic Lua script checking `email-last-sent:{senderId}` to prevent provider rate drops or SMTP connection bans.

### 6. Redis-Backed Hourly Rate Limiting & Rescheduling
- Sender rate limit key: `email-rate:{senderId}:{hourWindow}` where `hourWindow = YYYY-MM-DD-HH`.
- Atomic check-and-increment executed via Redis Lua script.
- When the limit is reached:
  1. The email is **not** dropped.
  2. The email is **not** permanently failed.
  3. The job is rescheduled for the start of the next hour window:
     $$\text{rescheduleDelay} = T_{\text{next hour}} - T_{\text{now}}$$
  4. PostgreSQL email status is reset to `SCHEDULED` with the updated `scheduledAt` timestamp.
  5. A real Slack notification is triggered.

### 7. Slack OAuth & Rate-Limit Alerts
- Connect Slack with real Slack OAuth 2.0 flow.
- When a sender hits the hourly rate limit, an alert is posted to the user's Slack workspace:
  > ⚠️ **Email rate limit reached.**  
  > **Sender:** `outreach@company.com`  
  > **Hourly limit:** `100`  
  > **Status:** Remaining emails have been safely rescheduled for the next hour.
- **Deduplication**: Uses Redis key `slack-notif:{senderEmail}:{hourWindow}` with a 2-hour TTL to prevent spamming Slack for every subsequent job in the same hour.
- **Resilience**: A Slack API failure or missing connection never crashes or blocks email execution.

### 8. Elasticsearch Search Engine
- Email documents are indexed upon scheduling and updated upon delivery (`SENT` or `FAILED`).
- `GET /api/emails/search?q=keyword` queries `recipient`, `subject`, and `body` with full-text fuzzy matching, strictly scoped by `userId`.
- Safe fail-open design: if Elasticsearch is temporarily offline, core scheduling and delivery continue unimpeded.

### 9. Bull Board Monitoring
- Exposed at `http://localhost:4000/admin/queues`.
- Provides real-time dashboard for Delayed, Waiting, Active, Completed, and Failed jobs with retry and inspection tools.

### 10. Handling 1,000+ Emails & Backpressure
- When 1,000+ emails are uploaded via CSV:
  - Jobs are quickly written to PostgreSQL and enqueued in Redis as delayed jobs.
  - BullMQ manages backpressure natively: only `WORKER_CONCURRENCY` jobs are active in memory at any given instant.
  - The rest remain in Redis sorted sets without overloading Node.js memory.

---

## 📡 API Reference

### Authentication
- `GET /api/auth/google` — Start Google OAuth login flow
- `GET /api/auth/google/callback` — Google OAuth callback
- `GET /api/auth/me` — Get authenticated user details
- `POST /api/auth/logout` — Destroy session and log out
- `POST /api/auth/dev-login` — Fast demo access for local testing

### Emails
- `POST /api/emails/schedule` — Schedule a batch of emails
- `GET /api/emails/scheduled` — List active scheduled/processing emails
- `GET /api/emails/sent` — List sent/failed email history
- `GET /api/emails/search?q=term` — Search emails via Elasticsearch
- `GET /api/emails/:id` — Get email details by ID

### Senders
- `GET /api/senders` — List user's Ethereal senders
- `POST /api/senders` — Create a new Ethereal test account

### Slack Integration
- `GET /api/slack/connect` — Initiate Slack OAuth flow
- `GET /api/slack/callback` — Slack OAuth callback
- `GET /api/slack/status` — Check Slack connection status
- `POST /api/slack/disconnect` — Disconnect Slack integration

---

## 🧪 Automated Testing & 1000-Email Load Test

### Run Unit & Integration Tests
```bash
cd apps/backend
npm test
```
Tests cover:
- Email validation & scheduling constraints
- Hourly rate limiter hour window calculations
- Strict worker idempotency (preventing double sends)
- Atomic claiming under concurrency
- Slack notification non-fatal resilience
- Elasticsearch fail-open behavior

### Run 1,000-Email Load Test
```bash
cd apps/backend
npm run test:load
```
Generates 1,000 unique recipient records, validates formatting, computes delayed timestamps, enqueues them into BullMQ, and outputs throughput statistics and queue metrics.

---

## ⚖️ Assumptions & Trade-offs

1. **Ethereal Email vs Production SMTP (SendGrid/SES)**:
   - *Design*: Uses Ethereal test SMTP accounts with preview URLs to allow safe, sandbox testing of 1000+ emails without incurring costs or spamming real inboxes.
   - *Production path*: Can swap Nodemailer transport to Amazon SES or SendGrid simply by configuring standard SMTP environment variables.
2. **Elasticsearch Fallback**:
   - *Design*: Elasticsearch search operates with a fail-open strategy. If Elasticsearch is unavailable, the core scheduling and delivery pipelines continue executing reliably.
3. **Session Store**:
   - *Design*: User sessions are stored in Redis (`connect-redis`) rather than in memory, ensuring user logins persist seamlessly across server restarts.

---

## 🎬 Step-by-Step Demo Guide

1. **Start Services**: Run `docker compose up -d` and `npm run dev` in both backend and frontend.
2. **Log In**: Open `http://localhost:5173`, click **Continue with Google OAuth** (or use **Demo Quick-Access**).
3. **Upload CSV**:
   - Click **Compose Email**.
   - Upload any CSV with email addresses. Observe the instant badge: `X email addresses detected`.
   - Set Subject, Body, and optional Delay (e.g. 2000ms) or Start Time.
   - Click **Schedule**.
4. **Inspect Queues**:
   - Watch the **Scheduled Emails** tab update with live countdowns.
   - Visit `http://localhost:4000/admin/queues` to inspect BullMQ delayed jobs.
5. **Restart Backend**:
   - Stop backend (`Ctrl + C`) and restart it (`npm run dev`).
   - Observe that all delayed jobs still exist in the queue and fire on schedule without loss.
6. **Search**:
   - Type a keyword in the dashboard search bar (e.g. "Engineer" or recipient name).
   - See fast matching results powered by Elasticsearch.
7. **Slack Alert**:
   - Go to **Settings & Integrations** and connect Slack.
   - When a sender's rate limit is reached, check your Slack channel for the alert.
