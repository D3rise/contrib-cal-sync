# Contribution Calendar Mirroring

This context describes how contribution activity from a source account is represented in a destination contribution calendar.

## Language

**Contribution Mirror**:
A one-way representation of contribution activity from a private GitLab instance in a GitHub contribution calendar. It is independent of other Destination Account activity and never copies activity from GitHub back to the GitLab instance.
_Avoid_: Synchronization, two-way synchronization

**Source Account**:
The account on the configured private GitLab instance whose contribution activity is reflected.
_Avoid_: GitHub account, destination account

**Destination Account**:
The GitHub account whose contribution calendar receives the reflected activity.
_Avoid_: Source account, GitLab account

**Daily Contribution Count**:
The number shown for one calendar day in the Source Account's contribution calendar. It carries no project, event-type, or work-content metadata.
_Avoid_: Commit count, activity details

**Contribution Day**:
An ISO calendar date interpreted in the configured time zone. It is represented by Mirror Commits timestamped at local noon so the date remains stable across systems.
_Avoid_: UTC day, execution day

**Mirror Commit**:
A technical GitHub commit dated on a particular day and used only to represent one unit of that day's Daily Contribution Count.
_Avoid_: Source commit, copied commit

**Mirror Repository**:
A dedicated private GitHub repository that contains only Mirror Commits for the Destination Account. Its lifecycle remains under the user's control.
_Avoid_: Project repository, source repository
