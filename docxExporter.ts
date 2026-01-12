import { Document, Paragraph, TextRun, AlignmentType, Packer } from "docx";
import {
  CHARACTER_COLON_REGEX,
  SCENE_REGEX,
  TRANSITION_REGEX,
  PARENTHETICAL_REGEX,
  OS_DIALOGUE_REGEX,
  COLOR_TAG_REGEX,
  SUMMARY_REGEX,
  NOTE_REGEX,
} from "./main";

export class DocxExporter {
  static async exportToDocx(text: string, _title: string): Promise<Buffer> {
    let content = text;

    // Remove YAML frontmatter if present
    if (content.trimStart().startsWith("---")) {
      const firstIndex = content.indexOf("---");
      const secondIndex = content.indexOf("---", firstIndex + 3);
      if (secondIndex !== -1) {
        content = content.substring(secondIndex + 3).trimStart();
      }
    }

    const lines = content.split("\n");
    const paragraphs: Paragraph[] = [];
    let previousType = "ACTION";

    for (const lineText of lines) {
      const trimmed = lineText.trim();
      if (
        !trimmed ||
        COLOR_TAG_REGEX.test(trimmed) ||
        SUMMARY_REGEX.test(trimmed) ||
        NOTE_REGEX.test(trimmed)
      ) {
        if (!trimmed) paragraphs.push(new Paragraph({}));
        previousType = "ACTION";
        continue;
      }

      // 0. H1 Headers as Centered Title (Script Style)
      if (trimmed.startsWith("# ")) {
        paragraphs.push(
          new Paragraph({
            children: [
              new TextRun({
                text: trimmed.substring(2).trim().toUpperCase(),
                font: "Courier New",
                size: 24,
              }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { before: 480, after: 240 },
          })
        );
        previousType = "ACTION";
        continue;
      }

      // 1. Scene Heading
      if (SCENE_REGEX.test(trimmed)) {
        const displayText = trimmed
          .replace(/^###\s*/, "") // 移除 ###
          .replace(/^\./, "") // 移除舊的點號
          .trim();

        paragraphs.push(
          new Paragraph({
            children: [
              new TextRun({
                text: displayText.toUpperCase(),
                bold: true,
                font: "Courier New",
                size: 24,
              }),
            ],
            spacing: { before: 240, after: 120 },
          })
        );
        previousType = "SCENE";
        continue;
      }

      // 2. Transition
      if (TRANSITION_REGEX.test(trimmed)) {
        paragraphs.push(
          new Paragraph({
            children: [
              new TextRun({
                text: trimmed.toUpperCase(),
                font: "Courier New",
                size: 24,
              }),
            ],
            alignment: AlignmentType.RIGHT,
            spacing: { before: 240, after: 120 },
          })
        );
        previousType = "TRANSITION";
        continue;
      }

      // 3. Character / OS / VO
      const isCharacter =
        trimmed.startsWith("@") ||
        (/^[A-Z0-9\s-]{1,30}(\s+\([^)]+\))?$/.test(trimmed) &&
          trimmed.length > 0) ||
        /^[\u4e00-\u9fa5A-Z0-9\s-]{1,30}$/.test(trimmed) ||
        CHARACTER_COLON_REGEX.test(trimmed);

      if (isCharacter) {
        let charName = trimmed.startsWith("@")
          ? trimmed.substring(1).trim()
          : trimmed;
        let dialogueAfterColon = "";

        const colonMatch = charName.match(CHARACTER_COLON_REGEX);
        if (colonMatch) {
          charName = colonMatch[1].trim() + colonMatch[2];
          // dialogueAfterColon is not captured by this regex anymore
          dialogueAfterColon = "";
        }

        paragraphs.push(
          new Paragraph({
            children: [
              new TextRun({
                text: charName.toUpperCase(),
                font: "Courier New",
                size: 24,
              }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { before: 240 },
          })
        );

        if (dialogueAfterColon) {
          paragraphs.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: dialogueAfterColon,
                  font: "Courier New",
                  size: 24,
                }),
              ],
              indent: { left: 1440, right: 1440 }, // ~1.0 inch
            })
          );
          previousType = "DIALOGUE";
        } else {
          previousType = "CHARACTER";
        }
        continue;
      }

      // 4. Parenthetical / OS: / VO:
      if (
        PARENTHETICAL_REGEX.test(trimmed) ||
        OS_DIALOGUE_REGEX.test(trimmed)
      ) {
        paragraphs.push(
          new Paragraph({
            children: [
              new TextRun({
                text: trimmed,
                italics: true,
                font: "Courier New",
                size: 24,
              }),
            ],
            indent: { left: 2160 }, // ~1.5 inches
          })
        );
        previousType = "PARENTHETICAL";
        continue;
      }

      // 5. Dialogue (Continuous)
      if (
        previousType === "CHARACTER" ||
        previousType === "PARENTHETICAL" ||
        previousType === "DIALOGUE"
      ) {
        paragraphs.push(
          new Paragraph({
            children: [
              new TextRun({ text: trimmed, font: "Courier New", size: 24 }),
            ],
            indent: { left: 1440, right: 1440 }, // ~1.0 inch
          })
        );
        previousType = "DIALOGUE";
        continue;
      }

      // 6. Action
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({ text: trimmed, font: "Courier New", size: 24 }),
          ],
          spacing: { before: 120, after: 120 },
        })
      );
      previousType = "ACTION";
    }

    const doc = new Document({
      sections: [
        {
          properties: {
            page: {
              margin: {
                top: 1440,
                right: 1440,
                bottom: 1440,
                left: 2160, // 1.5 inches for punch hole
              },
            },
          },
          children: paragraphs,
        },
      ],
    });

    return await Packer.toBuffer(doc);
  }
}
