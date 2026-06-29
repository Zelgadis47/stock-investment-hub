/* ===== app.js - 共享工具与全局逻辑 ===== */

// ===== 密码保护 =====
(function() {
  // 密码的 SHA-256 哈希值。修改密码：在控制台执行 sha256('你的新密码') 得到哈希值替换这里
  const PASSWORD_HASH = 'efab9fdc944a9ad8f7a8749878fee6e3d50c1fb2c267df164a551bc1327f326f';
  const SALT = 'stock-hub-2026';
  const AUTH_KEY = 'stockHub_auth';
  const AUTH_EXPIRY = 30 * 24 * 3600 * 1000; // 30 天

  // SHA-256 实现（纯 JS，无需外部库）
  function sha256(str) {
    function rotr(x, n) { return (x >>> n) | (x << (32 - n)); }
    function ch(x, y, z) { return (x & y) ^ (~x & z); }
    function maj(x, y, z) { return (x & y) ^ (x & z) ^ (y & z); }
    function sigma0(x) { return rotr(x, 2) ^ rotr(x, 13) ^ rotr(x, 22); }
    function sigma1(x) { return rotr(x, 6) ^ rotr(x, 11) ^ rotr(x, 25); }
    function gamma0(x) { return rotr(x, 7) ^ rotr(x, 18) ^ (x >>> 3); }
    function gamma1(x) { return rotr(x, 17) ^ rotr(x, 19) ^ (x >>> 10); }
    const K = [0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
      0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
      0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
      0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
      0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
      0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
      0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
      0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
    const bytes = new TextEncoder().encode(str);
    const bitLen = bytes.length * 8;
    const padded = new Uint8Array(Math.ceil((bytes.length + 9) / 64) * 64);
    padded.set(bytes);
    padded[bytes.length] = 0x80;
    const dv = new DataView(padded.buffer);
    dv.setUint32(padded.length - 4, bitLen, false);
    let H = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
    for (let i = 0; i < padded.length; i += 64) {
      const W = new Uint32Array(64);
      for (let j = 0; j < 16; j++) W[j] = dv.getUint32(i + j * 4, false);
      for (let j = 16; j < 64; j++) W[j] = (gamma1(W[j-2]) + W[j-7] + gamma0(W[j-15]) + W[j-16]) >>> 0;
      let [a,b,c,d,e,f,g,h] = H;
      for (let j = 0; j < 64; j++) {
        const T1 = (h + sigma1(e) + ch(e,f,g) + K[j] + W[j]) >>> 0;
        const T2 = (sigma0(a) + maj(a,b,c)) >>> 0;
        h = g; g = f; f = e; e = (d + T1) >>> 0; d = c; c = b; b = a; a = (T1 + T2) >>> 0;
      }
      H = H.map((v, j) => (v + [a,b,c,d,e,f,g,h][j]) >>> 0);
    }
    return H.map(v => v.toString(16).padStart(8, '0')).join('');
  }

  // 生成 auth token
  function createToken() {
    return sha256(Date.now().toString() + Math.random().toString(36) + SALT);
  }

  // 验证 token
  function isValidToken() {
    try {
      const data = JSON.parse(localStorage.getItem(AUTH_KEY));
      if (data && data.expiry > Date.now()) return true;
    } catch(e) {}
    return false;
  }

  // 保存 token
  function saveToken() {
    localStorage.setItem(AUTH_KEY, JSON.stringify({
      token: createToken(),
      expiry: Date.now() + AUTH_EXPIRY,
    }));
  }

  // 检查是否需要登录
  if (isValidToken()) {
    window._authDone = true;
  } else {
    // 显示登录界面
    window._authDone = false;
    document.addEventListener('DOMContentLoaded', function() {
      // 隐藏内容区域
      document.body.style.overflow = 'hidden';

      const overlay = document.createElement('div');
      overlay.id = 'loginOverlay';
      overlay.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:center;min-height:100vh;background:var(--primary);">
          <div style="background:var(--card-bg);padding:40px;border-radius:var(--radius);text-align:center;max-width:380px;width:90%;box-shadow:0 8px 40px rgba(0,0,0,0.3);">
            <div style="font-size:2.5rem;margin-bottom:8px;">🔐</div>
            <h2 style="margin-bottom:4px;color:var(--primary);">我的投资智库</h2>
            <p style="font-size:0.85rem;color:var(--text-light);margin-bottom:24px;">请输入密码访问</p>
            <input type="password" id="loginPwd" placeholder="输入密码" style="width:100%;padding:10px 14px;border:1px solid var(--border);border-radius:var(--radius-sm);font-size:1rem;text-align:center;margin-bottom:6px;" onkeydown="if(event.key==='Enter')doLogin()">
            <div id="loginError" style="color:var(--danger);font-size:0.82rem;height:20px;margin-bottom:8px;"></div>
            <button onclick="doLogin()" style="width:100%;padding:10px;background:var(--accent);color:#fff;border:none;border-radius:var(--radius-sm);font-size:1rem;font-weight:500;cursor:pointer;">登 录</button>
          </div>
        </div>
      `;
      overlay.style.cssText = 'position:fixed;inset:0;z-index:10000;';
      document.body.appendChild(overlay);

      setTimeout(() => document.getElementById('loginPwd')?.focus(), 200);
    });
  }

  // 登录函数
  window.doLogin = function() {
    const pwd = document.getElementById('loginPwd').value;
    const hash = sha256(pwd + SALT);
    const errEl = document.getElementById('loginError');

    if (hash === PASSWORD_HASH) {
      saveToken();
      const overlay = document.getElementById('loginOverlay');
      if (overlay) overlay.remove();
      document.body.style.overflow = '';
      window._authDone = true;
      // 触发页面重新初始化
      if (window.SyncUI) SyncUI.init();
      location.reload();
    } else {
      errEl.textContent = '密码错误，请重试';
      document.getElementById('loginPwd').value = '';
      document.getElementById('loginPwd').focus();
    }
  };
})();

// ---- 数据存储工具 ----
const DB = {
  _prefix: 'stockHub_',

  get(key) {
    try { return JSON.parse(localStorage.getItem(this._prefix + key)); }
    catch { return null; }
  },

  set(key, data) {
    localStorage.setItem(this._prefix + key, JSON.stringify(data));
  },

  // 知识文章
  getArticles() { return this.get('articles') || []; },
  setArticles(arr) { this.set('articles', arr); },
  addArticle(article) {
    const list = this.getArticles();
    article.id = Date.now() + '_' + Math.random().toString(36).slice(2, 6);
    article.createdAt = new Date().toISOString();
    article.updatedAt = article.createdAt;
    list.unshift(article);
    this.setArticles(list);
    return article;
  },
  updateArticle(id, data) {
    const list = this.getArticles();
    const idx = list.findIndex(a => a.id === id);
    if (idx < 0) return null;
    Object.assign(list[idx], data, { updatedAt: new Date().toISOString() });
    this.setArticles(list);
    return list[idx];
  },
  deleteArticle(id) {
    let list = this.getArticles();
    list = list.filter(a => a.id !== id);
    this.setArticles(list);
  },

  // 策略
  getStrategies() { return this.get('strategies') || []; },
  setStrategies(arr) { this.set('strategies', arr); },
  addStrategy(s) {
    const list = this.getStrategies();
    s.id = Date.now() + '_' + Math.random().toString(36).slice(2, 6);
    s.createdAt = new Date().toISOString();
    list.unshift(s);
    this.setStrategies(list);
    return s;
  },
  updateStrategy(id, data) {
    const list = this.getStrategies();
    const idx = list.findIndex(st => st.id === id);
    if (idx < 0) return null;
    Object.assign(list[idx], data);
    this.setStrategies(list);
    return list[idx];
  },
  deleteStrategy(id) {
    let list = this.getStrategies();
    list = list.filter(st => st.id !== id);
    this.setStrategies(list);
  },

  // 交易记录
  getTrades() { return this.get('trades') || []; },
  setTrades(arr) { this.set('trades', arr); },
  addTrade(t) {
    const list = this.getTrades();
    t.id = Date.now() + '_' + Math.random().toString(36).slice(2, 6);
    t.createdAt = new Date().toISOString();
    t.profit = this._calcProfit(t);
    list.unshift(t);
    this.setTrades(list);
    return t;
  },
  updateTrade(id, data) {
    const list = this.getTrades();
    const idx = list.findIndex(t => t.id === id);
    if (idx < 0) return null;
    Object.assign(list[idx], data);
    if (data.buyPrice !== undefined || data.sellPrice !== undefined || data.shares !== undefined) {
      list[idx].profit = this._calcProfit(list[idx]);
    }
    this.setTrades(list);
    return list[idx];
  },
  deleteTrade(id) {
    let list = this.getTrades();
    list = list.filter(t => t.id !== id);
    this.setTrades(list);
  },
  _calcProfit(t) {
    if (!t.sellPrice || !t.buyPrice || !t.shares) return 0;
    return (parseFloat(t.sellPrice) - parseFloat(t.buyPrice)) * parseInt(t.shares || 1);
  },

  // ===== GitHub Gist 云同步功能 =====
  // 无需部署服务器，直接通过 GitHub API 读/写 Gist 实现跨设备同步
  // 架构：浏览器 → api.github.com → Gist

  GIST_ID: '1ce2c3043ea83285fe61630145d14bb7',
  syncEnabled: false,
  syncToken: '',
  _syncTimer: null,

  enableSync(token) {
    this.syncEnabled = true;
    this.syncToken = token;
    localStorage.setItem(this._prefix + 'gistToken', token);
    this._syncAfterWrite();
  },

  disableSync() {
    this.syncEnabled = false;
    this.syncToken = '';
    localStorage.removeItem(this._prefix + 'gistToken');
  },

  isSyncEnabled() {
    return this.syncEnabled;
  },

  // 从 Gist 加载云端数据
  async loadFromGist() {
    const token = localStorage.getItem(this._prefix + 'gistToken');
    if (!token) return false;

    this.syncToken = token;
    this.syncEnabled = true;

    try {
      const resp = await fetch(`https://api.github.com/gists/${this.GIST_ID}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
        }
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const gist = await resp.json();
      const file = gist.files?.['stock-hub-data.json'];
      if (file && file.content) {
        const d = JSON.parse(file.content);
        const hasData = (d.articles && d.articles.length > 0)
                      || (d.strategies && d.strategies.length > 0)
                      || (d.trades && d.trades.length > 0)
                      || (d.snapshots && d.snapshots.length > 0)
                      || (d.watchlist && d.watchlist.length > 0)
                      || (d.alerts && d.alerts.length > 0)
                      || (d.diaries && d.diaries.length > 0)
                      || (d.news && d.news.length > 0)
                      || (d.reports && d.reports.length > 0);
        if (hasData) {
          if (d.articles) {
            d.articles.forEach(a => { a.updatedAt = a.updatedAt || a.createdAt; });
            this.setArticles(d.articles);
          }
          if (d.strategies) this.setStrategies(d.strategies);
          if (d.trades) {
            d.trades.forEach(t => {
              t.profit = this._calcProfit(t);
              if (!t.tags) t.tags = [];
              if (t.rating === undefined) t.rating = 0;
              if (!t.strategy) t.strategy = '';
            });
            this.setTrades(d.trades);
          }
          if (d.snapshots) this.setSnapshots(d.snapshots);
          if (d.watchlist) this.setWatchlist(d.watchlist);
          if (d.alerts) this.setAlerts(d.alerts);
          if (d.diaries) this.setDiaries(d.diaries);
          if (d.news) this.setNews(d.news);
          if (d.reports) this.setReports(d.reports);
          return true;
        }
        this._syncAfterWrite();
      }
    } catch (e) {
      console.log('GitHub Gist 连接失败:', e.message, '使用本地数据');
    }
    return false;
  },

  // 数据变更后自动推送到 Gist
  _syncAfterWrite() {
    if (!this.syncEnabled || !this.syncToken) return;
    clearTimeout(this._syncTimer);
    this._syncTimer = setTimeout(async () => {
      try {
        const data = {
          version: 2,
          lastSyncAt: new Date().toISOString(),
          articles: this.getArticles(),
          strategies: this.getStrategies(),
          trades: this.getTrades(),
          snapshots: this.getSnapshots(),
          watchlist: this.getWatchlist(),
          alerts: this.getAlerts(),
          diaries: this.getDiaries(),
          news: this.getNews(),
          reports: this.getReports(),
        };
        const resp = await fetch(`https://api.github.com/gists/${this.GIST_ID}`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${this.syncToken}`,
            'Content-Type': 'application/json',
            Accept: 'application/vnd.github+json',
          },
          body: JSON.stringify({
            files: { 'stock-hub-data.json': { content: JSON.stringify(data) } }
          }),
        });
        if (resp.ok && window.SyncUI) {
          SyncUI.updateStatus('connected');
        } else if (window.SyncUI) {
          SyncUI.updateStatus('error');
        }
      } catch (e) {
        if (window.SyncUI) SyncUI.updateStatus('error');
      }
    }, 500);
  },

  // ===== 持仓快照 =====
  getSnapshots() { return this.get('snapshots') || []; },
  setSnapshots(arr) { this.set('snapshots', arr); },
  addSnapshot(s) {
    const list = this.getSnapshots();
    s.id = Date.now() + '_' + Math.random().toString(36).slice(2, 6);
    s.createdAt = new Date().toISOString();
    // 同日覆盖：删除同 date 的旧快照
    const filtered = list.filter(x => x.date !== s.date);
    filtered.unshift(s);
    filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
    this.setSnapshots(filtered);
    return s;
  },
  deleteSnapshot(id) {
    this.setSnapshots(this.getSnapshots().filter(s => s.id !== id));
  },
  getLatestSnapshot() {
    const list = this.getSnapshots();
    return list.length > 0 ? list[0] : null;
  },

  // ===== 自选股 =====
  getWatchlist() { return this.get('watchlist') || []; },
  setWatchlist(arr) { this.set('watchlist', arr); },
  addWatch(w) {
    const list = this.getWatchlist();
    w.id = Date.now() + '_' + Math.random().toString(36).slice(2, 6);
    w.createdAt = new Date().toISOString();
    list.unshift(w);
    this.setWatchlist(list);
    return w;
  },
  updateWatch(id, data) {
    const list = this.getWatchlist();
    const idx = list.findIndex(w => w.id === id);
    if (idx < 0) return null;
    Object.assign(list[idx], data);
    this.setWatchlist(list);
    return list[idx];
  },
  deleteWatch(id) {
    this.setWatchlist(this.getWatchlist().filter(w => w.id !== id));
  },

  // ===== 提醒 =====
  getAlerts() { return this.get('alerts') || []; },
  setAlerts(arr) { this.set('alerts', arr); },
  addAlert(a) {
    const list = this.getAlerts();
    a.id = Date.now() + '_' + Math.random().toString(36).slice(2, 6);
    a.createdAt = new Date().toISOString();
    a.triggered = false;
    a.triggeredAt = '';
    list.unshift(a);
    this.setAlerts(list);
    return a;
  },
  updateAlert(id, data) {
    const list = this.getAlerts();
    const idx = list.findIndex(a => a.id === id);
    if (idx < 0) return null;
    Object.assign(list[idx], data);
    this.setAlerts(list);
    return list[idx];
  },
  deleteAlert(id) {
    this.setAlerts(this.getAlerts().filter(a => a.id !== id));
  },

  // ===== 投资日记 =====
  getDiaries() { return this.get('diaries') || []; },
  setDiaries(arr) { this.set('diaries', arr); },
  addDiary(d) {
    const list = this.getDiaries();
    d.id = Date.now() + '_' + Math.random().toString(36).slice(2, 6);
    d.createdAt = new Date().toISOString();
    // 同日覆盖
    const filtered = list.filter(x => x.date !== d.date);
    filtered.unshift(d);
    filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
    this.setDiaries(filtered);
    return d;
  },
  updateDiary(id, data) {
    const list = this.getDiaries();
    const idx = list.findIndex(d => d.id === id);
    if (idx < 0) return null;
    Object.assign(list[idx], data);
    this.setDiaries(list);
    return list[idx];
  },
  deleteDiary(id) {
    this.setDiaries(this.getDiaries().filter(d => d.id !== id));
  },

  // ===== 资讯收藏 =====
  getNews() { return this.get('news') || []; },
  setNews(arr) { this.set('news', arr); },
  addNews(n) {
    const list = this.getNews();
    n.id = Date.now() + '_' + Math.random().toString(36).slice(2, 6);
    n.collectedAt = new Date().toISOString();
    n.read = false;
    list.unshift(n);
    this.setNews(list);
    return n;
  },
  updateNews(id, data) {
    const list = this.getNews();
    const idx = list.findIndex(n => n.id === id);
    if (idx < 0) return null;
    Object.assign(list[idx], data);
    this.setNews(list);
    return list[idx];
  },
  deleteNews(id) {
    this.setNews(this.getNews().filter(n => n.id !== id));
  },

  // ===== 研报 =====
  getReports() { return this.get('reports') || []; },
  setReports(arr) { this.set('reports', arr); },
  addReport(r) {
    const list = this.getReports();
    r.id = Date.now() + '_' + Math.random().toString(36).slice(2, 6);
    r.collectedAt = new Date().toISOString();
    list.unshift(r);
    this.setReports(list);
    return r;
  },
  updateReport(id, data) {
    const list = this.getReports();
    const idx = list.findIndex(r => r.id === id);
    if (idx < 0) return null;
    Object.assign(list[idx], data);
    this.setReports(list);
    return list[idx];
  },
  deleteReport(id) {
    this.setReports(this.getReports().filter(r => r.id !== id));
  },

  // 统计数据
  getStats() {
    const articles = this.getArticles();
    const strategies = this.getStrategies();
    const trades = this.getTrades();
    const watchlist = this.getWatchlist();
    const alerts = this.getAlerts();
    const snapshots = this.getSnapshots();
    // 关注股票数（从交易记录和自选股中提取唯一股票）
    const stockSet = new Set();
    trades.forEach(t => { if (t.stockName) stockSet.add(t.stockName); });
    watchlist.forEach(w => { if (w.stockName) stockSet.add(w.stockName); });
    return {
      articleCount: articles.length,
      strategyCount: strategies.length,
      tradeCount: trades.length,
      stockCount: stockSet.size,
      watchlistCount: watchlist.length,
      alertCount: alerts.filter(a => !a.triggered).length,
      snapshotCount: snapshots.length,
      recentUpdates: [
        ...articles.map(a => ({ type: 'article', title: a.title, time: a.updatedAt, category: a.category })),
        ...strategies.map(s => ({ type: 'strategy', title: s.name, time: s.createdAt })),
      ].sort((a, b) => new Date(b.time) - new Date(a.time)).slice(0, 5),
    };
  },

  // 初始化示例数据
  initSampleData() {
    if (this.getArticles().length > 0) return; // 已有数据则不初始化

    // ===== 知识文章（15篇） =====

    // 基本面分析（4篇）
    this.addArticle({
      title: '市盈率（PE）详解：如何判断估值高低',
      category: '基本面分析',
      content: `<h3>什么是市盈率？</h3><p>市盈率（Price-to-Earnings Ratio，简称PE）是衡量股票估值最常用的指标之一，反映了市场愿意为公司每一元盈利支付多少价格。</p><p>计算公式：<b>市盈率 = 当前股价 / 每股收益（EPS）</b></p>
<h4>三种类型的市盈率</h4><ul><li><b>静态市盈率（PE-LYR）</b>：使用上一年度已公布的每股收益。优点是数据确凿，缺点是滞后。</li><li><b>滚动市盈率（PE-TTM）</b>：使用最近四个季度的每股收益总和。优点是数据较新，最常用。</li><li><b>动态市盈率</b>：使用分析师预测的未来每股收益。优点是前瞻性强，缺点是预测可能不准。</li></ul>
<h4>PE的合理范围</h4><ul><li>成熟行业龙头（银行、钢铁）：8-15倍常见</li><li>消费稳健增长（食品饮料、医药）：20-40倍</li><li>科技高成长（半导体、AI）：30-60倍甚至更高</li><li>强周期行业（有色、化工）：盈利波动大，PE会剧烈变化</li></ul>
<h4>使用PE的注意事项</h4><ul><li>亏损企业 PE 无意义（为负值）</li><li>永远在同行业内比较，跨行业比较会误判</li><li>低PE不一定是低估——可能是市场对其未来看衰</li><li>建议结合 PB、ROE、盈利增速综合判断</li></ul>`,
    });
    this.addArticle({
      title: 'ROE与杜邦分析：读懂公司的赚钱能力',
      category: '基本面分析',
      content: `<h3>ROE — 最核心的盈利指标</h3><p>ROE（Return on Equity，净资产收益率）衡量公司利用股东投入的每一元钱创造了多少利润。</p><p>公式：<b>ROE = 净利润 / 净资产</b></p>
<h4>ROE 的分级标准</h4><ul><li><b>ROE > 20%</b>：优秀，具备持续竞争优势（如茅台、海天）</li><li><b>ROE 15%-20%</b>：良好，值得关注</li><li><b>ROE 10%-15%</b>：一般，需要看趋势</li><li><b>ROE < 10%</b>：偏低，投资价值有限</li></ul>
<h4>杜邦分析拆解 ROE</h4><p>ROE 可拆分为三部分，帮助理解其来源：</p><ul><li><b>净利率</b>（净利润/营收）：公司每卖出一元产品赚多少。越高越好。</li><li><b>总资产周转率</b>（营收/总资产）：公司资产运营效率。</li><li><b>权益乘数</b>（总资产/净资产）：杠杆倍数。高杠杆推高ROE，但风险也大。</li></ul>
<h4>关键法则</h4><p>真正优秀的ROE是"高净利率驱动"而非"高杠杆驱动"。如果一家公司ROE很高但靠大量借钱（高权益乘数），需要警惕风险。</p>`,
    });
    this.addArticle({
      title: '如何快速解读公司年报',
      category: '基本面分析',
      content: `<h3>年报快速阅读五步法</h3>
<h4>第一步：看审计意见（2分钟）</h4><p>翻到开头的审计报告。如果出现"保留意见"、"无法表示意见"、"否定意见"，直接放弃。只有"<b>标准无保留意见</b>"才有继续分析的价值。</p>
<h4>第二步：看利润表趋势（5分钟）</h4><p>找到"主要会计数据"表格，快速浏览最近3-5年的：</p><ul><li>营业总收入：是否持续增长？年复合增速多少？</li><li>归母净利润：是否同方向增长？有没有大幅波动？</li><li>扣非净利润：与归母净利润差距大吗？（差距大说明有一次性收益）</li></ul>
<h4>第三步：看资产负债表结构（8分钟）</h4><ul><li><b>资产负债率</b>：超过60%需要谨慎，超过80%风险很高</li><li><b>应收账款/营收比</b>：过高说明回款困难，利润可能是"纸面利润"</li><li><b>存货周转</b>：存货激增可能意味着产品滞销</li><li><b>商誉</b>：商誉/净资产超过30%，警惕减值风险</li></ul>
<h4>第四步：看现金流（5分钟）</h4><ul><li><b>经营性现金流净额 > 净利润</b>：健康，利润是真金白银</li><li><b>经营性现金流为负</b>：危险信号，利润可能只是账面数字</li></ul>
<h4>第五步：看管理层讨论（10分钟）</h4><p>翻到"管理层讨论与分析"一节，读三个关键问题：管理层如何解释业绩？提到了哪些风险？未来的计划是什么？诚实的坦诚比华丽的承诺更重要。</p>`,
    });
    this.addArticle({
      title: '中联重科（000157）基本面深度分析',
      category: '基本面分析',
      content: `<h3>公司概况</h3><p>中联重科是中国工程机械行业双寡头之一（与三一重工并称），主营混凝土机械、起重机械、土方机械、高空作业机械等。成立于1992年，2000年深交所上市。</p>
<h4>核心竞争优势</h4><ul><li><b>行业地位</b>：长期稳居国内工程机械行业前三，混凝土机械和起重机械市场份额领先</li><li><b>产品多元化</b>：从传统工程机械拓展到高空作业平台、农业机械等新领域</li><li><b>国际化布局</b>：海外收入占比持续提升，尤其是"一带一路"沿线市场</li></ul>
<h4>关键风险</h4><ul><li><b>周期性强</b>：工程机械与基建投资、房地产开工高度相关，宏观经济下行时业绩波动大</li><li><b>竞争激烈</b>：三一重工、徐工机械等同业竞争激烈，价格战时有发生</li><li><b>应收账款风险</b>：行业回款周期长，需关注应收账款质量和坏账率</li></ul>
<h4>估值观察</h4><p>当前PE处于历史较低分位（约30%分位以下），PB也偏低。作为周期股，低估值往往出现在行业低谷期——此时买入需有足够的耐心和资金承受波动的能力。关注基建投资增速和地产开工数据，这是行业拐点的先行指标。</p>`,
    });

    // 技术分析（3篇）
    this.addArticle({
      title: 'K线图基础：从阴阳线到多空博弈',
      category: '技术分析',
      content: `<h3>K线图的构成</h3><p>每根K线包含四个关键价格信息：<b>开盘价、收盘价、最高价、最低价</b>。实体部分（开盘到收盘的区间）反映多空力量，影线部分（超出实体的区间）反映极端情绪。</p>
<ul><li><b>阳线（A股红色）</b>：收盘价高于开盘价，买方占优</li><li><b>阴线（A股绿色）</b>：收盘价低于开盘价，卖方占优</li></ul>
<h4>六大关键K线形态</h4><ul><li><b>长阳线</b>：实体占比超过70%，强烈看涨。若出现在震荡区间下沿，可能是反转信号。</li><li><b>长阴线</b>：实体占比超过70%，强烈看跌。高位出现尤需警惕。</li><li><b>锤子线</b>：下影线极长（2倍于实体以上）、实体较小。底部出现预示反转。</li><li><b>射击之星</b>：上影线极长、实体较小。顶部出现预示反转。</li><li><b>十字星</b>：开盘价≈收盘价，多空平衡。需要后续K线确认方向。</li><li><b>吞没形态</b>：后一根K线实体完全覆盖前一根。方向与前一根相反时信号最强。</li></ul>
<h4>实用技巧</h4><p>单根K线只是信号，需要结合以下因素判断：出现位置（高位/低位/盘整中）、成交量配合（放量的K线更可信）、均线系统是否支持。永远不要凭一根K线做决策。</p>`,
    });
    this.addArticle({
      title: 'MACD指标的实战应用技巧',
      category: '技术分析',
      content: `<h3>MACD基础结构</h3><p>MACD由三部分组成：</p><ul><li><b>DIF线（快线）</b>：12日EMA - 26日EMA，反映短期与长期价格趋势的差异</li><li><b>DEA线（慢线）</b>：DIF的9日移动平均，信号线</li><li><b>柱状图（BAR）</b>：DIF - DEA 的差值 × 2（某些软件 × 1），红柱表示多头，绿柱表示空头</li></ul>
<h4>核心交易信号</h4><ul><li><b>金叉</b>：DIF从下方向上穿越DEA。零轴上方金叉强于零轴下方金叉。</li><li><b>死叉</b>：DIF从上方向下穿越DEA。高位死叉信号更强。</li><li><b>顶背离</b>：股价创新高，但MACD峰值降低。多次背离信号增强，是重要减仓信号。</li><li><b>底背离</b>：股价创新低，但MACD低点抬高。出现在超跌后是抄底参考。</li></ul>
<h4>高级用法</h4><ul><li><b>零轴判断趋势</b>：DIF在零轴上方为多头市场，下方为空头市场。零轴附近的金叉/死叉意义较弱。</li><li><b>二次金叉</b>：DIF在零轴上方经历回调后再次金叉，可靠性高于首次金叉。</li><li><b>结合成交量</b>：MACD信号伴随放量更可靠。缩量金叉可能是假信号。</li></ul>`,
    });
    this.addArticle({
      title: '均线系统与趋势判断',
      category: '技术分析',
      content: `<h3>常用均线及用途</h3><ul><li><b>MA5（5日均线）</b>：超短线参考，反映一周交易情绪</li><li><b>MA10</b>：短线趋势参考</li><li><b>MA20</b>：中线参考，约一个月的交易区间。很多交易者视为关键生命线</li><li><b>MA60</b>：季度线，中期趋势判断</li><li><b>MA120（半年线）</b>：中长期趋势</li><li><b>MA250（年线）</b>：牛熊分界线</li></ul>
<h4>均线排列判断</h4><ul><li><b>多头排列</b>：短期均线在长期均线上方，且均线全部向上。典型上升趋势。</li><li><b>空头排列</b>：短期均线在长期均线下方，且均线全部向下。典型下降趋势。</li><li><b>缠绕</b>：各均线交错缠绕，方向不明确，处于震荡或盘整中。</li></ul>
<h4>实战要点</h4><ul><li>均线是<b>滞后指标</b>，不适合用于精确买卖点</li><li>均线支撑/压力的有效性取决于<b>触碰次数</b>：触碰越多越有效</li><li>股价与均线的<b>乖离率过大</b>时，有回归均线的需求</li><li>站上MA250（年线）且年线走平向上，是中长线买点的重要参考</li></ul>`,
    });

    // 行业研究（3篇）
    this.addArticle({
      title: '新能源汽车产业链全景分析',
      category: '行业研究',
      content: `<h3>产业链结构</h3><p>新能源汽车产业链从上到下可分为四个层次：</p>
<h4>上游：矿产资源</h4><ul><li><b>锂</b>：天齐锂业、赣锋锂业。锂价波动大，强周期属性。</li><li><b>钴、镍</b>：华友钴业。三元电池关键材料，关注去钴化趋势。</li><li><b>稀土</b>：北方稀土。电机核心材料。</li></ul>
<h4>中游：电池及零部件</h4><ul><li><b>动力电池</b>：宁德时代（全球龙头）、比亚迪（刀片电池）。关注技术路线之争（磷酸铁锂 vs 三元）。</li><li><b>隔膜、电解液</b>：恩捷股份、天赐材料。格局较稳定。</li></ul>
<h4>中下游：整车制造</h4><ul><li><b>比亚迪</b>：全产业链自研，垂直整合能力强</li><li><b>新势力</b>：蔚来、小鹏、理想，各有特色</li><li><b>传统车企转型</b>：吉利、长城，转型速度决定未来</li></ul>
<h4>下游：充电与后市场</h4><ul><li>充电桩：特锐德等。充电基础设施是行业发展瓶颈之一。</li></ul>
<h4>投资主线</h4><ul><li>短期看价格战谁能胜出；中期看智能化水平（自动驾驶）；长期看全球化能力。</li><li>整车环节竞争最为激烈，确定性较低。电池龙头和上游资源龙头确定性相对更高。</li></ul>`,
    });
    this.addArticle({
      title: '半导体行业投资框架',
      category: '行业研究',
      content: `<h3>半导体产业链分层</h3>
<h4>设计环节</h4><p>芯片设计公司（Fabless）：如海思、韦尔股份、兆易创新。轻资产模式，毛利率高但竞争激烈。核心竞争力在于研发能力和IP积累。</p>
<h4>制造环节</h4><p>晶圆代工（Foundry）：如台积电、中芯国际。重资产模式，资本开支巨大。先进制程是核心壁垒，追赶周期长达5-10年。</p>
<h4>封测环节</h4><p>封装测试：如长电科技、通富微电。国产化程度最高的一环，但毛利率偏低，技术壁垒相对较低。</p>
<h4>设备与材料</h4><p>半导体设备：北方华创、中微公司。国产替代的核心方向，技术壁垒极高，受益于国内建厂潮。</p>
<h4>投资逻辑</h4><ul><li><b>周期波动</b>：半导体行业3-4年一个周期。库存周期的底部往往是最佳买点。</li><li><b>国产替代</b>：在设备和材料领域确定性较高，由政策和需求双轮驱动。</li><li><b>AI芯片</b>：算力需求爆发是长期主线，关注GPU/FPGA/AI推理芯片方向。</li></ul>`,
    });
    this.addArticle({
      title: '白酒行业分析框架与估值逻辑',
      category: '行业研究',
      content: `<h3>行业特性</h3><p>白酒是中国资本市场最特殊的消费品行业：成瘾性、社交属性、品牌护城河深厚、几乎不需要研发投入、存货越放越值钱（年份酒价值上升）。</p>
<h4>竞争格局：金字塔结构</h4><ul><li><b>超高端</b>：茅台独占。批价远高于出厂价，巨大的渠道利润空间是估值的压舱石。</li><li><b>高端</b>：五粮液、泸州老窖。品牌力次之，需持续营销投入维护品牌。</li><li><b>次高端</b>：洋河、古井贡酒、山西汾酒。受益于消费升级，弹性最大但竞争最激烈。</li><li><b>中低端</b>：顺鑫农业等。受经济波动影响大，缺乏品牌溢价。</li></ul>
<h4>核心分析指标</h4><ul><li><b>批价</b>：市场实际成交价与出厂价的差距，差价越大说明品牌力越强</li><li><b>渠道库存</b>：经销商手里的存货天数，库存过高是危险信号</li><li><b>预收款（合同负债）</b>：经销商打款的积极性，前瞻指标</li></ul>
<h4>估值特点</h4><p>白酒企业通常享受20-40倍PE，头部企业更高。核心逻辑是：稳定增长 + 高分红 + 不需要大额资本开支 = 估值溢价。但经济下行期可能出现"戴维斯双杀"，需要区分是行业周期波动还是长期趋势逆转。</p>`,
    });

    // 交易心理与策略（3篇）
    this.addArticle({
      title: '如何构建属于你的交易系统',
      category: '交易心理',
      content: `<h3>交易系统的六个组件</h3><p>一个完整的交易系统不是某个神奇指标，而是一套从入场到离场的完整决策流程。它包含：</p>
<ol><li><b>选股规则</b>：什么样的股票值得关注？（市值范围、行业偏好、技术形态、基本面条件）</li><li><b>入场条件</b>：满足什么条件时买入？（比如：PE<行业均值且MACD金叉）</li><li><b>出场条件</b>：止盈和止损如何设定？（例如：盈利15%止盈一半，亏损8%无条件止损）</li><li><b>仓位规则</b>：每次投入多少资金？单只股票最多占多大比例？</li><li><b>风险控制</b>：总仓位上限是多少？什么情况需要减仓或清仓？</li><li><b>复盘规则</b>：多久复盘一次？用什么标准评估策略的表现？</li></ol>
<h4>系统检验的三道关卡</h4><ul><li><b>历史回测</b>：在历史上表现如何？（注意不要过度优化）</li><li><b>模拟交易</b>：用真实市场数据验证，至少3-6个月</li><li><b>小资金实盘</b>：用真实资金感受心理压力，逐步放大</li></ul>
<h4>常见陷阱</h4><ul><li>追求高胜率而忽视盈亏比——胜率60%但赚一笔100元、亏一笔200元，最终亏损</li><li>频繁修改系统——每笔亏损后马上改规则，系统永远无法稳定</li><li>情绪化交易——系统明确说卖，但"觉得还能涨"而持有</li></ul>`,
    });
    this.addArticle({
      title: '止损的艺术：保护你的本金',
      category: '交易心理',
      content: `<h3>为什么止损是交易中最重要的事</h3><p>本金损失50%，需要盈利100%才能回本。止损不是为了赚更多，而是为了<b>活下来</b>。</p>
<h4>五种止损方法</h4><ul><li><b>固定比例止损</b>：浮亏达X%时无条件离场。一般设定在5%-10%。简单但容易在市场噪音中被洗出。</li><li><b>技术位止损</b>：跌破关键支撑位时离场。比如跌破前低、跌破重要均线。</li><li><b>资金止损</b>：单笔交易最大亏损不超过总资金的Y%。比如总资金10万，单笔最多亏2000。</li><li><b>时间止损</b>：买入后N个交易日内未达预期目标则离场。避免资金被"套牢"。</li><li><b>移动止损</b>：随着股价上涨，逐步上移止损位。锁定利润的同时让利润奔跑。</li></ul>
<h4>执行止损的心理学</h4><ul><li><b>止损的痛苦</b>是真实的心理成本。市场不会因为你"觉得还能回去"就真的回去。</li><li><b>设置条件单</b>：在交易软件中预设止损价，减少情绪干扰。</li><li><b>把止损看作交易成本</b>：就像做生意有租金、有进货成本一样，止损是交易的必要成本。</li></ul>
<h4>不该止损的情况</h4><p>如果买入逻辑没有改变（公司基本面依然良好，行业趋势未逆转），仅仅因为市场整体下跌而止损，可能是最差的卖出时机。</p>`,
    });
    this.addArticle({
      title: '仓位管理与资金分配方法论',
      category: '交易心理',
      content: `<h3>仓位管理的核心原则</h3><p>仓位管理不是猜市场方向，而是在任何市场环境下都能控制最大回撤，确保活到盈利的那一天。</p>
<h4>基础仓位法</h4><ul><li><b>等分法</b>：资金平均分配给N只股票。简单，适合初学者。</li><li><b>凯利公式法</b>：仓位 = (胜率 × 盈亏比 - 败率) / 盈亏比。理论最优，但需要准确估计胜率和盈亏比。</li><li><b>固定风险法</b>：每笔交易风险固定（如总资金的2%）。根据止损距离倒推仓位大小。</li></ul>
<h4>金字塔加减仓</h4><ul><li><b>正金字塔买入</b>：底部仓位最大，越涨买越少。下跌时亏损小，上涨时盈利大。</li><li><b>倒金字塔卖入</b>：越跌越买。适合定投策略，但不适合趋势交易。</li><li><b>分批止盈</b>：到达第一目标卖30%，第二目标卖40%，保留30%看更高。</li></ul>
<h4>历史回测数据参考</h4><ul><li>单只股票仓位 > 30%：风险极高，一次黑天鹅可能致命</li><li>单行业仓位 > 50%：行业利空会对整体账户造成巨大冲击</li><li>保留10%-20%现金：应对极端行情的弹药</li></ul>`,
    });

    // 其他（2篇）
    this.addArticle({
      title: 'ETF投资完全指南',
      category: '其他',
      content: `<h3>什么是ETF？</h3><p>ETF（交易型开放式指数基金）是一篮子股票的组合，像股票一样在交易所买卖。它的优势是：分散风险、费用低廉、操作简便。</p>
<h4>主要ETF类型</h4><ul><li><b>宽基指数ETF</b>：沪深300ETF（510300）、中证500ETF（510500）、创业板ETF（159915）。跟踪整个市场，适合定投。</li><li><b>行业ETF</b>：半导体ETF、军工ETF、消费ETF。看好某个行业但又不想选个股时使用。</li><li><b>跨境ETF</b>：纳指ETF（513100）、恒生ETF（159920）。投资海外市场的便捷通道。</li><li><b>债券ETF</b>：国债ETF、可转债ETF。低风险配置选择。</li></ul>
<h4>ETF投资策略</h4><ul><li><b>定投</b>：每月固定时间固定金额买入。淡化择时，利用微笑曲线抄到底部。</li><li><b>网格交易</b>：设定价格区间，跌了买、涨了卖。ETF波动相对温和，天生适合网格。</li><li><b>资产配置</b>：A股ETF + 债券ETF + 跨境ETF 的组合，降低整体波动。</li></ul>
<h4>选ETF的技巧</h4><ul><li>选<b>规模大</b>的（>2亿），流动性好折溢价小</li><li>跟踪误差越小越好（<1%年化）</li><li>管理费越低越好（<0.5%年化）</li></ul>`,
    });
    this.addArticle({
      title: 'A股交易规则与费用全解',
      category: '其他',
      content: `<h3>交易时间</h3><ul><li><b>开盘集合竞价</b>：9:15-9:25（9:20前可撤单，之后不可）</li><li><b>连续竞价</b>：9:30-11:30、13:00-15:00</li><li><b>盘后固定价交易</b>：15:05-15:30（仅限部分品种）</li></ul>
<h4>T+1与涨跌停</h4><ul><li><b>T+1制度</b>：当天买入的股票，最早下一个交易日卖出。当天卖出股票后资金可用（但不可提现，需T+1）。</li><li><b>主板涨跌停</b>：±10%（ST股±5%）</li><li><b>创业板/科创板</b>：±20%</li><li><b>北交所</b>：±30%</li></ul>
<h4>交易费用</h4><ul><li><b>佣金</b>：万2.5-万3（各券商不同，最低5元）</li><li><b>印花税</b>：卖出时收取成交金额的0.05%，买入不交</li><li><b>过户费</b>：成交金额的0.001%（双向）</li></ul>
<h4>费用对短线交易的影响</h4><p>假设佣金万2.5，买入卖出一次总费用约万分之4。如果每次交易只赚0.3%，刨去费用只剩0.26%。高频短线交易的摩擦成本不可忽视。</p>`,
    });

    // ===== 财经数据（3篇：领先指标与板块联动） =====
    this.addArticle({
      title: 'A股领先指标全景图：先于股价发布的关键数据',
      category: '财经数据',
      content: `<h3>什么是领先指标？</h3><p>领先指标（Leading Indicators）是那些在宏观或行业基本面发生实质性变化之前就提前发出的信号。它们先于股价变动，是市场参与者的"天气预报"。</p>
<p>与"同步指标"（如季度财报，已经发生）不同，领先指标的发布时间更早、频率更高，可以在市场主流定价之前捕捉到方向性变化。</p>

<h4>一、宏观经济领先指标</h4>
<h4>1. PMI（采购经理人指数）</h4><ul>
<li><b>发布时间</b>：每月最后一天09:00发布当月数据</li>
<li><b>领先于</b>：工业增加值（约2周）、GDP（约2个月）</li>
<li><b>发布方</b>：国家统计局</li>
<li><b>影响板块</b>：全市场，尤其是周期股（钢铁、有色、机械、化工等）</li>
<li><b>临界值</b>：PMI > 50 说明制造业扩张，经济向好；< 50 说明收缩</li>
</ul>
<h4>2. 社融与信贷数据</h4><ul>
<li><b>发布时间</b>：每月10-15日发布上月数据</li>
<li><b>领先于</b>：GDP增速（约1-2个月）、企业盈利周期（约3个月）</li>
<li><b>发布方</b>：中国人民银行</li>
<li><b>影响板块</b>：银行（信贷扩张利好净息差）、建筑/地产（融资环境变化）</li>
<li><b>关键分项</b>：新增人民币贷款、表外融资、政府债券融资</li>
</ul>
<h4>3. CPI/PPI（通胀数据）</h4><ul>
<li><b>发布时间</b>：每月9-14日发布上月数据</li>
<li><b>领先于</b>：货币政策变化（约1-2个月后央行可能调整利率/准备金率）</li>
<li><b>发布方</b>：国家统计局</li>
<li><b>影响板块</b>：CPI→消费/食品饮料（上游涨价传导）；PPI→化工/有色/钢铁（利润弹性最大）</li>
<li><b>关键信号</b>：PPI-CPI剪刀差扩大→中游制造利润改善（如2020-2021年）</li>
</ul>
<h4>4. 社零与工业增加值</h4><ul>
<li><b>发布时间</b>：每月15-17日发布上月数据</li>
<li><b>领先于</b>：企业季度财报数据（约2-6周）</li>
<li><b>发布方</b>：国家统计局</li>
<li><b>影响板块</b>：社零→消费；工业增加值→制造/周期</li>
</ul>
<h4>5. 房地产数据（开工/销售/投资）</h4><ul>
<li><b>发布时间</b>：每月15日左右（与工业增加值同步）</li>
<li><b>领先于</b>：建材/钢铁/家电需求（约3-6个月）</li>
<li><b>发布方</b>：国家统计局</li>
<li><b>影响板块</b>：地产链（钢铁、水泥、玻璃、家电、家居）</li>
</ul>

<h4>二、资本市场领先指标</h4>
<h4>6. 北上资金（沪深港通净流入）</h4><ul>
<li><b>发布时间</b>：交易日次日公布前一日数据（东方财富有实时估算）</li>
<li><b>领先于</b>：次日开盘方向（通常提前1-2小时定价）</li>
<li><b>影响板块</b>：外资偏好的白马股（茅台、宁德时代、招商银行等）</li>
</ul>
<h4>7. 两融余额（融资融券）</h4><ul>
<li><b>发布时间</b>：每个交易日晚间公布当日数据</li>
<li><b>领先于</b>：短期市场情绪（杠杆资金是资金面的先行指标）</li>
<li><b>影响板块</b>：全市场，两融余额增加→市场情绪乐观，反之悲观</li>
</ul>
<h4>8. 公开市场操作与LPR利率</h4><ul>
<li><b>发布时间</b>：央行MLF操作日（每15日）、LPR（每月20日）</li>
<li><b>领先于</b>：全市场资金成本变化（降息降准前利率变化是明确信号）</li>
<li><b>影响板块</b>：银行（利差）、地产（融资成本）、券商（交易活跃度）</li>
</ul>
<h4>9. 股指期货升贴水</h4><ul>
<li><b>发布时间</b>：每个交易日实时</li>
<li><b>领先于</b>：现货市场方向（期货价格领先现货约5-15分钟）</li>
<li><b>解读</b>：大幅贴水→市场预期悲观；升水→预期乐观</li>
</ul>

<h4>三、使用领先指标的方法论</h4>
<ul>
<li><b>组合使用</b>：单个指标可能被噪音干扰，多个指标共振信号更可靠</li>
<li><b>季节性规律</b>：春节前物流/消费数据有季节性高估，应注意调整</li>
<li><b>预期差</b>：数据实际值 vs 市场预期的差值（通常WIND有主流预期）才是驱动股价的关键，而非数据本身</li>
<li><b>重视方向变化</b>：数据本身不如数据趋势重要——连续3个月改善的信号远强于单月异动</li>
</ul>`,
    });
    this.addArticle({
      title: '板块联动：行业专属先行指标与传导机制',
      category: '财经数据',
      content: `<h3>引言</h3><p>不同行业的股价对同一数据源的反应截然不同。例如万亿基建计划公布，对工程机械和消费电子影响天差地别。理解行业专属的先行指标，才能在数据公布前预判板块方向。</p>

<h4>🏗️ 工程机械/基建</h4>
<table style="width:100%;font-size:0.9rem;border-collapse:collapse;"><tr style="background:var(--primary);color:#fff;"><th style="padding:8px;">领先指标</th><th style="padding:8px;">发布时间</th><th style="padding:8px;">提前量</th></tr>
<tr><td style="padding:6px;border:1px solid var(--border-light);">挖掘机销量（月度）</td><td style="padding:6px;border:1px solid var(--border-light);">每月10日左右</td><td style="padding:6px;border:1px solid var(--border-light);">领先股价2-4周</td></tr>
<tr><td style="padding:6px;border:1px solid var(--border-light);">专项债发行进度</td><td style="padding:6px;border:1px solid var(--border-light);">每周更新</td><td style="padding:6px;border:1px solid var(--border-light);">领先订单变化约1-3个月</td></tr>
<tr><td style="padding:6px;border:1px solid var(--border-light);">基建投资额（累计同比）</td><td style="padding:6px;border:1px solid var(--border-light);">每月15日</td><td style="padding:6px;border:1px solid var(--border-light);">同步但滞后股价1周</td></tr>
<tr><td style="padding:6px;border:1px solid var(--border-light);">螺纹钢/水泥价格</td><td style="padding:6px;border:1px solid var(--border-light);">每日实时</td><td style="padding:6px;border:1px solid var(--border-light);">即时</td></tr>
</table>
<p><b>综合判断</b>：挖掘机销量+专项债双重确认时，是工程机械板块买入的安全信号。中联重科（000157）受基建投资和挖掘机销量影响最大。</p>

<h4>🚗 新能源汽车</h4>
<table style="width:100%;font-size:0.9rem;border-collapse:collapse;"><tr style="background:var(--primary);color:#fff;"><th style="padding:8px;">领先指标</th><th style="padding:8px;">发布时间</th><th style="padding:8px;">提前量</th></tr>
<tr><td style="padding:6px;border:1px solid var(--border-light);">乘联会月度车市数据</td><td style="padding:6px;border:1px solid var(--border-light);">每月8-10日</td><td style="padding:6px;border:1px solid var(--border-light);">领先股价2-4周</td></tr>
<tr><td style="padding:6px;border:1px solid var(--border-light);">碳酸锂/电池级锂价格</td><td style="padding:6px;border:1px solid var(--border-light);">每日</td><td style="padding:6px;border:1px solid var(--border-light);">影响锂电成本预期</td></tr>
<tr><td style="padding:6px;border:1px solid var(--border-light);">充电桩月度新增数</td><td style="padding:6px;border:1px solid var(--border-light);">每月12日</td><td style="padding:6px;border:1px solid var(--border-light);">充电基础设施先行</td></tr>
<tr><td style="padding:6px;border:1px solid var(--border-light);">汽车出口数据（海关）</td><td style="padding:6px;border:1px solid var(--border-light);">每月8日</td><td style="padding:6px;border:1px solid var(--border-light);">领先股价1-2周</td></tr>
</table>
<p><b>综合判断</b>：销量连续2个月>20%增长+碳酸锂价格企稳=买入窗口。</p>

<h4>🍶 白酒</h4>
<table style="width:100%;font-size:0.9rem;border-collapse:collapse;"><tr style="background:var(--primary);color:#fff;"><th style="padding:8px;">领先指标</th><th style="padding:8px;">发布时间</th><th style="padding:8px;">提前量</th></tr>
<tr><td style="padding:6px;border:1px solid var(--border-light);">飞天茅台批价</td><td style="padding:6px;border:1px solid var(--border-light);">每日</td><td style="padding:6px;border:1px solid var(--border-light);">先于其他白酒股1-2周</td></tr>
<tr><td style="padding:6px;border:1px solid var(--border-light);">社零（烟酒类）</td><td style="padding:6px;border:1px solid var(--border-light);">每月15日</td><td style="padding:6px;border:1px solid var(--border-light);">领先季报2-6周</td></tr>
<tr><td style="padding:6px;border:1px solid var(--border-light);">酒类流通协会库存数据</td><td style="padding:6px;border:1px solid var(--border-light);">每周</td><td style="padding:6px;border:1px solid var(--border-light);">库存增加=需求降温</td></tr>
</table>
<p><b>综合判断</b>：茅台批价是白酒行业的"金丝雀"，批价连续上涨/下跌先于公司股价2周左右。</p>

<h4>🔬 半导体</h4>
<table style="width:100%;font-size:0.9rem;border-collapse:collapse;"><tr style="background:var(--primary);color:#fff;"><th style="padding:8px;">领先指标</th><th style="padding:8px;">发布时间</th><th style="padding:8px;">提前量</th></tr>
<tr><td style="padding:6px;border:1px solid var(--border-light);">全球半导体销售额（SIA数据）</td><td style="padding:6px;border:1px solid var(--border-light);">每月第一周</td><td style="padding:6px;border:1px solid var(--border-light);">领先A股半导体约2周</td></tr>
<tr><td style="padding:6px;border:1px solid var(--border-light);">北美半导体设备出货额</td><td style="padding:6px;border:1px solid var(--border-light);">每月20日</td><td style="padding:6px;border:1px solid var(--border-light);">领先资本开支6-9个月</td></tr>
<tr><td style="padding:6px;border:1px solid var(--border-light);">存储芯片价格（DRAM/NAND）</td><td style="padding:6px;border:1px solid var(--border-light);">每日</td><td style="padding:6px;border:1px solid var(--border-light);">周期拐点先行信号</td></tr>
<tr><td style="padding:6px;border:1px solid var(--border-light);">费城半导体指数（SOX）</td><td style="padding:6px;border:1px solid var(--border-light);">每个交易日</td><td style="padding:6px;border:1px solid var(--border-light);">领先A股半导体板块1-3天</td></tr>
</table>
<p><b>核心规律</b>：全球半导体有典型4年库存周期。SIA数据同比转正→行业进入上升期</p>

<h4>🏦 银行/金融</h4>
<table style="width:100%;font-size:0.9rem;border-collapse:collapse;"><tr style="background:var(--primary);color:#fff;"><th style="padding:8px;">领先指标</th><th style="padding:8px;">发布时间</th><th style="padding:8px;">提前量</th></tr>
<tr><td style="padding:6px;border:1px solid var(--border-light);">LPR/MLF利率</td><td style="padding:6px;border:1px solid var(--border-light);">每月15/20日</td><td style="padding:6px;border:1px solid var(--border-light);">降息→银行净息差收窄</td></tr>
<tr><td style="padding:6px;border:1px solid var(--border-light);">社融数据</td><td style="padding:6px;border:1px solid var(--border-light);">每月10-15日</td><td style="padding:6px;border:1px solid var(--border-light);">信贷扩张→银行利润增加</td></tr>
<tr><td style="padding:6px;border:1px solid var(--border-light);">国债收益率曲线</td><td style="padding:6px;border:1px solid var(--border-light);">每日</td><td style="padding:6px;border:1px solid var(--border-light);">收益率陡峭化利好银行</td></tr>
</table>

<h4>☀️ 光伏/新能源</h4>
<table style="width:100%;font-size:0.9rem;border-collapse:collapse;"><tr style="background:var(--primary);color:#fff;"><th style="padding:8px;">领先指标</th><th style="padding:8px;">发布时间</th><th style="padding:8px;">提前量</th></tr>
<tr><td style="padding:6px;border:1px solid var(--border-light);">光伏装机量（月度）</td><td style="padding:6px;border:1px solid var(--border-light);">每月20日</td><td style="padding:6px;border:1px solid var(--border-light);">领先企业财报约2-4周</td></tr>
<tr><td style="padding:6px;border:1px solid var(--border-light);">硅料/硅片价格</td><td style="padding:6px;border:1px solid var(--border-light);">每周更新</td><td style="padding:6px;border:1px solid var(--border-light);">价格企稳→行业见底</td></tr>
<tr><td style="padding:6px;border:1px solid var(--border-light);">逆变器出口数据</td><td style="padding:6px;border:1px solid var(--border-light);">每月海关数据</td><td style="padding:6px;border:1px solid var(--border-light);">海外需求先行指标</td></tr>
</table>

<h4>如何在你自己的策略中应用这些指标</h4>
<p>打开策略池 → 点击你关注的策略 → 点击「🔍 匹配」按钮查看当前符合条件的股票。同时关注上述行业领先指标的变化方向：</p>
<ul>
<li><b>指标连续2个月好转</b>→ 该板块进入关注区</li>
<li><b>指标出现拐点</b>→ 如果从持续下降到首次回升，可能是底部信号</li>
<li><b>指标与股价背离</b>→ 股价下跌但指标好转，可能是买入机会</li>
<li><b>综合3个以上指标</b>→ 信号可靠性大幅提升</li>
</ul>`,
    });
    this.addArticle({
      title: '财经日历操作指南：如何用数据发布做交易计划',
      category: '财经数据',
      content: `<h3>为什么需要财经日历</h3><p>A股市场的关键数据发布有固定的时间规律。掌握这些时间点，可以提前布局，避免被"数据突袭"。数据发布当日，股价的波动幅度通常比非数据日高出30%-50%。</p>

<h4>月度数据发布时间轴</h4>
<table style="width:100%;font-size:0.9rem;border-collapse:collapse;"><tr style="background:var(--primary);color:#fff;"><th style="padding:8px;">日期窗口</th><th style="padding:8px;">数据项目</th><th style="padding:8px;">提前准备</th></tr>
<tr><td style="padding:6px;border:1px solid var(--border-light);">每月最后一天</td><td style="padding:6px;border:1px solid var(--border-light);">PMI（官方/财新）</td><td style="padding:6px;border:1px solid var(--border-light);">关注制造业库存周期拐点</td></tr>
<tr><td style="padding:6px;border:1px solid var(--border-light);">每月8-10日</td><td style="padding:6px;border:1px solid var(--border-light);">乘联会汽车销量、海关进出口</td><td style="padding:6px;border:1px solid var(--border-light);">汽车/消费电子板块方向</td></tr>
<tr><td style="padding:6px;border:1px solid var(--border-light);">每月9-14日</td><td style="padding:6px;border:1px solid var(--border-light);">CPI/PPI</td><td style="padding:6px;border:1px solid var(--border-light);">关注PPI涨幅→中游制造利润</td></tr>
<tr><td style="padding:6px;border:1px solid var(--border-light);">每月10-15日</td><td style="padding:6px;border:1px solid var(--border-light);">社融/信贷数据</td><td style="padding:6px;border:1px solid var(--border-light);">银行/地产/基建方向</td></tr>
<tr><td style="padding:6px;border:1px solid var(--border-light);">每月15日左右</td><td style="padding:6px;border:1px solid var(--border-light);">工业增加值、社零、房地产数据</td><td style="padding:6px;border:1px solid var(--border-light);">消费/制造/地产链</td></tr>
<tr><td style="padding:6px;border:1px solid var(--border-light);">每月15日</td><td style="padding:6px;border:1px solid var(--border-light);">MLF利率（央行）</td><td style="padding:6px;border:1px solid var(--border-light);">利率方向判断</td></tr>
<tr><td style="padding:6px;border:1px solid var(--border-light);">每月20日</td><td style="padding:6px;border:1px solid var(--border-light);">LPR报价</td><td style="padding:6px;border:1px solid var(--border-light);">降息预期交易</td></tr>
<tr><td style="padding:6px;border:1px solid var(--border-light);">每月20日左右</td><td style="padding:6px;border:1px solid var(--border-light);">光伏装机量</td><td style="padding:6px;border:1px solid var(--border-light);">新能源方向</td></tr>
</table>

<h4>数据发布当日的交易策略</h4>
<h4>1. 预期差交易法</h4>
<p>市场在数据发布前已经形成预期（WIND、各券商研报会列出预期值）。</p>
<ul>
<li><b>实际 > 预期 + 5%</b>：数据超预期→买入该板块（开盘后30分钟内操作）</li>
<li><b>实际 < 预期 - 5%</b>：数据低于预期→卖出/回避该板块</li>
<li><b>实际 ≈ 预期</b>：小幅波动，不构成操作信号（"买预期卖事实"）</li>
</ul>

<h4>2. 东北-西南对冲法</h4>
<p>当重要数据即将公布但方向不确定时：</p>
<ul>
<li>同时买入受益于"数据好"的板块 + 受益于"数据差"的板块</li>
<li>例如PMI数据前：买入基建ETF + 买入债券ETF（PMI好→基建涨、PMI差→债券涨）</li>
<li>数据公布后平掉不利一方</li>
</ul>

<h4>3. 数据联动链</h4>
<p>一个数据的变化会触发连锁反应：</p>
<p><b>PPI上涨 → 中游制造业成本上升 → 下游消费品可能涨价 → 消费股EPS预期上调</b></p>
<p>理解这个链条，就可以在PPI数据公布后布局最远端的板块。</p>

<h4>💡 实战案例</h4>
<p><b>场景</b>：2025年12月9日，CPI数据低于预期，社融数据超预期增长。</p>
<table style="width:100%;font-size:0.9rem;border-collapse:collapse;"><tr style="background:var(--primary);color:#fff;"><th style="padding:8px;">步骤</th><th style="padding:8px;">操作</th><th style="padding:8px;">逻辑</th></tr>
<tr><td style="padding:6px;border:1px solid var(--border-light);">第一步</td><td style="padding:6px;border:1px solid var(--border-light);">判断方向</td><td style="padding:6px;border:1px solid var(--border-light);">CPI低→消费乏力、社融高→信贷需求旺</td></tr>
<tr><td style="padding:6px;border:1px solid var(--border-light);">第二步</td><td style="padding:6px;border:1px solid var(--border-light);">对应板块</td><td style="padding:6px;border:1px solid var(--border-light);">社融好→银行、建筑、基建优先受益</td></tr>
<tr><td style="padding:6px;border:1px solid var(--border-light);">第三步</td><td style="padding:6px;border:1px solid var(--border-light);">开盘操作</td><td style="padding:6px;border:1px solid var(--border-light);">开盘后买入银行ETF或基建龙头</td></tr>
<tr><td style="padding:6px;border:1px solid var(--border-light);">第四步</td><td style="padding:6px;border:1px solid var(--border-light);">后续观察</td><td style="padding:6px;border:1px solid var(--border-light);">关注接下来3个月的信贷数据是否持续</td></tr>
</table>

<h4>工具推荐</h4><ul>
<li><b>金十数据</b>（jin10.com）：财经日历最全，可设置数据发布提醒</li>
<li><b>东方财富财经日历</b>：集成A股数据发布时间表</li>
<li><b>WIND金融终端</b>：专业预期值查询（付费）</li>
<li><b>同花顺i问财</b>：用自然语言查询"最新PMI数据"</li>
</ul>`,
    });

    // ===== 策略（8个） =====

    this.addStrategy({
      name: '低估值龙头定投策略',
      logic: '选择PE处于历史30%分位以下、ROE连续3年>15%的行业龙头。在估值分位<20%开始建仓，每下跌5%加仓一次（每次加仓量为初始的50%），目标在估值分位>60%时分批止盈。最多持有5只股票，单只上限30%。',
      condition: '大盘处于震荡或下跌末期，市场情绪悲观，整体估值偏低',
      status: '跟踪中',
    });
    this.addStrategy({
      name: '财报超预期短线策略',
      logic: '在财报季关注营收增速>20%且净利润增速>30%的公司。公告次日若高开3%以上则放弃，若平开或微低开则在开盘后30分钟内介入。持仓5-10个交易日，止损-5%，目标收益8%-15%。符合条件时最多介入2只，单只仓位不超过15%。',
      condition: '财报季期间（1月、4月、7月、10月），市场整体情绪偏积极',
      status: '跟踪中',
    });
    this.addStrategy({
      name: '行业ETF网格交易',
      logic: '选波动率适中（年化波动率15%-30%）的行业ETF，设定5%间距网格。初始仓位50%，每上涨5%卖出10%仓位，每下跌5%买入10%仓位。跌破历史最低价10%时暂停网格，重新评估该行业逻辑是否成立。',
      condition: '市场处于震荡区间，无明显单边趋势，ETF没有退市风险',
      status: '已执行',
    });
    this.addStrategy({
      name: '趋势跟踪中线策略',
      logic: '筛选站上MA60且MA60方向向上的个股。入场条件：股价回调至MA20附近且获得支撑，同时MACD在零轴上方、成交量温和放大。止损设在MA60下方3%，止盈目标20%-30%。初始仓位20%，盈利5%后加至40%。',
      condition: '大盘处于上升趋势（指数站上MA60）或反弹行情中',
      status: '跟踪中',
    });
    this.addStrategy({
      name: '突破买入回调加仓策略',
      logic: '选择长期盘整后放量突破关键压力位的股票。突破当天成交量为前20日均量的1.5倍以上。突破后不追，等回调至突破位附近（±2%）时买入。止损设在压力位下方5%，第一目标涨幅15%，到达后卖一半，剩余移动止损。',
      condition: '个股经历至少2个月盘整，突破时大盘配合（不强求同步但不要对立方向）',
      status: '已执行',
    });
    this.addStrategy({
      name: '高股息红利策略',
      logic: '筛选股息率>4%、分红连续5年以上未中断、行业处于稳定期（银行、电力、高速公路、消费）的个股。构建10只左右的组合持仓，每季度检查一次。股息率低于3%时逐步替换，组合股息率目标稳定在4%以上。',
      condition: '市场利率下行周期，资金寻求稳健收益。熊市和震荡市中表现尤其突出',
      status: '已执行',
    });
    this.addStrategy({
      name: '板块轮动切换策略',
      logic: '根据市场风格切换，在成长/价值、大/小盘之间轮动。使用创业板50ETF和沪深300ETF作为工具。当创业板50ETF近20日涨幅超过沪深300ETF 5%以上时持有沪深300（预期风格切换），反之持有创业板50。每月调仓一次。',
      condition: '市场存在明显的跷跷板效应，风格分化严重时效果最佳',
      status: '跟踪中',
    });
    this.addStrategy({
      name: '事件驱动短线策略',
      logic: '关注以下事件：重大政策发布（如产业规划、税收优惠）、公司发布重大订单/合同公告、超预期分红/回购。事件发生后1-2个交易日内择机介入，持仓3-5个交易日，获利5%-8%止盈，止损-3%。保持仓位灵活度，单事件单笔上限10%。',
      condition: '事件明确且力度较大，市场对该事件的定价尚未充分反映（公告后涨幅<3%）',
      status: '已废弃',
    });

    // ===== 天赢居体系知识（2篇） =====
    this.addArticle({
      title: '天赢居核心工具：趋势线、均线与144线逐级升级法',
      category: '技术分析',
      content: `<h3>天赢居体系概述</h3><p>天赢居（tyj）是国内实战派趋势研判博主，1993年入市，独创《趋势线相交确定变盘时间之窗》和《农历节气与股市关联》方法体系。核心思想是："先看趋势，再定仓位，再选板块，最后挑个股。时间比空间更重要，多体系共振之后再下手。"</p>

<h4>五步分析流程（顺序不可乱）</h4>
<ol>
<li><b>看大盘</b>：决定仓位。牛市持股为主，熊市持币为主，震荡市高抛低吸。</li>
<li><b>看时间</b>：决定出手时机。是否在时间之窗或节气变盘点附近？</li>
<li><b>看趋势线/均线</b>：判断当前位置是支撑还是压力。</li>
<li><b>看板块</b>：判断胜算高低。资金在攻哪个方向？</li>
<li><b>看个股</b>：寻找买卖点。个股形态确认后才能执行。</li>
</ol>

<h4>工具一：趋势线相交变盘</h4>
<p><b>原理</b>：两条以上重要趋势线在某日相交，该交叉点即是高概率变盘点（时间+空间双重共振）。</p><ul>
<li>必须用<b>重要高低点</b>取点，不能用普通波动点</li>
<li>"两点成线，三点验证"——趋势线需要至少三次触碰确认</li>
<li>趋势线允许<b>2%以内误差</b>，超过3%说明原结构已被改变</li>
<li>必须提前<b>计算</b>未来交点，不能只画线事后解释</li>
</ul>

<h4>工具二：144线逐级升级法</h4>
<p><b>核心思想</b>：每个时间级别的144均线都是关键转折点。站上→回踩不破→升级到更高级别。</p>
<table style="width:100%;font-size:0.9rem;border-collapse:collapse;"><tr style="background:var(--primary);color:#fff;"><th style="padding:8px;">级别</th><th style="padding:8px;">信号含义</th><th style="padding:8px;">操作</th></tr>
<tr><td style="padding:6px;border:1px solid var(--border-light);">1分钟144线</td><td style="padding:6px;border:1px solid var(--border-light);">超短线企稳</td><td style="padding:6px;border:1px solid var(--border-light);">观察</td></tr>
<tr><td style="padding:6px;border:1px solid var(--border-light);">5分钟144线</td><td style="padding:6px;border:1px solid var(--border-light);">短线转强信号</td><td style="padding:6px;border:1px solid var(--border-light);">关注</td></tr>
<tr><td style="padding:6px;border:1px solid var(--border-light);">15分钟144线</td><td style="padding:6px;border:1px solid var(--border-light);">短线确认</td><td style="padding:6px;border:1px solid var(--border-light);">逐步加仓</td></tr>
<tr><td style="padding:6px;border:1px solid var(--border-light);">30分钟144线</td><td style="padding:6px;border:1px solid var(--border-light);">中线转强</td><td style="padding:6px;border:1px solid var(--border-light);">加仓</td></tr>
<tr><td style="padding:6px;border:1px solid var(--border-light);">小时144线</td><td style="padding:6px;border:1px solid var(--border-light);">日线反转</td><td style="padding:6px;border:1px solid var(--border-light);">重仓</td></tr>
<tr><td style="padding:6px;border:1px solid var(--border-light);">日线144线</td><td style="padding:6px;border:1px solid var(--border-light);">大趋势反转</td><td style="padding:6px;border:1px solid var(--border-light);">长线持有</td></tr>
</table>
<p><b>关键要领</b>：突破144线后必有回踩，回踩不破才是右侧调入点。瞬间破位又快速收回不算破位。收盘站稳+小时级别MACD/KDJ双金叉=真确认。记住：<b>线上持股，破位出局</b>。</p>

<h4>工具三：节气与股市</h4>
<p>中国股市参与者受传统文化影响，行为节律与二十四节气高度相关。三十年历史数据统计验证。</p><ul>
<li><b>冬至</b>：一年中最重要的抄底窗口</li>
<li><b>立春</b>：第二重要窗口，多数年份助涨</li>
<li><b>清明/谷雨</b>：偏空，逃顶窗口</li>
<li><b>立夏/芒种/夏至</b>：大波段转折高发区，高度警惕</li>
<li>使用时注意：节气前后1-2天即进入变盘窗口</li>
</ul>

<h4>工具四：均线体系（斐波那契数列）</h4>
<p>核心均线：5、8、13、21、34、55、89、144、233、377日均线。</p><ul>
<li><b>5、8日均线</b>：短线持股线，破位即出</li>
<li><b>13、21日均线</b>：中线止损线</li>
<li><b>55、89、144日均线</b>：多头趋势核心</li>
<li><b>233、377日均线</b>：长线牛熊分界</li>
</ul>
<p><b>五线开花</b>：5/8/13/21/34 多头发散向上→强势，持股。<br>
<b>毒蜘蛛</b>：多条均线收敛后向下发散→弱势，强阻力。</p>

<h4>工具五：多体系共振检查表</h4>
<p>不靠单一信号下手，多个独立体系分析后取重叠区，重叠越多胜算越高：</p>
<table style="width:100%;font-size:0.85rem;border-collapse:collapse;"><tr style="background:var(--primary);color:#fff;"><th style="padding:8px;">共振项数</th><th style="padding:8px;">胜算</th><th style="padding:8px;">建议仓位</th><th style="padding:8px;">操作</th></tr>
<tr><td style="padding:6px;border:1px solid var(--border-light);">≥7项</td><td style="padding:6px;border:1px solid var(--border-light);">≥70%</td><td style="padding:6px;border:1px solid var(--border-light);">重仓</td><td style="padding:6px;border:1px solid var(--border-light);">进攻</td></tr>
<tr><td style="padding:6px;border:1px solid var(--border-light);">5-6项</td><td style="padding:6px;border:1px solid var(--border-light);">60-70%</td><td style="padding:6px;border:1px solid var(--border-light);">半仓</td><td style="padding:6px;border:1px solid var(--border-light);">谨慎参与</td></tr>
<tr><td style="padding:6px;border:1px solid var(--border-light);"><5项</td><td style="padding:6px;border:1px solid var(--border-light);"><60%</td><td style="padding:6px;border:1px solid var(--border-light);">轻仓/空仓</td><td style="padding:6px;border:1px solid var(--border-light);">观望</td></tr>
</table>
<p><b>共振体系</b>：趋势线 + 均线 + K线形态 + 波浪结构 + 黄金分割 + 时间之窗 + 节气周期 + 量价关系 + 板块轮动 + 箱体通道 + 前高前低 + 资金行为，共12个独立体系。</p>`,
    });
    this.addArticle({
      title: '天赢居操盘心法：买卖点体系与仓位管理',
      category: '交易心理',
      content: `<h3>操盘心法七条</h3><ol>
<li><b>用数学炒股，减少情绪干扰</b>——胜算七成进攻，六成谨慎，低于六成放弃。</li>
<li><b>线上持股，线下持币</b>——按规矩办，不凭情绪猜。</li>
<li><b>买卖点成对使用</b>——买进之前先想好怎么卖，没有卖出计划的买进是赌博。</li>
<li><b>错了立即止损，绝不盲目补仓。</b></li>
<li><b>少赚不可怕，失控才可怕</b>——复利增长才是正道。</li>
<li><b>结构性慢牛里只做主线</b>——主线选错，大盘涨也白搭。</li>
<li><b>高胜算处进攻，普通胜算处谨慎，低胜算处等待</b>——不因害怕踏空而追涨。</li>
</ol>

<h4>经典买点（只做这7种）</h4><ol>
<li>双底、三重底买点</li>
<li>底部立桩量买点（长期横盘后放量3倍以上突破箱顶）</li>
<li>五线开花买点（多条均线多头发散）</li>
<li>空中加油买点（放量上涨→缩量回踩→再涨）</li>
<li>放量突破箱顶创新高买点</li>
<li>一浪上涨后二浪不破起点的回踩买点</li>
<li>多周期逐级升级后的右侧确认买点</li>
</ol>

<h4>经典卖点</h4><ol>
<li>双顶、三重顶卖点</li>
<li>平台破位卖点</li>
<li>反抽不过原箱顶卖点</li>
<li>顶部放量滞涨卖点</li>
<li>跌破前一波段顶部卖点</li>
<li>5日、8日均线死叉卖点</li>
<li>13/21/55日均线止损卖点</li>
<li>通道下轨、趋势线止损卖点</li>
<li>黄金目标线左侧止盈卖点</li>
</ol>

<h4>趋势线卖点四式</h4><table style="width:100%;font-size:0.9rem;border-collapse:collapse;"><tr style="background:var(--primary);color:#fff;"><th style="padding:8px;">卖点</th><th style="padding:8px;">触发条件</th></tr>
<tr><td style="padding:6px;border:1px solid var(--border-light);">趋势线压力卖点</td><td style="padding:6px;border:1px solid var(--border-light);">到达下降压力线+放量滞涨+KDJ死叉+MACD红柱缩短</td></tr>
<tr><td style="padding:6px;border:1px solid var(--border-light);">跌破趋势线卖点</td><td style="padding:6px;border:1px solid var(--border-light);">上升线跌破（5分钟降级→15分钟转弱→小时风险→日线防守）</td></tr>
<tr><td style="padding:6px;border:1px solid var(--border-light);">破位反抽卖点</td><td style="padding:6px;border:1px solid var(--border-light);">支撑跌破后反抽不过原支撑，不能犹豫</td></tr>
<tr><td style="padding:6px;border:1px solid var(--border-light);">通道上轨卖点</td><td style="padding:6px;border:1px solid var(--border-light);">冲上轨+涨幅大+远离5/8日均线+高位放量滞涨</td></tr>
</table>

<h4>仓位管理矩阵</h4><table style="width:100%;font-size:0.9rem;border-collapse:collapse;"><tr style="background:var(--primary);color:#fff;"><th style="padding:8px;">大盘阶段</th><th style="padding:8px;">持仓策略</th><th style="padding:8px;">操作节奏</th></tr>
<tr><td style="padding:6px;border:1px solid var(--border-light);">牛市/主升浪</td><td style="padding:6px;border:1px solid var(--border-light);">持股为主</td><td style="padding:6px;border:1px solid var(--border-light);">偶尔做差价</td></tr>
<tr><td style="padding:6px;border:1px solid var(--border-light);">熊市</td><td style="padding:6px;border:1px solid var(--border-light);">持币为主</td><td style="padding:6px;border:1px solid var(--border-light);">偶尔做8-13天反抽</td></tr>
<tr><td style="padding:6px;border:1px solid var(--border-light);">震荡市</td><td style="padding:6px;border:1px solid var(--border-light);">高抛低吸</td><td style="padding:6px;border:1px solid var(--border-light);">箱顶卖、箱底买</td></tr>
</table>

<h4>真假突破辨别</h4><p><b>真突破</b>：突破关键趋势线+放量明显+突破后不快速跌回+回踩不破+均线同步转强+板块主线配合+大盘环境不差。</p><p><b>假突破</b>：突破时量能不足+突破后很快跌回+板块没有配合+大盘处于压力位+高位长上影线+次日不能继续放量上攻。</p><p>两种确认法：①股价离开原平台超过3%并继续放量远离；②回踩不破原平台再重新离开。<br>跌回趋势线下方就承认失败，不幻想。</p>

<h4>心态自检清单</h4><ul>
<li>❑ 买点不敢买→犹豫踏空</li>
<li>❑ 上涨中没耐心→频繁换股</li>
<li>❑ 卖点不敢卖→侥幸扛单</li>
<li>❑ 亏了想补仓→越套越深</li>
<li>❑ 赚了就想马上兑现→不让利润奔跑</li>
<li>❑ 永远临时起意→没有计划</li>
<li>❑ 看不清方向还操作→强行交易</li>
</ul>
<p><b>以下七种不做</b>：大盘不好不做 / 非主线不做 / 没有把握不做 / 没有卖出计划不买 / 破位不止损不行 / 心情不好不做 / 过了最佳位置不追。</p>`,
    });

    // ===== 交易记录（6笔） =====

    this.addTrade({
      stockName: '中联重科', stockCode: '000157',
      buyDate: '2025-11-15', buyPrice: 7.64, shares: 1000,
      sellDate: '', sellPrice: '',
      notes: '工程机械龙头，当前PE位于历史低位，看好基建投资回暖带来的估值修复。计划长线持有，目标价9元以上分批减仓。',
    });
    this.addTrade({
      stockName: '贵州茅台', stockCode: '600519',
      buyDate: '2025-09-10', buyPrice: 1850, shares: 100,
      sellDate: '2025-12-05', sellPrice: 1920,
      notes: '国庆消费旺季叠加白酒板块反弹预期。持有约3个月获利3.8%。教训：白酒行情持续性弱于预期，应该设置更严格的跟进止盈。',
    });
    this.addTrade({
      stockName: '宁德时代', stockCode: '300750',
      buyDate: '2025-10-20', buyPrice: 245, shares: 200,
      sellDate: '2025-11-28', sellPrice: 232,
      notes: '动力电池龙头，但低估了锂电产业链价格战的持续性。跌破240元时应该止损，却因为"龙头够大不会跌太多"的错误心态继续持有，最终亏损5.3%。反思：龙头不等于不跌。',
    });
    this.addTrade({
      stockName: '科大讯飞', stockCode: '002230',
      buyDate: '2025-11-01', buyPrice: 48.5, shares: 500,
      sellDate: '2026-01-10', sellPrice: 55.2,
      notes: 'AI概念利好，市场认可度高。采用突破回调策略在49元附近补过仓，拉低了成本。最终获利13.8%。成功原因：逻辑清晰 + 耐心持有 + 不追高。',
    });
    this.addTrade({
      stockName: '腾讯控股', stockCode: '00700',
      buyDate: '2025-08-15', buyPrice: 380, shares: 200,
      sellDate: '2025-10-08', sellPrice: 365,
      notes: '腾讯回购持续但市场不买账，港股整体疲弱拖累。持有不到2个月亏3.9%止损出局。教训：大市低迷时，个股基本面再好也可能被拖累，需要关注宏观环境。',
    });
    this.addTrade({
      stockName: '比亚迪', stockCode: '002594',
      buyDate: '2025-07-01', buyPrice: 268, shares: 150,
      sellDate: '2025-09-15', sellPrice: 310,
      notes: '新能源车月度销量数据持续超预期，叠加新品上市催化。持有约2.5个月获利15.7%。正确的判断：龙头企业销量数据是定性买入的核心依据。',
    });

    // ===== 持仓快照（最近 30 天模拟数据） =====
    if (this.getSnapshots().length === 0) {
      const today = new Date();
      const stocks = [
        { stockName: '中联重科', stockCode: '000157', shares: 1000, costPrice: 7.64, industry: '工程机械' },
        { stockName: '贵州茅台', stockCode: '600519', shares: 100, costPrice: 1850, industry: '白酒' },
        { stockName: '比亚迪', stockCode: '002594', shares: 150, costPrice: 268, industry: '汽车' },
        { stockName: '科大讯飞', stockCode: '002230', shares: 500, costPrice: 48.5, industry: '软件' },
      ];
      // 生成最近30天的快照（净值围绕初始值波动上升）
      let baseValue = 480000;
      for (let i = 30; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        // 跳过周末
        if (d.getDay() === 0 || d.getDay() === 6) continue;
        const dateStr = d.toISOString().slice(0, 10);
        // 模拟波动：整体上升约 5%，日波动 ±1.5%
        const trend = (30 - i) * 800;
        const noise = (Math.random() - 0.45) * 8000;
        const totalAssets = baseValue + trend + noise;
        const cash = 50000 + (Math.random() - 0.5) * 5000;
        const positions = stocks.map(s => {
          const priceBase = s.costPrice * (1 + (30 - i) * 0.002 + (Math.random() - 0.45) * 0.03);
          const marketValue = priceBase * s.shares;
          const profitLoss = (priceBase - s.costPrice) * s.shares;
          return {
            stockName: s.stockName,
            stockCode: s.stockCode,
            shares: s.shares,
            costPrice: s.costPrice,
            currentPrice: parseFloat(priceBase.toFixed(2)),
            marketValue: parseFloat(marketValue.toFixed(2)),
            industry: s.industry,
            profitLoss: parseFloat(profitLoss.toFixed(2)),
            profitLossRate: parseFloat(((priceBase / s.costPrice - 1) * 100).toFixed(2)),
            weight: parseFloat(((marketValue / totalAssets) * 100).toFixed(2)),
          };
        });
        this.addSnapshot({
          date: dateStr,
          totalAssets: parseFloat(totalAssets.toFixed(2)),
          cash: parseFloat(cash.toFixed(2)),
          positions,
        });
      }
    }

    // ===== 自选股（8只） =====
    if (this.getWatchlist().length === 0) {
      const watchStocks = [
        { stockName: '中联重科', stockCode: '000157', group: '核心关注', addPrice: 7.64, targetPrice: 9.5, stopLossPrice: 7.0, notes: '低估值工程机械龙头，长期持有' },
        { stockName: '宁德时代', stockCode: '300750', group: '短线观察', addPrice: 245, targetPrice: 280, stopLossPrice: 225, notes: '关注锂电价格战拐点' },
        { stockName: '贵州茅台', stockCode: '600519', group: '核心关注', addPrice: 1850, targetPrice: 2100, stopLossPrice: 1750, notes: '白酒龙头，消费复苏受益' },
        { stockName: '比亚迪', stockCode: '002594', group: '核心关注', addPrice: 268, targetPrice: 320, stopLossPrice: 250, notes: '新能源车销量持续超预期' },
        { stockName: '科大讯飞', stockCode: '002230', group: '短线观察', addPrice: 48.5, targetPrice: 60, stopLossPrice: 45, notes: 'AI概念，关注商业化进展' },
        { stockName: '海康威视', stockCode: '002415', group: '长线跟踪', addPrice: 32, targetPrice: 40, stopLossPrice: 28, notes: '安防龙头，海外业务回暖' },
        { stockName: '招商银行', stockCode: '600036', group: '长线跟踪', addPrice: 35, targetPrice: 42, stopLossPrice: 32, notes: '银行龙头，高股息' },
        { stockName: '中国平安', stockCode: '601318', group: '长线跟踪', addPrice: 48, targetPrice: 58, stopLossPrice: 44, notes: '保险龙头，估值修复' },
      ];
      const today = new Date().toISOString().slice(0, 10);
      watchStocks.forEach(w => {
        this.addWatch({ ...w, addDate: today, alertEnabled: true });
      });
    }

    // ===== 提醒（5条） =====
    if (this.getAlerts().length === 0) {
      this.addAlert({ stockCode: '000157', stockName: '中联重科', type: 'price_up', condition: '突破', threshold: 9.0, desc: '中联重科突破9元目标价' });
      this.addAlert({ stockCode: '000157', stockName: '中联重科', type: 'price_down', condition: '跌破', threshold: 7.0, desc: '中联重科跌破7元止损线' });
      this.addAlert({ stockCode: '600519', stockName: '贵州茅台', type: 'price_up', condition: '突破', threshold: 2000, desc: '茅台突破2000元' });
      this.addAlert({ stockCode: '300750', stockName: '宁德时代', type: 'price_down', condition: '跌破', threshold: 220, desc: '宁德时代跌破220' });
      this.addAlert({ stockCode: '002594', stockName: '比亚迪', type: 'price_up', condition: '突破', threshold: 320, desc: '比亚迪突破320目标价' });
    }

    // ===== 投资日记（5篇） =====
    if (this.getDiaries().length === 0) {
      const today = new Date();
      for (let i = 0; i < 5; i++) {
        const d = new Date(today); d.setDate(d.getDate() - i * 3);
        const dateStr = d.toISOString().slice(0, 10);
        const moods = ['乐观', '中性', '谨慎', '中性', '乐观'];
        const views = [
          '大盘缩量震荡，观望情绪浓厚。关注基建板块能否持续走强。',
          '市场放量上涨，科技股领涨。但需警惕短线获利回吐。',
          '外围不确定性增加，建议控制仓位，等待方向明确。',
          '消费数据回暖，白酒和食品饮料板块有资金流入迹象。',
          '指数突破关键压力位，量价配合良好，短期看好。',
        ];
        const reflections = [
          '今天操作偏保守，错过了一些机会。下次应该更果断一些，但也不能盲目追涨。',
          '按计划执行了止损，虽然小亏但避免了更大损失。纪律比情绪重要。',
          '没有操作，保持耐心。市场不确定性大时，不操作就是最好的操作。',
          '加仓了看好的标的，逻辑没变就继续持有。不被短期波动影响判断。',
          '复盘发现之前的卖出时机有问题，以后要更耐心持有盈利仓位。',
        ];
        const lessons = [['耐心等待','纪律执行'], ['纪律执行','情绪控制'], ['耐心等待'], ['仓位合理','纪律执行'], ['情绪控制','耐心等待']];
        this.addDiary({
          date: dateStr,
          mood: moods[i],
          marketView: views[i],
          reflections: reflections[i],
          lessons: lessons[i],
          operations: [],
        });
      }
    }

    // ===== 资讯收藏（5条） =====
    if (this.getNews().length === 0) {
      const newsItems = [
        { title: '央行降准0.5个百分点 释放长期资金约1万亿元', url: 'https://www.example.com/news/1', source: '新华社', tags: ['宏观','利好'], summary: '人民银行决定降准，释放流动性，利好股市资金面', stockCodes: [] },
        { title: '中联重科三季报：归母净利润同比增长25%', url: 'https://www.example.com/news/2', source: '证券时报', tags: ['个股','利好'], summary: '工程机械需求回暖，公司业绩超预期', stockCodes: ['000157'] },
        { title: '新能源汽车补贴退坡30% 行业洗牌加速', url: 'https://www.example.com/news/3', source: '21世纪经济报道', tags: ['行业','利空'], summary: '补贴减少短期影响销量，长期利好龙头集中', stockCodes: ['002594'] },
        { title: '半导体国产化率突破20% 设备订单大增', url: 'https://www.example.com/news/4', source: '电子时报', tags: ['行业','利好'], summary: '国产设备厂商订单饱满，行业景气度上行', stockCodes: [] },
        { title: '美联储维持利率不变 预计年内还有一次降息', url: 'https://www.example.com/news/5', source: '华尔街见闻', tags: ['宏观'], summary: '海外流动性环境偏宽松，利好新兴市场', stockCodes: [] },
      ];
      newsItems.forEach((n, i) => {
        const d = new Date(); d.setDate(d.getDate() - i);
        n.publishedAt = d.toISOString();
        this.addNews(n);
      });
    }

    // ===== 研报（3份） =====
    if (this.getReports().length === 0) {
      this.addReport({ title: '中联重科深度报告：基建发力叠加海外拓展', source: '中信证券', stockCode: '000157', stockName: '中联重科', rating: '买入', targetPrice: 9.5, publishDate: '2026-06-20', keyPoints: '工程机械周期向上，海外收入占比提升，估值处于历史低位。预计2026-2028年净利润CAGR 15%。', myOpinion: '认同逻辑，但需关注地产开工数据' });
      this.addReport({ title: '贵州茅台：短期承压 长期价值不变', source: '海通证券', stockCode: '600519', stockName: '贵州茅台', rating: '增持', targetPrice: 2100, publishDate: '2026-06-15', keyPoints: '批价稳定，渠道库存健康。短期消费疲弱，长期品牌护城河深厚。', myOpinion: '长期持有，不急于加仓' });
      this.addReport({ title: '宁德时代：锂电价格战见顶 龙头受益', source: '中金公司', stockCode: '300750', stockName: '宁德时代', rating: '买入', targetPrice: 280, publishDate: '2026-06-10', keyPoints: '行业产能出清，龙头市占率提升。技术领先，成本优势明显。', myOpinion: '关注左侧机会，分批建仓' });
    }
  },
};

// ---- 数据导出 / 导入 ----
DB.exportAll = function() {
  return JSON.stringify({
    version: 2,
    exportedAt: new Date().toISOString(),
    articles: this.getArticles(),
    strategies: this.getStrategies(),
    trades: this.getTrades(),
    snapshots: this.getSnapshots(),
    watchlist: this.getWatchlist(),
    alerts: this.getAlerts(),
    diaries: this.getDiaries(),
    news: this.getNews(),
    reports: this.getReports(),
  }, null, 2);
};

DB.importAll = function(jsonStr) {
  try {
    const data = JSON.parse(jsonStr);
    if (!data || typeof data !== 'object') throw new Error('格式错误');
    if (data.articles) this.setArticles(data.articles);
    if (data.strategies) this.setStrategies(data.strategies);
    if (data.trades) {
      // 兼容旧数据：补全新字段
      data.trades.forEach(t => {
        t.profit = this._calcProfit(t);
        if (!t.tags) t.tags = [];
        if (t.rating === undefined) t.rating = 0;
        if (!t.strategy) t.strategy = '';
      });
      this.setTrades(data.trades);
    }
    if (data.snapshots) this.setSnapshots(data.snapshots);
    if (data.watchlist) this.setWatchlist(data.watchlist);
    if (data.alerts) this.setAlerts(data.alerts);
    if (data.diaries) this.setDiaries(data.diaries);
    if (data.news) this.setNews(data.news);
    if (data.reports) this.setReports(data.reports);
    return { success: true, counts: {
      articles: (data.articles || []).length,
      strategies: (data.strategies || []).length,
      trades: (data.trades || []).length,
      snapshots: (data.snapshots || []).length,
      watchlist: (data.watchlist || []).length,
      alerts: (data.alerts || []).length,
      diaries: (data.diaries || []).length,
      news: (data.news || []).length,
      reports: (data.reports || []).length,
    }};
  } catch (e) {
    return { success: false, error: e.message };
  }
};

// ---- 数据管理操作 ----
function exportAllData() {
  const json = DB.exportAll();
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const date = new Date().toISOString().slice(0, 10);
  a.download = `我的投资智库_数据备份_${date}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('✅ 数据已导出');
}

function importAllData() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = function(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(ev) {
      const result = DB.importAll(ev.target.result);
      if (result.success) {
        showToast(`✅ 导入成功：${result.counts.articles} 篇文章、${result.counts.strategies} 个策略、${result.counts.trades} 条交易记录`);
        // 刷新当前页面
        setTimeout(() => location.reload(), 800);
      } else {
        showToast('❌ 导入失败：' + result.error);
      }
    };
    reader.readAsText(file);
  };
  input.click();
}

// ---- 同步状态 UI ----
const SyncUI = {
  el: null,
  statusEl: null,

  init() {
    // 创建同步状态指示器
    if (document.getElementById('syncStatus')) return;

    this.el = document.createElement('div');
    this.el.id = 'syncStatus';
    this.el.style.cssText = `
      position: fixed; bottom: 16px; right: 16px; z-index: 5000;
      display: flex; align-items: center; gap: 6px;
      padding: 6px 14px; border-radius: 20px;
      font-size: 0.78rem; cursor: pointer; transition: all 0.3s;
      background: var(--card-bg); border: 1px solid var(--border);
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    `;
    this.el.innerHTML = `<span id="syncDot">●</span><span id="syncText">离线模式</span>`;
    this.el.onclick = () => { if (DB.isSyncEnabled()) this.showSyncInfo(); else this.showSetup(); };
    document.body.appendChild(this.el);
    this.updateStatus('offline');

    // 自动检测是否有已保存的 token
    const savedToken = localStorage.getItem(DB._prefix + 'gistToken');
    if (savedToken) {
      DB.syncToken = savedToken;
      this.updateStatus('connecting');
      DB.loadFromGist().then(ok => {
        this.updateStatus(ok ? 'connected' : 'error');
        if (ok && window.syncOnPageReady) window.syncOnPageReady();
      });
    }
  },

  updateStatus(status) {
    const dot = document.getElementById('syncDot');
    const text = document.getElementById('syncText');
    if (!dot || !text) return;

    const statusMap = {
      connected: { color: '#00c853', text: '已同步', bg: '#e8f5e9', border: '#c8e6c9' },
      connecting: { color: '#ffab00', text: '同步中…', bg: '#fff8e1', border: '#ffe082' },
      error: { color: '#ff1744', text: '同步异常', bg: '#ffebee', border: '#ffcdd2' },
      offline: { color: '#90a4ae', text: '离线模式', bg: '#f5f5f5', border: '#e0e0e0' },
    };
    const s = statusMap[status] || statusMap.offline;
    dot.style.color = s.color;
    text.textContent = s.text;
    this.el.style.background = s.bg;
    this.el.style.borderColor = s.border;
  },

  showSetup() {
    const token = prompt(
      '请输入你的 GitHub Token 以开启跨设备同步：\n\n（Token 仅保存在本地浏览器，不上传任何地方）',
      ''
    );
    if (!token || !token.trim()) return;
    const trimmed = token.trim();
    this.updateStatus('connecting');

    // 验证 token：尝试读取 Gist
    fetch(`https://api.github.com/gists/${DB.GIST_ID}`, {
      headers: { Authorization: `Bearer ${trimmed}`, Accept: 'application/vnd.github+json' }
    })
      .then(async r => {
        if (!r.ok) throw new Error('Token 无效');
        DB.enableSync(trimmed);
        this.updateStatus('connected');
        showToast('✅ 同步已开启，数据自动云端同步');
        return DB.loadFromGist();
      })
      .then(() => {
        if (window.syncOnPageReady) window.syncOnPageReady();
      })
      .catch(() => {
        this.updateStatus('error');
        showToast('❌ Token 验证失败，请检查后重试');
      });
  },

  showSyncInfo() {
    const action = confirm(
      '📡 同步状态：已开启\n\n所有设备共享同一份数据，通过 GitHub Gist 云端存储。\n\n点击「确定」断开同步\n点击「取消」关闭'
    );
    if (action) {
      DB.disableSync();
      this.updateStatus('offline');
      showToast('已断开同步连接，使用本地数据');
    }
  },
};

function showToast(msg) {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.className = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.remove('show'), 2800);
}

// ---- Modal 通用 ----
function openModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('show');
}
function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('show');
}

// ---- 导航 ----
document.addEventListener('DOMContentLoaded', () => {
  // 汉堡菜单
  const hamburger = document.querySelector('.hamburger');
  const nav = document.querySelector('.nav');
  if (hamburger) {
    hamburger.addEventListener('click', () => nav.classList.toggle('open'));
  }
  // 点击导航链接后关闭手机菜单
  nav?.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => nav.classList.remove('open'));
  });

  // 模态框遮罩点击关闭
  document.querySelectorAll('.modal-overlay').forEach(el => {
    el.addEventListener('click', (e) => {
      if (e.target === el) el.classList.remove('show');
    });
  });

  // 初始化同步状态指示器
  SyncUI.init();
});

// ---- 数字格式化 ----
function fmtCurrency(v) {
  const n = parseFloat(v);
  if (isNaN(n)) return '-';
  return '¥' + n.toFixed(2);
}
function fmtPercent(v) {
  const n = parseFloat(v);
  if (isNaN(n)) return '-';
  return (n >= 0 ? '+' : '') + n.toFixed(2) + '%';
}
function fmtDate(iso) {
  if (!iso) return '-';
  return new Date(iso).toLocaleDateString('zh-CN');
}
function fmtDateTime(iso) {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}
