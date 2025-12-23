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

    async updateView() {
        const container = this.containerEl.children[1];
        container.empty();
        container.addClass('scripter-scene-view-container');

        const file = this.app.workspace.getActiveFile();
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
        const items: { line: number, text: string, type: string, level?: number }[] = [];

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

        // Add Scenes
        lines.forEach((line, index) => {
            const trimmed = line.trim();
            if (SCENE_REGEX.test(trimmed)) {
                items.push({
                    line: index,
                    text: trimmed,
                    type: 'scene'
                });
            }
        });

        // Sort by line number
        items.sort((a, b) => a.line - b.line);

        // Render items
        items.forEach(item => {
            const itemEl = listEl.createDiv({
                cls: `script-editor-scene-item script-editor-item-${item.type} ${item.level ? 'script-editor-item-h' + item.level : ''}`
            });

            const linkEl = itemEl.createEl('a', {
                text: item.text,
                cls: 'script-editor-scene-link'
            });

            linkEl.onClickEvent((e) => {
                e.preventDefault();
                this.navToLine(file, item.line);
            });
        });

        if (items.length === 0) {
            listEl.createEl('div', { text: 'No headings or scenes found', cls: 'pane-empty' });
        }
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
