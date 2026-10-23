---
name: designcraft
description: DesignCraft is the open-source, pure-Rust InDesign alternative from storytold (ArtCraft). Use this skill when the user mentions DesignCraft, `designcraft-cli`, `.designcraft` files, or asks to script, automate, render, export or convert a layout with it, or to drive the running app over its control port or MCP server. Generic layout jobs ("lay out this brochure", "export a PDF/X-4") trigger it only when the user is working in DesignCraft. Opening an `.idml` or `.indd` is not by itself a DesignCraft request.
---

# DesignCraft

**Pinned:** DesignCraft 0.12.0 (app and CLI), docs tag `v0.12.0`, checked 23 October 2026 on macOS. Measured on the running app.

Two layers, kept apart. DesignCraft's docs at the pinned tag and its live command list are the reference for commands, parameters and protocol. This skill holds how to drive it and what was learned by doing. If the two disagree about a command, the docs and the live list win. If the installed version is not the pinned one, say so before relying on anything below.

## What it is

A desktop publishing and page layout app: spreads, parent pages, threaded text frames, paragraph and character styles, tables, PDF output. Every menu item is a command with an id and JSON parameters, and the CLI, the MCP server and the control port all run the same commands. The native format is `.designcraft`, a zip holding JSON and copies of the placed files. The project calls itself "pre-alpha". It is not InDesign: InDesign scripts (ExtendScript, UXP) do not run, and InDesign plug-ins do not exist for it. Never assume an InDesign feature exists. Look the command up.

## The references

- Docs at the tag: `curl -sL https://raw.githubusercontent.com/storytold/designcraft/v0.12.0/docs/<file>`
  - `agents.md`: the three surfaces, script syntax with `$N.path` references, `run` export rules.
  - `mcp.md`: read "Modes", "Coordinates" and "Text offsets" first (offsets are UTF-8 bytes, not characters).
  - `control-protocol.md`: the method table and the framing rules.
  - `gaps.md`: what is missing, ranked. `file-format-parity.md`: read and write fidelity per format.
- Live command list: `designcraft-cli commands [FILTER]` and `designcraft-cli describe <id>` (engine commands only). From the running app, `designcraft-cli app --port $PORT --method engine.commands` also lists the UI commands, marked `"ui": true`.
- `designcraft-cli script --help` prints the script syntax.
- Release notes: `https://github.com/storytold/designcraft/releases/tag/v0.12.0`

## Surfaces

- **Headless CLI.** `designcraft-cli run [--in FILE] --cmd 'id={json}' ... --export out.pdf` or `designcraft-cli script file.dcs --in FILE --save out.designcraft --export out.png`. One shot, files in, files out, no window. Use it for batch exports and anything the user does not need to watch. Without `--in`, the commands run on a new empty Letter document.
- **MCP, headless.** `designcraft-cli mcp`. An in-process engine with no window. Use it for a long session that needs no window. `--automation-read-root DIR` and `--automation-write-root DIR` confine file access. UI commands (`view.*`, `window.*`, `help.*`, most `app.*`) and the window tools return an error.
- **MCP, connected.** `designcraft-cli mcp --connect $PORT`. Every change shows in the app's window. Use it when the user wants to watch, or when you need UI commands, `screenshot` or dialogs. The confinement flags cannot be combined with `--connect`.
- **Control port.** Start the app with `--control <port>`. It serves JSON lines on `127.0.0.1` with no authentication and no token. `designcraft-cli app --port $PORT <command> '<json>'` runs a command, and `designcraft-cli app --port $PORT --method <method> '<json>'` calls any method (`ui.inspect`, `ui.render`, `document.inspect`, ...). This is the simplest surface from a shell.
- **Not there:** the web build has no control channel. No surface asks for a login.
- **Version rule.** Compare `designcraft-cli --version` with `/Applications/DesignCraft.app/Contents/MacOS/DesignCraft --version` (both print `0.12.0` at the pin). The docs do not say what breaks when they differ, so treat a mismatch as unsupported and say so.

## Driving it

1. Start your own instance on a free port (the docs use 7979; check with `lsof -nP -iTCP:$PORT -sTCP:LISTEN`). Give it its own profile so the user's preferences and recovery files stay untouched:
   `open -n --env DESIGNCRAFT_CONFIG_DIR=/abs/scratch/profile -a /Applications/DesignCraft.app --args --control $PORT`
   then `until nc -z 127.0.0.1 $PORT; do sleep 0.5; done`. Note its PID: `lsof -nP -iTCP:$PORT -sTCP:LISTEN`.
2. Check the link: `designcraft-cli app --port $PORT --method ui.inspect`. Read `documents` (title, `dirty`), `activeDocument` and `dialog`. A fresh app shows the start screen with no document, and `document.inspect` then fails with `no document open`.
3. Make a document: `designcraft-cli app --port $PORT file.new '{"preset":"A4","pages":2}'` returns `{index}` and makes it active. Every later command acts on the active document. Confirm with `document.list` before each editing session.
4. Make each logical change one undoable step: write the lines to `change.dcs` (one `command.id {json}` per line), then
   `designcraft-cli app --port $PORT script.run "$(python3 -c 'import json,sys; print(json.dumps({"text": open(sys.argv[1]).read()}))' change.dcs)"`.
   On success it is one undo; on failure nothing is applied. Single commands go through `designcraft-cli app --port $PORT <id> '<json>'`. Check parameters with `designcraft-cli describe <id>` first.
5. Read back what changed: `--method document.inspect` (items with `kind`, `bounds` and `story`; stories with `overset`), `type.selectionAttrs` for text formatting, `font.list` for missing fonts. A success reply proves little here (see Pitfalls).
6. Look at it: `designcraft-cli app --port $PORT --method ui.render '{"path":"/abs/p0.png","page":0,"scale":0.5}'`, then open the PNG and look at it. `--method ui.screenshot '{"path":"/abs/win.png"}'` captures the whole window.
7. Save where the user says, with absolute paths: `file.saveAs '{"path":"/abs/name.designcraft"}'`, `file.exportPdf '{"path":"/abs/name.pdf","standard":"x4"}'`. Then `designcraft-cli validate-pdf /abs/name.pdf` checks PDF/X-4.
8. When done, quit only the instance you started: `designcraft-cli app --port $PORT --method app.quit`. It does not ask about unsaved changes. Then confirm the port is closed.

## Asking first

- Tell the user before you start a second instance: its window takes keyboard focus, so what they are typing lands in your document. `open -g` does not always prevent it.
- Get a yes before editing, closing or deleting anything in a document the user already had open. Prefer your own instance (step 1) over attaching to theirs.
- Never quit an instance you did not start: it may hold unsaved work. `app.quit` (the method) and `file.close` both discard unsaved changes without a prompt.
- Get a yes before overwriting a saved file. `file.saveAs` and the exports replace an existing file silently.
- Get a yes before `file.print` (it sends the PDF to a real printer) and before opening links with `help.*`.
- After a transport failure, read the state (`ui.inspect`, `document.inspect`) before retrying: the call may have completed *(docs, not measured)*.

## Formats

| Format | Open | Write | Caveat |
|---|---|---|---|
| `.designcraft` | yes | yes | Native. Placed images are copied into the zip (`assets/`). |
| `.idml` | yes | yes | Round-trip "not proven on real files" (gaps.md). Text can reflow. |
| `.indd`, `.indt` | yes | no | Converted to IDML through indd-utils. Not measured on real files. |
| PDF | place | yes | PDF/X-4 (validated by `validate-pdf`) and PDF/A-2b. No PDF/X-1a, X-3 or `.joboptions`. |
| PNG, JPEG | place | yes | Export renders one page. JPEG only from `run --export x.jpg`. |
| `.pptx` | no | yes | One slide per page. `run --export x.pptx` works, although `agents.md` leaves it out. |
| EPUB, HTML | no | yes | Fixed-layout EPUB is page images. HTML is one basic page. |
| `.docx`, `.rtf`, `.txt`, `.md`, `.xlsx` | place | `.rtf`, `.txt` | `.xlsx` places the first sheet's used range as a table. No `.doc` or `.xls`. |
| SVG, PSD, EPS | place | no | PSD is the composite. EPS draws only its preview. |

## Pitfalls

**Unknown keys fail, wrong values pass.** Every surface rejects an unknown parameter (`unknown parameter ...; the command takes: ...`), even though `agents.md` says most are ignored. A misspelled value is accepted: `frame.create {"content":"txt"}` and `{"shape":"circle"}` both return an id and make a plain rectangle, and `object.fit {"mode":"nonsense"}` returns `null`. Check `kind` in `document.inspect`.

**`frame.create` with `text` leaves a caret, not a selection.** A `type.char` right after it formats only the empty insertion point, still returns success, and the text keeps its size. Run `text.select {"story":S,"anchor":0,"focus":<length>}` first, then check with `type.selectionAttrs`.

**A font that does not exist is accepted.** `type.char {"attrs":{"fontFamily":"No Such Font"}}` stores that name and draws a substitute. `font.list` shows it as `"missing": true` with `resolvedFamily`.

**Only `script.run` is one undo step.** `designcraft-cli script --connect` and MCP `batch` push one undo step per command. On a failing step they stop and leave the earlier steps applied. `script.run` rolls the whole script back when any step fails, including one that fails at run time.

**Object ids come back after an undo.** Undo three new frames, create three more, and they get the same ids. Never reuse an id you held before an undo; read the ids again.

**Relative paths in the running app resolve against the app's working directory**, which is `/` when it was started with `open`. `file.saveAs {"path":"out/x"}` fails with `the folder out does not exist`. The headless CLI resolves against your shell. Always send absolute paths to the app.

**`app.export` is not a general export.** With no `path` it writes `<title>-p1.png` into the user's Documents folder. With a `.jpg` path it still writes PNG data. Use `ui.render` with an absolute `.png` path, or the `file.export*` commands.

**`designcraft-cli app` without `--port` talks to 7979.** That may be the user's own instance. Always pass `--port`. The CLI's hint `start it with designcraft --control 7979` names a binary that is not on PATH on macOS. Launch with `open -n -a /Applications/DesignCraft.app --args --control <port>`.

**`file.close` closes a dirty document without asking.** `ui.menu.invoke {"command":"file.close"}` (a control method) asks instead: it opens the `closeDocument` dialog, which `ui.dialog.cancel` dismisses. Commands still run while that dialog is open, so check that `ui.inspect` shows `dialog: null` when you finish.

**Page numbers count from 0 in some places and from 1 in others.** `ui.render`, MCP `render_page` and `run --page` are 0-based. `pages` in `file.exportPdf` and `file.exportPptx` is 1-based. `pages:[2]` and `--page 1` are the same page.

**`describe` and `commands` do not know UI commands.** `describe view.lockGuides` says `no command`. Ask the running app (`--method engine.commands`). Headless MCP refuses UI commands with an error naming `--connect`.

**`view.lockGuides` does not protect guides from commands.** With it on, `guide.move` still moves a ruler guide. Column guides are the opposite: new documents lock them, and `layout.moveColumnGuide` fails until `view.lockColumnGuides {"on":false}`.

## Not there yet

- Primary Text Frame autoflow can add pages that cannot be deleted (the alpha blocker). Thread frames by hand with `text.thread`.
- Autoflow inserts new pages after the story's last frame instead of filling the empty pages that follow.
- No ExtendScript or UXP, no plug-ins, no AI generation features.
- No `.indd` writing. No `.indb`, `.indl`, `.idms`, `.icml` or QuarkXPress files.
- No SVG or EPS export, no PostScript printing, no PDF/X-1a or X-3.
- The running app cannot be confined to folders. Only the headless MCP server takes the automation roots.
