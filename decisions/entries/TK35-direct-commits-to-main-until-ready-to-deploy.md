# TK35 — Direct commits to `main` until the "ready to deploy" stage

**Status:** accepted, 2026-11-19 (user).

## Decision

1. Until the repository reaches the "ready to deploy" stage, changes go directly to `main` in
   commits. They do not go through PRs.
2. One commit can hold more than one kind of change ("code", "docs" and "CI").
3. The approval of the user to push covers each commit that the agent makes on `main` until that
   stage.
4. The agent still asks the user before a deploy of the relay, a change of a secret, a force-push
   and each other action that is visible outside this machine
   ([`AGENTS.md`](../../AGENTS.md#6-git-rules)).
5. At the "ready to deploy" stage, this entry ends. The PR rules of
   [`AGENTS.md`](../../AGENTS.md#6-git-rules) apply again. The user can then add a branch rule on
   `main` that requires the doc checks.
6. The user decides when that stage starts. This entry does not define it further.

## Reason

- The repository is in its first set-up. One person owns it. The relay is deployed, but the hand-in
  UI of freemocap is not released, and the first real certify report is not filed yet.
- A PR for each small docs or code change slows this phase. Nobody else reviews these PRs.

## Consequences

- The doc checks run in the pre-commit hook, not in a PR. The agent must run them before each
  commit.
