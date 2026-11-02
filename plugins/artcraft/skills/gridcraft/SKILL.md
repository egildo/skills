---
name: gridcraft
description: GridCraft is the open-source, pure-Rust Excel alternative from storytold. Use this skill when the user names GridCraft or `gridcraft-cli`, works on `.xlsx` files in GridCraft, or asks to script, automate, convert, evaluate or check spreadsheets with it, including driving the running app over its control port or its MCP server. Generic spreadsheet jobs ("add a formula column", "make an Excel file") trigger it only when the user is working in this app. GridCraft is not Microsoft Excel, and not FigCraft or the other ArtCraft apps.
---

# GridCraft

**Pinned:** GridCraft 0.15.0 (app and CLI), docs tag `v0.15.0`, checked 2 November 2026 on macOS. Measured on the running app.

Two layers, kept apart. GridCraft's docs at the pinned tag and its live command list are the reference for commands, parameters and protocol. This skill holds how to drive it and what was learned by doing. If the two disagree about a command, the docs and the live list win. If the installed version is not the pinned one, say so before relying on anything below.

## What it is

A desktop spreadsheet app with a ribbon, a formula bar and a dependency-graph calculation engine. Every ribbon button, dialog and keystroke is a command that can be run from outside.
Its native format is `.xlsx`. The project calls itself "alpha": the core workflow works end to end, fidelity on real files is still rough.
It is not Excel: VBA in `.xlsm` is kept but never run (its own macros are typed lists of GridCraft commands), there is no Power Query and no co-authoring. Do not assume an Excel feature exists; search the live command list.

## The references

- Docs at the tag, no login needed: `curl -sL https://raw.githubusercontent.com/storytold/gridcraft/v0.15.0/docs/<file>`
  - `cli.md`: the subcommand table, then `run` (scripts of commands) and `check` (calc and round-trip fidelity).
  - `control-protocol.md`: "Authentication", then the Methods table and "Windows".
  - `mcp.md`: the Tools table.
  - `file-format-parity.md`: what each format keeps. `gaps.md`: the "Beta blockers" list.
  - `formula-input.md`: English names and `,` separators in every programmatic call.
  - `macros.md`: "Running" (policy, footprint, one undo step), then "Other commands and storage".
- Live command list, with each command's parameters:
  - headless: `gridcraft-cli commands --search <word>` (add `--json` for the whole list);
  - running app: `gridcraft-cli send 7979 engine.commands` (the app's list also has UI-only ids such as `view.theme` and `ui.printSettings` that the CLI list lacks);
  - MCP: the `list_commands` tool. Worksheet functions: `gridcraft-cli functions --search <word>`.
- Release notes: `https://github.com/storytold/gridcraft/releases/tag/v0.15.0`

## Surfaces

- **Headless CLI**, `gridcraft-cli`: one shot, files in, files out. `info`, `cat`, `eval`, `convert`, `check`, and `run --in in.xlsx --cmd 'id={json}' --out out.xlsx`. Pick it whenever the user does not need to watch. It is installed separately: the app bundle holds only the `GridCraft` binary.
- **MCP, headless**: `gridcraft-cli mcp [--in book.xlsx | --sample budget]`. A long session with no window.
- **MCP, attached**: `gridcraft-cli mcp --connect 7979`. Same tools, acting on the app's window; `screenshot` works only here. `list_windows` gives ids; most tools take `window` or `doc` to act there without bringing it forward.
- **Control port**: start the app with `--control 7979` (or `GRIDCRAFT_CONTROL_PORT=7979`). Newline-delimited JSON on `127.0.0.1`, one reply line per request. `gridcraft-cli send 7979 <method> '<json>'` sends one request and prints the result; errors go to stderr with exit code 1. Pick it for the UI itself: dialogs, pointer and keys, screenshots.
- Authentication is always on. The app makes a token at start and writes it to `~/.cache/gridcraft/control-<port>.token` (mode 0600; `$XDG_RUNTIME_DIR/gridcraft/` when that is set). `gridcraft-cli send` and `mcp --connect` read it themselves. Your own client sends `{"id":0,"method":"auth","params":{"token":"…"}}` as its first line; anything else gets `authentication required` and the connection closes. `GRIDCRAFT_CONTROL_TOKEN` (at least 16 characters) sets the token instead. There is no HTTP API.
- Version rule: `gridcraft-cli version` and `/Applications/GridCraft.app/Contents/MacOS/GridCraft --version` must print the same version. A mismatched pair was not tested; if they differ, say so and take the command list from the surface you drive.

## Driving it

1. Start your own instance; never attach to one the user started. Other apps also use 7979: pick a port `lsof -nP -iTCP:<port> -sTCP:LISTEN` shows free, then:
   `open --env GRIDCRAFT_NO_PREFS=1 --env CRAFT_VERSIONS_FILE=/tmp/gc-versions.json -n -g -a /Applications/GridCraft.app --args --control 7979`
   `until nc -z 127.0.0.1 7979; do sleep 0.5; done`, then run `lsof` again: the listener must be `GridCraft`; note its PID. `GRIDCRAFT_NO_PREFS=1` keeps your instance off the user's saved settings. The app checks GitHub for updates at start and may open an update prompt; write `{"apps":{"gridcraft":{"Pinned":"<version>"}}}` to the `CRAFT_VERSIONS_FILE` first and it skips that check (source at the tag).
2. Check the link: `gridcraft-cli send 7979 ui.inspect`. Before any command, `dialog`, `editor` and `backstage` must be `null`; `windows` and `activeWindow` say what is open.
3. Find the target: `gridcraft-cli send 7979 document.inspect` gives `title`, `path`, `dirty`, sheets and the `undo` labels (newest first). Commands act on the active window. `file.new` opens a workbook in a new native window and makes it active; `window.list` gives each window's `window` and `doc` ids; add `"doc": N` or `"window": N` next to `command` in `engine.execute` to act there without switching.
4. Make each logical change one undo step. One block of cells: `range.setValues {"range":"A1","values":[[...]]}` ("Set Values"):
   `gridcraft-cli send 7979 engine.execute '{"command":"range.setValues","params":{"range":"A1","values":[["Item","Cost"],["Rent",1200],["Total","=SUM(B2:B2)"]]}}'`
   Several commands: `macro.save {"macro":{"name":"M","steps":[{"type":"command","id":"cell.set","params":{...}}, ...]}}`, then `macro.run {"name":"M"}`: one undo step ("Run Macro: M"), rolled back whole on any error. Then `macro.delete {"name":"M"}`, or it is saved into the workbook. Prefer macros to `automate.*` scripts; see Pitfalls.
5. Read the result back: `sheet.read {"range":"A1:B3"}` (add `"formatted": true` for displayed text) or `cell.get {"cell":"B3"}`, whose `type` is `error` when a formula failed. Look at it: `ui.screenshot {"path":"/abs/shot.png"}`, then open the PNG.
6. Save where the user says, with an absolute path: `app.save {"path":"/abs/out.xlsx"}`. Only an `.xlsx` save clears `dirty` and becomes the document's file.
7. Quit only your instance, by its port, after `lsof` shows your PID on it: `gridcraft-cli send 7979 app.quit`, then confirm the PID is gone. Save first: quitting discards unsaved work.

## Asking first

- Tell the user before you start a second instance: its window takes keyboard focus, so what they are typing lands in your document. `open -g` does not always prevent it.
- Any edit or deletion in a document the user already had open, and any command against an instance you did not start.
- Overwriting a saved file: `file.save` with no `path` writes over the document's own file without a prompt.
- `app.quit` and `file.close {"force": true}` on a document with unsaved changes.
- Anything that reaches a server or a device: the Share button and collaboration, `ui.printSubmit` (sends a job to a real printer).
- `automate.trustScripts`, `runScript` with `"trusted": true`, or `macro.run` with `"approve": true`, on a workbook someone else made: its macros and scripts would run *(docs, not measured)*.
- The update prompt, and Help › Check for Updates: Update and Restart downloads and installs a new version.
- Never quit an instance the user started: it may hold unsaved work. Start a second one instead.
- After a transport failure (timeout, dropped connection), read the state with `document.inspect` or `sheet.read` before retrying: the call may have completed.

## Formats

| Format | Open | Save | Caveat |
|---|---|---|---|
| `.xlsx`, `.xlsm` | yes | yes | Native. VBA in `.xlsm` is kept byte for byte, never run. Unmodelled parts (slicers, timelines, data model) are dropped on save. |
| `.xls` | yes | no | Values, formulas, number formats, cell formatting (fonts, fills, borders, alignment), merges, sizes, names. Colours snap to the 56-colour palette; no charts, pictures, comments or conditional formats. Save as `.xlsx`. |
| `.xlsb`, `.ods` | yes | no | Worksheet values only: formulas come in as their last saved values, formatting is omitted. |
| `.csv`, `.tsv` | yes | export | Saving writes displayed text and no formulas; `file.exportCsv {"path":…,"values":true}` writes raw values and ISO dates. Opening picks day or month first per column from dates that read only one way. `file.open {"csvAsText": true}` keeps every field as text. |
| `.html` | no | export | One sheet as a table. Opening it reads it as delimited text. |
| `.pdf` | no | export | `gridcraft-cli convert in.xlsx out.pdf`, or `file.saveAs` with a `.pdf` path. |
| `.json` | yes | yes | GridCraft's internal model, not an interchange format. |
| encrypted `.xlsx` | with `password` | no | Opens with its password; saves without one. |

## Pitfalls

**Strings in `range.setValues` are typed input by default.** `"0012"` becomes 12, `"3/4/2026"` the date serial 46085 (month first, whatever the macOS region), `"50%"` 0.5. The reply's `converted` lists each one. Pass `"parse": false` to store strings as text (formulas still need `=`), or prefix one string with an apostrophe.

**The `range` of `range.setValues` is only the top-left anchor.** A 2×2 array sent with `"range":"A1:A1"` fills A1:B2. The array's shape decides what is overwritten; check it before sending.

**Unknown and misspelled parameters are silently ignored.** `home.bold {"rnage":"A2"}` returns success and bolds the current selection instead. After each command, read back the cells you meant to change.

**Toggle commands toggle.** `home.bold {"range":"A1"}` without `"on"` flips the state, so a second call undoes the first. Pass `"on": true` or `"on": false`.

**An unknown function is not an error.** `cell.set` with `=FOO(1)` exits 0 and stores `#NAME?`. A formula with `;` separators or a bad comma is refused with "There's a problem with this formula". Check the returned value for `#`.

**Values read back in different shapes.** `cell.set` returns `"value": "12"` as a string; `sheet.read` returns `12.0`. Dates come back as serial numbers unless `"formatted": true`.

**A script run leaves extra undo entries.** The first `edit.undo` after `automate.runScript` reverts the whole run ("Run Script"). The next one restores the script's half-done state, not the user's previous step. Undo a script run exactly once, or use a macro, which leaves one clean entry.

**Scripts are saved into the workbook.** `automate.newScript` stores the script in a hidden defined name, `_sc_scripts`, which goes into the `.xlsx`. `automate.deleteScript` empties it but leaves the name; `formulas.deleteName {"name":"_sc_scripts","force":true}` removes it (without `force` it is refused). `macro.delete` leaves nothing behind.

**Reopening an open file does not reload it.** `file.open` on a path that is already open returns `"alreadyOpen": true` and keeps the copy in memory. Changes made on disk meanwhile are invisible, and the next save overwrites them.

**`file.open` without `path` opens the native Open panel and freezes the control port.** It returns `null`, then every call fails with "not reachable: Resource temporarily unavailable" until someone dismisses the panel in the window. Headless `run` refuses the same call ("programmatic calls never open dialogs"). Always pass `path`.

**Saving as CSV, HTML or PDF is an export.** The document stays `dirty` and keeps its `.xlsx` path. A CSV from `file.saveAs` holds displayed text (`3/4/2026`, `50%`) and no formulas.

**Screenshots are in pixels, pointer input in points.** On a Retina screen the PNG is twice the `window` size `ui.inspect` reports, while `ui.click` takes points. Prefer `ui.cell.click {"cell":"D3"}`.

**A busy port does not stop the app.** Started on a port another app holds, it opens with no control channel and says so only on stderr; `nc -z` then succeeds against the other app. Check that `lsof` names `GridCraft` before sending anything.

**`app.quit` discards unsaved work without asking.** It quit an instance holding a dirty workbook with no prompt. Save, or confirm with the user, first.

**The docs' `gridcraft` command does not exist on macOS.** The docs and the CLI's own error hint say `gridcraft --control 7979`; the installed binary is `/Applications/GridCraft.app/Contents/MacOS/GridCraft` and nothing named `gridcraft` is on the PATH. Use `open -n -a /Applications/GridCraft.app --args --control 7979`.

## Not there yet

- Proof that its `.xlsx` output opens in Excel without a repair prompt: the project says it is unverified.
- Large workbooks: recalculation is single-threaded, and very large files may not open.
- Saving `.xls`, `.xlsb`, `.ods`, or a password-protected workbook.
- Running VBA macros; Office Scripts; add-ins.
- Power Query, the data model, external data refresh.
- Slicers and timelines in saved files; 3-D charts.
- Complex text shaping and right-to-left text (Arabic, Devanagari, Thai).
- Co-authoring; Arrange All across monitors.
