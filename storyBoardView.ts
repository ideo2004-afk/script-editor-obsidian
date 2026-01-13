import {
  ItemView,
  WorkspaceLeaf,
  TFile,
  MarkdownView,
  Menu,
  setIcon,
  Notice,
} from "obsidian";
import ScriptEditorPlugin, {
  SCENE_REGEX,
  COLOR_TAG_REGEX,
  SUMMARY_REGEX,
} from "./main";
import { GeminiService } from "./ai";

export const STORYBOARD_VIEW_TYPE = "script-editor-storyboard-view";

interface ScriptBlock {
  id: string;
  type: "preamble" | "h2" | "scene";
  title: string;
  summary?: string;
  contentLines: string[];
  originalLine: number;
}

export class StoryBoardView extends ItemView {
  file: TFile | null = null;
  collapsedSections: Set<string> = new Set();
  plugin: ScriptEditorPlugin;

  constructor(leaf: WorkspaceLeaf, plugin: ScriptEditorPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType() {
    return STORYBOARD_VIEW_TYPE;
  }

  getDisplayText() {
    return this.file ? `Story board: ${this.file.basename}` : "Story board";
  }

  getIcon() {
    return "layout-grid";
  }

  async setFile(file: TFile) {
    this.file = file;
    await this.updateView();
  }

  async onOpen(): Promise<void> {
    await Promise.resolve(); // Satisfy async requirement
    this.addAction("pencil", "Live view", async () => {
      if (this.file) {
        await this.leaf.setViewState({
          type: "markdown",
          state: {
            file: this.file.path,
            mode: "source",
          },
        });
      }
    });

    this.addAction("book-open", "Reading mode", async () => {
      if (this.file) {
        await this.leaf.setViewState({
          type: "markdown",
          state: {
            file: this.file.path,
            mode: "preview",
          },
        });
      }
    });
  }

  async updateView() {
    const container = this.contentEl;
    if (!container) return;

    const scrollPos = container.scrollTop;
    container.empty();
    container.addClass("script-editor-storyboard-container");

    if (!this.file) {
      container.createEl("div", {
        text: "No file selected",
        cls: "pane-empty",
      });
      return;
    }

    // --- Block Parsing Logic ---
    const content = await this.app.vault.read(this.file);
    const lines = content.split("\n");

    // Find H1 if exists
    let displayTitle = this.file.basename;
    const h1Line = lines.find((line) => line.trim().startsWith("# "));
    if (h1Line) {
      displayTitle = h1Line.trim().replace(/^#\s+/, "");
    }

    const headerEl = container.createDiv({ cls: "storyboard-header" });
    headerEl.createEl("h2", { text: displayTitle });

    // bulkBtn removed and moved to context menu for cleaner header

    const summaryLength = 50;

    const blocks: ScriptBlock[] = [];
    let currentBlock: ScriptBlock = {
      id: Math.random().toString(36).substring(2, 11),
      type: "preamble",
      title: "",
      contentLines: [],
      originalLine: 0,
    };
    blocks.push(currentBlock);

    lines.forEach((line, index) => {
      const trimmed = line.trim();
      if (trimmed.startsWith("## ")) {
        currentBlock = {
          id: Math.random().toString(36).substring(2, 11),
          type: "h2",
          title: trimmed.replace(/^##\s+/, ""),
          contentLines: [line],
          originalLine: index,
        };
        blocks.push(currentBlock);
      } else if (SCENE_REGEX.test(trimmed)) {
        currentBlock = {
          id: Math.random().toString(36).substring(2, 11),
          type: "scene",
          title: trimmed,
          contentLines: [line],
          originalLine: index,
        };
        blocks.push(currentBlock);
      } else {
        currentBlock.contentLines.push(line);
      }
    });

    // --- Rendering Logic ---
    let currentGrid: HTMLElement | null = null;

    blocks.forEach((block, blockIdx) => {
      if (block.type === "h2") {
        const isCollapsed = this.collapsedSections.has(block.title);
        const h2Div = container.createDiv({
          cls: `storyboard-h2-section ${isCollapsed ? "is-collapsed" : ""}`,
        });

        const h3 = h2Div.createEl("h3", { cls: "storyboard-h2-title" });

        const foldIconSpan = h3.createSpan({ cls: "storyboard-h2-fold-icon" });
        setIcon(foldIconSpan, isCollapsed ? "chevron-right" : "chevron-down");

        h3.createSpan({ text: block.title });

        h3.onclick = () => {
          if (isCollapsed) {
            this.collapsedSections.delete(block.title);
          } else {
            this.collapsedSections.add(block.title);
          }
          void this.updateView();
        };

        currentGrid = h2Div.createDiv({ cls: "storyboard-grid" });
      } else if (block.type === "scene") {
        if (!currentGrid) {
          currentGrid = container.createDiv({ cls: "storyboard-grid" });
        }

        let summary = "";
        let cardColor = "none";
        let explicitSummary = "";

        for (let i = 1; i < block.contentLines.length; i++) {
          const sLine = block.contentLines[i].trim();

          // Check Color Tag
          const colorMatch = sLine.match(COLOR_TAG_REGEX);
          if (colorMatch) {
            cardColor = colorMatch[1].toLowerCase();
            if (cardColor === "无" || cardColor === "無") cardColor = "none";
            continue;
          }

          // Check Summary Tag
          const summaryMatch = sLine.match(SUMMARY_REGEX);
          if (summaryMatch) {
            explicitSummary = summaryMatch[1];
            block.summary = explicitSummary;
            continue;
          }

          if (!explicitSummary && sLine && !sLine.startsWith("#")) {
            // Regular content fallback
            if (summary.length < summaryLength) {
              const clean = sLine
                .replace(/^[@.((（].+?[)）:]?|[:：]|\[\[.*?\]\]|%%.*?%%/g, "")
                .trim();
              summary += (summary ? " " : "") + clean;
            }
          }
        }

        if (!explicitSummary && summary.length > summaryLength) {
          summary = summary.substring(0, summaryLength) + "...";
        }

        const finalDisplaySummary = explicitSummary || summary;

        const cardEl = currentGrid.createDiv({
          cls: `storyboard-card storyboard-card-color-${cardColor}`,
        });
        cardEl.setAttribute("draggable", "true");

        // Color Dot & Visual Picker
        const dotEl = cardEl.createDiv({ cls: "storyboard-card-color-dot" });
        dotEl.addEventListener("click", (e: MouseEvent) => {
          e.stopPropagation();

          // Remove any existing pickers
          container
            .querySelectorAll(".storyboard-color-picker")
            .forEach((el) => el.remove());

          const picker = container.createDiv({
            cls: "storyboard-color-picker",
          });
          const rect = cardEl.getBoundingClientRect();
          const containerRect = container.getBoundingClientRect();

          // Position the picker below the top-left corner
          picker.setCssStyles({
            top: `${rect.top - containerRect.top + 30}px`,
            left: `${rect.left - containerRect.left + 5}px`,
          });

          const colors = ["none", "red", "blue", "green", "yellow", "purple"];
          colors.forEach((c) => {
            const opt = picker.createDiv({
              cls: `color-option color-option-${c} ${
                cardColor === c ? "is-selected" : ""
              }`,
              attr: { title: c === "none" ? "Clear color" : c.toUpperCase() },
            });

            opt.addEventListener("click", (ev) => {
              ev.stopPropagation();
              void this.updateBlockColor(blocks, blockIdx, c);
              picker.remove();
            });
          });

          // Auto-close picker when clicking elsewhere
          const closeHandler = (ev: MouseEvent) => {
            if (!picker.contains(ev.target as Node)) {
              picker.remove();
              document.removeEventListener("mousedown", closeHandler);
            }
          };
          document.addEventListener("mousedown", closeHandler);
        });

        const displayTitle = block.title
          .replace(/^###\s*/, "") // 移除開頭的 ###
          .trim();

        cardEl.createDiv({ text: displayTitle, cls: "storyboard-card-title" });
        if (finalDisplaySummary) {
          cardEl.createDiv({
            text: finalDisplaySummary,
            cls: "storyboard-card-summary",
          });
        }

        // Drag and Drop implementation
        cardEl.addEventListener("dragstart", (e: DragEvent) => {
          e.dataTransfer?.setData("text/plain", blockIdx.toString());
          cardEl.addClass("is-dragging");
        });

        cardEl.addEventListener("dragend", () => {
          cardEl.removeClass("is-dragging");
          container.querySelectorAll(".storyboard-card").forEach((el) => {
            el.removeClass("drag-over-left", "drag-over-right");
          });
        });

        cardEl.addEventListener("dragover", (e: DragEvent) => {
          e.preventDefault();
          const rect = cardEl.getBoundingClientRect();
          const midX = rect.left + rect.width / 2;

          cardEl.removeClass("drag-over-left", "drag-over-right");
          if (e.clientX < midX) {
            cardEl.addClass("drag-over-left");
          } else {
            cardEl.addClass("drag-over-right");
          }
        });

        cardEl.addEventListener("dragleave", () => {
          cardEl.removeClass("drag-over-left", "drag-over-right");
        });

        cardEl.addEventListener("drop", (e: DragEvent) => {
          e.preventDefault();
          const fromIdx = parseInt(
            e.dataTransfer?.getData("text/plain") || "-1"
          );
          const rect = cardEl.getBoundingClientRect();
          const midX = rect.left + rect.width / 2;
          const dropOnRight = e.clientX > midX;

          let toIdx = blockIdx;
          // If dropping on right, we increment toIdx to insert AFTER
          if (dropOnRight) toIdx++;

          if (fromIdx !== -1) {
            // Adjust if we are moving forward to account for the removed element
            let adjustedTo = toIdx;
            if (fromIdx < toIdx) adjustedTo--;

            if (fromIdx !== adjustedTo) {
              void this.moveBlock(blocks, fromIdx, toIdx);
            }
          }
        });

        // Left-click only: navigate to line
        cardEl.addEventListener("click", (e: MouseEvent) => {
          if (e.button === 0) {
            void this.navToLine(block.originalLine);
          }
        });

        // Context Menu trigger logic
        const triggerMenu = (e: MouseEvent) => {
          e.preventDefault();
          e.stopPropagation();
          const menu = new Menu();

          menu.addItem((item) => {
            item
              .setTitle("Summary this scene")
              .setIcon("sparkle")
              .onClick(() => {
                void this.runAIBeat(blocks, blockIdx);
              });
          });

          menu.addItem((item) => {
            item
              .setTitle("Summary all scenes")
              .setIcon("sparkles")
              .onClick(() => {
                void this.runBulkAIBeat(blocks);
              });
          });

          menu.addItem((item) => {
            item
              .setTitle("Edit scene")
              .setIcon("pencil")
              .onClick(() => {
                this.openEditModal(blocks, blockIdx);
              });
          });

          menu.addSeparator();

          menu.addItem((item) => {
            item
              .setTitle("New scene")
              .setIcon("plus")
              .onClick(() => {
                void this.insertNewScene(blocks, blockIdx);
              });
          });

          menu.addItem((item) => {
            item
              .setTitle("Duplicate scene")
              .setIcon("copy")
              .onClick(() => {
                void this.duplicateScene(blocks, blockIdx);
              });
          });

          menu.addSeparator();

          menu.addItem((item) => {
            item
              .setTitle("Delete scene")
              .setIcon("trash-2")
              .onClick(() => {
                this.confirmDeleteScene(blocks, blockIdx);
              });
          });

          menu.showAtMouseEvent(e);
        };

        // Add menu button (visible on hover/mobile)
        const menuBtn = cardEl.createDiv({ cls: "storyboard-card-menu-btn" });
        setIcon(menuBtn, "menu");
        menuBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          triggerMenu(e);
        });

        // Standard right-click
        cardEl.addEventListener("contextmenu", (e) => {
          triggerMenu(e);
        });
      }
    });

    container.scrollTop = scrollPos;
  }

  private async navToLine(line: number) {
    if (!this.file) return;

    // Switch back to markdown view and jump to line
    const leaf = this.leaf;
    await leaf.setViewState({
      type: "markdown",
      state: { file: this.file.path },
    });

    const view = leaf.view;
    if (view instanceof MarkdownView) {
      view.editor.setCursor({ line: line, ch: 0 });
      view.editor.focus();
      const linePos = view.editor.getCursor();
      view.editor.scrollIntoView({ from: linePos, to: linePos }, true);
    }
  }
  private async moveBlock(
    blocks: ScriptBlock[],
    fromIdx: number,
    toIdx: number
  ) {
    const movedBlock = blocks[fromIdx];

    // Use a more predictable approach for insertion
    const tempBlocks = [...blocks];
    tempBlocks.splice(fromIdx, 1);

    // Recalculate insertion point in the shrunk array
    let adjustedTo = toIdx;
    if (fromIdx < toIdx) adjustedTo--;

    tempBlocks.splice(adjustedTo, 0, movedBlock);

    // Reconstruct file content
    const newContent = tempBlocks
      .map((b) => b.contentLines.join("\n"))
      .join("\n");

    if (this.file) {
      await this.app.vault.modify(this.file, newContent);
      setTimeout(() => {
        void this.updateView();
      }, 50);
    }
  }
  private async updateBlockColor(
    blocks: ScriptBlock[],
    blockIdx: number,
    color: string
  ) {
    const block = blocks[blockIdx];

    // Remove existing color tags
    block.contentLines = block.contentLines.filter(
      (l: string) => !COLOR_TAG_REGEX.test(l.trim())
    );

    // Insert new color tag if not "none"
    if (color !== "none") {
      // Insert after the scene heading (index 0)
      block.contentLines.splice(1, 0, `%%color: ${color}%%`);
    }

    // Reconstruct file content
    const newContent = blocks.map((b) => b.contentLines.join("\n")).join("\n");

    if (this.file) {
      await this.app.vault.modify(this.file, newContent);
      setTimeout(() => {
        void this.updateView();
      }, 50);
    }
  }

  // --- Scene Edit Modal ---
  private openEditModal(blocks: ScriptBlock[], blockIdx: number) {
    const block = blocks[blockIdx];
    const container = this.contentEl;

    // Extract existing summary vs color vs lines
    let existingSummary = "";
    let existingColorLine = "";
    const otherLines: string[] = [];
    // First line is always title
    const title = block.contentLines[0] || "";

    for (let i = 1; i < block.contentLines.length; i++) {
      const line = block.contentLines[i];
      const trimmedLine = line.trim();
      const summaryMatch = trimmedLine.match(SUMMARY_REGEX);
      const colorMatch = trimmedLine.match(COLOR_TAG_REGEX);
      if (summaryMatch) {
        existingSummary = summaryMatch[1];
      } else if (colorMatch) {
        existingColorLine = line;
      } else {
        otherLines.push(line);
      }
    }

    // Create modal overlay
    const overlay = container.createDiv({ cls: "storyboard-modal-overlay" });
    const modal = overlay.createDiv({ cls: "storyboard-edit-modal" });

    // Modal Header
    const header = modal.createDiv({ cls: "storyboard-modal-header" });
    header.createEl("h3", { text: "Edit scene" });

    // Body
    const body = modal.createDiv({ cls: "storyboard-modal-body" });

    // Title
    body.createEl("div", {
      text: "Scene heading",
      cls: "storyboard-modal-label",
    });
    const titleInput = body.createEl("input", {
      cls: "storyboard-modal-title-input",
      attr: { type: "text", placeholder: "e.g. int. kitchen - day" },
    });
    titleInput.value = title;
    titleInput.focus();

    // Summary
    body.createEl("div", {
      text: "Summary (shown on story board)",
      cls: "storyboard-modal-label",
    });
    const summaryInput = body.createEl("textarea", {
      cls: "storyboard-modal-summary-input",
      attr: { placeholder: "Brief summary of what happens..." },
    });
    summaryInput.value = existingSummary;

    // Content
    body.createEl("div", {
      text: "Script content",
      cls: "storyboard-modal-label",
    });
    const textarea = body.createEl("textarea", {
      cls: "storyboard-modal-textarea",
    });
    textarea.value = otherLines.join("\n");

    // Footer
    const footer = modal.createDiv({ cls: "storyboard-modal-footer" });
    const saveBtn = footer.createEl("button", { text: "Save", cls: "mod-cta" });
    saveBtn.onclick = () => {
      void (async () => {
        const finalLines = [titleInput.value];
        // Re-inject summary if not empty
        if (summaryInput.value.trim()) {
          finalLines.push(`%%summary: ${summaryInput.value.trim()}%%`);
        }
        // Re-inject color if it existed
        if (existingColorLine) {
          finalLines.push(existingColorLine);
        }
        finalLines.push(...textarea.value.split("\n"));

        block.contentLines = finalLines;
        const newContent = blocks
          .map((b) => b.contentLines.join("\n"))
          .join("\n");
        if (this.file) {
          await this.app.vault.modify(this.file, newContent);
          overlay.remove();
          await this.updateView();
        }
      })();
    };

    const cancelBtn = footer.createEl("button", { text: "Cancel" });
    cancelBtn.onclick = () => overlay.remove();

    // Close on overlay click
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) overlay.remove();
    });
  }

  // --- Insert New Scene ---
  private async insertNewScene(blocks: ScriptBlock[], afterIdx: number) {
    const newBlock: ScriptBlock = {
      id: Math.random().toString(36).substring(2, 11),
      type: "scene",
      title: "EXT. ",
      contentLines: ["EXT. ", ""],
      originalLine: 0,
    };

    blocks.splice(afterIdx + 1, 0, newBlock);
    const newContent = blocks.map((b) => b.contentLines.join("\n")).join("\n");

    if (this.file) {
      await this.app.vault.modify(this.file, newContent);
      await this.updateView();
    }
  }

  // --- Duplicate Scene ---
  private async duplicateScene(blocks: ScriptBlock[], blockIdx: number) {
    const original = blocks[blockIdx];
    const duplicate: ScriptBlock = {
      id: Math.random().toString(36).substring(2, 11),
      type: original.type,
      title: original.title,
      contentLines: [...original.contentLines],
      originalLine: 0,
    };

    blocks.splice(blockIdx + 1, 0, duplicate);
    const newContent = blocks.map((b) => b.contentLines.join("\n")).join("\n");

    if (this.file) {
      await this.app.vault.modify(this.file, newContent);
      await this.updateView();
    }
  }

  // --- Delete Scene with Confirmation ---
  private confirmDeleteScene(blocks: ScriptBlock[], blockIdx: number) {
    const block = blocks[blockIdx];
    const container = this.contentEl;

    // Create confirmation overlay
    const overlay = container.createDiv({ cls: "storyboard-modal-overlay" });
    const modal = overlay.createDiv({ cls: "storyboard-confirm-modal" });

    modal.createEl("p", { text: `Delete scene "${block.title}"?` });
    modal.createEl("p", {
      text: "This action cannot be undone.",
      cls: "storyboard-confirm-warning",
    });

    const footer = modal.createDiv({ cls: "storyboard-modal-footer" });

    const deleteBtn = footer.createEl("button", {
      text: "Delete",
      cls: "mod-warning",
    });
    deleteBtn.onclick = () => {
      void (async () => {
        blocks.splice(blockIdx, 1);
        const newContent = blocks
          .map((b) => b.contentLines.join("\n"))
          .join("\n");
        if (this.file) {
          await this.app.vault.modify(this.file, newContent);
          overlay.remove();
          await this.updateView();
        }
      })();
    };

    const cancelBtn = footer.createEl("button", { text: "Cancel" });
    cancelBtn.onclick = () => overlay.remove();

    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) overlay.remove();
    });
  }

  private async runAIBeat(blocks: ScriptBlock[], blockIdx: number) {
    const apiKey = this.plugin.settings.geminiApiKey;

    if (!apiKey) {
      new Notice("Please set your API key in settings first.");
      return;
    }

    const gemini = new GeminiService(apiKey);
    const block = blocks[blockIdx];
    const content = block.contentLines.slice(1).join("\n").trim();
    const hasContent = content.length > 20;

    if (!hasContent) {
      new Notice(
        "Cannot generate AI beat: scene has no content. Please write something first."
      );
      return;
    }

    new Notice("Generating AI summary...");
    const response = await gemini.generateSceneSummary(content);

    if (response.error) {
      new Notice(`AI Error: ${response.error}`);
      return;
    }

    const aiText = response.text;

    // Apply summary to existing block
    const cleanedText = aiText
      .trim()
      .replace(/^Summary:\s*/i, "")
      .replace(/^\[|\]$/g, "") // Strip leading/trailing brackets
      .trim();
    block.contentLines = block.contentLines.filter(
      (l: string) => !SUMMARY_REGEX.test(l)
    );
    block.contentLines.splice(1, 0, `%%summary: ${cleanedText}%%`);

    const fullContent = blocks.map((b) => b.contentLines.join("\n")).join("\n");
    if (this.file) {
      await this.app.vault.modify(this.file, fullContent);
      await this.updateView();
      new Notice("AI beat generated!");
    }
  }

  private async runBulkAIBeat(blocks: ScriptBlock[]) {
    const apiKey = this.plugin.settings.geminiApiKey;

    if (!apiKey) {
      new Notice("Please set your API key in settings first.");
      return;
    }

    const scenesToProcess = blocks
      .slice(1)
      .filter((b) => b.type === "scene" && !b.summary);
    if (scenesToProcess.length === 0) {
      new Notice("All scenes already have summaries!");
      return;
    }

    new Notice(
      `🤖 AI is analyzing ${scenesToProcess.length} scenes. Please wait...`
    );

    const transcript = blocks
      .map((b, idx) => {
        let text = `[BLOCK ${idx}] ${b.title}\n${b.contentLines
          .slice(1)
          .join("\n")}`;
        if (b.type === "scene" && !b.summary) {
          text += `\n(REQUEST_SUMMARY_FOR_THIS_BLOCK)`;
        }
        return text;
      })
      .join("\n\n---\n\n");

    const gemini = new GeminiService(apiKey);
    const response = await gemini.generateBulkSummaries(transcript);

    if (response.error) {
      new Notice(`Batch AI Error: ${response.error}`);
      return;
    }

    const aiText = response.text;

    const lines = aiText.split("\n");
    let successCount = 0;

    lines.forEach((line: string) => {
      const match = line.match(/BLOCK\s+(\d+):\s*(.*)/i);
      if (match) {
        const idx = parseInt(match[1]);
        const summary = match[2].trim();
        if (blocks[idx] && blocks[idx].type === "scene") {
          blocks[idx].contentLines = blocks[idx].contentLines.filter(
            (l: string) => !SUMMARY_REGEX.test(l)
          );
          blocks[idx].contentLines.splice(1, 0, `%%summary: ${summary}%%`);
          successCount++;
        }
      }
    });

    if (successCount > 0) {
      const finalFullContent = blocks
        .map((b) => b.contentLines.join("\n"))
        .join("\n");
      if (this.file) {
        await this.app.vault.modify(this.file, finalFullContent);
        await this.updateView();
        new Notice(`✨ Batch Complete! Generated ${successCount} summaries.`);
      }
    } else {
      new Notice("AI process finished but no summaries could be parsed.");
    }
  }
}
