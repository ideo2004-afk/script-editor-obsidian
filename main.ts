import { Plugin, Editor, TFile, WorkspaceLeaf } from "obsidian";
import { DocxExporter } from "./docxExporter";
import { StoryBoardView, STORYBOARD_VIEW_TYPE } from "./storyBoardView";
import { registerReadingView } from "./readingView";
import { livePreviewExtension } from "./editorExtension";
import {
  ScriptEditorSettings,
  DEFAULT_SETTINGS,
  ScriptEditorSettingTab,
} from "./settings";
import { registerMenus } from "./menus";
import { CharacterSuggest } from "./suggest";

// Script Symbols
export const SCRIPT_MARKERS = {
  CHARACTER: "@",
  PARENTHETICAL: "(",
};

// Regex Definitions
export const SCENE_REGEX =
  /^\s*(###\s+|(?:\d+[.\s]\s*)?(?:INT|EXT|INT\/EXT|I\/E)[.\s])/i;
export const TRANSITION_REGEX =
  /^\s*((?:FADE (?:IN|OUT)|[A-Z\s]+ TO)(?:[:.]?))$/;
export const PARENTHETICAL_REGEX = /^\s*([(（]).+([)）])\s*$/i;
export const OS_DIALOGUE_REGEX = /^\s*(OS|VO|ＯＳ|ＶＯ)[:：]\s*/i;
export const CHARACTER_COLON_REGEX =
  /^\s*([\u4e00-\u9fa5A-Z0-9\s-]{1,30}(?:\s*[(（].*?[)）])?)([:：])\s*$/;
export const CHARACTER_CAPS_REGEX =
  /^\s*(?=.*[A-Z])[A-Z0-9\s-]{1,30}(?:\s*[(（].*?[)）])?$/;
export const COLOR_TAG_REGEX =
  /^\s*%%color:\s*(red|blue|green|yellow|purple|none|无|無)\s*%%$/i;
export const SUMMARY_REGEX = /^\s*%%summary:\s*(.*?)\s*%%$/i;
export const NOTE_REGEX = /^\s*%%note:\s*(.*)%%$/i;

// CSS Classes (Reading Mode / PDF)
export const CSS_CLASSES = {
  SCENE: "script-scene",
  CHARACTER: "script-character",
  DIALOGUE: "script-dialogue",
  PARENTHETICAL: "script-parenthetical",
  TRANSITION: "script-transition",
  ACTION: "script-action",
};

// LP Classes (Live Preview / Editing Mode)
export const LP_CLASSES = {
  SCENE: "lp-scene",
  CHARACTER: "lp-character",
  DIALOGUE: "lp-dialogue",
  PARENTHETICAL: "lp-parenthetical",
  TRANSITION: "lp-transition",
  NOTE: "lp-note",
  SYMBOL: "lp-marker-symbol",
};

export interface ScriptFormat {
  cssClass: string;
  removePrefix: boolean;
  markerLength: number;
  typeKey: string;
}

export default class ScriptEditorPlugin extends Plugin {
  docxExporter: DocxExporter;
  settings: ScriptEditorSettings;

  async onload() {
    this.docxExporter = new DocxExporter();

    this.registerView(
      STORYBOARD_VIEW_TYPE,
      (leaf) => new StoryBoardView(leaf, this)
    );

    // 2. Settings / Help Tab
    await this.loadSettings();
    this.addSettingTab(new ScriptEditorSettingTab(this.app, this));

    // 3. Post Processor (Reading Mode & PDF)
    registerReadingView(this);

    // 4. Editor Extension (Live Preview)
    this.registerEditorExtension(livePreviewExtension(this));

    // 4a. Automatic Cleanup for Empty Notes
    this.registerEvent(
      this.app.workspace.on("editor-change", (editor: Editor) => {
        const lineCount = editor.lineCount();
        const cursor = editor.getCursor();

        // Only check the current line for performance and better UX
        const lineText = editor.getLine(cursor.line).trim();

        // If the line is EXACTLY the markers with no content
        if (lineText === "%%note:%%") {
          // Delete the line
          const from = { line: cursor.line, ch: 0 };
          const to = {
            line: cursor.line,
            ch: editor.getLine(cursor.line).length,
          };

          // If it's not the only line, try to include the newline
          if (lineCount > 1) {
            if (cursor.line < lineCount - 1) {
              to.line = cursor.line + 1;
              to.ch = 0;
            } else if (cursor.line > 0) {
              from.line = cursor.line - 1;
              from.ch = editor.getLine(from.line).length;
            }
          }

          editor.replaceRange("", from, to);
        }
      })
    );

    // 5. Context Menus & Buttons
    registerMenus(this);

    this.app.metadataCache.on("changed", () => {
      this.refreshStoryBoard(true);
    });

    // 6. 動態同步：處理檔案導航與分頁模式切換
    this.registerEvent(
      this.app.workspace.on("file-open", (file) => {
        if (!file || !(file instanceof TFile)) return;

        // 取得當前活動的分頁 (Active Leaf)
        const activeLeaf =
          this.app.workspace.getActiveViewOfType(StoryBoardView)?.leaf;

        if (activeLeaf && activeLeaf.view instanceof StoryBoardView) {
          // Use a simple boolean check instead of relying on the type guard to avoid 'never' narrowing
          const isScriptFile = this.isScript(file);
          if (isScriptFile) {
            // 如果還是劇本，直接更新內容
            void activeLeaf.view.setFile(file);
          } else {
            // 如果點選了非劇本檔案，則將此分頁變回編輯器模式 (選項 B 邏輯)
            void activeLeaf.setViewState({
              type: "markdown",
              state: { file: file.path },
            });
          }
          return; // 處理完活動分頁後，不需再掃描其他分頁
        }

        // --- 以下處理「非活動中」的背景 Storyboard 分頁（同步更新邏輯） ---
        const leaves = this.app.workspace.getLeavesOfType(STORYBOARD_VIEW_TYPE);
        leaves.forEach((leaf) => {
          if (leaf.view instanceof StoryBoardView) {
            // 只有當這個 Storyboard 分頁原本就裝著該檔案，或者它是對應的劇本才更新
            if (this.isScript(file)) {
              // 對於背景分頁，我們只在它「已經」開啟了該檔案的情況下才更新（或您希望背景也跟著切換？）
              // 這裡保留原本的彈性：如果背景分頁是 Storyboard，讓它載入目前開啟的檔案
              void leaf.view.setFile(file);
            }
          }
        });
      })
    );

    // 8. Register Character Suggest (Editor Logic)
    this.registerEditorSuggest(new CharacterSuggest(this.app, this));
  }
  refreshStoryBoard(force = false) {
    const activeFile = this.app.workspace.getActiveFile();
    const leaves = this.app.workspace.getLeavesOfType(STORYBOARD_VIEW_TYPE);

    leaves.forEach((leaf) => {
      if (leaf.view instanceof StoryBoardView) {
        // If it's a metadata change, only refresh if the file matches
        if (
          force &&
          leaf.view.file &&
          activeFile?.path !== leaf.view.file.path
        ) {
          return;
        }
        void leaf.view.updateView();
      }
    });
  }

  async openStoryBoard(leaf: WorkspaceLeaf, file: TFile) {
    await leaf.setViewState({
      type: STORYBOARD_VIEW_TYPE,
      active: true,
      state: { file: file.path },
    });
    const view = leaf.view;
    if (view instanceof StoryBoardView) {
      await view.setFile(file);
    }
  }

  isScript(file: TFile | null): boolean {
    if (!file) return false;
    const cache = this.app.metadataCache.getFileCache(file);
    const cssClasses = cache?.frontmatter?.cssclasses;
    const classesArray = Array.isArray(cssClasses)
      ? cssClasses
      : typeof cssClasses === "string"
      ? [cssClasses]
      : [];
    return classesArray.includes("fountain") || classesArray.includes("script");
  }

  onunload() {
    // cleanup
  }

  // ------------------------------------------------------------------
  // Core Logic
  // ------------------------------------------------------------------

  exportExplicitFormat(text: string): ScriptFormat | null {
    return this.detectExplicitFormat(text);
  }

  detectExplicitFormat(text: string): ScriptFormat | null {
    if (SCENE_REGEX.test(text)) {
      const isH3Scene = text.startsWith("###");
      return {
        cssClass: CSS_CLASSES.SCENE,
        removePrefix: isH3Scene,
        markerLength: isH3Scene ? 3 : 0,
        typeKey: "SCENE",
      };
    }
    if (TRANSITION_REGEX.test(text)) {
      return {
        cssClass: CSS_CLASSES.TRANSITION,
        removePrefix: false,
        markerLength: 0,
        typeKey: "TRANSITION",
      };
    }
    if (PARENTHETICAL_REGEX.test(text)) {
      return {
        cssClass: CSS_CLASSES.PARENTHETICAL,
        removePrefix: false,
        markerLength: 0,
        typeKey: "PARENTHETICAL",
      };
    }
    if (OS_DIALOGUE_REGEX.test(text)) {
      return {
        cssClass: CSS_CLASSES.PARENTHETICAL,
        removePrefix: false,
        markerLength: 0,
        typeKey: "PARENTHETICAL",
      };
    }
    // Strict Character Identification:
    // 1. Starts with @
    if (text.startsWith(SCRIPT_MARKERS.CHARACTER))
      return {
        cssClass: CSS_CLASSES.CHARACTER,
        removePrefix: true,
        markerLength: 1,
        typeKey: "CHARACTER",
      };

    // 2. Ends with a colon (standalone line, colon at end)
    const hasColon = CHARACTER_COLON_REGEX.test(text);

    // 3. Full English CAPS (Must contain at least one A-Z letter and no lowercase)
    const isAllCapsEng = CHARACTER_CAPS_REGEX.test(text);

    if (hasColon || isAllCapsEng) {
      return {
        cssClass: CSS_CLASSES.CHARACTER,
        removePrefix: false,
        markerLength: 0,
        typeKey: "CHARACTER",
      };
    }

    return null;
  }

  /**
   * 從原始文字中提取純淨的名字（去除 @, 冒號, 括號內容）
   */
  getCleanCharacterName(text: string): string {
    let name = text;
    if (name.startsWith(SCRIPT_MARKERS.CHARACTER)) name = name.substring(1);
    name = name.replace(/[:：]\s*$/, "");
    name = name.replace(/[(（].*?[)）]/g, "");
    return name.trim();
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}
