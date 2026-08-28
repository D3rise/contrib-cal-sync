# Layered Inversify Architecture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the flat source tree into enforced domain, application, infrastructure, presentation, and composition layers with `ContributionSyncService` as the deep core workflow and InversifyJS as the composition-root IoC container.

**Architecture:** Pure contribution rules live in `domain`; `application` owns the sync use case and capability-shaped ports; `infrastructure` translates files, Git, HTTP, Keychain, GitHub, and macOS mechanisms; thin CLI handlers live in `presentation`; only `composition` imports Inversify and wires concrete adapters. Existing CLI behavior and installation contracts remain unchanged.

**Tech Stack:** Node.js 22+, TypeScript 6, InversifyJS, reflect-metadata, Node test runner, ESLint import restrictions.

## Global Constraints

- Preserve all existing runtime behavior, tests, CLI commands, safety limits, installation paths, and English copy.
- Keep the user's specific corporate hostname absent from every committed artifact.
- Do not import Inversify from domain, application, infrastructure, or presentation code.
- Dependencies point inward: presentation -> application -> domain; infrastructure -> application/domain; composition -> all layers.
- Keep pure rules as direct functions; create ports only for external capabilities.

---

### Task 1: Domain and application core

**Files:**
- Create: `src/domain/contribution-calendar.ts`, `src/domain/reconciliation.ts`, `src/domain/contribution-time.ts`
- Create: `src/application/sync.types.ts`, `src/application/sync.ports.ts`, `src/application/errors.ts`, `src/application/retry.ts`, `src/application/contribution-sync.service.ts`
- Test: `test/application/contribution-sync.service.test.ts`

**Interfaces:**
- `ContributionSyncService.execute({ dryRun }): Promise<SyncResult>` is the single sync workflow interface.
- Application-owned ports expose credentials, source calendar, destination identity/repository, state, lock, notifications, logs, configuration, and clock.

- [x] Write a failing service test using constructor-injected port adapters.
- [x] Confirm it fails because the layered service does not exist.
- [x] Move pure rules inward and implement the service with no infrastructure or Inversify imports.
- [x] Run focused domain/application tests.

### Task 2: Infrastructure adapters

**Files:**
- Create modules under `src/infrastructure/configuration`, `source`, `github`, `git`, `security`, `persistence`, `observability`, `macos`, and `system`.
- Update infrastructure-focused tests under `test/infrastructure`.

**Interfaces:**
- Each adapter implements one application-owned capability port and owns external payload/error translation.

- [x] Move each existing technical implementation behind its consuming port.
- [x] Translate source network failures to `SourceUnavailableError` at the HTTP adapter.
- [x] Preserve real bare-Git, Keychain stdin, plist, logger, and installer test behavior.
- [x] Run focused infrastructure tests.

### Task 3: CLI controller and command handlers

**Files:**
- Create: `src/presentation/cli/cli.controller.ts`, `command-handler.ts`, `console-io.ts`
- Create handlers under `src/presentation/cli/handlers/` for configuration, credentials, sync, setup, status, diagnostics, logs, and service control.
- Test: `test/presentation/cli.controller.test.ts`, `test/presentation/handlers/*.test.ts`

**Interfaces:**
- `CliController.execute(args)` selects one `CommandHandler`; each handler translates one command family and invokes application interfaces.

- [x] Write failing controller and sync-handler tests.
- [x] Implement thin routing and command translation without Git, HTTP, file, or Keychain mechanics.
- [x] Preserve usage, output, exit codes, and first-push confirmation behavior.
- [x] Run focused presentation tests.

### Task 4: Inversify composition root and boundary enforcement

**Files:**
- Create: `src/composition/tokens.ts`, `src/composition/container.ts`, `src/main.ts`
- Create: `test/composition/container.test.ts`
- Modify: `eslint.config.js`, `package.json`, `README.md`, architecture ADR.

**Interfaces:**
- `createContainer(paths)` returns the fully wired Inversify container; `CliController` is the executable root.

- [x] Write a failing container test that resolves the CLI controller and proves repeated port resolution is singleton-scoped where state matters.
- [x] Install InversifyJS and bind adapters, services, and handlers only in the composition root.
- [x] Add ESLint restrictions preventing outward imports from inner layers and Inversify imports outside composition.
- [x] Update architecture documentation and the source-tree map.
- [ ] Run all tests, lint, typecheck, TypeScript build, Swift build, shell/plist checks, hostname scan, and local end-to-end reconciliation.
