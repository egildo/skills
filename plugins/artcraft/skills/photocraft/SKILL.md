---
name: photocraft
description: PhotoCraft is the open-source, pure-Rust Photoshop alternative from storytold. Use when the user names PhotoCraft, `photocraft-cli` or `.pcraft` files, or asks to script, automate, batch, render or convert images with it, or to drive the running app through its control port or MCP server. Generic image jobs ("edit this photo", "export a PNG", "open this PSD") trigger it only when the user is working in PhotoCraft. Not FilmCraft, FigCraft or the other ArtCraft apps, which share its automation style but not its commands.
---

# PhotoCraft

**Pinned:** PhotoCraft 0.14.0 (app and CLI), docs tag `v0.14.0`, checked 23 October 2026 on macOS. Measured on the running app.

Two layers, kept apart. PhotoCraft's docs at the pinned tag and its live command list are the reference for commands, parameters and protocol. This skill holds how to drive it and what was learned by doing. If the two disagree about a command, the docs and the live list win. If the installed version is not the pinned one, say so before relying on anything below.

## What it is

A layered raster editor laid out like Photoshop: layers, masks, adjustment and fill layers, layer styles, type, vector shapes, smart objects, PSD and PSB read and write. Every menu item is an engine command, so the app, the CLI and the MCP server run the same commands.
Native format: `.pcraft` (lossless, keeps everything). The project calls itself "early alpha" and says it is not yet a Photoshop replacement for daily professional work.
It is not Photoshop: no `.8BF`, CEP or UXP plug-ins (only its own WebAssembly plug-ins), no AI or generative features. Do not assume a Photoshop feature exists; look it up in the command list.

## The references

- Docs at the tag: `curl -sL https://raw.githubusercontent.com/storytold/photocraft/v0.14.0/docs/<file>`. Read first:
  - `control-protocol.md`: *Methods* (control port), *Engine commands* (what automation refuses), *MCP bridge*, *Headless server*, *Transport limits*.
  - `mcp.md`: MCP tools, `command_batch` semantics, recovery after a failed batch.
  - `file-format-parity.md`: what each format keeps; `kra.md`, `xcf.md`, `ora.md`, `pdn.md` for those formats.
  - `gaps.md`: what is missing, by area. `plugins.md`: the WebAssembly plug-in API.
- Live command list, with each command's `params` doc: `photocraft-cli commands --json --filter <text>` (headless, no app needed), or `engine.commands` on the control port (always the whole list: it takes no filter), or the MCP tool `command_list {"filter": …}`.
- Release notes: `https://github.com/storytold/photocraft/releases/tag/v0.14.0`.
- Versions: `photocraft-cli --version` and `/Applications/PhotoCraft.app/Contents/MacOS/PhotoCraft --version`.

## Surfaces

- **Headless CLI** (`photocraft-cli convert | info | run | batch | droplet`): one shot, files in, files out, no window, no token. `run (<file> | --new <json>) --cmd <id> --params <json> … --out <file>` prints one JSON line per command. Pick it for conversions and scripted edits of files on disk.
- **Headless JSON lines** (`photocraft-cli serve`, stdio or `--port`): one session kept open, with `batch` and `doc.render`. Pick it for many edits in a row without a window.
- **MCP headless** (`photocraft-cli mcp --automation-read-root <dir> --automation-write-root <dir>`): the same engine as MCP tools; `render_preview` renders the document itself.
- **MCP attached** (`photocraft-cli mcp --bridge 127.0.0.1:<port> --control-token-file <path>`): forwards to a running app, so changes show in its window. `ui_*` and `control_call` work only here.
- **Control port** (app started with `--control <port>`): JSON lines on 127.0.0.1, first frame `{"id":"auth","method":"auth","params":{"token":"…"}}`. Pick it, or the bridge, when the user wants to watch, or needs dialogs, pointer input or the UI.
- File access fails closed: without `--automation-read-root` / `--automation-write-root` nothing can be opened or saved over automation. Paths are relative to the root, or absolute inside it. Give the roots to the app, not to the bridging CLI.
- No other surface: no AppleScript dictionary, nothing listens beyond loopback.
- Version rule: on macOS the app bundle holds only `PhotoCraft`; `photocraft-cli` is a separate download. Keep both on the same version. A mismatch was not tested on 0.14.0: if the versions differ, say so and treat bridge behaviour as unknown.

## Driving it

1. Look before starting: `lsof -nP -iTCP:<port> -sTCP:LISTEN`. Never reuse a port the user's instance holds. Start your own instance:
   `open -n -a /Applications/PhotoCraft.app --args --control 7878 --control-token-file <private dir>/photocraft.token --automation-read-root <dir> --automation-write-root <dir>`
   then `until nc -z 127.0.0.1 7878; do sleep 0.5; done`. The token file is created mode `0600`; never print its contents.
2. Check the link: authenticate, then send `{"id":1,"method":"ui.inspect","params":{}}`. Read `result.session.documents` (`index`, `name`, `dirty`, `path`) and `result.session.active`.
3. Work in a new document: `engine.execute {"command":"file.new","params":{"width":1600,"height":1000,"name":"Draft"}}` returns `{"document": <index>}` and makes it active. Commands act on the active document; switch with `ui.menu.invoke {"id":"window.document.<index>"}` and check `session.active` again.
4. Make each logical change revertible. Take `history.newSnapshot {"name":"before"}` first; a bad result goes back with `history.selectSnapshot {"snapshot": <id>}`. For several commands in one call use the bridge's `command_batch` (or `batch` on `serve`); each step still adds its own history entry.
5. Read back what you set: `document.inspect` (layers, `history`), `layer.list`, `document.pixel {"x","y"}` (four floats 0..1). A reply of `ok: true` alone does not prove the change happened.
6. Look at the pixels: `app.save {"path":"preview.png"}` under the write root, then read the PNG. Headless, use `render_preview {"max_side": 1024}`.
7. Save where the user says, with `app.save {"path": …}`; the parent folder must exist. Read the reply's `warnings` (flattened layers, lossy compression) and pass them on.
8. When done, quit only the instance you started, after saving: find its PID with `lsof -nP -iTCP:7878 -sTCP:LISTEN`, send `app.quit`, and confirm the port is closed.

## Asking first

- Tell the user before you start a second instance: its window takes keyboard focus, so what they are typing lands in your document. `open -g` does not always prevent it.
- Editing, closing or saving a document the user already had open, or attaching to an instance you did not start. Start a second one instead.
- Overwriting any existing file: no surface asks before replacing one (see Pitfalls). Check with `ls` first.
- `app.save` with no `path`: it writes back over the document's own PSD, PSB, `.pcraft` or OpenRaster file.
- Printing (`file.print`) and Help › Report an Issue (opens the browser). PhotoCraft has no cloud, collaboration, AI generation or update check to worry about at this version.
- Quitting any instance the user started: it may hold unsaved work.
- After a transport failure or `timeout: no reply in 60s`, the command may still apply: inspect the document before re-sending. `timeout: not run` is safe to re-send.

## Formats

| Format | Read | Write | Caveat |
|---|---|---|---|
| `.pcraft` | yes | yes | Native; keeps everything. |
| PSD, PSB | yes | yes | Broad but not yet reliable in Photoshop (the docs' top gap). Keep the `.pcraft`. |
| TIFF | yes | yes | Flat unless `tiffLayers` / `--tiff-layers`. |
| PNG, JPEG, WebP, BMP, TGA, EXR, HDR | yes | yes | Flat: `app.save` warns "layer(s) flattened". GIF and APNG open the first frame only. |
| PDF | no | yes | One flattened page; `app.open` of a PDF fails. |
| OpenRaster `.ora` | yes | yes | Layers and blend modes; the round trip format for Krita. |
| Krita `.kra`, GIMP `.xcf`, Paint.NET `.pdn`, Affinity | yes | no | Import only; saving to them is refused with a message. |
| SVG | yes | no | Opens as shape layers or a vector smart object. |
| Camera raw | partial | – | DNG, CR2, NEF, ARW and others; CR3 gives only its embedded preview. |
| AVIF | no | no | Write is a build option, off in release builds. |

## Pitfalls

- **`open -a` without `-n` drops the arguments when PhotoCraft is already running.** macOS just brings the running app forward: no control port, no roots, no error. Always launch with `open -n -a`.
- **The desktop control port has no `batch` method.** It answers `unknown method \`batch\``. Batch through the MCP bridge (`command_batch`) or `serve`. Neither is one undo step: each command adds its own history entry, so use a snapshot to roll back.
- **Some commands accept misspelt keys and report success.** `layer.setProps {"opacty":0.2}` replies `ok: true`, `result: null`, changes nothing and adds an empty "Layer Properties" history entry. `filter.blur.gaussianBlur` rejects the same mistake. Read the value back after every set.
- **Saves replace existing files without asking.** Control `app.save`, MCP `doc_save` and CLI `run --out` all overwrite. Only `convert` refuses an output equal to its input.
- **A PSD or `.pcraft` save renames the document and binds it to that file.** The tab takes the file's name, and a later `app.save` without `path` writes there. Flat exports (PNG, JPEG) are copies and do not rebind.
- **JPEG quality has three scales.** `app.save` takes `quality` 0–12 (80 is an error). CLI `--quality` and headless `doc_save` take 1–100. Bridge `doc_save` refuses `quality` outright; use `control_call` with `{"method":"app.save","params":{"path":…,"quality":10}}`.
- **The app closes a control connection after 30 seconds idle, silently.** The next read is empty. Reconnect and authenticate again for each burst of work.
- **`app.quit` quits at once, discarding unsaved documents.** No unsaved-changes prompt, no recovery file. Save first, and send it only to your own instance.
- **`ui.screenshot` raises the window and captures all of it.** It takes focus from whatever the user is doing and returns the full window at device pixels (thousands of pixels wide on a Retina screen). The bridge's `render_preview` is the same window shot and refuses `index`. To see the document, save a PNG.
- **`notices` in `ui.inspect` follow the UI language; errors do not.** A save shows up as a localised notice, while `error` strings stay English. Decide on the reply's `ok` and `error`, never on notice text.

## Not there yet

- PDF, AVIF and JPEG 2000 import; AVIF export in release builds; Photoshop EPS.
- AI and generative features (Generative Fill, Neural Filters, Sky Replacement).
- Photoshop plug-ins (`.8BF`, CEP, UXP) and layer style `.asl` import.
- Writing Krita, GIMP, Paint.NET or Affinity files.
- Camera raw: CR3 sensor data, `.xmp` sidecars.
- Opening or saving through `file.open`, `file.save`, `file.saveAs` over automation: they are refused by design; use `app.open` / `app.save` (or the CLI).
