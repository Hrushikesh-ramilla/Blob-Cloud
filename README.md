# Blob-Cloud

[![Go Version](https://img.shields.io/github/go-mod/go-version/Hrushikesh-ramilla/Blob-Cloud?filename=backend%2Fgo.mod)](https://golang.org)
[![React](https://img.shields.io/badge/React-20232A?style=flat&logo=react&logoColor=61DAFB)](https://react.dev)
[![AWS](https://img.shields.io/badge/AWS-%23FF9900.svg?style=flat&logo=amazon-aws&logoColor=white)](https://aws.amazon.com)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=flat&logo=postgresql&logoColor=white)](https://www.postgresql.org)
[![Redis](https://img.shields.io/badge/Redis-DC382D?style=flat&logo=redis&logoColor=white)](https://redis.io)
[![Cloudflare](https://img.shields.io/badge/Cloudflare-F38020?style=flat&logo=Cloudflare&logoColor=white)](https://workers.cloudflare.com)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

Blob-Cloud is a production-grade, cloud-native file storage and collaboration platform built in **Go** with a **React** frontend. It targets AWS Free Tier (or Cloudflare R2 for zero egress fees) and implements a direct-to-cloud upload pipeline with global block-level deduplication, real-time WebSocket notifications, horizontal scalability via Redis Pub/Sub, per-zone HTTP rate limiting, an immutable audit trail, and cryptographic edge integrity validation.

---

## System Architecture

```mermaid
sequenceDiagram
    autonumber
    actor Client as React Frontend
    participant CF as Cloudflare Worker (Edge Validator)
    participant API as Go Backend (EC2)
    participant Redis as Redis (Pub/Sub Backplane)
    participant DB as PostgreSQL (RDS)
    participant SQS as AWS SQS
    participant S3 as AWS S3 / Cloudflare R2
    participant Worker as Go Concurrent Workers

    Client->>API: POST /api/upload/initiate (filename, block hashes, sizes)
    API->>DB: Dedup check — blocks table (global SHA-256 index)
    DB-->>API: Existing hashes (dedup hits skip upload)
    Note over API: Small blocks (<=5 GiB): presigned PUT URL<br/>Large blocks (>5 GiB): MPU uploadID + part URLs
    API-->>Client: Session ID + Upload URL(s) per missing block

    opt Missing blocks only
        Client->>CF: PUT /blocks/<sha256> (direct upload)
        CF->>CF: Stream body → Web Crypto SHA-256 validation
        CF->>S3: Forward if hash matches (reject 400 on mismatch)
        S3-->>Client: 200 OK
    end

    Client->>API: POST /api/upload/complete (session_id, [etags for MPU])
    API->>DB: Verify blocks present → atomic tx: blocks+files+permissions
    DB-->>API: Commit
    API->>SQS: Publish thumbnail job
    API->>Redis: Publish WS event (fan-out to all pods)
    API-->>Client: 200 OK

    loop Concurrent SQS workers
        Worker->>SQS: Long-poll (20s)
        SQS-->>Worker: Job payload
        Worker->>S3: Fetch blocks → generate thumbnail
        Worker->>S3: PUT /thumbnails/{fileID}.png
    end

    Redis-->>API: Fan-out to all connected nodes
    API-->>Client: WebSocket push notification
```

---

## Features

### 1. Direct-to-Cloud Uploads via Presigned URLs

The Go backend never streams file data. It generates short-lived S3 presigned PUT URLs; the client uploads directly to the storage edge. This completely shields the application server from I/O load and memory pressure.

For files above 5 GiB, the server initiates an **S3 Multipart Upload** and returns N presigned part URLs. The client PUTs each part independently and passes the ETags back to `POST /api/upload/complete`, which calls `CompleteMultipartUpload`. There is no file size ceiling.

### 2. Global Block-Level Deduplication

Files are sliced into 4 MB blocks client-side, each fingerprinted with SHA-256. The backend maintains a global block index — if any two users upload files sharing identical blocks, only one physical copy is stored. Resumable uploads are fully supported: `GET /api/upload/session/{id}` returns fresh upload URLs only for blocks not yet confirmed in storage.

### 3. Real-Time Notifications with Redis Pub/Sub Backplane

Every client tab connects over WebSocket. When an upload completes or a file is shared, `notifier.NotifyUser()` delivers the event to local connections and publishes to the Redis channel `blobcloud:ws:events`. Every API pod subscribes and fans the event to its own clients — horizontal scaling works with a single `REDIS_URL` env var. The server falls back to in-process Hub-only mode when Redis is not configured.

### 4. Per-IP Per-Zone HTTP Rate Limiting

Three independent zones applied in the chi router:

| Zone | Default | Reason |
|------|---------|--------|
| `/api/auth/*` | 10 req/min | Credential stuffing / brute force |
| `/api/upload/*` | 30 req/min | S3 presign calls are expensive |
| `/api/*` (general) | 120 req/min | General DoS protection |

In-memory token-bucket (`golang.org/x/time/rate`) by default; drop-in `RedisLimiter` (fixed-window Lua script) for multi-node. All 429 responses include `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`, and `Retry-After` headers.

### 5. Immutable Audit Log

Every write action (`FILE_UPLOADED`, `FILE_SHARED`, `FILE_DELETED`) appends a row to the `audit_logs` table. The write is fire-and-forget — a background goroutine with its own 5-second context ensures the insert completes even after the HTTP response is sent, adding zero latency to the API. `GET /api/files/{id}/history` returns the paged audit trail for any file.

### 6. Orphaned Block Garbage Collector

The standalone `cmd/gc` binary compares live S3 object keys against the Postgres `blocks` table and deletes unreferenced objects. Runs safely with `--dry-run` by default. Designed to be scheduled as a nightly ECS task or Kubernetes CronJob.

### 7. Prometheus Observability

A private Prometheus registry is exposed at `GET /metrics`. Instrumented:
- HTTP request latency histogram keyed by **route pattern** (bounded cardinality — not raw URL)
- Block dedup hit/miss counters
- Upload initiated/completed counters
- SQS worker job duration histogram + error counter
- WebSocket active-connections gauge

### 8. Cloudflare Edge Integrity Validation

`workers/edge_validator.js` intercepts every PUT to `/blocks/<sha256>`. It streams the request body through Web Crypto `SHA-256` and compares the digest against the hash in the URL. Mismatches are rejected with `400 Bad Request` before a single byte reaches R2. Applies to both single-PUT and multipart part uploads (same `/blocks/` key namespace).

### 9. Hierarchical ACL with Recursive CTEs

A `permissions` table maps `(user_id, file_id, role)`. Access checks on deeply nested files walk the folder tree using a PostgreSQL recursive CTE — the database does the traversal, not application code.

### 10. Async Thumbnail Pipeline

Successful uploads publish a job to AWS SQS. A pool of Go workers long-polls, fetches image blocks from S3, generates a 200×200 PNG in-memory, and writes `thumbnails/{fileID}.png` back to S3. Workers participate in graceful shutdown via `context.Context` cancellation.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Backend** | Go 1.22+, `go-chi/chi`, `pgx` / `database/sql` |
| **Frontend** | React 18, TailwindCSS, Axios |
| **Database** | PostgreSQL 16 |
| **Object Storage** | AWS S3 / Cloudflare R2 |
| **CDN / Edge** | AWS CloudFront or Cloudflare Workers |
| **Message Queue** | AWS SQS |
| **Real-time** | WebSocket (`gorilla/websocket`) + Redis Pub/Sub |
| **Observability** | Prometheus (`prometheus/client_golang`) |
| **Rate Limiting** | `golang.org/x/time/rate` + Redis fixed-window |
| **Infrastructure** | AWS EC2 / ECS, Docker, GitHub Actions |

---

## Repository Layout

```
Blob-Cloud/
├── backend/
│   ├── cmd/
│   │   ├── api/main.go          # server entrypoint
│   │   └── gc/main.go           # orphaned block GC binary
│   ├── db/migrations/           # 9 SQL migrations (golang-migrate)
│   └── internal/
│       ├── audit/               # audit.Logger interface + NoopLogger
│       ├── config/              # env-var Config struct
│       ├── domain/              # StorageProvider + MultipartUploadProvider interfaces
│       ├── gc/                  # GC algorithm + BlockLister/DBBlockHashes interfaces
│       ├── metrics/             # Prometheus registry + HTTP middleware
│       ├── queue/               # SQS publisher + worker pool
│       ├── ratelimit/           # Limiter interface, InMemoryLimiter, RedisLimiter
│       ├── repository/postgres/ # all DB repositories
│       ├── service/             # UploadService (MPU-aware)
│       ├── storage/             # LocalStore + S3Storage (implements MPU)
│       ├── sync/                # Hub + RedisBackplane
│       └── transport/http/      # chi router + all HTTP handlers
└── workers/
    ├── edge_validator.js        # Cloudflare Worker — SHA-256 edge validation
    └── wrangler.toml            # deploy config
```

---

## Local Setup

### Prerequisites
- Go 1.22+
- Node.js 18+
- Docker
- Redis (optional — single-node mode works without it)

### 1. Run the Database
```bash
docker run --name blobcloud-db \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=blobcloud \
  -p 5432:5432 \
  -d postgres:16-alpine
```

### 2. Configure Backend

Create `backend/.env`:
```env
PORT=8080
ENV=development
LOCAL_STORAGE_DIR=./tmp/storage
BASE_URL=http://localhost:8080

DB_DSN=postgres://postgres:postgres@localhost:5432/blobcloud?sslmode=disable

STORAGE_PROVIDER=local
AWS_REGION=us-east-1
AWS_S3_BUCKET=your-bucket
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret

SQS_QUEUE_URL=https://sqs.us-east-1.amazonaws.com/your-account/your-queue
SQS_NUM_WORKERS=3
SQS_POLL_TIMEOUT_SEC=20

REDIS_URL=redis://localhost:6379

RL_AUTH_RPM=10
RL_UPLOAD_RPM=30
RL_API_RPM=120

JWT_SECRET=change-me
```

### 3. Start the Backend
```bash
cd backend
go run cmd/api/main.go
# Migrations run automatically on boot.
```

### 4. Run the GC (dry-run by default)
```bash
cd backend
go run cmd/gc/main.go --dry-run
# Live run:
go run cmd/gc/main.go --no-dry-run --min-age 24h
```

### 5. Start the Frontend
```bash
cd frontend
npm install
npm run dev
```

### 6. Deploy the Cloudflare Edge Worker
```bash
cd workers
npm install -g wrangler
wrangler deploy
```

---

## Running Tests

```bash
cd backend

# Full suite — no external services required
go test ./... -count=1 -timeout 90s

# Per-package
go test ./internal/ratelimit/... -v   # 7 tests
go test ./internal/sync/...     -v   # 4 tests
go test ./internal/gc/...       -v   # 5 tests
go test ./internal/audit/...    -v   # 5 tests
go test ./internal/service/...  -v   # E2E upload + 6 MPU tests

go build ./...
```

| Package | Status |
|---------|--------|
| `internal/audit` | ✅ |
| `internal/auth` | ✅ |
| `internal/gc` | ✅ |
| `internal/queue` | ✅ |
| `internal/ratelimit` | ✅ |
| `internal/repository/postgres` | ✅ |
| `internal/service` | ✅ |
| `internal/storage` | ✅ |
| `internal/sync` | ✅ |
| `internal/transport/http` | ✅ |

---

## System Design Trade-offs

| Concern | Current approach | Path forward |
|---------|-----------------|-------------|
| DB write throughput | Single PostgreSQL | Shard by `user_id`; CockroachDB for global distribution |
| WebSocket horizontal scale | Redis Pub/Sub backplane | Already solved — point `REDIS_URL` at a Redis cluster |
| File size ceiling | None (S3 MPU, up to ~10 TB per file) | Already solved |
| Upload data integrity | SHA-256 validation at Cloudflare edge | Already solved |
| Orphaned block storage cost | GC binary | Schedule as nightly ECS / CronJob |
| Auth brute force | 10 req/min rate limit | Account lockout + CAPTCHA |
| Audit retention | Immutable Postgres table | Archive to S3 Glacier for long-term compliance |

---

## Demo & Deployment

- 🔗 **Live URL:** *Coming soon*
- 🎥 **Walkthrough Video:** *Coming soon*
