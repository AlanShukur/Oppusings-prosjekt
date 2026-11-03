# Claude Code skills for Romly

Claude Code loads project skills from `.claude/skills/<name>/SKILL.md`. It picks the right one from the description, or you can name it, for example "use romly-ship". Each skill records how this repo actually works, so a new session doesn't have to work it out again.

| Skill | Use it for | Extras |
|---|---|---|
| [romly-run](../.claude/skills/romly-run/SKILL.md) | Starting the dev server or a local production build | |
| [romly-browser-qa](../.claude/skills/romly-browser-qa/SKILL.md) | Checking the app in headless Chrome, locally, on staging or in production | `smoke.mjs` (end-to-end smoke test), `dialogs.mjs` (every studio dialog and its main action), `plan-version.mjs` (old and newer plan formats), `walls.mjs` (wall status and load-bearing), `baseline.mjs` ("Dagens planløsning"), `qa-harness.mjs` (for new checks) |
| [romly-studio](../.claude/skills/romly-studio/SKILL.md) | Changing the studio, the plan model or the public pages: file map, conventions, files that must change together | |
| [romly-tek17](../.claude/skills/romly-tek17/SKILL.md) | Adding or changing TEK17 rules, inputs and wording | |
| [romly-ship](../.claude/skills/romly-ship/SKILL.md) | Branch, checks, commit, PR, merge, deploy and verify | `gh-runs.mjs` (GitHub Actions status without the gh CLI) |
| [romly-skill-keeper](../.claude/skills/romly-skill-keeper/SKILL.md) | Creating a new skill, or fixing one, whenever a task teaches something reusable | |

## Memory and the after-task routine

- [`docs/MEMORY.md`](MEMORY.md) is Claude's working memory for this project: current state, decisions, what is waiting on you, and a task log. [`CLAUDE.md`](../CLAUDE.md) imports it, so every session starts from it.
- **After each task, Claude:**
  1. updates `MEMORY.md`;
  2. creates or updates a skill with `romly-skill-keeper` if the task taught something reusable.
- **The reminder hook:** [`.claude/hooks/after-task.mjs`](../.claude/hooks/after-task.mjs) runs when Claude stops, registered in `.claude/settings.json`. If the task changed files in the repo but not `MEMORY.md`, it sends Claude back once to update it.
- **Turning it off:** use `/hooks` or delete the entry.

You can run the scripts yourself:

```bash
node .claude/skills/romly-browser-qa/smoke.mjs https://romly-staging.romly.workers.dev
node .claude/skills/romly-ship/gh-runs.mjs
```

Keep the skills current. When a convention, URL or workflow changes, update the skill in the same pull request.
