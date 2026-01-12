import { RangeSetBuilder } from "@codemirror/state";
import {
  Decoration,
  DecorationSet,
  EditorView,
  ViewPlugin,
  ViewUpdate,
} from "@codemirror/view";
import { editorLivePreviewField } from "obsidian";
import ScriptEditorPlugin, {
  LP_CLASSES,
  SCENE_REGEX,
  TRANSITION_REGEX,
  PARENTHETICAL_REGEX,
  OS_DIALOGUE_REGEX,
  COLOR_TAG_REGEX,
  SUMMARY_REGEX,
  NOTE_REGEX,
  SCRIPT_MARKERS,
} from "./main";

export function livePreviewExtension(plugin: ScriptEditorPlugin) {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;

      constructor(view: EditorView) {
        this.decorations = this.buildDecorations(view);
      }

      update(update: ViewUpdate) {
        if (
          update.docChanged ||
          update.viewportChanged ||
          update.selectionSet
        ) {
          this.decorations = this.buildDecorations(update.view);
        }
      }

      buildDecorations(view: EditorView): DecorationSet {
        const builder = new RangeSetBuilder<Decoration>();
        const isScript =
          view.dom.closest(".fountain") || view.dom.closest(".script");
        if (!isScript) return builder.finish();

        const isLivePreview = view.state.field(editorLivePreviewField);

        // Source Mode: 完全不處理，讓 Obsidian 正常顯示 Markdown
        if (!isLivePreview) return builder.finish();

        const selection = view.state.selection;

        let previousType: string | null = null;
        const hiddenDeco = Decoration.mark({ class: LP_CLASSES.SYMBOL });

        for (const { from, to } of view.visibleRanges) {
          for (let pos = from; pos <= to; ) {
            const line = view.state.doc.lineAt(pos);
            const text = line.text;
            const trimmed = text.trim();

            let lpClass = null;
            let currentType = "ACTION";
            let shouldHideMarker = false;

            let isCursorOnLine = false;
            for (const range of selection.ranges) {
              if (range.head >= line.from && range.head <= line.to) {
                isCursorOnLine = true;
                break;
              }
            }

            const lineDecos: { from: number; to: number; deco: Decoration }[] =
              [];

            if (!trimmed) {
              // Empty lines
              currentType = "EMPTY";
            } else if (NOTE_REGEX.test(trimmed)) {
              lpClass = LP_CLASSES.NOTE;
              currentType = "EMPTY";

              // 找到標籤的結束位置與內容的結束位置
              const prefixMatch = text.match(/^\s*%%note:\s*/i);
              if (prefixMatch) {
                const prefixLen = prefixMatch[0].length;
                const contentStart = line.from + prefixLen;
                const contentEnd = line.to - 2; // 扣掉結尾的 %%

                // 只對「中間真正內容」套用黃色方塊樣式
                if (contentStart < contentEnd) {
                  lineDecos.push({
                    from: contentStart,
                    to: contentEnd,
                    deco: Decoration.mark({ class: "lp-note-content" }),
                  });
                }

                // 依然隱藏前後標記
                lineDecos.push({
                  from: line.from,
                  to: contentStart,
                  deco: hiddenDeco,
                });
                lineDecos.push({
                  from: contentEnd,
                  to: line.to,
                  deco: hiddenDeco,
                });
              }
            } else if (
              COLOR_TAG_REGEX.test(trimmed) ||
              SUMMARY_REGEX.test(trimmed)
            ) {
              // Tags
              if (!isCursorOnLine) {
                lpClass = LP_CLASSES.SYMBOL; // This will trigger hiding via our CSS
                shouldHideMarker = true;
              }
              currentType = "EMPTY";
            } else if (SCENE_REGEX.test(text)) {
              lpClass = LP_CLASSES.SCENE;
              currentType = "SCENE";
              if (
                !isCursorOnLine &&
                (text.startsWith(".") || text.startsWith("###"))
              ) {
                shouldHideMarker = true;
              }
            } else if (TRANSITION_REGEX.test(text)) {
              lpClass = LP_CLASSES.TRANSITION;
              currentType = "TRANSITION";
            } else if (OS_DIALOGUE_REGEX.test(text)) {
              lpClass = LP_CLASSES.PARENTHETICAL;
              currentType = "PARENTHETICAL";
            } else if (PARENTHETICAL_REGEX.test(text)) {
              lpClass = LP_CLASSES.PARENTHETICAL;
              currentType = "PARENTHETICAL";
            } else {
              // Use centralized strict detection
              const format = plugin.detectExplicitFormat(trimmed);
              if (format && format.typeKey === "CHARACTER") {
                lpClass = LP_CLASSES.CHARACTER;
                currentType = "CHARACTER";
                if (
                  !isCursorOnLine &&
                  text.startsWith(SCRIPT_MARKERS.CHARACTER)
                ) {
                  shouldHideMarker = true;
                }
              } else if (
                previousType === "CHARACTER" ||
                previousType === "PARENTHETICAL" ||
                previousType === "DIALOGUE"
              ) {
                lpClass = LP_CLASSES.DIALOGUE;
                currentType = "DIALOGUE";
              } else {
                currentType = "ACTION";
              }
            }

            if (lpClass) {
              builder.add(
                line.from,
                line.from,
                Decoration.line({
                  attributes: { class: lpClass },
                })
              );
            }

            if (shouldHideMarker) {
              const format = plugin.detectExplicitFormat(text);
              const markerLen = format?.markerLength || 1;
              lineDecos.push({
                from: line.from,
                to: line.from + markerLen,
                deco: hiddenDeco,
              });
            }

            // Add all collected mark decorations in correct order
            lineDecos
              .sort((a, b) => a.from - b.from)
              .forEach((d) => {
                if (d.from < d.to) {
                  // Safety check
                  builder.add(d.from, d.to, d.deco);
                }
              });

            previousType = currentType;
            pos = line.to + 1;
          }
        }
        return builder.finish();
      }
    },
    {
      decorations: (v) => v.decorations,
    }
  );
}
