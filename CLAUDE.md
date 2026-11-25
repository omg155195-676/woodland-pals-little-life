# Woodland Pals: Little Life

Tumbleberry Books「Woodland Pals」品牌的電子寵物（類似塔麻可吉）網頁遊戲，以 PWA 形式發佈在 GitHub Pages：
https://omg155195-676.github.io/woodland-pals-little-life/

以使用者的另一個遊戲 mare-freya-pet 的框架為基礎（單一 HTML、畫布、程式動畫、底部選單、存檔補算）。

## 檔案結構

- `index.html`：遊戲本體（HTML＋CSS＋JS，沒有建置步驟）
- `growth.js`：**所有成長規則**（食物表、型態表、第一／二階段判定、隱藏條件、種子亂數）。純函式，遊戲、測試、模擬共用同一份
- `sw.js`：離線快取。**任何檔案改動後都要把 `VERSION` 加一**（例如 `wp-life-v1` → `wp-life-v2`），新增的素材也要加進 `CORE` 清單
- `manifest.webmanifest`、`icons/`：PWA 安裝設定與 App 圖示（森林寶寶從橡實蛋探頭，ChatGPT 生成；maskable 版外圍加留白）
- `assets/characters/{型態}/face/`：表情圖；目前幼年四角色的表情用 LINE 日常表情貼（暫代）
- `assets/characters/{型態}/act/{型態}_act_{idle|eat|sleep|play|sick}.webp`：正式動作圖（蛋、寶寶、四隻幼年已完成；成年型尚未製作）。新增後要登記在 `index.html` 的 `ART_ACTS`。去背用 `tools/cutout.py`
- `assets/backgrounds/bg_forest_{day|dusk|night}.webp`：森林背景（已完成），登記在 `ART_BG`
- `tests/growth.test.mjs`：規則測試，`node --test tests/growth.test.mjs`
- `tools/simulate.mjs`：平衡模擬（機器人玩家），`node tools/simulate.mjs 2000`
- `tools/hires.py`：沿用自框架的放大＋去背工具；裁切位置是 mare-freya 的，處理 ChatGPT 圖時要改
- `docs/`：五份規格（成長圖鑑、食物、進化規則、照顧系統、實作計畫）

## 遊戲程式重點（index.html）

- 畫布邏輯尺寸 `W=480, H=320`；寵物活動範圍 `FLOOR`
- 遊戲時鐘 `G.t`；每個遊戲分鐘呼叫 `tickMinute(online)`。`online=false` 是離線補算（不產生照顧失誤、數值最低半顆心、便便最多 2 坨）
- 作息：07:00 起床、19:00 後可按「去睡覺」、22:00 自動睡；寶寶 13:00–14:00 午睡
- 成長判定：`growthCheck()` 呼叫 `Growth.phase1()`／`Growth.phase2()`，結果與輸入快照寫進 `G.decisions`
- 動畫是程式做的（`animState()`），每個動作只用一張圖；沒有正式圖時用暫代畫法（`drawEgg`、`drawBaby`、`drawHead`）
- 寵物行為：`Pet` 類別的 `update()`、自主行為 `think()`（也負責給玩家成長傾向的提示）
- 存檔在 `localStorage`（key `woodland-pals-life-v1`），存檔有 `version`，格式改版時在 `migrate()` 升級

## 原則

- 角色外觀以 Woodland Pals README（品牌資產與角色設定）為準：KURI 兔、SUNNY 狐、DODO 熊、PIKO 刺蝟，不重新設計、不自己加減配件
- 成年型態只加一件代表個性的配件，核心特徵不動；沒有死亡、沒有壞型態
- 圖片由 Claude 操作 ChatGPT 生成，Claude 驗收角色一致性後處理成遊戲規格
- 改規則時先改 `growth.js`，跑測試和模擬，再更新 `docs/`
- 介面文字使用繁體中文；修改時只改需要的部分，不要整個重寫

## 本機測試

```
python3 -m http.server 8765
```
打開 http://localhost:8765/ 。設定 → 開發測試 可以調時間流速、快轉 1 小時／1 天。
