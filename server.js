/**
 * 我的投资智库 - 数据同步服务器
 * 提供跨设备数据自动同步功能
 *
 * 两种模式：
 *   1. 本地模式（默认）：数据存储在 data/sync-data.json
 *   2. 云端模式：数据通过 GitHub Gist API 永久存储
 *
 * 启动方式：
 *   npm start                # 本地模式
 *   GIST_ID=xxx GITHUB_TOKEN=xxx npm start   # 云端模式
 *
 * 环境变量：
 *   PORT           监听端口（默认 3000）
 *   DATA_DIR       数据存储目录（本地模式，默认 ./data）
 *   GIST_ID        GitHub Gist ID（云端模式必填）
 *   GITHUB_TOKEN   GitHub Personal Access Token（云端模式必填）
 *   STORAGE        强制指定存储模式："local" 或 "gist"
 */

const express = require('express');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const GIST_ID = process.env.GIST_ID || '';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';

// 判断存储模式
const useGist = (process.env.STORAGE === 'gist') || (!!GIST_ID && !!GITHUB_TOKEN);

// ===== 存储后端抽象 =====

let storageBackend;

// ---- 本地文件存储 ----
function createLocalBackend() {
  const DATA_DIR = path.resolve(__dirname, process.env.DATA_DIR || './data');
  const DATA_FILE = path.join(DATA_DIR, 'sync-data.json');

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  let writeLock = false;
  const lockQueue = [];

  function acquireLock() {
    return new Promise((resolve) => {
      if (!writeLock) { writeLock = true; resolve(true); }
      else lockQueue.push(resolve);
    });
  }
  function releaseLock() {
    if (lockQueue.length > 0) lockQueue.shift()(true);
    else writeLock = false;
  }

  // 初始化空数据文件
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({ version: 1, articles: [], strategies: [], trades: [] }), 'utf-8');
    console.log('[本地存储] 已创建数据文件:', DATA_FILE);
  }

  return {
    name: '本地文件',
    info: `数据文件: ${DATA_FILE}`,
    async read() {
      try {
        if (fs.existsSync(DATA_FILE)) {
          return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
        }
      } catch (e) { console.error('读取数据失败:', e.message); }
      return null;
    },
    async write(data) {
      await acquireLock();
      try {
        const tmpFile = DATA_FILE + '.tmp';
        fs.writeFileSync(tmpFile, JSON.stringify(data, null, 2), 'utf-8');
        fs.renameSync(tmpFile, DATA_FILE);
        return true;
      } catch (e) {
        console.error('写入数据失败:', e.message);
        return false;
      } finally { releaseLock(); }
    },
  };
}

// ---- GitHub Gist 云存储 ----
function createGistBackend() {
  const GIST_API = `https://api.github.com/gists/${GIST_ID}`;
  const FILENAME = 'stock-hub-data.json';
  const HEADERS = {
    Authorization: `Bearer ${GITHUB_TOKEN}`,
    Accept: 'application/vnd.github+json',
    'User-Agent': 'stock-investment-hub-server',
  };

  console.log('[云存储] 使用 GitHub Gist:', GIST_ID);

  return {
    name: 'GitHub Gist',
    info: `Gist ID: ${GIST_ID}`,
    async read() {
      try {
        const resp = await fetch(GIST_API, { headers: HEADERS });
        if (!resp.ok) {
          console.error(`[云存储] 读取失败: ${resp.status} ${resp.statusText}`);
          return null;
        }
        const gist = await resp.json();
        const file = gist.files?.[FILENAME];
        if (file && file.content) {
          const data = JSON.parse(file.content);
          return data;
        }
        return null;
      } catch (e) {
        console.error('[云存储] 读取异常:', e.message);
        return null;
      }
    },
    async write(data) {
      try {
        const body = {
          files: {
            [FILENAME]: { content: JSON.stringify(data, null, 2) }
          }
        };
        const resp = await fetch(GIST_API, {
          method: 'PATCH',
          headers: { ...HEADERS, 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!resp.ok) {
          console.error(`[云存储] 写入失败: ${resp.status} ${resp.statusText}`);
          return false;
        }
        return true;
      } catch (e) {
        console.error('[云存储] 写入异常:', e.message);
        return false;
      }
    },
  };
}

// 选择存储后端
storageBackend = useGist ? createGistBackend() : createLocalBackend();

// 初始化：确保数据文件存在
(async () => {
  const existing = await storageBackend.read();
  if (!existing) {
    await storageBackend.write({
      version: 1,
      lastSyncAt: new Date().toISOString(),
      articles: [],
      strategies: [],
      trades: [],
    });
    console.log(`[初始化] 已创建空数据（${storageBackend.name}）`);
  }
})();

// ===== Express 服务器 =====

const app = express();
app.use(express.json({ limit: '5mb' }));

// CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// 写锁（防并发冲突）
let writeLock = false;
const lockQueue = [];
function acquireLock() {
  return new Promise((resolve) => {
    if (!writeLock) { writeLock = true; resolve(true); }
    else lockQueue.push(resolve);
  });
}
function releaseLock() {
  if (lockQueue.length > 0) lockQueue.shift()(true);
  else writeLock = false;
}

// GET /api/data - 获取所有数据
app.get('/api/data', async (req, res) => {
  const data = await storageBackend.read();
  if (data) {
    res.json({ success: true, data, storage: storageBackend.name });
  } else {
    res.status(503).json({ success: false, error: '读取数据失败' });
  }
});

// POST /api/data - 保存数据
app.post('/api/data', async (req, res) => {
  const clientData = req.body;
  if (!clientData || typeof clientData !== 'object') {
    return res.status(400).json({ success: false, error: '数据格式错误' });
  }

  const payload = {
    version: 1,
    lastSyncAt: new Date().toISOString(),
    articles: clientData.articles || [],
    strategies: clientData.strategies || [],
    trades: clientData.trades || [],
  };

  await acquireLock();
  try {
    const ok = await storageBackend.write(payload);
    if (ok) {
      res.json({ success: true, message: '数据已同步', syncTime: payload.lastSyncAt });
    } else {
      res.status(500).json({ success: false, error: '写入数据失败' });
    }
  } finally {
    releaseLock();
  }
});

// GET /api/health - 健康检查
app.get('/api/health', async (req, res) => {
  const data = await storageBackend.read();
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    storage: storageBackend.name,
    records: data ? {
      articles: (data.articles || []).length,
      strategies: (data.strategies || []).length,
      trades: (data.trades || []).length,
    } : null,
  });
});

// ===== 静态文件服务 =====
app.use(express.static(__dirname));

// SPA 友好：所有未匹配路由返回 index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ===== 启动 =====
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n========================================`);
  console.log(`  📊 我的投资智库 - 同步服务器已启动`);
  console.log(`========================================`);
  console.log(`  存储模式: ${storageBackend.name}`);
  console.log(`  ${storageBackend.info}`);
  console.log(`  本地访问: http://localhost:${PORT}`);
  console.log(`========================================\n`);
});
