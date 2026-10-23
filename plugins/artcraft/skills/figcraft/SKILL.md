---
name: figcraft
description: FigCraft is the open-source, pure-Rust Figma alternative from storytold, for interface design and prototyping. Use it when the user names FigCraft or `figcraft-cli`, works with a `.figcraft` file, or asks to script, automate, render, export or convert a design with it, headless or in the running app over MCP or the control port. Generic design jobs ("make a mockup", "build the components") trigger it only when the user is working in FigCraft. It is not Figma and does not drive it, and it is not the "FigCraft" Figma plugin, a different project with the same name.
---

# FigCraft

**Pinned:** FigCraft 0.10.0 (app and CLI), docs tag `v0.10.0`, checked 23 October 2026 on macOS. Measured on the running app.

Two layers, kept apart. FigCraft's docs at the pinned tag and its live command list are the reference for commands, parameters and protocol. This skill holds how to drive it and what was learned by doing. If the two disagree about a command, the docs and the live list win. If the installed version is not the pinned one, say so before relying on anything below.

## What it is

An interface design and prototyping app: pages, frames, auto layout, components and variants, styles, variables with modes, prototypes, Dev Mode. Every menu action is a command with an id and JSON parameters, and the UI, the CLI, the MCP server and the control port all run the same commands. The native format is `.figcraft`, a zip holding `document.json` and the images. The project calls itself "early alpha". It is not Figma: Figma plugins do not run (FigCraft has its own WebAssembly plugins), there are no accounts or cloud, and `.fig` files open only best effort. Never assume a Figma feature exists. Look the command up.

## The references

- Docs at the tag: `curl -sL https://raw.githubusercontent.com/storytold/figcraft/v0.10.0/docs/<file>`
  - `mcp.md`: read "Conventions agents must know" before the first build, then "Step references" and "Paint, effect and layout grid lists".
  - `control-protocol.md`: the socket, its limits, the methods, and "Windows" (which window a request goes to).
  - `cli.md`: the subcommands, `run` scripts, the automation roots.
- Live command list, from the running app: `node scripts/fc.mjs list_commands '{"filter":"<word>"}'` (through `--attach`), or the control method `engine.commands`. `figcraft-cli commands --filter <word>` lists the CLI's own build. Parameter names come from here; never guess them.
- Release notes: `https://github.com/storytold/figcraft/releases/tag/v0.10.0`
- [`references/fields.md`](references/fields.md): each field's `node.set` key, `variable.bind` field and read-back side by side, with Figma's name; the write-then-bind cases; what is reported and what is only kept; slots; library copies.

## Surfaces

- **Headless CLI.** `figcraft-cli info | export | convert | render | run`. One shot, files in, files out. `run script.json --in a.figcraft --out b.figcraft` is one undo step and all-or-nothing: a failing step prints only its own line with `"rolledBack": true`, exits 1 and writes nothing. Use it to build or render a file nobody is watching.
- **MCP, headless.** `figcraft-cli mcp`. A long session with one untitled document, no window, CPU renders. `open_file` adds the file as a second tab and makes it the active one; pin batches with `doc.switch` as in the app. `window.list` is an unknown command here. `save_file {path}` saves the active tab and fails if the folder does not exist. Each process is a new session, so keep one process open for a multi-step job, such as a sync that reads, writes and reads again; `run` cannot do that, because a failing step loses the reads before it.
- **MCP, attached.** `figcraft-cli mcp --attach <port>` drives an app started with `--control <port>`; every change shows in its window. `scripts/fc.mjs` wraps it (below). Use this when the user wants to watch, or works in the app.
- **Control port.** JSON lines on `127.0.0.1:<port>`, no authentication. Methods such as `engine.execute`, `document.inspect`, `ui.render`, `window.list`, `app.quit`. Useful for a single method the MCP tools do not wrap.
- **Not there:** the macOS app bundle holds no CLI; `figcraft-cli` is a separate download. No surface asks for a login.
- **Confinement.** `--automation-read-root DIR` and `--automation-write-root DIR` confine the headless CLI and MCP. With `--attach` they are refused: start the app with them instead.
- **Version rule.** Compare `figcraft-cli --version` with `defaults read /Applications/FigCraft.app/Contents/Info.plist CFBundleShortVersionString`. When they differ, the CLI's own lists describe its build, not the app's: say so, and ask the app (`list_commands` attached).

**Why the script.** An MCP session needs an `initialize` handshake per process, returns screenshots as base64, and every write must be pinned to a file read just before (Pitfalls). `scripts/fc.mjs` does the three in one call. Set `FIGCRAFT_PORT` to the app's port and `FIGCRAFT_SHOTS` to a scratch folder; paths below are relative to this skill's folder.

## Driving it

1. **Find or start the app.** `pgrep -fl FigCraft` shows each instance with its `--control <port>`. If the user's instance has no port, or is not one you may touch, start your own: `open -n -a /Applications/FigCraft.app --args --control 7979`, then `until nc -z 127.0.0.1 7979; do sleep 0.5; done`. Note its PID with `lsof -nP -iTCP:7979 -sTCP:LISTEN`. A new instance opens with one `Untitled` tab.
2. **Check the link:** `node scripts/fc.mjs inspect_ui '{}'` (it lists `windows` and `tabs`). "Connection refused" means the instance is gone.
3. **Know which file you are in.** `node scripts/fc.mjs run_command '{"command":"doc.list","params":{}}'` gives each open file's `index`, `name`, `path`, `dirty`, `active`. Work in a new file unless the user names one: `file.new {"name":"<unique name>"}` returns its `index` and makes it active.
4. **One batch per logical change, pinned:** `node scripts/fc.mjs --steps steps.json --doc <path, or the name of an unsaved file>`. Steps are `[{"command","params"}]` or `{"label","commands"}`; `{"$ref": n}` stands for the id step n returned. It goes as one `command.batch` with `doc.switch` first: one undo step, rolled back whole on failure, active tab included. Generate long step files with a short script in a scratch folder.
5. **Read the numbers back:** `node scripts/fc.mjs get_node '{"id":<id>,"depth":2}'` (`width`, `height`, `fills`, `boundVariables`, `pluginData`). Reads act on the active tab, so read right after a pinned batch, which leaves its file in front.
6. **Look at it:** `node scripts/fc.mjs screenshot '{"ids":[<id>],"scale":2}'` prints `IMAGE <path>`; open the PNG and look. Without `window` it renders the document, so it works while the app is hidden.
7. **Save where the user says,** absolute path, as a step of a pinned batch: `{"command":"file.save","params":{"path":"/abs/name.figcraft"}}`. A first save needs a path; no dialog opens. Check the path is free first (Pitfalls).
8. **When done, quit only the instance you started:** control method `app.quit` on its port, then confirm the PID is gone. It does not ask about unsaved changes.

**Rebuilding a web page's components.** Read every value from the running page, never from memory or the source. In a browser, resolve each custom property on a probe element with `getComputedStyle`: `span.style.color = 'var(--x)'` resolves a colour, and `getPropertyValue` gives lengths and the `font` shorthand. Put the probe inside the element that sets a theme or tone, so it resolves that role's values. Then build:
- **Colours become variables, roles become modes.** Use a collection per axis that switches values (a mode per theme or tone) and a one-mode collection for constants. Create layers with placeholder colours, then `variable.bind {ids, field: "fill" | "stroke", variable}`; a text layer's colour is its `fill`. `variable.setMode {ids, collection, mode}` on a frame switches everything inside it, so one component set serves every role.
- **Variants.** Make one component per combination, named `prop=value, prop=value`, then `component.combineVariants {ids}`, and name the set. Lay it out with `layout: "grid"`, `gridColumns`, `columnGap`, `rowGap`. `component.properties {id}` reads a set's or an instance's properties; `instance.create {component, parent}` places one.
- **Measure before saying it matches.** Compare `get_node` `width` and `height` with the element's `getBoundingClientRect()`.

## Asking first

- Tell the user before you start a second instance: its window takes keyboard focus, so what they are typing lands in your document. `open -g` does not always prevent it.
- Get a yes before editing or deleting anything in a file the user already had open. Build in a new file, and send every write through a pinned batch, never a bare `run_command`, `create_node` or `set_properties`: that is what keeps a build out of their tabs.
- Never quit, or `file.close {force}`, an instance or tab you did not open: it may hold unsaved work. Start a second instance instead.
- Get a yes before overwriting a saved file: `file.save {path}` replaces it silently.
- Get a yes before anything that reaches a server: every `collab.*` command (`collab.share` defaults to publishing online), `library.publishToServer`, `plugin.directory.*`, `figcraft-cli plugin publish`.
- After a transport failure, read the state (`doc.list`, `get_node`) before retrying: an attached call is never replayed and may have completed *(docs, not measured)*.

## Formats

| Format | Open | Write | Caveat |
|---|---|---|---|
| `.figcraft` | yes | yes | Native zip. `file.save` and `save_file` write only this. |
| `.fig` | yes | yes | Opened best effort; writing is "experimental" and a copy, the tab keeps its `.figcraft` path. What was left out comes back as `note:` lines or `warnings`. |
| `.json` | yes | `convert`, `run --out` | FigCraft JSON, or the REST API file JSON with `images/<imageRef>.png` beside it. |
| `.svg` | yes | yes | Opens as an editable frame; `info` lists what was left out. |
| PNG, JPG, WebP | yes (image layer) | yes | Raster exports up to `--scale 64`; `render` scales pages down to 16384 px. |
| PDF | no | yes | One page per top-level frame, real text; shadows and blurs become images. `--cmyk` is a naive conversion. |
| GIF, TIFF, BMP | yes (image layer) | no | |

## Pitfalls

**Commands act on the tab in front, not on a file you name.** Layer ids are per file: id 2 exists in every file, so a `get_node` or `set_properties` after the user switches tabs answers about the wrong file with no error. Pin every write with `doc.switch` (`--doc`), and read `doc.list` again before each batch: indices shift when tabs open, close or move.

**A failed pinned batch puts the old tab back in front.** The pin is rolled back with the rest, so reads that follow go to whatever file was showing before. Pin again before reading.

**`file.save` overwrites without asking, even a file another tab holds.** Two tabs can then claim the same path, and `--doc <path>` refuses both. Check the path with `ls` and `doc.list` before saving.

**`variable.bind` accepts any field name.** A misspelt field (`filll`) answers ok, shows in `boundVariables` and binds nothing. Check that the value moved: `get_node` after `variable.setMode`.

**Unknown keys are refused in some places and ignored in others.** `node.set` and effects refuse keys they don't take (a shadow's offset is `offset: [x, y]`, not `offsetX`). Unknown keys in layout grid items and unknown command parameters pass: `inspect.properties {ids}` ignores `ids` and inspects the selection. After any new kind of property, read it back.

**Some fields are kept but never read back.** A frame's variable mode, a layer's link to a component property, `cornerSmoothing`, `maxLines`, `paragraphSpacing`, `paragraphIndent`, a line's `strokeCap` and an exposed instance are saved and drawn, but no read shows them. `blend` reads back the same for `normal` and `pass through`. Keep your own record of what you set (`references/fields.md`).

**Writing a value to a bound field unhooks its variable.** Write every value first, then bind. The four corners are one field, and so are the four stroke sides. A corner bound beside a bound `cornerRadius` does nothing, and a side written unhooks every side binding and a bound `strokeWeight`. When a corner or side differs, write the list, then bind each part, never `cornerRadius` or `strokeWeight`.

**The `node.get` command reads one level of children, whatever `depth` says.** Inside a batch, `run_command` or a `run` script, walk the tree a level at a time. The MCP `get_node` tool honours `depth`.

**`node.reparent` and `node.reorder` count indices differently.** `node.reorder {id, index}` takes the final position. `node.reparent {ids, parent, index}` within the same parent counts the list before the layer leaves it: `[a, b, c, d]` with `a` to `index: 3` gives `[b, c, a, d]`. An index past the end appends without an error.

**Variable ids are reused, node ids are not.** Delete `VariableID:3`, create another variable, and it is `VariableID:3` again. Don't hold a variable id across a delete. A library's copies in `variable.list` carry the library's id as a prefix, but their mode ids do not, and can equal the file's own.

**A font style the family lacks is accepted silently.** `fontStyle: "Medium"` on a family without it reads back as `Medium` and draws another style, and `text.missingFonts` lists only missing families. Check `text.fonts {"family":"<name>"}` first and say which style was substituted.

**A CSS border takes room even when transparent; a FigCraft frame without a stroke does not.** A web button with `border: 1px solid transparent` is 2 px wider than its frame. Give every variant a 1 px inside stroke, transparent where the page has none; `strokesIncluded` is on by default for auto layout, so it counts like padding.

**A drop shadow on a frame without an opaque fill is not box-shaped.** With no fill it is cast from the children; with a 0% fill it is hidden, and with `showBehind: true` it is cast from the children again. Render and look before calling a shadow done.

**`component.combineVariants` names the new set `Component 1`.** The variant names (`variant=solid, state=rest`) become its properties, not its name. Rename the set with `set_properties`.

**`window.new` through `run_command` answers ok and opens nothing while the window is hidden.** The control method `window.new` says why (`window 0 is minimised or hidden`). Prefer tabs and `doc.switch` to extra windows.

## Not there yet

- No Figma plugins, no accounts, teams or cloud; live sessions and the self-hosted server are a "preview".
- `.fig` import has not been checked against real design documents; do not promise fidelity.
- No PDF import, and no HEIC or video.
