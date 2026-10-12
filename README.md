# Enterprise HR & Payroll System

Backend-only, microservice-based HR & Payroll platform — midterm project for **Cloud Native Development**.
Node.js 24 · Express · MongoDB Atlas · JWT + RBAC · Nginx + Redis load balancing · Docker Compose · AWS EC2.

> **Status:** infrastructure is complete and tested (gateway, auth, Docker, Nginx, deploy files).
> Business endpoints are scaffolded with models, routes, role guards, and detailed `TODO` comments for each member to implement.
> See [Implementation status](#10-implementation-status--todo-tracker).

---

## Table of contents

1. [Overview](#1-overview)
2. [Roles & permissions](#2-roles--permissions)
3. [Architecture](#3-architecture)
4. [Repository structure](#4-repository-structure)
5. [Quick start (local, Docker)](#5-quick-start-local-docker)
6. [Environment variables](#6-environment-variables)
7. [API reference](#7-api-reference)
8. [Data model](#8-data-model)
9. [Load balancing](#9-load-balancing)
10. [Implementation status & TODO tracker](#10-implementation-status--todo-tracker)
11. [Developer guide](#11-developer-guide)
12. [Deploying to AWS EC2](#12-deploying-to-aws-ec2)
13. [Testing checklist (for screenshots)](#13-testing-checklist-for-screenshots)
14. [Project document checklist](#14-project-document-checklist)
15. [Troubleshooting](#15-troubleshooting)

---

## 1. Overview

| | |
|---|---|
| **Roles** | `employee`, `hr_manager`, `admin` |
| **Microservices** | 9 (+ Nginx + Redis): API Gateway, Registration, Login, Employee Profile, Attendance, Leave, Performance, Payroll, Audit |
| **Auth** | JWT (HS256) signed by Login, **verified only at the API Gateway**; role-based access control (RBAC) at the gateway *and* inside services |
| **Database** | MongoDB Atlas, one cluster, **one database per service** |
| **Load balancing** | Nginx round-robin across 2 gateway instances, Redis shared counter to prove it |
| **Deployment** | Docker Compose locally; 4 EC2 instances (AWS Academy sandbox) in production |
| **Rule** | Everything is reachable **only through the gateway** (via Nginx on port 80) |

### What the system does

- **Registration / Login:** sign up, log in, receive a JWT; admins manage staff accounts and roles.
- **Employee profiles:** HR maintains personal details, department and job title.
- **Attendance:** clock in / clock out, overtime calculation, monthly summaries.
- **Leave:** request leave, balance tracking, HR approval or rejection.
- **Performance reviews:** HR records ratings and feedback; employees read their own.
- **Payroll:** salary setup, payslip generation (base + overtime − tax − social), employees read their own payslips.
- **Audit:** every state-changing request, login attempt and access denial is logged (admin-only viewer).

---

## 2. Roles & permissions

| Capability | Employee | HR Manager | Admin |
|---|:---:|:---:|:---:|
| Self-register (public, always becomes `employee`) | – | – | – |
| Create HR/Admin accounts, change roles | ❌ | ❌ | ✅ |
| List users | ❌ | ✅ | ✅ |
| Create / list / delete employee profiles | ❌ | create + list | all (incl. delete) |
| View own profile, edit own phone/address | ✅ | ✅ | ✅ |
| Clock in / out, view own attendance | ✅ | ✅ | ✅ |
| View all attendance | ❌ | ✅ | ✅ |
| Request / cancel own leave, view own balance | ✅ | ✅ | ✅ |
| Approve / reject leave (not your own) | ❌ | ✅ | ✅ |
| Create / edit performance reviews | ❌ | ✅ | ✅ |
| Delete performance reviews | ❌ | ❌ | ✅ |
| View own reviews and payslips | ✅ | ✅ | ✅ |
| Set salary, generate / list payslips | ❌ | ✅ | ✅ |
| View audit logs | ❌ | ❌ | ✅ |

**Two layers of enforcement:**
1. **Gateway** (`api-gateway/src/config/routes.js`): coarse rule per route, e.g. "only `admin`".
2. **Service** (controllers): fine-grained rules, e.g. "an employee may read **only their own** payslip".

---

## 3. Architecture

```
                      Postman / client
                            │  http://<EC2-A public IP>/api/...
                            ▼
 ┌──────────────────────── EC2-A (edge) ─────────────────────────────┐
 │   Nginx :80  ──round robin──►  gateway1 (gw1) ┐                    │
 │                                gateway2 (gw2) ┴──► Redis (shared   │
 │                                   │                  LB counter)   │
 │   Registration :3001   Login :3002   ◄────────────┘                │
 └───────────────────────────────┬────────────────────────────────────┘
        JWT verified + RBAC here │ + x-internal-key, x-user-* headers
     ┌───────────────────────────┼───────────────────────────┐
     ▼                           ▼                           ▼
 EC2-B                        EC2-C                       EC2-D
 Employee   :3003             Leave        :3005          Payroll :3007 ──► Employee, Attendance (internal calls)
 Attendance :3004             Performance  :3006          Audit   :3008 ◄── Gateway, Login, Registration (audit events)

        All services ──► MongoDB Atlas (one DB per service)
```

### Services, ports, and owners

| # | Service | Port | EC2 | Database | Owner |
|---|---|---|---|---|---|
| – | Nginx (load balancer) | 80 (public) | A | – | Common |
| 1 | API Gateway ×2 (`gateway1`, `gateway2`) | 3000 (internal) | A | – (Redis) | Common |
| 2 | Registration | 3001 | A | `hr_auth` | Common |
| 3 | Login | 3002 | A | `hr_auth` | Common |
| 4 | Employee Profile | 3003 | B | `hr_employee` | Member 1 |
| 5 | Attendance & Time-Tracking | 3004 | B | `hr_attendance` | Member 1 |
| 6 | Leave Management | 3005 | C | `hr_leave` | Member 2 |
| 7 | Performance Review | 3006 | C | `hr_performance` | Member 2 |
| 8 | Payroll | 3007 | D | `hr_payroll` | Member 3 |
| 9 | Audit & Logging | 3008 | D | `hr_audit` | Member 3 |

### Request flow

1. Client calls `http://<host>/api/...` → **Nginx** picks `gateway1` or `gateway2`.
2. **Gateway** looks up the route in its route table (unknown → 404), verifies the JWT (401 on missing/invalid/expired), checks the role (403), then **removes any `x-user-*` / `x-internal-key` headers sent by the client** and injects trusted ones.
3. The target **service** accepts the request only if `x-internal-key` is valid (blocks direct access), reads `x-user-id` / `x-user-role`, applies fine-grained rules, talks to its database, and answers.
4. After responding, the gateway fire-and-forgets an **audit event** (all non-GET requests and every 401/403).

### Key design decisions

| Decision | Why |
|---|---|
| JWT verified **only at the gateway** | Single place for authentication; services stay simple. Only Login and Gateway know `JWT_SECRET` |
| `x-internal-key` shared secret | Services reject anything that did not come through the gateway (or another trusted service) |
| `/internal/*` routes | Service-to-service APIs. **Not in the gateway route table**, so they cannot be reached from outside |
| `userId` = employee ID everywhere | The `_id` of the user (as string) is the key in every service, so no ID lookups between services |
| Database per service | True microservice data ownership. Registration and Login both use `hr_auth` (Registration writes users, Login reads them) |
| `common/` folder copied per service | Each Docker image builds independently. Edit `shared/common/` then run `./scripts/sync-common.sh` |
| Public path unchanged by the gateway | Gateway forwards `/api/employees/...` as-is; services mount routes at the same full path |

### Tech stack

Node.js 24 (ESM) · Express 5 · Mongoose · `jsonwebtoken` · `bcryptjs` · `http-proxy-middleware` (gateway) · `redis` client (gateway) · `helmet` (gateway) · `morgan` (logging) · Nginx · Redis 7 · Docker / Docker Compose · MongoDB Atlas · AWS EC2.

---

## 4. Repository structure

```
hr-payroll-system/
├── README.md
├── docker-compose.yml          # whole system on one machine (local)
├── .env.example                # copy to .env (local compose)
├── nginx/                      # Dockerfile + nginx.conf (upstream gateway1, gateway2)
├── deploy/                     # one compose file per EC2 instance + .env.example
│   ├── ec2-a.compose.yml       #   Nginx, 2 gateways, Redis, Registration, Login
│   ├── ec2-b.compose.yml       #   Employee, Attendance
│   ├── ec2-c.compose.yml       #   Leave, Performance
│   └── ec2-d.compose.yml       #   Payroll, Audit
├── shared/common/              # MASTER copy of the helper modules shared by services
├── scripts/sync-common.sh      # copies shared/common into every service
└── services/
    ├── api-gateway/            # route table, JWT, RBAC, proxy, audit forwarding, Redis LB demo
    │   └── src/{config,middleware,routes,lib,common}
    ├── registration-service/   # users: register, staff accounts, roles   (+ scripts/seed.js)
    ├── login-service/          # login, /me
    ├── employee-service/
    ├── attendance-service/
    ├── leave-service/
    ├── performance-service/
    ├── payroll-service/
    └── audit-service/
```

Every business service has the same layout:

```
<service>/
├── Dockerfile  .dockerignore  .env.example  package.json  package-lock.json
└── src/
    ├── server.js            # connect DB + listen
    ├── app.js               # middleware, /health, mounts routes
    ├── config/              # env.js (validated env vars), db.js, + service constants
    ├── common/              # shared helpers (see below)
    ├── models/              # Mongoose schemas (already defined)
    ├── routes/              # path → role guard → controller (already wired)
    └── controllers/         # ← YOU implement these (TODO comments inside)
```

**`src/common/` helpers** (same in every service):

| File | Purpose |
|---|---|
| `response.js` | `ok(res, data, message)`, `created(...)` → standard success envelope |
| `errors.js` | `badRequest`, `unauthorized`, `forbidden`, `notFound`, `conflict`, `notImplemented` → throw them, never hand-write error JSON |
| `errorHandler.js` | Converts thrown errors, Mongoose validation/cast/duplicate errors into the standard error envelope |
| `gatewayAuth.js` | `fromGateway` (mounted on `/api`, sets `req.user`) and `internalAuth` (mounted on `/internal`) |
| `requireRole.js` | `requireAuth`, `requireRole(...roles)` route guards |
| `roles.js` | `ROLES`, `STAFF` (HR + Admin), `isStaff(user)` |
| `validate.js` | `requireFields('a', 'b')` |
| `pagination.js` | `getPagination(req.query)` → `{ page, limit, skip }` |
| `audit.js` | `sendAudit({...})` fire-and-forget event to the Audit service |
| `internalClient.js` | `internalGet(url)` service-to-service GET with the internal key |

---

## 5. Quick start (local, Docker)

**Prerequisites:** Docker + Docker Compose, a MongoDB Atlas cluster (Network Access must allow your IP, or `0.0.0.0/0` for the course project).

```bash
git clone <your-repo-url> && cd hr-payroll-system

cp .env.example .env
# edit .env: set MONGODB_URI, and long random values for JWT_SECRET and INTERNAL_API_KEY

docker compose up --build -d          # builds and starts all 12 containers
docker compose ps                     # everything should be "Up"

# create the demo accounts (run once)
docker compose exec registration-service node src/scripts/seed.js
```

Seeded demo accounts:

| Email | Password | Role |
|---|---|---|
| `admin@company.com` | `Admin@123` | admin |
| `hr@company.com` | `Hr@12345` | hr_manager |
| `employee@company.com` | `Emp@12345` | employee |

**Try it** (Postman or curl; base URL `http://localhost`):

```bash
# 1. login
curl -s -X POST http://localhost/api/auth/login -H "Content-Type: application/json" \
  -d '{"email":"admin@company.com","password":"Admin@123"}'

# 2. use the token
curl -s http://localhost/api/auth/me -H "Authorization: Bearer <token>"

# 3. load balancing demo (run several times, "servedBy" alternates gw1 / gw2)
curl -s http://localhost/api/lb-info
```

**Postman tips**
- Create a collection variable `baseUrl` = `http://localhost` (later `http://<EC2-A-public-IP>`) and `token`.
- On the login request, *Tests* tab: `pm.collectionVariables.set("token", pm.response.json().data.token);`
- Collection *Authorization* → Bearer Token → `{{token}}`. Keep one collection per role (admin / hr / employee) for the RBAC screenshots.
- Export the collection into the repo (`docs/postman/`) so teammates can reuse it.

**Useful commands**

```bash
docker compose logs -f employee-service     # follow one service
docker compose up -d --build employee-service   # rebuild + restart after code changes
docker compose down                         # stop everything
```

### Running one service without Docker (fast dev loop)

```bash
cd services/employee-service
cp .env.example .env        # set MONGODB_URI etc. (URLs use localhost)
npm install
npm run dev                 # node --watch, auto-restarts on save
```

You can then test it directly by adding the headers the gateway would add:
`x-internal-key: <INTERNAL_API_KEY>`, `x-user-id: <any id>`, `x-user-role: admin`.
To test the full path including RBAC, run the gateway + login + registration too (or use Docker).

---

## 6. Environment variables

`.env` files are **never committed** (`.gitignore`). Commit only `.env.example`. Share real values with teammates privately.

| Variable | Used by | Description |
|---|---|---|
| `MONGODB_URI` | all DB services | Atlas connection string. Each service picks its own DB with `dbName` |
| `JWT_SECRET` | Gateway, Login | Signs (Login) / verifies (Gateway) tokens. Long random string |
| `JWT_EXPIRES_IN` | Login | Token lifetime, default `1h` |
| `INTERNAL_API_KEY` | all | Shared secret proving a request came through the gateway / a trusted service |
| `REDIS_URL` | Gateway | Default `redis://redis:6379` |
| `*_SERVICE_URL` | Gateway, Payroll | Where each service lives. Docker names locally, **EC2 private IPs** when deployed |
| `AUDIT_SERVICE_URL` | all | Where audit events are sent (optional: skipped if empty) |
| `PORT`, `DB_NAME` | each service | Optional overrides; defaults are in `src/config/env.js` |

Local Docker uses the root `.env`; EC2 uses `deploy/.env` (same file on all 4 instances); `npm run dev` uses `services/<name>/.env`.

---

## 7. API reference

Public base URL: `http://<host>` (Nginx on port 80). Send `Authorization: Bearer <token>` on every route except those marked **Public**.

**Legend:** ✅ implemented · 🔲 TODO (details in the controller's comments) · **Any** = any logged-in user · **Staff** = HR Manager or Admin · **Owner** = the resource's owner (or Staff where noted)

### Conventions

```jsonc
// success
{ "success": true, "data": { ... }, "message": "OK" }
// error
{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "...", "details": [ ... ] } }
```

| Status | Meaning |
|---|---|
| 200 / 201 | OK / created |
| 400 | Validation error / bad input |
| 401 | Missing, invalid or expired token; wrong credentials |
| 403 | Authenticated but role not allowed, or not the owner |
| 404 | Not found (also: route not exposed by the gateway) |
| 409 | Duplicate (email, clock-in twice, payslip twice, overlapping leave…) |
| 501 | Endpoint not implemented yet (scaffold) |
| 502/503 | Downstream service / Redis unavailable |

Error codes you will see from the gateway: `NO_TOKEN`, `INVALID_TOKEN`, `TOKEN_EXPIRED`, `FORBIDDEN`, `NOT_FOUND`, `BAD_GATEWAY`.
Lists accept `?page=1&limit=20` and return `{ items, page, limit, total }`. Dates are ISO strings; months are `YYYY-MM`; days are `YYYY-MM-DD`.

### 7.1 API Gateway (port 3000 behind Nginx 80)

| Method | Path | Access | Description | Status |
|---|---|---|---|---|
| GET | `/health` | Public | Gateway health + `instanceId` (gw1/gw2) | ✅ |
| GET | `/api/lb-info` | Public | Redis-backed counter: `{ servedBy, hits: {gw1, gw2}, total }`. Load-balancing proof | ✅ |
| – | JWT verification, RBAC, header injection, proxying | – | See `src/config/routes.js` + `middleware/routeGuard.js` | ✅ |
| – | Audit forwarding (non-GET + 401/403) | – | `middleware/auditLogger.js` | ✅ |

Response header `X-Served-By` (gateway instance) and `X-Upstream` (Nginx upstream address) are added to every response.

### 7.2 Registration Service (3001, DB `hr_auth`)

| Method | Path | Access | Description | Status |
|---|---|---|---|---|
| POST | `/api/auth/register` | Public | Body `{ email, password, fullName }`. Role is forced to `employee`. 409 if email exists | ✅ |
| POST | `/api/auth/register/staff` | Admin | Body `{ email, password, fullName, role }`. Create HR/Admin accounts | 🔲 Common |
| GET | `/api/users` | Staff | List users (`?role=&isActive=&search=`, paginated) | 🔲 Common |
| PATCH | `/api/users/:id/role` | Admin | Body `{ role }`. Audited as `ROLE_CHANGED` | 🔲 Common |

### 7.3 Login Service (3002, DB `hr_auth`)

| Method | Path | Access | Description | Status |
|---|---|---|---|---|
| POST | `/api/auth/login` | Public | Body `{ email, password }` → `{ token, tokenType, expiresIn, user }`. Same 401 for unknown email and wrong password; 403 if deactivated | ✅ |
| GET | `/api/auth/me` | Any | Current user (re-read from DB) | ✅ |

JWT payload: `{ sub: <userId>, role, email, iat, exp }`, HS256, default 1 h.

### 7.4 Employee Profile Service (3003, DB `hr_employee`) — Member 1

| Method | Path | Access | Description | Status |
|---|---|---|---|---|
| POST | `/api/employees` | Staff | Create profile `{ userId, firstName, lastName, email, department, jobTitle, … }`. 409 if exists | 🔲 |
| GET | `/api/employees` | Staff | List/search (`?department=&status=&search=`) | 🔲 |
| GET | `/api/employees/me` | Any | Own profile | 🔲 |
| GET | `/api/employees/:userId` | Owner / Staff | Profile detail | 🔲 |
| PUT | `/api/employees/:userId` | Owner (phone, address only) / Staff (all) | Update profile | 🔲 |
| DELETE | `/api/employees/:userId` | Admin | Soft delete (`status: terminated`) | 🔲 |
| GET | `/internal/employees/:userId` | Internal | `{ userId, firstName, lastName, email, department, jobTitle }` for Payroll | 🔲 |

### 7.5 Attendance & Time-Tracking Service (3004, DB `hr_attendance`) — Member 1

| Method | Path | Access | Description | Status |
|---|---|---|---|---|
| POST | `/api/attendance/clock-in` | Any | Start today's record. 409 if already clocked in | 🔲 |
| POST | `/api/attendance/clock-out` | Any | Body `{ workLog? }`. Computes `totalHours`, `overtimeHours` (> 8 h) | 🔲 |
| GET | `/api/attendance/me` | Any | Own records (`?from=&to=`) | 🔲 |
| GET | `/api/attendance` | Staff | All records (`?userId=&from=&to=`) | 🔲 |
| GET | `/api/attendance/summary/:userId?month=YYYY-MM` | Owner / Staff | `{ userId, month, daysPresent, totalHours, overtimeHours }` | 🔲 |
| GET | `/internal/attendance/summary/:userId?month=YYYY-MM` | Internal | Same summary, for Payroll | 🔲 |

### 7.6 Leave Management Service (3005, DB `hr_leave`) — Member 2

| Method | Path | Access | Description | Status |
|---|---|---|---|---|
| POST | `/api/leaves` | Any | Body `{ type: annual\|sick\|unpaid, startDate, endDate, reason }`. Checks balance + overlap | ✅ |
| GET | `/api/leaves/me` | Any | Own requests (`?status=`) | ✅ |
| GET | `/api/leaves/balance/me` | Any | `{ year, annual, sick }` each `{ allocated, used, remaining }` (default 14 / 7) | ✅ |
| GET | `/api/leaves` | Staff | All requests (`?status=&userId=`) | ✅ |
| PATCH | `/api/leaves/:id/review` | Staff | Body `{ decision: approved\|rejected, comment }`. Deducts balance on approval; cannot review own request | ✅ |
| DELETE | `/api/leaves/:id` | Owner | Cancel while `pending` | ✅ |

### 7.7 Performance Review Service (3006, DB `hr_performance`) — Member 2

| Method | Path | Access | Description | Status |
|---|---|---|---|---|
| POST | `/api/reviews` | Staff | Body `{ userId, period, ratings{quality,productivity,teamwork,communication: 1-5}, feedback, goals[] }`. Computes `overallRating`. 409 per (user, period) | ✅ |
| GET | `/api/reviews` | Staff | List (`?userId=&period=`) | ✅ |
| GET | `/api/reviews/me` | Any | Own reviews | ✅ |
| GET | `/api/reviews/:id` | Owner / Staff | Review detail | ✅ |
| PUT | `/api/reviews/:id` | Staff | Update ratings/feedback/goals | ✅ |
| DELETE | `/api/reviews/:id` | Admin | Delete | ✅ |

### 7.8 Payroll Service (3007, DB `hr_payroll`) — Member 3

Formula (`config/payrollRules.js`, ✅ already implemented): `hourly = base/160` · `overtimePay = overtimeHours × hourly × 1.5` · `gross = base + overtimePay` · `tax = 10 %` · `social = 5 %` · `net = gross − tax − social`.

| Method | Path | Access | Description | Status |
|---|---|---|---|---|
| PUT | `/api/payroll/salary/:userId` | Staff | Body `{ baseSalary, currency? }` (upsert) | ✅ |
| GET | `/api/payroll/salary/:userId` | Owner / Staff | Salary structure | ✅ |
| POST | `/api/payroll/generate` | Staff | Body `{ userId, month }`. Calls Employee + Attendance internally. 409 if already generated | ✅ |
| GET | `/api/payroll/payslips/me` | Any | Own payslips (`?month=`) | ✅ |
| GET | `/api/payroll/payslips` | Staff | All payslips (`?month=&userId=`) | ✅ |
| GET | `/api/payroll/payslips/:id` | Owner / Staff | Payslip detail | ✅ |

### 7.9 Audit & Logging Service (3008, DB `hr_audit`) — Member 3

| Method | Path | Access | Description | Status |
|---|---|---|---|---|
| POST | `/internal/logs` | Internal | Ingest an audit event (used by gateway, login, registration) | ✅ |
| GET | `/api/audit/logs` | Admin | Search (`?actorId=&action=&service=&outcome=&from=&to=`). `outcome=failure` = security view | 🔲 |
| GET | `/api/audit/logs/:id` | Admin | One entry | 🔲 |

**Events already emitted:** `USER_REGISTERED`, `LOGIN_SUCCESS`, `LOGIN_FAILED`, `LOGIN_BLOCKED`, `ACCESS_DENIED` (any 401/403 at the gateway), and `<METHOD> <path>` for every state-changing request. Services add business events with `sendAudit({ action: 'PAYSLIP_GENERATED', ... })`.

### Inter-service contracts (do not change without telling the other member)

| Caller → Callee | Endpoint | Response `data` |
|---|---|---|
| Payroll → Employee | `GET /internal/employees/:userId` | `{ userId, firstName, lastName, email, department, jobTitle }` |
| Payroll → Attendance | `GET /internal/attendance/summary/:userId?month=YYYY-MM` | `{ userId, month, daysPresent, totalHours, overtimeHours }` |
| Gateway / Login / Registration (and optionally any service) → Audit | `POST /internal/logs` | `{ id }` |

All internal calls send header `x-internal-key: <INTERNAL_API_KEY>` (helper: `internalGet`, `sendAudit`).

---

## 8. Data model

Collection names are Mongoose defaults (lower-cased, pluralised). Schemas are in each service's `src/models/`.

| Database | Collection | Key fields | Indexes |
|---|---|---|---|
| `hr_auth` | `users` | email, passwordHash, fullName, role, isActive | `email` unique |
| `hr_employee` | `employees` | userId, firstName, lastName, department, jobTitle, employmentType, hireDate, status | `userId` unique |
| `hr_attendance` | `attendances` | userId, date, clockIn, clockOut, totalHours, overtimeHours, status, workLog | `(userId, date)` unique |
| `hr_leave` | `leaverequests` | userId, type, startDate, endDate, days, status, reviewedBy, reviewComment | `userId` |
| `hr_leave` | `leavebalances` | userId, year, annual{allocated,used}, sick{allocated,used} | `(userId, year)` unique |
| `hr_performance` | `reviews` | userId, reviewerId, period, ratings{4×1-5}, overallRating, feedback, goals | `(userId, period)` unique |
| `hr_payroll` | `salarystructures` | userId, baseSalary, currency | `userId` unique |
| `hr_payroll` | `payslips` | userId, month, employee snapshot, baseSalary, overtimePay, gross, deductions, net | `(userId, month)` unique |
| `hr_audit` | `auditlogs` | actorId, actorRole, action, service, method, path, statusCode, outcome, ip, timestamp | action, outcome, timestamp |

Cross-service references are plain strings (`userId`), not DB-level foreign keys.

---

## 9. Load balancing

```
Client ─► Nginx :80 ─┬─► gateway1 (hostname gw1) ─┐
   (round robin)     └─► gateway2 (hostname gw2) ─┴─► Redis  (hash "lb:hits": { gw1: n, gw2: m })
```

- `nginx/nginx.conf` defines `upstream gateways { server gateway1:3000; server gateway2:3000; }`.
- Each gateway has a fixed container `hostname` (`gw1`, `gw2`) set in the compose file.
- `GET /api/lb-info` increments the hit counter for the answering instance in Redis and returns all counters.

**Demo for the report:**

1. Call `GET http://<EC2-A-IP>/api/lb-info` 10× in Postman → screenshot showing `servedBy` alternating `gw1`/`gw2` and `hits` growing in both. Also show the `X-Served-By` / `X-Upstream` response headers.
2. Screenshot `nginx/nginx.conf` and the compose file (gateway1/gateway2/redis/nginx).
3. Failover (bonus): `docker stop <gateway2 container>` → calls still succeed (served only by `gw1`); `docker start` it again.

Only the gateway is replicated; the other services run as a single instance.

---

## 10. Implementation status & TODO tracker

Find every open task:

```bash
grep -rn "TODO \[Member 1\]" services --include=*.js     # Member 1
grep -rn "TODO \[Member 2\]" services --include=*.js     # Member 2
grep -rn "TODO \[Member 3\]" services --include=*.js     # Member 3
grep -rn "TODO \[Common\]"   services --include=*.js     # Common services
grep -rn "TODO \[All members\]" services --include=*.js  # Cross-cutting
```

| Area | Done ✅ | To do 🔲 |
|---|---|---|
| **Common infrastructure** | Gateway (JWT, RBAC route table, proxy, audit forwarding, header spoof protection, Redis LB demo), shared helpers, Dockerfiles, compose files, Nginx, EC2 compose files, seed script | Registration: `register/staff`, `GET /users`, `PATCH /users/:id/role`. (Optional) change-password |
| **Member 1** | Models, routes + role guards, constants | Employee: 6 controllers + 1 internal. Attendance: clock-in/out, my records, list, summary (+ internal) |
| **Member 2** | Models, routes + role guards, default balances | Leave: 6 controllers. Performance: 6 controllers |
| **Member 3** | Models, routes + role guards, payroll formula, audit ingest | Payroll: 6 controllers (incl. calls to Employee + Attendance). Audit: list + get |
| **Everyone** | – | Add your endpoints to the gateway route table if you add new ones · Postman collection · screenshots · project document |

**Suggested order:** (1) Common: finish Registration → everybody has HR/Admin tokens. (2) Employee profile (others need profiles for realistic data). (3) Attendance → (4) Payroll integration. Leave/Performance/Audit are independent.

### Suggested timeline

| Phase | Work |
|---|---|
| 0 | Push the scaffold, everyone clones, `docker compose up`, seed, log in through Postman |
| 1 | Common: finish Registration endpoints |
| 2 | Members implement their services in parallel (own branches) |
| 3 | Integration: Payroll ↔ Employee/Attendance, audit events, RBAC checks across roles |
| 4 | Deploy to 4 EC2 instances, test with Postman via the public IP |
| 5 | Screenshots, architecture diagram, project document, demo |

---

## 11. Developer guide

### Implementing an endpoint (checklist)

1. Find the `TODO` in `controllers/*.js` and read the steps.
2. Replace `throw notImplemented(...)` with your logic. Use `ok()`/`created()` for responses and **throw** `badRequest()/forbidden()/notFound()/conflict()` for errors (async errors are caught automatically in Express 5).
3. Route + role guard already exist in `routes/*.js`; keep fixed paths (`/me`) **before** `/:id` routes.
4. Changed or added a route? **Update `api-gateway/src/config/routes.js`**, otherwise the gateway returns 404.
5. Emit audit events for important actions: `sendAudit({ actorId: req.user.id, actorRole: req.user.role, action: 'LEAVE_APPROVED', ... })`.
6. Update the status in this README's API tables (🔲 → ✅).
7. Test through the gateway with Postman for **each role** (right role = success, wrong role = 403, no token = 401).

Example controller:

```js
export const getMyProfile = async (req, res) => {
  const employee = await Employee.findOne({ userId: req.user.id });
  if (!employee) throw notFound('Profile not created yet, ask HR');
  return ok(res, employee);
};
```

### Code conventions

- ES modules, `async/await`, no callbacks. Keep controllers thin and comments short and useful.
- Never trust the body: whitelist fields before saving. Never return `passwordHash`.
- Always read the caller from `req.user` (set from the gateway headers), never from the request body.
- Errors: throw helpers from `common/errors.js`. Responses: `common/response.js`.
- Changed something in `shared/common/`? Run `./scripts/sync-common.sh` and commit all copies.

### Git workflow

- `main` always runs. One branch per feature/member: `feat/employee-service`, `feat/leave-service`, …
- Small commits, e.g. `feat(leave): implement review endpoint`. Open a pull request, have a teammate review, then merge.
- Touch another member's service only through their PR/branch, and agree on contract changes first (section 7, *Inter-service contracts*).
- Never commit `.env`, `*.pem`, or `node_modules`.

---

## 12. Deploying to AWS EC2

Target: **4 instances** (the maximum), AWS Academy Learner Lab.

| Instance | Runs | Compose file | Public access |
|---|---|---|---|
| EC2-A | Nginx, gateway1, gateway2, Redis, Registration, Login | `deploy/ec2-a.compose.yml` | **Port 80** (+ SSH 22 from your IP) |
| EC2-B | Employee, Attendance | `deploy/ec2-b.compose.yml` | none |
| EC2-C | Leave, Performance | `deploy/ec2-c.compose.yml` | none |
| EC2-D | Payroll, Audit | `deploy/ec2-d.compose.yml` | none |

### 1. Create the instances

- Same **VPC and subnet** for all four (so private IPs can talk to each other). Amazon Linux 2023 or Ubuntu, `t2.micro`/`t3.micro` is enough.
- Create two security groups:
  - `hr-public` (EC2-A only): inbound **TCP 80** from anywhere, **TCP 22** from your IP.
  - `hr-internal` (attach to **all four**): inbound **All TCP from `hr-internal` itself**, plus TCP 22 from your IP. This allows the gateway and Payroll to call ports 3001–3008 internally while nothing but port 80 is exposed to the internet.
- Note each instance's **Private IPv4 address**; EC2-A's **Public IPv4** is what you use in Postman.

> **AWS Academy note:** public IPs change when the lab stops and restarts (private IPs do not). After each restart, re-check EC2-A's public IP. If you need a fixed one, attach an Elastic IP.

### 2. Install Docker (on every instance)

Amazon Linux 2023:

```bash
sudo dnf install -y docker git
sudo systemctl enable --now docker
sudo usermod -aG docker ec2-user && newgrp docker
# Compose plugin
sudo mkdir -p /usr/local/lib/docker/cli-plugins
sudo curl -SL https://github.com/docker/compose/releases/latest/download/docker-compose-linux-x86_64 \
  -o /usr/local/lib/docker/cli-plugins/docker-compose
sudo chmod +x /usr/local/lib/docker/cli-plugins/docker-compose
docker compose version
```

Ubuntu: `sudo apt update && sudo apt install -y docker.io docker-compose-v2 git && sudo usermod -aG docker ubuntu`.

### 3. Deploy (on every instance)

```bash
git clone <your-repo-url> && cd hr-payroll-system/deploy
cp .env.example .env
nano .env       # MONGODB_URI, JWT_SECRET, INTERNAL_API_KEY, and the EC2_B/C/D private IPs
                # (use the SAME values on all four instances)

# pick the file for THIS instance:
docker compose -f ec2-b.compose.yml up -d --build
```

Start order: **B, C, D first**, then **A**. After A is up, seed the demo accounts once:

```bash
docker compose -f ec2-a.compose.yml exec registration-service node src/scripts/seed.js
```

### 4. Verify

```bash
curl http://<EC2-A-public-IP>/health
curl http://<EC2-A-public-IP>/api/lb-info
```

Then run your Postman collection with `baseUrl = http://<EC2-A-public-IP>`.

**Small instances (1 GB RAM):** build one instance at a time; if a build is killed for memory, add swap (`sudo fallocate -l 1G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile`) or run `COMPOSE_PARALLEL_LIMIT=1 docker compose ... build` first.

**MongoDB Atlas:** Network Access must allow the EC2 instances' public IPs (simplest for this project: `0.0.0.0/0`).

---

## 13. Testing checklist (for screenshots)

Run these through **EC2-A's public IP** in Postman and screenshot request + response.

| # | Scenario | Expected |
|---|---|---|
| 1 | Login with wrong password | 401 `INVALID_CREDENTIALS` |
| 2 | Login with unknown email | 401 `INVALID_CREDENTIALS` (same message) |
| 3 | Call a protected route without token | 401 `NO_TOKEN` |
| 4 | Invalid / tampered token | 401 `INVALID_TOKEN` |
| 5 | Expired token (use a short `JWT_EXPIRES_IN` once) | 401 `TOKEN_EXPIRED` |
| 6 | Employee token on an HR route (e.g. `POST /api/payroll/generate`) | 403 |
| 7 | HR token on an admin route (e.g. `PATCH /api/users/:id/role`, `GET /api/audit/logs`) | 403 |
| 8 | Employee reads another employee's payslip / profile | 403 |
| 9 | Duplicate registration, double clock-in, duplicate payslip | 409 |
| 10 | Leave request exceeding balance | 400 |
| 11 | Validation errors (bad email, short password, missing fields) | 400 with details |
| 12 | Direct access to a service port from the internet | Connection refused / timeout (security group) |
| 13 | Calling `/internal/...` through the gateway | 404 |
| 14 | Admin views audit logs showing the attempts above (`?outcome=failure`) | list of failures |
| 15 | `GET /api/lb-info` repeated | `servedBy` alternates `gw1` / `gw2` |
| 16 | Successful call for **every** API with the right role + the matching MongoDB Atlas document | screenshots |

---

## 14. Project document checklist

Mapped to the submission format and the grading rubric.

| Section | What to include | Rubric |
|---|---|---|
| **Title** | e.g. *Enterprise HR & Payroll System: Microservice Architecture* | – |
| **Architecture** | Diagram (section 3) + table of microservice name, port, URL, and its API names (section 7) | Distributed architecture (10) |
| **Collections & schemas** | Screenshot of each `models/*.js` and the collections in Atlas (section 8) | Database & CRUD (10) |
| **API calls** | Postman screenshots using the **EC2 public IP** + the resulting MongoDB document | Database & CRUD (10) |
| **Load balancing** | `nginx.conf`, compose file, `lb-info` screenshots (section 9) | Load balancer (5) |
| **Security testing** | Section 13 screenshots | JWT & RBAC (10) |
| **Docker** | Dockerfile + compose screenshots, `docker compose ps` on each EC2 | Distributed architecture (10) |
| **Source** | GitHub link | – |
| **Demo** | Walk through login → role-restricted calls → load balancing | Documentation (5) |

---

## 15. Troubleshooting

| Problem | Likely cause / fix |
|---|---|
| `Missing required environment variable: …` | `.env` not created or variable missing (root `.env` for compose, `deploy/.env` on EC2) |
| Service restarts forever, log says *MongoDB connection failed* | Wrong `MONGODB_URI`, or Atlas Network Access does not allow this IP |
| `401 GATEWAY_ONLY` when calling a service directly | Expected: go through the gateway, or send `x-internal-key` + `x-user-*` headers when testing locally |
| Gateway `404 NOT_FOUND` for a new endpoint | Add it to `api-gateway/src/config/routes.js` and rebuild the gateway |
| Gateway `502 BAD_GATEWAY` | Target service is down or `*_SERVICE_URL` is wrong (on EC2 use **private** IPs and open the ports in the `hr-internal` group) |
| `/api/lb-info` → 503 `REDIS_UNAVAILABLE` | Redis container not started yet; wait a few seconds or check `docker compose logs redis` |
| `501 NOT_IMPLEMENTED` | The endpoint is still a TODO: implement it |
| Token rejected after changing `JWT_SECRET` | Restart Login **and** both gateways, then log in again |
| Changes not visible in Docker | Rebuild: `docker compose up -d --build <service>` |
| `npm ci` fails in Docker build | You changed `package.json` without updating the lock file: run `npm install` in that service and commit `package-lock.json` |
