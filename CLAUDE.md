<!-- SPECKIT START -->
For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan
at specs/001-guest-search-booking/plan.md
<!-- SPECKIT END -->

## Branch Protection & PR Workflow

**REQUIRED: All code changes must go through PRs on feature branches, NOT direct commits to main.**

- Create feature branch: `git checkout -b issue-22-t025-search-adapter`
- Commit and push to feature branch
- Create PR via: `gh pr create --title "..." --body "..."`
- Wait for CI to pass (Backend + Frontend tests)
- Get human approval if applicable
- Merge PR to main (do NOT force-push or commit directly)

**GitHub Branch Protection Rules (configured on main):**
- Require status checks: Backend (Gradle), Frontend (Vitest) — both must pass
- Require 1 PR review — **MUST be enabled** (currently missing; see issue #TODO)
- Dismiss stale reviews on new commits
- Require branches to be up to date before merge

**Why:** Ensures code review, test validation, and audit trail for all changes. Protects against accidental bugs, security issues, and unreviewed refactors.

**Agent/Subagent Instruction:** When dispatched, create a feature branch BEFORE any commits. Use `git checkout -b issue-XX-tYYZ-feature-name`. Push branch, create PR, do NOT commit to main.
