import { MarkdownPostProcessorContext } from "obsidian";
import ScriptEditorPlugin, {
  CSS_CLASSES,
  COLOR_TAG_REGEX,
  SUMMARY_REGEX,
  NOTE_REGEX,
} from "./main";

export function registerReadingView(plugin: ScriptEditorPlugin) {
  plugin.registerMarkdownPostProcessor((element, context) => {
    const fm = context.frontmatter;
    const cls = fm?.cssclasses || fm?.cssclass || [];
    const classesArray = Array.isArray(cls)
      ? cls
      : typeof cls === "string"
      ? [cls]
      : [];

    if (
      !classesArray.includes("fountain") &&
      !classesArray.includes("script")
    ) {
      return;
    }

    const leaves = element.querySelectorAll("p, li");
    leaves.forEach((node: HTMLElement) => {
      if (node.dataset.scriptProcessed) return;

      const text = node.innerText?.trim() || "";

      // 1. 如果是標題，直接略過讓 Obsidian 渲染 (H1-H6)
      if (text.startsWith("#")) return;

      // 2. 核心修正：即便 text 是空的 (Obsidian 隱藏了內容)，
      // 或者整塊都是 metadata，我們都要把這個 node (段落) 徹底藏起來。
      const lines = text.split("\n");
      const isPureMetadataOrEmpty =
        !text ||
        lines.every((line) => {
          const tl = line.trim();
          return (
            !tl ||
            COLOR_TAG_REGEX.test(tl) ||
            SUMMARY_REGEX.test(tl) ||
            (NOTE_REGEX.test(tl) && tl.startsWith("%%"))
          );
        });

      if (isPureMetadataOrEmpty) {
        node.addClass("script-editor-hidden-metadata");
        node.dataset.scriptProcessed = "true";
        return;
      }

      // 3. 處理包含混合內容的段落
      node.empty();
      node.dataset.scriptProcessed = "true";

      let previousType: string | null = null;

      lines.forEach((line) => {
        const trimmedLine = line.trim();
        // 如果這行本身是標籤或空的，就略過
        if (!trimmedLine) return;
        const isTag =
          COLOR_TAG_REGEX.test(trimmedLine) ||
          SUMMARY_REGEX.test(trimmedLine) ||
          (NOTE_REGEX.test(trimmedLine) && trimmedLine.startsWith("%%"));
        if (isTag) return;

        const format = plugin.detectExplicitFormat(trimmedLine);
        let cssClass = CSS_CLASSES.ACTION;
        let currentType = "ACTION";

        if (format) {
          cssClass = format.cssClass;
          currentType = format.typeKey;
        } else if (
          previousType === "CHARACTER" ||
          previousType === "PARENTHETICAL" ||
          previousType === "DIALOGUE"
        ) {
          cssClass = CSS_CLASSES.DIALOGUE;
          currentType = "DIALOGUE";
        }

        const lineEl = node.createDiv({ cls: cssClass });

        let displayText = trimmedLine;
        if (format && format.removePrefix) {
          displayText = trimmedLine.substring(format.markerLength).trim();
        }
        lineEl.setText(displayText);

        // 移除內容 Div 的預設間距以免疊加
        lineEl.addClass("script-editor-line-element");

        previousType = currentType;
      });
    });
  });
}
