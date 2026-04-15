# AGENTS.md

`dragFree` 仓库中的智能编码助手工作规范。

## 项目概览

- 应用类型：Electron 桌面应用。
- 运行时：Node.js + Electron。
- 模块模式：应用代码使用 ESM（`"type": "module"`）；preload 文件使用 CommonJS（`*.cjs`）。
- 入口文件：`src/main/main.js`。
- 主要目录：
  - `src/main/`：应用生命周期、窗口、配置、拖拽会话编排。
  - `src/renderer/`：overlay/panel/config/new-folder 界面。
  - `tests/`：Node 内置测试框架测试集。

## 规则来源

- 已检查 Cursor 规则：
  - `.cursorrules`：不存在
  - `.cursor/rules/`：不存在
- 已检查 Copilot 规则：
  - `.github/copilot-instructions.md`：不存在
- 因此：**本文件是仓库内唯一生效的助手规则来源**。

## 安装 / 运行 / 构建 / 测试

在仓库根目录执行：

```bash
npm install
```

启动应用：

```bash
npm run start
```

运行全部测试：

```bash
npm test
```

构建 Windows 便携包：

```bash
npm run build:win
```

## 单测执行（重要）

本仓库使用 Node 内置测试器（`node --test`）。

单文件测试：

```bash
npm test -- tests/m2/hotzone.test.js
```

等价命令：

```bash
node --test tests/m2/hotzone.test.js
```

多文件测试：

```bash
node --test tests/m2/hotzone.test.js tests/m2/drag-session-controller.test.js
```

按名称过滤：

```bash
node --test --test-name-pattern="hotzone"
```

推荐流程：

1. 先跑最小影响范围的测试文件。
2. 再跑全量测试（`npm test`）。
3. 如果改动涉及配置默认值，必须覆盖 `tests/config/defaults.test.js`。

## Lint / 格式说明

- `package.json` 目前没有 lint 脚本。
- 仓库未发现 ESLint/Prettier 全局配置。
- 代码风格以现有文件风格为准，保持一致即可。

## 代码风格约定

### JavaScript / 模块规范

- `.js` 使用 ESM（`import` / `export`）。
- `.cjs` preload 使用 CommonJS（`require`、`contextBridge`）。
- 优先显式命名导入（如 `electron`、`node:path`、`node:fs/promises`）。
- import 分组顺序：
  1. 外部运行时依赖（如 `electron`）
  2. Node 内置模块（`node:*`）
  3. 本地模块（`./...`）

### 格式

- 字符串使用双引号。
- 保留分号。
- 使用 2 空格缩进。
- 不重排无关代码行。
- 函数尽量保持单一职责、短小清晰。

### 命名

- 函数 / 变量：`camelCase`
- 类：`PascalCase`
- 常量：`UPPER_SNAKE_CASE`
- 命名需体现语义，例如 `dropPulseConfirmSec`、`panelEventsEnabled`。

### 类型与输入校验（非 TS）

- 在边界层对不可信输入做防御与归一化：
  - IPC payload
  - 文件读取配置
  - DOM 事件数据
- 参考 `src/main/config-store.js` 的处理方式：
  - 数值范围 clamp
  - 安全默认值
  - 过滤无效数组项

### 错误处理

- 文件系统、IPC、路由等操作必须用 `try/catch`。
- 可恢复错误应返回安全兜底，不应直接导致 UI 崩溃。
- 渲染层应对可恢复错误给出用户提示。
- preload 层失败时返回空/安全值。
- 主进程保留必要运行日志（`console.info/debug`）。

### IPC 与安全

- 保持 `contextIsolation: true`、`nodeIntegration: false`。
- 仅通过 preload `contextBridge` 暴露最小 API。
- 禁止向 renderer 全局泄露 Node 能力。
- 请求响应优先 `ipcRenderer.invoke`，事件通知用 `send`。

### UI / Renderer 实践

- 保持既有交互契约：
  - 拖拽成功通常静默；
  - 取消/失败可提示；
  - drop target 与 panel 关闭行为是经过测试约束的。
- 优先小范围定点修改，避免大规模 DOM 重构。
- 已有中文文案风格需保持一致。

### 测试规范

- 测试框架：`node:test` + `node:assert/strict`。
- 测试名要表达行为意图（如 `"detects point inside top-edge hotzone"`）。
- 测试数据尽量确定性（明确数值与时序）。
- 状态机改动需覆盖“状态迁移 + 事件发射”。

## 高风险文件（谨慎修改）

- `src/main/main.js`：主编排核心，回归风险高。
- `src/main/drag-session-controller.js`：拖拽生命周期时序敏感。
- `src/main/hotzone.js`：几何命中逻辑。
- `src/main/config-store.js`：默认值与归一化核心。
- `src/renderer/panel-controller.js`：命中测试与交互逻辑密集。

## 助手执行规范

- **三份元文档的提交策略**：`RELEASE_HISTORY.md`、`COMMIT_HISTORY.md`、`AGENTS.md` **仅在维护者需要时再提交**。助手可以按规范**编辑**其内容，但完成常规功能/修复后，**不要**默认将这三份文件与业务代码**同一次** `git add` / `git commit`；除非用户明确要求一并提交。向用户说明提交范围时，应区分「业务提交」与「历史/规范文档（由你按需另提）」。
- 优先最小、精准改动。
- 实现功能时禁止顺带改动无关行为。
- 若新增配置字段，必须同时完成：
  1. 默认值（defaults）
  2. 归一化 / merge
  3. IPC / UI 接线
  4. 测试补齐
- 先跑针对性测试，再跑全量测试。
- 所有由助手产生的版本流程，遵循 `docs/versioning.zh-CN.md`（缺失时看 `docs/versioning.md`）：
  1. **`COMMIT_HISTORY.md` 写入策略（真实 hash，单阶段）**
     - **提交后**：业务代码提交完成后，用 `git rev-parse --short HEAD`（或等价命令）获取**本次提交**的真实短 hash。
     - **写入**：在对应日期段追加一条摘要行（哈希位写真实 short hash；不使用 `` `pending` `` 占位）。
     - **提交策略**：该步骤默认只更新工作区文件，不与业务代码同一次 `git add` / `git commit`；除非用户明确要求把历史文件与业务代码一并提交。
  2. 若用户要求某次提交**不写入** `COMMIT_HISTORY.md`（例如回退到某版本且不在历史中保留该条），按用户指示处理；常规功能/修复提交仍应记录摘要。
  3. `COMMIT_HISTORY.md` 在同一日期段内必须严格按时间顺序（旧 -> 新）。
  4. 每条摘要尽量 **一行**，只写增改了什么，与 `COMMIT_HISTORY.md` 顶部收录规则一致；不写冗长分号链或实现细节。
  5. `COMMIT_HISTORY.md` 只记录正常功能/修复提交，不记录 release 提交项。
  6. **历史文档收录排除**：不将**仅**变更 `RELEASE_HISTORY.md`、`COMMIT_HISTORY.md`、`AGENTS.md`（可单独或组合）的维护性提交写入 `COMMIT_HISTORY.md` 与 `RELEASE_HISTORY.md` 的版本窗口摘要；Git 对象仍保留。若同一次提交除上述文件外还包含功能/修复代码或 `package.json` 版本变更，则照常收录并在摘要中写清业务含义（及版本变化，如有）。
  7. “下次升版本需合并的提交数”以“最后一次版本记录之后的正常提交”顺序统计，禁止主观估算。
  8. 然后询问用户是否升版本。
  9. 给出升版本建议（`MAJOR` / `MINOR` / `PATCH`）与理由。
  10. 改版本前先确认自上个 release 以来是否存在多次提交。
  11. 若存在多次提交，先合并为一条 release 摘要，再统一升一次版本。
  12. 未获用户明确确认，禁止修改 `package.json` 版本号。
  13. 任务结束前按以下顺序做最终检查：
      - 本次工作对应的摘要已写入 `COMMIT_HISTORY.md`（使用真实 short hash）
      - 版本升级决策已获用户确认
      - 若版本变更：`package.json` 与 `RELEASE_HISTORY.md` 已同步（用于打包/更新日志展示）
      - 若版本变更：`RELEASE_HISTORY.md` 已记录“版本变更信息 + 版本窗口内所有提交摘要”，且不写 release commit 字段
  14. **`npm run build:win` 成功即视为打包完成**：不要求助手再解压 `app.asar`、核对 `RELEASE_HISTORY.md` 是否打入包内、或手动运行安装包做验货；除非用户明确要求。
  15. **`RELEASE_HISTORY.md` 排序规则（倒序）**：
      - 版本窗口按 **新版本在上、旧版本在下**（倒序）排列。
      - 每个版本窗口内的「窗口内提交摘要」仍按 **时间由旧到新** 排列（与既有条目风格一致）。
  

## 已知运行注意事项

- 受限网络环境下，Electron 二进制下载可能失败，导致打包失败。
- 若 `npm run start` 因 Electron 下载/代理问题失败，请先排查本机网络与 DNS。
