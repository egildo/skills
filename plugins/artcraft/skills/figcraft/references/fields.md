# FigCraft 0.10.0: fields, bindings and read-back

The docs list the `node.set` keys and the `variable.bind` fields, each in its own place. This table puts them side by side with Figma's name and with what `node.get` reads back. Measured on 0.10.0. The live command list's `params` text for `node.set` and `variable.bind` is still the reference for spellings.

## The field table

| Figma | `node.set` key | `variable.bind` field | `node.get` reads |
| --- | --- | --- | --- |
| `layoutMode` | `layout`: `horizontal`, `vertical`, `grid`, `null` | | `layout.mode` |
| `itemSpacing`, `counterAxisSpacing` | `gap`, `crossGap` (aliases `columnGap`, `rowGap`) | `gap`, `crossGap` | `layout.gap`, `layout.crossGap`; in a grid, column then row |
| paddings | `padding` (one number or `[t, r, b, l]`), `paddingTop`… | `paddingTop`… | `layout.padding: [t, r, b, l]` |
| alignment, wrap | `mainAlign`, `crossAlign`, `wrap`, `contentAlign` | | `layout.*` |
| sizing | `sizingH`, `sizingV`: `fixed`, `hug`, `fill`; `minWidth`… (`null` removes); `absolute` | `width`, `height`, `minWidth`… | `sizing: {horizontal, vertical}` |
| grid layout | `gridColumns`, `gridRows`, `columnTracks` / `rowTracks` as `[60, "1fr", "auto"]`; on a child `gridColumn`, `gridRow`, `gridColumnSpan`, `gridRowSpan`, `gridAlignH`, `gridAlignV` | | `layout.columnTracks: [{sizing: fixed / fill / hug, value}]`; a child's `gridCell` |
| corners | `cornerRadius` (one number or `[tl, tr, br, bl]`), `cornerSmoothing` | `cornerRadius`, `topLeftRadius`, `topRightRadius`, `bottomRightRadius`, `bottomLeftRadius` | `cornerRadius`, one number or four |
| strokes | `strokes`, `stroke`, `strokeWeight`, `strokeTopWeight`…, `strokeAlign`, `strokeJoin`, `strokeCap`, `dashes` | `stroke`, `strokes/<i>/color`, `strokeWeight`, `strokeTopWeight`… | `strokeWeight`, `strokeSides: [t, r, b, l]`, `strokeAlign`, `strokeJoin`, `dashes` |
| fills | `fills` (colours, paints, gradients), `fill` | `fill` (the first paint), `fills/<i>/color`, `fills/<i>/stops/<j>/color` | `fills`; a gradient as `{type: "gradient", kind, stops: [{color, position}], from, to, width}` |
| effects | `effects: [{type: dropShadow, color, offset: [x, y], radius, spread, showBehind?, blend?, visible?}, {type: layerBlur, radius}…]` | `effects/<i>/<offsetX, offsetY, radius, startRadius, spread, color>` | the same shape, colours as `{r, g, b, a}` |
| layout grids | `grids: [{kind: columns / rows / grid, count, gutter, offset, size, align: stretch / min / center / max, color, visible}]` | `layoutGrids/<i>/<size, count, gutter, offset>` | `grids` |
| constraints | `constraints: {horizontal: left / right / leftRight / center / scale, vertical: top / bottom / topBottom / center / scale}` | | `constraints`, on children of plain frames and absolute children only |
| `blendMode` | `blend`: camel case, `pass through`, `plusDarker`, `plusLighter` | | `blend` |
| `opacity`, `visible`, `x`, `y`, `rotation` | the same names; `opacity` from 0 to 1 | `opacity` (a percentage), `visible`, `x`, `y` | the same |
| text | `characters`, `fontFamily`, `fontStyle`, `fontSize`, `lineHeight` (`auto`, px, `"150%"`), `letterSpacing` (px, `"2%"`), `textAutoResize` (`widthAndHeight`, `height`, `none`, `truncate`), `textCase`, `textDecoration`, `paragraphSpacing`, `paragraphIndent`, `maxLines` | `characters`, `fontSize`, `lineHeight`, `letterSpacing`… | the same |
| an instance's properties | `instance.setProperties {properties}` | `componentProperties/<name>` (text and boolean properties) | `componentProperties`, without variant values: read those with `component.properties` |
| layer data | `pluginData: {key: "string"}` | | `pluginData`, only when there is some |

Line caps are `none`, `round`, `square`, `lineArrow`, `triangleArrow`, `diamondFilled` and `circleFilled`. Figma's `ARROW_LINES` is `lineArrow` and `ARROW_EQUILATERAL` is `triangleArrow`; Figma's `TRIANGLE_FILLED` has no match.

## Write the value, then bind

Writing a plain value to a bound field unhooks its variable: `node.set`, `fill.set`, a resize, a text edit. So write every value first, then bind.

- **Corners are one field.**
  - A corner list written after a bound `cornerRadius` unhooks it.
  - A corner bound beside a bound `cornerRadius` is listed in `boundVariables` and has no effect: `cornerRadius` still reads one number.
  - When any corner differs, write the four as a list, then bind the corners one by one, never `cornerRadius`.
- **The four stroke sides are one field.**
  - A side written after side bindings unhooks every side binding, and a bound `strokeWeight` too.
  - When any side differs, write the sides, then bind the sides one by one, never `strokeWeight`.
  - `node.set {strokeWeight}` after side bindings changes the scalar and leaves the sides alone.
- **Lists are written whole, then their parts bound.** That covers paints, `effects` and `grids`. They are kept bottom first: index 0 paints first.
- **A bound colour brings its own alpha**, which replaces the paint colour's.

## Reported, or only kept

FigCraft keeps these, saves them and draws them, but no read returns them (`node.get`, `get_node`, `inspect_document`, `inspect.properties`). Keep your own record of what you set:

- a layer's link to a component property (`component.bindProperty`);
- a frame's explicit variable mode (`variable.setMode`);
- `cornerSmoothing`, `maxLines`, `paragraphSpacing`, `paragraphIndent`;
- a line's `strokeCap`;
- an exposed nested instance (`component.exposeInstance`).

Reported only sometimes:
- `blend` is absent for both `normal` and `pass through`, so the two cannot be told apart.
- `strokeJoin` is absent for `miter`.
- `constraints` appear only where a layer follows them.

## Slots

- `component.makeSlot {id, name}` turns a frame inside a main component into a slot. A frame anywhere else is refused: `only a frame inside a main component (not inside an instance) can become a slot`.
- In each instance, the slot is a frame whose `get_node` shows `slot: "<name>"`.
- Fill it with `instance.slotInsert {id, slot, component, index?, replace?}`. Or use any creating command (`frame.create`, `text.create`, `instance.create`) with `parent` set to that frame.
- After the first edit, the slot's layers are the instance's own: it lists `overrides: ["slot"]`, and its layers take overrides and layer data. `instance.resetSlot` brings back the main's content.

## Library copies

After `library.import` or `library.bindVariable`, the copies show up in `variable.list` and `component.list` beside the file's own:

- **Variables and collections** have ids prefixed with the library's id (`<library id>:VariableID:1`).
- **Their mode ids are not prefixed**, and can equal a mode id of the file's own collection. Tell copies apart by the prefix on the id, never by a mode id.
- **Components** list `library: "<library id>"` and no page.
- **Copies are read-only**: editing one is refused.
