# 实时语音同传学习助手

该仓库提供基于文档落地的最小可运行原型：Node.js 网关 + 浏览器前端音频采集/播放框架，方便后续接入火山引擎 AST。

## 本地启动

```bash
npm install
npm run start
```

默认端口 `8787`，访问前端时可使用任意静态服务器：

```bash
python -m http.server 5173 -d web
```

浏览器打开 `http://localhost:5173`。

## 环境变量

复制 `.env.example` 并填写火山引擎 AST 鉴权信息：

- `AST_APP_KEY`
- `AST_ACCESS_KEY`
- `AST_RESOURCE_ID` (默认 `volc.service_type.10053`)

> 若未配置鉴权，网关会返回连接错误提示。
