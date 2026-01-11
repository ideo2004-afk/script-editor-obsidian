import { App, PluginSettingTab, Setting } from 'obsidian';
import ScriptEditorPlugin from './main';

export interface ScriptEditorSettings {
    mySetting: string;
    geminiApiKey: string;
}

export const DEFAULT_SETTINGS: ScriptEditorSettings = {
    mySetting: 'default',
    geminiApiKey: ''
}

export const SPONSOR_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-heart"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>`;

export class ScriptEditorSettingTab extends PluginSettingTab {
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
            .setDesc('Get your API key from Google AI Studio.')
            .addText(text => text
                .setPlaceholder('Enter your Gemini API key')
                .setValue(this.plugin.settings.geminiApiKey)
                .onChange(async (value) => {
                    this.plugin.settings.geminiApiKey = value.trim();
                    await this.plugin.saveSettings();
                })
                .inputEl.style.width = '350px');

        // Quick features
        new Setting(containerEl)
            .setName('Quick features')
            .setDesc('Automation and creation tools.')
            .setHeading();

        const featuresDiv = containerEl.createDiv();
        featuresDiv.createEl('li', { text: 'New Script Button: Click the scroll icon in the left ribbon to create a new screenplay.' });
        featuresDiv.createEl('li', { text: 'Story Board Mode: Activate the grid icon in the right sidebar for a holistic view of script structure.' });
        featuresDiv.createEl('li', { text: 'AI Beat Summary: Right-click any scene card in Story Board to generate summaries.' });
        featuresDiv.createEl('li', { text: 'Character Quick Menu: Type @ to access frequently used character names.' });
        featuresDiv.createEl('li', { text: 'Renumber Scenes: Right-click in the editor to re-order your scene numbers automatically.' });

        // Screenplay Syntax
        new Setting(containerEl)
            .setName('Screenplay syntax')
            .setDesc('Basic rules for Fountain-compatible formatting.')
            .setHeading();

        const syntaxDiv = containerEl.createDiv();
        syntaxDiv.createEl('li', { text: 'Scene Heading: INT. / EXT. — Automatic bold & uppercase.' });
        syntaxDiv.createEl('li', { text: 'Character: @NAME — Centered. "@" is hidden in preview.' });
        syntaxDiv.createEl('li', { text: 'Dialogue: Text below Character — Automatically indented.' });
        syntaxDiv.createEl('li', { text: 'Parenthetical: (emotion) / OS: / VO: — Centered & italic.' });
        syntaxDiv.createEl('li', { text: 'Transition: CUT TO: / FADE IN — Right aligned.' });


        // Support
        const supportDiv = containerEl.createEl('div', { cls: 'script-editor-settings-support' });
        supportDiv.createEl('p', { text: 'If you enjoy using Script Editor, consider supporting its development!' });

        const sponsorActions = supportDiv.createDiv({ cls: 'script-editor-sponsor-actions' });

        const bmacLink = sponsorActions.createEl('a', {
            href: 'https://buymeacoffee.com/ideo2004c',
            cls: 'script-editor-sponsor-btn bmac-btn'
        });
        bmacLink.createEl('img', {
            attr: {
                src: 'https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png',
                style: 'height: 40px;'
            }
        });

        const githubLink = sponsorActions.createEl('a', {
            href: 'https://github.com/sponsors/ideo2004-afk',
            cls: 'script-editor-sponsor-btn github-btn'
        });
        const githubIcon = githubLink.createDiv({ cls: 'github-sponsor-icon' });
        githubIcon.innerHTML = SPONSOR_ICON;
        githubLink.createSpan({ text: 'GitHub Sponsor' });
    }
}
