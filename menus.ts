import { Menu, MenuItem, Editor, MarkdownView, TFile, TFolder, WorkspaceLeaf, Notice } from 'obsidian';
import ScriptEditorPlugin, { SCRIPT_MARKERS, SCENE_REGEX, SUMMARY_REGEX } from './main';
import { SCENE_VIEW_TYPE } from './sceneView';
import { DocxExporter } from './docxExporter';

export interface ExtendedMenuItem extends MenuItem {
    setSubmenu(): Menu;
}

export function registerMenus(plugin: ScriptEditorPlugin) {
    const { app } = plugin;

    // 1. Ribbon Icon
    plugin.addRibbonIcon('scroll-text', 'New script', async () => {
        await createNewScript(plugin);
    });

    // 2. Commands
    plugin.addCommand({
        id: 'renumber-scenes',
        name: 'Renumber scenes',
        editorCallback: (editor: Editor) => renumberScenes(plugin, editor)
    });

    plugin.addCommand({
        id: 'create-new-script',
        name: 'Create new script',
        callback: async () => {
            await createNewScript(plugin);
        }
    });

    plugin.addCommand({
        id: 'export-to-docx',
        name: 'Export current script to .docx',
        checkCallback: (checking: boolean) => {
            const view = app.workspace.getActiveViewOfType(MarkdownView);
            if (view && plugin.isScript(view.file)) {
                if (!checking) {
                    void exportFileToDocx(plugin, view.file!);
                }
                return true;
            }
            return false;
        }
    });

    plugin.addCommand({
        id: 'open-story-board',
        name: 'Open story board for current script',
        checkCallback: (checking: boolean) => {
            const view = app.workspace.getActiveViewOfType(MarkdownView);
            if (view && plugin.isScript(view.file)) {
                if (!checking) {
                    void plugin.openStoryBoard(view.leaf, view.file!);
                }
                return true;
            }
            return false;
        }
    });

    plugin.addCommand({
        id: 'show-scene-mode',
        name: 'Show scene mode',
        callback: async () => {
            await plugin.activateView();
        }
    });

    plugin.addCommand({
        id: 'export-summary',
        name: 'Export scene summaries to .md',
        checkCallback: (checking: boolean) => {
            const view = app.workspace.getActiveViewOfType(MarkdownView);
            if (view && plugin.isScript(view.file)) {
                if (!checking) {
                    void exportSummary(plugin, view.file!);
                }
                return true;
            }
            return false;
        }
    });

    // 5. Context Menu
    plugin.registerEvent(
        app.workspace.on("editor-menu", (menu: Menu, editor: Editor, view: MarkdownView) => {
            if (!plugin.isScript(view.file)) return;

            menu.addItem((item: MenuItem) => {
                item.setTitle("Script Editor").setIcon("film");
                const subMenu = (item as ExtendedMenuItem).setSubmenu();

                // Scene Heading Submenu
                subMenu.addItem((startItem: MenuItem) => {
                    startItem.setTitle("Scene heading").setIcon("clapperboard");
                    const sceneMenu = (startItem as ExtendedMenuItem).setSubmenu();
                    sceneMenu.addItem((i: MenuItem) => i.setTitle("EXT.").onClick(() => insertText(editor, "EXT. ", false)));
                    sceneMenu.addItem((i: MenuItem) => i.setTitle("INT.").onClick(() => insertText(editor, "INT. ", false)));
                    sceneMenu.addItem((i: MenuItem) => i.setTitle("I/E.").onClick(() => insertText(editor, "INT./EXT. ", false)));
                });

                addMenuItem(subMenu, "Character (@)", "user", editor, SCRIPT_MARKERS.CHARACTER, plugin);
                addMenuItem(subMenu, "Parenthetical ( ( )", "italic", editor, SCRIPT_MARKERS.PARENTHETICAL, plugin);

                // Transition Submenu
                subMenu.addItem((item: MenuItem) => {
                    item.setTitle("Transition").setIcon("arrow-right");
                    const m = (item as ExtendedMenuItem).setSubmenu();
                    m.addItem((i: MenuItem) => i.setTitle("CUT TO:").onClick(() => insertText(editor, "CUT TO:", true)));
                    m.addItem((i: MenuItem) => i.setTitle("FADE OUT.").onClick(() => insertText(editor, "FADE OUT.", true)));
                    m.addItem((i: MenuItem) => i.setTitle("FADE IN:").onClick(() => insertText(editor, "FADE IN:", true)));
                    m.addItem((i: MenuItem) => i.setTitle("DISSOLVE TO:").onClick(() => insertText(editor, "DISSOLVE TO:", true)));
                });

                subMenu.addItem((item: MenuItem) => {
                    item.setTitle("Insert Note").setIcon("sticky-note")
                        .onClick(() => insertText(editor, "%%note: Note text here%%", true));
                });

                subMenu.addSeparator();

                subMenu.addItem((subItem: MenuItem) => {
                    subItem.setTitle("Renumber scenes").setIcon("list-ordered")
                        .onClick(() => renumberScenes(plugin, editor));
                });

                subMenu.addSeparator();

                subMenu.addItem((subItem: MenuItem) => {
                    subItem.setTitle("Export to .docx").setIcon("file-output")
                        .onClick(() => {
                            void exportFileToDocx(plugin, view.file!);
                        });
                });

                subMenu.addItem((subItem: MenuItem) => {
                    subItem.setTitle("Export summary").setIcon("file-text")
                        .onClick(() => {
                            void exportSummary(plugin, view.file!);
                        });
                });
            });
        })
    );

    // 5a. Add Storyboard toggle to view header
    plugin.registerEvent(
        (app.workspace as any).on("view-actions-menu", (menu: Menu, view: any) => {
            if (view instanceof MarkdownView && plugin.isScript(view.file)) {
                menu.addItem((item: MenuItem) => {
                    item.setTitle("Open Story Board")
                        .setIcon("layout-grid")
                        .onClick(() => {
                            void plugin.openStoryBoard(view.leaf, view.file!);
                        });
                });
            }
        })
    );

    // 6. File Explorer Context Menu
    plugin.registerEvent(
        app.workspace.on("file-menu", (menu: Menu, file: TFile | TFolder) => {
            if (file instanceof TFile && file.extension === 'md') {
                if (plugin.isScript(file)) {
                    menu.addItem((item) => {
                        item
                            .setTitle("Export to .docx")
                            .setIcon("file-output")
                            .onClick(async () => {
                                await exportFileToDocx(plugin, file);
                            });
                    });

                    menu.addItem((item) => {
                        item
                            .setTitle("Export summary")
                            .setIcon("file-text")
                            .onClick(async () => {
                                await exportSummary(plugin, file);
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
                        await createNewScript(plugin, folderPath);
                    });
            });
        })
    );

    // Dynamic header button management
    plugin.registerEvent(
        app.workspace.on('file-open', (file) => {
            const view = app.workspace.getActiveViewOfType(MarkdownView);
            if (view) {
                const headerActions = view.containerEl.querySelector('.view-actions');
                const existingBtn = headerActions?.querySelector('.script-editor-storyboard-action');

                if (plugin.isScript(file)) {
                    if (!existingBtn && headerActions) {
                        const actionBtn = view.addAction("layout-grid", "Open Story Board", () => {
                            void plugin.openStoryBoard(view.leaf, file!);
                        });
                        actionBtn.addClass('script-editor-storyboard-action');
                    } else if (existingBtn) {
                        (existingBtn as HTMLElement).style.display = '';
                    }
                } else {
                    if (existingBtn) {
                        (existingBtn as HTMLElement).style.display = 'none';
                    }
                }
            }
            plugin.refreshSceneView(false);
        })
    );
}

function addMenuItem(menu: Menu | MenuItem, title: string, icon: string, editor: Editor, marker: string, plugin: ScriptEditorPlugin) {
    if (menu instanceof Menu) {
        menu.addItem((item: MenuItem) => {
            item.setTitle(title).setIcon(icon).onClick(() => toggleLinePrefix(plugin, editor, marker));
        });
    }
}

// ------------------------------------------------------------------
// COMMAND IMPLEMENTATIONS (Extracted from main.ts)
// ------------------------------------------------------------------

export function renumberScenes(plugin: ScriptEditorPlugin, editor: Editor) {
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

export function toggleLinePrefix(plugin: ScriptEditorPlugin, editor: Editor, prefix: string) {
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

export function insertText(editor: Editor, text: string, replaceLine = false) {
    const cursor = editor.getCursor();
    const lineContent = editor.getLine(cursor.line);
    if (replaceLine) {
        editor.setLine(cursor.line, text);
    } else {
        editor.setLine(cursor.line, text + lineContent);
    }
}

export async function exportFileToDocx(plugin: ScriptEditorPlugin, file: TFile) {
    try {
        const content = await plugin.app.vault.read(file);
        const baseName = file.basename;
        const folderPath = file.parent?.path || "/";
        const fileName = `${baseName}.docx`;
        const filePath = folderPath === "/" ? fileName : `${folderPath}/${fileName}`;

        new Notice(`Exporting ${fileName}...`);
        const buffer = await DocxExporter.exportToDocx(content, baseName);

        // Convert Buffer to ArrayBuffer for writeBinary
        const arrayBuffer = (buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer);

        // Save the file
        await plugin.app.vault.adapter.writeBinary(filePath, arrayBuffer);
        new Notice(`Successfully exported to ${baseName}.docx`);
    } catch (error) {
        console.error("Export to DOCX failed:", error);
        new Notice(`Failed to export to DOCX: ${error.message}`);
    }
}

export async function exportSummary(plugin: ScriptEditorPlugin, file: TFile) {
    try {
        const content = await plugin.app.vault.read(file);
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
        const existingFile = plugin.app.vault.getAbstractFileByPath(summaryFilePath);
        if (existingFile instanceof TFile) {
            await plugin.app.vault.modify(existingFile, finalContent);
        } else {
            await plugin.app.vault.create(summaryFilePath, finalContent);
        }

        new Notice(`Successfully exported summary to ${summaryFileName}`);

        // Open the created summary file
        const newFile = plugin.app.vault.getAbstractFileByPath(summaryFilePath);
        if (newFile instanceof TFile) {
            const leaf = plugin.app.workspace.getLeaf(false);
            await leaf.openFile(newFile);
        }

    } catch (error) {
        console.error("Export summary failed:", error);
        new Notice(`Failed to export summary: ${error.message}`);
    }
}

export async function createNewScript(plugin: ScriptEditorPlugin, folderPath?: string) {
    let targetFolder = folderPath;
    if (!targetFolder) {
        const activeFile = plugin.app.workspace.getActiveFile();
        targetFolder = activeFile ? (activeFile.parent?.path || "/") : "/";
    }

    const baseName = "Untitled Script";
    let fileName = `${baseName}.md`;
    let filePath = targetFolder === "/" ? fileName : `${targetFolder}/${fileName}`;

    let counter = 1;
    while (await plugin.app.vault.adapter.exists(filePath)) {
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

    const templateFile = plugin.app.vault.getAbstractFileByPath('Script Templet.md');
    if (templateFile instanceof TFile) {
        fileContent = await plugin.app.vault.read(templateFile);
    }

    const newFile = await plugin.app.vault.create(filePath, fileContent);

    const leaf = plugin.app.workspace.getLeaf(false);
    await leaf.openFile(newFile);

    // Optional: Trigger rename immediately for better UX
    // @ts-ignore - internal API
    plugin.app.workspace.trigger("rename", newFile, newFile.path);
}
