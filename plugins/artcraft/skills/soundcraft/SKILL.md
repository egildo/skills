---
name: soundcraft
description: SoundCraft is the open-source, pure-Rust Pro Tools alternative from storytold, a digital audio workstation for multitrack audio and MIDI editing, mixing and bouncing. Use it when the user names SoundCraft or `soundcraft-cli`, works with a `.scraft` session, or asks to script, automate, inspect, bounce or convert audio with it, headless or in the running app over MCP or the control port. Generic audio jobs ("mix this", "bounce the stems") trigger it only when the user is working in SoundCraft. It is not Pro Tools, and not the Soundcraft brand of hardware mixing consoles.
---

# SoundCraft

**Pinned:** SoundCraft 0.12.1 (app and CLI), docs tag `v0.12.1`, checked 23 October 2026 on macOS. Measured on the running app.

Two layers, kept apart. SoundCraft's docs at the pinned tag and its live command list are the reference for commands, parameters and protocol. This skill holds how to drive it and what was learned by doing. If the two disagree about a command, the docs and the live list win. If the installed version is not the pinned one, say so before relying on anything below.

## What it is

A DAW in the Pro Tools mould: an Edit window and a Mix window, tracks, clips, playlists, inserts, sends, busses, automation, MIDI and instrument tracks, bounce to file.
Every menu item is a command with an id and JSON parameters, and the menus, the CLI, the control port and MCP all run the same commands.
Native format: `.scraft`, a JSON session with its audio in an `Audio Files/` folder beside it.
The project calls itself "pre-alpha".
It is not Pro Tools: no `.ptx` sessions, no AAF or OMF, no AAX plug-ins.

## The references

- Docs at the tag: `curl -sL https://raw.githubusercontent.com/storytold/soundcraft/v0.12.1/docs/<file>`
  - `control-protocol.md`: the "Methods" table, then "Positions and references".
  - `mcp.md`: the "Tools" table, then "Confining file access".
  - `file-format-parity.md`: the "Audio" and "Sessions and interchange" tables.
  - `gaps.md`: "Ranked gaps".
- README at the tag ("For agents and scripts", "Logs"): `curl -sL https://raw.githubusercontent.com/storytold/soundcraft/v0.12.1/README.md`
- The live command list: `soundcraft-cli commands [FILTER]`, then `soundcraft-cli describe ID` for one command's parameters. That list is the engine only. The running app adds its UI commands (`ui.dock`, `ui.audio_device`, `ui.theme`): ask it with `soundcraft-cli app --port 7801 engine.commands '{"filter":"ui."}'`. Over MCP: `list_commands`.
- Release notes: `https://github.com/storytold/soundcraft/releases/tag/v0.12.1`

## Surfaces

- **Headless CLI** (`soundcraft-cli`): one shot, no window. `run --in S.scraft` (or `--demo`) applies `--cmd 'ID=JSON'` steps, then `--bounce OUT` and `--save S.scraft`. The input file is untouched unless you `--save` over it. `info` probes a file; `convert` changes format or rate. Pick it for a bounce or a batch edit of a session nobody has open.
- **MCP, headless** (`soundcraft-cli mcp`, `--demo` to start from the demo song): a long session on stdio with its own engine. Add `--automation-read-root DIR --automation-write-root DIR` to keep it to given folders *(docs, not measured)*.
- **MCP, attached** (`soundcraft-cli mcp --connect 7801`): the same tools plus `screenshot`, `ui_inspect`, `click`, `drag`, `key` and `menu_invoke`, against an app started with `--control 7801`. Changes show in that window. The roots cannot be combined with `--connect`, and the app is not confined.
- **Control port** (`--control PORT`; `0` picks one and prints `SOUNDCRAFT_CONTROL_PORT=…` on stdout): JSON lines on `127.0.0.1`. From a shell: `soundcraft-cli app --port PORT METHOD_OR_COMMAND_ID 'JSON'`. There is no batch method on the port; use MCP `batch` for that.
- No authentication on the port or MCP, and no token. Never forward the port.
- The CLI is a separate download (`soundcraft-cli-<ver>-macos-universal.zip`); the app bundle holds only `SoundCraft`. No method reports the app's version over the port, so compare `soundcraft-cli --version` with `/Applications/SoundCraft.app/Contents/MacOS/SoundCraft --version` before you start. What a mismatch breaks was not measured; do not mix versions.

## Driving it

1. Start your own instance with an isolated profile and no audio output:
   `open -n -a /Applications/SoundCraft.app --env SOUNDCRAFT_CONFIG_DIR="$SCRATCH/sc-config" --args --no-audio --control 7801`
   Wait with `until nc -z 127.0.0.1 7801; do sleep 0.5; done`, then run `lsof -nP -iTCP:7801 -sTCP:LISTEN` and check the listener is `SoundCraft`. Keep its PID.
2. Check the link: `soundcraft-cli app --port 7801 ui.inspect`. Always pass `--port`.
3. Know the document: `soundcraft-cli app --port 7801 session.inspect` gives `name`, `path`, `dirty`, `selection` and `undo`. In your own instance, start clean with `session.new '{"name":"work","template":"blank"}'` (or `"demo"`).
4. Spell each parameter from `soundcraft-cli describe ID`, and name the target explicitly (`"track":"Bass"`, clip ids from `session.inspect`). Positions: integer samples or `{"seconds": 2.5}`.
5. Make the change. One command per call on the port, or many through MCP `batch` (`soundcraft-cli mcp --connect 7801`). Each command is its own undo step: `engine.history` lists them, `edit.undo` reverts one.
6. Look: read `session.inspect` back, and take `ui.screenshot '{"path":"/abs/shot.png"}'` and read the PNG.
7. Write with absolute paths: `file.bounce_mix '{"path":"/abs/mix.wav","start":0,"end":{"seconds":30}}'`, then check `seconds` and `peak_db` in the reply and run `soundcraft-cli info /abs/mix.wav`. `session.save '{"path":"/abs/dir/name.scraft"}'` writes `Audio Files/` beside it.
8. Quit only your PID: confirm `lsof -nP -iTCP:7801 -sTCP:LISTEN -t` is it, then `soundcraft-cli app --port 7801 app.quit`.

## Asking first

- Tell the user before you start a second instance: its window takes keyboard focus, so what they are typing lands in your document. `open -g` does not always prevent it.
- Any edit in a session the user already had open, in their own window.
- `session.new`, `session.open`, `session.close` and `app.quit` in an instance you did not start: they drop unsaved work without a prompt.
- Overwriting a file: `session.save` with `"replace": true`, and any `file.bounce_mix` or export to a path that exists.
- Arming a track, input monitoring or recording: they open the microphone. Also `ui.audio_device`, which changes the user's saved device choice.
- Loading third-party plug-ins (`engine.clap_plugins`, `engine.vst3_plugins` with `rescan`): native code runs in the app's process.
- Anything that reaches a server. This version has no collaboration, cloud or AI generation; if a command would go online, ask.
- Never quit an instance the user started; start a second one on another port. After a transport failure, read `session.inspect` and `engine.history` before retrying: the call may have completed.

## Formats

| Format | Open | Write | Caveat |
|---|---|---|---|
| `.scraft` + `Audio Files/` | yes | yes | Imported audio is copied into `Audio Files/` on save. Saving over the session's own file keeps a copy in `Backups/`. |
| WAV/BWF/RF64, AIFF, FLAC | yes | yes | Bounce bit depth 16, 24 or `32f`. |
| MP3, AAC/M4A, ALAC, Ogg Vorbis, CAF, movie audio | yes | no | `file.bounce_mix` to `.mp3` is refused. Convert to WAV elsewhere. |
| Standard MIDI File | yes | yes | Export may drop imported controllers *(docs, not measured)*. |
| MusicXML, SVG score | no | yes | Export only *(docs, not measured)*. |
| H.264, ProRes, Motion JPEG movies | yes | no | Picture for reference only; no video export *(docs, not measured)*. |
| `.ptx`, AAF, OMF, ADM BWF | no | no | No Pro Tools interchange at this version. |

## Pitfalls

- **Unknown keys are ignored, and the command falls back to the selection.** `mix.volume '{"trak":"Pad","db":-22}'` succeeded and changed the selected Kick track; `"bitdepth":"16"` bounced 24-bit. Copy key names from `describe` and read the result back.
- **A bare string position is Bars|Beats, not seconds.** `"2.5"` landed on bar 3 (bar 2, beat 5). Use `{"seconds": 2.5}`, integer samples, or a prefixed string like `"min_secs:0:02.500"`. Fractional samples round. On the CLI, `run --start 2.5` is seconds.
- **MCP `batch` is neither one undo step nor atomic.** Each call is its own `engine.history` entry. A failing call stops the batch, and the calls before it stay applied. Undo once per applied call.
- **`session.new`, `session.open` and `app.quit` throw away unsaved changes.** No prompt, no dialog, and the Autosave folder stayed empty. Check `dirty` in `session.inspect` and save first.
- **Relative paths resolve against the app's working directory.** Launched with `open`, that is `/`, and a bounce fails with `Read-only file system`. Launched from a shell, files land in that shell's directory. Pass absolute paths.
- **`file.bounce_mix` overwrites without asking, and `format` beats the extension.** An existing file is replaced silently (unlike `session.save`). `"path":"mix.wav","format":"flac"` writes FLAC data into `mix.wav`, and a path with no extension gets none.
- **An empty bounce succeeds.** A session or range with nothing in it returns ok with a 110-byte file and `peak_db` of `-144`. Check `seconds` and `peak_db` before you report success.
- **`file.export_clips` ignores `format`.** `"aiff"` and `"mp3"` both wrote `.wav` files with no error. Convert afterwards with `soundcraft-cli convert`.
- **`soundcraft-cli app` without `--port` goes to `7979`** (or `$SOUNDCRAFT_CONTROL_PORT`), which may be someone else's instance. Always pass `--port`.
- **A taken port does not stop the app.** A second instance with `--control` on a busy port opens its window with no control server; only the log shows `failed to bind`. Your commands then reach the first instance. And `nc -z` succeeds for any listener, so confirm with `lsof` that it is SoundCraft.
- **`open -a` without `-n` starts nothing new.** With SoundCraft already running, it activates that instance and drops `--args` and `--env` ("already running"). Always use `open -n`.
- **Screenshots are in pixels, clicks are in points.** On a Retina screen the PNG is twice `window_size` from `ui.inspect`. Divide screenshot coordinates by the ratio before `ui.click`.
- **`ui.screenshot` sometimes fails with `no frame was presented (is the window visible?)`.** It happens now and then on a visible window. Retry after a second before you debug.

## Not there yet

- No MIDI hardware input or output: no recording from a keyboard, no MIDI clock.
- No `.ptx`, AAF or OMF exchange with Pro Tools.
- No MP3, AAC or Ogg export.
- No hardware channel routing (I/O Setup), no duplex low-latency path, no control surfaces, no external sync.
- No video export, no Dolby Atmos or ADM delivery.
- English only.
- No way to group several commands into one undo step, and no version query over the port.
