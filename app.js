// ========================================================
// 巷口麵店記帳 - 主程式邏輯 (App.js)
// ========================================================

// 預設分類表 (對應 Google Sheet 損益表與記帳本)
const CATEGORIES_CONFIG = {
  '營收 (銷售額)': ['現金', '吳柏毅', 'LINE PAY', '其他支付'],
  '銷售成本': [
    '水餃', '中泰', '餛飩', '禾家歡', '杰帆', '菜市場', '麵',
    '十甲旺內臟', '靜宜豬肉', '粉腸', '蛋', '豬耳朵', '百豐', '辣椒',
    '米食家', '彰化', '頭張素料', '新東', '九大', '宥杏', '萬成'
  ],
  '營業支出': [
    '薪水支出', '租金', '水費', '天然氣', '天然氣（公司）', '電費', '電話網路', 'POS',
    '營業雜支', '吳伯毅抽成', 'line抽成', '健保', '設備', '裝潢'
  ],
  '房屋': ['租金', '118房貸', '116房貸', '潭子房貸'],
  '生活支出': [
    '好市多', '飲食', '汽車', '機車', '生活雜支', '旅遊', '貓',
    '天然氣', '串流平台', '電費'
  ]
};

// 常用捷徑分類清單 (顯示在表單晶片按鈕)
const QUICK_CHIPS = [
  '飲食', '設備', '貓', '菜市場',
  '麵', '豬肉', '水餃', '蛋',
  '電費', '水費', '瓦斯', '雜支'
];

// 預設 Demo 測試資料 (完美符合截圖畫面，離線或無 API 時依然能展示)
const DEMO_ENTRIES = [
  { id: 'd1', date: '2026-09-03', type: '支出', section: '生活支出', category: '飲食', account: '現金', amount: 80, note: '巷口麵店' },
  { id: 'd2', date: '2026-09-03', type: '支出', section: '生活支出', category: '飲食', account: '現金', amount: 120, note: '巷口麵店' },
  { id: 'd3', date: '2026-09-03', type: '支出', section: '營業支出', category: '設備', account: '現金', amount: 1500, note: '巷口麵店 | 角鋼' },
  { id: 'd4', date: '2026-09-03', type: '支出', section: '營業支出', category: '設備', account: '現金', amount: 800, note: '巷口麵店 | 飯鍋' },
  { id: 'd5', date: '2026-09-03', type: '支出', section: '生活支出', category: '貓', account: '現金', amount: 323, note: '巷口麵店 | 貓砂盆' },
  { id: 'd6', date: '2026-09-01', type: '支出', section: '銷售成本', category: '水餃', account: '小花', amount: 2400, note: '水餃皮進貨' },
  { id: 'd7', date: '2026-09-02', type: '支出', section: '銷售成本', category: '菜市場', account: '羅', amount: 1250, note: '蔥、青菜' },
  { id: 'd8', date: '2026-09-04', type: '支出', section: '銷售成本', category: '靜宜豬肉', account: '小花', amount: 3600, note: '絞肉、胛心' },
  { id: 'd9', date: '2026-09-05', type: '支出', section: '營業支出', category: '瓦斯', account: '公司', amount: 1800, note: '瓦斯兩桶' },
  { id: 'd10', date: '2026-09-06', type: '支出', section: '生活支出', category: '飲食', account: '現金', amount: 150, note: '午餐' },
  { id: 'd11', date: '2026-09-07', type: '支出', section: '銷售成本', category: '麵', account: '羅', amount: 1800, note: '拉麵、陽春麵條' },
  { id: 'd12', date: '2026-09-08', type: '支出', section: '銷售成本', category: '蛋', account: '現金', amount: 960, note: '白蛋兩箱' },
  { id: 'd13', date: '2026-09-10', type: '支出', section: '生活支出', category: '好市多', account: '小花', amount: 2150, note: '清潔劑、紙巾' },
  { id: 'd14', date: '2026-09-11', type: '支出', section: '生活支出', category: '貓', account: '現金', amount: 450, note: '飼料' },
  { id: 'd15', date: '2026-09-12', type: '支出', section: '營業支出', category: '營業雜支', account: '現金', amount: 380, note: '免洗餐具' },
  { id: 'd16', date: '2026-09-13', type: '支出', section: '銷售成本', category: '十甲旺內臟', account: '羅', amount: 1600, note: '大腸、肝連' },
  { id: 'd17', date: '2026-09-14', type: '支出', section: '銷售成本', category: '菜市場', account: '小花', amount: 890, note: '蔬菜補貨' }
];

class BookkeepingApp {
  constructor() {
    const now = new Date();
    // 預設永遠精準對齊「今天」的真實日期與真實月份
    this.currentYear = now.getFullYear();
    this.currentMonth = now.getMonth() + 1; // 1-12
    this.selectedDate = this.formatDate(now);

    this.currentView = 'calendar'; // 'calendar' 或 'list'
    this.entries = this.loadLocalEntries();
    
    this.initElements();
    this.bindEvents();
    this.initFormOptions();
    this.render();
    
    // 啟動時自動嘗試從 Google Sheet 後端拉取最新資料
    this.syncFromBackend();
  }

  // 讀取本地快取資料
  loadLocalEntries() {
    const saved = localStorage.getItem('xiangkou_entries');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && !parsed.some(item => item.id === 'd1')) {
          return parsed;
        }
      } catch (e) {}
    }
    return [];
  }

  saveLocalEntries() {
    localStorage.setItem('xiangkou_entries', JSON.stringify(this.entries));
  }

  formatDate(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  initElements() {
    // 頂部導覽
    this.todayBtn = document.getElementById('today-btn');
    this.tabCalendar = document.getElementById('tab-calendar');
    this.tabList = document.getElementById('tab-list');
    this.calendarView = document.getElementById('calendar-view');

    // 月份切換
    this.monthDisplay = document.getElementById('month-display');
    this.prevMonthBtn = document.getElementById('prev-month-btn');
    this.nextMonthBtn = document.getElementById('next-month-btn');

    // 行事曆網格
    this.daysGrid = document.getElementById('days-grid');

    // 統計列
    this.summaryTypeLabel = document.getElementById('summary-type-label');
    this.summaryAmount = document.getElementById('summary-amount');
    this.summaryDetails = document.getElementById('summary-details');

    // 明細列表
    this.transactionsContainer = document.getElementById('transactions-container');
    this.transactionsList = document.getElementById('transactions-list');

    // 底部導覽
    this.navHome = document.getElementById('nav-home');
    this.navAccounts = document.getElementById('nav-accounts');
    this.navAdd = document.getElementById('nav-add');
    this.navCharts = document.getElementById('nav-charts');
    this.navSettings = document.getElementById('nav-settings');

    // 彈出視窗
    this.addModal = document.getElementById('add-modal');
    this.closeAddModalBtn = document.getElementById('close-add-modal');
    this.recordForm = document.getElementById('record-form');
    this.entryAmount = document.getElementById('entry-amount');
    this.entryDate = document.getElementById('entry-date');
    this.entryCategorySelect = document.getElementById('entry-category-select');
    this.entryAccount = document.getElementById('entry-account');
    this.entryCustomAccount = document.getElementById('entry-custom-account');
    this.entryNote = document.getElementById('entry-note');
    this.typeBtnExpense = document.getElementById('type-btn-expense');
    this.typeBtnIncome = document.getElementById('type-btn-income');
    this.categoryChips = document.getElementById('category-chips');

    // 帳戶視窗
    this.accountsModal = document.getElementById('accounts-modal');
    this.closeAccountsModalBtn = document.getElementById('close-accounts-modal');
    this.unreimbursedListContent = document.getElementById('unreimbursed-list-content');

    // 設定視窗
    this.settingsModal = document.getElementById('settings-modal');
    this.closeSettingsModalBtn = document.getElementById('close-settings-modal');
    this.settingGasUrl = document.getElementById('setting-gas-url');
    this.saveSettingsBtn = document.getElementById('save-settings-btn');
    this.syncPnlBtn = document.getElementById('sync-pnl-btn');

    // 記帳人身分
    this.operatorName = localStorage.getItem('xiangkou_operator') || '小花';
    this.currentOperatorLabel = document.getElementById('current-operator-label');
    this.changeOperatorBtn = document.getElementById('change-operator-btn');

    // Toast
    this.toast = document.getElementById('toast-msg');
  }

  bindEvents() {
    // 切換記帳人身分
    if (this.changeOperatorBtn) {
      this.changeOperatorBtn.addEventListener('click', () => {
        const name = prompt('請輸入這支手機的記帳人名字（例如：小花、羅、老闆）：', this.operatorName);
        if (name && name.trim()) {
          this.operatorName = name.trim();
          localStorage.setItem('xiangkou_operator', this.operatorName);
          if (this.currentOperatorLabel) {
            this.currentOperatorLabel.textContent = this.operatorName;
          }
          this.showToast(`👤 已將本機記帳人設為：${this.operatorName}`);
        }
      });
    }

    // 視圖切換 (行事曆 vs 清單)
    this.tabCalendar.addEventListener('click', () => this.switchView('calendar'));
    this.tabList.addEventListener('click', () => this.switchView('list'));

    // 回到今天按鈕
    this.todayBtn.addEventListener('click', () => {
      const now = new Date();
      this.currentYear = now.getFullYear();
      this.currentMonth = now.getMonth() + 1;
      this.selectedDate = this.formatDate(now);
      this.render();
      this.showToast('📅 已回到今天');
    });

    // 月份切換
    this.prevMonthBtn.addEventListener('click', () => this.changeMonth(-1));
    this.nextMonthBtn.addEventListener('click', () => this.changeMonth(1));

    // 底部按鈕
    this.navHome.addEventListener('click', () => {
      this.setActiveNav(this.navHome);
      this.switchView('calendar');
    });

    this.navAdd.addEventListener('click', () => this.openAddModal());
    this.closeAddModalBtn.addEventListener('click', () => this.closeAddModal());

    this.navAccounts.addEventListener('click', () => this.openAccountsModal());
    this.closeAccountsModalBtn.addEventListener('click', () => this.closeAccountsModal());

    this.navCharts.addEventListener('click', () => {
      this.showToast('📊 本月總支出: $' + this.getMonthTotalExpense().toLocaleString());
    });

    this.navSettings.addEventListener('click', () => this.openSettingsModal());
    this.closeSettingsModalBtn.addEventListener('click', () => this.closeSettingsModal());

    // 帳戶下拉選單 (選「其他」時顯示手動輸入框)
    this.entryAccount.addEventListener('change', () => {
      if (this.entryAccount.value === '__other__') {
        this.entryCustomAccount.style.display = 'block';
        this.entryCustomAccount.focus();
      } else {
        this.entryCustomAccount.style.display = 'none';
      }
    });

    // 收支按鈕切換
    this.typeBtnExpense.addEventListener('click', () => {
      this.typeBtnExpense.classList.add('active', 'expense');
      this.typeBtnIncome.classList.remove('active', 'income');
      this.renderCategorySelect('支出');
    });
    this.typeBtnIncome.addEventListener('click', () => {
      this.typeBtnIncome.classList.add('active', 'income');
      this.typeBtnExpense.classList.remove('active', 'expense');
      this.renderCategorySelect('收入');
    });

    // 表單送出
    this.recordForm.addEventListener('submit', (e) => this.handleFormSubmit(e));

    // 設定儲存
    this.saveSettingsBtn.addEventListener('click', () => {
      const url = this.settingGasUrl.value.trim();
      api.setApiUrl(url);
      this.closeSettingsModal();
      this.showToast('✅ API 網址已儲存，正在同步…');
      this.syncFromBackend();
    });

    // 同步當月損益表
    if (this.syncPnlBtn) {
      this.syncPnlBtn.addEventListener('click', async () => {
        const y = this.currentYear;
        const m = this.currentMonth;
        if (!confirm(`確定要將【${y}年${m}月】的記帳加總同步寫入「損益表」Google Sheet 嗎？`)) {
          return;
        }
        this.showToast(`📈 正在同步 ${y}年${m}月 損益表…`);
        const res = await api.syncPnL(y, m);
        if (res && res.success) {
          alert('📈 損益表同步成功！\n\n' + (res.message || ''));
        } else {
          alert('同步提示: ' + (res.message || '連線逾時'));
        }
      });
    }

    // 點擊 Modal 背景關閉
    [this.addModal, this.accountsModal, this.settingsModal].forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.classList.remove('active');
        }
      });
    });
  }

  // 初始化分類清單
  initFormOptions() {
    this.renderCategorySelect('支出');
  }

  // 根據收支性質動態渲染分類選單
  renderCategorySelect(currentType = '支出') {
    this.entryCategorySelect.innerHTML = '';

    if (currentType === '收入') {
      const incomeSections = {
        '營收 (銷售額)': ['現金', '吳柏毅', 'LINE PAY', '其他支付'],
        '房屋 (租金收入)': ['租金'],
        '其他收入': ['其他']
      };
      Object.keys(incomeSections).forEach(section => {
        const group = document.createElement('optgroup');
        group.label = section;
        incomeSections[section].forEach(cat => {
          const opt = document.createElement('option');
          opt.value = cat;
          opt.textContent = `${getCategoryIcon(cat)} ${cat}`;
          group.appendChild(opt);
        });
        this.entryCategorySelect.appendChild(group);
      });
    } else {
      // 支出
      const expenseSections = {
        '銷售成本': CATEGORIES_CONFIG['銷售成本'],
        '營業支出': CATEGORIES_CONFIG['營業支出'],
        '房屋 (房貸支出)': ['118房貸', '116房貸', '潭子房貸'],
        '生活支出': CATEGORIES_CONFIG['生活支出'],
        '其他支出': ['其他']
      };
      Object.keys(expenseSections).forEach(section => {
        const group = document.createElement('optgroup');
        group.label = section;
        expenseSections[section].forEach(cat => {
          const opt = document.createElement('option');
          opt.value = cat;
          opt.textContent = `${getCategoryIcon(cat)} ${cat}`;
          group.appendChild(opt);
        });
        this.entryCategorySelect.appendChild(group);
      });
    }
  }

  // 切換月份
  changeMonth(delta) {
    this.currentMonth += delta;
    if (this.currentMonth > 12) {
      this.currentMonth = 1;
      this.currentYear += 1;
    } else if (this.currentMonth < 1) {
      this.currentMonth = 12;
      this.currentYear -= 1;
    }
    
    // 將選取日期切換至該月第一天
    this.selectedDate = `${this.currentYear}-${String(this.currentMonth).padStart(2, '0')}-01`;
    this.render();
    this.syncFromBackend();
  }

  // 切換視圖 (行事曆 vs 清單)
  switchView(viewName) {
    this.currentView = viewName;
    if (viewName === 'calendar') {
      this.tabCalendar.classList.add('active');
      this.tabList.classList.remove('active');
      this.calendarView.style.display = 'block';
    } else {
      this.tabList.classList.add('active');
      this.tabCalendar.classList.remove('active');
      this.calendarView.style.display = 'none';
    }
    this.render();
  }

  setActiveNav(activeBtn) {
    document.querySelectorAll('.bottom-nav .nav-item').forEach(btn => {
      btn.classList.toggle('active', btn === activeBtn);
    });
  }

  // 渲染主畫面
  render() {
    this.monthDisplay.textContent = `${this.currentYear}年${this.currentMonth}月`;
    if (this.currentView === 'calendar') {
      this.renderCalendarGrid();
      this.renderDayTransactions();
    } else {
      this.renderListTransactions();
    }
  }

  // 渲染行事曆網格
  renderCalendarGrid() {
    this.daysGrid.innerHTML = '';
    const year = this.currentYear;
    const month = this.currentMonth; // 1-12

    // 該月第一天是星期幾 (0: 週日, 1: 週一, ...)
    const firstDayIndex = new Date(year, month - 1, 1).getDay();
    // 該月天數
    const daysInCurrentMonth = new Date(year, month, 0).getDate();
    // 上個月天數
    const daysInPrevMonth = new Date(year, month - 1, 0).getDate();

    // 彙整當月有記帳的日期與次數
    const entriesMap = {};
    this.entries.forEach(item => {
      if (item.date && item.date.startsWith(`${year}-${String(month).padStart(2, '0')}`)) {
        entriesMap[item.date] = (entriesMap[item.date] || 0) + 1;
      }
    });

    const nowStr = this.formatDate(new Date());

    // 1. 填補上個月尾巴的天數 (如 8/30, 8/31)
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const prevDay = daysInPrevMonth - i;
      const cell = document.createElement('div');
      cell.className = 'day-cell other-month';
      if (i === firstDayIndex - 1) cell.classList.add('sunday');
      cell.innerHTML = `<span class="day-number">${prevDay}</span><div class="day-dots"></div>`;
      this.daysGrid.appendChild(cell);
    }

    // 2. 當月所有天數
    for (let day = 1; day <= daysInCurrentMonth; day++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayOfWeek = new Date(year, month - 1, day).getDay();

      const cell = document.createElement('div');
      cell.className = 'day-cell';
      if (dayOfWeek === 0) cell.classList.add('sunday');
      if (dateStr === this.selectedDate) cell.classList.add('selected');
      if (dateStr === nowStr) cell.classList.add('is-today');

      // 檢查此日是否有記帳 (畫綠點)
      const count = entriesMap[dateStr] || 0;
      let dotsHtml = '';
      if (count > 0) {
        if (count >= 2) {
          dotsHtml = '<span class="dot"></span><span class="dot"></span>';
        } else {
          dotsHtml = '<span class="dot"></span>';
        }
      }

      cell.innerHTML = `
        <span class="day-number">${day}</span>
        <div class="day-dots">${dotsHtml}</div>
      `;

      // 點選日期事件
      cell.addEventListener('click', () => {
        this.selectedDate = dateStr;
        document.querySelectorAll('.day-cell').forEach(c => c.classList.remove('selected'));
        cell.classList.add('selected');
        this.renderDayTransactions();
      });

      this.daysGrid.appendChild(cell);
    }

    // 3. 填補下個月開頭的天數，湊滿 35 或 42 格
    const totalCells = firstDayIndex + daysInCurrentMonth;
    const nextDaysCount = totalCells > 35 ? (42 - totalCells) : (35 - totalCells);
    for (let i = 1; i <= nextDaysCount; i++) {
      const cell = document.createElement('div');
      cell.className = 'day-cell other-month';
      cell.innerHTML = `<span class="day-number">${i}</span><div class="day-dots"></div>`;
      this.daysGrid.appendChild(cell);
    }
  }

  // 渲染當日明細清單 (行事曆選中日的項目)
  renderDayTransactions() {
    this.transactionsList.innerHTML = '';
    const dayEntries = this.entries.filter(e => e.date === this.selectedDate);

    // 計算當日支出加總 (完美對應截圖: 支出: 16,083)
    let dayExpense = 0;
    let dayIncome = 0;
    dayEntries.forEach(e => {
      const amt = Number(e.amount) || 0;
      if (e.type === '收入') dayIncome += amt;
      else dayExpense += amt;
    });

    this.summaryTypeLabel.textContent = '支出';
    this.summaryAmount.textContent = dayExpense.toLocaleString();

    // 點擊日期的文字提示 (例如: 9月3日)
    const dateParts = this.selectedDate.split('-');
    this.summaryDetails.textContent = `${Number(dateParts[1])}月${Number(dateParts[2])}日 (${dayEntries.length}筆)`;

    if (dayEntries.length === 0) {
      this.transactionsList.innerHTML = `
        <div class="empty-state">
          <div style="font-size:32px;">🍵</div>
          <p>這天還沒有任何記帳紀錄</p>
        </div>
      `;
      return;
    }

    dayEntries.forEach(item => {
      const el = this.createTransactionElement(item);
      this.transactionsList.appendChild(el);
    });
  }

  // 渲染清單模式 (全月份按日期倒序分組)
  renderListTransactions() {
    this.transactionsList.innerHTML = '';
    const monthPrefix = `${this.currentYear}-${String(this.currentMonth).padStart(2, '0')}`;
    const monthEntries = this.entries.filter(e => e.date && e.date.startsWith(monthPrefix));

    // 計算本月總支出
    const totalExp = this.getMonthTotalExpense();
    this.summaryTypeLabel.textContent = '本月支出';
    this.summaryAmount.textContent = totalExp.toLocaleString();
    this.summaryDetails.textContent = `共 ${monthEntries.length} 筆`;

    if (monthEntries.length === 0) {
      this.transactionsList.innerHTML = `
        <div class="empty-state">
          <div style="font-size:32px;">📊</div>
          <p>本月尚無任何記帳紀錄</p>
        </div>
      `;
      return;
    }

    // 依日期分組
    const groups = {};
    monthEntries.forEach(item => {
      if (!groups[item.date]) groups[item.date] = [];
      groups[item.date].push(item);
    });

    const sortedDates = Object.keys(groups).sort().reverse();
    sortedDates.forEach(dateStr => {
      const groupEl = document.createElement('div');
      groupEl.className = 'list-view-group';

      let dayTotal = 0;
      groups[dateStr].forEach(it => dayTotal += (Number(it.amount) || 0));

      const parts = dateStr.split('-');
      const header = document.createElement('div');
      header.className = 'list-view-date-header';
      header.innerHTML = `
        <span>${Number(parts[1])}月${Number(parts[2])}日</span>
        <span>當日支出: $${dayTotal.toLocaleString()}</span>
      `;
      groupEl.appendChild(header);

      groups[dateStr].forEach(item => {
        const itemEl = this.createTransactionElement(item);
        groupEl.appendChild(itemEl);
      });

      this.transactionsList.appendChild(groupEl);
    });
  }

  // 建立單筆明細卡片 (完美復刻截圖排版)
  createTransactionElement(item) {
    const el = document.createElement('div');
    el.className = 'transaction-item';

    const icon = getCategoryIcon(item.category);
    const isIncome = item.type === '收入';
    const amountPrefix = isIncome ? '+' : '';
    const amountClass = isIncome ? 'income' : 'expense';
    const formattedAmount = `${amountPrefix}${Number(item.amount).toLocaleString()}`;

    // 副標題格式 (例如: 巷口麵店 | 角鋼)
    const subtitle = item.note ? `${item.note}` : '巷口麵店';

    let accountBadgeText = item.account || '現金';
    if (item.displayName && item.displayName !== item.account) {
      accountBadgeText = `${item.account || '現金'} · ${item.displayName}`;
    }

    el.innerHTML = `
      <div class="item-left">
        <div class="item-icon-badge">${icon}</div>
        <div class="item-info">
          <div class="item-title">${item.category}</div>
          <div class="item-subtitle">${subtitle}</div>
        </div>
      </div>
      <div class="item-right">
        <div class="item-amount-group">
          <div class="item-amount ${amountClass}">${formattedAmount}</div>
          <div class="item-account-badge">${accountBadgeText}</div>
        </div>
        <button class="item-more-btn" title="選項">⋮</button>
      </div>
    `;

    // 點擊 ⋮ 刪除或操作
    const moreBtn = el.querySelector('.item-more-btn');
    moreBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (confirm(`確定要刪除這筆「${item.category} $${item.amount}」的紀錄嗎？`)) {
        this.deleteEntry(item.id);
      }
    });

    return el;
  }

  // 計算本月總支出
  getMonthTotalExpense() {
    const monthPrefix = `${this.currentYear}-${String(this.currentMonth).padStart(2, '0')}`;
    let total = 0;
    this.entries.forEach(e => {
      if (e.date && e.date.startsWith(monthPrefix) && e.type !== '收入') {
        total += Number(e.amount) || 0;
      }
    });
    return total;
  }

  // 打開新增記帳 Modal
  openAddModal() {
    this.entryDate.value = this.selectedDate;
    this.entryAmount.value = '';
    this.entryNote.value = '';
    this.entryCustomAccount.value = '';
    this.entryCustomAccount.style.display = 'none';
    this.entryAccount.value = '公司'; // 預設帳戶為公司

    // 顯示當前記帳人身分
    if (this.currentOperatorLabel) {
      this.currentOperatorLabel.textContent = this.operatorName;
    }

    // 預設支出
    this.typeBtnExpense.click();

    this.addModal.classList.add('active');
    setTimeout(() => this.entryAmount.focus(), 150);
  }

  closeAddModal() {
    this.addModal.classList.remove('active');
  }

  // 處理新增記帳送出
  async handleFormSubmit(e) {
    e.preventDefault();
    const amount = parseFloat(this.entryAmount.value);
    if (isNaN(amount) || amount === 0) {
      alert('請輸入有效金額（非 0，可為正負數）！');
      return;
    }

    const isIncome = this.typeBtnIncome.classList.contains('active');
    const category = this.entryCategorySelect.value;
    const account = this.entryAccount.value === '__other__' 
      ? (this.entryCustomAccount.value.trim() || '其他') 
      : this.entryAccount.value;
    const date = this.entryDate.value;
    const note = this.entryNote.value.trim();

    // 找出所屬 section
    let section = '生活支出';
    if (isIncome) {
      if (category === '租金') {
        section = '房屋';
      } else {
        section = '營收 (銷售額)';
      }
    } else {
      for (const sec in CATEGORIES_CONFIG) {
        if (CATEGORIES_CONFIG[sec].includes(category)) {
          section = sec;
          break;
        }
      }
    }

    const payload = {
      id: 'local_' + Date.now(),
      date: date,
      type: isIncome ? '收入' : '支出',
      section: section,
      category: category,
      account: account,
      amount: amount,
      note: note,
      userId: 'web_' + encodeURIComponent(this.operatorName),
      displayName: this.operatorName
    };

    // 樂觀更新 (立即顯示在介面上)
    this.entries.unshift(payload);
    this.saveLocalEntries();
    this.selectedDate = date;

    const parts = date.split('-');
    this.currentYear = Number(parts[0]);
    this.currentMonth = Number(parts[1]);

    this.closeAddModal();
    this.render();
    this.showToast(`✅ 已記錄 ${category} $${amount}`);

    // 後台異步同步至 Google Sheet
    try {
      const res = await api.addEntry(payload);
      if (res && res.success) {
        console.log('同步至 Google Sheet 成功:', res);
        this.syncFromBackend();
      } else if (res && !res.success) {
        console.warn('雲端寫入提示:', res.message);
      }
    } catch (err) {
      console.warn('同步至雲端失敗 (仍保存在手機上):', err);
    }
  }

  // 刪除紀錄
  async deleteEntry(id) {
    this.entries = this.entries.filter(e => e.id !== id);
    this.saveLocalEntries();
    this.render();
    this.showToast('🗑️ 已刪除該筆紀錄');

    try {
      await api.deleteEntry(id);
    } catch (err) {}
  }

  // 打開帳戶與代墊結算 Modal
  async openAccountsModal() {
    this.accountsModal.classList.add('active');
    this.unreimbursedListContent.innerHTML = '<p style="text-align:center; padding:20px; color:#8e8e93;">計算中…</p>';

    // 計算各帳戶未還款代墊加總
    const totals = {};
    this.entries.forEach(item => {
      const acc = item.account || '現金';
      if (acc !== '現金' && acc !== '公司') {
        totals[acc] = (totals[acc] || 0) + (Number(item.amount) || 0);
      }
    });

    const names = Object.keys(totals);
    if (names.length === 0) {
      this.unreimbursedListContent.innerHTML = `
        <div class="empty-state">
          <div style="font-size:32px;">🎉</div>
          <p>目前沒有任何代墊未結算款項</p>
        </div>
      `;
      return;
    }

    let html = '<div style="display:flex; flex-direction:column; gap:12px;">';
    names.forEach(name => {
      html += `
        <div style="background:#1a1a1c; border-radius:12px; padding:14px 16px; display:flex; justify-content:space-between; align-items:center;">
          <div>
            <div style="font-size:16px; font-weight:700; color:#fff;">👤 ${name}</div>
            <div style="font-size:13px; color:#8e8e93; margin-top:2px;">代墊金額: $${totals[name].toLocaleString()}</div>
          </div>
          <button style="background:#2c2c2e; border:1px solid #3a3a3c; color:#fff; border-radius:8px; padding:6px 12px; font-size:13px; cursor:pointer;" onclick="app.markPersonReimbursed('${name}')">
            標記已結清
          </button>
        </div>
      `;
    });
    html += '</div>';
    this.unreimbursedListContent.innerHTML = html;
  }

  closeAccountsModal() {
    this.accountsModal.classList.remove('active');
  }

  markPersonReimbursed(personName) {
    if (confirm(`確定已將「${personName}」的所有代墊款項結清還款嗎？`)) {
      this.entries = this.entries.filter(e => e.account !== personName);
      this.saveLocalEntries();
      this.render();
      this.openAccountsModal();
      this.showToast(`✅ 已將 ${personName} 的代墊款項結清`);
      api.markReimbursed(personName);
    }
  }

  // 設定 Modal
  openSettingsModal() {
    this.settingGasUrl.value = api.getApiUrl();
    this.settingsModal.classList.add('active');
  }

  closeSettingsModal() {
    this.settingsModal.classList.remove('active');
  }

  // 從 Google Sheet 後端同步最新資料
  async syncFromBackend() {
    const res = await api.getEntries();
    if (res && res.success && Array.isArray(res.entries)) {
      console.log('從 Google Sheet 同步到新資料:', res.entries.length, '筆');
      this.entries = res.entries;
      this.saveLocalEntries();
      this.render();
      this.showToast(`☁️ 已與 Google 試算表同步 (${res.entries.length} 筆)`);
    }
  }

  // 提示訊息 (Toast)
  showToast(msg) {
    this.toast.textContent = msg;
    this.toast.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      this.toast.classList.remove('show');
    }, 2200);
  }
}

// 實例化全域應用程式
const app = new BookkeepingApp();
