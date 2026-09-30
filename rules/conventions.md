# Coding Conventions

This document defines coding standards for the Expense Tracker project.

Consistency is preferred over personal preference.

---

# General Principles

- Prioritize readability over cleverness.
- Prefer explicit code over implicit behavior.
- Keep implementations simple.
- Avoid unnecessary abstractions.
- Follow existing project patterns before introducing new ones.

---

# Naming

## Files

Use kebab-case.

Examples:

- `expense-service.ts`
- `expense-repository.ts`
- `expense-table.tsx`
- `category-badge.tsx`

---

## Components

Use PascalCase.

Examples:

- `ExpenseTable`
- `ExpenseForm`
- `CategorySelect`
- `BudgetSummaryCard`

---

## Functions

Use camelCase.

Function names should describe intent.

Good:

- `createExpense()`
- `findByCategory()`
- `calculateTotalExpense()`
- `deleteExpense()`
- `getMonthlySummary()`

Avoid:

- `handle()`
- `process()`
- `execute()`
- `run()`

---

## Variables & Properties

Use descriptive camelCase names.

Avoid abbreviations unless universally understood (e.g., `id`, `db`, `err`).

---

## Types & Interfaces

Use PascalCase.

Examples:

- `Expense`
- `CreateExpenseInput`
- `ExpenseFilterOptions`
- `BudgetLimit`

---

# Functions

Functions should perform one responsibility.

Prefer small, focused functions.

Avoid deeply nested logic.

Prefer early returns.

Avoid excessive parameters (bundle into an options object when exceeding 3 parameters).

---

# Components

Components should focus on presentation.

Extract repeated UI into reusable components.

Avoid large, monolithic components.

Separate presentation from complex server-state hooks.

---

# Services

One service should represent one business capability.

Services should expose intention-revealing methods.

Avoid utility-style service classes or dump-all services.

Business rules (e.g. calculation, category limits) belong here.

---

# Repositories

Repositories expose persistence operations only.

Keep repository interfaces small and focused.

Avoid generic repositories; prefer feature-specific repositories (e.g., `ExpenseRepository`, `CategoryRepository`).

Encapsulate all Drizzle ORM operations within repositories.

---

# Imports

Maintain consistent import order:

1. External packages (e.g., `react`, `express`, `zod`)
2. Workspace packages (e.g., `@expense-tracker/contracts`)
3. Internal application modules (absolute or path-aliased)
4. Relative imports (`./`, `../`)

Remove unused imports.

Avoid circular imports.

---

# Error Handling

Throw meaningful, typed domain errors from the Service layer.

Avoid silent failures or empty catch blocks.

Avoid generic error messages like "Something went wrong".

Include actionable context in error messages.

Presentation layer translates domain errors into structured HTTP responses with appropriate status codes:

- 400 Bad Request (validation failure, invalid input)
- 404 Not Found (resource does not exist)
- 409 Conflict (duplicate record, constraint violation)
- 500 Internal Server Error (unexpected database or system failure)

---

# Comments

Code should explain itself whenever possible.

Comments should explain "why", not "what".

Remove outdated comments.

Do not leave commented-out code in the repository.

---

# Formatting

Use Prettier as configured in `.prettierrc`.

Do not manually fight formatting rules.

Maintain consistent spacing and line length.

---

# Duplication

Avoid duplicated logic.

Extract shared behaviour only after duplication becomes evident.

Do not create abstractions prematurely.

---

# Constants

Avoid magic numbers and hardcoded strings.

Use named constants where appropriate.

---

# Boolean Logic

Prefer positive condition names (e.g. `isEnabled`, `isValid` instead of `isNotDisabled`).

Avoid double negatives.

Keep conditionals simple and readable.

---

# Async Code

Prefer async/await over raw promises.

Avoid deeply nested promise chains.

Handle expected failures explicitly.

---

# TypeScript & Strict Typing

TypeScript strict mode is mandatory.

Strictly avoid `any`. Use `unknown` with type narrowing or Zod schemas where type is unverified.

Prefer explicit types for public interfaces and exported function signatures.

Derive types from Zod schemas and ts-rest contracts using `z.infer<typeof schema>`.

Model domain concepts with explicit types and discriminated unions where appropriate.

Use `readonly` where mutation is not intended.

---

# Testing

Write tests for business behaviour and observable outcomes.

Avoid testing private implementation details.

Keep tests independent — each test should set up and tear down its own data.

Unit test Services and Repositories using Vitest.

End-to-End test critical user flows using Playwright.

---

# Git

Keep changes focused and atomic.

One logical change per commit.

Write meaningful commit messages following Conventional Commits (e.g., `feat(expense-crud): ...`, `fix(expense-crud): ...`).

---

# Maintainability

Leave the codebase in a better state than you found it.

When introducing new code, adhere strictly to the established architecture and coding conventions.
