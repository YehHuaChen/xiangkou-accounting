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
    '飲食', '生活雜支', '好市多', '貓', '機車', '汽車', '旅遊',
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
    
    // 啟動時預設只從 Google Sheet 拉取當前月份的最新資料 (秒開不卡頓)
    this.syncFromBackend(this.currentYear, this.currentMonth);
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

    // 損益分析視窗
    this.pnlModal = document.getElementById('pnl-modal');
    this.closePnlModalBtn = document.getElementById('close-pnl-modal');
    this.pnlModalTitle = document.getElementById('pnl-modal-title');
    this.pnlModalContent = document.getElementById('pnl-modal-content');

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
      const prevY = this.currentYear;
      const prevM = this.currentMonth;
      this.currentYear = now.getFullYear();
      this.currentMonth = now.getMonth() + 1;
      this.selectedDate = this.formatDate(now);
      this.render();
      this.showToast('📅 已回到今天');
      if (prevY !== this.currentYear || prevM !== this.currentMonth) {
        this.syncFromBackend(this.currentYear, this.currentMonth);
      }
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
      this.openPnlModal();
    });
    this.closePnlModalBtn.addEventListener('click', () => this.closePnlModal());

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
    [this.addModal, this.accountsModal, this.settingsModal, this.pnlModal].forEach(modal => {
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
      // 支出 (生活支出與飲食在最上面)
      const expenseSections = {
        '生活支出': CATEGORIES_CONFIG['生活支出'],
        '銷售成本': CATEGORIES_CONFIG['銷售成本'],
        '營業支出': CATEGORIES_CONFIG['營業支出'],
        '房屋 (房貸支出)': ['118房貸', '116房貸', '潭子房貸'],
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
    this.syncFromBackend(this.currentYear, this.currentMonth);
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

    // 彙整當月有記帳的日期與收支類型 (綠點表示收入，紅點表示支出)
    const dayStats = {};
    this.entries.forEach(item => {
      if (item.date && item.date.startsWith(`${year}-${String(month).padStart(2, '0')}`)) {
        if (!dayStats[item.date]) {
          dayStats[item.date] = { hasExpense: false, hasIncome: false };
        }
        if (item.type === '收入') {
          dayStats[item.date].hasIncome = true;
        } else {
          dayStats[item.date].hasExpense = true;
        }
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

      // 檢查此日是否有記帳 (綠點表示收入，紅點表示支出)
      const stat = dayStats[dateStr];
      let dotsHtml = '';
      if (stat) {
        if (stat.hasIncome) {
          dotsHtml += '<span class="dot income" title="收入"></span>';
        }
        if (stat.hasExpense) {
          dotsHtml += '<span class="dot expense" title="支出"></span>';
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

    if (dayIncome > 0 && dayExpense === 0) {
      this.summaryTypeLabel.textContent = '收入';
      this.summaryAmount.textContent = dayIncome.toLocaleString();
    } else {
      this.summaryTypeLabel.textContent = '支出';
      this.summaryAmount.textContent = dayExpense.toLocaleString();
    }

    // 點擊日期的文字提示 (例如: 9月3日)
    const dateParts = this.selectedDate.split('-');
    const extraIncomeText = (dayIncome > 0 && dayExpense > 0) ? ` · 收入 $${dayIncome.toLocaleString()}` : '';
    this.summaryDetails.textContent = `${Number(dateParts[1])}月${Number(dateParts[2])}日 (${dayEntries.length}筆${extraIncomeText})`;

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
        const [entryY, entryM] = date.split('-').map(Number);
        this.syncFromBackend(entryY, entryM);
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
    this.unreimbursedListContent.innerHTML = '<p style="text-align:center; padding:20px; color:#8e8e93;">讀取最新未結算紀錄中…</p>';

    // 查看對帳時，拉取全部資料以確保跨月份代墊款項不遺漏
    try {
      const res = await api.getEntries();
      if (res && res.success && Array.isArray(res.entries)) {
        res.entries.forEach(item => {
          const idx = this.entries.findIndex(e => e.id === item.id);
          if (idx !== -1) {
            this.entries[idx] = item;
          } else {
            this.entries.push(item);
          }
        });
        this.saveLocalEntries();
      }
    } catch (err) {}

    // 計算各帳戶未還款代墊加總 (支出為代墊，收入為代收扣除)
    const totals = {};
    this.personFormulas = {};

    this.entries.forEach(item => {
      const acc = (item.account || '現金').trim();
      const reimbursed = String(item.reimbursed || '').trim();
      if (!acc || acc === '現金' || acc === '公司' || reimbursed) return;

      const amt = Number(item.amount) || 0;
      if (!totals[acc]) {
        totals[acc] = { expense: 0, income: 0, net: 0, count: 0, items: [] };
      }
      totals[acc].count++;
      if (item.type === '收入') {
        totals[acc].income += amt;
      } else {
        totals[acc].expense += amt;
      }
      totals[acc].net = totals[acc].expense - totals[acc].income;
      totals[acc].items.push(item);
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

    let html = '<div style="display:flex; flex-direction:column; gap:14px;">';
    names.forEach(name => {
      const t = totals[name];

      // 依日期先後排序
      t.items.sort((a, b) => (a.date || '').localeCompare(b.date || ''));

      // 狀態與金額提示
      let statusHtml = '';
      if (t.net > 0) {
        statusHtml = `<div class="reimburse-status-net pay-out">公司應還款: $${t.net.toLocaleString()}</div>`;
      } else if (t.net < 0) {
        statusHtml = `<div class="reimburse-status-net pay-in">應繳回公司: $${Math.abs(t.net).toLocaleString()}</div>`;
      } else {
        statusHtml = `<div class="reimburse-status-net settled">已打平: $0</div>`;
      }

      const summaryHtml = `<div class="reimburse-summary-sub">代墊支出 $${t.expense.toLocaleString()} · 代收扣除 -$${t.income.toLocaleString()} (共 ${t.count} 筆)</div>`;

      // 組合對帳算式 (例如：公司11010 + 好市多10470 + cube11996 + 房租23000 + 上海16493 + 富邦20459 = 93428)
      const formulaParts = [];
      let itemsHtml = '';

      t.items.forEach(item => {
        let label = (item.note || '').trim();
        label = label.replace(/^巷口麵店\s*\|\s*/i, '').trim();
        if (!label) {
          label = (item.category || item.section || '款項').trim();
        }
        const amt = Math.abs(Number(item.amount) || 0);
        const isIncome = (item.type === '收入');

        formulaParts.push({
          sign: isIncome ? '-' : '+',
          label: label,
          amt: amt
        });

        const amtFormatted = isIncome ? `-$${amt.toLocaleString()}` : `+$${amt.toLocaleString()}`;
        const amtClass = isIncome ? 'minus' : 'plus';
        const dateRaw = (item.date || '').slice(5);
        const dateDisplay = dateRaw ? dateRaw.replace('-', '/') : '';
        const whoBadge = (item.displayName || item.operator) ? `<span class="reimburse-who">✍️ ${item.displayName || item.operator}</span>` : '';

        itemsHtml += `
          <div class="reimburse-item-row">
            <div class="reimburse-item-left">
              <span class="reimburse-date">${dateDisplay}</span>
              <span class="reimburse-title">${label}</span>
              <span class="reimburse-badge">${item.category || item.section || ''}</span>
              ${whoBadge}
            </div>
            <div class="reimburse-amount ${amtClass}">${amtFormatted}</div>
          </div>
        `;
      });

      let formulaStr = '';
      formulaParts.forEach((part, idx) => {
        if (idx === 0) {
          formulaStr += (part.sign === '-' ? `-${part.label}${part.amt}` : `${part.label}${part.amt}`);
        } else {
          formulaStr += (part.sign === '-' ? ` - ${part.label}${part.amt}` : ` + ${part.label}${part.amt}`);
        }
      });
      formulaStr += ` = ${t.net}`;

      // 儲存算式至物件供複製使用
      this.personFormulas[name] = `${name}：\n${formulaStr}\n總計：$${t.net.toLocaleString()}`;

      html += `
        <div class="reimburse-card">
          <div class="reimburse-card-header">
            <div>
              <div class="reimburse-person-name">👤 ${name}</div>
              ${statusHtml}
              ${summaryHtml}
            </div>
          </div>

          <!-- 對帳算式方塊 -->
          <div class="reimburse-formula-container">
            <div class="reimburse-formula-header">
              <span class="reimburse-formula-title">📐 對帳算式</span>
              <button class="copy-formula-btn" onclick="app.copyFormula('${name}')">📋 複製算式</button>
            </div>
            <div class="reimburse-formula-content">${formulaStr}</div>
          </div>

          <!-- 逐筆明細清單 -->
          <div class="reimburse-items-header">
            <span>各筆明細 (${t.items.length} 筆)</span>
            <span style="font-size:11px; color:#8e8e93;">依日期先後</span>
          </div>
          <div class="reimburse-items-list">
            ${itemsHtml}
          </div>

          <div class="reimburse-card-actions">
            <button class="settle-person-btn" onclick="app.markPersonReimbursed('${name}')">
              標記已結清
            </button>
          </div>
        </div>
      `;
    });
    html += '</div>';
    this.unreimbursedListContent.innerHTML = html;
  }

  // 複製對帳算式到剪貼簿
  copyFormula(personName) {
    const text = this.personFormulas && this.personFormulas[personName];
    if (!text) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        this.showToast(`📋 已複製 ${personName} 的對帳算式！`);
      }).catch(() => {
        this.fallbackCopy(text, personName);
      });
    } else {
      this.fallbackCopy(text, personName);
    }
  }

  fallbackCopy(text, personName) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      this.showToast(`📋 已複製 ${personName} 的對帳算式！`);
    } catch (e) {
      prompt('請手動選取複製算式：', text);
    }
    document.body.removeChild(ta);
  }

  closeAccountsModal() {
    this.accountsModal.classList.remove('active');
  }

  markPersonReimbursed(personName) {
    if (confirm(`確定已將「${personName}」的所有代墊與代收款項結清銷帳嗎？`)) {
      this.entries.forEach(e => {
        if (e.account === personName) {
          e.reimbursed = '已結清';
        }
      });
      this.saveLocalEntries();
      this.render();
      this.openAccountsModal();
      this.showToast(`✅ 已將 ${personName} 的款項標記結清`);
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

  // 損益與營運分析 Modal
  openPnlModal() {
    this.pnlModal.classList.add('active');
    this.pnlModalTitle.textContent = `📈 ${this.currentYear}年${this.currentMonth}月 損益與營運分析`;
    this.renderPnlModal();
  }

  closePnlModal() {
    this.pnlModal.classList.remove('active');
  }

  async syncCurrentMonthPnL() {
    const y = this.currentYear;
    const m = this.currentMonth;
    if (!confirm(`確定要將【${y}年${m}月】的記帳加總同步寫入「損益表」Google Sheet 嗎？`)) {
      return;
    }
    this.showToast(`📈 正在同步 ${y}年${m}月 損益表…`);
    const res = await api.syncPnL(y, m);
    if (res && res.success) {
      alert(`📈 ${y}年${m}月 損益表同步成功！\n\n` + (res.message || ''));
    } else {
      alert('同步提示: ' + (res.message || '連線逾時'));
    }
  }

  renderPnlModal() {
    const monthPrefix = `${this.currentYear}-${String(this.currentMonth).padStart(2, '0')}`;
    const monthEntries = this.entries.filter(e => e.date && e.date.startsWith(monthPrefix));

    // 各大項計算
    let totalRevenue = 0;
    let revCash = 0;
    let revUber = 0;
    let revLinePay = 0;
    let revOther = 0;

    let foodCost = 0;
    const foodItems = {};

    let opExpense = 0;
    let houseIncome = 0;
    let mortgageExpense = 0;
    let lifeExpense = 0;

    monthEntries.forEach(item => {
      const amt = Number(item.amount) || 0;
      const isIncome = (item.type === '收入');
      const cat = (item.category || '').trim();
      const sec = (item.section || '').trim();

      if (isIncome) {
        if (sec.includes('房屋') || cat.includes('租金')) {
          houseIncome += amt;
        } else {
          totalRevenue += amt;
          if (cat.includes('現金') || cat.includes('收入')) revCash += amt;
          else if (cat.includes('吳') || cat.includes('Uber')) revUber += amt;
          else if (cat.includes('Line') || cat.includes('LINE')) revLinePay += amt;
          else revOther += amt;
        }
      } else {
        // 支出
        if (sec === '銷售成本') {
          foodCost += amt;
          foodItems[cat] = (foodItems[cat] || 0) + amt;
        } else if (sec === '營業支出') {
          opExpense += amt;
        } else if (sec === '房屋' || cat.includes('房貸') || cat.includes('116') || cat.includes('118') || cat.includes('潭子')) {
          mortgageExpense += amt;
        } else {
          // 生活支出與其他
          lifeExpense += amt;
        }
      }
    });

    // 核心指標
    const grossProfit = totalRevenue - foodCost;
    const foodCostRate = totalRevenue > 0 ? ((foodCost / totalRevenue) * 100).toFixed(1) : '0.0';
    const grossMarginRate = totalRevenue > 0 ? ((grossProfit / totalRevenue) * 100).toFixed(1) : '0.0';
    const operatingProfit = grossProfit - opExpense; // 麵店本業營業淨利
    const opProfitRate = totalRevenue > 0 ? ((operatingProfit / totalRevenue) * 100).toFixed(1) : '0.0';

    // 家庭與個人實質淨現金流
    const netCashFlow = operatingProfit + houseIncome - mortgageExpense - lifeExpense;

    // 食材成本率燈號評級 (餐飲標準: 30%~38% 最佳)
    let foodCostBadge = 'good';
    let foodCostText = '良好 (正常)';
    if (Number(foodCostRate) > 42) {
      foodCostBadge = 'warning';
      foodCostText = '偏高 (需注意食材成本)';
    } else if (Number(foodCostRate) === 0) {
      foodCostText = '無數據';
    }

    // 前 5 大食材進貨排行
    const topFoods = Object.entries(foodItems)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    let topFoodsHtml = '';
    if (topFoods.length > 0) {
      topFoodsHtml = topFoods.map(([name, val], idx) => `
        <div class="pnl-item-row">
          <span>${idx + 1}. ${name}</span>
          <span style="font-weight:600;">$${val.toLocaleString()}</span>
        </div>
      `).join('');
    } else {
      topFoodsHtml = '<div style="color:#8e8e93; font-size:12px; padding:4px 0;">本月尚無食材成本記錄</div>';
    }

    this.pnlModalContent.innerHTML = `
      <!-- 四大核心 KPI 儀表板 -->
      <div class="pnl-kpi-grid">
        <div class="pnl-kpi-card">
          <div class="pnl-kpi-label">
            <span>💰 本月總營收</span>
          </div>
          <div class="pnl-kpi-val" style="color:#34c759;">$${totalRevenue.toLocaleString()}</div>
          <div class="pnl-kpi-sub green">營業額加總</div>
        </div>

        <div class="pnl-kpi-card">
          <div class="pnl-kpi-label">
            <span>🥩 食材成本率</span>
            <span class="pnl-badge-health ${foodCostBadge}">${foodCostRate}%</span>
          </div>
          <div class="pnl-kpi-val" style="color:#ff9500;">$${foodCost.toLocaleString()}</div>
          <div class="pnl-kpi-sub orange">${foodCostText}</div>
        </div>

        <div class="pnl-kpi-card">
          <div class="pnl-kpi-label">
            <span>📈 營業毛利率</span>
            <span class="pnl-badge-health good">${grossMarginRate}%</span>
          </div>
          <div class="pnl-kpi-val" style="color:#0a84ff;">$${grossProfit.toLocaleString()}</div>
          <div class="pnl-kpi-sub blue">毛利 (營收 - 食材)</div>
        </div>

        <div class="pnl-kpi-card">
          <div class="pnl-kpi-label">
            <span>🏬 麵店營業淨利</span>
            <span class="pnl-badge-health good">${opProfitRate}%</span>
          </div>
          <div class="pnl-kpi-val" style="color:${operatingProfit >= 0 ? '#34c759' : '#ff3b30'};">
            $${operatingProfit.toLocaleString()}
          </div>
          <div class="pnl-kpi-sub ${operatingProfit >= 0 ? 'green' : 'orange'}">本業純利潤</div>
        </div>
      </div>

      <!-- 第一層：麵店本業營業損益 -->
      <div class="pnl-section-card">
        <div class="pnl-section-title">
          <span>🍜【第一層：麵店本業營業損益】</span>
          <span style="font-size:12px; color:#8e8e93;">看店面實質賺多少</span>
        </div>
        <div class="pnl-item-row">
          <span>＋ 營業收入 (店內/外送)</span>
          <span style="color:#34c759; font-weight:600;">+$${totalRevenue.toLocaleString()}</span>
        </div>
        <div class="pnl-item-row">
          <span>－ 銷售成本 (食材進貨)</span>
          <span style="color:#ff9500; font-weight:600;">-$${foodCost.toLocaleString()}</span>
        </div>
        <div class="pnl-item-row" style="background:rgba(255,255,255,0.02); padding:6px 8px; border-radius:6px;">
          <span>＝ 營業毛利</span>
          <span style="font-weight:700; color:#fff;">$${grossProfit.toLocaleString()}</span>
        </div>
        <div class="pnl-item-row">
          <span>－ 營業費用 (瓦斯/房租/水電/雜支)</span>
          <span style="color:#ff9500; font-weight:600;">-$${opExpense.toLocaleString()}</span>
        </div>
        <div class="pnl-item-row bold">
          <span>👉 麵店本月營業淨利</span>
          <span style="color:${operatingProfit >= 0 ? '#34c759' : '#ff3b30'}; font-size:16px;">
            $${operatingProfit.toLocaleString()}
          </span>
        </div>
      </div>

      <!-- 第二層：公私帳分流 (家庭收支與房貸) -->
      <div class="pnl-section-card">
        <div class="pnl-section-title">
          <span>🏠【第二層：家庭收支與總現金流】</span>
          <span style="font-size:12px; color:#8e8e93;">公私帳分流結算</span>
        </div>
        <div class="pnl-item-row">
          <span>＋ 麵店本業淨利</span>
          <span style="font-weight:600;">$${operatingProfit.toLocaleString()}</span>
        </div>
        <div class="pnl-item-row">
          <span>＋ 房屋租金收入</span>
          <span style="color:#34c759; font-weight:600;">+$${houseIncome.toLocaleString()}</span>
        </div>
        <div class="pnl-item-row">
          <span>－ 房貸支出 (116/118/潭子)</span>
          <span style="color:#ff9500; font-weight:600;">-$${mortgageExpense.toLocaleString()}</span>
        </div>
        <div class="pnl-item-row">
          <span>－ 個人家庭生活支出 (飲食/貓/車/旅)</span>
          <span style="color:#ff9500; font-weight:600;">-$${lifeExpense.toLocaleString()}</span>
        </div>
        <div class="pnl-item-row bold">
          <span>💰 全家實質淨存現金流</span>
          <span style="color:${netCashFlow >= 0 ? '#30d158' : '#ff9500'}; font-size:16px;">
            $${netCashFlow.toLocaleString()}
          </span>
        </div>
      </div>

      <!-- 食材成本前 5 大進貨項目 -->
      <div class="pnl-section-card">
        <div class="pnl-section-title">
          <span>🥩 本月食材成本排行 (Top 5)</span>
          <span style="font-size:12px; color:#8e8e93;">佔比最多</span>
        </div>
        ${topFoodsHtml}
      </div>

      <!-- 同步按鈕 -->
      <div style="margin-top:16px; margin-bottom:8px;">
        <button type="button" class="submit-btn" style="background:#0a84ff; font-weight:600;" onclick="app.syncCurrentMonthPnL()">
          📈 將本月數字同步寫入「損益表」Google Sheet
        </button>
      </div>
    `;
  }

  // 從 Google Sheet 後端同步指定月份的資料 (打開網頁只讀取當月，換月才讀取該月)
  async syncFromBackend(year = this.currentYear, month = this.currentMonth) {
    const res = await api.getEntries(year, month);
    if (res && res.success && Array.isArray(res.entries)) {
      const monthPrefix = `${year}-${String(month).padStart(2, '0')}`;
      console.log(`從 Google Sheet 同步 ${year}年${month}月 資料:`, res.entries.length, '筆');
      
      // 保留其他月份的既有資料，僅替換該月份的最新記錄
      this.entries = this.entries.filter(e => !(e.date && e.date.startsWith(monthPrefix)));
      this.entries.push(...res.entries);
      
      this.saveLocalEntries();
      this.render();
      this.showToast(`☁️ 已同步 ${year}年${month}月 (${res.entries.length} 筆)`);
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
