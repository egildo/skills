---
name: pdfcraft
description: PdfCraft is the open-source, pure-Rust Acrobat alternative from storytold, a PDF reader and editor with a headless CLI, an opt-in MCP server and a UI control channel. It applies when the user names PdfCraft or `pdfcraft-cli`, or asks to script, automate, render, convert, OCR, compress or batch-process PDFs with it. Generic PDF jobs ("merge these PDFs", "fill this form") trigger it only when the user is working in PdfCraft. It is not Adobe Acrobat and not another Craft app such as PrintCraft or FigCraft.
---

# PdfCraft

**Pinned:** PdfCraft 0.13.0 (app and CLI), docs tag `v0.13.0`, checked 23 October 2026. From the docs and source at the tag: not measured.

Two layers, kept apart. PdfCraft's docs at the pinned tag and its live command list are the reference for commands, parameters and protocol. This skill holds how to drive it and what was learned by doing. If the two disagree about a command, the docs and the live list win. If the installed version is not the pinned one, say so before relying on anything below.

## What it is

A desktop PDF workbench: view, search, organize, combine and split, comment, fill and author forms, redact, protect, sign, OCR, export. Native format: PDF itself. There is no project file, and edits stay in memory until saved. The project calls itself "alpha". It runs on macOS, Windows, Linux, FreeBSD and the web. It is not Acrobat: no Acrobat plugins, no `.sequ` action files, no Office import.

## The references

- Docs at the tag (no login needed): `curl -sL https://raw.githubusercontent.com/storytold/pdfcraft/v0.13.0/<file>`
  - `README.md`: read "Built for agents, too" and "Driving the app itself" first.
  - `docs/mcp.md`: "Confining file access" and "Tools".
  - `crates/automation/README.md`: "Conventions" (1-based pages, top-left origin in points), "Common command tools".
  - `docs/cli-batch.md`: folder conversion, OCR and compression.
  - `docs/file-format-parity.md` and `docs/gaps.md`: what each format keeps, what is missing.
- Live command list: `pdfcraft-cli tools` (every tool with its JSON Schema), `pdfcraft-cli --help`; in MCP, `command_list` or `tools/list`; on the control channel, `pdfcraft-cli ui --control FILE commands`.
- Release notes: `https://github.com/storytold/pdfcraft/releases/tag/v0.13.0`

## Surfaces

- **Headless CLI subcommands.** `info`, `render`, `text`, `edit`, `combine`, `extract`, `split`, `check`, `audit`, `batch`. One shot, files in, files out, no auth. Right for a single conversion or a quick read.
- **`pdfcraft-cli run`.** The full tool table without a server: `run <tool> key=value` or `run --script steps.json [--root DIR] [--report]`. One process is one session. Right for a scripted edit-and-save.
- **MCP server, headless.** `pdfcraft-cli mcp [--compact] [--root DIR] [--automation-read-root DIR] [--automation-write-root DIR]`. JSON-RPC over stdio, no port, stops on EOF. No auth: confinement comes from the root flags. Right for a long agent session over files.
- **MCP attached to a running app.** Does not exist. `pdfcraft-cli mcp` always runs its own session: nothing it does shows in, or touches, a window.
- **UI control channel.** Start the app with `--control FILE`. It listens on `127.0.0.1` on a random port and writes `{"port", "token", "pid"}` to FILE with mode 600. The wire format is newline-delimited JSON-RPC 2.0. The first request must be `auth` with `{"token": ...}` within 10 s, or the connection closes. The client is `pdfcraft-cli ui --control FILE <method> [key=value ...] [--out shot.png]`, which authenticates for you. It works at the UI level only (`state`, `inspect`, `click`, `focus`, `type`, `key`, `drag`, `move`, `command`, `commands`, `set`, `open`, `screenshot`, `resize`, `quit`, `dock`), not through the document tools. Right when the user must see the change in a window.
- **Version rule.** The CLI must match the app. Nothing checks it: the control file carries no version, and the handshake checks only the token. A mismatched CLI gets `unknown method` errors, or parameters handled the old way. Compare `/Applications/PdfCraft.app/Contents/MacOS/PdfCraft --version` with `pdfcraft-cli --version`. On macOS the CLI is a separate release zip (`pdfcraft-cli-<ver>-macos-universal.zip`): the `.app` holds only the desktop app.

## Driving it

1. Check both versions (commands above). If either is missing or differs from 0.13.0, say so.
2. For work on files, open, edit and save in one session: a `run --script` file of `[{"tool": "doc_open", "args": {"path": "/abs/in.pdf"}}, ..., {"tool": "doc_save", "args": {"doc": 1, "path": "/abs/out.pdf"}}]`, run with `--root DIR --report`; or the same calls over MCP.
3. For work the user should watch, start your own instance: `/Applications/PdfCraft.app/Contents/MacOS/PdfCraft --control ~/.pdfcraft-control.json &`. Keep the file in a folder only the user can write, never `/tmp`. With `--control` the launch never hands off to a running PdfCraft.
4. Check the link: `pdfcraft-cli ui --control ~/.pdfcraft-control.json state`. Read which documents are open and which is active before any input.
5. Make each logical change as one undoable step where a tool offers it: `form_set_props` with `fields` and `object_move` are atomic. `command_batch` is not (see Pitfalls).
6. Look at the result and read it: `render_preview {"doc": 1, "page": 1, "max_side": 1024}`, `pdfcraft-cli render out.pdf --page 1 --out p1.png`, `pdfcraft-cli text out.pdf --page 1`; for the window, `ui ... screenshot --out window.png`.
7. Save where the user says. `doc_save` to the same path appends an incremental update. To a new path it writes the whole file. Both writes are atomic.

## Asking first

- Tell the user before you start a second instance: its window takes keyboard focus, so what they are typing lands in your document. `open -g` does not always prevent it.
- Editing a document the user already has open, or saving over any file the user owns. Saving in place still changes the file.
- `set` keys that are saved preferences (`theme`, `default-mode`, the `default-*` view keys). They change the user's app beyond this session.
- Redaction, sanitizing and flattening, which cannot be taken back once saved. Signing, creating a digital ID or trusting a certificate (`sign_document`, `sign_id_create`, `sign_trust`).
- `doc_print` to a printer, and fetching OCR models or building from source: these reach a device or the network. Otherwise PdfCraft has no account, cloud or AI service to call.
- Never quit or restart an instance the user started: it may hold unsaved work. Start a second one with `--control`. `quit` on a dirty window opens the Save/Don't save/Cancel prompt (`needs_confirmation: true`).
- After a transport failure (`the app did not answer within 30 s`, a dropped connection, an MCP timeout), read `state` or `doc_inspect` before retrying: the call may have completed.

## Formats

| Format | Open | Write | Caveat |
|---|---|---|---|
| PDF 1.0-1.7, 2.0 | yes | yes | 2.0-only features kept but not used; damaged files repaired |
| Encrypted PDF (passwords) | yes | yes | saved under the same keys; certificate encryption not supported |
| PNG, JPEG, TIFF, GIF, BMP, JPEG 2000, text | as a new PDF | PNG, JPEG, TIFF, text | no PCX; JPEG 2000 not written |
| Word, PowerPoint, HTML, RTF | no | yes | "basic": text and tables flow, layout is lost; no `.xlsx`, `.doc` |
| FDF, XFDF, XML, XDP data, CSV | import | export | form and comment data only |
| PDF/A | yes | 2b and 3b, partial | PDF/X and PDF/UA are read only, never verified |

## Pitfalls

- **A one-off `pdfcraft-cli run` starts with no documents open.** *(docs, not measured)* Each process is a fresh session, so `run text_find doc=1` after a separate `run doc_open` finds no document. Put open, edit and save in one `--script`.
- **`--root` and the automation roots resolve relative paths differently.** *(docs, not measured)* Under `--root`, relative paths resolve inside the root. Under `--automation-read-root`/`--automation-write-root`, they resolve against the server's working directory, which the MCP client picks. Pass absolute paths.
- **`command_run` drops unknown parameter keys with only a warning.** *(docs, not measured)* Top-level typos fail with `-32602`, but a misspelled key inside `params` is ignored and listed in `warnings`. Read `warnings` after every call.
- **`command_batch` is not one undo step.** *(docs, not measured)* It stops at the first error by default, and the steps before it stay applied. Read the per-step results, then undo or reopen before running it again.
- **`edit` options renumber pages as they run.** *(docs, not measured)* In `--delete 2 --rotate 3:90`, the rotation hits what was page 4. Put deletions last, or count after each option.
- **`ui` values that parse as JSON are sent as JSON.** *(docs, not measured)* `label=2024` arrives as a number, and the call fails. Quote it: `label='"2024"'`.
- **`ui open` answers before the file is open.** *(docs, not measured)* The reply says `pending: true`, and `state` lists it in `pending_opens` until the open is done. A path already open only focuses its tab (`"focused": true`) and does not reload changes made on disk.
- **`ui command` takes only an `id`.** *(docs, not measured)* It runs the command as the menu would. A command that needs input opens its dialog in the window. Drive the dialog with `inspect`/`click`/`type`, or make the edit headless.
- **Input and screenshots wait for the window to be drawn.** *(docs, not measured)* If the window is hidden, minimized or fully covered, the call fails after 5 s with `the window is not being drawn` and the queued input is dropped. Bring your instance to the front and retry.
- **A control file outlives its app.** *(docs, not measured)* The app does not delete it, and each launch writes a new port and token. A stale file gives `can't reach the app on port N`. Check its `pid` is alive (`kill -0`) before trusting it.
- **The macOS CLI zip ships no OCR models.** *(docs, not measured)* `batch --steps ocr` and the `ocr_*` tools report missing models as file errors. Set `PDFCRAFT_MODELS=/Applications/PdfCraft.app/Contents/Resources/models` to use the app's copy.

## Not there yet

- No MCP or tool-table session attached to the running app. The control channel drives only the UI.
- No Office, HTML, RTF or PostScript import. Office export is "basic".
- OCR reads Latin script without accents only, and gives no editable-text output.
- Editing existing text is unreliable, especially CJK and right-to-left.
- No certificate (public-key) encryption, no linearized save, no PDF/X, PDF/UA or Preflight verification, partial XFA.
- No control channel and no `ui.open` in the web build.
