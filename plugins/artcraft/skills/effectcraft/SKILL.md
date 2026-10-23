---
name: effectcraft
description: EffectCraft is the open-source, pure-Rust After Effects alternative from storytold, a compositor with comps, layers, keyframes, effects, expressions and a render queue. It applies when the user mentions EffectCraft, `effectcraft-cli`, `.ecproj` or `.ecprojx` files, or its MCP server or control port, or asks to script, automate, render or convert with it. Generic motion jobs ("animate this title", "render a ProRes") trigger it only when the user is working in EffectCraft. It is not After Effects and does not open `.aep` files. FilmCraft is its sibling video editor, not this app.
---

# EffectCraft

**Pinned:** EffectCraft 0.16.0 (app and CLI), docs tag `v0.16.0`, checked 23 October 2026 on macOS. Measured on the running app.

Two layers, kept apart. EffectCraft's docs at the pinned tag and its live command list are the reference for commands, parameters and protocol. This skill holds how to drive it and what was learned by doing. If the two disagree about a command, the docs and the live list win. If the installed version is not the pinned one, say so before relying on anything below.

## What it is

- A motion graphics and compositing app in the After Effects mould: compositions, layers, keyframes, effects, layer styles, expressions, Classic and Advanced 3D, tracking, roto and a render queue.
- Native format: `.ecproj` (versioned JSON). `.ecprojx` is an XML copy of the same project.
- Maturity, in the project's own words: "alpha", "young and moving fast".
- Every action is an engine command with an id and JSON params. Menus, the CLI, MCP and the control port all run the same commands.
- It is not After Effects. It has no `.aep` reader, does not run After Effects plug-ins and does not read `.ffx` presets or `.mogrt` templates.

## The references

- Docs at the tag: `curl -sL https://raw.githubusercontent.com/storytold/effectcraft/v0.16.0/docs/<file>`.
  - `agents.md`: read *A typical session*, *Pitfalls* and *CLI* first, then the cookbooks for the task in hand.
  - `control-protocol.md`: the *Engine* table, then *UI state* and *Screenshots*.
  - `mcp.md`: the core tools, strict arguments, *Progress and cancellation*.
  - `file-format-parity.md` (what opens and what is written), `gaps.md` (what is missing), `preferences.md` (*Auto-save and crash recovery*).
- Live command list: `effectcraft-cli commands --filter <word>`. For one command in full: `effectcraft-cli exec command.describe --params '{"command":"<id>"}' --empty --json`. Against the running app: `engine.commands {filter}` on the control port. Never guess a parameter name.
- Release notes: `https://github.com/storytold/effectcraft/releases/tag/v0.16.0`.

## Surfaces

- **Headless CLI** (`effectcraft-cli exec|run|get|set|props|render-frame|render`). One shot, files in, files out, no window. Each call is a fresh session: pass `--empty` or a project, and add `--save` or `--save-as F` or nothing is kept. Use it for batch jobs and renders that need no window.
- **MCP headless** (`effectcraft-cli mcp`). A long session with no window. It starts with an empty project and renders on the CPU unless you add `--gpu`. Add `--autosave` for checkpoints, and `--automation-read-root` / `--automation-write-root` to confine file access.
- **MCP bridged** (`effectcraft-cli mcp --bridge 9877`). Drives a running app, so changes show in its window. It adds `screenshot` and the `ui_*` tools.
- **Control port** (`EffectCraft --control 9877`, or `EFFECTCRAFT_CONTROL_PORT`). One JSON object per line on 127.0.0.1, sent with `printf '<json>\n' | nc 127.0.0.1 9877`. It has no authentication and no token. `effectcraft-cli exec|run|render-frame ... --bridge 9877` sends engine commands through it.
- CLI bridge mode refuses `--project` and `--demo`, and `render` refuses `--bridge` (use `renderQueue.add` and `renderQueue.render` instead).
- On macOS the CLI is a separate download: the `.app` holds only the desktop app. Compare `effectcraft-cli --version` with `/Applications/EffectCraft.app/Contents/MacOS/EffectCraft --version`. Headless work runs the CLI's own engine, so a mismatched pair saves and renders with a different version from the app's. The docs state no rule for mismatched versions, so stop and say so when the two differ.

## Driving it

1. **Start your own instance with a port.** If the user's instance is running, leave it alone. Start a second one with its own settings folder: `open -n -a /Applications/EffectCraft.app --env EFFECTCRAFT_CONFIG_DIR=<scratch>/ec-config --args --control 9877`. Then wait with `until nc -z 127.0.0.1 9877; do sleep 0.5; done`.
2. **Check the link and who answers.** Run `lsof -nP -iTCP:9877 -sTCP:LISTEN`: the PID must be the instance you just started. Then send `{"id":1,"method":"engine.execute","params":{"command":"project.summary"}}`. The reply gives `path`, `dirty`, `activeComp`, `items` and the `undo` list.
3. **Name the target in every call.** There is one project per process. Commands fall back to the active comp and the selected layers, so pass `comp` and `layer`/`layers` every time.
4. **Make one undo step per logical change** with `engine.batch`: `effectcraft-cli exec engine.batch '{"label":"Title card","steps":[{"command":"comp.new","params":{...}},{"command":"layer.newText","params":{...}}]}' --bridge 9877 --json`. Use `"$1.layer"` to pass step 1's result to a later step. If a step fails, the whole batch is rolled back. Keep the ids the reply returns.
5. **Look at the result.** `render.frame {"comp":..,"time":..,"max_side":640,"path":"<scratch>/f.png"}` renders the comp. `ui.screenshot {"path":..,"panel":"Timeline"}` captures the window. Read the PNGs. Read values back with `prop.get {layer, path, time?}`.
6. **Render.** Run `renderQueue.add {"comp":..,"format":"h264","output":"<abs path>","timeSpan":"comp"}`, then `renderQueue.render {"wait":true}`. Check the file with `ffprobe` and read each item's status.
7. **Save** with `file.saveAs {"path":"<abs path>"}`. A first `file.save` without a path fails; no dialog ever opens.
8. **Quit only your instance.** Check the PID behind the port again, then send `app.quit {"force":true}`. Without `force`, a dirty project raises the Save / Don't Save prompt (`dialog.unsaved.dontSave` to dismiss it).

## Asking first

- Tell the user before you start a second instance: its window takes keyboard focus, so what they are typing lands in your document. `open -g` does not always prevent it.
- Get the user's yes before attaching to, editing in or quitting an instance they started; it may hold unsaved work. Start a second instance instead.
- Ask before `file.open`, `open_project` or `file.newProject` while the project is dirty: they discard it without a prompt.
- Ask before overwriting a saved project or an existing render output. Both are replaced silently (see Pitfalls).
- Ask before anything that reaches a server. That includes `roto.model.download` and `face.model.download` (they fetch model weights) and turning on the scripting preference that allows network access.
- After a transport failure, read `project.summary` (the `undo` list) before retrying: the call may have completed.

## Formats

| Format | Open | Write | Caveat |
|---|---|---|---|
| `.ecproj` | yes | yes | Native. Footage paths are stored, not media. |
| `.ecprojx` | yes | `file.saveCopyAsXml` | Same data as XML. |
| `.aep`, `.aepx`, `.mogrt`, `.ffx` | no | no | Rebuild the work, or script it in through `.jsx`. |
| `.jsx` scripts | run | no | After Effects object model. No `.jsxbin`. |
| Lottie `.json`, `.lottie` | `file.importLottie` | `file.exportLottie` | Read the `warnings`: most effects, 3D and video are dropped. A plain `file.import` of `.json` brings it in as data, not Lottie. |
| FCP7 XML, FCPXML, OTIO, EDL, AAF, OMF | `file.importTimeline` | `file.exportTimeline` | Layers a timeline cannot hold are pre-rendered to ProRes 4444. No `.prproj`. |
| PSD, AI, PDF, EPS, SVG | import | PSD as single-frame layers | AI, PDF and EPS are partial *(docs, not measured)*. |
| Render outputs | | H.264, HEVC, AV1, ProRes, uncompressed MOV, WebM, PNG/JPEG/TIFF/EXR sequences, GIF, WAV, AIFF | No MXF, AVI, DNxHR, DPX or Targa output. |

## Pitfalls

- **A busy port does not stop the app.** A second instance started on a port another instance holds opens its window anyway, with no control port. The error appears only in its log ("control server failed to bind"). `nc -z` then succeeds against the *other* instance. Always match the `lsof` PID before sending anything.
- **A second instance shares the user's settings.** Without `EFFECTCRAFT_CONFIG_DIR`, your saves join the user's Open Recent list and each launch rotates their logs. With it set, settings, logs and shortcuts stay in your folder.
- **The name you ask for is not always the name you get.** `layer.newSolid {"name":"Title"}` beside an existing "Title" creates "Title 2". A later `"layer":"Title"` then hits the old layer. Address layers by the id the reply returns.
- **An omitted target means the selection.** `effect.apply {"effect":"Gaussian Blur"}` with no `layers` applied the effect to whatever was selected. In a live window, that selection is the user's.
- **`prop.set` on an animated property edits a keyframe.** Without `time`, it overwrote the key at the current time and left the other keys in place. Pass `time`, or clear the keys first if you want a static value.
- **Out-of-range values are clamped, not refused.** Opacity 150 came back as 100 and blurriness -5 as 0, both with `ok: true`. Opacity is 0 to 100, so 0.5 means half a percent. Position reads back with three values even on a 2D layer. Read the returned value.
- **A time outside the comp renders black without an error.** `render.frame {"time":5}` on a 1-second comp returned `ok: true` and an all-black frame. Check the time against `comp.info`'s `duration`.
- **`render.frame` without `path` reuses one temp file.** Every call writes the same `effectcraft-frame-<pid>.png`. Pass a path per frame.
- **The queue renders the work area; the CLI renders the whole comp.** With the work area at 0–0.5 s, `renderQueue.add` queued 15 frames at 30 fps, while `effectcraft-cli render --comp` wrote the full comp. Set `timeSpan` (or the CLI's `--work-area`) explicitly.
- **Renders and Save As overwrite silently.** A second render to the same `output` and a `file.saveAs` onto an existing file both replaced it without asking. Run `test -e` first.
- **H.264 drops an odd row and column.** A 321×181 comp came out 320×180, reported only in a line on stderr. Use even sizes or check with `ffprobe`.
- **A finished queue item does not render again.** A second `renderQueue.render` fails with "nothing is queued". Add the item again.
- **The headless CLI starts from the demo project.** Without `--empty`, `exec comp.new ... --save-as new.ecproj` saved the demo's comps and solids too.
- **`effect.apply` takes no values.** It accepts only `effect` and `layers`/`layer`, and rejects `values`. Set parameters with `prop.set` on the `paths` it returns, or use MCP `add_effect`, which takes `values`.
- **A menu invocation can leave a modal dialog open.** `ui.menu.invoke {"id":"comp.new"}` opens Composition Settings. Engine commands keep running behind the dialog, and `ui.inspect` shows it as `dialog`. Close it with `ui.key {"key":"Escape"}`. Use `engine.execute` for edits.

## Not there yet

- No `.aep`, `.aepx`, `.mogrt` or `.ffx`. No After Effects plug-ins; only WebAssembly effect plug-ins.
- No `.prproj`, USD/USDZ, Substance materials, camera raw, HEIF/AVIF, BRAW or R3D.
- No hardware video encode or decode. No safe render over an existing file.
- Fidelity against After Effects is mostly unmeasured, so never promise an identical render.
