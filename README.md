# dragFree

当前已完成：

- M1：托盘常驻、配置窗口显示/隐藏、配置默认值落地
- M2：热区状态机、取消区判定、Overlay/Panel 窗口骨架、事件编排
- M3：悬停立即放大、1.5s 延时展开控制器、子目录窗口化滚动

## 本地运行

```bash
npm install
npm run start
```

## 运行测试

```bash
npm test
```

## M2 新增测试覆盖

- `tests/m2/hotzone.test.js`
- `tests/m2/drag-session-controller.test.js`

## M3 新增测试覆盖

- `tests/m3/hover-expand-controller.test.js`
- `tests/m3/folder-windowing.test.js`

## 当前状态

- 已完成 M1-M3 的逻辑层与交互骨架。
- M4-M5（文件路由、打包发布）尚未开始。

## 运行说明（当前环境）

如果 `npm run start` 失败且提示 Electron 下载错误，请先修复本机网络/DNS（例如 `github.com` 被解析到 `127.0.0.1`）后重试安装依赖。
