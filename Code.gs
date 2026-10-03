/**
 * ============================================
 * LINE 記帳機器人(巷口麵店版)v2 — 單一帳本 + LIFF 記帳表單
 * 架構:LINE Messaging API + Google Apps Script + Google Sheets
 * ============================================
 *
 * 這一版改成「單一帳本」:不用再選公司/私人,記帳時選的「分類」本身
 * 就已經決定了這筆屬於損益表的哪個區塊(營收/銷售成本/營業支出/房屋/生活支出),
 * 不需要再多問一次帳本。
 *
 * 記帳方式改成表單為主:
 *   在 LINE 對話裡打「記帳」→ 機器人回一個連結,點開是手機表單
 *   (帳本不用選、日期用日曆、金額用數字鍵盤、分類跟代墊人用下拉選單)
 *
 * 其他還是用文字指令(不用表單):
 *   分類            → 列出目前所有可用的分類清單(依區塊分組)
 *   本月 / 統計      → 查詢本月統計
 *   刪除            → 刪除「自己」最後一筆記錄
 *   代墊 / 未還款    → 列出目前所有還沒標記「已還」的代墊金額(依帳戶欄位裡的人名分組)
 *   已還 小王        → 把「小王」目前所有未還的代墊記錄,一次標記成已還
 *   同步損益表 / 同步 → 把「這個月」的加總數字寫進損益表 Google Sheet
 *   記帳            → 回覆記帳表單的連結
 *   說明 / help     → 顯示使用說明
 *
 * 分類規則:
 *   - 分類名稱會依照 CATEGORY_MAP 對應到損益表裡的區塊(營收/銷售成本/營業支出/房屋/生活支出)
 *   - 「房屋」區塊比較特殊:租金是收入,三筆房貸是支出,而且損益表裡房貸是存成「負數」,
 *     所以同步時房貸類別會自動轉成負值寫入,租金維持正值(見 CATEGORY_OVERRIDES)
 *   - 「帳戶」欄位是用來記錄「這筆是誰代墊付款的」,不是銀行帳戶或付款方式;
 *     搭配「代墊」「已還」指令方便對帳、公司之後好還款給對方
 *   - 寫入前會自動檢查「同一天+同分類+同金額+同代墊人」是否跟已存在的記錄重複,
 *     重複的話還是會照常記錄,但回覆會多一段提醒,方便發現手滑重複記帳
 *
 * 事前準備(請見「設定說明.md」):
 *   1. 建立一個 Google Sheet 當作「記帳本」,把 ID 填入指令碼屬性 SPREADSHEET_ID
 *   2. 把損益表 xlsx 另存/轉成 Google Sheets,把 ID 填入指令碼屬性 PNL_SPREADSHEET_ID
 *   3. 到 LINE Developers 建立 Messaging API channel,取得 Channel Access Token,
 *      填入指令碼屬性 CHANNEL_ACCESS_TOKEN
 *   4. 部署 → 新增部署作業 → 網頁應用程式,把網址設成 LINE 的 Webhook URL(doPost 用)
 *   5. 建立一個 LIFF App(見設定說明.md),把 LIFF ID 填入指令碼屬性 LIFF_ID
 *      (doGet 回傳的記帳表單,就是靠這個網址在 LINE 裡打開)
 *   6.(選用)在 Apps Script 編輯器手動執行一次 createMonthlySyncTrigger_(),
 *      即可每月自動同步一次損益表,不用每次手動打「同步損益表」
 */

// ------------------------------------------------
// 設定區:記帳本分頁名稱
// ------------------------------------------------

const RECORD_SHEET_NAME = '記帳本';

// ------------------------------------------------
// 設定區:分類對照表(對應損益表裡的區塊)
// ------------------------------------------------
//
// 結構:CATEGORY_MAP[區塊] = [分類項目...]
// 「區塊」名稱要跟損益表 Google Sheet 裡的分頁名稱一致,同步時才找得到對應分頁。
// 分類名稱在不同區塊之間可以重複(例如「天然氣」同時在營業支出跟生活支出),
// 因為記帳表單選分類時,一定是連著「區塊」一起選的,不會混淆。

const CATEGORY_MAP = {
  '營收 (銷售額)': ['現金', '吳柏毅', 'LINE PAY', '其他支付'],
  '銷售成本': [
    '水餃', '中泰', '餛飩', '禾家歡', '杰帆', '菜市場', '麵',
    '十甲旺內臟', '靜宜豬肉', '粉腸', '蛋', '豬耳朵', '百豐', '辣椒',
    '米食家', '彰化', '頭張素料', '新東', '九大', '宥杏', '萬成'
  ],
  '營業支出': [
    '薪水支出', '租金', '水費', '天然氣', '電費', '電話網路', 'POS',
    '營業雜支', '吳伯毅抽成', 'line抽成', '健保', '設備', '裝潢'
  ],
  '房屋': ['租金', '118房貸', '116房貸', '潭子房貸'],
  '生活支出': [
    '好市多', '飲食', '汽車', '機車', '生活雜支', '旅遊', '貓',
    '天然氣', '串流平台', '電費'
  ]
};

// 每個「區塊」預設的收支性質(大部分區塊裡的分類性質一致,例外的寫在 CATEGORY_OVERRIDES)
const SECTION_TYPE = {
  '營收 (銷售額)': '收入',
  '銷售成本': '支出',
  '營業支出': '支出',
  '房屋': '收入', // 預設收入,但「房貸」類別會被下面的 CATEGORY_OVERRIDES 覆蓋成支出
  '生活支出': '支出'
};

// 個別分類的例外規則:
//   type    → 強制覆蓋這個分類的收入/支出性質(不用預設的 SECTION_TYPE)
//   pnlSign → 同步寫回損益表時要乘上的正負號(損益表裡這個分類的儲存格本來就是存負數的話設 -1)
const CATEGORY_OVERRIDES = {
  '118房貸': { type: '支出', pnlSign: -1 },
  '116房貸': { type: '支出', pnlSign: -1 },
  '潭子房貸': { type: '支出', pnlSign: -1 }
};

// 記帳表單裡「帳戶(代墊人)」下拉選單的常用選項。
// 請改成你們實際常用的名字,表單裡最後一定會多一個「其他」讓人手動輸入不在清單裡的名字。
const ACCOUNT_OPTIONS = ['小花', '羅', '公司'];

// ------------------------------------------------
// 工具函式:取得設定值 / 記帳本分頁
// ------------------------------------------------

function getProp_(key) {
  const value = PropertiesService.getScriptProperties().getProperty(key);
  if (!value) {
    throw new Error('缺少指令碼屬性設定:' + key + '(請至專案設定 → 指令碼屬性新增)');
  }
  return value;
}

function getRecordSheet_() {
  const ss = SpreadsheetApp.openById(getProp_('SPREADSHEET_ID'));
  let sheet = ss.getSheetByName(RECORD_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(RECORD_SHEET_NAME);
    sheet.appendRow(['時間', '使用者ID', '使用者名稱', '類型', '區塊', '分類', '帳戶', '金額', '備註', '已還款']);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

// ------------------------------------------------
// 入口一:接收 LINE Webhook(文字指令)
// ------------------------------------------------

function doPost(e) {
  try {
    const raw = (e && e.postData && e.postData.contents) ? e.postData.contents : '{}';
    const body = JSON.parse(raw);

    // 處理來自 GitHub Pages 介面的 API 請求
    if (body.action) {
      return handleApiPost_(body);
    }

    // 處理 LINE Webhook 訊息
    const events = body.events || [];
    events.forEach(function (event) {
      if (event.type === 'message' && event.message.type === 'text') {
        handleTextMessage_(event);
      }
    });

    return ContentService.createTextOutput(JSON.stringify({ status: 'ok' }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    Logger.log('doPost error: ' + err);
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ------------------------------------------------
// 入口二:提供記帳表單網頁與 REST API
// ------------------------------------------------

function doGet(e) {
  // 如果帶有 action 參數，回傳 JSON API 資料給 GitHub Pages 前端
  if (e && e.parameter && e.parameter.action) {
    return handleApiGet_(e.parameter);
  }

  // 預設直接自動轉跳至 GitHub Pages 全新記帳網頁
  const redirectHtml = '<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0;url=https://yehhuachen.github.io/xiangkou-accounting/"></head><body><p>正在前往巷口麵店記帳… <a href="https://yehhuachen.github.io/xiangkou-accounting/">點此前往</a></p></body></html>';
  return HtmlService.createHtmlOutput(redirectHtml)
    .setTitle('巷口麵店記帳')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

// 處理 GET API (查帳、未還款)
function handleApiGet_(params) {
  const action = params.action;

  if (action === 'getEntries') {
    const year = Number(params.year);
    const month = Number(params.month);
    const sheet = getRecordSheet_();
    const data = sheet.getDataRange().getValues();
    const entries = [];

    for (let r = 1; r < data.length; r++) {
      const row = data[r];
      const timestamp = row[0];
      if (!(timestamp instanceof Date)) continue;

      const rowYear = timestamp.getFullYear();
      const rowMonth = timestamp.getMonth() + 1;

      if (year && month && (rowYear !== year || rowMonth !== month)) {
        continue;
      }

      const dateStr = Utilities.formatDate(timestamp, Session.getScriptTimeZone(), 'yyyy-MM-dd');
      entries.push({
        id: 'row_' + (r + 1),
        rowId: r + 1,
        date: dateStr,
        userId: String(row[1] || ''),
        displayName: String(row[2] || ''),
        type: String(row[3] || '支出'),
        section: String(row[4] || ''),
        category: String(row[5] || ''),
        account: String(row[6] || '現金'),
        amount: Number(row[7]) || 0,
        note: String(row[8] || ''),
        reimbursed: String(row[9] || '')
      });
    }

    entries.reverse(); // 最新在最前面

    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      entries: entries
    })).setMimeType(ContentService.MimeType.JSON);
  }

  if (action === 'getUnreimbursed') {
    const sheet = getRecordSheet_();
    const data = sheet.getDataRange().getValues();
    const totals = {};

    for (let r = 1; r < data.length; r++) {
      const account = String(data[r][6] || '').trim();
      const amount = Number(data[r][7]) || 0;
      const reimbursed = String(data[r][9] || '').trim();

      if (!account || account === '現金' || account === '公司' || reimbursed) continue;
      totals[account] = (totals[account] || 0) + amount;
    }

    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      unreimbursed: totals
    })).setMimeType(ContentService.MimeType.JSON);
  }

  if (action === 'addEntryGet') {
    try {
      const payload = JSON.parse(params.payload);
      const res = submitEntryFromForm(payload);
      return ContentService.createTextOutput(JSON.stringify(res))
        .setMimeType(ContentService.MimeType.JSON);
    } catch (err) {
      return ContentService.createTextOutput(JSON.stringify({ success: false, message: String(err) }))
        .setMimeType(ContentService.MimeType.JSON);
    }
  }

  if (action === 'syncPnL') {
    const year = Number(params.year);
    const month = Number(params.month);
    const resText = syncPnLForMonth_(year, month);
    return ContentService.createTextOutput(JSON.stringify({ success: true, message: resText }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  return ContentService.createTextOutput(JSON.stringify({ success: false, message: 'Unknown action' }))
    .setMimeType(ContentService.MimeType.JSON);
}

// 處理 POST API (新增、刪除、結清)
function handleApiPost_(body) {
  const action = body.action;

  if (action === 'addEntry') {
    const res = submitEntryFromForm(body.payload);
    return ContentService.createTextOutput(JSON.stringify(res))
      .setMimeType(ContentService.MimeType.JSON);
  }

  if (action === 'deleteEntry') {
    const rowId = body.rowId;
    if (rowId && typeof rowId === 'string' && rowId.indexOf('row_') === 0) {
      const rowNum = parseInt(rowId.replace('row_', ''), 10);
      const sheet = getRecordSheet_();
      if (rowNum >= 2 && rowNum <= sheet.getLastRow()) {
        sheet.deleteRow(rowNum);
        return ContentService.createTextOutput(JSON.stringify({ success: true, message: '已刪除' }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }
    return ContentService.createTextOutput(JSON.stringify({ success: false, message: '找不到該筆紀錄' }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  if (action === 'markReimbursed') {
    const resText = markReimbursed_(body.personName);
    return ContentService.createTextOutput(JSON.stringify({ success: true, message: resText }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  if (action === 'syncPnL') {
    const year = Number(body.year);
    const month = Number(body.month);
    const resText = syncPnLForMonth_(year, month);
    return ContentService.createTextOutput(JSON.stringify({ success: true, message: resText }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  return ContentService.createTextOutput(JSON.stringify({ success: false, message: 'Unknown post action' }))
    .setMimeType(ContentService.MimeType.JSON);
}

// 給 RecordForm.html 用的設定資料(分類清單、帳戶選項、LIFF ID)
function getFormConfig_() {
  let liffId = '';
  try {
    liffId = getProp_('LIFF_ID');
  } catch (err) {
    liffId = ''; // 還沒設定 LIFF_ID 時,表單會顯示提示,而不是直接噴錯
  }
  return {
    liffId: liffId,
    categories: CATEGORY_MAP,
    accounts: ACCOUNT_OPTIONS
  };
}

// ------------------------------------------------
// 主要邏輯:處理一則文字訊息
// ------------------------------------------------

function handleTextMessage_(event) {
  const replyToken = event.replyToken;
  const userId = event.source.userId;
  const text = event.message.text.trim();

  if (text === '說明' || text.toLowerCase() === 'help') {
    replyToLine_(replyToken, getHelpText_());
    return;
  }

  if (text === '記帳') {
    replyToLine_(replyToken, getRecordFormReplyText_());
    return;
  }

  if (text === '分類') {
    replyToLine_(replyToken, getCategoryListText_());
    return;
  }

  if (text.indexOf('同步') === 0) {
    const remain = text.replace(/^同步(損益表)?\s*/, '').trim();
    if (!remain) {
      const result = syncPnLThisMonth_();
      replyToLine_(replyToken, result);
      return;
    }

    const now = new Date();
    let targetYear = now.getFullYear();
    let targetMonth = now.getMonth() + 1;

    const ymMatch = remain.match(/(\d{4})[年\/\-.](\d{1,2})/);
    if (ymMatch) {
      targetYear = Number(ymMatch[1]);
      targetMonth = Number(ymMatch[2]);
    } else {
      const mMatch = remain.match(/(\d{1,2})月?/);
      if (mMatch) {
        targetMonth = Number(mMatch[1]);
      }
    }

    const result = syncPnLForMonth_(targetYear, targetMonth);
    replyToLine_(replyToken, result);
    return;
  }

  if (text === '本月' || text === '統計') {
    replyToLine_(replyToken, getMonthlySummary_());
    return;
  }

  if (text === '刪除') {
    const result = deleteLastEntry_(userId);
    replyToLine_(replyToken, result);
    return;
  }

  if (text === '代墊' || text === '未還款') {
    const result = getUnreimbursedText_();
    replyToLine_(replyToken, result);
    return;
  }

  if (text.indexOf('已還') === 0) {
    const personName = text.replace(/^已還\s*/, '').trim();
    if (!personName) {
      replyToLine_(replyToken, '請在「已還」後面加上人名,例如:已還 小王');
      return;
    }
    const result = markReimbursed_(personName);
    replyToLine_(replyToken, result);
    return;
  }

  // 其他任何打不懂的文字,引導去用表單,而不是再嘗試解析成一筆記帳
  replyToLine_(replyToken,
    '想記帳的話,輸入「記帳」打開記帳表單 📝\n\n' +
    '其他可用指令,輸入「說明」查看');
}

function getRecordFormReplyText_() {
  return '📝 點這裡打開記帳與查帳本:\n👉 https://yehhuachen.github.io/xiangkou-accounting/';
}

// ------------------------------------------------
// 表單送出時呼叫的函式(由 RecordForm.html 的 google.script.run 呼叫)
// ------------------------------------------------
//
// payload 格式:
// {
//   date: 'YYYY-MM-DD',
//   isCustom: false,
//   section: '生活支出', category: '飲食',      // isCustom = false 時使用
//   customCategory: '', customType: '支出',      // isCustom = true 時使用
//   account: '小王', customAccount: '',          // account === '__other__' 時用 customAccount
//   amount: '350',
//   note: '晚餐',
//   userId: 'U...', displayName: '阿明'
// }

function submitEntryFromForm(payload) {
  if (!payload) {
    return { success: false, message: '資料有誤，請重新填寫。' };
  }

  const amount = parseFloat(payload.amount);
  if (!payload.amount || isNaN(amount) || amount === 0) {
    return { success: false, message: '金額請輸入非 0 的數字。' };
  }

  if (!payload.date) {
    return { success: false, message: '請選擇日期。' };
  }
  const dateParts = payload.date.split('-').map(Number);
  const now = new Date();
  const entryDate = new Date(dateParts[0], dateParts[1] - 1, dateParts[2], now.getHours(), now.getMinutes(), now.getSeconds());
  if (isNaN(entryDate.getTime())) {
    return { success: false, message: '日期格式有問題,請重新選擇。' };
  }

  let section, category, type;
  if (payload.isCustom) {
    category = String(payload.customCategory || '').trim();
    if (!category) {
      return { success: false, message: '請輸入自訂分類的名稱。' };
    }
    section = '其他';
    type = payload.customType === '收入' ? '收入' : '支出';
  } else {
    section = payload.section;
    category = payload.category;
    if (!section || !category || !CATEGORY_MAP[section] || CATEGORY_MAP[section].indexOf(category) === -1) {
      return { success: false, message: '分類選項有誤,請重新選擇。' };
    }
    const override = CATEGORY_OVERRIDES[category];
    type = (override && override.type) || SECTION_TYPE[section];
  }

  let account = payload.account === '__other__'
    ? String(payload.customAccount || '').trim()
    : String(payload.account || '').trim();

  const note = String(payload.note || '').trim();

  const parsed = {
    date: entryDate,
    section: section,
    type: type,
    category: category,
    account: account,
    amount: amount,
    note: note
  };

  // 帳號/記帳人防呆：有 LINE 暱稱用 LINE 暱稱，否則以選取的帳戶（小花/羅/公司）為主
  const displayName = (payload.displayName && payload.displayName !== '未知使用者')
    ? String(payload.displayName).trim()
    : (account || '記帳人');
  const userId = payload.userId || ('web_' + (account || 'user'));

  const sheet = getRecordSheet_();
  const duplicateInfo = checkDuplicate_(sheet, parsed);
  writeEntry_(userId, displayName, parsed);

  const dateLabel = Utilities.formatDate(entryDate, Session.getScriptTimeZone(), 'M/d');
  const sign = type === '收入' ? '+' : '-';

  const result = {
    success: true,
    dateLabel: dateLabel,
    section: section,
    category: category,
    account: account,
    amountLabel: sign + amount,
    note: note
  };

  if (duplicateInfo) {
    result.duplicateWarning =
      duplicateInfo.userName + ' 已經記過一筆一模一樣的(' + dateLabel + ' ' + category + ' $' + amount +
      (account ? '，' + account : '') + '),如果是不小心重複記的,可以到 LINE 打「刪除」撤銷。';
  }

  return result;
}

// ------------------------------------------------
// 重複記帳偵測(寫入前檢查,避免手滑重複記兩次)
// ------------------------------------------------
//
// 判斷標準:同一天 + 同分類 + 同金額 + 同一個代墊人(帳戶欄位),四個都一樣才算重複。

function checkDuplicate_(sheet, parsed) {
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return null;

  const targetDateStr = Utilities.formatDate(parsed.date, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  const targetAccount = String(parsed.account || '').trim().toLowerCase();

  for (let row = 1; row < data.length; row++) {
    const rowDate = data[row][0];
    if (!(rowDate instanceof Date)) continue;

    const rowDateStr = Utilities.formatDate(rowDate, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    const rowCategory = String(data[row][5] || '').trim();
    const rowAccount = String(data[row][6] || '').trim().toLowerCase();
    const rowAmount = Number(data[row][7]);

    if (rowDateStr === targetDateStr &&
        rowCategory === parsed.category &&
        rowAccount === targetAccount &&
        rowAmount === parsed.amount) {
      return { userName: data[row][2], account: data[row][6] };
    }
  }
  return null;
}

// ------------------------------------------------
// 寫入 Google Sheets(記帳本)
// ------------------------------------------------

function writeEntry_(userId, displayName, parsed) {
  const sheet = getRecordSheet_();
  sheet.appendRow([
    parsed.date,
    userId,
    displayName,
    parsed.type,
    parsed.section,
    parsed.category,
    parsed.account,
    parsed.amount,
    parsed.note,
    '' // 已還款,新記錄預設空白(未還)
  ]);
}

// ------------------------------------------------
// 刪除該使用者最後一筆記錄(依「記錄在表格裡的位置」判斷最新,不是記帳日期)
// ------------------------------------------------

function deleteLastEntry_(userId) {
  const sheet = getRecordSheet_();
  const data = sheet.getDataRange().getValues();

  for (let row = data.length - 1; row >= 1; row--) {
    if (data[row][1] === userId) {
      sheet.deleteRow(row + 1);
      // 欄位順序:時間,使用者ID,使用者名稱,類型,區塊,分類,帳戶,金額,備註,已還款
      return '🗑️ 已刪除你最後一筆記錄(' + data[row][4] + '):\n' +
        data[row][5] + ' ' + data[row][6] + ' ' + data[row][7] + ' ' + (data[row][8] || '');
    }
  }
  return '沒有找到你的記錄可以刪除喔';
}

// ------------------------------------------------
// 本月統計(依人 + 分類)
// ------------------------------------------------

function getMonthlySummary_() {
  const sheet = getRecordSheet_();
  const data = sheet.getDataRange().getValues();

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  // { 姓名: { 收入: total, 支出: total, categories: {分類: total} } }
  const summary = {};

  for (let row = 1; row < data.length; row++) {
    const [timestamp, userId, name, type, section, category, account, amount] = data[row];
    if (!(timestamp instanceof Date)) continue;
    if (timestamp.getFullYear() !== year || timestamp.getMonth() !== month) continue;

    if (!summary[name]) {
      summary[name] = { 收入: 0, 支出: 0, categories: {} };
    }
    summary[name][type] += amount;

    if (type === '支出') {
      summary[name].categories[category] = (summary[name].categories[category] || 0) + amount;
    }
  }

  const names = Object.keys(summary);
  if (names.length === 0) {
    return '本月還沒有任何記錄喔';
  }

  let text = '📊 ' + (month + 1) + ' 月統計\n';
  let totalExpense = 0;
  let totalIncome = 0;

  names.forEach(function (name) {
    const s = summary[name];
    totalExpense += s['支出'];
    totalIncome += s['收入'];
    text += '\n👤 ' + name + '\n';
    text += '  收入 +' + s['收入'] + ' / 支出 -' + s['支出'] + '\n';

    const cats = Object.keys(s.categories).sort(function (a, b) {
      return s.categories[b] - s.categories[a];
    });
    cats.forEach(function (cat) {
      text += '    ・' + cat + ': ' + s.categories[cat] + '\n';
    });
  });

  text += '\n💰 合計:收入 +' + totalIncome + ' / 支出 -' + totalExpense;
  text += '\n淨額:' + (totalIncome - totalExpense);

  return text;
}

// ------------------------------------------------
// 分類清單查詢(輸入「分類」時回覆)
// ------------------------------------------------

function getCategoryListText_() {
  let text = '📂 目前可用分類\n';

  Object.keys(CATEGORY_MAP).forEach(function (sectionName) {
    text += '\n【' + sectionName + '】\n';
    text += CATEGORY_MAP[sectionName].join('、') + '\n';
  });

  text += '\n記帳請打「記帳」打開表單選擇,不在清單裡的分類可以在表單裡選「其他」手動輸入。';
  return text;
}

// ------------------------------------------------
// 代墊未還款查詢 / 標記已還款
// ------------------------------------------------

function getUnreimbursedText_() {
  const sheet = getRecordSheet_();
  const data = sheet.getDataRange().getValues();
  const totals = {}; // { 人名: { count, amount } }

  for (let row = 1; row < data.length; row++) {
    const account = String(data[row][6] || '').trim();
    const amount = data[row][7];
    const reimbursed = String(data[row][9] || '').trim();

    if (!account || reimbursed) continue;

    if (!totals[account]) {
      totals[account] = { count: 0, amount: 0 };
    }
    totals[account].count += 1;
    totals[account].amount += amount;
  }

  const names = Object.keys(totals);
  if (names.length === 0) {
    return '目前沒有未還款的代墊紀錄';
  }

  let text = '💸 代墊未還款\n';
  names.forEach(function (name) {
    const t = totals[name];
    text += '\n👤 ' + name + ':' + t.amount + ' 元(' + t.count + ' 筆)';
  });
  text += '\n\n要標記已還,輸入「已還 人名」,例如:已還 ' + names[0];
  return text;
}

function markReimbursed_(personName) {
  const target = personName.trim().toLowerCase();
  const sheet = getRecordSheet_();
  const data = sheet.getDataRange().getValues();
  const now = new Date();
  let count = 0;
  let total = 0;

  for (let row = 1; row < data.length; row++) {
    const account = String(data[row][6] || '').trim();
    const reimbursed = String(data[row][9] || '').trim();

    if (!reimbursed && account.toLowerCase() === target) {
      sheet.getRange(row + 1, 10).setValue(now); // 第 10 欄 = 已還款
      count++;
      total += data[row][7];
    }
  }

  if (count === 0) {
    return '沒有找到「' + personName + '」還沒還款的代墊紀錄喔(名字要跟記帳時選的帳戶欄位一致)';
  }

  return '✅ 已將 ' + personName + ' 的 ' + count + ' 筆代墊記錄標記為已還,共 ' + total + ' 元';
}

// ------------------------------------------------
// 每月自動同步:把本月加總數字寫進損益表 Google Sheet
// ------------------------------------------------

function syncPnLThisMonth_() {
  const now = new Date();
  return syncPnLForMonth_(now.getFullYear(), now.getMonth() + 1);
}

function syncPnLForMonth_(year, month) {
  const pnlSs = SpreadsheetApp.openById(getProp_('PNL_SPREADSHEET_ID'));

  // 1) 把記帳本裡「這個月」的資料依「區塊+分類」加總起來
  const totals = {}; // key: 區塊||分類 → 加總金額
  const sheet = getRecordSheet_();
  const data = sheet.getDataRange().getValues();

  for (let row = 1; row < data.length; row++) {
    const [timestamp, , , , section, category, , amount] = data[row];
    if (!(timestamp instanceof Date)) continue;
    if (timestamp.getFullYear() !== year || timestamp.getMonth() + 1 !== month) continue;
    if (!SECTION_TYPE[section]) continue; // 「其他」這種自訂分類,沒有對應的損益表分頁,跳過不同步

    const key = section + '||' + category;
    totals[key] = (totals[key] || 0) + amount;
  }

  // 2) 依序把每個「區塊」(=損益表裡的分頁)所有分類的加總數字寫進對應儲存格
  const sectionNames = Object.keys(SECTION_TYPE);
  const report = [];

  sectionNames.forEach(function (sectionName) {
    const pnlSheet = findSheetFuzzy_(pnlSs, sectionName);
    if (!pnlSheet) {
      report.push('⚠️ 找不到損益表分頁:「' + sectionName + '」,請確認分頁名稱');
      return;
    }

    const colIndex = findMonthColumn_(pnlSheet, year, month);
    if (!colIndex) {
      report.push('⚠️ 「' + sectionName + '」分頁找不到 ' + year + ' 年 ' + month + ' 月的欄位(可能是年度設定不同)');
      return;
    }

    const categoryList = CATEGORY_MAP[sectionName] || [];
    let writtenCount = 0;

    categoryList.forEach(function (category) {
      const rowIndex = findCategoryRow_(pnlSheet, category);
      if (!rowIndex) {
        report.push('⚠️ 「' + sectionName + '」分頁找不到分類列:「' + category + '」');
        return;
      }
      const key = sectionName + '||' + category;
      const rawValue = totals[key] || 0;
      const pnlSign = (CATEGORY_OVERRIDES[category] && CATEGORY_OVERRIDES[category].pnlSign) || 1;
      pnlSheet.getRange(rowIndex, colIndex).setValue(rawValue * pnlSign);
      writtenCount++;
    });

    report.push('✅ ' + sectionName + ':已更新 ' + writtenCount + ' 個分類');
  });

  return '📥 損益表同步完成(' + year + ' 年 ' + month + ' 月)\n\n' + report.join('\n');
}

function findSheetFuzzy_(ss, name) {
  const normalize = function (s) {
    return s.replace(/\s+/g, '').replace(/[()（）]/g, '');
  };
  const target = normalize(name);
  const sheets = ss.getSheets();
  for (let i = 0; i < sheets.length; i++) {
    if (normalize(sheets[i].getName()) === target) {
      return sheets[i];
    }
  }
  for (let i = 0; i < sheets.length; i++) {
    const n = normalize(sheets[i].getName());
    if (n.indexOf(target) !== -1 || target.indexOf(n) !== -1) {
      return sheets[i];
    }
  }
  return null;
}

function findMonthColumn_(sheet, year, month) {
  const lastCol = Math.min(sheet.getLastColumn(), 40);
  const headerRows = sheet.getRange(1, 1, Math.min(sheet.getLastRow(), 10), lastCol).getValues();
  const pattern = /^(\d{4})\s*年\s*(\d{1,2})\s*月$/;

  for (let r = 0; r < headerRows.length; r++) {
    for (let c = 0; c < headerRows[r].length; c++) {
      const cellValue = String(headerRows[r][c] || '').trim();
      const match = cellValue.match(pattern);
      if (match && parseInt(match[1], 10) === year && parseInt(match[2], 10) === month) {
        return c + 1;
      }
    }
  }
  return null;
}

function findCategoryRow_(sheet, category) {
  const lastRow = sheet.getLastRow();
  const values = sheet.getRange(1, 1, lastRow, 3).getValues();
  const target = category.trim().toLowerCase();

  for (let r = 0; r < values.length; r++) {
    for (let c = 0; c < 3; c++) {
      const cellValue = String(values[r][c] || '').trim().toLowerCase();
      if (cellValue === target) {
        return r + 1;
      }
    }
  }
  return null;
}

// ------------------------------------------------
// (選用)建立每月自動同步的時間觸發器
// ------------------------------------------------

function createMonthlySyncTrigger_() {
  ScriptApp.getProjectTriggers().forEach(function (trigger) {
    if (trigger.getHandlerFunction() === 'syncPreviousMonthPnL_') {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  ScriptApp.newTrigger('syncPreviousMonthPnL_')
    .timeBased()
    .onMonthDay(1)
    .atHour(8)
    .create();
}

function syncPreviousMonthPnL_() {
  const now = new Date();
  const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  syncPnLForMonth_(prevMonthDate.getFullYear(), prevMonthDate.getMonth() + 1);
}

// ------------------------------------------------
// 回覆訊息給 LINE
// ------------------------------------------------

function replyToLine_(replyToken, text) {
  const token = getProp_('CHANNEL_ACCESS_TOKEN');
  const url = 'https://api.line.me/v2/bot/message/reply';

  const payload = {
    replyToken: replyToken,
    messages: [{ type: 'text', text: text }]
  };

  UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + token },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });
}

// ------------------------------------------------
// 說明文字
// ------------------------------------------------

function getHelpText_() {
  return '📖 使用說明\n\n' +
    '記帳:輸入「記帳」打開表單,選分類、帳戶(代墊人)、日期,打金額跟備註就能送出。\n\n' +
    '查看分類清單:「分類」\n' +
    '查本月統計:「本月」或「統計」\n' +
    '刪除自己最後一筆:「刪除」\n\n' +
    '「帳戶」欄位可以選代墊付款的人名,方便之後對帳還款:\n' +
    '查代墊未還款:「代墊」或「未還款」\n' +
    '標記某人已還款:「已還 小王」\n\n' +
    '手動同步損益表(本月):「同步損益表」或「同步」\n' +
    '顯示這份說明:「說明」';
}
