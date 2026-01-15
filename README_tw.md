# Script Editor v1.9

Script Editor 是提供 AI 輔助的標準美式劇本寫作工具，支援 Fountain-compatible 語法，並相容於繁體中文（或日、韓語系），撰寫時會自動檢測劇本語法，並內建提供 Story Board 卡片整理模式，可拖拉管理所有場次，加上 AI 自動整理各場次摘要等功能。

[English Version](./README.md)

<table width="100%">
  <tr>
    <td width="33%" align="center">
      <img src="./image/README/editormode.png" alt="編輯模式" width="100%"><br>
      <b>編輯模式</b>
    </td>
    <td width="33%" align="center">
      <img src="./image/README/storyboardmode.png" alt="故事板模式" width="100%"><br>
      <b>故事板模式</b>
    </td>
    <td width="33%" align="center">
      <img src="./image/README/cardedit.png" alt="卡片編輯器" width="100%"><br>
      <b>卡片編輯器</b>
    </td>
  </tr>
</table>

## 📝 語法指南 (Syntax Guide)

使用標準的 [Fountain 語法](https://fountain.io/syntax/)。

- **場景標題**：以 'INT.' 或 'EXT.' 開頭會自動加粗並轉大寫。
- **角色**：使用 '@NAME'、'NAME' 或 'NAME:' 會自動置中。預覽時會隱藏 "@" 符號。
- **對話**：角色下方的文字會自動縮排。
- **括號（表演提示）**：'(情緒)'、'OS:' 或 'VO:' 會自動置中並改為斜體。
- **轉場**：'CUT TO:' 或 'FADE IN' 會自動右對齊。

![語法範例](./image/README/syntx.png)

## 🛠️ 功能特色 (Features)

### 快速建立劇本

此插件不會影響其他 .md 檔案。你可以建立預先配置好元數據 (`cssclasses: fountain`) 的新 .md 檔案。

- **右鍵選單**：在任何資料夾上點擊右鍵，選擇 **New script**。
- **命令面板 (Command Palette)**：搜尋 `Create new script`。

### 故事板模式 (Story Board Mode)

一個視覺化的網格視圖，支援完整的拖放操作來管理劇本場景。

- **開啟方式**：點擊視圖標題列的「網格」圖示 (⊞)。
- **拖放排序**：透過在卡片之間拖曳來重新排列場景。藍色的插入線會引導你進行精確定位。
- **快速導航**：點擊任何卡片即可立即跳轉到編輯器中的該場景。
- **顏色標記**：點擊左上角可設定卡片顏色標記。
- **卡片功能**：點擊右上角圖示，可新增、複製、刪除卡片或以 AI 生成場景摘要。
- **章節分組**：場景會自動在 `##` (H2) 標題（章節/Act）下進行分組。

![卡片功能](./image/README/cardfunctions.png)

### AI 智能開發 (AI Powered Features)

- 在 **故事板模式** 中，你可以使用 AI 輔助產生摘要。你需要先在設定頁面輸入 Gemini API Key。
- **AI Beat 摘要**：整合最新 Gemini 2.5 Flash，根據上下文立即生成場景摘要或新場景。
- **批量 AI 處理**：一鍵分析並摘要你的整部劇本。
- **AI Rewrite 改寫**：在編輯器中點擊右鍵，可根據初稿筆記與前後文上下文，自動改寫為完整的劇本場景。

### DOCX 匯出 (Word 匯出)

匯出符合業界標準的劇本文件。

- **編輯器/檔案瀏覽器**：右鍵點擊 -> **Export to .docx**。

### 自動場次編號 (Scene Renumbering)

- **命令面板**：`Scripter: Renumber Scenes`
- 自動為所有場景標題更新連續編號（例如：`01. INT. ...`）。

### 角色聯想選單 (Character Suggestion Menu)

快速插入角色名稱，依照出現頻率自動排序。

- **觸發方式**：在劇本中任意位置輸入 `@`。
- **智慧排序**：角色會依照在劇本中的出現次數排序，最常用的排在最前面。
- **自動偵測**：支援 `@人名`、`人名：` 以及全大寫英文格式。

### 匯出摘要 (Export Summary)

將劇本結構匯出為獨立的 Markdown 檔案。

- **編輯器/檔案瀏覽器**：右鍵點擊 -> **Export summary**。
- 輸出所有 H1、H2 標題與場景摘要至新的 `.md` 檔案。

### 右鍵功能 (Right-click Function)

- 編輯模式中，滑鼠右鍵選單提供常用 Syntax 語法（角色、對話、轉場等）與其他功能。

![Right-Click](./image/README/right-click-functions2.png)

### 原生 Markdown 相容 (Markdown-Native)

混合設計，既尊重標準 Markdown（標題、列表、加粗），又能提供專業的劇本格式美化。

---

## 📦 安裝說明

我們建議使用 **BRAT** 或手動安裝此插件。

### 手動安裝

1. 從 [Latest Release](https://github.com/ideo2004-afk/script-editor-obsidian/releases/latest) 下載 `main.js`、`manifest.json` 和 `styles.css`。
2. 在你的儲存庫（Vault）的 `.obsidian/plugins/` 目錄中建立一個名為 `script-editor` 的資料夾。
3. 將下載的檔案複製到該資料夾中。
4. 重新載入 Obsidian。

---

## 技術支援 (Support)

由 Yan Min Lee ( ideo2004@gmail.com ) 開發。我是一位來自台灣的電影導演和編劇。如果你覺得這個插件對你有幫助並想支持它的開發，歡迎請我喝杯咖啡：

<a href="https://buymeacoffee.com/ideo2004c" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" style="height: 60px !important;width: 217px !important;" ></a>

## 授權條款 (License)

MIT
