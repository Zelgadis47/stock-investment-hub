/* ===== app.js - 共享工具与全局逻辑 ===== */

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
                      || (d.trades && d.trades.length > 0);
        if (hasData) {
          if (d.articles) {
            d.articles.forEach(a => { a.updatedAt = a.updatedAt || a.createdAt; });
            this.setArticles(d.articles);
          }
          if (d.strategies) this.setStrategies(d.strategies);
          if (d.trades) {
            d.trades.forEach(t => { t.profit = this._calcProfit(t); });
            this.setTrades(d.trades);
          }
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
          version: 1,
          lastSyncAt: new Date().toISOString(),
          articles: this.getArticles(),
          strategies: this.getStrategies(),
          trades: this.getTrades(),
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

  // 统计数据
  getStats() {
    const articles = this.getArticles();
    const strategies = this.getStrategies();
    const trades = this.getTrades();
    // 关注股票数（从交易记录中提取唯一股票）
    const stockSet = new Set();
    trades.forEach(t => { if (t.stockName) stockSet.add(t.stockName); });
    return {
      articleCount: articles.length,
      strategyCount: strategies.length,
      tradeCount: trades.length,
      stockCount: stockSet.size,
      recentUpdates: [
        ...articles.map(a => ({ type: 'article', title: a.title, time: a.updatedAt, category: a.category })),
        ...strategies.map(s => ({ type: 'strategy', title: s.name, time: s.createdAt })),
      ].sort((a, b) => new Date(b.time) - new Date(a.time)).slice(0, 5),
    };
  },

  // 初始化示例数据
  initSampleData() {
    if (this.getArticles().length > 0) return; // 已有数据则不初始化

    this.addArticle({
      title: '市盈率（PE）详解：如何判断估值高低',
      category: '基本面分析',
      content: `<h3>什么是市盈率？</h3><p>市盈率（Price-to-Earnings Ratio，简称PE）是衡量股票估值最常用的指标之一。</p><p>计算公式：<b>市盈率 = 股价 / 每股收益（EPS）</b></p><h4>三种类型的市盈率</h4><ul><li><b>静态市盈率</b>：使用上一年度已公布的每股收益</li><li><b>滚动市盈率（PE-TTM）</b>：使用最近四个季度的每股收益</li><li><b>动态市盈率</b>：使用预测的未来每股收益</li></ul><h4>如何判断高低？</h4><p>通常，同行业公司之间比较更有意义。一家公司PE显著低于行业平均，可能被低估，但也可能反映了市场对其未来的悲观预期。</p><p>注意事项：市盈率不适用于亏损企业（负值无意义），且不同行业PE差异巨大（如科技股通常高于银行股）。</p>`,
    });
    this.addArticle({
      title: 'K线图基础：读懂阴阳线',
      category: '技术分析',
      content: `<h3>K线图的构成</h3><p>每根K线包含四个价格信息：<b>开盘价、收盘价、最高价、最低价</b>。</p><ul><li><b>阳线（红色）</b>：收盘价 > 开盘价，表示上涨</li><li><b>阴线（绿色）</b>：收盘价 < 开盘价，表示下跌</li></ul><h4>常见K线形态</h4><ul><li><b>锤子线</b>：下影线长，实体小，可能预示底部反转</li><li><b>十字星</b>：开盘收盘价接近，表示多空力量均衡</li><li><b>吞没形态</b>：阳线实体完全覆盖前一根阴线，看涨信号</li></ul>`,
    });
    this.addArticle({
      title: '如何构建你的交易系统',
      category: '交易心理',
      content: `<h3>交易系统的核心要素</h3><p>一个完整的交易系统应该包含以下部分：</p><ol><li><b>入场规则</b>：什么条件下买入？（技术信号、基本面触发、估值区间等）</li><li><b>出场规则</b>：止盈和止损如何设定？</li><li><b>仓位管理</b>：每次投入多少资金？如何分批建仓？</li><li><b>复盘机制</b>：如何定期回顾和优化系统？</li></ol><h4>常见误区</h4><ul><li>过度优化：历史数据拟合得越完美，未来表现往往越差</li><li>忽视心理因素：再好的系统，无法严格执行也是空谈</li><li>频繁切换策略：每个策略都需要足够样本验证</li></ul>`,
    });
    this.addArticle({
      title: '2024年新能源汽车行业分析',
      category: '行业研究',
      content: `<h3>行业概况</h3><p>新能源汽车行业在2024年继续保持高速增长，渗透率持续提升。</p><h4>关键趋势</h4><ul><li>价格战加剧，行业洗牌加速</li><li>智能化成为差异化竞争焦点</li><li>海外市场拓展成为第二增长曲线</li></ul><h4>投资逻辑</h4><p>关注成本控制能力强、技术储备深厚的龙头企业。上游锂电材料环节关注供需格局变化带来的周期性机会。</p>`,
    });
    this.addArticle({
      title: 'MACD指标实战用法',
      category: '技术分析',
      content: `<h3>MACD基础</h3><p>MACD（指数平滑异同移动平均线）由三部分组成：</p><ul><li><b>DIF线</b>：快线 - 慢线的差值</li><li><b>DEA线</b>：DIF的移动平均</li><li><b>柱状图</b>：DIF与DEA的差值</li></ul><h4>常见交易信号</h4><ul><li><b>金叉</b>：DIF上穿DEA，买入信号</li><li><b>死叉</b>：DIF下穿DEA，卖出信号</li><li><b>顶背离</b>：股价新高但MACD未创新高，警惕见顶</li><li><b>底背离</b>：股价新低但MACD未创新低，关注见底</li></ul>`,
    });

    // 示例策略
    this.addStrategy({
      name: '低估值龙头定投策略',
      logic: '选择PE处于历史低位、ROE连续3年大于15%的行业龙头，在估值分位低于20%时分批建仓，每下跌5%加仓一次，目标估值分位60%以上分批止盈。',
      condition: '大盘处于震荡或下跌末期，市场整体估值偏低',
      status: '跟踪中',
    });
    this.addStrategy({
      name: '财报超预期短线策略',
      logic: '在财报季关注营收和净利润同比增速均超市场预期20%以上的公司，公告后次日开盘介入，持仓5-10个交易日，止损设-5%。',
      condition: '财报季期间，市场情绪偏积极',
      status: '跟踪中',
    });
    this.addStrategy({
      name: '行业ETF网格交易',
      logic: '选取宽基指数ETF或行业ETF，设定5%为网格间距，基准仓位50%，每上涨5%卖出10%，每下跌5%买入10%，震荡市中反复收割波动收益。',
      condition: '市场处于震荡区间，无明显单边趋势',
      status: '已执行',
    });

    // 示例交易记录
    this.addTrade({
      stockName: '中联重科',
      stockCode: '000157',
      buyDate: '2025-11-15',
      buyPrice: 7.64,
      sellDate: '',
      sellPrice: '',
      shares: 1000,
      notes: '工程机械龙头，低估值，计划长期持有',
    });
  },
};

// ---- 数据导出 / 导入 ----
DB.exportAll = function() {
  return JSON.stringify({
    version: 1,
    exportedAt: new Date().toISOString(),
    articles: this.getArticles(),
    strategies: this.getStrategies(),
    trades: this.getTrades(),
  }, null, 2);
};

DB.importAll = function(jsonStr) {
  try {
    const data = JSON.parse(jsonStr);
    if (!data || typeof data !== 'object') throw new Error('格式错误');
    if (data.articles) this.setArticles(data.articles);
    if (data.strategies) this.setStrategies(data.strategies);
    if (data.trades) {
      // 重新计算盈亏
      data.trades.forEach(t => {
        t.profit = this._calcProfit(t);
      });
      this.setTrades(data.trades);
    }
    return { success: true, counts: {
      articles: (data.articles || []).length,
      strategies: (data.strategies || []).length,
      trades: (data.trades || []).length,
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
