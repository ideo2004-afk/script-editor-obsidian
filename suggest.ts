import { App, Editor, EditorPosition, EditorSuggest, EditorSuggestContext, EditorSuggestTriggerInfo, TFile } from 'obsidian';
import ScriptEditorPlugin, { SCRIPT_MARKERS, CHARACTER_COLON_REGEX, CHARACTER_CAPS_REGEX } from './main';

/**
 * Standalone helper to extract character names and frequencies from text.
 * Reuses detectExplicitFormat from the plugin for consistent detection logic.
 */
export function extractCharacterNames(content: string, plugin: ScriptEditorPlugin): Map<string, number> {
    const charCounts = new Map<string, number>();
    const lines = content.split('\n');

    lines.forEach(line => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.length > 50) return;

        // Reuse the core detection logic from the plugin
        const format = plugin.detectExplicitFormat(trimmed);
        if (!format || format.typeKey !== 'CHARACTER') return;

        // Extract the character name based on the format
        let name = "";
        if (trimmed.startsWith(SCRIPT_MARKERS.CHARACTER)) {
            // @NAME format: remove the @ and take everything after it
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

export class CharacterSuggest extends EditorSuggest<string> {
    plugin: ScriptEditorPlugin;

    constructor(app: App, plugin: ScriptEditorPlugin) {
        super(app);
        this.plugin = plugin;
    }

    onTrigger(cursor: EditorPosition, editor: Editor, file: TFile): EditorSuggestTriggerInfo | null {
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
