/* ===== charts.js - ECharts 通用图表组件库 ===== */
// 依赖：ECharts 5.x（页面需先引入 echarts.min.js）

const Charts = {
  _instances: {},

  // 销毁实例
  dispose(id) {
    if (this._instances[id]) {
      this._instances[id].dispose();
      delete this._instances[id];
    }
  },

  // 通用初始化
  _init(id, option) {
    const el = typeof id === 'string' ? document.getElementById(id) : id;
    if (!el) return null;
    this.dispose(id);
    const chart = echarts.init(el);
    chart.setOption(option);
    this._instances[id] = chart;
    // 响应式
    window.addEventListener('resize', () => { if (!chart.isDisposed()) chart.resize(); });
    return chart;
  },

  // ===== 饼图 =====
  pie(id, data, opts = {}) {
    // data: [{ name, value, itemStyle? }]
    const option = {
      tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
      legend: { bottom: 0, type: 'scroll', textStyle: { fontSize: 11 } },
      series: [{
        type: 'pie',
        radius: opts.radius || ['40%', '70%'],
        center: opts.center || ['50%', '45%'],
        avoidLabelOverlap: true,
        itemStyle: { borderRadius: 6, borderColor: '#fff', borderWidth: 2 },
        label: { show: opts.showLabel !== false, fontSize: 11 },
        emphasis: { label: { show: true, fontSize: 14, fontWeight: 'bold' } },
        data: data,
      }],
      color: opts.colors || ['#1e88e5', '#00c853', '#ffab00', '#ff1744', '#7b1fa2', '#00897b', '#f57c00', '#5e35b1'],
    };
    return this._init(id, option);
  },

  // ===== 折线图（净值曲线） =====
  line(id, series, opts = {}) {
    // series: [{ name, data: [[date, value], ...] or {dates:[], values:[]}, color? }]
    // 或简化：{ dates: [], values: [{name, data:[]}] }
    let xAxisData, seriesData;
    if (series.dates) {
      xAxisData = series.dates;
      seriesData = series.values;
    } else {
      const dates = series[0]?.data?.map(d => Array.isArray(d) ? d[0] : d) || [];
      xAxisData = dates;
      seriesData = series.map(s => ({
        name: s.name,
        type: 'line',
        data: s.data.map(d => Array.isArray(d) ? d[1] : d),
        smooth: opts.smooth !== false,
        symbol: opts.showSymbol ? 'circle' : 'none',
        symbolSize: 4,
        lineStyle: { width: 2, color: s.color },
        itemStyle: { color: s.color },
        areaStyle: opts.area ? { opacity: 0.15 } : undefined,
      }));
    }

    const option = {
      tooltip: { trigger: 'axis', formatter: (params) => {
        let html = `<div style="font-size:11px;color:#666;">${params[0].axisValue}</div>`;
        params.forEach(p => {
          const val = typeof p.value === 'number' ? p.value.toLocaleString('zh-CN', {maximumFractionDigits: 2}) : p.value;
          html += `<div style="color:${p.color};font-size:12px;">${p.seriesName}: <b>${val}</b></div>`;
        });
        return html;
      }},
      legend: { top: 5, textStyle: { fontSize: 11 } },
      grid: { left: '3%', right: '3%', bottom: '3%', top: '15%', containLabel: true },
      xAxis: { type: 'category', data: xAxisData, boundaryGap: false, axisLabel: { fontSize: 10 } },
      yAxis: {
        type: 'value',
        axisLabel: { fontSize: 10, formatter: (v) => opts.yFormat ? opts.yFormat(v) : v.toLocaleString() },
        splitLine: { lineStyle: { type: 'dashed', color: '#eee' } },
      },
      series: seriesData,
    };
    return this._init(id, option);
  },

  // ===== 回撤曲线（负值区域图） =====
  drawdown(id, dates, values) {
    const option = {
      tooltip: { trigger: 'axis', formatter: (params) => {
        return `<div style="font-size:11px;">${params[0].axisValue}<br/><span style="color:#ff1744;">回撤: ${params[0].value.toFixed(2)}%</span></div>`;
      }},
      grid: { left: '3%', right: '3%', bottom: '3%', top: '8%', containLabel: true },
      xAxis: { type: 'category', data: dates, axisLabel: { fontSize: 10 } },
      yAxis: { type: 'value', max: 0, axisLabel: { fontSize: 10, formatter: '{value}%' }, splitLine: { lineStyle: { type: 'dashed', color: '#eee' } } },
      series: [{
        type: 'line',
        data: values,
        smooth: true,
        symbol: 'none',
        lineStyle: { color: '#ff1744', width: 1.5 },
        areaStyle: { color: 'rgba(255,23,68,0.15)' },
      }],
    };
    return this._init(id, option);
  },

  // ===== 柱状图 =====
  bar(id, categories, series, opts = {}) {
    // series: [{ name, data: [], color? }]
    const option = {
      tooltip: { trigger: 'axis' },
      legend: { top: 5, textStyle: { fontSize: 11 } },
      grid: { left: '3%', right: '3%', bottom: '3%', top: '15%', containLabel: true },
      xAxis: { type: 'category', data: categories, axisLabel: { fontSize: 10, rotate: opts.rotate || 0 } },
      yAxis: { type: 'value', axisLabel: { fontSize: 10 }, splitLine: { lineStyle: { type: 'dashed', color: '#eee' } } },
      series: series.map(s => ({
        name: s.name,
        type: 'bar',
        data: s.data,
        itemStyle: { color: s.color, borderRadius: [4, 4, 0, 0] },
        barMaxWidth: 40,
      })),
    };
    return this._init(id, option);
  },

  // ===== 仪表盘 =====
  gauge(id, value, opts = {}) {
    // value: 0-100
    const option = {
      series: [{
        type: 'gauge',
        startAngle: 180,
        endAngle: 0,
        min: 0,
        max: 100,
        progress: { show: true, width: 14 },
        axisLine: { lineStyle: { width: 14, color: [[0.3, '#ff1744'], [0.7, '#ffab00'], [1, '#00c853']] } },
        pointer: { width: 5, length: '60%' },
        axisTick: { show: false },
        splitLine: { length: 10, lineStyle: { color: '#fff', width: 2 } },
        axisLabel: { fontSize: 9, distance: 18, color: '#999' },
        detail: { valueAnimation: true, formatter: '{value}', fontSize: 24, offsetCenter: [0, '20%'], color: opts.color || '#333' },
        title: { offsetCenter: [0, '60%'], fontSize: 12, color: '#666' },
        data: [{ value: Math.round(value), name: opts.title || '' }],
      }],
    };
    return this._init(id, option);
  },
};
