/**
 * 我的投资智库 - 启动脚本（含公网隧道）
 * 运行此脚本 = 启动同步服务器 + 创建公网访问地址
 *
 * 使用方式：
 *   npm run tunnel
 *   或: node tunnel.js
 *
 * 环境变量：
 *   PORT=3000        服务器端口
 *   TUNNEL_PORT=     隧道本地端口（默认同 PORT）
 *   SUBDOMAIN=       自定义子域名（可选，如 stockhub）
 */

const http = require('http');
const { spawn } = require('child_process');
const path = require('path');

const PORT = process.env.PORT || 3000;
const SUBDOMAIN = process.env.SUBDOMAIN || '';

// 1. 检查服务是否已启动
function checkServer() {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:${PORT}/api/health`, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data).status === 'ok'); }
        catch { resolve(false); }
      });
    });
    req.on('error', () => resolve(false));
    req.setTimeout(2000, () => { req.destroy(); resolve(false); });
  });
}

async function main() {
  console.log('\n========================================');
  console.log('  📊 我的投资智库 - 一键启动');
  console.log('========================================\n');

  // 检查服务器是否已在运行
  const isRunning = await checkServer();

  if (!isRunning) {
    console.log('  启动同步服务器...');
    const server = spawn(
      process.execPath,
      [path.join(__dirname, 'server.js')],
      { stdio: 'inherit', env: { ...process.env, PORT: String(PORT) } }
    );
    server.on('error', (err) => {
      console.error('  启动服务器失败:', err.message);
      process.exit(1);
    });
    // 等待服务器就绪
    await new Promise((resolve) => setTimeout(resolve, 2000));
    console.log('  ✅ 同步服务器已启动\n');
  } else {
    console.log('  ✅ 同步服务器已在运行\n');
  }

  // 启动 localtunnel
  const args = ['--port', String(PORT), '--print-requests'];
  if (SUBDOMAIN) args.push('--subdomain', SUBDOMAIN);

  console.log('  创建公网隧道...');
  const ltPath = path.join(__dirname, 'node_modules', '.bin', 'lt');
  // Windows 兼容
  const ltCmd = process.platform === 'win32' ? ltPath + '.cmd' : ltPath;

  console.log(`  隧道启动命令: ${ltCmd} --port ${PORT}`);
  console.log('  等待公网地址分配...\n');

  const tunnel = spawn(ltCmd, args, { stdio: 'inherit', cwd: __dirname });

  tunnel.on('error', (err) => {
    if (err.code === 'ENOENT') {
      console.log(`  ⚠️ localtunnel 未找到，尝试 npx...`);
      const npxTunnel = spawn(
        process.platform === 'win32' ? 'npx.cmd' : 'npx',
        ['lt', '--port', String(PORT)],
        { stdio: 'inherit', cwd: __dirname }
      );
      npxTunnel.on('close', (code) => {
        if (code !== 0) {
          console.log(`\n  ❌ 隧道启动失败 (code: ${code})`);
          printLocalInstructions();
        }
      });
    } else {
      console.error('  隧道启动失败:', err.message);
      printLocalInstructions();
    }
  });

  tunnel.on('close', (code) => {
    if (code !== 0) {
      console.log(`\n  隧道进程退出 (code: ${code})`);
      printLocalInstructions();
    }
  });
}

function printLocalInstructions() {
  console.log('\n========================================');
  console.log('  📋 局域网访问说明');
  console.log('========================================');
  console.log();
  console.log('  公网隧道不可用，请使用局域网地址：');
  console.log();
  console.log('  1. 在同一 WiFi/网络的其他设备上打开：');
  console.log(`     http://<本机IP>:${PORT}`);
  console.log();
  console.log('  2. 在页面上点击右下角同步状态指示器');
  console.log(`     输入地址：http://<本机IP>:${PORT}`);
  console.log();
  console.log('  3. 获取本机 IP 的方法：');
  console.log('     Windows: ipconfig | 找 IPv4 地址');
  console.log('     Mac/Linux: ifconfig | ip addr');
  console.log();
  console.log(`  当前服务器已运行于 http://localhost:${PORT}`);
  console.log('========================================\n');
}

main();
