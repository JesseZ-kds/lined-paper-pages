# Settings

Open **Settings → Lined Paper Pages**. Changes show straight away. Each setting has a ↺
button to put it back to its default, and **Reset all** resets everything.

| Section | Settings |
|---|---|
| **Pages and text** | A4 pages in reading view (on/off) · Lines per page · Text size · Title size · Title position · Handwriting font · Title font · Underline links |
| **Cornell notes** | Cue column width · Essential question lines · Summary height · Summary minimum height · Full-width block lines · Column labels · Labels on page 2, 3 … |
| **Callouts** | Callout box height (80 %) · Callout text size |
| **Colours** | Paper · Ruled lines · Red margin line & divider · Text · Title · Labels · Heading underline · Desk |
| **Advanced** *(hidden until you switch it on)* | Page height used · Text scale on the A4 page · Title bar height · Footer · Gap between pages · Page margins · Ruled line position · Callout lift · Divider spacing · … |

**Fonts:** pick the handwriting and title fonts from a list: Patrick Hand, Caveat, Kalam,
Indie Flower, Shadows Into Light, Architects Daughter, Gloria Hallelujah, Handlee, Gochi Hand,
Schoolbell, Coming Soon, Neucha, Reenie Beanie, Nanum Pen Script, Covered By Your Grace,
Homemade Apple, Dancing Script and Comic Neue. Each one downloads automatically when you pick it.
You can also pick Segoe Print, Bradley Hand or Comic Sans MS, or type the name of any font
installed on your computer.

**Colours:** a colour you leave on its default follows the light and dark themes. A colour you
set is used in both.

**Prefer Style Settings?** Every option is also available in the *Style Settings* community plugin
(*Settings → Style Settings → Lined Paper / Cornell Notes*). If you set the same option in both
places, the Lined Paper Pages settings page wins.

## Changing a setting without the plugin

If you use the CSS snippets on their own (without the plugin), they read every option from a CSS variable with a default (section 1 of each
snippet), so you can also change a default there, e.g. `var(--lp-line, 36px)` → `var(--lp-line, 32px)`.
The settings page and Style Settings both win over these defaults.

