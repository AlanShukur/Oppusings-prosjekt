---
name: romly-skill-keeper
description: Create a new Romly project skill or fix an existing one. Use at the end of a task when you had to work out a repeatable procedure, a non-obvious trap or a subsystem that a future session would otherwise rediscover; when a skill turned out wrong or out of date; or when the user asks for a skill.
---

# Keeping Romly's skills current

Skills live in `.claude/skills/<name>/SKILL.md`, and `docs/SKILLS.md` lists them. A good skill saves the next session from re-deriving what this one learned. A wrong skill is worse than none, so only write down what you verified.

## Decide: create, update or skip

- **Update** an existing skill when it was wrong or incomplete, or when the code it describes changed: renamed selectors, files, URLs, commands. Do it in the same task. This is the most common case.
- **Create** a skill when the task needed a multi-step procedure that will come up again or a cluster of facts no skill covers. Examples: adding a public page, releasing a sprint, migrating the plan format, setting up D1/R2 when accounts return.
- **Skip** these and put them in `docs/MEMORY.md` instead:
  - one-off facts and decisions;
  - anything obvious from reading the code;
  - anything you didn't verify.

  Never put secrets, tokens or personal data in either place.

Before creating one, run `ls .claude/skills` and read the closest skill. Extending it usually beats adding a new one. Each skill needs its own clear trigger, because overlapping descriptions make the wrong one load.

## Shape of a skill

```markdown
---
name: romly-<topic>
description: <What it covers>. Use when <the situations, the user's words, file paths or error messages that should load it>.
---

# <Title>

One or two sentences: what this is for.

## <Commands first, copy-pasteable from the repo root>
## <Facts: files, names, selectors, URLs>
## <Traps, and what to do about each>
```

**Writing the description and body:**
- The `description` is the only part that is always in context, and it decides whether the skill loads. Name concrete triggers.
- Keep the body under about 150 lines. Link to `docs/` or code instead of copying them.
- Write commands that work in Git Bash. Add a PowerShell variant where it differs (`npm.cmd`, `Start-Process`).

**Verify everything you include:**
- Run every command and script before saving.
- Check every path, selector and function name against the code (grep for it).

**Bundled scripts:**
- Put helper scripts next to `SKILL.md`.
- Use plain Node with no new dependencies, and start each script with a comment that shows its usage.
- Run each script once to prove it works, then check lint with `npx eslint .claude`.

## After writing

1. Add or update the skill's row in `docs/SKILLS.md`.
2. Note it in the task log in `docs/MEMORY.md`.
3. Tell the user in one line which skill you added or changed, and why.

A brand-new skill directory may only appear in the skill list from the next session on.

## Current skills

`romly-run`, `romly-browser-qa`, `romly-studio`, `romly-tek17`, `romly-ship`, `romly-skill-keeper`. Keep this line in step with `docs/SKILLS.md`.
