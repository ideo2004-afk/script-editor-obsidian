import { Plugin, MarkdownView, Editor, Menu, App, PluginSettingTab, Setting, MenuItem } from 'obsidian';
import { RangeSetBuilder } from '@codemirror/state';
import { Decoration, DecorationSet, EditorView, ViewPlugin, ViewUpdate } from '@codemirror/view';

// Script Symbols
const SCRIPT_MARKERS = {
    CHARACTER: '@',
    PARENTHETICAL: '(',
};

// Regex Definitions
const SCENE_REGEX = /^(\d+[.\s]\s*)?((?:INT|EXT|INT\/EXT|I\/E)[.\s])/i;
const TRANSITION_REGEX = /^((?:FADE (?:IN|OUT)|[A-Z\s]+ TO)(?:[:.]?))$/;
const PARENTHETICAL_REGEX = /^(\(|（).+(\)|）)\s*$/i;
const OS_DIALOGUE_REGEX = /^(OS|VO|ＯＳ|ＶＯ)[:：]\s*/i;
const CHARACTER_COLON_REGEX = /^([\u4e00-\u9fa5A-Z0-9\s-]{1,30})[:：]\s*(.*)$/;

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

interface ExtendedMenuItem extends MenuItem {
    setSubmenu(): Menu;
}

export default class ScripterPlugin extends Plugin {
    onload() {
        // 1. Settings / Help Tab
        this.addSettingTab(new ScripterSettingTab(this.app, this));

        // 2. Command: Renumber Scenes
        this.addCommand({
            id: 'renumber-scenes',
            name: 'Renumber scenes',
            editorCallback: (editor: Editor) => this.renumberScenes(editor)
        });

        // 3. Post Processor (Reading Mode & PDF)
        this.registerMarkdownPostProcessor((element, context) => {
            // **Scope Check**: Only process if cssclasses includes 'fountain' or 'script'
            const frontmatter = context.frontmatter;
            const cssClasses = frontmatter?.cssclasses;
            const classesArray = Array.isArray(cssClasses) ? cssClasses : (typeof cssClasses === 'string' ? [cssClasses] : []);

            if (!classesArray.includes('fountain') && !classesArray.includes('script')) {
                return;
            }

            // Include 'li' to handle numbered lists
            const lines = Array.from(element.querySelectorAll('p, div, blockquote, li'));
            let previousType: string | null = null;

            for (let i = 0; i < lines.length; i++) {
                let p = lines[i] as HTMLElement;

                // Optimized Splitting Logic (Recursive Search for BR or Newline)
                // Used to support Character and Dialogue on the same line (separated by single line break).

                let splitNode: Node | null = null;
                let splitOffset = -1;

                // Helper to find split in children
                const findSplit = (nodes: NodeListOf<ChildNode> | Node[]): boolean => {
                    for (let j = 0; j < nodes.length; j++) {
                        const node = nodes[j];
                        if (node.nodeName === 'BR') {
                            splitNode = node;
                            return true;
                        }
                        if (node.nodeType === Node.TEXT_NODE && node.textContent) {
                            const nl = node.textContent.indexOf('\n');
                            if (nl !== -1) {
                                splitNode = node;
                                splitOffset = nl;
                                return true;
                            }
                        }
                        // Recursive check for spans/strong/em etc but NOT other blocks
                        if (node.hasChildNodes() && node.nodeName !== 'P' && node.nodeName !== 'DIV') {
                            if (findSplit(node.childNodes)) return true;
                        }
                    }
                    return false;
                };

                if (findSplit(p.childNodes)) {
                    // Split found at splitNode!

                    // 1. Extract Text Before Split (for Detection)
                    // We need to traverse from start of P until splitNode
                    let textBefore = "";

                    const collectText = (root: Node): boolean => {
                        for (let k = 0; k < root.childNodes.length; k++) {
                            const node = root.childNodes[k];
                            if (node === splitNode) {
                                if (splitOffset !== -1 && node.textContent) {
                                    textBefore += node.textContent.substring(0, splitOffset);
                                }
                                return true; // Stop collecting
                            }
                            if (node.contains(splitNode)) {
                                if (collectText(node)) return true;
                            } else {
                                textBefore += node.textContent || "";
                            }
                        }
                        return false;
                    };
                    collectText(p);
                    textBefore = textBefore.trim();

                    const firstFormat = this.detectExplicitFormat(textBefore);

                    if (firstFormat?.typeKey === 'CHARACTER') {

                        // Strategy: 
                        // 1. Clone the P element to create the Dialogue part (newP).
                        // 2. Remove everything BEFORE the split from newP.
                        // 3. Remove everything AFTER the split from old P.

                        // Action 1: Create Dialogue P (Clone to keep styles/spans)
                        const newP = p.cloneNode(true) as HTMLElement;
                        newP.className = ''; // clear classes
                        newP.addClass(CSS_CLASSES.DIALOGUE);

                        // Clean newP: Remove nodes until we hit the split (or equivalent ref)
                        // Note: splitNode in newP is different object than splitNode in p. 
                        // But structures are identical. We can match by index or strictly traverse.
                        // Simpler: Move nodes? No, recursive structure makes moving hard.
                        // Let's use Range to delete contents.

                        // Setup Range for newP (Delete Start -> Split)
                        // But we can't easily map splitNode to newP's splitNode.

                        // Alternative Strategy: Move nodes from P to newP starting from split.
                        // Since we found splitNode in P, let's use Range to extract the "Tail".

                        const range = document.createRange();
                        if (splitOffset !== -1) {
                            // Text Node Split
                            range.setStart(splitNode!, splitOffset + 1); // Skip the newline
                        } else {
                            // BR Element Split
                            range.setStartAfter(splitNode!);
                        }
                        range.setEndAfter(p.lastChild!);

                        const dialogueFragment = range.extractContents();

                        // Create newP and append dialogue
                        const dialogueP = createEl('p');
                        dialogueP.addClass(CSS_CLASSES.DIALOGUE);
                        dialogueP.appendChild(dialogueFragment);

                        // Cleanup original P (Character)
                        // Remove the split node itself (the \n or BR) if it remains
                        if (splitOffset !== -1) {
                            // Trim the text node in P
                            if (splitNode!.textContent) {
                                splitNode!.textContent = splitNode!.textContent.substring(0, splitOffset);
                            }
                        } else {
                            // Remove the BR element
                            if (splitNode && splitNode.parentNode) {
                                splitNode.parentNode.removeChild(splitNode);
                            }
                        }

                        // Apply Character Formatting to P
                        // Reset content slightly? No, DOM is now correct (Head + Split removed).
                        // Check if p is empty?
                        if (p.textContent?.trim()) {
                            this.applyFormatToElement(p, firstFormat);
                            previousType = 'CHARACTER';

                            // Insert Dialogue P
                            if (dialogueP.textContent?.trim()) {
                                p.insertAdjacentElement('afterend', dialogueP);
                                previousType = 'DIALOGUE';
                            }
                            continue;
                        }
                    }
                }

                // Normal Single Line Processing
                let text = p.textContent?.trim() || '';
                if (!text) {
                    previousType = null;
                    continue;
                }

                const explicitFormat = this.detectExplicitFormat(text);

                if (explicitFormat) {
                    // Specific Handling for same-line "Character: Dialogue"
                    const colonMatch = text.match(CHARACTER_COLON_REGEX);
                    if (colonMatch && colonMatch[2].trim()) {
                        // Split into Character and Dialogue
                        p.textContent = colonMatch[1] + (text.includes('：') ? '：' : ':');
                        this.applyFormatToElement(p, explicitFormat);

                        const dialogueP = createEl('p');
                        dialogueP.addClass(CSS_CLASSES.DIALOGUE);
                        dialogueP.textContent = colonMatch[2];
                        p.insertAdjacentElement('afterend', dialogueP);

                        previousType = 'DIALOGUE';
                        continue;
                    }

                    this.applyFormatToElement(p, explicitFormat);
                    previousType = explicitFormat.typeKey;
                } else {
                    // Auto-Dialogue Detection
                    // Only assume Dialogue if strictly following Character, Parenthetical, or previous Dialogue.
                    if (previousType === 'CHARACTER' || previousType === 'PARENTHETICAL' || previousType === 'DIALOGUE') {
                        p.addClass(CSS_CLASSES.DIALOGUE);
                        previousType = 'DIALOGUE';
                    } else {
                        p.addClass(CSS_CLASSES.ACTION);
                        previousType = 'ACTION';
                    }
                }

                // Parenthetical Inline Styling (Apply to Dialogue and Action)
                if (previousType === 'DIALOGUE' || previousType === 'ACTION') {
                    const html = p.innerHTML;
                    const replaced = html.replace(/(\(.*?\)|（.*?）)/g, '<span class="script-parenthetical-inline">$1</span>');
                    if (replaced !== html) {
                        p.innerHTML = replaced;
                    }
                }
            }
        });

        // 4. Editor Extension (Live Preview)
        this.registerEditorExtension(this.livePreviewExtension());

        // 5. Context Menu
        this.registerEvent(
            this.app.workspace.on("editor-menu", (menu: Menu, editor: Editor, view: MarkdownView) => {
                menu.addItem((item: MenuItem) => {
                    item.setTitle("Scripter").setIcon("film");
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
                });
            })
        );
    }

    onunload() {
        // cleanup
    }

    // ------------------------------------------------------------------
    // Live Preview Extension (CodeMirror 6)
    // ------------------------------------------------------------------
    livePreviewExtension() {
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

                        if (!trimmed) {
                            currentType = 'EMPTY';
                        }
                        else if (SCENE_REGEX.test(text)) {
                            lpClass = LP_CLASSES.SCENE;
                            currentType = 'SCENE';
                        }
                        else if (TRANSITION_REGEX.test(text)) {
                            lpClass = LP_CLASSES.TRANSITION;
                            currentType = 'TRANSITION';
                        }
                        else if (PARENTHETICAL_REGEX.test(text)) {
                            lpClass = LP_CLASSES.PARENTHETICAL;
                            currentType = 'PARENTHETICAL';
                        }
                        else if (text.startsWith(SCRIPT_MARKERS.CHARACTER) ||
                            (/^[A-Z0-9\s-]{1,30}(\s+\([^)]+\))?$/.test(text) && text.length > 0) ||
                            (/^[\u4e00-\u9fa5A-Z0-9\s-]{1,30}$/.test(text)) ||
                            CHARACTER_COLON_REGEX.test(text)) {
                            lpClass = LP_CLASSES.CHARACTER;
                            currentType = 'CHARACTER';
                            if (!isCursorOnLine && text.startsWith(SCRIPT_MARKERS.CHARACTER)) {
                                shouldHideMarker = true;
                            }
                        }
                        else if (OS_DIALOGUE_REGEX.test(text)) {
                            lpClass = LP_CLASSES.PARENTHETICAL;
                            currentType = 'PARENTHETICAL';
                        }
                        else {
                            if (previousType === 'CHARACTER' || previousType === 'PARENTHETICAL' || previousType === 'DIALOGUE') {
                                lpClass = LP_CLASSES.DIALOGUE;
                                currentType = 'DIALOGUE';
                            } else {
                                currentType = 'ACTION';
                            }
                        }

                        if (lpClass) {
                            builder.add(line.from, line.from, Decoration.line({
                                attributes: { class: lpClass }
                            }));
                        }

                        if (shouldHideMarker) {
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
            return { cssClass: CSS_CLASSES.SCENE, removePrefix: false, markerLength: 0, typeKey: 'SCENE' };
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
        if (text.startsWith(SCRIPT_MARKERS.CHARACTER))
            return { cssClass: CSS_CLASSES.CHARACTER, removePrefix: true, markerLength: 1, typeKey: 'CHARACTER' };

        // Implicit Character Detection (ALL CAPS English or 1-30 char Chinese/Mixed without punctuation)
        const isEnglishName = /^[A-Z0-9\s-]{1,30}(\s+\([^)]+\))?$/.test(text) && text.length > 0;
        const isChineseName = /^[\u4e00-\u9fa5A-Z0-9\s-]{1,30}$/.test(text) || CHARACTER_COLON_REGEX.test(text);

        if (isEnglishName || isChineseName) {
            return { cssClass: CSS_CLASSES.CHARACTER, removePrefix: false, markerLength: 0, typeKey: 'CHARACTER' };
        }

        return null;
    }

    applyFormatToElement(p: HTMLElement, format: ScriptFormat) {
        p.addClass(format.cssClass);
        if (format.removePrefix && format.markerLength > 0) {
            this.stripMarkerFromElement(p, format.markerLength);
        }
    }

    stripMarkerFromElement(element: HTMLElement, length: number) {
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
        const firstTextNode = walker.nextNode();
        if (firstTextNode) {
            let text = firstTextNode.textContent || '';
            const removeCount = length;
            if (text.length >= removeCount) {
                firstTextNode.textContent = text.substring(removeCount);
            }
        }
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
}

class ScripterSettingTab extends PluginSettingTab {
    plugin: ScripterPlugin;

    constructor(app: App, plugin: ScripterPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;

        containerEl.empty();

        new Setting(containerEl)
            .setName('Usage guide')
            .setHeading();

        // 1. Setup Instructions
        new Setting(containerEl)
            .setName('Getting started')
            .setDesc('How to activate screenplay formatting for a specific note.')
            .setHeading();

        const setupInfo = containerEl.createEl('div', { cls: 'setting-item-description' });
        setupInfo.createEl('p', { text: 'To enable Scripter features (Live Preview & Print Formatting), adds the following to your note\'s frontmatter (Properties):' });
        setupInfo.createEl('pre', { text: '---\ncssclasses: fountain\n---' });
        setupInfo.createEl('p', { text: 'Or use "script" instead of "fountain".' });

        containerEl.createEl('br');

        // 2. Syntax Guide
        new Setting(containerEl)
            .setName('Syntax reference')
            .setDesc('Basic rules for formatting your screenplay.')
            .setHeading();

        const syntaxDiv = containerEl.createEl('div');

        // Helper to format table rows
        const createRow = (title: string, syntax: string, desc: string) => {
            const p = syntaxDiv.createEl('p');
            p.createEl('strong', { text: title + ': ' });
            p.createEl('code', { text: syntax });
            p.createSpan({ text: ' — ' + desc });
        };

        createRow('Scene Heading', 'INT. / EXT.', 'Automatic bold & uppercase.');
        createRow('Character', '@NAME', 'Centered. "@" is hidden when not editing.');
        createRow('Dialogue', 'Text below Character', 'Automatically indented.');
        createRow('Parenthetical', '(emotion) / OS: / VO:', 'Centered & Italic.');
        createRow('Transition', 'CUT TO: / FADE IN', 'Right aligned.');

        containerEl.createEl('br');

        // 3. Support
        const supportDiv = containerEl.createEl('div', { attr: { style: 'margin-top: 20px; border-top: 1px solid var(--background-modifier-border); padding-top: 20px;' } });
        supportDiv.createEl('p', { text: 'If you enjoy using Scripter, consider support its development!' });
        const link = supportDiv.createEl('a', { href: 'https://buymeacoffee.com/ideo2004c' });
        link.createEl('img', {
            attr: {
                src: 'https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png',
                style: 'height: 40px;'
            }
        });
    }
}
