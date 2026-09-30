This file defines the **Next Step handoff** that every workflow prompt ends its final response with. It is not a system prompt of its own. Each prompt's "Next Step Handoff" section lists its routes: which outcome leads to which next step. This file defines the format those routes are written in.

The handoff exists so the developer can continue in a new session by copying one block, without looking up the playbook.

---

## Rules

- **Always end with it.** Every final response ends with a `## Next Step` block. That includes runs that stopped, failed or escalated. For those, the next step is the loop-back or the escalation.
- **Chat only.** Write the handoff in your final response, not in any file. When a prompt also writes suggestions into a report (for example `review.md` or `diagnosis.md`), the chat handoff still repeats the paste-ready prompt.
- **Fill in every value.** Use the real feature ID, version, phase, finding IDs, file paths and commit messages. Never leave a template placeholder such as `<feature-id>`. The only allowed gap is a decision that only the developer can make. Mark it `DECISION NEEDED` and say which file to fill in before pasting.
- **One recommended route.** If several next steps are valid, give the recommended one as the paste block. Add at most one line for the alternative, for example running one layer at a time when session tokens are low.
- **Human steps first.** If something must happen before the next session (a commit, a review, a scan, filling in `directives.md`), list it under **Before you start**, with exact commands. Commit commands stage only the paths the finished phase owns (`WORKFLOW_PLAYBOOK.md`, "A Note on Committing Parallel Work").
- **Respect the retry bound.** Before offering a loop-back, count earlier attempts of the same loop in `features/<feature-id>/plans/activity-log.md`. If the loop has reached the limit in `rules/workflow.md` §8, do not offer another attempt as routine. State the count and say that continuing needs the developer's explicit authorization, or give the escalation route instead.
- **Escalations.** When the run stops for a developer decision (spec ambiguity, rules conflict, retry bound, frozen contract), put the exact question under **Before you start**. Then give the paste block for the session that runs once the question is answered.
- **Ordered sessions.** When the work routes to several sessions that must run in order (for example Diagnosis batches), give one numbered paste block per session, in run order. Say which ones can run in parallel.
- **Say what comes after.** End with one line naming the step after this one, so the developer can see where the loop leads.

---

## Format

````markdown
## Next Step

**Status:** <one line: what this run produced, or why it stopped>
**Next:** Phase <n>: <name>. <one line: why this is the next step>

**Before you start:**

1. <human action, with exact command>

**Start a new session and paste:**

```text
Read the file .ai/prompts/<prompt file> and follow it exactly. That is your system prompt.

Feature ID = <real feature ID>
Phase = <value, if the prompt takes one>
<any other fields the prompt takes, filled in>
```

<one line, only if there is an alternative route>

**After that:** <the step that follows, in one line>
````

Leave out **Before you start** when there is nothing to do first. When the next step is human-only (for example the Developer Approval Gate or UI Review), put the human steps under **Before you start** and give the paste block for the agent session that follows them.
