# Architecture

This document defines the architectural rules of the Expense Tracker project.

These rules are mandatory.

---

# Architectural Style

The system consists of two independent applications:

- Frontend Application (Next.js 14)
- Backend API (Express.js)

The frontend communicates with the backend exclusively through HTTP APIs defined using ts-rest contracts under `packages/contracts`.

Business logic must remain entirely within the backend.

---

# Backend Layers

```
Presentation
     ↓
  Service
     ↓
 Repository
     ↓
  Database
```

---

## Presentation Layer

### Responsibilities

- Receive HTTP requests via Express routers.
- Validate incoming requests using ts-rest contracts and Zod schemas.
- Invoke application services.
- Translate domain results and errors into structured HTTP responses.

### Rules

- MUST NOT contain business logic.
- MUST NOT access the database directly.
- MUST remain thin.

---

## Service Layer

### Responsibilities

- Implement business rules and domain logic.
- Coordinate multi-step workflows.
- Enforce domain constraints (e.g. budget limits, valid expense amounts, category associations).

### Rules

- Owns all business logic.
- MUST remain independent of Express (no `req`, `res`, `next` dependencies).
- MUST NOT depend on HTTP request or response objects.
- MUST communicate with persistence exclusively through repositories.

---

## Repository Layer

### Responsibilities

- Persist and retrieve data from SQLite (`data/app.db`).
- Encapsulate Drizzle ORM queries and schema definitions.

### Rules

- Database access occurs exclusively here.
- MUST NOT contain business rules.
- MUST expose intention-revealing methods (e.g. `createExpense()`, `findExpensesByFilter()`, `getMonthlySpendByCategory()`).

---

## Database

- SQLite database stored at `data/app.db`.
- Managed using Drizzle ORM with `better-sqlite3` driver.

---

# Dependency Rules

### Allowed

```
Presentation → Service
Service → Repository
Repository → Database
```

### Forbidden

```
Presentation → Repository
Presentation → Database
Repository → Service
Repository → Presentation
Service → HTTP (Express)
Frontend → Database
```

---

# Frontend Architecture

- The frontend is built with Next.js 14, TanStack Query, and Tailwind CSS.
- Responsible exclusively for user interaction, layout, and presentation.
- UI components MUST NOT contain business rules.
- Pages compose reusable presentation components.
- Communicates exclusively through ts-rest clients generated from `packages/contracts`.
- Server state is managed via TanStack Query; local UI state is managed with React state.

---

# Backend Responsibilities

The backend owns:

- Business rules and calculations
- Authoritative validation (Zod schemas)
- Authorization (when introduced)
- Data persistence in SQLite (`data/app.db`)
- Expense CRUD operations and transaction history
- Category management and hierarchy
- Budget limit enforcement and progress tracking
- Aggregation, spending analytics, and report generation

---

# API Contracts

The API contract is the single source of truth between the frontend and backend.

Routes, request schemas, response schemas, and inferred client/server types MUST originate from the shared ts-rest contract in `packages/contracts`.

The frontend and backend MUST NOT define duplicate request or response types independently.

---

# Frontend Responsibilities

The frontend owns:

- Rendering UI views and dashboards
- Navigation and routing
- User interaction and input capture
- Form state management (React Hook Form + Zod)
- Client-side validation for instant UX feedback
- API communication via TanStack Query and `@ts-rest/react-query`

---

# API Design

- All API contracts are defined using ts-rest in `packages/contracts`.
- The frontend MUST consume backend APIs through generated ts-rest clients.
- Business entities are exposed through RESTful resources (e.g. `/expenses`, `/categories`, `/budgets`).

---

# Validation

- Client-side validation improves user experience and provides immediate feedback.
- Server-side validation is authoritative and enforces domain invariants via Zod.
- Incoming API requests MUST be validated before entering the Service Layer.

---

# State Management

- Server state is managed using TanStack Query.
- Local UI state remains local (React hooks) whenever possible.
- Avoid unnecessary global state.

---

# Database Access

- Only repositories may access the database.
- Database access is managed exclusively through Drizzle ORM with SQLite (`data/app.db`).
- Services MUST NOT execute ORM operations directly.

---

# Error Handling

- Services produce domain errors (custom error classes).
- Presentation translates domain errors into appropriate HTTP status codes (e.g. 400 Bad Request, 404 Not Found, 409 Conflict).
- Frontend translates HTTP error responses into user-facing feedback (toasts, alerts, inline form errors).

---

# Transactions

- Services define transactional intent and boundaries.
- Repositories execute transactional operations using Drizzle ORM database transactions.

---

# Separation of Concerns

```
Frontend concerns
       ↓
API communication (ts-rest in packages/contracts)
       ↓
Business rules (Service Layer)
       ↓
Persistence (Repository Layer + Drizzle ORM)
       ↓
Database (SQLite at data/app.db)
```

Each tier must remain isolated from the others.

---

# Forbidden Practices

- Do not place business logic in Express route handlers.
- Do not access the database outside repositories.
- Do not bypass ts-rest contracts.
- Do not call the database from the frontend.
- Do not duplicate business rules between frontend and backend.
- Do not expose ORM models directly to API consumers.
- Do not couple business logic to Express.
- Do not create circular dependencies.
