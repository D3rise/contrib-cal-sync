# contrib-cal-sync

`contrib-cal-sync` is a per-user macOS service that mirrors daily contribution counts from a private GitLab contribution calendar into a dedicated private GitHub repository. It runs automatically through `launchd`, defaults to an hourly schedule, and provides a Retry action when the source is temporarily unavailable.

The mirror is deliberately one-way and append-only. It creates only missing synthetic commits, never copies project names or work content, never reads ordinary GitHub contributions, and never force-pushes published history.

## Requirements

- macOS 13 Ventura or newer, on Apple Silicon or Intel.
- Node.js 22 or newer with npm.
- Git.
- Xcode Command Line Tools with a working Swift compiler and matching macOS SDK.
- Network access to the private GitLab instance. If it requires a VPN, connect before initial configuration or use Retry later.

The installer validates these prerequisites but does not install or modify Homebrew, Node.js, Git, or Xcode Command Line Tools.

## Accounts and tokens

Create or select a dedicated private GitHub repository. It may be completely empty; the first confirmed sync initializes `main`. Do not use a fork or a working project repository.

Prepare two credentials:

1. A read-only personal access token for the private GitLab instance. The instance must allow it to read the configured `/users/<username>/calendar.json` response.
2. A fine-grained GitHub token restricted to the mirror repository with `Contents: Read and write`. GitHub metadata read access is included automatically.

Both tokens are entered through hidden prompts and stored as generic passwords in the user's macOS Keychain. They are not written to `config.json`, command-line arguments, Git remotes, or logs.

For commits from a private mirror repository to appear on the profile graph, enable private contribution visibility in GitHub profile settings. GitHub can take up to 24 hours to refresh the graph. The commit email must also belong to the account; by default, the service derives the account's GitHub-provided `noreply` address from the authenticated identity.

## Install

From a project checkout:

```bash
./scripts/install.sh
```

The script builds TypeScript and the native notification helper, stages a versioned installation under:

```text
~/Library/Application Support/contrib-cal-sync/
```

It then creates `~/.local/bin/contrib-cal-sync` and starts the interactive configuration wizard. Add `~/.local/bin` to `PATH` if it is not already present.

To install the files without configuration or service activation:

```bash
./scripts/install.sh --no-config
```

The wizard performs a dry-run and prints the number of missing commits by total and day count. No commit is pushed and no scheduled service is enabled until the first push is explicitly confirmed.

Running `install.sh` again performs an in-place update. Configuration and Keychain credentials are preserved, the new build is staged before activation, and an installation failure restores the previous active version.

## Configuration

Non-secret settings live in:

```text
~/Library/Application Support/contrib-cal-sync/config.json
```

The file is versioned, atomically written with owner-only permissions, and can be edited manually or through the CLI. See [`config.example.json`](./config.example.json) for the full schema.

Important defaults:

| Setting | Default | Meaning |
| --- | ---: | --- |
| `intervalMinutes` | `60` | `launchd` execution interval; minimum `15` |
| `lookbackDays` | `365` | source history considered on every run |
| `timeZone` | current macOS zone | contribution dates are committed at local noon |
| `limits.perDay` | `1000` | maximum missing commits accepted for one day |
| `limits.perRun` | `20000` | maximum missing commits accepted in one run |
| `notifications.networkFailureThreshold` | `3` | consecutive source network failures before notification |

Safety limits stop the run; they never truncate a valid count. Raise them explicitly only after reviewing a dry-run.

## Commands

```text
contrib-cal-sync configure
contrib-cal-sync config show
contrib-cal-sync config get intervalMinutes
contrib-cal-sync config set intervalMinutes 120
contrib-cal-sync credentials set gitlab
contrib-cal-sync credentials set github
contrib-cal-sync credentials status
contrib-cal-sync run --dry-run
contrib-cal-sync run
contrib-cal-sync status
contrib-cal-sync doctor
contrib-cal-sync logs --follow
contrib-cal-sync service enable
contrib-cal-sync service disable
contrib-cal-sync service restart
```

Changing `intervalMinutes` through the CLI validates the value and reloads the LaunchAgent. `config show` reports only whether each credential exists; it never prints a secret.

## Mirroring behavior

The source endpoint must return one JSON object whose keys are ISO calendar dates and whose values are non-negative integer contribution counts:

```json
{
  "2026-08-27": 4,
  "2026-08-28": 1
}
```

Missing dates mean zero contributions. The service counts only commits carrying its machine trailer in the mirror repository. A README, initialization commit, or manual commit never reduces the number mirrored from GitLab. Existing ordinary GitHub activity is independent: if GitLab reports four and the account already has two unrelated GitHub contributions that day, the profile can show six.

Every synthetic commit changes one service-owned state file, uses a neutral message, and is authored at noon in the configured time zone. Only the count and date are represented; source projects, event types, and work details are not copied.

If a source count later decreases, published commits remain. This intentional append-only rule prevents automated force-pushes and history rewriting.

## Failures and VPN recovery

Source network failures are retried a bounded number of times within a run. The hourly schedule tries again later. After three consecutive network failures, macOS displays a notification with Retry; use it after reconnecting the required VPN. Authentication errors, invalid calendar responses, configuration failures, and GitHub push failures notify immediately.

The Retry action starts the same locked CLI run as the scheduler. If another sync is active, the second run exits without changing the repository. After a notified failure recovers, one recovery notification is shown.

Logs are stored under `~/Library/Logs/contrib-cal-sync/`, rotated across five 1 MB files, and redact credentials and authorization values.

## Uninstall

Remove the service and installed application while preserving configuration, logs, and Keychain credentials:

```bash
./scripts/uninstall.sh
```

Remove all local state and credentials as well:

```bash
./scripts/uninstall.sh --purge
```

Neither command deletes or rewrites the remote mirror repository. Delete that repository manually only if you also want its contributions to disappear from the GitHub graph.

## Troubleshooting

Run:

```bash
contrib-cal-sync doctor
contrib-cal-sync status
contrib-cal-sync logs --follow
```

Common causes:

- The private GitLab host is unavailable until its VPN is connected.
- A token expired or does not have the required repository access.
- The configured endpoint redirected to a sign-in page instead of returning JSON.
- The mirror repository is a fork, or commits are not on its default branch.
- Private contribution visibility is disabled in GitHub profile settings.
- GitHub has not refreshed the contribution graph yet.
- The local Swift compiler and macOS SDK come from mismatched Command Line Tools installations.

The GitLab `calendar.json` route is a profile endpoint rather than a stable public API. An incompatible response fails explicitly; the service never silently substitutes an approximate Events API count.

## Origin and license

This project is based on the idea and initial implementation of [`NiciusB/sync-contributions-calendar`](https://github.com/NiciusB/sync-contributions-calendar), redesigned as a local, configurable, Keychain-backed macOS service.

Distributed under the ISC License. See [`LICENSE`](./LICENSE).
