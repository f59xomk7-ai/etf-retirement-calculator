# ETF 退休金試算器

年輕累積族的 ETF 退休距離試算工具。第一版使用 Yahoo Finance chart endpoint 作為原型報價來源，透過本機 Node server 代理 `/api/quotes` 避免瀏覽器 CORS 問題。

## 本機啟動

```powershell
node server.mjs
```

預設網址：

```text
http://localhost:4173
```

## 外網測試

這個專案需要 Node server，因為報價 API 由 `/api/quotes` 代理 Yahoo Finance。短期給朋友測試可以用 Cloudflare Tunnel 或 ngrok 指向 `http://localhost:4173`。

正式一點的測試部署可用 Render、Railway、Fly.io 等支援 Node app 的平台：

- Start command: `npm start`
- Build command: 可留空
- Port: 使用平台提供的 `PORT` 環境變數，`server.mjs` 已支援

## 注意

Yahoo Finance 是非官方原型資料源，可能延遲、暫停或失效。本工具僅供教育與規劃用途，不構成投資建議。
