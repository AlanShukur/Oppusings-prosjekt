# Romly: notes for Claude

Romly is a Norwegian renovation planner: a vanilla-JS studio in `public/studio/` and vinext public pages in `app/`, deployed to Cloudflare Workers. The git repo is this folder (`romly/`), not the folder above it.

- **Memory:** `docs/MEMORY.md` has the current state, decisions, open items and recent tasks. It is imported below.
- **Skills:** project skills are in `.claude/skills/`, listed in `docs/SKILLS.md`. Use them: `romly-studio` before editing code, `romly-tek17` for regulation logic, `romly-run` and `romly-browser-qa` to see changes working, `romly-ship` to commit, open PRs and deploy.
- **Plan:** `docs/SPRINTPLAN.md` is the sprint plan.

## After every task

Do these before writing your final reply:

1. **Update `docs/MEMORY.md`:**
   - Add a dated line to the task log.
   - Adjust "Current state", "Decisions" and "Waiting on the user" if they changed.
   - Keep the file short: fold old log entries into the state sections once the log passes about 20 lines.
2. **Create or update a skill** with `romly-skill-keeper` if you had to work something out that a future session would otherwise rediscover, or if a skill you used was wrong.

A Stop hook (`.claude/hooks/after-task.mjs`) reminds you once when a task changed repo files without touching `docs/MEMORY.md`.

@docs/MEMORY.md
