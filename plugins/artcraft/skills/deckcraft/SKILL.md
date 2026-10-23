---
name: deckcraft
description: DeckCraft is the open-source, pure-Rust PowerPoint alternative from storytold. It builds decks with masters, themes, charts and transitions, opens and saves `.pptx`, and exports PDF, PNG and GIF. Use it when the user names DeckCraft or `deckcraft-cli`, works with a `.deckcraft` file, or asks to script, automate, render, export or convert a deck with it, headless or in the running app over MCP or the control port. Generic slide jobs ("make a deck", "export these slides to PDF") trigger it only when the user is working in DeckCraft. It is not Microsoft PowerPoint and does not drive it.
---

# DeckCraft

**Pinned:** DeckCraft 0.10.0 (app and CLI), docs tag `v0.10.0`, checked 23 October 2026. From the docs and source at the tag: not measured.

Two layers, kept apart. DeckCraft's docs at the pinned tag and its live command list are the reference for commands, parameters and protocol. This skill holds how to drive it and what was learned by doing. If the two disagree about a command, the docs and the live list win. If the installed version is not the pinned one, say so before relying on anything below.

## What it is

A presentation editor and slide-show player: masters and layouts, themes, shapes, text, tables, charts, SmartArt, audio and video, transitions and animations, presenter view.
Every button is a command with a stable id, and the UI, the CLI, the control port and MCP all run the same commands.
Native format: `.deckcraft`, a zip of `presentation.json` plus media. It also opens and saves `.pptx`.
The project calls itself "alpha", heading for beta.
It is not PowerPoint: no VBA, no add-ins, no `.ppt` or `.odp`, no cloud or AI features.

## The references

- Docs at the tag: `curl -sL https://raw.githubusercontent.com/storytold/deckcraft/v0.10.0/docs/<file>`
  - `mcp.md`: the tool table first, then "Confining file access".
  - `control-protocol.md`: the method table and the server limits above it.
  - `file-format-parity.md`: the "Documents" table, then "PPTX coverage".
  - `gaps.md`: "Ranked: the top 15", then "File formats".
  - `architecture.md`: "Commands and frontends".
- README at the tag (sections "Agents, CLI and MCP", "Logs"): `curl -sL https://raw.githubusercontent.com/storytold/deckcraft/v0.10.0/README.md`
- The live command list: `deckcraft-cli commands [FILTER]`, then `deckcraft-cli describe COMMAND` for one command's parameters. Over MCP: `list_commands`. Against the running app: `deckcraft-cli app --port 7990 --method engine.commands`.
- CLI help: `deckcraft-cli help`, `deckcraft-cli help run`. `help run` lists the conventions the ids don't say (points, 0-based slides, selection).
- Release notes: `https://github.com/storytold/deckcraft/releases/tag/v0.10.0`

## Surfaces

- **Headless CLI** (`deckcraft-cli`): one shot, files in, files out, no window. `run` applies `--cmd ID=JSON` steps, then `--save` or `--export`. `render`, `convert` and `info` cover the common jobs. Pick it for generating, converting or rendering a deck nobody has open.
- **MCP, headless** (`deckcraft-cli mcp`): a long session on stdio with its own engine and no window. It starts with no presentation: call `new_presentation` or `open_presentation` first (or start it with `--sample`). Add `--automation-read-root DIR --automation-write-root DIR` to keep it to given folders. Pick it for iterative work with `render_slide` to look at results.
- **MCP, attached** (`deckcraft-cli mcp --connect 7990`): drives a running app started with `--control 7990`. Changes show in the user's window. Adds `screenshot` and `call_app`. It cannot be combined with the automation roots, and the running app is not confined.
- **Control port** (`deckcraft --control PORT`, or `DECKCRAFT_CONTROL_PORT`): JSON lines on `127.0.0.1` only, one request and one reply per line. From a shell: `deckcraft-cli app --port PORT --method METHOD 'JSON'`, or `deckcraft-cli app --port PORT COMMAND 'JSON'` to run a command.
- No authentication on any of them. The control port is loopback-only; never forward it.
- The CLI is a separate download from the app (`deckcraft-cli-<ver>-macos-universal.zip`). The app binary is `/Applications/DeckCraft.app/Contents/MacOS/DeckCraft`.
- Version rule: check `deckcraft-cli --version` and the app's `--version` before you attach. They must both be the pinned version. The docs describe no version check on `--connect`, so a mismatched CLI can offer commands the app lacks.

## Driving it

1. Find a running app and its port (`pgrep -fl DeckCraft`, `lsof -nP -iTCP -sTCP:LISTEN | grep -i deckcraft`), or start a second one: `/Applications/DeckCraft.app/Contents/MacOS/DeckCraft --control 7990`. For headless work, skip to step 3 with `deckcraft-cli mcp` or `deckcraft-cli run`.
2. Check the link: `deckcraft-cli app --port 7990 --method ui.inspect`. Read `documents` and `dialog` in the reply. No reply means no control server on that port.
3. Find the target document: `document.inspect` (MCP `inspect_document`), then `slide.inspect {"index": N}` for shape ids, boxes and text. Shape ids resolve on the current slide only, so `slide.go {"index": N}` first.
4. Look up each command before using it: `deckcraft-cli describe shape.insert`. Rects are `[x, y, width, height]` in points on a 960×540 slide.
5. Send one logical change per call: MCP `batch` with `{"commands": [...]}`, or several `--cmd` in one `run`. Each changing command is its own undo step; `edit.undo` takes back one.
6. Look at the result: MCP `render_slide`, `deckcraft-cli render deck.deckcraft --slide N out.png`, or `ui.screenshot {"path": "/tmp/shot.png"}` attached. Open the image and read it; then re-read the slide with `slide.inspect`.
7. Save where the user says: `file.save {"path": "....deckcraft"}` for the deck, `file.export {"path": ..., ...}` for every other format. Read the reply for `path` and `bytes`, or `files`.

## Asking first

- Tell the user before you start a second instance: its window takes keyboard focus, so what they are typing lands in your document. `open -g` does not always prevent it.
- Editing or deleting in a deck the user already has open in the app.
- Overwriting any existing file, including a save back to the path a deck was opened from.
- `file.close` on a changed deck: the docs say it closes without asking and the edits are lost.
- `app.quit`: never on an instance the user started. It quits without asking. Start a second instance on another port instead.
- Saving a `.pptx` over the user's `.deckcraft` master or the reverse: the round trip has known losses.
- After a transport failure or a reply saying the outcome is unknown, read the document before retrying. The command may have run; the client never replays it.
- The docs list no cloud, sharing or AI features at this tag. If a step would reach the network anyway (a hyperlink in a show), ask.

## Formats

| Format | Open | Write | Caveat |
|---|---|---|---|
| `.deckcraft` | yes | yes | Lossless for DeckCraft; old `.slidecraft` files open |
| `.pptx` | yes | yes | Tested on decks the project wrote, not on outside decks. Media playback options and animation rewind are dropped on save; editing a chart drops its embedded workbook. Unreadable slides come back as `lostSlides` |
| `.potx`, `.ppsx` | yes | yes | The docs say they are written as plain `.pptx`; the source at the tag writes their own content types. Check the file if it matters |
| `.pptm`, `.ppt`, `.odp` | no | no | |
| PDF | no | export | Slides, notes pages, handouts. Text is real and selectable; slide artwork is a raster image |
| PNG, JPEG | no | export | One slide, or `all`; PNG can drop the background (`transparentBackground`) |
| Animated GIF | no | export | One still frame per slide: no transitions, no builds |
| `.txt`, `.md` outline | yes | yes | Markdown headings become slides, list items bullets. No RTF |
| Pictures in a deck | | | PNG, JPEG, GIF, WebP, BMP, TIFF draw; EMF/WMF draw as vectors; SVG and HEIC do not |

## Pitfalls

- **Saving to an image name writes a `.deckcraft` zip.** *(docs, not measured)* `file.save`, `run --save`, MCP `save_presentation` and `app.save` to `.png` or `.jpg` write native deck bytes under that name. Use `file.export`, `run --export` or MCP `export` for pictures.
- **`file.save` to `.pdf` or `.pptx` moves the deck there.** *(docs, not measured)* The deck's path becomes that file and it is marked saved. A later bare `file.save` writes that format again, with default PDF options. Save the deck as `.deckcraft`; write copies with `file.export`.
- **A save with no path writes nothing and still succeeds.** *(docs, not measured)* `file.save` on an untitled deck answers `{"needsPath": true}`, not an error. Always pass `path`, and check the reply has `bytes`.
- **`batch` is not a transaction.** *(docs, not measured)* It stops at the first error, but the commands before it stay applied, each as its own undo step. Read the returned list to see which ran. `keepGoing: true` runs past errors.
- **An SVG inserts but never draws.** *(docs, not measured)* `insert.picture` accepts SVG, and the renderer has no SVG decoder, so the picture is invisible. Convert it to PNG first.
- **A busy port gives an app without a control server.** *(docs, not measured)* The bind failure only goes to the log; a malformed port number is dropped silently. `--connect` may then reach another instance on that port, maybe the user's. Check `ui.inspect` names the document you expect.
- **`deckcraft-cli app` defaults to port 7979.** *(docs, not measured)* The docs start the app on 7990. Always pass `--port`.
- **Slide ranges switch base.** *(docs, not measured)* In `file.export`, `slides` as a JSON array is 0-based; as a string (`"1-3, 5"`) it is 1-based, as typed in PowerPoint.
- **`convert` and `run --export` write one picture.** *(docs, not measured)* `convert` to `.png` writes slide 0; `run --export x.png` writes the current slide. Pass `--export-params '{"all": true}'`, which writes `x1.png`, `x2.png`… beside it.
- **Connected replies cap at 16 MiB.** *(docs, not measured)* A large `render_slide` or `screenshot` over `--connect` breaks the link and the outcome is unknown. Render to a `path`, or lower `scale`.

## Not there yet

- No SVG or HEIC pictures, no equations (OMML), no recorded slide show or narration.
- No `.ppt`, `.pptm`, `.odp`; no password-protected decks.
- No video export; the GIF has no transitions or builds.
- No vector PDF artwork; no printing.
- Presenter view does not go to the second display by itself.
- English-only interface; no native macOS menu bar.
- The desktop app has no automation roots: an attached agent can read and write anywhere the user can.
