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
