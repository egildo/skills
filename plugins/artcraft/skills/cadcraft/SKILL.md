---
name: cadcraft
description: CADCraft is the open-source, pure-Rust AutoCAD alternative from storytold, a 2D drafting app that reads and writes DXF and DWG, with a headless CLI, an MCP server and a JSON control port. It applies when the user names CADCraft or `cadcraft-cli`, or asks to script, automate, render or convert drawings with it. Generic CAD jobs ("draw a floor plan", "convert this DWG") trigger it only when the user is working in CADCraft. It is not AutoCAD: no ARX or .NET plug-ins, no Visual LISP.
---

# CADCraft

**Pinned:** CADCraft 0.17.1 (app and CLI), docs tag `v0.17.1`, checked 5 November 2026 on macOS. Measured on the running app.

Two layers, kept apart. CADCraft's docs at the pinned tag and its live command list are the reference for commands, parameters and protocol. This skill holds how to drive it and what was learned by doing. If the two disagree about a command, the docs and the live list win. If the installed version is not the pinned one, say so before relying on anything below.

## What it is

A CAD and drafting app built around the AutoCAD workflow: command line with prompts and keywords, object snaps, layers, dimensions, hatches, blocks, layouts and plotting. Every menu item and tool is a command, reachable from the command line, JSON or MCP. Native format: the drawing is the DXF or DWG file itself; there is no project format. The project calls itself "pre-alpha" (the README badge says "early development"), and its docs call saving "lossy". 2D first: 3D is barely started. It is not AutoCAD: no ARX/.NET plug-ins, no Visual LISP (`vlax-`), no DCL dialogs.

## The references

- Docs at the tag: `curl -sL https://raw.githubusercontent.com/storytold/cadcraft/v0.17.1/docs/<file>`
  - `control-protocol.md`: the token paragraph, the method table, "Command-line replies".
  - `mcp.md`: "Start it" (`--lazy`, `--launch`) and "Tools".
  - `file-format-parity.md`: "DXF content: read and write by object type" before promising any round trip.
  - `gaps.md`: "Top 10 across everything", then "File formats".
  - `customization.md`: scripts, `.pgp` aliases, LISP; `autolisp.md` for what LISP runs.
  - `cli.md`: "Conventions" (exit codes, streams, `--in-place`) and "Environment variables"; `cadcraft-cli help <subcommand>` holds every flag.
  - The README (`.../v0.17.1/README.md`), "Drive it from agents, MCP and the CLI", for examples.
- Live command list: `cadcraft-cli commands [FILTER]` (JSON: id, aliases, `params`, `interactive`); on the control port `engine.commands` (adds the app's `ui.*` commands) and `control.methods`; in MCP, `list_commands {filter}`.
- Release notes: `https://github.com/storytold/cadcraft/releases/tag/v0.17.1`

## Surfaces

- **Headless CLI.** `cadcraft-cli info | convert | run | commands | sample | mcp`. One shot, files in, files out, no auth, no window. `run FILE --script '...' --cmd 'id {json}' --save out.dxf --export out.png`; a `--cmd` value of exactly `"{last}"` is the last handle an earlier `--cmd` returned. Exit codes: 0 done, 1 the command failed, 2 usage error. Right for conversion, inspection and scripted edits to files.
- **MCP headless.** `cadcraft-cli mcp`: an in-process drawing over stdio, no window. Right for a long agent session on files nobody watches.
- **MCP attached.** `cadcraft-cli mcp --connect 127.0.0.1:7979`: the same tools plus `screenshot`, `ui_inspect`, `ui_click`, acting on the app's window. It reads the control token itself. Without a reachable app it fails; it never falls back to a separate drawing.
- **Control port.** Start the app with `--control PORT`; JSON lines on `127.0.0.1:PORT`. Every request carries `"token"`, read from `cadcraft-control-<PORT>.token` in `$XDG_RUNTIME_DIR`, else `~/.cache` (on macOS usually `~/.cache/cadcraft-control-7979.token`, mode 600). Right when the user should see the work, or for one-off requests from the shell.
- **Not there:** no HTTP API, no remote access; the web build has no file system and no DWG.
- **Version rule.** The CLI must match the app. Compare `/Applications/CADCraft.app/Contents/MacOS/CADCraft --version` with `cadcraft-cli --version`. The app bundle holds no CLI; it is a separate release (`cadcraft-cli-<ver>-macos-universal.zip`). A CLI older than 0.12.0 sends no token, and the app refuses every request without one *(docs, not measured)*.

## Driving it

1. Check both versions. If either differs from 0.17.1, say so.
2. Start your own instance, never reuse the user's: `open -n -a /Applications/CADCraft.app --env CADCRAFT_CONFIG_DIR= --args --control 7979`. The empty settings folder skips the startup update check and keeps your session out of the user's preferences, log and autosave. Then `until nc -z 127.0.0.1 7979; do sleep 1; done`. Note its PID: `lsof -nP -t -iTCP:7979 -sTCP:LISTEN`.
3. Check the link, reading the token only after the port answers:
   ```sh
   T=$(cat ~/.cache/cadcraft-control-7979.token)
   printf '{"id":1,"method":"ping","params":{},"token":"%s"}\n' "$T" | nc -w 5 127.0.0.1 7979
   ```
   Several requests can go in one `printf`, one per line; replies come back in order. Never echo the token into the conversation.
4. Find the target: `ui.inspect` → `result.session.documents` (`index`, `active`, `dirty`, `path`) and `cmdline.state` → `running` must be `null`. Commands act on the active drawing. For new work, `engine.execute` with `{"command":"new","params":{"metric":true}}`: the new drawing becomes active. For a file from another program, `drawing.inspect` → `skipped` and `readNotes` say what reading it left out.
5. Make each logical change one undo step: send `{"command":"undo","params":{"mode":"begin"}}`, the commands, then `{"mode":"end"}`; undo shows one `Group` entry. Prefer `engine.execute` with JSON (`params` as `engine.commands` documents them) over typed command lines.
6. Read it back: `drawing.inspect {"entities":true}` (counts, handles, geometry, `undo`), `engine.execute` `texts` or `entities`. Look at it: `ui.render {"path":"/abs/out.png","width":1600,"height":1000}`, then open the PNG.
7. Save where the user says: `app.save {"path":"/abs/name.dxf"}` (or `.dwg`, `saveas` with `version`). Check the reply's `version`, then `cadcraft-cli info /abs/name.dxf` for counts.
8. When done, quit only your own instance, after saving: `app.quit`, and confirm the PID is gone.

## Asking first

- Tell the user before you start a second instance: its window takes keyboard focus, so what they are typing lands in your document. `open -g` does not always prevent it.
- Any edit in a drawing the user already had open, and switching their active drawing (`document.switch`).
- Saving over an existing file: `app.save` and JSON `saveas` overwrite without asking, keeping only the previous file as `<name>.bak` (a DWG) or `<name>.dxf.bak`, itself overwritten next time. CLI `--save` refuses to replace one of its inputs unless given `--in-place`, and keeps no `.bak`.
- Saving as DWG, or re-saving a DXF from another program: the docs say what CADCraft does not model is dropped. Keep the original.
- `close`, `closeall` and `app.quit` on an instance with work in it: they discard unsaved changes without a prompt.
- `ui.set`, `ui.language`, `ui.saveformat`, `ui.dock`: they change preferences the app saves for next time *(docs, not measured)*.
- The app checks GitHub for updates at startup when it has a settings folder, and offers "Update and Restart", which installs a new build: never accept it. No account, cloud or AI service. Downloading fonts or builds is the user's call.
- Never quit an instance the user started: it may hold unsaved work. Start a second one with `open -n`.
- After a transport failure or a `timeout` reply, read `drawing.inspect` before retrying: with `"state":"may-have-run"` the call may have completed.

## Formats

| Format | Open | Write | Caveat |
|---|---|---|---|
| DXF ASCII/binary | R12–2018 (no R12 binary) | 2000–2018, 2018 by default | unknown entities kept raw; R12 not written |
| DWG | R13–2018 | 2000–2018, 2018 by default | through a converter; 3D solids, proxies, custom objects dropped on save |
| DWT | as template (`new {"template"}`) | `saveas` | |
| SVG / SVGZ | shapes, paths, groups, layers | yes | no CSS, `use`, fills, text, images; a CADCraft SVG reopens as polylines only |
| PNG | no | yes | CLI: 2400×1600, model space only |
| PDF | no (no import, no underlay) | yes (`convert`, PLOT, EXPORTPDF) | CLI: model space; sheets need PLOT |
| `.lsp`, `.scr`, `.pgp`, `.lin`, `.pat` | load | no | SHX fonts are drawn only when found beside the drawing or in `CADCRAFT_SHXPATH`; otherwise the stroke font stands in and metrics differ *(source at the tag, not measured; `file-format-parity.md` still says SHX is not parsed)* |
| PNG, JPEG, BMP, TIFF images | attach (`imageattach`, JSON only) | as a reference | drawn on screen and in PNG; PDF and SVG output draw only the frame |

## Pitfalls

**`open -a` without `-n` ignores `--args`.** With CADCraft already running it only brings that window forward; no port opens. Always `open -n -a ... --args --control PORT`.

**`mcp --launch` cannot start a second instance.** It runs `open -a` without `-n`, so with CADCraft already open without that port the first tool call waits about 60 s, then fails: `CADCraft was opened but its control port 127.0.0.1:PORT did not answer; if it was already open without the port, quit it and try again`. Do not: start your own with `open -n` and `--connect` to its port.

**A bad token closes the connection.** The reply is `unauthorized: missing or invalid control token`, then the socket is dropped; reconnect. The token file outlives the app and is rewritten at every launch: read it after the port answers, never cache it.

**Unknown JSON parameters are silently ignored.** `circle` with `"layer":"X"` lands on the current layer; `line` with a typo `"closd":true` stays open. Check names against `params` in `engine.commands`, then read back.

**Numbers sent as strings fail with a misleading message.** `"radius":"5"` gives ``invalid parameters for `circle`: `radius` must be positive``. Send JSON numbers and `[x,y]` arrays.

**A LINE in a script must end with a blank line.** Without it the next command name is refused and its numbers become more line segments; LINE stays running. `cmdline.script` has no `error` field and `cadcraft-cli run --script` exits 0 anyway. Check `output` for refusals and `state.running`. (`--cmd` errors do exit 1 and save nothing.)

**`cmdline.input` splits text at spaces when the same line started TEXT.** `text 0,0 2 0 Hello big world` makes three TEXT objects, one per word. Send the text in its own `cmdline.input`, use `cmdline.script`, or `engine.execute` `text {"at","text","height"}`. DTEXT then waits for more lines: send an empty line or Escape.

**An empty Enter at `Command:` repeats the last command.** One Enter too many restarts TEXT or LINE. Read `prompt` before sending `""`.

**A script is not one undo step.** Each command is its own undo entry. Wrap the change in `undo` `begin`/`end`.

**New drawings are in inches.** `new {}` follows `MEASUREINIT`, 0 unless the user changed it in Options, and `cadcraft-cli run` without `--metric` is imperial too: `$INSUNITS` 1. Pass `{"metric":true}` or `--metric` for millimetres, whatever the profile says.

**Saving to `.dxf` or `.dwg` re-points the drawing.** After `app.save` to a new path, the tab's title and `path` become that file. Saving to `.png` only exports; the docs say the same of `.svg` and `.pdf`.

**A save to a missing folder creates it.** `app.save` to a mistyped folder succeeds: the reply adds `createdFolder`, and the history says `Created the folder ..., which did not exist. Check the path if you did not mean to.` The release notes say render and export do the same. Check the reply for `createdFolder`.

**`close` and `app.quit` never ask.** A dirty drawing closed with `close {"index":n}` is gone, and the indexes after it shift down. `app.quit` quits with unsaved drawings open; the release notes say only the menu's Quit and Cmd+Q ask.

**`ui.render` returns the image inline even with `path`.** The reply carries the whole PNG as `pngBase64`. Do not print it; cut the reply or write it to a file.

## Not there yet

- 3D modelling: no solids, surfaces, meshes, orbit or 3D views.
- Dynamic block authoring and in-place xref editing: `refedit` edits block references, and an xref's source drawing is not written back.
- PDF import or underlays. Raster images have no prompts, dialog, clip or adjust, and cannot be stored in the drawing.
- Visual LISP ActiveX, DCL dialogs, reactors; compiled plug-ins.
- Ellipse and spline geometry is tessellated: offsets and intersections on them are approximate.
- No check that AutoCAD opens CADCraft's DWG cleanly: say so before promising interchange.
