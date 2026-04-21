# dragFree

在 **Windows / macOS** 桌面上，把文件拖到 **屏幕热区**，再选 **常用文件夹**（或子目录），完成 **复制 / 移动** 投放；并带 **快开浏览**、热区 **文本与链接暂存**、**导出为 Word（.docx）** 等辅助能力。应用常驻 **系统托盘**，热区可置顶、折叠与多显示器切换。

更完整的使用说明（配置项、快捷键、边界与 Q&A）见：**[docs/user-guide.zh-CN.md](docs/user-guide.zh-CN.md)**（原文较长，日常可先读本 README 的功能列表与打包章节）。

---

## 功能概览

| 方向 | 说明 |
| --- | --- |
| **拖拽投放** | 文件拖入热区 → 目录面板选目标 → 复制或移动；可 **Tab** 临时切换默认处理方式；左下角 **进度 / 结果** 提示。 |
| **常用文件夹** | 配置里维护目标目录，支持排序、子目录 **悬停展开**（延时与冷却可调）。 |
| **快开** | 与 **拖拽模式** 切换（Windows / Linux：**Ctrl+空格**；macOS：**Control+空格**）；热区内容区 **右键** 打开快开窗口浏览目录。 |
| **热区与外观** | 位置与尺寸可调；颜色、透明度、背景图、展示文本与 **多标签页**；可 **导出当前标签页为 .docx**（系统另存为）。 |
| **系统与托盘** | 开机自启动（建议固定安装/目录后再开）、投放成功后可选打开目标文件夹、托盘菜单（配置、更新日志、版权声明、退出）。 |

---

## 环境要求

- **Node.js**（建议当前 LTS）与 **npm**
- 首次 `npm install` 会下载 Electron；若失败，请检查本机网络 / DNS（需能访问 Electron 分发地址）

---

## 从源码运行（开发）

在仓库根目录：

```bash
npm install
npm run start
```

运行测试：

```bash
npm test
```

---

## 自用打包（Windows）

在 **Windows** 电脑上执行（无法在本机为 macOS 产出可用的 `.app`）：

```bash
npm install
npm run build:win
```

- **产物目录**：`dist/`
- **形态**：便携版可执行文件（具体文件名随版本变化，以 `dist` 内为准），配置与数据目录规则见 **[docs/user-guide.zh-CN.md](docs/user-guide.zh-CN.md)** 与程序内说明。

---

## 自用打包（macOS）

必须在 **macOS** 本机执行（签名 / 公证为可选；自用可跳过签名）。

```bash
npm install
# 跳过代码签名（自用、未配置 Apple 开发者证书时）
export CSC_IDENTITY_NONE=true
npm run build:mac
```

- **产物目录**：`dist/mac/` 下的 **`dragFree.app`**（应用名与 `package.json` 中 `build.productName` 一致）
- **首次打开**：未签名的本机构建可能被 **门禁（Gatekeeper）** 拦截。可任选其一：
  - 在 **系统设置 → 隐私与安全性** 中按提示允许；或
  - 在终端对 `.app` 执行（自行确认来源可信后再用）：`xattr -cr "dist/mac/dragFree.app"`
- 若你已配置证书并希望签名 / 公证，请自行设置 `CSC_NAME` 等环境变量并查阅 [electron-builder 文档](https://www.electron.build/)，不在此 README 展开。

---

## 仓库内其他文档

| 文件 | 用途 |
| --- | --- |
| [docs/user-guide.zh-CN.md](docs/user-guide.zh-CN.md) | 完整使用说明（界面、配置、典型路径、Q&A） |
| [AGENTS.md](AGENTS.md) | 面向本仓库协作者的开发与测试约定 |
| [COPYRIGHT_NOTICE.md](COPYRIGHT_NOTICE.md) | 版权声明 |
