# FLUX Project Manager — 样式设计分析与重设计提示词

## 一、现有设计体系分析

### 1. 设计语言

- **风格**: 深色 Glassmorphism（玻璃拟态）+ 宇宙感渐变
- **定位**: 面向开发者的桌面项目管理工具
- **UI 文案**: 中文为主，英文术语（kicker 标签）混合使用

### 2. 色彩系统

#### 基础色板

| 角色 | 色值 | 用途 |
|------|------|------|
| 背景基底 | `#08101d` → `#0d1627` | 深蓝渐变，最底层 |
| 面板底色 | `rgba(15,24,40,0.92)` + 白 3.5% 渐变 | `.pm-panel` 毛玻璃 |
| 终端/代码底色 | `#07111f` | 终端、diff 查看器、日志流 |

#### 强调色

| 名称 | 色值 | 亮色 | 用途 |
|------|------|------|------|
| 主强调（薄荷绿） | `#62d4b8` | `#8de4d0` | 品牌色，active 状态，tab bar 渐变起点 |
| 信息蓝 | `#79b6ff` | `#9cc8ff` | Frontend 标签，远程分支，info 状态 |
| 警告黄 | `#f0b35f` | `#f7c980` | Python 标签，Git 落后，starting 状态 |
| 危险红 | `#ff8299` | `#ff9eaf` | Java 标签，删除操作，diff 删除行 |
| 紫色 | `#b39cff` | `#c9b8ff` | Monorepo 标签，dev 依赖边 |

#### 文本色

| 层级 | 色值 | 用途 |
|------|------|------|
| primary | `#f4f7fb` | 标题、重要数值 |
| secondary | `#b3c0d5` | 正文、描述 |
| tertiary | `#74839b` | 辅助说明、时间戳、路径 |

#### 项目类型语义色

| 类型 | 色值 | 图标 |
|------|------|------|
| Node.js | `#7fe9ca` | LogoNodejs |
| Frontend | `#79b6ff` | LogoNodejs |
| Python | `#f0b35f` | LogoPython |
| Java | `#ff8299` | LogoAndroid |
| Monorepo | `#b39cff` | GitBranch |

#### 边框与透明度约定

| 元素 | 背景 | 边框 |
|------|------|------|
| 默认面板 | 白 3.5% | `rgba(148,163,184,0.18)` |
| 卡片/行项 | 白 3% | `rgba(148,163,184,0.10)` |
| 药丸/标签 | 白 4% | `rgba(148,163,184,0.14)` |
| 状态高亮（accent） | `rgba(98,212,184,0.12)` | `rgba(98,212,184,0.18~0.28)` |
| Hover 态 | 白 5% | `rgba(148,163,184,0.18)` |
| 分割线 | — | `rgba(148,163,184,0.06~0.14)` |

### 3. 布局结构

#### 整体布局

```
┌─────────────────────────────────────────────────────────┐
│  padding: 18px                                          │
│  ┌──────────┐  gap: 18px  ┌──────────────────────────┐  │
│  │ Sidebar  │              │     Content Area         │  │
│  │ 320px    │              │     1fr (min 0)          │  │
│  │          │              │                          │  │
│  │ Brand    │              │  Hero / Empty State      │  │
│  │ ─────── │              │  Metrics Cards           │  │
│  │ Search   │              │  Tabs                    │  │
│  │ Projects │              │  Tab Content             │  │
│  │ List     │              │                          │  │
│  │ (scroll) │              │                          │  │
│  │ ─────── │              │                          │  │
│  │ Import   │              │                          │  │
│  │ Button   │              │                          │  │
│  └──────────┘              └──────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

- **网格**: `grid-template-columns: 320px minmax(0, 1fr)`
- **外边距**: 18px 全方向
- **间距**: 组件间 14-18px，内部元素 8-12px

#### 响应式断点

| 断点 | 变化 |
|------|------|
| ≤ 1100px | 侧栏缩至 292px，padding 缩至 14px |
| ≤ 880px | 单列堆叠，侧栏在上 |

### 4. 组件设计模式

#### `.pm-panel`（通用面板）

```css
background: linear-gradient(180deg, rgba(255,255,255,0.035), rgba(255,255,255,0.015)),
            rgba(15,24,40,0.92);
border: 1px solid rgba(148,163,184,0.18);
border-radius: 20px;
box-shadow: inset 0 1px 0 rgba(255,255,255,0.04);
```

#### `.pm-kicker`（区域标签）

```css
font-size: 11px;
font-weight: 700;
letter-spacing: 0.16em;
text-transform: uppercase;
color: #8de4d0;
```

#### `.pm-pill`（药丸标签）

```css
display: inline-flex;
padding: 7px 11px;
border-radius: 999px;
background: rgba(255,255,255,0.04);
border: 1px solid rgba(148,163,184,0.14);
color: var(--pm-text-secondary);
font-size: 12px;
```

#### `.pm-empty-state`（空状态）

```css
display: flex;
flex-direction: column;
align-items: center;
justify-content: center;
gap: 10px;
min-height: 220px;
text-align: center;
color: var(--pm-text-secondary);
```

#### 卡片/行项（通用）

```css
border-radius: 16-18px;
background: rgba(255,255,255,0.03);
border: 1px solid rgba(148,163,184,0.10);
transition: background-color 0.16-0.18s ease, border-color 0.16-0.18s ease;
```

#### 状态徽章

```css
display: inline-flex;
height: 24px;
padding: 0 10px;
border-radius: 999px;
font-size: 11px;
font-weight: 700;
```

状态色：running = accent 绿底，starting = 黄底，error = 红底，stopped = 白 8% 底。

#### Tab 栏

Naive UI `type="line"` + `animated`，自定义 tab bar：

```css
height: 3px;
border-radius: 999px;
background: linear-gradient(90deg, #62d4b8, rgba(121,182,255,0.72));
```

#### 终端窗口

仿 macOS 三圆点（红 `rgba(255,130,153,0.72)` / 黄 `rgba(240,179,95,0.82)` / 绿 `rgba(98,212,184,0.82)`），深底 `#07111f`，xterm.js 完整 16 色主题映射。

#### Diff 查看器

行网格 `56px 56px 1fr`（左行号 + 右行号 + 内容），行底色：meta = 蓝调，hunk = 紫调，add = 绿调，remove = 红调。

### 5. 排版体系

| 元素 | 字号 | 字重 | 字间距 | 行高 |
|------|------|------|--------|------|
| 页面大标题 | 24-30px | 800 | -0.04 ~ -0.05em | 1.08-1.1 |
| 面板标题 | 18-20px | 800 | -0.03 ~ -0.04em | — |
| 指标数值 | 18-28px | 800 | — | 1.45 |
| Kicker 标签 | 11px | 700 | 0.12 ~ 0.16em | — |
| 正文 | 13-14px | 400 | 0.01em | 1.6-1.7 |
| 辅助文字 | 12-13px | 400 | — | 1.5-1.65 |
| 代码/路径 | 12-13px | 400 | — | 1.6-1.65 (monospace) |

**字体栈**：
- UI: `"Aptos", "Segoe UI Variable Text", "Microsoft YaHei UI", "PingFang SC", sans-serif`
- Code: `"JetBrains Mono", "Cascadia Code", "Consolas", monospace`

### 6. 阴影体系

| 级别 | 值 | 用途 |
|------|------|------|
| 大 | `0 24px 80px rgba(2,6,23,0.42)` | 内容区 |
| 中 | `0 16px 40px rgba(2,6,23,0.28)` | 侧边栏品牌区 |

### 7. 圆角体系

| Token | 值 | 用途 |
|-------|------|------|
| xl | 28px | — |
| lg | 20px | `.pm-panel` 面板 |
| md | 16px | 卡片、表单行、输入框 |
| sm | 12px | 小元素 |
| 药丸 | 999px | pills、badges、status |
| 代码徽章 | 8-13px | git file badge、file kind |
| 文件行 | 14px | file-node-row |

### 8. 动效

- 仅 hover/active 微交互：`transition 0.16-0.18s ease`
- 背景色 + 边框色 + transform 变化
- ProjectCard hover: `translateY(-1px)` 微位移
- Naive UI Tabs `animated` 切换动画
- 文件夹箭头旋转：`transform: rotate(90deg)`, `transition 0.16s ease`

### 9. 滚动条

```css
*::-webkit-scrollbar { width: 10px; height: 10px; }
*::-webkit-scrollbar-track { background: transparent; }
*::-webkit-scrollbar-thumb {
  background: rgba(148,163,184,0.24);
  border: 2px solid transparent;
  border-radius: 999px;
  background-clip: content-box;
}
*::-webkit-scrollbar-thumb:hover {
  background: rgba(148,163,184,0.38);
}
```

### 10. 背景装饰

```css
body {
  background:
    radial-gradient(circle at top left, rgba(121,182,255,0.16), transparent 28%),
    radial-gradient(circle at top right, rgba(98,212,184,0.14), transparent 30%),
    linear-gradient(180deg, #0c1424 0%, #08101d 100%);
}
```

架构图视口也有类似的径向渐变装饰。

---

## 二、Stitch 重设计提示词

以下内容可直接复制给 Stitch 使用：

---

Design a complete UI redesign for **FLUX Project Manager** — a desktop Electron app (1200×800 window, minimum 900×600) for managing local development projects (Node.js, Python, Java, Monorepo). All UI copy should be in Chinese (简体中文). English is only used for small section labels and technical terms.

### Color System

- **Dark theme only** — this is a premium developer tool
- **Primary accent**: a distinctive color (current is mint green `#62d4b8`, open to change)
- **Project type semantic colors**: Node.js = green, Frontend = blue, Python = yellow, Java = red, Monorepo = purple
- **Status colors**: running = green, starting = yellow, error = red, stopped = gray
- **Text hierarchy**: primary (bright white), secondary (muted), tertiary (dim)
- **Code/terminal areas**: very dark background (`#07111f` or similar) with syntax-colored diff lines

### Pages & Sections to Design

Design all 13 sections below as a single cohesive application. Every section must be complete with realistic Chinese content, proper sample data, and all interactive states (normal, hover, active, disabled, empty state where applicable).

#### 1. App Layout

Left sidebar (320px fixed) + right content area (1fr). 18px outer padding, 18px gap between sidebar and content. The sidebar has a brand area at top, scrollable project list in the middle, and an import button pinned at the bottom. The right side shows an empty state when no project is selected, or a project detail view with tabs.

#### 2. Project Card (sidebar list item)

Shows: colored type icon (38×38px rounded square), project name (14px bold), type badge (pill, e.g. "Node.js"), file path (12px, truncated), metadata row (package manager + date). Three states: normal (subtle background), hover (lighter + translateY micro-shift), active/selected (accent gradient background + accent border).

#### 3. Empty State (no project selected)

Centered in the content area. A large rounded icon box with a subtle radial glow behind it, "Workspace Ready" kicker label, a bold heading (e.g. "先导入一个项目，再开始管理它的命令和代码。"), description text, feature pills row (e.g. "终端执行与重启", "文件树快速打开", "Git 提交与分支查看"), and a prominent CTA button.

#### 4. Project Overview — Hero Section

Project name (30px, extra-bold), type badge tag, file path (13px), metadata pills row (package manager, date, version, workspace/service counts). Right-aligned action button group: Install Dependencies, Start (primary), Stop, Restart.

#### 5. Metrics Cards Row

4 cards in a responsive grid (`auto-fit, minmax(220px, 1fr)`). Each card: uppercase small label (12px), large monospace value (18px), description text (13px secondary). Example cards: 安装命令 (`npm install`), 启动命令 (`npm run dev`), 仓库结构 (单项目工作区), 服务编排 (未配置).

#### 6. Tab Navigation

8 tabs: 概览, 终端(Terminal), 服务(Services), 场景(Scenes), 文件(Files), Git, 架构图(Architecture), 设置(Settings). Custom line-style tab bar with a 3px gradient indicator bar (accent → blue). Tab text is 14px bold in secondary color, active tab gets primary color.

#### 7. Terminal Page

Toolbar row: "Console" kicker + "集成终端" title on left; status pill (green dot + "会话在线" / gray dot + "等待终端") + "新建终端" + "清屏" buttons on right. Below: a terminal frame with macOS-style window dots bar (red/yellow/green circles), path display, and dark terminal area.

#### 8. Git Panel — Top Bar

Branch pill (branch icon + branch name in accent-colored pill), summary pills row (暂存 N, 修改 N, 未追踪 N, 领先 N, 落后 N with color coding), action buttons (Pull, Push, Stash, 刷新). Three sub-tabs below:

**Changes sub-tab**: Split layout — left column (已暂存 section with files, 未暂存 section, 未追踪 section) + commit bar (暂存 count + input + 提交 button); right column (diff preview with file path title, 暂存/取消暂存/丢弃 buttons, diff viewer).

**History sub-tab**: Scrollable commit list — each row: short hash (blue pill), commit message, author + date.

**Branches sub-tab**: Create branch section at top + branch list with current indicator (green checkmark) and 切换 buttons.

#### 9. Services Page — Hero

Title "多服务编排 + 日志中心" + description, pills (服务 N, 运行中 N, 日志 N), buttons (启动全部, 停止全部, 新增服务).

**Split layout** — Left column (service cards): each card shows service name, status badge (启动中/运行中/异常/已停止 with color), "Auto" tag, command (monospace), cwd, action buttons (启动/重启/停止/编辑/删除). Right column (log center): header with search input + stream filter select + auto-scroll switch + 清空日志 button; filter pills per service; scrolling log stream with grid columns (time, service name, stream tag [OUT/ERR/SYS], log message in monospace).

#### 10. File Explorer

Header: "Explorer" kicker + folder name + hint text "单击展开目录，双击文件打开". Recursive tree below: expand arrows, color-coded file-type badges (JSON=yellow, TS=blue, VUE=green, PY=yellow, JAVA=red, etc.), file names. Directory entries sort above files.

#### 11. Architecture Page

Hero (title + package manager pill + 重新分析 button). 4 metric cards row (工作区子包, 运行时依赖, 工具链依赖, 内部引用). Split layout: left main = SVG dependency graph with zoom controls (缩小/100%/适配/放大 + zoom percentage) + legend pills (Root=teal, Workspace=blue, Runtime=blue, Tooling=purple); right sidebar = insights list (rounded cards with description text) + scripts pills row.

**Graph design**: Nodes are 244×104 rounded rects (rx=22), arranged in columns by layer, with label + description. Edges are bezier curves color-coded: runtime=blue, dev=purple, internal=teal. Background is very dark with subtle radial gradient.

#### 12. Workspace Scenes Page

Hero (title + pills showing current tab, saved count, recent scene). Split layout: left = scene editor form (场景名称 input, 说明 textarea, two-column row for 打开面板 select + 目标分支 input, 终端命令 textarea, auto-run switch row with description, 保存场景/取消编辑 buttons); right = saved scene cards list (each card: name, tab badge, description, metadata row with command count/branch/use count/date, apply/edit/delete action buttons).

#### 13. Settings Page

Hero (title + description). Two-column grid: left = terminal preferences form (终端字体 input, 终端字号 number input, 保存设置 button); right = danger zone section (red-tinted border, description text, 清除所有项目数据 button with popconfirm).

### Design Principles

- **Glassmorphic panels**: semi-transparent backgrounds with subtle borders and inset top highlight, large border-radius (16-20px)
- **Typography**: tight letter-spacing (-0.04em) for headings, extra-bold (800) titles, small uppercase kickers (11px, 700 weight, wide letter-spacing) as section labels
- **Pills and badges**: heavily used for metadata display, fully rounded
- **Code areas**: monospace font, very dark background, syntax-colored diff lines
- **Transitions**: subtle and fast (0.16-0.18s ease), only on hover/active state changes
- **Spacing**: consistent 16-18px gaps between major sections, 8-12px between elements within sections
- **Scrollbar**: thin, rounded, semi-transparent thumb on transparent track

### Deliverable

A full, pixel-precise redesign of all 13 sections as a single cohesive dark desktop application. Show all sections in context (not isolated). Include all interactive states. Use realistic Chinese content throughout.
