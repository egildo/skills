---
name: vectorcraft
description: VectorCraft is the open-source, pure-Rust Adobe Illustrator alternative from storytold, a vector illustration app with artboards, layers, live effects and type. Use it when the user names VectorCraft or `vectorcraft-cli`, a `.vectorcraft` or `.vctemplate` file, or asks to script, automate, draw, render, export or convert vector art with it. Generic vector jobs (draw a logo, make an SVG, convert a PDF or `.ai`) trigger it only when the user is working in VectorCraft. It is not Adobe Illustrator or its scripts and plug-ins, and not the other Craft apps (FigCraft, PhotoCraft).
---

# VectorCraft

**Pinned:** VectorCraft 0.16.0 (app and CLI), docs tag `v0.16.0`, checked 23 October 2026 on macOS. Measured on the running app.

Two layers, kept apart. VectorCraft's docs at the pinned tag and its live command list are the reference for commands, parameters and protocol. This skill holds how to drive it and what was learned by doing. If the two disagree about a command, the docs and the live list win. If the installed version is not the pinned one, say so before relying on anything below.

## What it is

A desktop vector illustration app: Pen and Direct Selection, Pathfinder and Shape Builder, gradients, appearance stacks, live effects, type, symbols, multiple artboards per document, one document per tab.
The native format is `.vectorcraft`, versioned JSON (older files may be `.drawcraft`); templates are `.vctemplate`.
The project calls itself "alpha" and "under active development".
Not Illustrator: Illustrator scripts (`.jsx`) do not run (`script.check` only reports what they use), Illustrator plug-ins do not load (its own plug-ins are `.wasm`), and there are no generative AI features.

## The references

- The docs at the tag: `curl -sL https://raw.githubusercontent.com/storytold/vectorcraft/v0.16.0/docs/<file>`. Read first:
  - `control-protocol.md`: the method table at the top, then "Confining file access" and "Synthetic input budgets".
  - `mcp.md`: "Tools", "Headless batch CLI", "Parameter keys" (the `$N.path` step references) and "Resource templates" (drilling into large documents).
  - `file-format-parity.md`: "Format by format". `gaps.md`: "Ranked", for what is missing. `plugins.md` before any plug-in.
- The README at the tag ("Status", "Use it from Claude Code and other agents"): `curl -sL https://raw.githubusercontent.com/storytold/vectorcraft/v0.16.0/README.md`.
- The live command list: `vectorcraft-cli commands` (JSON: `id`, `label`, `menu`, `params`, `shortcut`, `enabled`). Against a running app: control method `engine.commands`, which adds the UI commands and says why a command is disabled. Over MCP: `command_list` (`filter`, `menu`, `brief`).
- Release notes: `https://github.com/storytold/vectorcraft/releases/tag/v0.16.0`.

## Surfaces

- **Headless CLI, one shot.** `vectorcraft-cli run [--in FILE] --cmd ID --params JSON … --export OUT…` opens a file (or starts a new document), runs the steps and exports; one JSON line per step, non-zero exit on the first failure, and then nothing is exported. `--commands steps.json` (or `-` for stdin) for long step lists. `vectorcraft-cli convert IN OUT` and `vectorcraft-cli info FILE` (import warnings, object kinds, fonts) cover conversion and checks. Pick these for batch work.
- **MCP headless.** `vectorcraft-cli mcp --headless`: stdio JSON-RPC, a long session with no window. UI-only tools (`inspect_ui`, `type_text`, `open_panel`, window screenshots) answer with an error.
- **MCP attached.** `vectorcraft-cli mcp --connect 127.0.0.1:7979` forwards each tool call to an app started with `--control 7979`; changes show in its window. If nothing listens there it exits with `cannot connect`, with no fallback.
- **Control port.** `VectorCraft --control PORT` (or `VECTORCRAFT_CONTROL_PORT`) serves one JSON request per line on `127.0.0.1` only: `{"id":1,"method":"ui.inspect","params":{}}` → `{"id":1,"ok":true,"result":…}`. Any engine command goes through `engine.execute {command, params}`.
- **Web build:** the same UI in a browser, scriptable only from its page (`window.vectorcraft`). No control port, no MCP.

Authentication: none on any surface, and the app makes no token. Confine an agent instead: `--automation-read-root DIR` and `--automation-write-root DIR` (each repeatable) on the app or on `vectorcraft-cli mcp`; on the MCP server they imply `--headless` and refuse `--connect`, so a live app must be started with them itself.

Version rule: use the CLI and the app from the same release. On macOS the CLI is a separate release asset (`vectorcraft-cli-<version>-macos-universal.zip`); the `.app` holds only the desktop app. Compare `vectorcraft-cli --version` with `/Applications/VectorCraft.app/Contents/MacOS/VectorCraft --version`. The docs do not say what breaks on a mismatch; treat it as unsupported and tell the user.

## Driving it

1. Start your own instance; never attach to the user's. Pick a free port (`nc -z 127.0.0.1 7979` must fail), then `open -n --env VECTORCRAFT_CONFIG_DIR="$SCRATCH/profile" -a /Applications/VectorCraft.app --args --control 7979 --automation-read-root "$SCRATCH" --automation-write-root "$SCRATCH"`. The separate profile keeps the user's preferences and Data Recovery out of it. Wait with `until nc -z 127.0.0.1 7979; do sleep 0.5; done` and note the PID from `lsof -nP -iTCP:7979 -sTCP:LISTEN`.
2. Check the link. Any short client works, for example `python3 -c 'import socket,sys;s=socket.create_connection(("127.0.0.1",7979));s.sendall(sys.argv[1].encode()+b"\n");print(s.makefile().readline())' '{"id":1,"method":"ui.inspect"}'`. Read `documents` and `activeDocument`.
3. Make a document and pin it. `engine.execute {"command":"file.new","params":{"width":800,"height":600,"title":"draft"}}` returns its `index`. Then `document.inspect {"depth":0}` gives its `title` and `uid`; check them again before every write, since commands act on the active document only (`document.activate {"index":n}` switches).
4. Make each logical change one undo step: `engine.execute {"command":"command.batch","params":{"label":"Header","commands":[{"command":"shape.rectangle","params":{…}},…]}}`. The reply's `results` hold the new ids. A failing step names itself and rolls the whole batch back. Give each new object its paint by `ids`.
5. Read it back. `document.inspect {"ids":[…]}` lists bounds, `fill`, `stroke`, `strokeWidth` per object. Coordinates are points, y down, origin at the first artboard's top-left.
6. Look at it. `ui.render {"path":"$SCRATCH/look.png","scale":2,"artboard":0}` renders the artboard without the window; open the PNG and look. `ui.screenshot {"path":…}` captures the whole window, panels included.
7. Save where the user says, with `engine.execute` `document.save {"path":…}` or `document.export {"path":…}`. Both write before they reply, return real errors, and list `warnings`: read them to the user. Always pass a path: without one, `document.save` on a never-saved document writes nothing and returns `dataBase64`.
8. Quit only your own instance: `app.quit` returns `{"pending":"saveChanges"}` once per modified document; for scratch documents answer each with `ui.dialog.set {"field":"discard","value":true}` then `ui.dialog.confirm`. Check that the port closes.

## Asking first

- Tell the user before you start a second instance: its window takes keyboard focus, so what they are typing lands in your document. `open -g` does not always prevent it.
- Any edit, close or revert in a document the user already had open, and anything in the user's own instance.
- Overwriting a saved file: `document.save` and `document.export` with a `path` replace an existing file without asking.
- Saving a document opened from SVG, PDF or `.ai` back to its own file: Save keeps that format, and its `warnings` say what it loses.
- Installing a plug-in (`ui.installPlugin`, a `.wasm`) or loading libraries, presets or colour profiles into the user's preferences.
- Anything that leaves the machine. The docs name no cloud, collaboration or AI features at this version; Color Themes are local only.
- Never send `app.quit` to an instance the user started: it may hold unsaved work. Start a second one instead.
- After a transport failure or a `timeout: … still running` reply, read the document before retrying: the command may have run. "will not run" means it is safe to retry.

## Formats

| Format | Opens | Writes | Caveat |
|---|---|---|---|
| `.vectorcraft`, `.vctemplate` | yes | yes | lossless; can save down for older versions (`document.save {version}`) |
| SVG, SVGZ | yes | yes | the strongest foreign format; a drop shadow exports as an SVG `<filter>`, type stays `<text>`; reopened, a live shape comes back as a plain path |
| PDF, `.ai` | yes | yes | `.ai` written is PDF-compatible carrying the native document, so it reopens editable; Illustrator's own `.ai` files are read from their PDF part and editing data, untested on a real-file corpus |
| EPS | yes | yes | export flattens transparency (it says so in `warnings`) |
| DXF, EMF, WMF | yes | yes | DXF export leaves out shadows, glows and blurs |
| PSD | yes, merged image only | yes, layered | a PSD reopens as one image |
| PNG, JPEG, WebP, GIF, TIFF, BMP, Targa | yes, as an image | yes | WebP is written lossless only |
| Affinity `.af`, `.afdesign`, `.afpub` | yes | no | what did not come in is listed in the import warning |

`vectorcraft-cli info FILE` lists import warnings and what a file holds before you promise anything about it.

## Pitfalls

- **`app.save`, `app.export` and `file.save` say `ok` before the file exists, even when it never will.** They run in the background and reply `{"background":true}` at once. A path outside the write root or in a missing folder still replied `ok`; the failure showed only in `ui.inspect` → `ui.status` (overwritten by the next status) and as a modal message dialog in the window. Use `engine.execute` `document.save` / `document.export` with a path: they reply after writing and return the error.
- **Closing a tab moves the active document.** With the last of three tabs active, `file.close {"index":0}` left index 0, a different document, active. Indexes shift too. Re-read `document.inspect` → `uid` before writing after any open or close.
- **Some commands take a misspelt key silently.** `object.setProps {"opactiy":50}` and `stroke.set {"width":0}` (the key is `weight`) replied `ok` with `null`, changed nothing and recorded no undo step, while `object.move` and `text.create` refuse unknown keys. Read back every property you set.
- **Paint you set becomes the default for new art in every open document.** After `paint.setFill` red in one document, a rectangle drawn in a new document came out red, with the default black 1 pt stroke. Set `fill` and `stroke` explicitly (by `ids`) on every object you create.
- **Bare `vectorcraft-cli mcp` picks its backend for you.** With nothing on port 7979 it ran headless, saying so only on stderr; with an app on 7979 it attaches to that app *(docs, not measured)*, which may be the user's. Always pass `--headless` or `--connect ADDR`.
- **Dialog text is in the interface language.** A failed export's `ui.inspect` → `ui.dialog.fields.message` came back translated (the system locale), while control errors stay English. Match on dialog `kind` and on error replies, never on dialog wording.

## Not there yet

- Running scripts: no JavaScript scripting surface; `script.check` only analyses Illustrator scripts.
- 3D beyond initial Revolve, Extrude & Bevel, Inflate and Rotate: no materials, no 3D export (OBJ, USDA, glTF).
- Generative AI features of any kind.
- Effect Gallery thumbnails and in-dialog preview (the filters themselves are in).
- CJK composition for vertical type; artboard background colours in exports and print.
- Opening FreeHand, CorelDRAW, DWG, HEIC or JPEG 2000; writing Affinity files.
- Multiple windows and Window › Arrange; reliable exchange of `.ai` files from real users.
