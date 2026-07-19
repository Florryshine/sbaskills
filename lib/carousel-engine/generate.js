// lib/carousel-engine/generate.js

export function generateCarouselMarkdown(asset) {
  let markdown = `---
marp: true
theme: uncover
class: invert
---

<!-- _class: lead -->
# ${asset.title}

---

## What You'll Learn

${asset.summary || 'Key concepts from this lesson.'}

`;

  if (asset.sections && asset.sections.length > 0) {
    asset.sections.forEach((section) => {
      markdown += `
---

## ${section.heading}

${section.content}

`;
    });
  }

  markdown += `
---

<!-- _class: lead -->
## Ready to Test Your Knowledge?

Download the Shiney Brain Academy app now!

`;

  return markdown;
}