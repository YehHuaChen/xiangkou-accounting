// API 模組：與 Google Apps Script (GAS) 進行通訊
const DEFAULT_GAS_URL = 'https://script.google.com/macros/s/AKfycbxS8cTM0kOmzwqvIXqF6a5vMnnVGht3Xy-0IRebsJi5kdnKsbpEVQdvzOQbGXEV7YAzeQ/exec';

class ApiService {
  constructor() {
    const saved = localStorage.getItem('xiangkou_gas_url');
    // 如果快取是舊的失效網址，強制更新
    if (!saved || saved.indexOf('AKfycby6') !== -1) {
      this.apiUrl = DEFAULT_GAS_URL;
      localStorage.setItem('xiangkou_gas_url', DEFAULT_GAS_URL);
    } else {
      this.apiUrl = saved;
    }
  }

  setApiUrl(url) {
    this.apiUrl = url.trim();
    localStorage.setItem('xiangkou_gas_url', this.apiUrl);
  }

  getApiUrl() {
    return this.apiUrl;
  }

  // 取得某年月的記帳紀錄 (不帶參數則拉取全體記錄)
  async getEntries(year, month) {
    if (!this.apiUrl) {
      return { success: false, entries: [] };
    }

    try {
      let url = `${this.apiUrl}?action=getEntries&_t=${Date.now()}`;
      if (year && month) {
        url += `&year=${year}&month=${month}`;
      }
      const res = await fetch(url);
      const data = await res.json();
      return data;
    } catch (err) {
      console.warn('API 取得失敗，使用本地資料:', err);
      return { success: false, error: err.message };
    }
  }

  // 新增記帳紀錄
  async addEntry(payload) {
    if (!this.apiUrl) {
      return { success: false, message: '尚未設定 API 網址' };
    }

    try {
      // 使用 text/plain 避免跨域 OPTIONS preflight
      const res = await fetch(this.apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'addEntry',
          payload: payload
        })
      });
      const data = await res.json();
      return data;
    } catch (err) {
      console.error('API 寫入失敗:', err);
      // 嘗試以 GET 模式發送做為備援（適用於某些網路環境）
      try {
        const getUrl = `${this.apiUrl}?action=addEntryGet&payload=${encodeURIComponent(JSON.stringify(payload))}`;
        const res2 = await fetch(getUrl);
        return await res2.json();
      } catch (err2) {
        return { success: false, message: '連線失敗: ' + err.message };
      }
    }
  }

  // 刪除記帳紀錄
  async deleteEntry(rowId) {
    try {
      const res = await fetch(this.apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'deleteEntry',
          rowId: rowId
        })
      });
      return await res.json();
    } catch (err) {
      return { success: false, message: err.message };
    }
  }

  // 取得代墊未還款清單
  async getUnreimbursed() {
    try {
      const url = `${this.apiUrl}?action=getUnreimbursed&_t=${Date.now()}`;
      const res = await fetch(url);
      return await res.json();
    } catch (err) {
      return { success: false, items: [] };
    }
  }

  // 標記已還款
  async markReimbursed(personName) {
    try {
      const res = await fetch(this.apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'markReimbursed',
          personName: personName
        })
      });
  // 同步指定月份至損益表
  async syncPnL(year, month) {
    try {
      const res = await fetch(this.apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'syncPnL',
          year: year,
          month: month
        })
      });
      return await res.json();
    } catch (err) {
      try {
        const getUrl = `${this.apiUrl}?action=syncPnL&year=${year}&month=${month}`;
        const res2 = await fetch(getUrl);
        return await res2.json();
      } catch (err2) {
        return { success: false, message: '連線失敗: ' + err2.message };
      }
    }
  }
}

const api = new ApiService();
