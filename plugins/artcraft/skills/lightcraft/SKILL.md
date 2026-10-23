---
name: lightcraft
description: LightCraft is the open-source, pure-Rust Lightroom alternative from storytold, a photo library and non-destructive raw developer. Use it when the user names LightCraft or `lightcraft-cli`, a LightCraft library folder (`catalog.snap`, `catalog.log`) or a `.lcpreset` file, or asks to script, automate, batch-develop, render or export photos with it. Generic photo jobs (cull a shoot, develop a raw, export JPEGs) trigger it only when the user is working in LightCraft. It is not Adobe Lightroom or its plug-in SDK, and not the other Craft apps (PhotoCraft, FigCraft).
---

# LightCraft

**Pinned:** LightCraft 0.13.0 (app and CLI), docs tag `v0.13.0`, checked 23 October 2026. From the docs and source at the tag: not measured.

Two layers, kept apart. LightCraft's docs at the pinned tag and its live command list are the reference for commands, parameters and protocol. This skill holds how to drive it and what was learned by doing. If the two disagree about a command, the docs and the live list win. If the installed version is not the pinned one, say so before relying on anything below.

## What it is

A photo library (albums, ratings, flags, search, culling) plus a non-destructive raw developer. Edits never touch the originals.
The native format is a library folder, not a per-photo document: `catalog.snap` plus an append-only `catalog.log`, with optional XMP sidecars next to the originals. There is nothing to "save": each command that changes something is written before it replies.
The project calls itself "alpha" and "young and moving fast".
Not Lightroom: no Lightroom plug-ins, no Adobe camera or lens profiles (`.dcp`, `.lcp`), and Lightroom catalogs are imported one way only.

## The references

- The docs at the tag: `curl -sL https://raw.githubusercontent.com/storytold/lightcraft/v0.13.0/docs/<file>`. Read first:
  - `mcp.md`: "Tools" (helpers and their defaults), then "One-shot commands: `lightcraft-cli run`" and "Other CLI subcommands".
  - `control-protocol.md`: "Methods", "External controllers" (reading state, undo grouping) and "Headless rendering".
  - `xmp-interop.md`: "Sidecar files". `lightroom-catalog-import.md` for `.lrcat`.
  - `file-format-parity.md` for formats; `gaps.md` for what is missing, ranked.
  - `ai-masks.md`, `faces.md`, `denoise.md` before any optional model; `merge.md`, `slideshow.md` for those modules.
- The README at the tag ("Built for agents", "Feature status"): `curl -sL https://raw.githubusercontent.com/storytold/lightcraft/v0.13.0/README.md`.
- The live command list: `lightcraft-cli commands --json` (engine commands) and `lightcraft-cli controls --json` (slider ids, ranges, defaults). Against a running app: `lightcraft-cli run --connect 127.0.0.1:7980 engine.commands` adds the UI commands such as `view.detail`. Over MCP: `command_list`.
- Release notes: `https://github.com/storytold/lightcraft/releases/tag/v0.13.0`.

## Surfaces

- **Headless CLI, one shot.** `lightcraft-cli run [--demo | --library DIR] [--import PATH]… COMMAND key=value …` runs a chain of commands and prints one JSON line each (`{"command", "ok", "result" | "error", "ms"}`), non-zero exit on failure. Without `--library` the session lives in memory: only the files it exports survive. `lightcraft-cli render IN -o OUT --set control=value` develops one file into one file. `lightcraft-cli snapshot` draws the whole UI on the CPU into PNGs, no window. Pick these for batch work and conversions.
- **MCP headless.** `lightcraft-cli mcp [--library DIR | --demo] [FILES…]`: stdio JSON-RPC, a long session with no window. `--compact` lists only the helper tools; `run_command` still reaches every command.
- **MCP attached.** `lightcraft-cli mcp --connect 127.0.0.1:7980` drives an app started with `--control 7980`; changes show in its window, and the UI tools (`screenshot`, `click`, `press_key`, `pointer_gesture`) are added. It starts before the app is up and connects on the first call.
- **Control port.** `LightCraft --control PORT` (or `LIGHTCRAFT_CONTROL_PORT`) serves JSON lines on `127.0.0.1` only. No authentication: enable it only for the task. `lightcraft-cli run --connect [ADDR]` speaks it from the shell.
- **Web build:** the same UI in a browser, scriptable only from its page (`lightcraft.command(...)`). No control port, no MCP.
- Nothing else is documented: no HTTP API, no remote access.

Authentication: none on any surface. One program holds a library at a time (`catalog.lock`): `--library` on a folder the app has open fails with "This library is already open in LightCraft"; use connect mode for that library instead.

Version rule: use the CLI and the app from the same release. On macOS the CLI is a separate release asset (`lightcraft-cli-<version>-macos-universal.zip`); `/Applications/LightCraft.app` holds only the desktop app, and nothing is put on `PATH`. Compare `lightcraft-cli --version` with `/Applications/LightCraft.app/Contents/MacOS/LightCraft --version`. The docs do not say what breaks on a mismatch; treat it as unsupported and tell the user.

## Driving it

1. Find the app. Probe the user's instance: `lightcraft-cli run --connect 127.0.0.1:7980 library.info`. If nothing answers and the user wants a window, start a second instance on a scratch library, never a restart of theirs: `/Applications/LightCraft.app/Contents/MacOS/LightCraft --library "$SCRATCH/lib" --no-demo --control <free port> photo.dng`. For no window, skip to step 3 with `run --library` or MCP headless.
2. Check the link. `library.info` → `path` must be the library you expect, on the port you meant. Photo ids are local to one library; drop cached ids after a reconnect.
3. Find the target. `library.state` gives `selection: {ids, active}`; `photo.inspect` gives the active photo's `id` and `develop` together. Commands without an id act on the active photo or the selection. Read control ids from `develop.controls` or `lightcraft-cli controls --json`, never from labels.
4. Make the change as one step. One command is one undo step: put every slider of a change in one `develop.set 'values={"light.highlights":-45,"light.shadows":38}'`. For a change that needs several commands, wrap them in `develop.beginInteraction label="…"` and `develop.endInteraction`.
5. Read it back. `photo.inspect` again: values are clamped to each control's range, and the stored value is the truth.
6. Look at it. Headless: MCP `render_preview {id, max_side}`, or `lightcraft-cli render in.dng -o /tmp/look.png --size 1024 --settings look.json`. Live: poll `ui.inspect` until `loupe.pending` is false and `loupe.source` is `render` or `cached` (or `loupe.failed` says why), then `ui.screenshot path=/tmp/ui.png`. Open the PNG and look.
7. Export where the user says: `app.export dir=<folder> format=jpeg longEdge=0 quality=92`. Read the reply's `files` (`path`, `width`, `height`, `bytes`, `sidecars`) and any `gpuFallback`. With `background: true`, poll `ui.inspect` → `export` until it is done.

## Asking first

- Tell the user before you start a second instance: its window takes keyboard focus, so what they are typing lands in your document. `open -g` does not always prevent it.
- Any change in a library the user already uses: ratings, flags, develop edits, albums, deletes (even to Recently Deleted), a Lightroom catalog import into it, `slideshow.templates.apply` (no undo).
- Anything that writes into the user's photo folders: XMP sidecars (`photo.saveMetadataToFile`, or edits when the library has `autoWrite` on), `destinationMode: "sameAsOriginal"`, `lightcraft-cli merge` (writes `<first>-HDR.dng` next to the first input), and `import` with `mode: "move"` (removes the originals from the source).
- Overwriting a saved file: an export to an existing `path`, or `conflict: "overwrite"`.
- Anything that leaves the machine or accepts terms: model downloads for Object/Describe masks, faces or denoise (each has its own licence), `LIGHTCRAFT_SAM3_REMOTE` or `LIGHTCRAFT_DENOISE_URL` (send pixels to another computer), `lightcraft-cli denoise-serve` (opens a TCP port), and `addToPhotos` (into Apple Photos, so iCloud Photos when that is on).
- Never send `app.quit` to an instance the user started: it may hold unsaved work or running tasks. Start a second one instead.
- After a dropped connection ("the outcome is unknown"), read the state (`photo.inspect`, `library.state`) before retrying: the command may have run. MCP connect mode never resends it for you.

## Formats

| Kind | Opens | Writes |
|---|---|---|
| Raw | DNG, CR2, CR3, ARW, NEF, RAF, RW2/RWL, PEF, ORF, SRW and more | DNG with the edits embedded; Rendered DNG (linear float, edits baked in) |
| Raw variants it cannot decode | embedded camera JPEG only, flagged `previewOnly` | |
| Images | JPEG, PNG, TIFF, WebP, JPEG XL, BMP; GIF first frame; PSD merged composite only (no layers); HEIC/HEIF in release builds | JPEG, PNG, TIFF (8/16-bit, 32-bit float), WebP, AVIF, JPEG XL (desktop only), flat PSD, original + XMP sidecar |
| AVIF | not decoded | 8/10-bit, PQ HDR |
| XMP sidecars | `lc:settings` exactly; Adobe `crs:` settings approximately, with per-photo warnings | `lc:settings` plus standard fields, merged into an existing sidecar |
| Presets | `.lcpreset`, XMP presets, `.lrtemplate`, Luminar `.lmp`; `.cube` LUT profiles | `.lcpreset` |
| Lightroom Classic `.lrcat` | read-only, one-way import: ratings, flags, labels, keywords, collections, virtual copies, mapped develop settings | never |
| Output modules | | contact sheet and print PDFs; slideshow PDF, JPEG sequence, AV1 in MP4/WebM (no audio) |

Imported Lightroom edits will not look identical: the project says render fidelity is unmeasured.

## Pitfalls

- **`command_batch` is not one undo step.** *(docs, not measured)* Each step gets its own undo step. Group a change in one `develop.set`, or between `develop.beginInteraction` and `develop.endInteraction`.
- **A taken control port fails quietly.** *(docs, not measured)* A port already in use, or not a number, is only logged; the app runs with no control server. `--connect` then reaches whoever owns the port. Check `library.info` → `path` before editing.
- **A second instance without `--library` lands on the user's library.** *(docs, not measured)* It opens `LIGHTCRAFT_LIBRARY` or the last library opened. If that is locked, it starts an empty in-memory session that saves nothing (`ui.inspect` → `libraryProblem`). Pass a scratch `--library`, and `--no-demo` or a file, or the new library fills with demo photos.
- **Headless exports are not full size by default.** *(docs, not measured)* Headless `app.export` and the MCP `export` tool write a 3000 px long edge when no size is given, and PNG for a `dir` with no `format`. `render` defaults to full size. Pass `longEdge=0` for full size and always pass `format`.
- **An exact `path` overwrites whatever `conflict` says.** *(docs, not measured)* A one-photo export to an existing `path` replaces that file; only catalogued originals are refused. Export to a `dir` (default `conflict: "unique"` adds `-2`), or check that the path is free.
- **Passing `id` moves the user's selection.** *(docs, not measured)* `set_develop`, `crop` and `export` with an `id` make that photo the only selected and active one. To look without moving anything, use `get_develop {id}`, `render_photo {id}` or `render_preview`.
- **Auto Sync spreads an edit.** *(docs, not measured)* With Auto Sync on, `develop.set` and `develop.adjust` also change the other selected photos. `develop.autoSync {}` toggles it; it is not a state query. Select only the target, then re-read the photos you touched.
- **White balance in settings JSON is relative unless it says Kelvin.** *(docs, not measured)* A `settings.wb` (or a preset) with `temp`/`tint` and no `"scale": "kelvin"` means 6500 = as shot, even on raws with Kelvin. Use `values` with `wb.temp`, or add the scale.
- **On macOS, `ui.key` does not fire menu shortcuts.** *(docs, not measured)* It injects egui keys, and the native menu owns the accelerators. Run the command by id through `engine.execute` instead.
- **A raw can look fine and still be preview-only.** *(docs, not measured)* A raw the decoder refuses shows its embedded JPEG. Check `previewOnly` in `catalog.query` before promising a develop or a full-resolution export.

## Not there yet

- Video playback, editing and export; Map and Book modules; tethered capture.
- On-screen HDR display (HDR editing and export work).
- Direct printing to a printer (print layouts export PDF only); slideshow music.
- AVIF import; custom ICC output profiles.
- Super Resolution, Raw Details, generative or content-aware remove; AI Denoise for X-Trans.
- Writing back to a Lightroom catalog; Lightroom plug-ins; Adobe `.dcp` / `.lcp` profiles.
- Optional models are not bundled: Object/Describe masks, face detection and AI Denoise need a separate install. Subject, Sky and Background masks are classical heuristics.
