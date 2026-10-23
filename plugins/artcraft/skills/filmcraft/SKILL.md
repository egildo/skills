---
name: filmcraft
description: FilmCraft is the open-source, pure-Rust Premiere Pro alternative from storytold, a non-linear video editor with colour, effects, captions, mixing and export. Use it when the user names FilmCraft or `filmcraft-cli`, works with a `.fcproj` file, or asks to script, automate, render, export or convert video with it, headless or in the running app over MCP or the control port. Generic video jobs ("cut this clip", "export an MP4") trigger it only when the user is working in FilmCraft. It is not Adobe Premiere and does not drive it, and it is not ArtCraft, the team's AI image and video studio.
---

# FilmCraft

**Pinned:** FilmCraft 0.12.0 (app and CLI), docs tag `v0.12.0`, checked 23 October 2026. From the docs and source at the tag: not measured.

Two layers, kept apart. FilmCraft's docs at the pinned tag and its live command list are the reference for commands, parameters and protocol. This skill holds how to drive it and what was learned by doing. If the two disagree about a command, the docs and the live list win. If the installed version is not the pinned one, say so before relying on anything below.

## What it is

A non-linear editor laid out like Premiere: Source and Program monitors, bins, a multi-track timeline, trims, multicam, colour grading, effects and keyframes, titles, captions, an audio mixer, background export.
Every menu item, button and drag is a command with an id, and the UI, the CLI, the control port and MCP all run the same commands.
Native format: `.fcproj`, compact UTF-8 JSON with a schema version. Media is referenced by path, never embedded.
The project calls itself "alpha" and "young and moving fast".
It is not Premiere: no `.prproj`, no plugins (VST3, Audio Units, OpenFX), no `.mogrt`, no FFmpeg inside.

## The references

- Docs at the tag: `curl -sL https://raw.githubusercontent.com/storytold/filmcraft/v0.12.0/docs/<file>`
  - `agents.md`: "Part 1: driving FilmCraft" (the MCP tool table, "Conventions", "Long exports"), then §2 and §2b for the control channel and CLI.
  - `control-protocol.md`: the method table, then "Selection or explicit targets" and "Focus".
  - `project-files.md`: "Format", "Newer files", the save and recovery commands, then "Media: offline, relinking, proxies, ingest".
  - `file-format-parity.md` and `codec-parity.md`: what reads and writes, format by format.
  - `gaps.md`: the ranked table of shortfalls at the top.
  - `captions.md`, `graphics.md`, `transcripts.md`, `monitors.md` for those areas.
- README at the tag ("Formats and codecs", "Export", "Interchange", "Status"): `curl -sL https://raw.githubusercontent.com/storytold/filmcraft/v0.12.0/README.md`
- The live command list: `filmcraft-cli commands [filter] --json`, then `filmcraft-cli describe <id>` for one command's params and whether it is enabled now. Against the running app add `--bridge 127.0.0.1:9876`. Over MCP: `command_list`; on the control port: `{"id":1,"method":"engine.commands"}`.
- CLI reference: `filmcraft-cli help`. App flags: `FilmCraft --help`.
- Release notes: `https://github.com/storytold/filmcraft/releases/tag/v0.12.0`

## Surfaces

- **Headless CLI** (`filmcraft-cli`): one shot, files in, files out, no window. `--project p.fcproj` (or `--demo`) opens a project in a fresh session, then `exec`, `run`, `import`, `inspect`, `export`, `render` or `probe`. Edits reach disk only with `--save` or `--save-as`. Pick it for a project nobody has open.
- **MCP, headless** (`filmcraft-cli mcp`, `--demo` or `--project p.fcproj`, optional `--data-dir`): a long session on stdio, no window. Tools include `command_run`, `command_batch`, `doc_inspect` and `render_frame`. Pick it for iterative work on a file.
- **MCP, bridge** (`filmcraft-cli mcp --bridge 127.0.0.1:9876`): drives the app started with `--control 9876`. Changes show in the user's window, and the `ui_*` tools (elements, click, drag, key, type, screenshot) work only here.
- **Control port** (`FilmCraft --control 9876`, or `FILMCRAFT_CONTROL_PORT`): JSON lines on `127.0.0.1` only, one request and one reply per line. From a shell, `filmcraft-cli --bridge 127.0.0.1:9876 exec <id> key=value` is the easy client.
- **Web build** (`filmcraft-web-<ver>.zip`): the same commands as promises on `window.filmcraft` in the browser page. Only relevant when the user runs the web build.
- No authentication on any of them, and MCP has no folder confinement: it reads and writes wherever the user can. Start the control port only while you use it.
- On macOS the CLI is a separate download (`filmcraft-cli-<ver>-macos-universal.zip`); the `.app` holds only the desktop app. The app binary is `/Applications/FilmCraft.app/Contents/MacOS/FilmCraft`.
- Version rule: `filmcraft-cli --version` and `FilmCraft --version` must both print the pinned version. Nothing checks this on `--bridge`: command ids are passed through as given, so a mismatch shows up only as unknown commands or rejected params.

## Driving it

1. Find a running app with a port (`pgrep -fl FilmCraft`, `lsof -nP -iTCP -sTCP:LISTEN | grep -i filmcraft`). If the user's instance has no port, start a second one: `/Applications/FilmCraft.app/Contents/MacOS/FilmCraft --control 9877 &`. It opens without taking focus. For file-only work use the headless CLI or MCP instead.
2. Check the link and the document: `filmcraft-cli --bridge 127.0.0.1:9877 inspect project`. Read `name`, `path`, `dirty` and `revision`. A refused connection means no control server on that port.
3. Read the timeline: `filmcraft-cli --bridge … inspect sequence` (MCP `sequence_inspect`) for track names, clip ids, `start` and `end` in ticks. Commands act on the active sequence.
4. Look up each command before using it: `filmcraft-cli --bridge … describe timeline.place`. Name targets (`clips`, `items`) instead of relying on the selection.
5. Make one logical change per call: one `exec`, or a short `run -` script or MCP `command_batch`. Each edit is its own undo step; note `revision` before, so you know how far `edit.undo` must go.
6. Look at the result. Headless: `filmcraft-cli --project p.fcproj render --seconds 2 --out /tmp/f.png`. Bridge: MCP `render_frame` or `ui_screenshot`, or `ui.screenshot {"path": "/tmp/shot.png", "panel": "Timeline"}` on the control port. Open the PNG and read it, then re-read `inspect sequence`.
7. Save where the user says: `exec file.save` (bridge) or `--save` / `--save-as p.fcproj` (headless). Export with `filmcraft-cli --project p.fcproj export out.mp4`, then check the exit status, `offlineMedia` and the path it says it wrote.

## Asking first

- Tell the user before you start a second instance: its window takes keyboard focus, so what they are typing lands in your document. `open -g` does not always prevent it.
- Any edit in a project the user has open in the app, and any save over a file the user already had.
- `file.open`, `file.newProject`, `file.openDemoProject`, `file.recover` and `file.revert` in the user's instance: they replace the project in the window.
- Exports or `file.saveAs` onto an existing path; `media.makeOffline` with `deleteFiles: true`; `file.discardRecovery`; `mediaCache.clean`; `file.projectManager` with `overwrite`.
- `prefs.set`, `prefs.reset`, `shortcuts.set` and preset deletes: they change the user's settings for every project.
- `transcript.downloadModel` and the web build's `importUrl`: they reach the network. The docs list no cloud, sharing or publishing features at this tag.
- Never quit an instance the user started, neither with the `app.quit` method nor the command. Start a second instance on another port instead.
- After a transport failure or a timeout, read `inspect project` (`revision`) and the sequence before retrying: the command may have run.

## Formats

| Format | Open | Write | Caveat |
|---|---|---|---|
| `.fcproj` | yes | yes | A file from a newer FilmCraft is refused. The first save over an older file keeps `<name> (schema vN backup).fcproj` beside it |
| `.prproj` | no | no | Bring Premiere work over as FCP 7 XML, AAF or OTIO |
| FCP 7 XML, FCPXML 1.9–1.11, OTIO, CMX 3600 EDL | yes | yes | Import merges into the open project as one undo step. XML exported by Premiere imports slowly |
| AAF, OMF 2.0 | AAF yes, OMF no | yes | The docs say neither was ever opened in Media Composer or Pro Tools |
| ALE, marker CSV | no | yes | |
| MP4, MOV, MXF, Matroska / WebM, MPEG TS / PS, Ogg, AVI | yes | MP4, MOV, MXF | AVI per the README; one parity table still says no. No WMV, FLV, DivX or DV |
| H.264, ProRes, DNxHR, MJPEG | yes | yes | Media export writes ProRes 422 HQ; proxies use Proxy or LT. 10-bit and 4:2:2 H.264 decode only through the OS hardware decoder |
| HEVC, VP8, VP9, AV1, MPEG-2 | yes | HEVC only by hardware | HEVC export: VideoToolbox on macOS (8-bit SDR) or NVIDIA on Windows. No AV1 export |
| PNG, JPEG, TIFF, BMP, GIF, WebP, EXR, DPX, Targa | yes | sequences, GIF | No PSD, HEIC or camera RAW |
| WAV, AIFF, AAC | yes | yes | MP3, FLAC, Opus, Vorbis read only |
| SRT, WebVTT, SCC, MCC, EBU STL, TTML / DFXP | yes | yes | Burn-in or sidecar only; no 608/708 embedded in the video stream |
| `.cube`, `.3dl` LUTs | yes | `lut.export` | Premiere `.prfpset`, `.epr`, `.kys` presets are not read |

## Pitfalls

- **`command_batch` and `run` are not transactions.** *(docs, not measured)* Each edit is its own undo step. A failing step stops the batch, but the steps before it stay applied. Read `results` to see which ran.
- **A failed command leaves no undo step.** *(docs, not measured)* "Undo if wrong" after a failure undoes the edit before it, perhaps the user's. Undo only after a success, and check the label in the `undone` reply.
- **Undo history holds 200 steps.** *(docs, not measured)* The README says unlimited; the architecture doc and the engine say 200. A long scripted session pushes the user's older history off the end. `file.open` and `file.newProject` clear it.
- **Opening or starting a project in the app does not ask.** *(docs, not measured)* `file.open {path}`, `file.newProject` and `file.openDemoProject` sent through the bridge replace the open project with no save prompt; only `file.revert` without params asks. Check `dirty` first.
- **The `app.quit` method skips the save prompt.** *(docs, not measured)* On the control port it quits at once and leaves unsaved changes in the recovery journal. The `app.quit` command asks first. Use neither on the user's instance.
- **A control-port timeout does not mean it failed.** *(docs, not measured)* After 60 s the port answers `{"ok":false,"error":"timeout"}` while the command still runs. For long exports send `wait: false` and poll `jobs.list`, or use `--bridge` or MCP, which do that for you.
- **The bridge client resends once.** *(docs, not measured)* `--bridge` and MCP bridge retry a request once on a broken connection or after 90 s without a reply, so an edit can land twice. After any bridge error, re-read the sequence.
- **Each headless CLI call is a new session.** *(docs, not measured)* `exec` without `--save` or `--save-as` changes nothing on disk, and the next call starts from the file again. `--bridge` refuses `--project` and `--demo`, and `render` is headless only.
- **`render_frame` in bridge mode is a screenshot.** *(docs, not measured)* It captures the Program monitor as shown, not a render of the frame. `ui.screenshot` fails after 10 s when the window is hidden or the display sleeps. For an exact frame use headless `render` or `file.exportFrame`.
- **Offline media fails only the CLI.** *(docs, not measured)* `filmcraft-cli export` and `render` exit 1 when they drew the "media not found" placeholder. Through MCP or `exec`, the export succeeds and lists the items in `offlineMedia`. Check `media.findMissing` before exporting and `offlineMedia` after.
- **The output may get a second extension.** *(docs, not measured)* When the format needs another container, the name changes (`out.mp4` written as APV is `out.mp4.mov`). Take the written path from the result, not from what you asked for.
- **Enabled state ignores named targets.** *(docs, not measured)* `command_list` and `describe` report enablement for the current selection. A command shown disabled may run fine with `clips` or `items` named. Try it with targets before giving up.
- **`timeline.move` drags linked partners along.** *(docs, not measured)* With Linked Selection on, moving a picture clip moves its sound too, overwriting what is at the destination. Pass `"linked": false` to move only the listed clips.
- **Bare times are ticks.** *(docs, not measured)* 254 016 000 000 per second. `start`, `end`, `sourceIn` and a number passed as `time` are ticks; use `seconds`, `frame` or `timecode` keys when you mean those.

## Not there yet

- No `.prproj` open or save, no plugin hosting, no `.mogrt`.
- No AV1 export, no software HEVC export, no MP3, WMV, DVD, Blu-ray or DCP delivery.
- Speech to text is off in release builds: `transcript.generate` is disabled. Import a transcript with `transcript.set`.
- No work area bar: export ranges use In/Out, not a work area.
- No camera RAW, PSD or HEIC import; no E-AC-3.
- Colour grading, keys and export rendering run on the CPU; big footage is slow.
- Windows and Linux are far less tested than macOS; the web build is incomplete.
