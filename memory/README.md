# Memory System

Shared memory for all AI agents (Claude, Gemini, Codex, Antigravity).

## Files

| File | Purpose | Read order |
|------|---------|:----------:|
| `COMPACT.md` | Quick context (~30 lines) | ⚡ 1st |
| `handoff.md` | Agent-to-agent transfer | 2nd |
| `INDEX.md` | Keyword → lesson search | 3rd (if needed) |
| `context.md` | Project state (detailed) | 4th (if needed) |
| `lessons-learned.md` | Mistakes → rules (append-only) | Smart-scan |
| `decisions.md` | Architecture decisions (append-only) | Titles first |
| `capture.sh` | Helper script for session logging | N/A |

Global memory: `~/.agents/memory/` (cross-project lessons)

## On Session Start (MANDATORY)

1. Read `COMPACT.md` — instant project awareness
2. Read `handoff.md` — if ACTIVE, pick up the task
3. **If `Plan file` is listed**, read that file before doing anything
4. **If task is complex**, scan `INDEX.md` for matching keywords → deep-read relevant lessons
5. Read `context.md` — only if COMPACT.md lacks needed detail
6. Read `~/.agents/memory/global-lessons.md` — universal rules
7. Prove you read them:
   > **Memory loaded.** Recent lessons: (1) [title], (2) [title], (3) [title].

## On Session End (MANDATORY)

1. Update `context.md` — refresh Current Focus + session log
2. Update `COMPACT.md` — refresh Active Task, Last Session
3. Update `INDEX.md` — if new lessons were added
4. Write new lessons to `lessons-learned.md` if any
5. Or run: `bash memory/capture.sh "<agent>" "<task>" "<files>" "<status>"`

## On Handoff

1. Fill in `handoff.md`, set status to ACTIVE
2. If plan file exists, add absolute path under `Plan file`
3. Update `context.md`

## Writing Lessons (MANDATORY format)

```markdown
### [2026-01-15] Short descriptive title
- **Tags**: keyword1, keyword2, keyword3 (3-5 tags)
- **Confidence**: LOW | MEDIUM | HIGH
- **Domain**: code-style | testing | performance | architecture | workflow
- **What went wrong**: concrete description
- **Root cause**: why it happened
- **Rule**: actionable rule to prevent recurrence
- **Last confirmed**: 2026-01-15
```

## Maintenance

- **Max 30 active lessons** — archive stale entries when exceeded
- **Quarterly review** — check relevance of all active lessons
- **Graduation** — critical lessons → instruction file rules, mark `[GRADUATED]`
- **Never delete** — only archive or graduate
