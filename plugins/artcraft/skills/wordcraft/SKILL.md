---
name: wordcraft
description: WordCraft is the open-source, pure-Rust Microsoft Word alternative from storytold. Use this skill when the user names WordCraft or `wordcraft-cli`, works with a document open in WordCraft, or asks to script, automate, convert or render documents with it. Generic jobs ("write a .docx", "make this a PDF") trigger only when the user is working in WordCraft. Not Google's Wordcraft, the AI story-writing experiment, which is a different project with the same name.
---

# WordCraft

**Pinned:** WordCraft 0.10.0 (app and CLI), docs tag `v0.10.0`, checked 23 October 2026 on macOS. Measured on the running app.

Two layers, kept apart. WordCraft's docs at the pinned tag and its live command list are the reference for commands, parameters and protocol. This skill holds how to drive it and what was learned by doing. If the two disagree about a command, the docs and the live list win. If the installed version is not the pinned one, say so before relying on anything below.

## What it is

A word processor with Word's ribbon, styles, tables, track changes, references and mail merge. Every action is a command with an id, and the same commands drive the ribbon, the CLI, a JSON control port and an MCP server. Its working format is `.docx`; it also keeps an engine-model `.json`. The project calls itself "alpha".
It is not Word: no VBA (macros in `.docm` are kept, never run), no Office add-ins, no cloud storage, no co-authoring.

## The references

- Docs at the tag: `curl -sL https://raw.githubusercontent.com/storytold/wordcraft/v0.10.0/docs/<file>`
  - `control-protocol.md`: read *Keys*, then *Methods*, then *Closing the document*.
  - `mcp.md`: *Scripts from the command line*, *Confining file access*, *Character and paragraph properties* (the `CharProps` / `ParaProps` that `format.set`, `para.set` and `styles.modify` take).
  - `recovery.md` (where unsaved drafts go), `file-format-parity.md` (per-format fidelity), `gaps.md` (what is missing, ranked).
- README at the tag: same URL without `docs/`, file `README.md`. Read *For agents* and *Logs*.
- Live command list: `wordcraft-cli commands --json` (id, label, params, shortcut). From a running app: `engine.commands` over the control port, which also lists the app-only `ui.*` commands. `tools.search {"query": "…"}` finds commands by label.
- Release notes: `https://github.com/storytold/wordcraft/releases/tag/v0.10.0`

## Surfaces

- **Headless CLI** (`wordcraft-cli convert|text|inspect|render|run`): one shot, files in, files out, no window. `run --script job.json` runs a command list and then saves to every path in `save`. Pick it for conversion and for building a document from scratch.
- **MCP server, headless** (`wordcraft-cli mcp`): a long session with no window. `--automation-read-root DIR --automation-write-root DIR` confine file access; a refused path comes back as a readable tool error. `--author "Claude"` names tracked changes. Pick it for multi-step editing that the user does not need to watch.
- **MCP server attached** (`wordcraft-cli mcp --connect 127.0.0.1:7981`): the same tools against a running app, plus `screenshot`, `click`, `key`, `ui_inspect`. It reads the key file itself. The confinement flags are refused here: the desktop app is never confined.
- **Control port** (`--control 7981`): JSON lines on 127.0.0.1. Auth with the key from `<profile>/control-key.local-<port>`; the profile is `~/Library/Application Support/WordCraft` on macOS, or `$WORDCRAFT_PROFILE_DIR` when set. The file appears once the port is bound and is removed when the window closes. Pick it when no MCP client is attached and the change must show in a window.
- No HTTP API, no plugin system, no control port in the web build.
- Version rule: run `wordcraft-cli --version` and `/Applications/WordCraft.app/Contents/MacOS/WordCraft --version`; both must print the pinned version. A mismatch was not tested: treat it as unsupported and say so.

## Driving it

1. Never reuse a WordCraft window you did not start. Start your own, in its own profile, and tell the user first: the new window takes keyboard focus (see Pitfalls).
   ```sh
   P="$SCRATCH/wordcraft-profile"; mkdir -p "$P"
   open -n -g --env WORDCRAFT_PROFILE_DIR="$P" -a /Applications/WordCraft.app --args --control 7981
   until nc -z 127.0.0.1 7981; do sleep 0.3; done
   lsof -nP -iTCP:7981 -sTCP:LISTEN     # note the PID: it is the only one you may quit
   ```
2. Check the link: authenticate once per connection, then read state. A missing or wrong key gets `unauthorized` and the connection closes. The docs add that a connection with no authorised request within 30 s is closed. A minimal client, Python stdlib only:
   ```python
   import json, socket; key = open(f"{P}/control-key.local-7981").read().strip()
   f = socket.create_connection(("127.0.0.1", 7981)).makefile("rw")
   def rq(m, **p): f.write(json.dumps({"id": 1, "method": m, "params": p}) + "\n"); f.flush(); return json.loads(f.readline())
   rq("auth", key=key); rq("ui.inspect")
   ```
   Never print the key.
3. Find the document: `ui.inspect` gives `title`, `dirty` and any open `dialog`; `document.text` and `document.inspect` give the content. One window holds one document. Start yours with `file.new {"template": "blank"}` while `dirty` is false.
4. Edit with `engine.execute {"command": id, "params": {…}}`, or send the command id as the method. Each command is its own undo step. Before a multi-command change, note `edit.undoHistory`; if a step fails, roll back with `edit.undoTo {"count": n}`, counted from the new entries in `edit.undoHistory`, not from the commands you sent.
5. Read back after every logical change: `document.inspect` shows runs, styles, sections and the selection. Look at the page with `ui.render {"path": "/abs/p1.png", "page": 1}` (the engine's render) or the window with `ui.screenshot {"path": "/abs/shot.png"}`. Open the PNG and look at it.
6. Save with `file.saveAs {"path": "/abs/out.docx"}`; the extension picks the format. `file.exportPdf {"path": "/abs/out.pdf"}` writes a PDF copy. Check the reply says `"saved": true`.
7. Quit only your own instance: `file.close {"force": true}` once its work is saved, then `app.quit`. Wait until `nc -z 127.0.0.1 7981` fails.

## Asking first

- Tell the user before you start a second instance: its window takes keyboard focus, so what they are typing lands in your document. `open -g` does not always prevent it.
- Any edit in a window the user already had open, and any `file.new`, `file.open` or `file.close {"force": true}` there: each one throws away their unsaved work.
- Saving over an existing file: `file.saveAs` and `file.save` replace it without asking.
- Turning on track changes, or accepting or rejecting changes, in the user's document.
- Printing: `ui.printSubmit` and `ui.print` send a real job to a printer *(docs, not measured)*.
- Anything that reaches a server. `gaps.md` lists no cloud storage and no in-app AI at this version; the Zotero commands talk to a local Zotero.
- Never quit an instance the user started: it may hold unsaved work. Start a second one instead.
- After a transport failure, read the state (`document.text`, `edit.undoHistory`) before retrying: the command may have run.

## Formats

| Format | Open | Save | Caveat |
|---|---|---|---|
| `.docx` `.docm` `.dotx` `.dotm` | yes | yes | Main format. Not yet tested on a corpus of real-world files; round-trip the user's file and compare `inspect` output before trusting it. |
| `.doc` `.dot` (97-2003) | yes | no | `can't save as .doc`; save as `.docx`. Word 6/95 files are refused. |
| `.pdf` | no | yes | Export only. Opening one fails with `unsupported format`. |
| `.png` | no | yes | One page per file (`file.exportPng`, `ui.render`, CLI `render`). |
| `.md` `.html` `.txt` `.tex` | yes | yes | From Markdown, headings, emphasis and tables come through as styles and a table; page layout is not carried. |
| `.rtf` `.odt` | yes | yes | Partial: notes, comments and some revisions are still missing (see `gaps.md`). |
| `.json` | yes | yes | The engine's own model, for agents; not for people. |

Charts, SmartArt, OLE objects and ink from Word are kept and written back but not editable; OLE objects show only their picture.

## Pitfalls

- **Starting the app steals keyboard focus, even with `open -g`.** Whatever the user is typing lands in your document, and their shortcuts hit your window. Warn them before launching, and run `document.text` before every save to catch stray text.
- **`file.new` and `file.open` throw away unsaved changes with no prompt and no error.** Only `file.close` is guarded. Check `dirty` in `ui.inspect` first; this is why you never drive the user's window.
- **Recovery drafts go to the profile folder.** Without `WORDCRAFT_PROFILE_DIR`, your scratch drafts appear in the user's File › Recover. Use your own profile, or remove your copies with `file.recover {"discard": id}`.
- **`file.save` with no path on an untitled document replies `ok` with `"saved": false` and writes nothing.** Always give `file.saveAs` a path and check `saved`.
- **Relative paths resolve against the app's working folder, which is `/` when launched with `open`.** The save fails with `Read-only file system`. Use absolute paths in the app; in `run --script`, `save` is relative to the script, command params to the shell's folder.
- **Typing replaces the selection.** After `select.text` and a format command, the next `text.insert` overwrites the selected words. Move the caret first: `caret.docEnd`, or `select.collapse`, which goes to the start of the selection.
- **`\n` in `text.insert` does not start a new paragraph.** Both lines stay in one paragraph and share its style. Use `text.newParagraph`, or MCP `type_text` with `"paragraphs": true`.
- **Nothing is atomic.** MCP `batch` stops at the first failing command and leaves the earlier ones applied. Macros (`tools.macros`) also record one undo step per command. Roll back with `edit.undoTo`.
- **Consecutive `text.insert` calls merge into one `Typing` undo step.** Count undo steps from `edit.undoHistory`, never from the commands you sent.
- **Positions (`off`) are UTF-8 byte offsets, not characters.** `Città è` ends at 9, not 7. An offset inside a character silently snaps back. Take offsets from command replies or `document.inspect`.
- **`file.new` with an unknown `template` name silently gives a blank document.** Only `blank`, `sample`, `letter`, `resume`, `report` exist; use `file.newFromTemplate {"path"}` for a template file.
- **`file.saveTemplate` adds `.dotx` unless the path already ends in `.dotx` or `.dotm`.** `out.docx` becomes `out.docx.dotx`.
- **Page size and proofing language follow the system region.** On a non-US Mac a new document is A4 and its text gets the system language. For Letter from the CLI set `WORDCRAFT_REGION=en-US`; otherwise set the page size explicitly.

## Not there yet

- Opening PDFs; writing `.doc`; MHT, Works and WordPerfect files.
- Running VBA; Office add-ins; cloud storage; real-time co-authoring; an in-app AI assistant.
- Editing charts or SmartArt that came from Word; drawing Word's native ink from its strokes.
- Pagination that matches Word page for page.
- Confining the desktop app's file access: only the headless MCP server takes the read and write roots.
- Proofing in most languages: other languages are left unmarked, and several need a Hunspell dictionary installed on the system.
