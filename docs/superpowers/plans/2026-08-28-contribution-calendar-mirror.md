# Contribution Calendar Mirror Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an installable macOS service that mirrors daily contribution counts from a configurable private GitLab `calendar.json` endpoint into a dedicated private GitHub repository.

**Architecture:** A TypeScript CLI owns configuration, validation, Keychain access, calendar retrieval, Git reconciliation, scheduled-run state, and `launchd` management. Git operations use the system executable and a transient askpass environment; a minimal Swift app bundle delivers actionable macOS notifications. Shell installers stage versioned builds and atomically switch the active installation.

**Tech Stack:** Node.js 22+, TypeScript 5, Node's built-in test runner, system Git, macOS Keychain and `launchd`, Swift 6/UserNotifications.

## Global Constraints

- Support macOS 13+ on Apple Silicon and Intel.
- Keep every committed document, example, fixture, test, message, and source file free of the user's specific corporate hostname; only a user's local untracked configuration may contain it.
- Use English for documentation, CLI output, prompts, logs, and notifications.
- Store GitLab and GitHub tokens only in macOS Keychain.
- Never force-push, rewrite published history, log secrets, or delete the remote repository.
- Default to a 60-minute interval, a 365-day lookback, local IANA time zone, 1,000 commits per day, and 20,000 commits per run.
- Use strict red-green-refactor cycles for production behavior.

---

### Task 1: Project foundation and validated configuration

**Files:**
- Create: `package.json`, `tsconfig.json`, `.gitignore`, `src/config.ts`, `src/paths.ts`
- Create: `test/config.test.ts`

**Interfaces:**
- Produces: `AppConfig`, `defaultConfig()`, `parseConfig(value)`, `loadConfig(paths)`, `saveConfig(paths, config)`, and `resolvePaths(env)`.

- [ ] **Step 1: Write failing tests for defaults, schema validation, interval bounds, IANA time zones, HTTPS URLs, and atomic save permissions.**

```ts
test('rejects an interval shorter than fifteen minutes', () => {
  assert.throws(() => parseConfig({ ...validConfig, intervalMinutes: 14 }), /at least 15/)
})
```

- [ ] **Step 2: Run `npm test -- test/config.test.ts` and confirm failure because the configuration module is absent.**
- [ ] **Step 3: Implement the smallest schema parser and atomic JSON persistence that satisfy the tests.**
- [ ] **Step 4: Run `npm test -- test/config.test.ts` and confirm all configuration tests pass.**

### Task 2: Calendar contract and reconciliation plan

**Files:**
- Create: `src/calendar.ts`, `src/reconcile.ts`, `src/time.ts`, `test/calendar.test.ts`, `test/reconcile.test.ts`, `test/time.test.ts`

**Interfaces:**
- Produces: `parseCalendarJson(value)`, `fetchCalendar(config, token, fetchImpl)`, `planMirror(source, mirrored, limits, today)`, and `contributionTimestamp(date, timeZone)`.

- [ ] **Step 1: Write failing tests using literal `date -> integer` fixtures, including malformed keys, negative/fractional values, omitted zero days, lookback filtering, append-only diffs, 84 contributions in one day, safety limits, and noon offsets.**

```ts
test('plans all eighty-four missing mirror commits', () => {
  assert.deepEqual(planMirror({ '2026-07-02': 84 }, {}, limits, '2026-08-28'), [{ date: '2026-07-02', count: 84 }])
})
```

- [ ] **Step 2: Run the three focused test files and confirm missing-module failures.**
- [ ] **Step 3: Implement strict parsing, authenticated calendar retrieval, append-only planning, guard failures, and explicit local-noon timestamps.**
- [ ] **Step 4: Run the focused tests and confirm they pass.**

### Task 3: GitHub identity and append-only Git repository adapter

**Files:**
- Create: `src/github.ts`, `src/git.ts`, `src/process.ts`, `test/github.test.ts`, `test/git.integration.test.ts`

**Interfaces:**
- Produces: `parseGitHubRepositoryUrl(url)`, `getGitHubIdentity(token)`, `deriveNoreplyEmail(identity)`, and `GitMirror.reconcile(plan, identity)`.

- [ ] **Step 1: Write failing identity tests and real local bare-repository integration tests covering empty-repository initialization, default-branch commits, machine markers, unrelated commit exclusion, backdated author/committer dates, and non-force push behavior.**

```ts
test('counts only commits carrying the mirror trailer', async () => {
  const counts = await mirror.readMirroredCounts()
  assert.deepEqual(counts, { '2026-08-28': 2 })
})
```

- [ ] **Step 2: Run the focused tests and confirm the adapter is absent.**
- [ ] **Step 3: Implement system-Git execution, an environment-only askpass bridge, marker counting, service-file commits, and fast-forward-only pushes.**
- [ ] **Step 4: Run the focused tests and confirm local repository behavior passes without network access.**

### Task 4: Keychain, run state, retries, logging, and sync orchestration

**Files:**
- Create: `src/keychain.ts`, `src/retry.ts`, `src/state.ts`, `src/logger.ts`, `src/sync.ts`
- Create: `test/keychain.test.ts`, `test/retry.test.ts`, `test/state.test.ts`, `test/logger.test.ts`, `test/sync.test.ts`

**Interfaces:**
- Produces: `CredentialStore`, `withRetry(operation, policy)`, `RunStateStore`, `RotatingLogger`, and `runSync(dependencies, options)`.

- [ ] **Step 1: Write failing tests for hidden credentials, bounded transient retries, single-run locking, immediate permanent-failure notification, three consecutive source-network failures, recovery notification, redacted logs, dry-run, and push orchestration.**
- [ ] **Step 2: Run the focused tests and confirm missing behavior.**
- [ ] **Step 3: Implement dependency-injected orchestration and platform command adapters without embedding secrets in arguments or logs.**
- [ ] **Step 4: Run the focused tests and confirm all failure and recovery paths pass.**

### Task 5: CLI, launchd management, and actionable notification helper

**Files:**
- Create: `src/cli.ts`, `src/launchd.ts`, `src/notifier.ts`, `native/NotificationHelper.swift`, `native/Info.plist`
- Create: `test/cli.test.ts`, `test/launchd.test.ts`, `test/notifier.test.ts`

**Interfaces:**
- Produces the agreed CLI commands: `configure`, `config show|get|set`, `credentials set|status`, `run [--dry-run]`, `status`, `doctor`, `logs [--follow]`, and `service enable|disable|restart`.

- [ ] **Step 1: Write failing executable CLI and adapter tests for command routing, masked output, interval-triggered plist regeneration, helper invocation, Retry dispatch, and unsupported-platform diagnostics.**
- [ ] **Step 2: Run the focused tests and confirm expected failures.**
- [ ] **Step 3: Implement the CLI, interactive hidden input, launchctl adapter, plist generation, and Swift UserNotifications helper with a Retry action that starts a locked run.**
- [ ] **Step 4: Run the focused tests, `npm run build`, and `npm run build:helper`; confirm TypeScript and Swift builds pass.**

### Task 6: Idempotent macOS installation and removal

**Files:**
- Create: `scripts/install.sh`, `scripts/uninstall.sh`, `test/install.test.ts`, `test/uninstall.test.ts`

**Interfaces:**
- Produces runnable `scripts/install.sh [--no-config]` and `scripts/uninstall.sh [--purge]`.

- [ ] **Step 1: Write failing sandboxed script tests with fake home directories and command shims for prerequisite rejection, staged version activation, rollback, preserved configuration, service unloading, and purge-only secret deletion.**
- [ ] **Step 2: Run the script tests and confirm the scripts are absent.**
- [ ] **Step 3: Implement non-root preflight, versioned staging, atomic active-version switching, CLI wrapper creation, rollback, and safe purge behavior.**
- [ ] **Step 4: Run script tests and shell syntax checks; confirm no real user service, Keychain item, or repository is mutated.**

### Task 7: User documentation and release verification

**Files:**
- Create: `README.md`, `LICENSE`, `config.example.json`
- Modify: `CONTEXT.md`, `docs/adr/*.md`, `package.json`

**Interfaces:**
- Documents prerequisites, token scopes, private-contribution visibility, VPN recovery, commands, configuration, install/update/uninstall, troubleshooting, and removal guarantees.

- [ ] **Step 1: Write the English documentation with neutral example hosts and a complete installation walkthrough.**
- [ ] **Step 2: Run `npm test`, `npm run typecheck`, `npm run build`, `npm run build:helper`, `npm run lint`, and `bash -n scripts/install.sh scripts/uninstall.sh`.**
- [ ] **Step 3: Run a local end-to-end dry-run and push against temporary HTTP/calendar and bare-Git fixtures.**
- [ ] **Step 4: Scan the complete repository, including documentation and tests, for the forbidden corporate hostname and secret-like fixtures; require zero matches.**
- [ ] **Step 5: Review every agreed requirement against the implementation and record any platform-only verification limitation honestly.**
