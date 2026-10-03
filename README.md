# 🍜 巷口麵店記帳 Web App (路線 B - GitHub Pages 版)

專為手機打造的**深色模式行事曆記帳介面**（復刻手機記帳 App 風格），前後端分離架構：
* **前端 (本專案)**：純靜態網頁（HTML5 + CSS3 + Vanilla JS），極速秒開，無伺服器費用，支援直接部署至 **GitHub Pages** 或 **Vercel**。
* **後端**：Google Apps Script (GAS) + Google 試算表（自動寫入「記帳本」並同步「巷口麵店損益表」）。

---

## 📱 核心特色

1. **行事曆查帳 (Calendar View)**：
   * 日曆上有記帳綠點，選取日期（紅色圓圈高亮）立刻顯示當日支出與詳細品項。
   * 支援切換「行事曆」與「清單」模式。
2. **極速記一筆**：
   * 底部中央大按鈕，彈出流暢記帳卡片。
   * 內建麵店常用快捷分類晶片（水餃、豬肉、設備、瓦斯、飲食、貓等）。
3. **代墊未還款結算**：
   * 一鍵計算「小花」、「羅」等代墊人的未結清總額，支援直接銷帳。
4. **手機全螢幕體驗**：
   * 在 iPhone Safari 點選「分享 ➜ 加入主畫面」，即可以獨立 App 形式全螢幕開啟，無網址列干擾。

---

## 🚀 部署至 GitHub Pages 步驟 (只要 2 分鐘)

### 步驟 1：建立 GitHub 儲存庫並推動程式碼
在終端機中執行：

```bash
cd /Users/yehhuachen/.gemini/antigravity/scratch/xiangkou-accounting
git init
git add .
git commit -m "feat: init xiangkou accounting app"

# 請先在 GitHub 建立一個新專案 (例如取名 xiangkou-accounting)
# 然後替換下方的 YOUR_USERNAME 執行：
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/xiangkou-accounting.git
git push -u origin main
```

### 步驟 2：開啟 GitHub Pages
1. 前往您 GitHub 該專案頁面 ➜ 點擊右上角 **Settings**。
2. 左側選單點選 **Pages**。
3. 在 **Branch** 下拉選單選擇 `main`，資料夾維持 `/ (root)`，點擊 **Save**。
4. 等候 1 分鐘，GitHub 就會產生專屬網址：
   👉 `https://YOUR_USERNAME.github.io/xiangkou-accounting/`

---

## 🔗 與 Google 試算表連線

1. 打開 `Code.gs`，將內容貼回您的 Google Apps Script 專案並重新部署新版本。
2. 打開您的 GitHub Pages 網頁，點擊右下角 **「⚙️ 設定」**。
3. 確認 API 網址填入您的 Google Apps Script `/exec` 網址即可！
