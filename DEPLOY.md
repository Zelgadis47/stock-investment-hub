# 我的投资智库 - 云端部署指南

## 架构说明

```
你的浏览器 → 云端服务器 (Render.com 免费托管) → GitHub Gist (永久数据存储)
```

所有设备连接同一个云服务器地址，数据统一存储在 GitHub Gist 中，永久保存。

## 前期准备

你需要准备两样东西（都需要 GitHub 账号，注册免费）：

### 1. 创建 GitHub Personal Access Token

1. 登录 https://github.com
2. 右上角头像 → **Settings** → **Developer settings** → **Personal access tokens** → **Fine-grained tokens**
3. 点 **Generate new token**
4. 设置：
   - Token name: `stock-hub-sync`
   - Expiration: 选 **No expiration**（永久有效）
   - Repository access: 选 **Public Repositories only (read-only)**（至少选一个公开仓库）
5. 在 **Permissions** → **Account permissions** → 找到 **Gists** → 选 **Access: Read and Write**
6. 拉到底点 **Generate token**
7. ⚠️ **复制并保存好生成的 token**（页面关闭后不再显示）

### 2. 创建 GitHub Gist

1. 登录后打开 https://gist.github.com
2. **Gist description** 填写：`我的投资智库 - 同步数据`
3. **Filename** 填写：`stock-hub-data.json`
4. 在内容框中填入：`{"version":1,"articles":[],"strategies":[],"trades":[]}`
5. 确保选择 **Create secret gist**（秘密 gist，非公开）
6. 点击 **Create gist**
7. 创建成功后，浏览器地址栏会显示：`https://gist.github.com/你的用户名/一段ID`，复制那段 **ID**

## 部署到 Render

### 方法一：通过 GitHub 仓库部署（推荐）

1. 将 `stock-investment-hub` 项目推送到你的 GitHub 仓库
2. 打开 https://render.com 注册免费账号
3. 点 **New +** → **Web Service**
4. 选择你的仓库
5. 填写配置：
   - **Name**: `stock-investment-hub`
   - **Region**: **Singapore**（新加坡，国内访问较快）
   - **Branch**: `main`
   - **Runtime**: `Node`
   - **Build Command**: `npm install --production`
   - **Start Command**: `node server.js`
   - **Plan**: **Free** ✅
6. 展开 **Advanced**，点 **Add Environment Variable**，添加以下变量：
   - `STORAGE` → `gist`
   - `GIST_ID` → 你的 Gist ID（刚才复制的那段）
   - `GITHUB_TOKEN` → 你的 Personal Access Token
7. 点 **Create Web Service**
8. 等待几分钟部署完成，Render 会分配一个类似 `https://stock-investment-hub.onrender.com` 的地址

### 方法二：直接上传部署（使用 Render Blueprint）

推送项目到 GitHub 后，Render 会自动识别 `render.yaml` 文件：

1. 点击 **New +** → **Blueprint**
2. 选择你的仓库
3. 在 Dashboard 中手动添加环境变量：
   - `GIST_ID`
   - `GITHUB_TOKEN`

## 配置网页同步

部署成功后：
1. 在任何设备的浏览器打开 Render 分配的地址
2. 页面右下角会显示 **⚪ 离线模式**
3. 点击它 → 输入框填入 Render 地址（如 `https://stock-investment-hub.onrender.com`）
4. 点击确定 → **🟢 已同步**

之后你在这台设备上做的任何修改，都会自动同步到所有设备。

---

## ⚠️ 重要提示

**Render 免费计划注意**：
- 15 分钟无人访问后会自动休眠
- 下次访问时需等待约 **30 秒**唤醒
- 数据在 GitHub Gist 中永久保存，不会丢失
- 如果不想有休眠延迟，可升级到付费计划（$7/月起）

## 部署失败排查

| 问题 | 原因 | 解决 |
|------|------|------|
| 部署后访问 503 | GIST_ID 或 GITHUB_TOKEN 未设置 | 检查 Render Dashboard 环境变量 |
| 同步按钮连接失败 | 地址前忘了加 `https://` | 确保填入完整地址 `https://xxx.onrender.com` |
| token 报 403 | Token 权限不足 | 在 GitHub 重新生成 token，确认勾选 Gist 读写权限 |
| Render 需要绑卡 | 部分账户需要验证 | 也可换 Railway.app 部署（步骤类似） |
