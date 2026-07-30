# SBA Skills — PDF renderer fixes

Files here mirror their exact paths in `Florryshine/sbaskills`. Copy each one
over the matching file in your repo (they replace the existing files).

## How to apply (Command Prompt, from your repo root)

```
copy /Y sbaskills-fixes\lib\pdf\CoverPage.js lib\pdf\CoverPage.js
copy /Y sbaskills-fixes\lib\pdf\parseMarkdown.js lib\pdf\parseMarkdown.js
copy /Y sbaskills-fixes\lib\pdf\StudyNoteDocument.js lib\pdf\StudyNoteDocument.js
copy /Y sbaskills-fixes\lib\pdf\BookDocument.js lib\pdf\BookDocument.js
copy /Y sbaskills-fixes\lib\pdf\calloutTypes.js lib\pdf\calloutTypes.js
copy /Y sbaskills-fixes\lib\pdf\blockStyles.js lib\pdf\blockStyles.js
copy /Y "sbaskills-fixes\app\api\study-notes\[draftId]\publish\route.js" "app\api\study-notes\[draftId]\publish\route.js"
copy /Y sbaskills-fixes\app\admin\study-note-drafts\page.js app\admin\study-note-drafts\page.js
```

`lib\pdf\blockStyles.js` is a **new file** (didn't exist before) — the other
seven are drop-in replacements for your existing ones.

## What changed and why

### lib/pdf/parseMarkdown.js
- Added detection for `---`, `***`, `___` on their own line → now emits an
  `{ type: 'hr' }` block instead of falling through to plain paragraph text
  (which is why you were seeing the literal dashes printed).

### lib/pdf/blockStyles.js (new)
- Shared style builder (`buildBlockStyles(theme)`) used by both
  `StudyNoteDocument.js` and `BookDocument.js`, so the two renderers can't
  drift out of sync again. Includes the new `hr` style (a bottom border).

### lib/pdf/StudyNoteDocument.js
- Now renders the `hr` block as an actual line.
- Every `h1` (new topic) except the first now forces a page break
  (`break={index > 0}`), so a new topic never starts mid-page.
- Now accepts a `themeKey` prop and uses `getTheme()` / `buildBlockStyles()`
  instead of being hardcoded to the brand colors — this is what makes
  different visual styles actually possible in the real AI study-notes
  pipeline (previously only the paste-text `BookDocument` flow supported
  themes; the main flow didn't).

### lib/pdf/BookDocument.js
- Same `hr` + page-break-on-h1 fixes.
- Refactored to use the shared `blockStyles.js` base instead of duplicating
  it, extended with its own callout/checklist/video styles.
- Removed the 📺 emoji from the video card label (see CoverPage note below
  for why).

### lib/pdf/CoverPage.js
- Front cover: page padding was `0` and the title had a fixed 26px size
  regardless of length, so long titles ran past the page edge. Added
  horizontal page padding and a font size that shrinks for longer titles.
- Back page: the emoji characters (📚 🧠 ⚔️ 🎯 🏆 ❤️) are the actual cause of
  the "boxes overlapping text" you saw. The core Helvetica font react-pdf
  uses has no emoji glyphs — an unsupported codepoint renders as a corrupted
  glyph sitting on top of the next character (the "•P•remium" artifact in
  your screenshot). Replaced all of them with plain bullet characters that
  are part of the standard Helvetica encoding (same bullet already used
  safely elsewhere in your list rendering).

### lib/pdf/calloutTypes.js
- Same emoji-glyph-corruption bug was lurking in the `:::tip`, `:::warning`,
  etc. callout icons (📘 💡 ⚠️ 🧠 🎯 📝 ⭐ 📚 📌). Replaced with plain
  bullet/`!` characters so this doesn't resurface once you use callouts.

### app/api/study-notes/[draftId]/publish/route.js
- Accepts an optional `{ "themeKey": "modern" }` JSON body and passes it
  through to `StudyNoteDocument`. Defaults to `'brand'` (your original look)
  if no body is sent, so nothing breaks if you call it exactly as before.

### app/admin/study-note-drafts/page.js
- Added a style dropdown (Brand / Modern / Student Workbook / Premium Ebook
  / Minimal / Dark Mode) next to each draft's Publish button, and wired it
  to send `themeKey` in the publish request.

## After copying the files

```
npm run dev
```

Then open a study note draft in `/admin/study-note-drafts`, pick a style
from the new dropdown, and hit Publish to generate a PDF with all four
fixes in place. Test with markdown that includes a `---` divider and more
than one `# Heading` to confirm the line renders and the page break kicks in.
