import {
  App,
  Editor,
  EditorPosition,
  EditorSuggest,
  EditorSuggestContext,
  EditorSuggestTriggerInfo,
  TFile,
} from "obsidian";
import ScriptEditorPlugin from "./main";

/**
 * Standalone helper to extract character names and frequencies from text.
 * Reuses detectExplicitFormat from the plugin for consistent detection logic.
 */
export function extractCharacterNames(
  content: string,
  plugin: ScriptEditorPlugin
): Map<string, number> {
  const charCounts = new Map<string, number>();
  const lines = content.split("\n");

  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.length > 50) return;

    // Reuse the core detection logic from the plugin
    const format = plugin.detectExplicitFormat(trimmed);
    if (!format || format.typeKey !== "CHARACTER") return;

    // Use centralized normalization logic
    const name = plugin.getCleanCharacterName(trimmed);

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

  onTrigger(
    cursor: EditorPosition,
    editor: Editor,
    file: TFile
  ): EditorSuggestTriggerInfo | null {
    if (!this.plugin.isScript(file)) return null;

    const line = editor.getLine(cursor.line);
    const sub = line.substring(0, cursor.ch);
    const match = sub.match(/@([^ ]*)$/);

    if (match) {
      return {
        start: { line: cursor.line, ch: match.index },
        end: { line: cursor.line, ch: cursor.ch },
        query: match[1],
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

  selectSuggestion(
    suggestion: string,
    _event: MouseEvent | KeyboardEvent
  ): void {
    const { context } = this;
    if (context) {
      context.editor.replaceRange(`@${suggestion}`, context.start, context.end);
    }
  }
}
