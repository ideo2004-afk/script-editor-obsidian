import { ItemView, WorkspaceLeaf, TFile, MarkdownView, Menu, setIcon, requestUrl, Notice, setTooltip } from "obsidian";
import { SCENE_REGEX, COLOR_TAG_REGEX, SUMMARY_REGEX } from "./main";

export const STORYBOARD_VIEW_TYPE = "script-editor-storyboard-view";

export class StoryBoardView extends ItemView {
    file: TFile | null = null;

    constructor(leaf: WorkspaceLeaf) {
        super(leaf);
    }

    getViewType() {
        return STORYBOARD_VIEW_TYPE;
    }

    getDisplayText() {
        return this.file ? `Story Board: ${this.file.basename}` : "Story Board";
    }

    getIcon() {
        return "layout-grid";
    }

    async setFile(file: TFile) {
        this.file = file;
        await this.updateView();
    }

    async setState(state: any, result: any): Promise<void> {
        if (state.file) {
            const file = this.app.vault.getAbstractFileByPath(state.file);
            if (file instanceof TFile) {
                this.file = file;
            }
        }
        await super.setState(state, result);
        await this.updateView();
    }

    async onOpen() {
        this.addAction("pencil", "Live View", async () => {
            if (this.file) {
                await this.leaf.setViewState({
                    type: "markdown",
                    state: {
                        file: this.file.path,
                        mode: "source"
                    }
                });
            }
        });

        this.addAction("book-open", "Reading Mode", async () => {
            if (this.file) {
                await this.leaf.setViewState({
                    type: "markdown",
                    state: {
                        file: this.file.path,
                        mode: "preview"
                    }
                });
            }
        });
    }

    async updateView() {
        const container = this.contentEl;
        if (!container) return;

        const scrollPos = container.scrollTop;
        container.empty();
        container.addClass('script-editor-storyboard-container');

        if (!this.file) {
            container.createEl('div', { text: 'No file selected', cls: 'pane-empty' });
            return;
        }

        // --- Block Parsing Logic ---
        const content = await this.app.vault.read(this.file);
        const lines = content.split('\n');

        // Find H1 if exists
        let displayTitle = this.file.basename;
        const h1Line = lines.find(line => line.trim().startsWith('# '));
        if (h1Line) {
            displayTitle = h1Line.trim().replace(/^#\s+/, '');
        }

        const headerEl = container.createDiv({ cls: 'storyboard-header' });
        headerEl.createEl('h2', { text: displayTitle });

        const bulkBtn = headerEl.createEl('button', {
            cls: 'storyboard-bulk-ai-btn mod-cta',
        });
        setTooltip(bulkBtn, "Analyze script and generate summaries for all scenes missing them.");
        const bulkBtnText = bulkBtn.createSpan({ text: 'AI Beat Summary ' });
        const bulkBtnIcon = bulkBtn.createSpan({ cls: 'storyboard-bulk-ai-icon' });
        setIcon(bulkBtnIcon, 'sparkles');

        bulkBtn.onclick = () => this.runBulkAIBeat(blocks);

        const summaryLength = 50;

        interface ScriptBlock {
            id: string;
            type: 'preamble' | 'h2' | 'scene';
            title: string;
            summary?: string; // Add this
            contentLines: string[];
            originalLine: number;
        }

        const blocks: ScriptBlock[] = [];
        let currentBlock: ScriptBlock = {
            id: Math.random().toString(36).substr(2, 9),
            type: 'preamble',
            title: '',
            contentLines: [],
            originalLine: 0
        };
        blocks.push(currentBlock);

        lines.forEach((line, index) => {
            const trimmed = line.trim();
            if (trimmed.startsWith('## ')) {
                currentBlock = {
                    id: Math.random().toString(36).substr(2, 9),
                    type: 'h2',
                    title: trimmed.replace(/^##\s+/, ''),
                    contentLines: [line],
                    originalLine: index
                };
                blocks.push(currentBlock);
            } else if (SCENE_REGEX.test(trimmed)) {
                currentBlock = {
                    id: Math.random().toString(36).substr(2, 9),
                    type: 'scene',
                    title: trimmed,
                    contentLines: [line],
                    originalLine: index
                };
                blocks.push(currentBlock);
            } else {
                currentBlock.contentLines.push(line);
            }
        });

        // --- Rendering Logic ---
        let currentGrid: HTMLElement | null = null;

        blocks.forEach((block, blockIdx) => {
            if (block.type === 'h2') {
                const h2Div = container.createDiv({ cls: 'storyboard-h2-section' });
                h2Div.createEl('h3', { text: block.title, cls: 'storyboard-h2-title' });
                currentGrid = h2Div.createDiv({ cls: 'storyboard-grid' });
            } else if (block.type === 'scene') {
                if (!currentGrid) {
                    currentGrid = container.createDiv({ cls: 'storyboard-grid' });
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

                    if (!explicitSummary && sLine && !sLine.startsWith('#')) {
                        // Regular content fallback
                        if (summary.length < summaryLength) {
                            const clean = sLine.replace(/^[@.((（].+?[)）:]?|[:：]|\[\[.*?\]\]|%%.*?%%/g, '').trim();
                            summary += (summary ? " " : "") + clean;
                        }
                    }
                }

                if (!explicitSummary && summary.length > summaryLength) {
                    summary = summary.substring(0, summaryLength) + "...";
                }

                const finalDisplaySummary = explicitSummary || summary;

                const cardEl = currentGrid.createDiv({ cls: `storyboard-card storyboard-card-color-${cardColor}` });
                cardEl.setAttribute('draggable', 'true');

                // Color Dot & Visual Picker
                const dotEl = cardEl.createDiv({ cls: 'storyboard-card-color-dot' });
                dotEl.addEventListener('click', (e: MouseEvent) => {
                    e.stopPropagation();

                    // Remove any existing pickers
                    container.querySelectorAll('.storyboard-color-picker').forEach(el => el.remove());

                    const picker = container.createDiv({ cls: 'storyboard-color-picker' });
                    const rect = cardEl.getBoundingClientRect();
                    const containerRect = container.getBoundingClientRect();

                    // Position the picker below the top-left corner
                    picker.style.top = `${rect.top - containerRect.top + 30}px`;
                    picker.style.left = `${rect.left - containerRect.left + 5}px`;

                    const colors = ['none', 'red', 'blue', 'green', 'yellow', 'purple'];
                    colors.forEach(c => {
                        const opt = picker.createDiv({
                            cls: `color-option color-option-${c} ${cardColor === c ? 'is-selected' : ''}`,
                            attr: { title: c === 'none' ? 'Clear Color' : c.toUpperCase() }
                        });

                        opt.addEventListener('click', async (ev) => {
                            ev.stopPropagation();
                            await this.updateBlockColor(blocks, blockIdx, c);
                            picker.remove();
                        });
                    });

                    // Auto-close picker when clicking elsewhere
                    const closeHandler = (ev: MouseEvent) => {
                        if (!picker.contains(ev.target as Node)) {
                            picker.remove();
                            document.removeEventListener('mousedown', closeHandler);
                        }
                    };
                    document.addEventListener('mousedown', closeHandler);
                });

                cardEl.createDiv({ text: block.title, cls: 'storyboard-card-title' });
                if (finalDisplaySummary) {
                    cardEl.createDiv({ text: finalDisplaySummary, cls: 'storyboard-card-summary' });
                }

                // Drag and Drop implementation
                cardEl.addEventListener('dragstart', (e) => {
                    (e as DragEvent).dataTransfer?.setData('text/plain', blockIdx.toString());
                    cardEl.addClass('is-dragging');
                });

                cardEl.addEventListener('dragend', () => {
                    cardEl.removeClass('is-dragging');
                    container.querySelectorAll('.storyboard-card').forEach(el => {
                        el.removeClass('drag-over-left', 'drag-over-right');
                    });
                });

                cardEl.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    const dragEvent = e as DragEvent;
                    const rect = cardEl.getBoundingClientRect();
                    const midX = rect.left + rect.width / 2;

                    cardEl.removeClass('drag-over-left', 'drag-over-right');
                    if (dragEvent.clientX < midX) {
                        cardEl.addClass('drag-over-left');
                    } else {
                        cardEl.addClass('drag-over-right');
                    }
                });

                cardEl.addEventListener('dragleave', () => {
                    cardEl.removeClass('drag-over-left', 'drag-over-right');
                });

                cardEl.addEventListener('drop', async (e) => {
                    e.preventDefault();
                    const fromIdx = parseInt((e as DragEvent).dataTransfer?.getData('text/plain') || "-1");
                    const rect = cardEl.getBoundingClientRect();
                    const midX = rect.left + rect.width / 2;
                    const dropOnRight = (e as DragEvent).clientX > midX;

                    let toIdx = blockIdx;
                    // If dropping on right, we increment toIdx to insert AFTER
                    if (dropOnRight) toIdx++;

                    if (fromIdx !== -1) {
                        // Adjust if we are moving forward to account for the removed element
                        let adjustedTo = toIdx;
                        if (fromIdx < toIdx) adjustedTo--;

                        if (fromIdx !== adjustedTo) {
                            await this.moveBlock(blocks, fromIdx, toIdx);
                        }
                    }
                });

                // Left-click only: navigate to line
                cardEl.addEventListener('click', (e: MouseEvent) => {
                    if (e.button === 0) {
                        this.navToLine(block.originalLine);
                    }
                });

                // Context Menu trigger logic
                const triggerMenu = (e: MouseEvent) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const menu = new Menu();

                    menu.addItem((item) => {
                        item.setTitle("AI Beat")
                            .setIcon("sparkles")
                            .onClick(() => this.runAIBeat(blocks, blockIdx));
                    });

                    menu.addItem((item) => {
                        item.setTitle("Edit Scene")
                            .setIcon("pencil")
                            .onClick(() => this.openEditModal(blocks, blockIdx));
                    });

                    menu.addSeparator();

                    menu.addItem((item) => {
                        item.setTitle("New Scene")
                            .setIcon("plus")
                            .onClick(() => this.insertNewScene(blocks, blockIdx));
                    });

                    menu.addItem((item) => {
                        item.setTitle("Duplicate Scene")
                            .setIcon("copy")
                            .onClick(() => this.duplicateScene(blocks, blockIdx));
                    });

                    menu.addSeparator();

                    menu.addItem((item) => {
                        item.setTitle("Delete Scene")
                            .setIcon("trash-2")
                            .onClick(() => this.confirmDeleteScene(blocks, blockIdx));
                    });

                    menu.showAtMouseEvent(e);
                };

                // Add menu button (visible on hover/mobile)
                const menuBtn = cardEl.createDiv({ cls: 'storyboard-card-menu-btn' });
                setIcon(menuBtn, 'menu');
                menuBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    triggerMenu(e);
                });

                // Standard right-click
                cardEl.addEventListener('contextmenu', (e) => {
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
            type: 'markdown',
            state: { file: this.file.path }
        });

        const view = leaf.view;
        if (view instanceof MarkdownView) {
            view.editor.setCursor({ line: line, ch: 0 });
            view.editor.focus();
            const linePos = view.editor.getCursor();
            view.editor.scrollIntoView({ from: linePos, to: linePos }, true);
        }
    }
    private async moveBlock(blocks: any[], fromIdx: number, toIdx: number) {
        const movedBlock = blocks[fromIdx];

        // Use a more predictable approach for insertion
        const tempBlocks = [...blocks];
        tempBlocks.splice(fromIdx, 1);

        // Recalculate insertion point in the shrunk array
        let adjustedTo = toIdx;
        if (fromIdx < toIdx) adjustedTo--;

        tempBlocks.splice(adjustedTo, 0, movedBlock);

        // Reconstruct file content
        const newContent = tempBlocks.map(b => b.contentLines.join('\n')).join('\n');

        if (this.file) {
            await this.app.vault.modify(this.file, newContent);
            setTimeout(() => {
                this.updateView();
            }, 50);
        }
    }
    private async updateBlockColor(blocks: any[], blockIdx: number, color: string) {
        const block = blocks[blockIdx];

        // Remove existing color tags
        block.contentLines = block.contentLines.filter((l: string) => !COLOR_TAG_REGEX.test(l.trim()));

        // Insert new color tag if not "none"
        if (color !== 'none') {
            // Insert after the scene heading (index 0)
            block.contentLines.splice(1, 0, `%%color: ${color}%%`);
        }

        // Reconstruct file content
        const newContent = blocks.map(b => b.contentLines.join('\n')).join('\n');

        if (this.file) {
            await this.app.vault.modify(this.file, newContent);
            setTimeout(() => {
                this.updateView();
            }, 50);
        }
    }

    // --- Scene Edit Modal ---
    private openEditModal(blocks: any[], blockIdx: number) {
        const block = blocks[blockIdx];
        const container = this.contentEl;

        // Extract existing summary vs color vs lines
        let existingSummary = "";
        let existingColorLine = "";
        let otherLines: string[] = [];
        // First line is always title
        const title = block.contentLines[0] || '';

        for (let i = 1; i < block.contentLines.length; i++) {
            const line = block.contentLines[i];
            const summaryMatch = line.match(SUMMARY_REGEX);
            const colorMatch = line.match(COLOR_TAG_REGEX);
            if (summaryMatch) {
                existingSummary = summaryMatch[1];
            } else if (colorMatch) {
                existingColorLine = line;
            } else {
                otherLines.push(line);
            }
        }

        // Create modal overlay
        const overlay = container.createDiv({ cls: 'storyboard-modal-overlay' });
        const modal = overlay.createDiv({ cls: 'storyboard-edit-modal' });

        // Modal Header
        const header = modal.createDiv({ cls: 'storyboard-modal-header' });
        header.createEl('h3', { text: 'Edit Scene' });

        // Body
        const body = modal.createDiv({ cls: 'storyboard-modal-body' });

        // Title
        body.createEl('div', { text: 'Scene Heading', cls: 'storyboard-modal-label' });
        const titleInput = body.createEl('input', {
            cls: 'storyboard-modal-title-input',
            attr: { type: 'text', placeholder: 'e.g. INT. KITCHEN - DAY' }
        });
        titleInput.value = title;
        titleInput.focus();

        // Summary
        body.createEl('div', { text: 'Summary (shown on Story Board)', cls: 'storyboard-modal-label' });
        const summaryInput = body.createEl('textarea', {
            cls: 'storyboard-modal-summary-input',
            attr: { placeholder: 'Brief summary of what happens...' }
        });
        summaryInput.value = existingSummary;

        // Content
        body.createEl('div', { text: 'Script Content', cls: 'storyboard-modal-label' });
        const textarea = body.createEl('textarea', { cls: 'storyboard-modal-textarea' });
        textarea.value = otherLines.join('\n');

        // Footer
        const footer = modal.createDiv({ cls: 'storyboard-modal-footer' });
        const saveBtn = footer.createEl('button', { text: 'Save', cls: 'mod-cta' });
        saveBtn.onclick = async () => {
            const finalLines = [titleInput.value];
            // Re-inject summary if not empty
            if (summaryInput.value.trim()) {
                finalLines.push(`%%summary: ${summaryInput.value.trim()}%%`);
            }
            // Re-inject color if it existed
            if (existingColorLine) {
                finalLines.push(existingColorLine);
            }
            finalLines.push(...textarea.value.split('\n'));

            block.contentLines = finalLines;
            const newContent = blocks.map(b => b.contentLines.join('\n')).join('\n');
            if (this.file) {
                await this.app.vault.modify(this.file, newContent);
                overlay.remove();
                this.updateView();
            }
        };

        const cancelBtn = footer.createEl('button', { text: 'Cancel' });
        cancelBtn.onclick = () => overlay.remove();

        // Close on overlay click
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) overlay.remove();
        });
    }

    // --- Insert New Scene ---
    private async insertNewScene(blocks: any[], afterIdx: number) {
        const newBlock = {
            id: Math.random().toString(36).substr(2, 9),
            type: 'scene',
            title: 'EXT. ',
            contentLines: ['EXT. ', ''],
            originalLine: 0
        };

        blocks.splice(afterIdx + 1, 0, newBlock);
        const newContent = blocks.map(b => b.contentLines.join('\n')).join('\n');

        if (this.file) {
            await this.app.vault.modify(this.file, newContent);
            this.updateView();
        }
    }

    // --- Duplicate Scene ---
    private async duplicateScene(blocks: any[], blockIdx: number) {
        const original = blocks[blockIdx];
        const duplicate = {
            id: Math.random().toString(36).substr(2, 9),
            type: original.type,
            title: original.title,
            contentLines: [...original.contentLines],
            originalLine: 0
        };

        blocks.splice(blockIdx + 1, 0, duplicate);
        const newContent = blocks.map(b => b.contentLines.join('\n')).join('\n');

        if (this.file) {
            await this.app.vault.modify(this.file, newContent);
            this.updateView();
        }
    }

    // --- Delete Scene with Confirmation ---
    private confirmDeleteScene(blocks: any[], blockIdx: number) {
        const block = blocks[blockIdx];
        const container = this.contentEl;

        // Create confirmation overlay
        const overlay = container.createDiv({ cls: 'storyboard-modal-overlay' });
        const modal = overlay.createDiv({ cls: 'storyboard-confirm-modal' });

        modal.createEl('p', { text: `Delete scene "${block.title}"?` });
        modal.createEl('p', { text: 'This action cannot be undone.', cls: 'storyboard-confirm-warning' });

        const footer = modal.createDiv({ cls: 'storyboard-modal-footer' });

        const deleteBtn = footer.createEl('button', { text: 'Delete', cls: 'mod-warning' });
        deleteBtn.onclick = async () => {
            blocks.splice(blockIdx, 1);
            const newContent = blocks.map(b => b.contentLines.join('\n')).join('\n');
            if (this.file) {
                await this.app.vault.modify(this.file, newContent);
                overlay.remove();
                this.updateView();
            }
        };

        const cancelBtn = footer.createEl('button', { text: 'Cancel' });
        cancelBtn.onclick = () => overlay.remove();

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) overlay.remove();
        });
    }

    private async runAIBeat(blocks: any[], blockIdx: number) {
        const settings = (this.app as any).plugins.getPlugin('script-editor')?.settings;
        const apiKey = settings?.geminiApiKey;

        if (!apiKey) {
            new Notice("Please set your Gemini API Key in settings first.");
            return;
        }

        const block = blocks[blockIdx];
        const content = block.contentLines.slice(1).join('\n').trim();
        const hasContent = content.length > 20; // Heuristic for if there's real content

        new Notice(hasContent ? "Generating AI summary..." : "Generating new scene from context...");

        let prompt = "";
        if (hasContent) {
            // Case A: Summary
            prompt = `Act as a professional Hollywood screenwriter and script doctor. 
Sumarize the following scene content into a concise BEAT.
Requirements:
1. Provide exactly ONE concise sentence summarising the scene.
2. The summary MUST be in the same language and script (e.g., Traditional Chinese, English, Japanese) as the provided Scene Content.
3. Do not include any other text, intros, or explanations.
Format: [Summary]

Scene Content:
${content}`;
        } else {
            // Case B: Generation from context
            const before = blocks.slice(Math.max(0, blockIdx - 5), blockIdx).map(b => b.contentLines.join('\n')).join('\n---\n');
            const after = blocks.slice(blockIdx + 1, Math.min(blocks.length, blockIdx + 6)).map(b => b.contentLines.join('\n')).join('\n---\n');

            prompt = `Act as a professional Hollywood screenwriter.
Based on the surrounding scenes (Context Before and After), generate a LOGICAL and EVOCATIVE new scene to fill this gap.
Requirements:
1. Provide a Scene Heading.
2. Provide a concise ONE-sentence summary of the new scene.
3. Provide initial script content (Action/Dialogue) in standard screenplay format.
4. ALL content (Heading, Summary, Script) MUST be in the same language and script as the provided Context (e.g. if the context is Traditional Chinese, respond in Traditional Chinese).

Format your response as:
TITLE: [Heading]
SUMMARY: [Summary]
CONTENT:
[Initial Script lines]

Context Before:
${before}

Context After:
${after}`;
        }

        try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
            const response = await requestUrl({
                url: url,
                method: 'POST',
                contentType: 'application/json',
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }]
                })
            });

            const data = response.json;
            const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

            if (!aiText) throw new Error("Empty response from AI");

            if (hasContent) {
                // Apply summary to existing block
                const cleanedText = aiText.trim().replace(/^Summary:\s*/i, '');

                // Remove old summary tags
                block.contentLines = block.contentLines.filter((l: string) => !SUMMARY_REGEX.test(l));
                // Insert new summary tag after title
                block.contentLines.splice(1, 0, `%%summary: ${cleanedText}%%`);
            } else {
                // Parse generated scene
                const titleMatch = aiText.match(/TITLE:\s*(.*)/i);
                const summaryMatch = aiText.match(/SUMMARY:\s*(.*)/i);
                const contentParts = aiText.split(/CONTENT:\s*/i);

                const newTitle = titleMatch ? titleMatch[1].trim() : (block.contentLines[0] || "INT. NEW SCENE - DAY");
                const newSummary = summaryMatch ? summaryMatch[1].trim() : "";
                const newContent = contentParts.length > 1 ? contentParts[1].trim() : "";

                block.contentLines = [newTitle];
                if (newSummary) block.contentLines.push(`%%summary: ${newSummary}%%`);
                if (newContent) block.contentLines.push(...newContent.split('\n'));
            }

            // Save and update
            const fullContent = blocks.map(b => b.contentLines.join('\n')).join('\n');
            if (this.file) {
                await this.app.vault.modify(this.file, fullContent);
                this.updateView();
                new Notice("AI Beat Generated!");
            }

        } catch (error) {
            console.error("Gemini AI Error:", error);
            new Notice("AI Generation failed. Check Console for details.");
        }
    }

    private async runBulkAIBeat(blocks: any[]) {
        const settings = (this.app as any).plugins.getPlugin('script-editor')?.settings;
        const apiKey = settings?.geminiApiKey;

        if (!apiKey) {
            new Notice("Please set your Gemini API Key in settings first.");
            return;
        }

        const scenesToProcess = blocks.slice(1).filter(b => b.type === 'scene' && !b.summary);
        if (scenesToProcess.length === 0) {
            new Notice("All scenes already have summaries!");
            return;
        }

        new Notice(`🤖 AI is analyzing ${scenesToProcess.length} scenes. Please wait...`);

        // Build a transcript of the whole script to give full context
        const transcript = blocks.map((b, idx) => {
            let text = `[BLOCK ${idx}] ${b.title}\n${b.contentLines.slice(1).join('\n')}`;
            if (b.type === 'scene' && !b.summary) {
                text += `\n(REQUEST_SUMMARY_FOR_THIS_BLOCK)`;
            }
            return text;
        }).join('\n\n---\n\n');

        const prompt = `Act as a professional Hollywood screenwriter. 
Below is a structured screenplay. 
Some blocks are marked with (REQUEST_SUMMARY_FOR_THIS_BLOCK). 
Please generate a concise ONE-sentence summary for each of those marked blocks.

Requirements:
1. Provide exactly ONE concise sentence per marked block.
2. The summary MUST be in the same language and script (e.g., Traditional Chinese, English) as the block's content.
3. Respond ONLY with a list of summaries in the following format:
BLOCK X: [Summary]

Screenplay:
${transcript}`;

        try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
            const response = await requestUrl({
                url: url,
                method: 'POST',
                contentType: 'application/json',
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }]
                })
            });

            const data = response.json;
            const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

            if (!aiText) throw new Error("Empty response from AI");

            // Parse lines like "BLOCK 5: summary text"
            const lines = aiText.split('\n');
            let successCount = 0;

            lines.forEach((line: string) => {
                const match = line.match(/BLOCK\s+(\d+):\s*(.*)/i);
                if (match) {
                    const idx = parseInt(match[1]);
                    const summary = match[2].trim();
                    if (blocks[idx] && blocks[idx].type === 'scene') {
                        // Double check if it already had one during this session? 
                        // No, we use our current memory array 'blocks'

                        // Clear existing summary tags if any (rare since we filtered for !b.summary)
                        blocks[idx].contentLines = blocks[idx].contentLines.filter((l: string) => !SUMMARY_REGEX.test(l));
                        // Insert new summary tag after title line
                        blocks[idx].contentLines.splice(1, 0, `%%summary: ${summary}%%`);
                        successCount++;
                    }
                }
            });

            if (successCount > 0) {
                const finalFullContent = blocks.map(b => b.contentLines.join('\n')).join('\n');
                if (this.file) {
                    await this.app.vault.modify(this.file, finalFullContent);
                    this.updateView();
                    new Notice(`✨ Batch Complete! Generated ${successCount} summaries.`);
                }
            } else {
                new Notice("AI process finished but no summaries could be parsed. Check developer console.");
                console.log("AI Response was:", aiText);
            }

        } catch (error) {
            console.error("Gemini Bulk Error:", error);
            new Notice("Batch AI failed. See console.");
        }
    }
}
