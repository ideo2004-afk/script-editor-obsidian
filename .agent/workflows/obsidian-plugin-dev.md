---
description: Obsidian 插件開發最佳實踐
---

# Obsidian Plugin Development Workflow

## 新專案初始化

### 1. 使用官方模板

```bash
# 從官方模板開始
npx degit obsidianmd/obsidian-sample-plugin new-plugin-name
cd new-plugin-name
npm install
```

### 2. 立即設定 ESLint

```bash
npm install --save-dev eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin
```

創建 `.eslintrc`：

```json
{
  "root": true,
  "parser": "@typescript-eslint/parser",
  "plugins": ["@typescript-eslint"],
  "extends": ["eslint:recommended", "plugin:@typescript-eslint/recommended"],
  "parserOptions": {
    "project": "./tsconfig.json"
  },
  "rules": {
    "@typescript-eslint/no-explicit-any": "warn",
    "@typescript-eslint/no-unused-vars": [
      "error",
      { "argsIgnorePattern": "^_" }
    ],
    "no-console": "off"
  },
  "ignorePatterns": ["node_modules/", "main.js", "*.mjs"]
}
```

### 3. 升級 TypeScript（建議）

```bash
npm install typescript@5 --save-dev
```

---

## Obsidian Bot 審核規範

### Required（必須遵守）

1. **Sentence case for UI text**

   - ❌ `"Display Options"`, `"Reading Time"`
   - ✅ `"Display options"`, `"Reading time"`
   - 只有第一個字母大寫，除非是專有名詞

2. **避免 `any` 類型**

   - 使用 `ToggleComponent`, `TextComponent` 等 Obsidian 類型
   - 使用 `EditorState` 代替 `state: any`
   - 如果真的無法避免，使用 `// eslint-disable-next-line @typescript-eslint/no-explicit-any`

3. **避免直接 style 操作**

   - ❌ `element.style.display = 'none'`
   - ✅ `element.addClass('my-hidden-class')` + CSS 定義

4. **避免 innerHTML**

   - ❌ `element.innerHTML = '<svg>...'`
   - ✅ `setIcon(element, 'icon-name')`

5. **避免 @ts-ignore**

   - 使用 `@ts-expect-error` 配合說明，或修復類型問題

6. **async 方法必須有 await**
   - 如果方法是 async 但沒有 await，要嘛移除 async，要嘛添加 `await Promise.resolve()`

---

## 提交前檢查清單

```bash
# 1. 跑 ESLint
npx eslint *.ts

# 2. 編譯
npm run build

# 3. 如果有錯誤，修復後重新檢查
npx eslint *.ts --fix  # 自動修復可修復的問題
```

---

## 發布流程

1. 更新版本號（manifest.json + package.json）
2. 編譯：`npm run build`
3. 提交並推送：`git add . && git commit -m "Release x.x.x: 描述" && git push`
4. 建立 tag：`git tag x.x.x && git push origin x.x.x`

---

## 常用 Obsidian API 備註

- `MarkdownView`: 編輯器視圖
- `ItemView`: 自定義側邊欄視圖
- `PluginSettingTab`: 設定頁面
- `EditorSuggest`: 編輯器建議選單
- `registerMarkdownPostProcessor`: Reading Mode 處理
- `registerEditorExtension`: CodeMirror 6 擴展
