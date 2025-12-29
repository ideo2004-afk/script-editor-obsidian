import { Menu, MenuItem, Editor, MarkdownView, TFile, TFolder, WorkspaceLeaf } from 'obsidian';
import ScriptEditorPlugin, { SCRIPT_MARKERS } from './main';
import { SCENE_VIEW_TYPE } from './sceneView';

export interface ExtendedMenuItem extends MenuItem {
    setSubmenu(): Menu;
}

export function registerMenus(plugin: ScriptEditorPlugin) {
    const { app } = plugin;

    // 1. Ribbon Icon
    plugin.addRibbonIcon('scroll-text', 'New script', async () => {
        await plugin.createNewScript();
    });

    // 2. Commands
    plugin.addCommand({
        id: 'renumber-scenes',
        name: 'Renumber scenes',
        editorCallback: (editor: Editor) => plugin.renumberScenes(editor)
    });

    plugin.addCommand({
        id: 'create-new-script',
        name: 'Create new script',
        callback: async () => {
            await plugin.createNewScript();
        }
    });

    plugin.addCommand({
        id: 'export-to-docx',
        name: 'Export current script to .docx',
        checkCallback: (checking: boolean) => {
            const view = app.workspace.getActiveViewOfType(MarkdownView);
            if (view && plugin.isScript(view.file)) {
                if (!checking) {
                    void plugin.exportFileToDocx(view.file!);
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
                    void plugin.exportSummary(view.file!);
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
                    sceneMenu.addItem((i: MenuItem) => i.setTitle("EXT.").onClick(() => plugin.insertText(editor, "EXT. ", false)));
                    sceneMenu.addItem((i: MenuItem) => i.setTitle("INT.").onClick(() => plugin.insertText(editor, "INT. ", false)));
                    sceneMenu.addItem((i: MenuItem) => i.setTitle("I/E.").onClick(() => plugin.insertText(editor, "INT./EXT. ", false)));
                });

                addMenuItem(subMenu, "Character (@)", "user", editor, SCRIPT_MARKERS.CHARACTER, plugin);
                addMenuItem(subMenu, "Parenthetical ( ( )", "italic", editor, SCRIPT_MARKERS.PARENTHETICAL, plugin);

                // Transition Submenu
                subMenu.addItem((item: MenuItem) => {
                    item.setTitle("Transition").setIcon("arrow-right");
                    const m = (item as ExtendedMenuItem).setSubmenu();
                    m.addItem((i: MenuItem) => i.setTitle("CUT TO:").onClick(() => plugin.insertText(editor, "CUT TO:", true)));
                    m.addItem((i: MenuItem) => i.setTitle("FADE OUT.").onClick(() => plugin.insertText(editor, "FADE OUT.", true)));
                    m.addItem((i: MenuItem) => i.setTitle("FADE IN:").onClick(() => plugin.insertText(editor, "FADE IN:", true)));
                    m.addItem((i: MenuItem) => i.setTitle("DISSOLVE TO:").onClick(() => plugin.insertText(editor, "DISSOLVE TO:", true)));
                });

                subMenu.addItem((item: MenuItem) => {
                    item.setTitle("Insert Note").setIcon("sticky-note")
                        .onClick(() => plugin.insertText(editor, "%%note: Note text here%%", true));
                });

                subMenu.addSeparator();

                subMenu.addItem((subItem: MenuItem) => {
                    subItem.setTitle("Renumber scenes").setIcon("list-ordered")
                        .onClick(() => plugin.renumberScenes(editor));
                });

                subMenu.addSeparator();

                subMenu.addItem((subItem: MenuItem) => {
                    subItem.setTitle("Export to .docx").setIcon("file-output")
                        .onClick(() => {
                            void plugin.exportFileToDocx(view.file!);
                        });
                });

                subMenu.addItem((subItem: MenuItem) => {
                    subItem.setTitle("Export summary").setIcon("file-text")
                        .onClick(() => {
                            void plugin.exportSummary(view.file!);
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
                                await plugin.exportFileToDocx(file);
                            });
                    });

                    menu.addItem((item) => {
                        item
                            .setTitle("Export summary")
                            .setIcon("file-text")
                            .onClick(async () => {
                                await plugin.exportSummary(file);
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
                        await plugin.createNewScript(folderPath);
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
            item.setTitle(title).setIcon(icon).onClick(() => plugin.toggleLinePrefix(editor, marker));
        });
    }
}
