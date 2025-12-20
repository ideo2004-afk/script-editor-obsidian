# Scripter v1.3.6

Scripter is a Standard Fountain-compatible screenplay editor with CJK support (Chinese, Japanese, Korean), intelligent formatting detection, and professional DOCX export.

- **Live Preview (所見即所得)**: Formatting is applied in real-time as you type.
- **Minimal Syntax (極簡語法)**: Only recognizes characters based on strict professional habits (ALL CAPS, @ markers, or Colon suffix) to avoid misidentifying narrative descriptions.
- **Universal Detection (萬用識別)**: Reliable detection for Chinese, English, and Mixed character names without interfering with your story text.

---

## 📝 Syntax Guide (語法指南)

### 1. Scene Headings (場景)
Start a line with standard screenplay prefixes. They will automatically bold.
*   **Syntax**: `INT.`, `EXT.`, `INT./EXT.`, `I/E.`, or start a line with a period `.` to force a scene heading.
*   **Example**: 
    ```
    INT. HOUSE - NIGHT
    ```

### 2. Characters (角色識別)
*   **A. Explicit Marker (顯式標記)**: Prefix with `@`.
    *   `@JORDAN`, `@娟秀`
    *   *(The `@` symbol is automatically hidden in Live Preview and Reading Mode)*
*   **B. Colon Suffix (冒號習慣)**: Character name followed by a colon (`:` or `：`).
    *   `娟秀：肚子餓了。` -> Centered name, dialogue below.
    *   `ALEX: Hello.` -> Works for all languages.
*   **C. ALL CAPS English (全大寫英文)**:
    *   `JORDAN`, `GUARD 1`
    *   *(Note: Must contain at least one letter A-Z to prevent pure numbers/dates from being misidentified)*

### 3. Dialogue (對白)
**Automatic.** Any line immediately following a Character, Parenthetical, or another Dialogue line is treated as Dialogue (indented).
*   **Example**:

    @JOKER
    Why so serious?
    (smiling)
    Let's put a smile on that face.

    *(The lines following the character automatically become dialogue format)*

### 4. Parentheticals / Extensions (旁白/情緒/畫外音)
Use parentheses `()` `（）` or standard prefixes `VO:` / `OS:`. They will be centered and italicized.
*   **Syntax**: `(emotion)`, `（情緒）`, `VO: Text`, `OS: Text`
*   **Example**:
    ```text
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
- **Ribbon Icon**: Click the "Scroll Text" icon on the left sidebar.
- **Context Menu**: Right-click on any folder and select **New script**.
- **Command Palette**: Search for `Create new script`.

### 📄 Professional DOCX Export (專業 Word 匯出)
The plugin features a high-fidelity Word export engine for industry-standard screenplay documents.
- **Editor**: Right-click anywhere in the script -> **Export to .docx**.
- **File Explorer**: Right-click on any script file -> **Export to .docx**.
- **Command Palette**: `Scripter: Export current file to .docx`.

### 🔢 Scene Renumbering (自動場次編號)
Command: `Scripter: Renumber Scenes`
- Scans your entire document.
- Automatically adds or updates sequential numbers to all Scene Headings (e.g., `1. INT. ...`).

### 📚 Scene Mode View (場景模式)
- **Scene Mode View**: Dedicated sidebar outline for H1-H3 and Scene Headings. Find the list icon in the **right side dock** (next to the Outline).

---

## 📦 Installation

To install this plugin, we recommend using **BRAT** for easy updates from GitHub, or installing manually.

### Manual Installation
1. Download `main.js`, `manifest.json`, and `styles.css` from the [Latest Release](https://github.com/ideo2004-afk/Scripter-For-Obsidian/releases/latest).
2. Create a folder named `scripter-for-obsidian` in your vault's `.obsidian/plugins/` directory.
3. Copy the downloaded files into that folder.
4. Reload Obsidian.

## 🎨 CSS Customization
The plugin uses `styles.css` for all formatting. You can tweak properties like margins or fonts if you need a specific look (e.g., Courier Prime).

## Support

If you find this plugin useful and would like to support its development, please consider buying me a coffee:

<a href="https://buymeacoffee.com/ideo2004c" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" style="height: 60px !important;width: 217px !important;" ></a>

## License

MIT
