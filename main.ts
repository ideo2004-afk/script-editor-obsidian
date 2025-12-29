import { Plugin, MarkdownView, Editor, Menu, App, PluginSettingTab, Setting, MenuItem, TFile, TFolder, Notice, WorkspaceLeaf, editorLivePreviewField, EditorSuggest, EditorPosition, EditorSuggestTriggerInfo, EditorSuggestContext } from 'obsidian';
import { DocxExporter } from './docxExporter';
import { SceneView, SCENE_VIEW_TYPE } from './sceneView';
import { StoryBoardView, STORYBOARD_VIEW_TYPE } from './storyBoardView';
import { registerReadingView } from './readingView';
import { livePreviewExtension } from './editorExtension';
import { ScriptEditorSettings, DEFAULT_SETTINGS, ScriptEditorSettingTab } from './settings';
import { registerMenus, ExtendedMenuItem } from './menus';

// Script Symbols
export const SCRIPT_MARKERS = {
    CHARACTER: '@',
    PARENTHETICAL: '(',
};

// Regex Definitions
export const SCENE_REGEX = /^(\d+[.\s]\s*)?((?:INT|EXT|INT\/EXT|I\/E)[.\s]|\.[^.])/i;
export const TRANSITION_REGEX = /^((?:FADE (?:IN|OUT)|[A-Z\s]+ TO)(?:[:.]?))$/;
export const PARENTHETICAL_REGEX = /^(\(|（).+(\)|）)\s*$/i;
export const OS_DIALOGUE_REGEX = /^(OS|VO|ＯＳ|ＶＯ)[:：]\s*/i;
export const CHARACTER_COLON_REGEX = /^([\u4e00-\u9fa5A-Z0-9\s-]{1,30})([:：])\s*$/;
export const CHARACTER_CAPS_REGEX = /^(?=.*[A-Z])[A-Z0-9\s-]{2,30}(\s+\([^)]+\))?$/;
export const COLOR_TAG_REGEX = /^%%color:\s*(red|blue|green|yellow|purple|none|无|無)%%$/i;
export const SUMMARY_REGEX = /^%%summary:\s*(.*)%%$/i;
export const NOTE_REGEX = /^%%note:\s*(.*)%%$/i;

// CSS Classes (Reading Mode / PDF)
export const CSS_CLASSES = {
    SCENE: 'script-scene',
    CHARACTER: 'script-character',
    DIALOGUE: 'script-dialogue',
    PARENTHETICAL: 'script-parenthetical',
    TRANSITION: 'script-transition',
    ACTION: 'script-action'
};

// LP Classes (Live Preview / Editing Mode)
export const LP_CLASSES = {
    SCENE: 'lp-scene',
    CHARACTER: 'lp-character',
    DIALOGUE: 'lp-dialogue',
    PARENTHETICAL: 'lp-parenthetical',
    TRANSITION: 'lp-transition',
    NOTE: 'lp-note',
    SYMBOL: 'lp-marker-symbol'
}

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

        // 1. Register Scene View
        this.registerView(
            SCENE_VIEW_TYPE,
            (leaf) => new SceneView(leaf)
        );
        this.registerView(
            STORYBOARD_VIEW_TYPE,
            (leaf) => new StoryBoardView(leaf)
        );

        // 2. Settings / Help Tab
        await this.loadSettings();
        this.addSettingTab(new ScriptEditorSettingTab(this.app, this));

        // 2. UI Components (Commands, Ribbon, Menus)
        registerMenus(this);

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
                    const to = { line: cursor.line, ch: editor.getLine(cursor.line).length };

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

        this.registerEvent(
            this.app.metadataCache.on('changed', () => {
                this.refreshSceneView(true);
                this.refreshStoryBoard(true);
            })
        );

        // 7. Auto-initialize Scene View in Sidebar
        this.app.workspace.onLayoutReady(async () => {
            await this.initSceneView();
        });
    }
    async initSceneView() {
        if (this.app.workspace.getLeavesOfType(SCENE_VIEW_TYPE).length > 0) {
            return;
        }
        await this.app.workspace.getRightLeaf(false).setViewState({
            type: SCENE_VIEW_TYPE,
            active: false,
        });
    }

    async activateView() {
        const { workspace } = this.app;

        let leaf: WorkspaceLeaf | null = null;
        const leaves = workspace.getLeavesOfType(SCENE_VIEW_TYPE);

        if (leaves.length > 0) {
            leaf = leaves[0];
        } else {
            leaf = workspace.getRightLeaf(false);
            if (leaf) {
                await leaf.setViewState({ type: SCENE_VIEW_TYPE, active: true });
            }
        }

        if (leaf) {
            workspace.revealLeaf(leaf);
        }
    }

    private lastActiveFile: string | null = null;
    refreshSceneView(force = false) {
        const activeFile = this.app.workspace.getActiveFile();
        if (!force && activeFile?.path === this.lastActiveFile) {
            return; // Skip if just a focus change within the same file
        }
        this.lastActiveFile = activeFile?.path || null;

        const leaves = this.app.workspace.getLeavesOfType(SCENE_VIEW_TYPE);
        leaves.forEach(leaf => {
            if (leaf.view instanceof SceneView) {
                leaf.view.updateView();
            }
        });
    }
    refreshStoryBoard(force = false) {
        const activeFile = this.app.workspace.getActiveFile();
        const leaves = this.app.workspace.getLeavesOfType(STORYBOARD_VIEW_TYPE);

        leaves.forEach(leaf => {
            if (leaf.view instanceof StoryBoardView) {
                // If it's a metadata change, only refresh if the file matches
                if (force && leaf.view.file && activeFile?.path !== leaf.view.file.path) {
                    return;
                }
                leaf.view.updateView();
            }
        });
    }


    async openStoryBoard(leaf: WorkspaceLeaf, file: TFile) {
        await leaf.setViewState({
            type: STORYBOARD_VIEW_TYPE,
            active: true,
            state: { file: file.path }
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
        const classesArray = Array.isArray(cssClasses) ? cssClasses : (typeof cssClasses === 'string' ? [cssClasses] : []);
        return classesArray.includes('fountain') || classesArray.includes('script');
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
            const isForcedScene = text.startsWith('.');
            return {
                cssClass: CSS_CLASSES.SCENE,
                removePrefix: isForcedScene,
                markerLength: isForcedScene ? 1 : 0,
                typeKey: 'SCENE'
            };
        }
        if (TRANSITION_REGEX.test(text)) {
            return { cssClass: CSS_CLASSES.TRANSITION, removePrefix: false, markerLength: 0, typeKey: 'TRANSITION' };
        }
        if (PARENTHETICAL_REGEX.test(text)) {
            return { cssClass: CSS_CLASSES.PARENTHETICAL, removePrefix: false, markerLength: 0, typeKey: 'PARENTHETICAL' };
        }
        if (OS_DIALOGUE_REGEX.test(text)) {
            return { cssClass: CSS_CLASSES.PARENTHETICAL, removePrefix: false, markerLength: 0, typeKey: 'PARENTHETICAL' };
        }
        // Strict Character Identification:
        // 1. Starts with @
        if (text.startsWith(SCRIPT_MARKERS.CHARACTER))
            return { cssClass: CSS_CLASSES.CHARACTER, removePrefix: true, markerLength: 1, typeKey: 'CHARACTER' };

        // 2. Ends with a colon (standalone line, colon at end)
        const hasColon = CHARACTER_COLON_REGEX.test(text);

        // 3. Full English CAPS (Must contain at least one A-Z letter and no lowercase)
        const isAllCapsEng = CHARACTER_CAPS_REGEX.test(text);

        if (hasColon || isAllCapsEng) {
            return { cssClass: CSS_CLASSES.CHARACTER, removePrefix: false, markerLength: 0, typeKey: 'CHARACTER' };
        }

        return null;
    }

    renumberScenes(editor: Editor) {
        const lineCount = editor.lineCount();
        let sceneCounter = 0;

        for (let i = 0; i < lineCount; i++) {
            const line = editor.getLine(i);
            const trimmed = line.trim();
            const match = trimmed.match(SCENE_REGEX);
            if (match) {
                sceneCounter++;
                const sceneNumStr = sceneCounter.toString().padStart(2, '0') + ". ";
                let contentWithoutNumber = trimmed;
                if (match[1]) {
                    contentWithoutNumber = trimmed.replace(/^\d+[.\s]\s*/, '');
                }
                contentWithoutNumber = contentWithoutNumber.trim();
                const newLine = sceneNumStr + contentWithoutNumber;
                if (newLine !== line) {
                    editor.setLine(i, newLine);
                }
            }
        }
    }

    toggleLinePrefix(editor: Editor, prefix: string) {
        const cursor = editor.getCursor();
        const lineContent = editor.getLine(cursor.line);
        let newLineContent = lineContent;
        let hasMarker = false;

        for (const marker of Object.values(SCRIPT_MARKERS)) {
            if (lineContent.trim().startsWith(marker)) {
                const matchIndex = lineContent.indexOf(marker);
                const before = lineContent.substring(0, matchIndex);
                const after = lineContent.substring(matchIndex + marker.length);
                if (marker === prefix) {
                    newLineContent = before + after;
                    hasMarker = true;
                } else {
                    newLineContent = before + prefix + after;
                    hasMarker = true;
                }
                break;
            }
        }
        if (!hasMarker) newLineContent = prefix + lineContent;
        editor.setLine(cursor.line, newLineContent);
    }

    insertText(editor: Editor, text: string, replaceLine = false) {
        const cursor = editor.getCursor();
        const lineContent = editor.getLine(cursor.line);
        if (replaceLine) {
            editor.setLine(cursor.line, text);
        } else {
            editor.setLine(cursor.line, text + lineContent);
        }
    }



    async exportFileToDocx(file: TFile) {
        try {
            const content = await this.app.vault.read(file);
            const baseName = file.basename;
            const folderPath = file.parent?.path || "/";
            const fileName = `${baseName}.docx`;
            const filePath = folderPath === "/" ? fileName : `${folderPath}/${fileName}`;

            new Notice(`Exporting ${fileName}...`);
            const buffer = await DocxExporter.exportToDocx(content, baseName);

            // Convert Buffer to ArrayBuffer for writeBinary
            const arrayBuffer = (buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer);

            // Save the file
            await this.app.vault.adapter.writeBinary(filePath, arrayBuffer);
            new Notice(`Successfully exported to ${baseName}.docx`);
        } catch (error) {
            console.error("Export to DOCX failed:", error);
            new Notice(`Failed to export to DOCX: ${error.message}`);
        }
    }

    async exportSummary(file: TFile) {
        try {
            const content = await this.app.vault.read(file);
            const lines = content.split('\n');
            const baseName = file.basename;
            const folderPath = file.parent?.path || "/";
            const summaryFileName = `${baseName} Summary.md`;
            const summaryFilePath = folderPath === "/" ? summaryFileName : `${folderPath}/${summaryFileName}`;

            let summaryLines: string[] = [];
            let currentScene: string | null = null;

            lines.forEach((line) => {
                const trimmed = line.trim();

                // H1
                if (trimmed.startsWith('# ')) {
                    summaryLines.push(trimmed + '\n');
                }
                // H2
                else if (trimmed.startsWith('## ')) {
                    summaryLines.push('\n' + trimmed + '\n');
                }
                // Scene Heading
                else if (SCENE_REGEX.test(trimmed)) {
                    const match = trimmed.match(SCENE_REGEX);
                    // Extract Scene Number (Group 1)
                    if (match && match[1]) {
                        currentScene = match[1].trim(); // Only the number, e.g., "1."
                    } else {
                        currentScene = trimmed; // Fallback if no number
                    }
                }
                // Summary Tag
                else if (currentScene && SUMMARY_REGEX.test(trimmed)) {
                    const summaryMatch = trimmed.match(SUMMARY_REGEX);
                    if (summaryMatch) {
                        const sceneSummary = summaryMatch[1].trim();
                        // Format: Number Summary (e.g., 1. summary text)
                        summaryLines.push(`${currentScene} ${sceneSummary}\n`);
                        currentScene = null; // Found it, reset
                    }
                }
            });
            if (summaryLines.length === 0) {
                new Notice("No scenes with summaries found in the script.");
                return;
            }

            const finalContent = summaryLines.join('\n');

            // Create or overwrite the summary file
            const existingFile = this.app.vault.getAbstractFileByPath(summaryFilePath);
            if (existingFile instanceof TFile) {
                await this.app.vault.modify(existingFile, finalContent);
            } else {
                await this.app.vault.create(summaryFilePath, finalContent);
            }

            new Notice(`Successfully exported summary to ${summaryFileName}`);

            // Open the created summary file
            const newFile = this.app.vault.getAbstractFileByPath(summaryFilePath);
            if (newFile instanceof TFile) {
                const leaf = this.app.workspace.getLeaf(false);
                await leaf.openFile(newFile);
            }

        } catch (error) {
            console.error("Export summary failed:", error);
            new Notice(`Failed to export summary: ${error.message}`);
        }
    }

    async createNewScript(folderPath?: string) {
        let targetFolder = folderPath;
        if (!targetFolder) {
            const activeFile = this.app.workspace.getActiveFile();
            targetFolder = activeFile ? (activeFile.parent?.path || "/") : "/";
        }

        const baseName = "Untitled Script";
        let fileName = `${baseName}.md`;
        let filePath = targetFolder === "/" ? fileName : `${targetFolder}/${fileName}`;

        let counter = 1;
        while (await this.app.vault.adapter.exists(filePath)) {
            fileName = `${baseName} ${counter}.md`;
            filePath = targetFolder === "/" ? fileName : `${targetFolder}/${fileName}`;
            counter++;
        }

        let fileContent = `---
cssclasses:
- script
---


# YOUR TITLE HERE

Author: Your Name.
Genre: Monster in the House/Out of the Bottle/Superhero/etc.

**Screenplay syntax**: Basic rules for Fountain-compatible formatting.
- Scene Heading: 'INT. / EXT.' will automatic bold & uppercase.
- Character: '@NAME' \\ 'NAME' \\ 'NAME:', will centered. "@" is hidden in preview.'
- Dialogue: Text below Character, will automatically indented.
- Parenthetical: '(emotion) / OS: / VO:', will automatic centered & italic.
- Transition: 'CUT TO: / FADE IN', will right aligned.

To see the Script as a Story Board, choose **Open Story Board**.

In **Story Board** mode, you can press **AI Beat Summary**, auto generate all scene's summary or drag the cards of Story board.

---

## Act One

FADE IN:

EXT. scene 01
%%summary: summary of this scene.%%
%%color: blue%%

Here is Action description. Here is Action description. Here is Action description. 
Here is Action description. 

BOB:
It is too hard. I will never make

MARY:
You can make it.

CUT TO:

INT. scene 02

Here is Action description. Here is Action description. 

BOB:
It is too hard. I will never make

MARY:
You can make it.
`;

        const templateFile = this.app.vault.getAbstractFileByPath('Script Templet.md');
        if (templateFile instanceof TFile) {
            fileContent = await this.app.vault.read(templateFile);
        }

        const newFile = await this.app.vault.create(filePath, fileContent);

        const leaf = this.app.workspace.getLeaf(false);
        await leaf.openFile(newFile);

        // Optional: Trigger rename immediately for better UX
        // @ts-ignore - internal API
        this.app.workspace.trigger("rename", newFile, newFile.path);
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }
}


/**
 * Standalone helper to extract character names and frequencies from text.
 * Reuses detectExplicitFormat for consistent detection logic.
 */
function extractCharacterNames(content: string, plugin: ScriptEditorPlugin): Map<string, number> {
    const charCounts = new Map<string, number>();
    const lines = content.split('\n');

    lines.forEach(line => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.length > 50) return;

        // Reuse the core detection logic
        const format = plugin.detectExplicitFormat(trimmed);
        if (!format || format.typeKey !== 'CHARACTER') return;

        // Extract the character name based on the format
        let name = "";
        if (trimmed.startsWith(SCRIPT_MARKERS.CHARACTER)) {
            // @NAME format: remove the @ and take Everything after it
            name = trimmed.substring(1).trim();
        } else if (CHARACTER_COLON_REGEX.test(trimmed)) {
            // NAME: format: take the part before the colon
            const match = trimmed.match(CHARACTER_COLON_REGEX);
            if (match) name = match[1].trim();
        } else if (CHARACTER_CAPS_REGEX.test(trimmed)) {
            // ALL CAPS format: take the part before any parenthetical
            name = trimmed.split('(')[0].trim();
        }

        // Strip trailing colons from all names (handles edge cases like @男人/妻子：)
        name = name.replace(/[:：]+$/, '').trim();

        if (name && name.length > 0) {
            charCounts.set(name, (charCounts.get(name) || 0) + 1);
        }

    });

    return charCounts;
}



class CharacterSuggest extends EditorSuggest<string> {
    plugin: ScriptEditorPlugin;

    constructor(app: App, plugin: ScriptEditorPlugin) {
        super(app);
        this.plugin = plugin;
    }

    onTrigger(cursor: EditorPosition, editor: Editor, file: TFile): EditorSuggestTriggerInfo | null {
        // @ts-ignore - isScript is defined in the plugin class
        if (!this.plugin.isScript(file)) return null;

        const line = editor.getLine(cursor.line);
        const sub = line.substring(0, cursor.ch);
        const match = sub.match(/@([^ ]*)$/);

        if (match) {
            return {
                start: { line: cursor.line, ch: match.index! },
                end: { line: cursor.line, ch: cursor.ch },
                query: match[1]
            };
        }
        return null;
    }

    async getSuggestions(context: EditorSuggestContext): Promise<string[]> {
        const content = await this.app.vault.read(context.file);
        const charMap = extractCharacterNames(content, this.plugin);
        const query = context.query.toLowerCase();


        return Array.from(charMap.entries())
            .filter(([name]) => name.toLowerCase().includes(query))
            .sort((a, b) => b[1] - a[1]) // Frequency-based sorting
            .map(([name]) => name)
            .slice(0, 10); // Top 10 results
    }

    renderSuggestion(suggestion: string, el: HTMLElement): void {
        el.createEl("div", { text: suggestion });
    }

    selectSuggestion(suggestion: string, event: MouseEvent | KeyboardEvent): void {
        const { context } = this;
        if (context) {
            context.editor.replaceRange(`@${suggestion}`, context.start, context.end);
        }
    }
}
