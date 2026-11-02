---
name: wordcraft
description: WordCraft is the open-source, pure-Rust Microsoft Word alternative from storytold. Use this skill when the user names WordCraft or `wordcraft-cli`, works with a document open in WordCraft, or asks to script, automate, convert or render documents with it. Generic jobs ("write a .docx", "make this a PDF") trigger only when the user is working in WordCraft. Not Google's Wordcraft, the AI story-writing experiment, which is a different project with the same name.
---

# WordCraft

**Pinned:** WordCraft 0.14.0 (app and CLI), docs tag `v0.14.0`, checked 2 November 2026 on macOS. Measured on the running app.

Two layers, kept apart. WordCraft's docs at the pinned tag and its live command list are the reference for commands, parameters and protocol. This skill holds how to drive it and what was learned by doing. If the two disagree about a command, the docs and the live list win. If the installed version is not the pinned one, say so before relying on anything below.

## What it is

A word processor with Word's ribbon, styles, tables, track changes, references and mail merge. Every action is a command with an id, and the same commands drive the ribbon, the CLI, a JSON control port and an MCP server. Its working format is `.docx`; it also keeps an engine-model `.json`. The project calls itself "alpha".
It is not Word: no VBA (macros in `.docm` are kept, never run), no Office add-ins, no cloud storage, no co-authoring.

## The references

- Docs at the tag: `curl -sL https://raw.githubusercontent.com/storytold/wordcraft/v0.14.0/docs/<file>`
  - `control-protocol.md`: read *Keys*, then *Methods*, *Open documents*, *The active window* and *Closing the document*.
  - `mcp.md`: *Scripts from the command line*, *Several documents*, *Confining file access*, *Character and paragraph properties* (the `CharProps` / `ParaProps` that `format.set`, `para.set` and `styles.modify` take).
  - `recovery.md` (where unsaved drafts go; *Several open documents*), `file-format-parity.md` (per-format fidelity), `gaps.md` (what is missing, ranked).
- README at the tag: same URL without `docs/`, file `README.md`. Read *For agents* and *Logs*.
- Live command list: `wordcraft-cli commands --json` (id, label, params, shortcut). From a running app: `engine.commands` over the control port, which also lists the app-only `ui.*` commands. `tools.search {"query": "…"}` finds commands by label.
- Release notes: `https://github.com/storytold/wordcraft/releases/tag/v0.14.0`

## Surfaces

- **Headless CLI** (`wordcraft-cli convert|text|inspect|render|run`): one shot, files in, files out, no window. `run --script job.json` runs a command list and then saves to every path in `save`. Pick it for conversion and for building a document from scratch.
- **MCP server, headless** (`wordcraft-cli mcp`): a long session with no window. `--automation-read-root DIR --automation-write-root DIR` confine file access; a refused path comes back as a readable tool error. `--author "Claude"` names tracked changes. Pick it for multi-step editing that the user does not need to watch.
- **MCP server attached** (`wordcraft-cli mcp --connect 127.0.0.1:7981`): the same tools against a running app, plus `screenshot`, `click`, `key`, `ui_inspect`. It reads the key file itself, sends it only to `127.0.0.1`, and keeps serving while the app is not up yet (calls fail until the port opens). The confinement flags are refused here: the desktop app is never confined.
- **Control port** (`--control 7981`): JSON lines on 127.0.0.1. Auth with the key from `<profile>/control-key.local-<port>`; the profile is `~/Library/Application Support/WordCraft` on macOS, or `$WORDCRAFT_PROFILE_DIR` when set. The file appears only once the port is bound and is removed when the app quits. Pick it when no MCP client is attached and the change must show in a window.
- No HTTP API, no plugin system, no control port in the web build.
- Version rule: run `wordcraft-cli --version` and `/Applications/WordCraft.app/Contents/MacOS/WordCraft --version`; both must print the pinned version. A mismatch was not tested: treat it as unsupported and say so.

## Driving it

1. Never reuse a WordCraft instance you did not start. Start your own, in its own profile, on a port nothing else holds, and tell the user first: the new window takes keyboard focus (see Pitfalls). Wait for the key file, not for the port: other apps listen on these ports too.
   ```sh
   P="$SCRATCH/wordcraft-profile"; mkdir -p "$P"; PORT=7981
   nc -z 127.0.0.1 $PORT && echo "taken: pick another port"
   open -n -g --env WORDCRAFT_PROFILE_DIR="$P" -a /Applications/WordCraft.app --args --control $PORT
   until [ -f "$P/control-key.local-$PORT" ]; do sleep 0.3; done
   lsof -nP -iTCP:$PORT -sTCP:LISTEN    # must say WordCraft; note the PID: it is the only one you may quit
   ```
2. Check the link: authenticate once per connection, then read state. A missing or wrong key gets `unauthorized` and the connection closes. The docs add that a connection with no authorised request within 30 s is closed. A minimal client, Python stdlib only:
   ```python
   import json, socket; key = open(f"{P}/control-key.local-{PORT}").read().strip()
   f = socket.create_connection(("127.0.0.1", PORT)).makefile("rw")
   def rq(m, **p): f.write(json.dumps({"id": 1, "method": m, "params": p}) + "\n"); f.flush(); return json.loads(f.readline())
   rq("auth", key=key); rq("ui.inspect")
   ```
   Never print the key.
3. Find the document: `ui.inspect` gives any open `dialog` and `documents` (`id`, `title`, `path`, `dirty`, `active`); `view.switchWindows` lists the same. Each open document has its own window. `file.new {"template": "blank"}` opens another window; take its id from `view.switchWindows` and pass `"doc": id` to `engine.execute`, `document.inspect` and `ui.render` from then on.
4. Edit with `engine.execute {"command": id, "params": {…}, "doc": id}`; a command id sent as the method works on the active document only. Each command is its own undo step. Before a multi-command change, note `edit.undoHistory`; if a step fails, roll back with `edit.undoTo {"count": n}`, counted from the new entries in `edit.undoHistory`, not from the commands you sent.
5. Read back after every logical change: `document.inspect` shows runs, styles, sections and the selection. Look at the page with `ui.render {"path": "/abs/p1.png", "page": 1}` (the engine's render) or the window with `ui.screenshot {"path": "/abs/shot.png"}`. Open the PNG and look at it.
6. Save with `file.saveAs {"path": "/abs/out.docx"}`; the extension picks the format. Check the reply says `"saved": true`, then decide about AutoSave (see Pitfalls). `file.exportPdf {"path": "/abs/out.pdf"}` writes a PDF copy.
7. Quit only your own instance, after checking with `lsof` that the port is still its PID: `file.closeDocument {"id": n, "force": true}` for each document once its work is saved, then `app.quit`. `app.quit` does not ask about unsaved documents; they survive only as recovery copies in the profile. Wait until the key file is gone.

## Asking first

- Tell the user before you start a second instance: its window takes keyboard focus, so what they are typing lands in your document. `open -g` does not always prevent it.
- Never accept the update prompt. The desktop app checks GitHub for a newer release at every start *(source at the tag, not measured)*. For your own instance, add `--env CRAFT_VERSIONS_FILE=<scratch>/versions.json` holding `{"apps":{"wordcraft":{"Pinned":"0.14.0"}}}`: a pinned entry skips the check.
- Anything in an instance the user started: an edit, `file.close {"force": true}`, `file.closeDocument`, `app.quit`. Each can throw away their unsaved work or, through AutoSave, overwrite their file.
- Saving over an existing file: `file.saveAs` and `file.save` replace it without asking. Editing a user's file after a save writes to it too (AutoSave); work on a copy unless they said otherwise.
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

- **Starting the app steals keyboard focus, even with `open -g`; so do `file.new` and `file.open`.** Each opens a window and brings it to the front. Whatever the user is typing lands in your document. Warn them before launching, and read the text back before every save to catch stray input.
- **A taken port does not stop the app.** It starts with no control port; the only sign is `control server failed to bind` in `<profile>/logs/wordcraft.log`, and no key file. `nc -z` then succeeds against whichever app holds the port. Wait for the key file and check the PID with `lsof`.
- **After the first save, AutoSave writes every edit to that file within seconds.** It holds for `file.save` on an opened file as well as `file.saveAs`; `dirty` then drops back to `false` by itself, so `file.close` without `force` no longer protects anything. To keep the file as saved, send `file.autosave` (a toggle) and check the reply's `value` is `false`.
- **The active document is not a safe target.** After `file.open` returns `"alreadyOpen": true`, the next command still lands in the previously active document. The control port's `file.new` reply has no `id` (the MCP tool's does), and `document.text` ignores a top-level `doc`. Read ids from `view.switchWindows` and pass `doc` on every call, inside `engine.execute` for commands like `document.text`.
- **Recovery drafts go to the profile folder.** Without `WORDCRAFT_PROFILE_DIR`, your scratch drafts appear in the user's File › Recover. Use your own profile, or remove your copies with `file.recover {"discard": id}`; while `busy` is true the next discard fails with `recovery is busy`, so poll between them.
- **`file.save` with no path on an untitled document replies `ok` with `"saved": false` and writes nothing.** Always give `file.saveAs` a path and check `saved`.
- **Relative paths resolve against the app's working folder, which is `/` when launched with `open`.** The save fails with `Read-only file system`. Use absolute paths in the app; in `run --script`, `save` is relative to the script, command params to the shell's folder.
- **Typing replaces the selection.** After `select.text` and a format command, the next `text.insert` overwrites the selected words. Move the caret first: `caret.docEnd`, or `select.collapse`, which goes to the start of the selection.
- **`\n` in `text.insert` does not start a new paragraph.** Both lines stay in one paragraph and share its style. Pass `"paragraphs": true` to `text.insert` (or MCP `type_text`), or use `text.newParagraph`.
- **Nothing is atomic.** MCP `batch` stops at the first failing command and leaves the earlier ones applied. Macros (`tools.macros`) also record one undo step per command. Roll back with `edit.undoTo`.
- **Consecutive `text.insert` calls merge into one `Typing` undo step.** Count undo steps from `edit.undoHistory`, never from the commands you sent.
- **Positions (`off`) are UTF-8 byte offsets, not characters.** `Città è` ends at 9, not 7. An offset inside a character silently snaps back. Take offsets from command replies or `document.inspect`.
- **`file.new` with an unknown `template` name silently gives a blank document.** Only `blank`, `sample`, `letter`, `resume`, `report` exist; use `file.newFromTemplate {"path"}` for a template file.
- **`file.saveTemplate` adds `.dotx` unless the path already ends in `.dotx` or `.dotm`.** `out.docx` becomes `out.docx.dotx`.
- **Page size and proofing language follow the system region.** On a non-US Mac a new document is A4, and in the app its text gets the system language. For Letter from the CLI set `WORDCRAFT_REGION=en-US`; otherwise set the page size explicitly.

## Not there yet

- Opening PDFs; writing `.doc`; MHT, Works and WordPerfect files.
- Running VBA; Office add-ins; cloud storage; real-time co-authoring; an in-app AI assistant.
- Editing charts or SmartArt that came from Word; drawing Word's native ink from its strokes.
- Pagination that matches Word page for page.
- Confining the desktop app's file access: only the headless MCP server takes the read and write roots.
- Proofing in most languages: other languages are left unmarked, and several need a Hunspell dictionary installed on the system.
