import { ItemView, WorkspaceLeaf, TFile, MarkdownView } from 'obsidian';
import { SCENE_REGEX } from './main';

export const SCENE_VIEW_TYPE = 'script-editor-scene-view';

export class SceneView extends ItemView {
    constructor(leaf: WorkspaceLeaf) {
        super(leaf);
    }

    getViewType(): string {
        return SCENE_VIEW_TYPE;
    }

    getDisplayText(): string {
        return 'Scene Mode';
    }

    getIcon(): string {
        return 'layout-list';
    }

    async onOpen() {
        this.updateView();
    }

    async onClose() {
        // Cleanup if needed
    }

    private lastFilePath: string | null = null;
    private foldedHeadings: Set<string> = new Set(); // Stores line numbers of folded headers as strings

    async updateView() {
        const container = this.containerEl.children[1] as HTMLElement;
        const file = this.app.workspace.getActiveFile();

        // Save scroll position if we are in the same file
        const scrollPos = (file && this.lastFilePath === file.path) ? container.scrollTop : 0;
        this.lastFilePath = file?.path || null;

        container.empty();
        container.addClass('scripter-scene-view-container');

        if (!file) {
            container.createEl('div', { text: 'No active file', cls: 'pane-empty' });
            return;
        }

        // Check if it's a script file
        const cache = this.app.metadataCache.getFileCache(file);
        const cssClasses = cache?.frontmatter?.cssclasses;
        const classesArray = Array.isArray(cssClasses) ? cssClasses : (typeof cssClasses === 'string' ? [cssClasses] : []);

        if (!classesArray.includes('fountain') && !classesArray.includes('script')) {
            container.createEl('div', { text: 'Not a script file (add "fountain" to cssclasses)', cls: 'pane-empty' });
            return;
        }

        const titleEl = container.createEl('div', { cls: 'scripter-scene-view-title' });
        titleEl.createEl('h4', { text: file.basename });

        const listEl = container.createEl('div', { cls: 'scripter-scene-view-list' });

        // Get content to parse scenes (since they aren't in metadataCache headers)
        const content = await this.app.vault.read(file);
        const lines = content.split('\n');

        // Get headers from cache
        const headings = cache?.headings || [];

        // Combine headings (H1-H3) and Scenes into a single sorted list
        const items: { line: number, text: string, type: string, level?: number, summary?: string }[] = [];

        // Add H1-H3
        headings.forEach(h => {
            if (h.level <= 3) {
                items.push({
                    line: h.position.start.line,
                    text: h.heading,
                    type: 'heading',
                    level: h.level
                });
            }
        });

        // Get settings - ensure 0 is respected
        const settings = (this.app as any).plugins.getPlugin('script-editor')?.settings;
        const summaryLength = settings !== undefined && settings.summaryLength !== undefined ? settings.summaryLength : 50;

        // Add Scenes
        lines.forEach((line, index) => {
            const trimmed = line.trim();
            if (SCENE_REGEX.test(trimmed)) {
                // Find summary: look ahead for the next X characters of non-empty text
                let summary = "";
                let scanIdx = index + 1;
                while (summary.length < summaryLength && scanIdx < lines.length) {
                    const scanLine = lines[scanIdx].trim();
                    if (scanLine && !SCENE_REGEX.test(scanLine) && !scanLine.startsWith('#')) {
                        // Clean up script markers for summary
                        const clean = scanLine.replace(/^[@.((（].+?[)）:]?|[:：]/g, '').trim();
                        summary += (summary ? " " : "") + clean;
                    }
                    if (SCENE_REGEX.test(scanLine) || scanLine.startsWith('#')) break;
                    scanIdx++;
                }
                if (summary.length > summaryLength) summary = summary.substring(0, summaryLength) + "...";

                items.push({
                    line: index,
                    text: trimmed,
                    type: 'scene',
                    summary: summary
                });
            }
        });

        // Sort by line number
        items.sort((a, b) => a.line - b.line);

        // Render items
        let currentFoldLevel: number | null = null;

        items.forEach(item => {
            // Check if we should skip this item due to a parent being folded
            if (currentFoldLevel !== null) {
                if (item.type === 'scene' || (item.level && item.level > currentFoldLevel)) {
                    return; // Skip this item
                } else {
                    currentFoldLevel = null; // Reached a heading of same or higher level
                }
            }

            const itemEl = listEl.createDiv({
                cls: `script-editor-scene-item script-editor-item-${item.type} ${item.level ? 'script-editor-item-h' + item.level : ''}`
            });

            // Add Folding Icon for H1 and H2
            if (item.type === 'heading' && (item.level === 1 || item.level === 2)) {
                const isFolded = this.foldedHeadings.has(item.line.toString());
                const foldIcon = itemEl.createSpan({
                    cls: `script-editor-fold-icon ${isFolded ? 'is-collapsed' : ''}`
                });
                foldIcon.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>`;

                foldIcon.onClickEvent((e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (isFolded) {
                        this.foldedHeadings.delete(item.line.toString());
                    } else {
                        this.foldedHeadings.add(item.line.toString());
                    }
                    this.updateView();
                });

                if (isFolded) currentFoldLevel = item.level;
            }

            const contentContainer = itemEl.createDiv({ cls: 'script-editor-scene-info' });

            const linkEl = contentContainer.createEl('a', {
                text: item.text,
                cls: 'script-editor-scene-link'
            });

            if (item.type === 'scene' && (item as any).summary) {
                contentContainer.createDiv({
                    text: (item as any).summary,
                    cls: 'script-editor-scene-summary'
                });
            }

            itemEl.onClickEvent((e) => {
                e.preventDefault();
                this.navToLine(file, item.line);
            });
        });

        if (items.length === 0) {
            listEl.createEl('div', { text: 'No headings or scenes found', cls: 'pane-empty' });
        }

        // Restore scroll position
        container.scrollTop = scrollPos;
    }

    private async navToLine(file: TFile, line: number) {
        const leaf = this.app.workspace.getMostRecentLeaf();
        if (leaf) {
            await leaf.openFile(file, { active: true });
            const view = leaf.view;
            if (view instanceof MarkdownView) {
                view.editor.setCursor({ line: line, ch: 0 });
                view.editor.focus();

                // Optional: Scroll to center
                const linePos = view.editor.getCursor();
                view.editor.scrollIntoView({ from: linePos, to: linePos }, true);
            }
        }
    }
}
