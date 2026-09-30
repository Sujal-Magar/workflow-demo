# Technology Stack

This document defines the technologies used throughout the Expense Tracker project.

All implementations must adhere to these selections unless explicitly approved otherwise.

---

# Frontend

## Framework

- Next.js 14 (App Router / CSR)

## Rendering

- Client-Side Rendering (CSR)

## Language

- TypeScript (Strict Mode)

## UI & Styling

- React 18
- Tailwind CSS
- Radix UI Primitives (`@radix-ui/react-dialog`, `@radix-ui/react-label`)
- `class-variance-authority`, `clsx`, `tailwind-merge`

## Forms & Validation

- React Hook Form
- Zod (`@hookform/resolvers`)

## Data Fetching & Server State

- TanStack Query (`@tanstack/react-query`)

## Authentication

- `@react-oauth/google` (Google sign-in; approved for `auth`, see `features/auth/fds.md` §2)

## API Communication

- ts-rest React Query Client (`@ts-rest/react-query`)

---

# Backend

## Framework

- Express.js

## Runtime & Execution

- Node.js 22 LTS
- tsx (Development execution & watcher)

## Language

- TypeScript (Strict Mode)

## API Contract Integration

- ts-rest Express Adapter (`@ts-rest/express`)

## Business Logic

- Service Layer (pure TypeScript, framework-agnostic)

## Validation

- Zod

## Authentication

Approved for `auth`, see `features/auth/fds.md` §2.

- `argon2` (password hashing, argon2id)
- `jose` (JWT signing and verification)
- `google-auth-library` (Google ID-token verification)
- `cookie-parser` (refresh token cookie)

---

# API Contracts

## Package

- `@expense-tracker/contracts` (located in `packages/contracts`)

## Definition

- ts-rest (`@ts-rest/core`)
- Zod (Request and response schemas)

---

# Database

## ORM

- Drizzle ORM (`drizzle-orm`, `drizzle-kit`)

## Engine & Driver

- SQLite via `better-sqlite3` driver

## Storage Path

- `data/app.db`

---

# Package Manager

- pnpm (Workspace monorepo)

---

# Code Quality & Static Analysis

- ESLint 9 (`eslint.config.mjs`)
- Prettier (`.prettierrc`)
- SonarQube (Static Analysis Gate & Full Quality Gate)

---

# Testing

## Unit & Integration Testing

- Vitest
- `@vitest/coverage-v8`
- `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`

## End-to-End Testing

- Playwright (`@playwright/test`)

---

# Principles

- End-to-end TypeScript with strict typing.
- Monorepo structure managed with pnpm workspaces.
- RESTful API contracts defined with ts-rest under `packages/contracts`.
- Client-side rendered frontend with Next.js 14 and TanStack Query.
- Server-side business logic isolated in the Service Layer.
- Database access exclusively through Drizzle ORM and `better-sqlite3` on `data/app.db`.
- Component-based UI with Radix UI primitives and Tailwind CSS.
- Responsive, accessible design.
- No external email services (no AWS SES).
