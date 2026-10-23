# The ArtCraft skill template

One skill per ArtCraft app, all the same shape. This file is the spec: for whoever writes a skill, and for whoever re-pins one when the app moves. It sits outside `skills/`, so Claude never loads it as a skill.

The reader of every skill is Claude, in the middle of a task, with a shell. It needs to know four things fast: is this my skill, where does the truth live, how do I drive the app without breaking the user's work, and what will bite me. Everything else is somewhere else.

## The principle: two layers, kept apart

The app's own docs, read at the tag of the installed version, and the app's live command list are the reference. They say what commands exist and what their parameters are. A skill never copies them: copies go stale every release, and an app that ships weekly makes a stale copy wrong within a month.

The skill holds what the docs do not: which surface to pick, the loop that drives the app safely, what needs the user's yes, and the pitfalls found by doing. It says which version it describes, so the next reader can tell stale from wrong.

## Files

```
skills/<app>/SKILL.md            required, 80 to 150 lines
skills/<app>/references/<x>.md   optional, one at most, only for a table Claude needs and the docs do not give
skills/<app>/scripts/<x>          optional, only when the plain shell way was tried and fails (say why in the skill)
```

No evidence file. Evidence is the pinned line plus the docs at the tag: anyone can re-check.

## SKILL.md, section by section

Headings exactly as below, in this order. A section with nothing true to say keeps its heading and says so in one line.

```markdown
---
name: <app>
description: <see below>
---

# <App>

**Pinned:** <App> <version> (app and CLI), docs tag `v<version>`, checked <day month year> <on macOS. Measured on the running app. | . From the docs and source at the tag: not measured.>

Two layers, kept apart. <App>'s docs at the pinned tag and its live command list are the reference for commands, parameters and protocol. This skill holds how to drive it and what was learned by doing. If the two disagree about a command, the docs and the live list win. If the installed version is not the pinned one, say so before relying on anything below.
```

### description

At most 600 characters. Third person, present tense. First clause: what the app is, naming the familiar app it stands in for ("the open-source, pure-Rust Photoshop alternative from storytold"). Then when to trigger: the app's name, its CLI's name, its native file extension, and asks to script, automate, render or convert with it. Generic jobs ("edit this photo", "make a slide") trigger only when the user is working in this app; say so in those words. Name any project the app could be confused with (the FigCraft Figma plugin is not FigCraft).

### What it is

Three to six lines. What it does; its native format; how mature it is in the project's own words (alpha, beta), without percentages; one line on what it is not ("not Photoshop: no Photoshop plugins, no actions files"). Never guess a capability from the app it imitates.

### The references

Where the truth lives, as commands Claude can run:

- the docs at the tag, by raw URL, so no GitHub login is needed: `curl -sL https://raw.githubusercontent.com/storytold/<app>/v<version>/docs/<file>`; name each useful file and the section in it worth reading first;
- the live command list, with the exact call (through the CLI, the MCP server or the control port, whichever the app offers);
- release notes: `https://github.com/storytold/<app>/releases/tag/v<version>`.

### Surfaces

The ways to drive the app from outside, and which to pick. For each one the app has: what it is, how to start it, how to authenticate, and when it is the right one. Usually: the headless CLI (one shot, files in, files out), the MCP server headless (a long session, no window), the MCP server attached to a running app (changes show in the user's window), the control port (JSON lines on 127.0.0.1). Say which surfaces the app does not have. State the version rule: the CLI must match the app, and what goes wrong when it does not.

### Driving it

The loop, numbered, with the real commands: start or find the app with its control port; check the link; find out which document the commands will act on; make each logical change in one undoable step (a batch, a script) where the app offers one; look at the result (render, screenshot, read back) and read it; save where the user says. Five to eight steps. Exact spellings in code.

### Asking first

What needs the user's yes, specific to this app. The first bullet is always the same: tell the user before starting a second instance, because its window takes keyboard focus and what they type lands in it (`open -g` does not always prevent it; it happened while these skills were measured). Always: editing or deleting in a document the user already had open; overwriting a saved file; anything that reaches a server (collaboration, publishing, cloud, AI generation that spends money). Never quit an instance the user started: it may hold unsaved work; start a second one instead. After a transport failure, read the state before retrying: a call may have completed.

### Formats

What it opens and what it writes, as a short list or table, with the fidelity caveat for each foreign format (what is lost, what comes back as an image). Only formats Claude would plausibly be asked about.

### Pitfalls

The heart of the skill. Each one: **a bold claim**, then one or two lines on what happens and what to do instead. Only things that cost a wrong result or a wasted round: silent failures, parameters that are ignored, values that read back differently, ordering traps. Measured on the pinned version, unless marked *(docs, not measured)*. In a skill written without the app, every pitfall carries that mark; one read from the source at the tag counts. Where the docs and the source disagree, the source is what runs: follow it, and say the docs differ. No pitfall that the docs already state plainly. Five to fifteen.

### Not there yet

What the app cannot do at this version, so Claude says so instead of improvising a workaround that damages a file. Short list.

## Language

- **Plain English.** Short sentences, one idea each. Imperative, to Claude ("Read the docs at the tag", not "You may want to consult").
- **Names, not codes.** Commands, flags, files, keys and error strings go in backticks, spelled exactly. No internal ids, issue numbers or commit hashes in prose.
- **No numbers that rot.** No command counts, parity percentages, star counts. A number stays when it is a limit Claude must respect (a line length, a timeout, a pixel maximum).
- **No marketing.** No "powerful", "seamless", "fully". The project's own maturity word, quoted.
- **No one's machine.** No user names, home paths, volumes or personal ports. Default install paths (`/Applications/<App>.app`) and the docs' example ports are fine.
- **Own words.** Other people's skills about these apps may be read for leads. Nothing is copied: every claim is checked against the docs at the tag or the running app, and written fresh.
- **Every claim checkable.** If it came from the docs or the source, they say it at the tag. If it came from doing, it was done on the pinned version. If neither, it is not in the skill.

## Re-pinning

When an app moves: read its release notes from the pinned tag to the new one; re-run the loop in *Driving it* and each pitfall on the new version; update the pinned line, then whatever changed. A pitfall that no longer happens is deleted, not annotated.
