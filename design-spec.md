# dragFree 设计规格（方案 1）

## 1. 总体架构

- 进程结构：`Electron Main` 负责托盘、窗口生命周期、文件操作调度；`UI Renderer` 负责配置窗和拖拽面板渲染；`Overlay Window` 作为透明无边框置顶热区层，仅接收拖拽事件。
- 窗口模型：启动显示小配置窗；配置完成后隐藏到托盘后台常驻。运行态包含 `ConfigWindow` 与 `OverlayWindow`，拖拽触发时展示 `PanelWindow`。
- 跨平台边界：交互逻辑尽量共用，平台差异收敛到 `PlatformAdapter`（托盘细节、路径差异、权限与打包签名流程）。
- 文件处理流水线：拖拽进入热区 -> 面板滑出 -> 悬停展开目录 -> 松手提交复制/移动 -> 冲突自动重命名。
- 回退策略：拖拽离开有效区域进入取消态，立即关闭面板并释放捕获，不进行任何写入。
- 配置持久化：本地配置保存热区位置、常用目录、默认行为、展开延时、子目录窗口容量、通知策略。

## 2. 核心交互状态机

- `Idle`：热区层常驻监听，不展示目录面板。
- `HotzoneTriggered`：拖拽进入热区后，面板从固定方向滑出。
- `HoverFeedbackActive`：悬停目录项立即放大反馈。
- `ExpandDelayRunning`：在放大反馈后开始计时，默认 `1.5s`。
- `ExpandedLevel`：计时到达后展开一级子目录；继续悬停可重复展开下一层。
- `ScrollableChildren`：子目录超限时使用滚动区域展示固定个数，同时保持父级目录可见。
- `DropCommitted`：在目录项松手后提交文件路由操作（默认复制，可切换移动）。
- `Cancelled`：拖拽超出有效区或进入取消区，收起面板并回归普通拖拽。

## 3. 模块与职责

- `MainProcess`：应用生命周期、托盘菜单、窗口管理、配置入口、路由调度、通知分发。
- `OverlayWindow`：热区命中检测、拖拽坐标上报、取消区判定。
- `PanelWindow`：目录树渲染、即时放大反馈、延时展开、滚动子目录、`+` 新建文件夹入口。
- `FileRouter`：复制/移动执行、冲突自动重命名、批量结果汇总。
- `ConfigStore`：配置校验、读写、版本迁移。
- `NotificationService`：仅通知 `failed` 与 `cancelled`；`success` 静默。

## 4. 数据结构草案

### 4.1 AppConfig

```json
{
  "version": 1,
  "hotzone": { "edge": "top", "sizePx": 64, "cancelRegionPx": 48 },
  "behavior": {
    "defaultAction": "copy",
    "expandDelayMs": 1500,
    "maxVisibleChildren": 8
  },
  "notification": {
    "onSuccess": false,
    "onCancelled": true,
    "onFailed": true
  },
  "folders": []
}
```

### 4.2 PinnedFolder

- `id`: string
- `name`: string
- `path`: string
- `childrenCache`: `FolderNode[]`
- `order`: number
- `enabled`: boolean

### 4.3 DragSession

- `sessionId`: string
- `items`: `DragItem[]`（文件 + 文件夹）
- `state`: `idle | triggered | hoverFeedback | expandDelay | expanded | committed | cancelled`
- `activeFolderId`: string | null
- `hoverStartedAt`: number | null
- `cancelledReason`: `leave-region | esc | timeout | invalid-target | user-abort`

### 4.4 RouteResult

- `status`: `success | partial-failed | failed | cancelled`
- `targetPath`: string | null
- `copiedCount`: number
- `movedCount`: number
- `renamedCount`: number
- `errors`: `{ itemPath: string, reason: string }[]`

### 4.5 冲突策略

- 当前固定规则：`auto-rename`
- 文件：`name.ext` -> `name (1).ext`
- 文件夹：`folder` -> `folder (1)`

## 5. 异常处理与验收标准

### 5.1 异常处理

- 目标不可写/权限不足：`failed`，通知失败原因和目标路径。
- 源文件被占用：继续处理可处理项，最终 `partial-failed`。
- 目标目录失效：刷新目录树；仍无效则失败并回到 `Idle`。
- 拖拽离开有效区：`cancelled`，收面板并通知取消。
- 多屏与缩放变化：重算热区与面板坐标，避免命中偏移。
- 大目录性能：惰性加载 + 缓存 + 固定窗口滚动渲染。

### 5.2 验收标准

- Windows 本地可完成开发验证：托盘常驻、热区触发、滑出面板、悬停放大、1.5s 展开、滚动子目录、复制/移动、冲突重命名。
- 通知规则符合：成功静默；失败与取消通知。
- macOS 发布前必须验证：打包安装、签名、公证与 staple、顶栏行为、通知行为、核心拖拽流程。

## 6. 已确认产品决策（冻结）

- 热区形态：屏幕边缘热区（首版 1 个热区）
- 面板出现：从热区固定方向滑出
- 文件与文件夹：均支持
- 默认行为：可配置，默认复制
- 冲突策略：自动重命名
- 新建文件夹：拖拽到 `+` 后弹输入框命名
- 通知策略：成功不提示；失败和取消提示
