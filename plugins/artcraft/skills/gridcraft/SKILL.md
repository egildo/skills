---
name: gridcraft
description: GridCraft is the open-source, pure-Rust Excel alternative from storytold. Use this skill when the user names GridCraft or `gridcraft-cli`, works on `.xlsx` files in GridCraft, or asks to script, automate, convert, evaluate or check spreadsheets with it, including driving the running app over its control port or its MCP server. Generic spreadsheet jobs ("add a formula column", "make an Excel file") trigger it only when the user is working in this app. GridCraft is not Microsoft Excel, and not FigCraft or the other ArtCraft apps.
---

# GridCraft

**Pinned:** GridCraft 0.11.1 (app and CLI), docs tag `v0.11.1`, checked 23 October 2026 on macOS. Measured on the running app.

Two layers, kept apart. GridCraft's docs at the pinned tag and its live command list are the reference for commands, parameters and protocol. This skill holds how to drive it and what was learned by doing. If the two disagree about a command, the docs and the live list win. If the installed version is not the pinned one, say so before relying on anything below.

## What it is

A desktop spreadsheet app with a ribbon, a formula bar and a dependency-graph calculation engine. Every ribbon button, dialog and keystroke is a command that can be run from outside.
Its native format is `.xlsx`. The project calls itself "alpha": the core workflow works end to end, fidelity on real files is still rough.
It is not Excel: macros are kept in `.xlsm` but never run, there is no Power Query and no co-authoring. Do not assume an Excel feature exists; search the live command list.

## The references

- Docs at the tag, no login needed: `curl -sL https://raw.githubusercontent.com/storytold/gridcraft/v0.11.1/docs/<file>`
  - `cli.md`: the subcommand table, then `run` (scripts of commands) and `check` (calc and round-trip fidelity).
  - `control-protocol.md`: the Methods table first.
  - `mcp.md`: the Tools table.
  - `file-format-parity.md`: what each format keeps. `gaps.md`: the "Beta blockers" list.
  - `formula-input.md`: English names and `,` separators in every programmatic call.
- Live command list, with each command's parameters:
  - headless: `gridcraft-cli commands --search <word>` (add `--json` for the whole list);
  - running app: `gridcraft-cli send 7979 engine.commands` (the app's list also has UI-only ids such as `view.theme` and `ui.printSettings` that the CLI list lacks);
  - MCP: the `list_commands` tool. Worksheet functions: `gridcraft-cli functions --search <word>`.
- Release notes: `https://github.com/storytold/gridcraft/releases/tag/v0.11.1`

## Surfaces

- **Headless CLI**, `gridcraft-cli`: one shot, files in, files out. `info`, `cat`, `eval`, `convert`, `check`, and `run --in in.xlsx --cmd 'id={json}' --out out.xlsx`. Pick it whenever the user does not need to watch. It is installed separately: the app bundle holds only the `GridCraft` binary.
- **MCP, headless**: `gridcraft-cli mcp [--in book.xlsx | --sample budget]`. A long session with no window.
- **MCP, attached**: `gridcraft-cli mcp --connect 7979`. Same tools, acting on the app's window; `screenshot` works only here.
- **Control port**: start the app with `--control 7979` (or `GRIDCRAFT_CONTROL_PORT=7979`). Newline-delimited JSON on `127.0.0.1`, one reply line per request. `gridcraft-cli send 7979 <method> '<json>'` sends one request and prints the result; errors go to stderr with exit code 1. Pick it for the UI itself: dialogs, pointer and keys, screenshots.
- No authentication: there is no token, and any local process can drive an app that has a control port open. There is no HTTP API.
- Version rule: `gridcraft-cli version` and `/Applications/GridCraft.app/Contents/MacOS/GridCraft --version` must print the same version. A mismatched pair was not tested; if they differ, say so and take the command list from the surface you drive.

## Driving it

1. Start your own instance; never attach to one the user started. Check the port is free first (`lsof -nP -iTCP:7979 -sTCP:LISTEN` prints nothing), then:
   `open --env GRIDCRAFT_NO_PREFS=1 -n -a /Applications/GridCraft.app --args --control 7979`
   `until nc -z 127.0.0.1 7979; do sleep 0.5; done`
   Note the PID from `lsof -nP -iTCP:7979 -sTCP:LISTEN`. `GRIDCRAFT_NO_PREFS=1` keeps your instance off the user's saved settings.
2. Check the link: `gridcraft-cli send 7979 ui.inspect`. Before any command, `dialog`, `editor` and `backstage` must be `null`; `documents` and `activeDocument` say what is open.
3. Find the target: `gridcraft-cli send 7979 document.inspect` gives `title`, `path`, `dirty`, sheets and the `undo` labels. Commands act on the active document. `file.new` opens a new one and makes it active; `window.activate {"index": N}` switches.
4. Make each logical change one command where one exists: `range.setValues {"range":"A1","values":[[...]]}` writes a whole block as one undo step ("Set Values"). There is no batch call. A script (`automate.newScript` then `automate.runScript`) undoes in one step but leaves traces; see Pitfalls.
   `gridcraft-cli send 7979 engine.execute '{"command":"range.setValues","params":{"range":"A1","values":[["Item","Cost"],["Rent",1200],["Total","=SUM(B2:B2)"]]}}'`
5. Read the result back: `sheet.read {"range":"A1:B3"}` (add `"formatted": true` for displayed text) or `cell.get {"cell":"B3"}`, whose `type` is `error` when a formula failed. Look at it: `ui.screenshot {"path":"/abs/shot.png"}`, then open the PNG.
6. Save where the user says, with an absolute path: `app.save {"path":"/abs/out.xlsx"}`. Only an `.xlsx` save clears `dirty` and becomes the document's file.
7. Quit only your instance, by its port: `gridcraft-cli send 7979 app.quit`, then confirm the PID is gone. Save first: quitting discards unsaved work.

## Asking first

- Tell the user before you start a second instance: its window takes keyboard focus, so what they are typing lands in your document. `open -g` does not always prevent it.
- Any edit or deletion in a document the user already had open, and any command against an instance you did not start.
- Overwriting a saved file: `file.save` with no `path` writes over the document's own file without a prompt.
- `app.quit` and `file.close {"force": true}` on a document with unsaved changes.
- Anything that reaches a server or a device: the Share button and collaboration, `ui.printSubmit` (sends a job to a real printer).
- `automate.trustScripts`, or `runScript` with `"trusted": true`, on a workbook someone else made *(docs, not measured)*.
- Never quit an instance the user started: it may hold unsaved work. Start a second one instead.
- After a transport failure (timeout, dropped connection), read the state with `document.inspect` or `sheet.read` before retrying: the call may have completed.

## Formats

| Format | Open | Save | Caveat |
|---|---|---|---|
| `.xlsx`, `.xlsm` | yes | yes | Native. VBA in `.xlsm` is kept byte for byte, never run. Unmodelled parts (slicers, timelines, data model) are dropped on save. |
| `.xls` | yes | no | Values, formulas, number formats, merges, sizes, names. No fonts, fills, borders or charts. Save as `.xlsx`. |
| `.xlsb`, `.ods` | yes | no | Worksheet values only: formulas come in as their last saved values, formatting is omitted. |
| `.csv`, `.tsv` | yes | export | Saving writes displayed text, not values or formulas. `file.open {"csvAsText": true}` keeps every field as text. |
| `.html` | no | export | One sheet as a table. Opening it reads it as delimited text. |
| `.pdf` | no | export | `gridcraft-cli convert in.xlsx out.pdf`, or `file.saveAs` with a `.pdf` path. |
| `.json` | yes | yes | GridCraft's internal model, not an interchange format. |
| encrypted `.xlsx` | with `password` | no | Opens with its password; saves without one. |

## Pitfalls

**Strings in `range.setValues` are typed input, not text.** `"0012"` becomes 12, `"3/4/2026"` becomes the date serial 46085 (month first, whatever the macOS region), `"50%"` becomes 0.5. Prefix an apostrophe to keep text: `"'0012"` stays `0012`.

**The `range` of `range.setValues` is only the top-left anchor.** A 2×2 array sent with `"range":"A1:A1"` fills A1:B2. The array's shape decides what is overwritten; check it before sending.

**Unknown and misspelled parameters are silently ignored.** `home.bold {"rnage":"A2"}` returns success and bolds the current selection instead. After each command, read back the cells you meant to change.

**Toggle commands toggle.** `home.bold {"range":"A1"}` without `"on"` flips the state, so a second call undoes the first. Pass `"on": true` or `"on": false`.

**An unknown function is not an error.** `cell.set` with `=FOO(1)` exits 0 and stores `#NAME?`. A formula with `;` separators or a bad comma is refused with "There's a problem with this formula". Check the returned value for `#`.

**Values read back in different shapes.** `cell.set` returns `"value": "12"` as a string; `sheet.read` returns `12.0`. Dates come back as serial numbers unless `"formatted": true`.

**A script run leaves extra undo entries.** The first `edit.undo` after `automate.runScript` reverts the whole run ("Run Script"). The next one restores the script's half-done state, not the user's previous step. Undo a script run exactly once.

**Scripts are saved into the workbook.** `automate.newScript` stores the script in a hidden defined name, `_sc_scripts`, which goes into the `.xlsx`. `automate.deleteScript` empties it but leaves the name; `formulas.deleteName {"name":"_sc_scripts"}` removes it.

**Reopening an open file does not reload it.** `file.open` on a path that is already open returns `"alreadyOpen": true` and keeps the copy in memory. Changes made on disk meanwhile are invisible, and the next save overwrites them.

**`file.open` without `path` does nothing over the control port.** It returns `null`, with no dialog and no error. Headless `run` refuses the same call with "programmatic calls never open dialogs". Always pass `path`.

**Saving as CSV, HTML or PDF is an export.** The document stays `dirty` and keeps its `.xlsx` path. The CSV holds displayed text (`3/4/2026`, `50%`) and no formulas.

**Screenshots are in pixels, pointer input in points.** On a Retina screen the PNG is twice the `window` size `ui.inspect` reports, while `ui.click` takes points. Prefer `ui.cell.click {"cell":"D3"}`. A read right after `ui.click` can still show the old selection; read again before acting on it.

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
- Co-authoring and multiple OS windows.
