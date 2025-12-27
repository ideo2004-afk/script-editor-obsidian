import { Plugin, MarkdownView, Editor, Menu, App, PluginSettingTab, Setting, MenuItem, TFile, TFolder, Notice, WorkspaceLeaf, editorLivePreviewField } from 'obsidian';
import { DocxExporter } from './docxExporter';
import { RangeSetBuilder } from '@codemirror/state';
import { Decoration, DecorationSet, EditorView, ViewPlugin, ViewUpdate } from '@codemirror/view';
import { SceneView, SCENE_VIEW_TYPE } from './sceneView';
import { StoryBoardView, STORYBOARD_VIEW_TYPE } from './storyBoardView';

// Script Symbols
const SCRIPT_MARKERS = {
    CHARACTER: '@',
    PARENTHETICAL: '(',
};

// Regex Definitions
export const SCENE_REGEX = /^(\d+[.\s]\s*)?((?:INT|EXT|INT\/EXT|I\/E)[.\s]|\.[^.])/i;
export const TRANSITION_REGEX = /^((?:FADE (?:IN|OUT)|[A-Z\s]+ TO)(?:[:.]?))$/;
export const PARENTHETICAL_REGEX = /^(\(|（).+(\)|）)\s*$/i;
export const OS_DIALOGUE_REGEX = /^(OS|VO|ＯＳ|ＶＯ)[:：]\s*/i;
export const CHARACTER_COLON_REGEX = /^([\u4e00-\u9fa5A-Z0-9\s-]{1,30})([:：])\s*(.*)$/;
export const COLOR_TAG_REGEX = /^\[\[color:\s*(red|blue|green|yellow|purple|none|无|無)\]\]$/i;
export const SUMMARY_REGEX = /^\[\[summary:\s*(.*)\]\]$/i;

// CSS Classes (Reading Mode / PDF)
const CSS_CLASSES = {
    SCENE: 'script-scene',
    CHARACTER: 'script-character',
    DIALOGUE: 'script-dialogue',
    PARENTHETICAL: 'script-parenthetical',
    TRANSITION: 'script-transition',
    ACTION: 'script-action'
};

// LP Classes (Live Preview / Editing Mode)
const LP_CLASSES = {
    SCENE: 'lp-scene',
    CHARACTER: 'lp-character',
    DIALOGUE: 'lp-dialogue',
    PARENTHETICAL: 'lp-parenthetical',
    TRANSITION: 'lp-transition',
    SYMBOL: 'lp-marker-symbol'
}

interface ScriptFormat {
    cssClass: string;
    removePrefix: boolean;
    markerLength: number;
    typeKey: string;
}

interface ScriptEditorSettings {
    mySetting: string;
    geminiApiKey: string;
}

const DEFAULT_SETTINGS: ScriptEditorSettings = {
    mySetting: 'default',
    geminiApiKey: ''
}

interface ExtendedMenuItem extends MenuItem {
    setSubmenu(): Menu;
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

        // 2. Command: Renumber Scenes
        this.addCommand({
            id: 'renumber-scenes',
            name: 'Renumber scenes',
            editorCallback: (editor: Editor) => this.renumberScenes(editor)
        });

        // 2a. New Script Command & Ribbon
        this.addRibbonIcon('scroll-text', 'New script', () => {
            this.createNewScript();
        });

        this.addCommand({
            id: 'create-new-script',
            name: 'Create new script',
            callback: () => this.createNewScript()
        });

        // 2b. Export to Docx Command
        this.addCommand({
            id: 'export-to-docx',
            name: 'Export current script to .docx',
            checkCallback: (checking: boolean) => {
                const view = this.app.workspace.getActiveViewOfType(MarkdownView);
                if (view) {
                    const fileCache = this.app.metadataCache.getFileCache(view.file!);
                    const cssClasses = fileCache?.frontmatter?.cssclasses;
                    const classesArray = Array.isArray(cssClasses) ? cssClasses : (typeof cssClasses === 'string' ? [cssClasses] : []);

                    if (classesArray.includes('fountain') || classesArray.includes('script')) {
                        if (!checking) {
                            this.exportFileToDocx(view.file!);
                        }
                        return true;
                    }
                }
                return false;
            }
        });

        this.addCommand({
            id: 'open-story-board',
            name: 'Open story board for current script',
            checkCallback: (checking: boolean) => {
                const view = this.app.workspace.getActiveViewOfType(MarkdownView);
                if (view && this.isScript(view.file)) {
                    if (!checking) {
                        this.openStoryBoard(view.leaf, view.file!);
                    }
                    return true;
                }
                return false;
            }
        });

        this.addCommand({
            id: 'show-scene-mode',
            name: 'Show scene mode',
            callback: () => this.activateView()
        });

        // 3. Post Processor (Reading Mode & PDF)
        this.registerMarkdownPostProcessor((element, context) => {
            const frontmatter = context.frontmatter;
            const cssClasses = frontmatter?.cssclasses;
            const classesArray = Array.isArray(cssClasses) ? cssClasses : (typeof cssClasses === 'string' ? [cssClasses] : []);

            if (!classesArray.includes('fountain') && !classesArray.includes('script')) {
                return;
            }

            // 1. Target only simple leaf elements (p, li)
            const leaves = element.querySelectorAll('p, li');

            leaves.forEach((leaf: HTMLElement) => {
                // 2. Prevent double-processing (idempotency)
                if (leaf.dataset.scriptProcessed) return;
                leaf.dataset.scriptProcessed = "true";

                const text = leaf.innerText || "";
                const trimmed = text.trim();

                // 3. Ignore standard Markdown headings or meta tags
                if (!trimmed ||
                    trimmed.startsWith('#') ||
                    COLOR_TAG_REGEX.test(trimmed) ||
                    SUMMARY_REGEX.test(trimmed)) {
                    return;
                }

                const format = this.detectExplicitFormat(trimmed);

                // 4. Apply classes based on script syntax
                if (format) {
                    leaf.addClass(format.cssClass);
                    // For characters with colon dialogue on same line
                    const colonMatch = trimmed.match(CHARACTER_COLON_REGEX);
                    if (format.typeKey === 'CHARACTER' && colonMatch) {
                        const [_, charName, colon, dialogueText] = colonMatch;
                        if (dialogueText.trim()) {
                            leaf.empty();
                            leaf.createSpan({ cls: 'script-character', text: charName + colon });
                            leaf.createDiv({ cls: 'script-dialogue', text: dialogueText.trim() });
                        }
                    }
                } else {
                    // Logic for Action lines (most text)
                    leaf.addClass(CSS_CLASSES.ACTION);
                }
            });
        });

        // 4. Editor Extension (Live Preview)
        this.registerEditorExtension(this.livePreviewExtension());

        // 5. Context Menu
        this.registerEvent(
            this.app.workspace.on("editor-menu", (menu: Menu, editor: Editor, view: MarkdownView) => {
                // Scope Check: Robust check using Metadata Cache instead of DOM
                const fileCache = view.file ? this.app.metadataCache.getFileCache(view.file) : null;
                const cssClasses = fileCache?.frontmatter?.cssclasses;
                const classesArray = Array.isArray(cssClasses) ? cssClasses : (typeof cssClasses === 'string' ? [cssClasses] : []);

                if (!classesArray.includes('fountain') && !classesArray.includes('script')) {
                    return;
                }

                menu.addItem((item: MenuItem) => {
                    item.setTitle("Script Editor").setIcon("film");
                    const subMenu = (item as ExtendedMenuItem).setSubmenu();

                    // Scene Heading Submenu
                    subMenu.addItem((startItem: MenuItem) => {
                        startItem.setTitle("Scene heading").setIcon("clapperboard");
                        const sceneMenu = (startItem as ExtendedMenuItem).setSubmenu();
                        sceneMenu.addItem((i: MenuItem) => i.setTitle("EXT.").onClick(() => this.insertText(editor, "EXT. ", false)));
                        sceneMenu.addItem((i: MenuItem) => i.setTitle("INT.").onClick(() => this.insertText(editor, "INT. ", false)));
                        sceneMenu.addItem((i: MenuItem) => i.setTitle("I/E.").onClick(() => this.insertText(editor, "INT./EXT. ", false)));
                    });

                    this.addMenuItem(subMenu, "Character (@)", "user", editor, SCRIPT_MARKERS.CHARACTER);
                    this.addMenuItem(subMenu, "Parenthetical ( ( )", "italic", editor, SCRIPT_MARKERS.PARENTHETICAL);

                    // Transition Submenu
                    subMenu.addItem((item: MenuItem) => {
                        item.setTitle("Transition").setIcon("arrow-right");
                        const m = (item as ExtendedMenuItem).setSubmenu();
                        m.addItem((i: MenuItem) => i.setTitle("CUT TO:").onClick(() => this.insertText(editor, "CUT TO:", true)));
                        m.addItem((i: MenuItem) => i.setTitle("FADE OUT.").onClick(() => this.insertText(editor, "FADE OUT.", true)));
                        m.addItem((i: MenuItem) => i.setTitle("FADE IN:").onClick(() => this.insertText(editor, "FADE IN:", true)));
                        m.addItem((i: MenuItem) => i.setTitle("DISSOLVE TO:").onClick(() => this.insertText(editor, "DISSOLVE TO:", true)));
                    });

                    subMenu.addSeparator();

                    subMenu.addItem((subItem: MenuItem) => {
                        subItem.setTitle("Renumber scenes").setIcon("list-ordered")
                            .onClick(() => this.renumberScenes(editor));
                    });

                    subMenu.addItem((subItem: MenuItem) => {
                        subItem.setTitle("Clear format").setIcon("eraser")
                            .onClick(() => this.clearLinePrefix(editor));
                    });

                    subMenu.addSeparator();

                    subMenu.addItem((subItem: MenuItem) => {
                        subItem.setTitle("Export to .docx").setIcon("file-output")
                            .onClick(() => this.exportFileToDocx(view.file!));
                    });
                });
            })
        );
        // 5a. Add Storyboard toggle to view header
        this.registerEvent(
            (this.app.workspace as any).on("view-actions-menu", (menu: Menu, view: any) => {
                if (view instanceof MarkdownView && this.isScript(view.file)) {
                    menu.addItem((item: MenuItem) => {
                        item.setTitle("Open Story Board")
                            .setIcon("layout-grid")
                            .onClick(() => this.openStoryBoard(view.leaf, view.file!));
                    });
                }
            })
        );

        // 6. File Explorer Context Menu
        this.registerEvent(
            this.app.workspace.on("file-menu", (menu: Menu, file: TFile | TFolder) => {
                if (file instanceof TFile && file.extension === 'md') {
                    const cache = this.app.metadataCache.getFileCache(file);
                    const cssClasses = cache?.frontmatter?.cssclasses;
                    const classesArray = Array.isArray(cssClasses) ? cssClasses : (typeof cssClasses === 'string' ? [cssClasses] : []);

                    if (classesArray.includes('fountain') || classesArray.includes('script')) {
                        menu.addItem((item) => {
                            item
                                .setTitle("Export to .docx")
                                .setIcon("file-output")
                                .onClick(async () => {
                                    await this.exportFileToDocx(file);
                                });
                        });
                    }
                }

                menu.addItem((item) => {
                    item
                        .setTitle("New script")
                        .setIcon("scroll-text")
                        .onClick(async () => {
                            let folderPath = "/";
                            if (file instanceof TFolder) {
                                folderPath = file.path;
                            } else if (file instanceof TFile) {
                                folderPath = file.parent?.path || "/";
                            }
                            await this.createNewScript(folderPath);
                        });
                });
            })
        );

        this.registerEvent(
            this.app.workspace.on('file-open', (file) => {
                const view = this.app.workspace.getActiveViewOfType(MarkdownView);
                if (view) {
                    const headerActions = view.containerEl.querySelector('.view-actions');
                    const existingBtn = headerActions?.querySelector('.script-editor-storyboard-action');

                    if (this.isScript(file)) {
                        // Show or create if script
                        if (!existingBtn && headerActions) {
                            const actionBtn = view.addAction("layout-grid", "Open Story Board", () => {
                                this.openStoryBoard(view.leaf, file!);
                            });
                            actionBtn.addClass('script-editor-storyboard-action');
                        } else if (existingBtn) {
                            (existingBtn as HTMLElement).style.display = '';
                        }
                    } else {
                        // Hide if not script
                        if (existingBtn) {
                            (existingBtn as HTMLElement).style.display = 'none';
                        }
                    }
                }
                this.refreshSceneView(false);
            })
        );
        this.registerEvent(
            this.app.metadataCache.on('changed', () => {
                this.refreshSceneView(true);
                this.refreshStoryBoard(true);
            })
        );

        // 7. Auto-initialize Scene View in Sidebar
        this.app.workspace.onLayoutReady(() => {
            this.initSceneView();
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
    // Live Preview Extension (CodeMirror 6)
    // ------------------------------------------------------------------
    livePreviewExtension() {
        const plugin = this;
        return ViewPlugin.fromClass(class {
            decorations: DecorationSet;

            constructor(view: EditorView) {
                this.decorations = this.buildDecorations(view);
            }

            update(update: ViewUpdate) {
                if (update.docChanged || update.viewportChanged || update.selectionSet) {
                    this.decorations = this.buildDecorations(update.view);
                }
            }

            buildDecorations(view: EditorView): DecorationSet {
                const builder = new RangeSetBuilder<Decoration>();
                const isScript = view.dom.closest('.fountain') || view.dom.closest('.script');
                if (!isScript) return builder.finish();

                // @ts-ignore
                const isLivePreview = view.state.field(editorLivePreviewField);

                const selection = view.state.selection;
                let previousType: string | null = null;
                const hiddenDeco = Decoration.mark({ class: LP_CLASSES.SYMBOL });

                for (const { from, to } of view.visibleRanges) {
                    for (let pos = from; pos <= to;) {
                        const line = view.state.doc.lineAt(pos);
                        const text = line.text;
                        const trimmed = text.trim();

                        let lpClass = null;
                        let currentType = 'ACTION';
                        let shouldHideMarker = false;

                        let isCursorOnLine = false;
                        for (const range of selection.ranges) {
                            if (range.head >= line.from && range.head <= line.to) {
                                isCursorOnLine = true;
                                break;
                            }
                        }

                        if (!trimmed) { // Empty lines
                            currentType = 'EMPTY';
                        }
                        else if (COLOR_TAG_REGEX.test(trimmed) || SUMMARY_REGEX.test(trimmed)) { // Tags
                            if (isLivePreview && !isCursorOnLine) {
                                lpClass = LP_CLASSES.SYMBOL; // This will trigger hiding via our CSS
                                shouldHideMarker = true;
                            }
                            currentType = 'EMPTY';
                        }
                        else if (SCENE_REGEX.test(text)) {
                            lpClass = LP_CLASSES.SCENE;
                            currentType = 'SCENE';
                            if (isLivePreview && !isCursorOnLine && text.startsWith('.')) {
                                shouldHideMarker = true;
                            }
                        }
                        else if (TRANSITION_REGEX.test(text)) {
                            lpClass = LP_CLASSES.TRANSITION;
                            currentType = 'TRANSITION';
                        }
                        else if (OS_DIALOGUE_REGEX.test(text)) {
                            lpClass = LP_CLASSES.PARENTHETICAL;
                            currentType = 'PARENTHETICAL';
                        }
                        else if (PARENTHETICAL_REGEX.test(text)) {
                            lpClass = LP_CLASSES.PARENTHETICAL;
                            currentType = 'PARENTHETICAL';
                        }
                        else {
                            // Use centralized strict detection
                            const format = plugin.detectExplicitFormat(trimmed);
                            if (format && format.typeKey === 'CHARACTER') {
                                lpClass = LP_CLASSES.CHARACTER;
                                currentType = 'CHARACTER';
                                if (isLivePreview && !isCursorOnLine && text.startsWith(SCRIPT_MARKERS.CHARACTER)) {
                                    shouldHideMarker = true;
                                }
                            } else if (previousType === 'CHARACTER' || previousType === 'PARENTHETICAL' || previousType === 'DIALOGUE') {
                                lpClass = LP_CLASSES.DIALOGUE;
                                currentType = 'DIALOGUE';
                            } else {
                                currentType = 'ACTION';
                            }
                        }

                        if (isLivePreview && lpClass) {
                            builder.add(line.from, line.from, Decoration.line({
                                attributes: { class: lpClass }
                            }));
                        }

                        if (isLivePreview && shouldHideMarker) {
                            builder.add(line.from, line.from + 1, hiddenDeco);
                        }

                        previousType = currentType;
                        pos = line.to + 1;
                    }
                }
                return builder.finish();
            }
        }, {
            decorations: v => v.decorations
        });
    }

    // ------------------------------------------------------------------
    // Core Logic
    // ------------------------------------------------------------------

    addMenuItem(menu: Menu | MenuItem, title: string, icon: string, editor: Editor, marker: string) {
        if (menu instanceof Menu) {
            menu.addItem((item: MenuItem) => {
                item.setTitle(title).setIcon(icon).onClick(() => this.toggleLinePrefix(editor, marker));
            });
        }
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

        // 2. Ends with a colon (captured by regex)
        const hasColon = CHARACTER_COLON_REGEX.test(text);

        // 3. Full English CAPS (Must contain at least one A-Z letter and no lowercase)
        const isAllCapsEng = /^(?=.*[A-Z])[A-Z0-9\s-]{2,30}(\s+\([^)]+\))?$/.test(text);

        if (hasColon || isAllCapsEng) {
            return { cssClass: CSS_CLASSES.CHARACTER, removePrefix: false, markerLength: 0, typeKey: 'CHARACTER' };
        }

        return null;

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

    clearLinePrefix(editor: Editor) {
        const cursor = editor.getCursor();
        const lineContent = editor.getLine(cursor.line);
        let newLineContent = lineContent;
        for (const marker of Object.values(SCRIPT_MARKERS)) {
            if (lineContent.trim().startsWith(marker)) {
                const matchIndex = lineContent.indexOf(marker);
                const before = lineContent.substring(0, matchIndex);
                const after = lineContent.substring(matchIndex + marker.length);
                newLineContent = before + after;
                editor.setLine(cursor.line, newLineContent);
                return;
            }
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
[[summary:  summary of this scene.]]
[[color: blue]]

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

class ScriptEditorSettingTab extends PluginSettingTab {
    plugin: ScriptEditorPlugin;

    constructor(app: App, plugin: ScriptEditorPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        new Setting(containerEl)
            .setName('Usage guide')
            .setHeading();

        new Setting(containerEl)
            .setName('AI Beat summary (Gemini 2.5 Flash)')
            .setDesc('Enable AI-powered scene summarization and generation. Get your free API key from Google AI Studio.')
            .addText(text => text
                .setPlaceholder('Enter your Gemini API key')
                .setValue(this.plugin.settings.geminiApiKey)
                .onChange(async (value) => {
                    this.plugin.settings.geminiApiKey = value.trim();
                    await this.plugin.saveSettings();
                })
                .inputEl.style.width = '350px');

        // 1. Basic Setup
        new Setting(containerEl)
            .setName('1. Basic setup')
            .setDesc('How to activate formatting for a note.')
            .setHeading();

        const setupInfo = containerEl.createDiv();
        setupInfo.createEl('p', { text: 'Add the following to your note\'s frontmatter (Properties) to enable screenplay mode:' });
        setupInfo.createEl('pre', { text: '---\ncssclasses: fountain\n---' });
        setupInfo.createEl('p', { text: 'Alternatively, you can use "cssclasses: script".' });

        containerEl.createEl('br');

        // 2. Quick creation & features
        new Setting(containerEl)
            .setName('2. Quick features')
            .setDesc('Automation and creation tools.')
            .setHeading();

        const featuresDiv = containerEl.createDiv();
        featuresDiv.createEl('li', { text: '✨ Story Board Mode: Activate the grid icon in the right sidebar for a holistic view of your script structure.' });
        featuresDiv.createEl('li', { text: '✨ AI Beat Summary: Instantly generate or update scene summaries using Gemini AI, either one-by-one or for the entire script.' });
        featuresDiv.createEl('li', { text: 'New Script Button: Click the quill/scroll icon in the left ribbon to create a new screenplay.' });
        featuresDiv.createEl('li', { text: 'Renumber Scenes: Right-click in the editor to re-order your scene numbers automatically.' });
        featuresDiv.createEl('li', { text: 'Professional Export: Right-click and choose "Export to .docx" for Hollywood-standard output.' });

        containerEl.createEl('br');

        // 3. Screenplay Syntax
        new Setting(containerEl)
            .setName('3. Screenplay syntax')
            .setDesc('Basic rules for Fountain-compatible formatting.')
            .setHeading();

        const syntaxDiv = containerEl.createDiv();

        const createRow = (title: string, syntax: string, desc: string) => {
            const p = syntaxDiv.createEl('p');
            p.createEl('strong', { text: title + ': ' });
            p.createEl('code', { text: syntax });
            p.createSpan({ text: ' — ' + desc });
        };

        createRow('Scene Heading', 'INT. / EXT.', 'Automatic bold & uppercase.');
        createRow('Character', '@NAME', 'Centered. "@" is hidden in preview.');
        createRow('Dialogue', 'Text below Character', 'Automatically indented.');
        createRow('Parenthetical', '(emotion) / OS: / VO:', 'Centered & italic.');
        createRow('Transition', 'CUT TO: / FADE IN', 'Right aligned.');

        containerEl.createEl('br');

        // 4. Support
        const supportDiv = containerEl.createEl('div', { attr: { style: 'margin-top: 20px; border-top: 1px solid var(--background-modifier-border); padding-top: 20px;' } });
        supportDiv.createEl('p', { text: 'If you enjoy using Script Editor, consider supporting its development!' });
        const link = supportDiv.createEl('a', { href: 'https://buymeacoffee.com/ideo2004c' });
        link.createEl('img', {
            attr: {
                src: 'https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png',
                style: 'height: 40px;'
            }
        });
    }
}
