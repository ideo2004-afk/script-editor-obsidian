# Script Editor v1.6.1

Script Editor is a Fountain-compatible screenplay editor with CJK support (Chinese, Japanese, Korean), intelligent formatting detection, professional DOCX export, and integrated Story Board/Outline tools.

---

## 🆕 New in v1.6.1: AI-Powered Beats & Markdown-Native Philosophy
- **AI Beat Summary**: Integrate Gemini 2.5 Flash to instantly generate scene summaries or new scenes based on context.
- **Bulk AI Processing**: One-click to analyze and summarize your entire screenplay.
- **Markdown-Native**: A hybrid design that respects standard Markdown (Headings, Lists, Bold) while delivering professional screenplay formatting.
- **Interactive Story Board**: Full **Drag & Drop** reordering with precise insertion indicators and AI tools.

---

## 📝 Syntax Guide (語法指南)

### 1. Scene Headings (場景)
Start a line with standard screenplay prefixes. They will automatically bold.
*   **Syntax**: `INT.`, `EXT.`, `INT./EXT.`, `I/E.`, or start a line with a period `.` to force a scene heading.

    ```
    INT. HOUSE - NIGHT
    ```

### 2. Characters (角色識別)
*   **A. Explicit Marker (顯式標記)**: Prefix with `@`.
    *   `@JORDAN`, `@娟秀`
    *   *(The `@` symbol is automatically hidden in Live Preview and Reading Mode)*
*   **B. Colon Suffix (冒號)**: Character name followed by a colon (`:` or `：`).
    *   `娟秀：肚子餓了。` -> Centered name, dialogue below.
    *   `ALEX: Hello.` -> Works for all languages.
*   **C. ALL CAPS English (全大寫英文)**:
    *   `JORDAN`, `GUARD 1`
    *   *(Note: Must contain at least one letter A-Z to prevent pure numbers/dates from being misidentified)*

### 3. Dialogue (對白)
Any line immediately following a Character, Parenthetical, or another Dialogue line is treated as Dialogue (indented).

    @JOKER
    Why so serious?
    (smiling)
    Let's put a smile on that face.

    *(The lines following the character automatically become dialogue format)*

### 4. Parentheticals / Extensions (旁白/情緒/畫外音)
Use parentheses `()` `（）` or standard prefixes `VO:` / `OS:`. They will be centered and italicized.
*   **Syntax**: `(emotion)`, `VO: Text`, `OS: Text`

    ```
    @BATMAN
    (struggling)
    Where is she?
    
    OS: It's too late.
    ```
    *(Note: `OS:` / `VO:` lines are treated as parentheticals and center aligned)*

### 5. Transitions (轉場)
Standard uppercase transitions ending in `TO:` or start/end keywords. They will be right-aligned.
*   **Syntax**: `CUT TO:`, `FADE IN:`, `FADE OUT.`, `DISSOLVE TO:`

---

## 🛠️ Features (功能特色)

### 🆕 Fast Script Creation (快速建立劇本)
Easily create new script files pre-configured with the correct metadata (`cssclasses: fountain`).
- **Context Menu**: Right-click on any folder and select **New script**.
- **Command Palette**: Search for `Create new script`.

### 🗂️ Story Board Mode (故事板/卡片模式)
A visual grid view of your screenplay's scenes with full drag-and-drop support.
- **Access**: Click the "Grid" icon (⊞) in the view header.
- **Drag & Drop Reordering**: Rearrange scenes by dragging cards between positions. A blue insertion line guides you for precise placement.
- **Act Grouping**: Scenes are automatically grouped under `##` (H2) headings (Acts).
- **Responsive Grid**: Layout adapts automatically to your window width.
- **Quick Navigation**: Click any card to instantly jump to that scene in the editor.
- **Mode Switching**: Built-in header icons (✎ Pencil / 📖 Book) for fast switching between Live Preview, Reading Mode, and Story Board.

### 📚 Scene Mode View (大綱模式)
A dedicated structural view for your script.
- **Location**: Find the list icon in the **right side dock** (next to the Outline).
- **H1-H2 Folding**: Collapse acts or sections to focus on specific parts.
- **Scene Summaries**: Toggle and configure the length of scene previews in settings.

### 📄 DOCX Export (Word 匯出)
Industry-standard screenplay documents.
- **Editor/File Explorer**: Right-click -> **Export to .docx**.

### 🔢 Scene Renumbering (自動場次編號)
- **Command Palette**: `Scripter: Renumber Scenes`
- Automatically updates sequential numbers to all Scene Headings (e.g., `01. INT. ...`).

---

## 📦 Installation

To install this plugin, we recommend using **BRAT** or manual installation.

### Manual Installation
1. Download `main.js`, `manifest.json`, and `styles.css` from the [Latest Release](https://github.com/ideo2004-afk/script-editor-obsidian/releases/latest).
2. Create a folder named `script-editor` in your vault's `.obsidian/plugins/` directory.
3. Copy the downloaded files into that folder.
4. Reload Obsidian.

## 🎨 CSS Customization
The plugin uses `styles.css` for all formatting. You can tweak properties in the `Story Board Mode` or `Scene Mode` sections to customize your workspace.

## Support

If you find this plugin useful and would like to support its development, please consider buying me a coffee:

<a href="https://buymeacoffee.com/ideo2004c" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" style="height: 60px !important;width: 217px !important;" ></a>

## License

MIT
