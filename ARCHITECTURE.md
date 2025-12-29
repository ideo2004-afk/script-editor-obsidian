# Script Editor Plugin Architecture

This document outlines the modular structure of the Script Editor Obsidian plugin. Following a major refactoring, the codebase is split into specific modules to improve maintainability and legibility.

## Core Structure

### [main.ts](main.ts)
**The Central Orchestrator & Rulebook.**
- **Plugin Lifecycle**: Handles `onload` and `onunload`.
- **Core Parsing**: Contains shared Regex definitions and the `detectExplicitFormat` utility used by all modules.
- **State Management**: Manages settings and cross-view synchronization.

### [menus.ts](menus.ts)
**The UI Entrance & Action Implementation.**
- **Commands & Menus**: Registers and implements all plugin commands, context menus, ribbon icons, and header buttons.
- **Action Logic**: Houses the algorithms for major actions like scene renumbering, Word export, and new script creation (moved from `main.ts`).

### [suggest.ts](suggest.ts)
**Writing Assistance.**
- **Auto-complete**: Implements the `CharacterSuggest` class for @-mentions.
- **Data Harvesting**: Contains the logic to scan scripts and extract character names and frequencies.

### [settings.ts](settings.ts)
**Configuration Management.**
- **Interface**: Defines the `ScriptEditorSettings` data structure.
- **Defaults**: Provides initial configuration values.
- **UI Tab**: Implements the `ScriptEditorSettingTab` for the Obsidian settings menu.

### [readingView.ts](readingView.ts)
**Reading Mode & Export Renderer.**
- **Markdown Post-Processor**: Logic for rendering script elements in Obsidian's Reading Mode.
- **Native Marker Support**: Ensures scene numbers (list markers) are preserved and displayed correctly.

### [editorExtension.ts](editorExtension.ts)
**Live Preview (Editing Mode) Styles.**
- **CodeMirror 6 Extension**: Uses `ViewPlugin` and `Decoration` to apply real-time styles (centering, bolding, colors) while editing.
- **Modular Styling**: Keeps editor-heavy logic separate from the core plugin file.

### [storyBoardView.ts](storyBoardView.ts)
**Visual Narrative Planning.**
- **Grid Layout**: Provides a drag-and-drop card interface for viewing the script as a storyboard.
- **AI Beat Summary**: Integrates with Gemini AI to generate scene summaries.

### [sceneView.ts](sceneView.ts)
**Sidebar Navigation.**
- **Scene List**: Provides an outline of all scenes in the current script for quick navigation.
- **Auto-Sync**: Updates automatically as scenes are added or renumbered in the editor.

### [docxExporter.ts](docxExporter.ts)
**Export Engine.**
- **Office Processing**: Handles the conversion of script formatting into standard industry-compliant Word documents.

---

## Shared Utility Flows

### Formatting Detection
The `detectExplicitFormat` function in `main.ts` is the single source of truth for identifying whether a line represents a Scene, Character, Dialogue, etc. Both `readingView.ts` and `editorExtension.ts` import this to ensure consistent rendering across all modes.

### Action Execution
UI elements in `menus.ts` act as triggers. They directly call the standalone implementation functions located within `menus.ts` (e.g., `renumberScenes(plugin, editor)`), reducing the burden on the main plugin instance.

## Maintenance Notes
- When adding a new script element, update the Regexes and `detectExplicitFormat` in `main.ts`.
- When adding a new UI command, register it in `menus.ts`.
- Styles are centrally managed in `styles.css`.
