# Scripter

**Turn Obsidian into a fast, distraction-free screenplay writer.**  
**讓 Obsidian 變身為輕量、免費且專業的美式劇本寫作軟體。**

Scripter for Obsidian is a plugin designed to bring industry-standard screenplay formatting (Fountain-like) to Obsidian, without the bloat. It prioritizes a "flow state" writing experience—you just write text, and it handles the formatting.

## ✨ Philosophy (設計哲學)

- **Minimal Syntax**: Only **ONE** special character (`@`) is required. 
- **Auto-Formatting**: Transitions, dialogues, and scene headings are detected automatically.
- **Pure Markdown**: Your file remains clean, readable text. No complex HTML or code blocks.
- **Print Ready**: Optimized CSS ensures your PDF exports look like standard industry scripts.
- **Zero Interference**: It works specifically on script elements and leaves your normal notes alone.

---

## 📝 Syntax Guide (語法指南)

### 1. Scene Headings (場景)
Start a line with standard screenplay prefixes. They will automatically un-indent and bold.
*   **Syntax**: `INT.`, `EXT.`, `INT./EXT.`, `I/E.`
*   **Example**: 
    ```text
    INT. HOUSE - NIGHT
    ```

### 2. Characters (角色)
Prefix character names with `@`. They will be centered and capitalized.
*   **Syntax**: `@NAME`
*   **Example**:
    ```text
    @BATMAN
    ```

### 3. Dialogue (對白)
**Automatic.** Any line immediately following a Character or Parenthetical is treated as Dialogue.
*   **Example**:
    ```text
    @JOKER
    Why so serious?
    ```
    *(The second line automatically becomes dialogue format)*

### 4. Parentheticals / Extensions (旁白/情緒/畫外音)
Use parentheses `()` or standard prefixes `VO:` / `OS:`. They will be centered and italicized.
*   **Syntax**: `(emotion)` OR `VO: ...` OR `OS: ...`
*   **Example**:
    ```text
    @BATMAN
    (struggling)
    Where is she?
    
    @SUPERMAN
    VO: Far away from here.
    ```

### 5. Transitions (轉場)
Standard uppercase transitions ending in `TO:` or start/end keywords. They will be right-aligned.
*   **Syntax**: `CUT TO:`, `FADE IN:`, `FADE OUT.`, `DISSOLVE TO:`
*   **Example**:
    ```text
    CUT TO:
    ```

---

## 🛠️ Features (功能特色)

### 🔢 Scene Renumbering (自動場次編號)
Command: `Scripter: Renumber Scenes`
- Scans your entire document.
- Automatically adds or updates sequential numbers to all Scene Headings (e.g., `1. INT. ...`, `2. EXT. ...`).
- Perfect for moving into production ("Shooting Script" mode).

### 🖱️ Context Menu (右鍵選單)
Right-click on the editor to quickly insert:
- Scene Headings (`INT.`, `EXT.`)
- Transitions (`CUT TO:`, `FADE IN`)
- Characters & Parentheticals

### 📄 Intelligent PDF Export (智慧 PDF 輸出)
The plugin includes a dedicated print engine (`@media print`) that fixes common Obsidian export issues:
- **Smart Margins**: Adjusts margins specifically for A4/Letter PDF output (10% margins) to match industry standards, differing from the wider screen view (20% margins).

---

## 📦 Installation

To install this plugin, we recommend using **BRAT** for easy updates.

### Using BRAT (Recommended)
1. Install **BRAT** from the Community Plugins in Obsidian.
2. Open BRAT settings.
3. Click "Add Beta plugin".
4. Enter the repository URL: `https://github.com/ideo2004-afk/Scripter-For-Obsidian`.
5. Click "Add Plugin".
6. The plugin will be installed and enabled.

### Manual Installation
1. Download `main.js`, `manifest.json`, and `styles.css` from the [Latest Release](https://github.com/ideo2004-afk/Scripter-For-Obsidian/releases/latest).
2. Create a folder named `scripter-for-obsidian` in your vault's `.obsidian/plugins/` directory.
3. Copy the downloaded files into that folder.
4. Reload Obsidian.

## 🎨 CSS Customization
The plugin uses `styles.css` for all formatting. You can tweak:
- `.script-dialogue`: Adjust margins if you prefer wider/narrower dialogue.
- `font-family`: Currently inherits your theme's font. You can force `Courier Prime` in the CSS if you want the classic screenplay look.

## Support

If you find this plugin useful and would like to support its development, please consider buying me a coffee:

<a href="https://buymeacoffee.com/ideo2004c" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" style="height: 60px !important;width: 217px !important;" ></a>

## License

MIT
