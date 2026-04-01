# Release History

## v0.1.1 (from v0.1.0)

- Release commit: `d212ece`
- Release type: PATCH
- Merged commits in this release window:
  - `001f60a` feat(config): 新增拖拽文本换行与文本上限配置
    - 在系统设置新增“拖拽文字追加时默认先换行”开关并持久化。
    - 在系统设置新增“启用文本上限（1000字）”开关；关闭后取消长度限制。
    - 支持拖拽纯文本到热区后自动追加并进入编辑模式。
    - 增加超限截断提示与配置归一化测试。
  - `8488ddd` fix(overlay): 统一标题栏窄宽折叠并修复按钮居中
    - 修复最小宽度下编辑态按钮与标题栏按钮重叠冲突。
    - 统一编辑态与非编辑态的窄宽折叠行为，支持 `...` 下拉操作。

## v0.1.2 (from v0.1.1)

- Release commit: `703ddf5`
- Release type: PATCH
- Merged commits in this release window:
  - `40099cd` fix(overlay): 改进链接拖拽解析并统一展示区安全跳转
    - 增强拖拽链接解析：支持从 `text/plain`、`text/uri-list`、`text/html` 提取链接与锚文本。
    - 展示区将 `http/https` 文本渲染为可点击链接，并通过主进程安全打开外部地址。
    - 配置页补充“关闭换行可能影响链接识别”的风险提示文案。
  - `703ddf5` fix(quick-open): 修复滚动区悬停误触并同步版本记录流程
    - 修复快开目录项悬停定时器未及时清理导致的误下钻问题。
    - 在滚动按钮悬停、列表滚动与目录项离开时统一清理 pending hover，避免误触打开。
    - 同步更新版本流程规则文档，强化提交后记录与版本确认顺序。
    - 本次提交同时完成版本升级 `0.1.1 -> 0.1.2`（PATCH）。

## v0.1.3 (from v0.1.2)

- Release commit: `（待提交）`
- Release type: PATCH
- Merged commits in this release window:
  - `133d9e7` feat(tray): 托盘支持文件化更新日志与版权声明
    - 托盘菜单支持从文件加载完整更新日志与版权声明。
    - 新增 `RELEASE_HISTORY.md` 与 `COPYRIGHT_NOTICE.md`，并加入打包清单。
    - 规则文档中文化并加强提交后版本维护流程。

