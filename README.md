# egildo/skills

Claude Code skills, public. For now one plugin: **`artcraft`**, a skill for each app of the [ArtCraft](https://github.com/storytold) suite, the open-source, pure-Rust creative apps from storytold.

Each skill is short and pinned. The app's own docs, read at the release tag the skill names, are the reference for commands and parameters; the skill holds what the docs do not: which way to drive the app (headless CLI, MCP server, control port), the loop that changes a document without breaking the user's work, what needs the user's yes, and the pitfalls found by doing. The shape every skill follows is in [`plugins/artcraft/TEMPLATE.md`](plugins/artcraft/TEMPLATE.md).

| App | Stands in for | Pinned | Checked |
| --- | --- | --- | --- |
| [PhotoCraft](plugins/artcraft/skills/photocraft/SKILL.md) | Photoshop | 0.14.0 | measured on macOS |
| [LightCraft](plugins/artcraft/skills/lightcraft/SKILL.md) | Lightroom | 0.13.0 | docs and source |
| [VectorCraft](plugins/artcraft/skills/vectorcraft/SKILL.md) | Illustrator | 0.16.0 | measured on macOS |
| [FigCraft](plugins/artcraft/skills/figcraft/SKILL.md) | Figma | 0.10.0 | measured on macOS |
| [DesignCraft](plugins/artcraft/skills/designcraft/SKILL.md) | InDesign | 0.12.0 | measured on macOS |
| [WordCraft](plugins/artcraft/skills/wordcraft/SKILL.md) | Word | 0.10.0 | measured on macOS |
| [DeckCraft](plugins/artcraft/skills/deckcraft/SKILL.md) | PowerPoint | 0.10.0 | docs and source |
| [GridCraft](plugins/artcraft/skills/gridcraft/SKILL.md) | Excel | 0.11.1 | measured on macOS |
| [PdfCraft](plugins/artcraft/skills/pdfcraft/SKILL.md) | Acrobat | 0.13.0 | docs and source |
| [EffectCraft](plugins/artcraft/skills/effectcraft/SKILL.md) | After Effects | 0.16.0 | measured on macOS |
| [FilmCraft](plugins/artcraft/skills/filmcraft/SKILL.md) | Premiere | 0.12.0 | docs and source |
| [SoundCraft](plugins/artcraft/skills/soundcraft/SKILL.md) | Pro Tools | 0.12.1 | measured on macOS |
| [CADCraft](plugins/artcraft/skills/cadcraft/SKILL.md) | AutoCAD | 0.12.0 | measured on macOS |

"Measured" means the loop and every pitfall were run on that version of the app. "Docs and source" means the app was not installed: the skill says so in its first line, and marks each pitfall as not measured. If your installed version differs from the pinned one, the skill tells Claude to say so before relying on it.

## Install

In Claude Code:

```bash
claude plugin marketplace add egildo/skills
```

```bash
claude plugin install artcraft@egildo
```

The skills are plain `SKILL.md` folders, so any agent that reads them works too: copy the folders under `plugins/artcraft/skills/` into its skills directory (`~/.claude/skills/` for Claude Code without the plugin, `~/.agents/skills/` for most others).

The apps and their CLIs are separate downloads from each app's GitHub releases. Keep an app and its CLI on the same version.

## Credits

The idea of a skill per ArtCraft app comes from [midasmatterhorn/artcraft-skills](https://github.com/midasmatterhorn/artcraft-skills). These are remade, not copied: every claim was checked against the apps' docs at the tag or the running app, and written fresh. The apps are storytold's.

MIT licence; see [LICENSE](LICENSE).
