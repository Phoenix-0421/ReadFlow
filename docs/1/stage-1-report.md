# ReadFlow 阶段一报告：项目初始化与基础页面搭建

| 项目 | 内容 |
| --- | --- |
| 报告日期 | 2026-10-14 |
| 项目路径 | `D:\项目\ReadFlow` |
| 报告范围 | 本阶段仅做**检查与总结**：未修改任何项目代码、未安装依赖、未删除文件 |
| 唯一新增文件 | `docs/stage-1-report.md`（即本报告） |

> 说明：本报告对应开发协作协议中的「项目初始化与基础页面搭建」阶段，是整个项目的**第一个开发阶段**。

---

## 一、项目基础信息

### 1. 项目名称与当前阶段目标

**ReadFlow** —— 个人阅读追踪 Web 应用（React + TypeScript）。

**本阶段目标**：搭起一个能正常运行的工程骨架，包含四个核心页面的基础结构与统一的页面布局，页面之间可以正常跳转。

**本阶段不做**：不接入任何业务数据，不调用 API，不读写 localStorage。

### 2. 实际使用的技术栈及版本

| 技术 | package.json 声明 | 实际安装版本 |
| --- | --- | --- |
| React | `^19.2.8` | **19.3.0** |
| React DOM | `^19.2.8` | **19.3.0** |
| TypeScript | `~6.0.2` | **6.0.3** |
| Vite | `^8.3.0` | **8.3.4** |
| react-router | `^8.4.0` | **8.4.0** |
| @vitejs/plugin-react | `^6.1.1` | 6.1.2 |
| oxlint（代码检查） | `^1.81.0` | 1.88.0 |
| @types/react | `^19.2.18` | 19.3.0 |
| @types/react-dom | `^19.2.7` | 19.3.0 |
| @types/node | `^24.13.3` | 24.19.2 |

react-router 自带的传递依赖：`cookie-es@3.1.1`、`@remix-run/route-pattern@0.22.1`。

**补充说明：**

- **样式方案是普通 CSS**，没有引入 Tailwind、CSS 框架、UI 组件库或图标库。
- 运行环境：**Node v24.13.0**、**npm 11.6.2**。
- React Router 的包名是 `react-router`（v7 起就改成了这个名字，不再是 v6 时代的 `react-router-dom`），路由写法统一使用 v8 的**声明式 API**，没有混用旧版本写法。

### 3. 当前项目的启动方式

```powershell
cd D:\项目\ReadFlow
npm install     # 首次使用或依赖变动后执行
npm run dev     # 启动开发服务器，默认地址 http://localhost:5173/
```

其他常用命令：

```powershell
npm run build    # 类型检查 + 生产构建（tsc -b && vite build）
npm run preview  # 本地预览构建产物
npm run lint     # 代码检查（oxlint）
```

---

## 二、项目目录结构

### 1. 当前目录结构

```
D:\项目\ReadFlow\
├─ index.html                HTML 入口
├─ package.json              依赖与脚本
├─ package-lock.json         依赖锁定文件
├─ tsconfig.json             TS 配置总入口（引用下面两个）
├─ tsconfig.app.json         应用源码的 TS 配置
├─ tsconfig.node.json        构建配置文件的 TS 配置
├─ vite.config.ts            Vite 配置
├─ .oxlintrc.json            代码检查规则
├─ README.md                 模板自带说明（未改动）
├─ public\                   原样输出的静态资源
│  ├─ favicon.svg
│  └─ icons.svg
├─ dist\                     构建产物（由 npm run build 自动生成）
└─ src\
   ├─ main.tsx               应用入口
   ├─ App.tsx                路由表
   ├─ App.css                应用外壳与页面通用样式
   ├─ index.css              全局样式：设计变量、重置、基础排版
   ├─ assets\                模板遗留图片（当前已未被引用）
   │  ├─ hero.png
   │  ├─ react.svg
   │  └─ vite.svg
   ├─ components\
   │  └─ AppLayout.tsx       公共布局：导航栏 + 页面主体容器
   └─ pages\
      ├─ HomePage.tsx        首页
      ├─ ShelfPage.tsx       我的书架
      ├─ SearchPage.tsx      书籍搜索
      └─ BookDetailPage.tsx  书籍详情
```

> 另有 `.readflow-backup-20261014-153113\` 一个备份目录，存放改写前的模板原文件，确认无误后可以删除。

### 2. 关键文件的作用

| 文件 | 作用 |
| --- | --- |
| `index.html` | 页面骨架。里面只有一个 `<div id="root">` 和一个加载 `/src/main.tsx` 的 `<script type="module">`。React 会把整个界面渲染进这个空 div 里。 |
| `src/main.tsx` | **应用入口**。把 React 应用挂载到 DOM 上，并用 `<BrowserRouter>` 提供路由能力。 |
| `src/App.tsx` | **路由配置**。只做一件事：声明「哪个网址显示哪个页面」。 |
| `src/components/AppLayout.tsx` | **公共布局**。顶部导航栏 + 页面主体容器，通过 `<Outlet />` 把当前页面塞进主体区域。 |
| `src/pages/` 下 4 个文件 | **页面组件**。每个文件对应一个页面，只负责自己页面的内容和样式类名。 |
| `src/index.css` | **全局样式**。定义整套设计变量（颜色、间距、圆角）、浏览器默认样式重置、基础排版。 |
| `src/App.css` | **外壳与通用样式**。导航栏、页面主体容器、统计卡片、面板、按钮、搜索栏、响应式断点。 |
| `tsconfig.app.json` | **应用源码的 TypeScript 配置**。本阶段显式加入了 `"strict": true`。 |
| `tsconfig.node.json` | 构建配置文件（`vite.config.ts`）的 TypeScript 配置，同样开启了 strict。 |
| `tsconfig.json` | 总入口，本身不含代码，只引用上面两个子配置。 |
| `vite.config.ts` | Vite 配置，目前只启用了 React 插件。 |
| `.oxlintrc.json` | oxlint 的检查规则配置。 |

### 3. 页面组件之间的关系，以及路由如何组织

**组件层级关系：**

```
main.tsx
└─ <BrowserRouter>          提供路由能力
   └─ <App />               路由表
      └─ <AppLayout />      公共布局（导航栏 + <main>）
         └─ <Outlet />      占位符：当前网址对应的页面渲染在这里
            ├─ <HomePage />        网址 /
            ├─ <ShelfPage />       网址 /shelf
            ├─ <SearchPage />      网址 /search
            └─ <BookDetailPage />  网址 /books/:id
```

**关键理解点：**

- 四个页面**不是互不相干的独立组件**，它们全都是 `AppLayout` 的子内容。切换网址时，导航栏不会重建，只有 `<Outlet />` 里面的内容被替换 —— 这就是「公共布局复用」的实现方式。
- 这四个页面之间**互相不知道对方存在**，它们之间的跳转全部靠 URL 完成（例如书架页里的「前往书籍搜索」按钮只是跳到 `/search`）。
- 路由表里 `/books/:id` 的 `:id` 是**动态段**，代表「这里放任意值」。访问 `/books/abc` 和 `/books/OL45804W` 都是同一个页面组件，只是取到的参数不同。

---

## 三、已完成的功能

> 以下每一项都在代码中确实存在，可以对照文件核对。

### 1. 项目初始化

- 使用 Vite 官方 React + TypeScript 模板建立工程，`npm install` 可正常安装，`npm run dev` 可正常启动。
- 配置了 `react-router@8.4.0` 依赖。
- **显式开启了 TypeScript strict 模式**（原模板未开启）：`tsconfig.app.json` 与 `tsconfig.node.json` 中都加入了 `"strict": true`。

### 2. React Router 路由配置

- 配置了 4 条路由：

| 网址 | 页面 |
| --- | --- |
| `/` | 首页 |
| `/shelf` | 我的书架 |
| `/search` | 书籍搜索 |
| `/books/:id` | 书籍详情（动态参数） |

- 采用「布局路由 + 子路由」的组织方式，四条路由共享同一个 `AppLayout`。
- 页面跳转使用 `<Link>` / `<NavLink>`，**不刷新整个页面**。

### 3. 四个页面的基础框架

| 页面 | 已实现的内容 |
| --- | --- |
| 首页 | 页面标题、一句话说明；三张状态统计卡片（想读 / 正在读 / 已读完，数值为占位符 `—`）；「正在阅读」「最近完成」两个占位面板 |
| 我的书架 | 页面标题与说明；四个静态筛选标签（全部 / 想读 / 正在读 / 已读完）；空书架提示；跳转到搜索页的按钮 |
| 书籍搜索 | 页面标题与说明；**禁用状态**的搜索输入框与搜索按钮；空结果占位面板 |
| 书籍详情 | 页面标题与说明；显示从网址取的书籍 ID；「返回我的书架」链接 |

### 4. 公共导航栏与页面布局

- 顶部导航栏：左侧是 ReadFlow 品牌名（可点击回首页），右侧是四个页面入口。
- **当前所在页面会高亮**：靠 `NavLink` 提供的激活状态自动加样式类。
- 页面主体容器居中对齐、限宽 1040px，上下留白。
- 导航栏吸顶（`position: sticky`）。

### 5. 基础样式与占位内容

- 全局设计变量集中在 `src/index.css`：颜色、间距、圆角、字体族、内容宽度，都定义成了 CSS 变量（如 `--color-accent`、`--space-5`）。
- 视觉风格：柔和中性底色（`#f6f5f2`）+ 白色卡片 + 墨绿色强调色（`#3f6b58`）。
- 通用样式类：卡片（`.stat-card`）、面板（`.panel`）、按钮（`.button`）、状态标签（`.chip`）、搜索栏（`.search-bar`）。
- 响应式：窗口宽度 ≤ 720px 时，统计卡片改为单列，搜索框与按钮改为上下排列。

---

## 四、关键代码说明

### 1. React 应用如何启动和挂载

`src/main.tsx` 是整个应用的起点，它做三件事：

1. 从 `react-dom/client` 拿到 `createRoot` 函数；
2. 用 `document.getElementById('root')` 找到 `index.html` 里那个空 div；
3. 把 `<App />` 渲染进去。

值得一提的是它外面包了两层：

- `<StrictMode>` —— React 的开发模式检查。它会在开发环境**故意把某些生命周期执行两次**，用来暴露「副作用写得不对」的问题。这解释了为什么有时控制台里一次请求会打两次 —— 这是正常的，不是 Bug。
- `<BrowserRouter>` —— 由 React Router 提供。它的作用是**让整个应用能感知网址变化**。所有用到路由功能的组件（`<Routes>`、`<Link>`、`useParams` 等）都必须放在它内部，否则会直接报错。

### 2. 路由如何配置，访问不同路径时如何显示对应页面

`src/App.tsx` 是路由表，结构如下（示意）：

```tsx
<Routes>
  <Route element={<AppLayout />}>
    <Route path="/" element={<HomePage />} />
    <Route path="/shelf" element={<ShelfPage />} />
    ...
  </Route>
</Routes>
```

几个要点：

- `<Routes>` 是「路由器」：它在所有 `<Route>` 中挑出**和当前网址最匹配**的那一条，只渲染那一条对应的页面。
- 外层那条 `<Route>` **没有写 `path`**，这叫「布局路由」。它表示：不管匹配到哪条子路由，都先用 `AppLayout` 作为外层容器。
- `element={<HomePage />}` 是把组件**作为值传进去**，而不是直接写 `<HomePage />`。这是 React Router 的写法约定：它在需要的时候才会真正渲染这个组件。
- 访问 `/books/OL45804W` 时，`:id` 会匹配到 `OL45804W`，页面里用 `useParams()` 就能把它取出来。

### 3. 公共布局如何复用

`src/components/AppLayout.tsx` 用一个特殊组件 `<Outlet />` 实现了复用：

```tsx
<header> ……导航栏…… </header>
<main className="site-main">
  <Outlet />
</main>
```

`<Outlet />` 可以理解成**一个占位符**，意思是「当前匹配到的子页面，渲染在这个位置」。

这样设计的好处：

- 导航栏、页面主体容器只写一次，四个页面都能用；
- 切换页面时，**导航栏组件不会被销毁重建**，只有 `<Outlet />` 里面的内容被替换，所以切换非常快；
- 将来要加页脚、侧边栏，只需要改 `AppLayout` 一个文件。

导航高亮的实现是 `<NavLink>` 的一个特性：它接收一个函数作为 `className`，函数参数里有 `isActive`（布尔值，表示当前网址是否匹配这个链接），根据它决定要不要加上高亮样式类。

### 4. TypeScript 在当前项目中发挥了什么作用

本项目的 TypeScript 全部通过 `tsconfig.app.json` 控制，并且开启了 `strict: true`。它主要在下面几处起作用：

| 位置 | 作用 |
| --- | --- |
| `type NavItem = { to: string; label: string; end?: boolean }` | 给导航项定义了一个「数据结构说明书」。如果有人写 `{ to: '/x' }` 漏了 `label`，编辑器会立刻标红。 |
| `const NAV_ITEMS: NavItem[]` | 声明这个数组里每一项都必须符合 `NavItem` 的形状，写错字段名会被发现。 |
| `useParams<{ id: string }>()` | 泛型：告诉 TypeScript「这个路由参数里有一个叫 id 的字段，类型是字符串」。这样使用 `id` 时编辑器能给出正确提示。 |
| `noUnusedLocals` / `noUnusedParameters`（编译选项） | 拦住「定义了却没用到」的变量与函数参数，避免留下垃圾代码。 |
| `strict: true` | 开启一整套严格检查（例如不允许把可能是 undefined 的值当一定有值用）。代码在编译期就会暴露问题，而不是等运行时白屏。 |

一句话总结：**TypeScript 在这类 React 项目里最大的价值，是让「组件接收什么参数」这件事在写代码时就看得见、写错了立刻报错**，而不是等页面跑起来才发现。

---

## 五、验证情况

### 1. package.json 中配置的脚本

| 脚本 | 实际命令 | 用途 |
| --- | --- | --- |
| `npm run dev` | `vite` | 启动开发服务器 |
| `npm run build` | `tsc -b && vite build` | 类型检查 + 生产构建 |
| `npm run lint` | `oxlint` | 代码检查 |
| `npm run preview` | `vite preview` | 本地预览构建产物 |

### 2. 依赖及其实际版本

见「一、2. 实际使用的技术栈及版本」表格。核对了 `node_modules` 中每个包的真实 `package.json` 后填入，不是只抄 `package.json` 里的版本范围。

### 3. 本次实际执行的命令与结果

| # | 执行的命令 | 结果 |
| --- | --- | --- |
| 1 | `npm run build` | ✅ **通过，退出码 0**。`tsc -b` 无任何类型错误；`vite build` 转译 98 个模块，产出 `dist/index.html` 0.46 kB、`dist/assets/index-DcZJZom9.css` 4.94 kB、`dist/assets/index-Dfd5btO9.js` 262.47 kB（gzip 83.46 kB），耗时 146 ms |
| 2 | `npx tsc -b --force` | ✅ **通过，退出码 0，无任何输出**。加 `--force` 是为了绕过增量缓存，做一次**全量**类型检查，确保结果真实 |
| 3 | `npm run lint` | ✅ **通过，退出码 0，无任何告警** |
| 4 | `Get-ChildItem dist` | ✅ 构建产物确实存在：`favicon.svg` 9.30 KB、`icons.svg` 4.91 KB、`index.html` 0.45 KB、`assets/index-DcZJZom9.css` 4.83 KB、`assets/index-Dfd5btO9.js` 256.33 KB |
| 5 | `Invoke-WebRequest http://localhost:5175/` | ✅ 返回 **HTTP 200**。该开发服务器是上一阶段实施时启动的，本次检查时仍在运行 |

### 4. 未执行的检查（如实标注）

| 检查项 | 状态 | 原因 |
| --- | --- | --- |
| 单元测试 | **未执行** | 项目当前没有配置任何测试框架（依赖里没有 vitest / jest），也没有测试文件可跑 |
| 端到端（E2E）测试 | **未执行** | 项目未配置 Playwright / Cypress 等工具 |
| 本次的浏览器渲染与点击验证 | **未重复执行** | 本次要求只做构建检查与总结。上一阶段实施时曾在内置浏览器中实际打开页面、点击四个导航项、验证动态路由参数，控制台 0 个 error |
| 生产构建产物的实际部署验证 | **未执行** | 不属于本阶段范围 |

**特别说明**：以上「未执行」的项目，本报告**没有**把它们写成「通过」。

---

## 六、当前尚未实现的功能

以下功能在当前代码中**确实不存在**，可以逐条核对源码确认：

### 1. 数据与网络

- **Open Library 图书搜索 API** —— `src` 下没有任何发起网络请求的代码，搜索页没有 `lib/openLibrary.ts` 之类的模块，输入框是 `disabled` 状态。
- **图书添加及重复校验** —— 没有任何「添加书籍」的逻辑，也没有去重判断。
- **localStorage 数据持久化** —— 全项目搜索不到任何 `localStorage` 调用，刷新页面不会有任何数据被保存或恢复。

### 2. 业务功能

- **图书状态管理** —— 「想读 / 正在读 / 已读完」目前只是**静态文字**：首页卡片上的三个标签、书架页的四个筛选标签都是写死的，**点不动、不切换**。
- **阅读进度** —— 没有当前页 / 总页数输入，没有百分比计算，也没有任何校验或钳制规则。
- **阅读笔记** —— 没有输入框，没有保存按钮。
- **首页统计数据** —— 三个统计卡片里的数字是写死的占位符 `—`，没有从任何数据源计算得出；「正在阅读」「最近完成」两块只有占位文案。
- **书籍删除** —— 没有删除入口，也没有二次确认逻辑。

### 3. 交互与工程

- **各页面的实际业务交互** —— 书架页的筛选标签不可点击；搜索页无法输入；详情页只能看，不能改任何东西。
- **未知网址的兜底处理** —— 访问一个不存在的网址（如 `/abc`）时，页面主体是**空白的**，因为路由表里没有配置兜底路由。这一点在上一阶段已被确认不属于必须实现范围，但体验上是个缺口。
- **导航栏「书籍详情」入口是临时占位** —— 它指向写死的 `/books/demo`，因为详情页必须要有具体的书籍 ID 才能访问，而目前还没有真实书籍数据。等后续阶段书架能跳转真实书籍后，这个入口应当移除。
- **模板遗留资源** —— `src/assets/hero.png`、`react.svg`、`vite.svg` 以及 `public/icons.svg` 是 Vite 模板自带的素材，当前代码已不再引用它们，但尚未清理。

---

## 七、下一阶段建议

> 以下仅为建议，不构成本阶段的实施内容，也不改变已确认的技术方案。

### 优先完成：把「数据」这条线打通

当前四个页面都是空壳，最缺的是**数据**。建议下一阶段按这个顺序推进：

**第一步：定义数据模型与本地存储**

- 建议涉及文件：`src/types/reading.ts`（新建）、`src/lib/storage.ts`（新建）
- 内容：定义 `ReadingStatus`、`BookMetadata`、`ReadingRecord` 三个类型；写 localStorage 的读写与容错。
- 为什么先做它：后面的状态、进度、笔记、统计全都要依赖这套结构，先定下来能避免反复返工。

**第二步：统一管理书架数据**

- 建议涉及文件：`src/hooks/useBooks.ts`（新建）、`src/App.tsx`（把数据下发给各页面）
- 内容：把「书架数组 + 增删改 + 持久化」收在一个自定义 Hook 里，页面只负责渲染。

**第三步：接入 Open Library 搜索并实现「添加到书架」**

- 建议涉及文件：`src/lib/openLibrary.ts`（新建）、`src/pages/SearchPage.tsx`（改造）
- 内容：搜索请求、加载 / 空 / 错误三种状态、防抖与竞态处理、重复添加校验。

**第四步：让书架页和详情页真正可交互**

- 建议涉及文件：`src/pages/ShelfPage.tsx`、`src/pages/BookDetailPage.tsx`、`src/components/` 下新增卡片类组件
- 内容：状态筛选生效、状态切换、进度记录与钳制、笔记保存、删除确认。

**第五步：首页统计由数据派生**

- 建议涉及文件：`src/pages/HomePage.tsx`、`src/lib/stats.ts`（新建）
- 内容：三种状态计数、正在阅读列表、最近完成（按完成时间倒序取 3 本）。
- 注意：统计**必须由同一份书架数据算出来**，不要单独存储，否则会出现「统计说 3 本、书架里只有 2 本」这类难查的问题。

### 实施顺序上的建议

**先纵向打通一条闭环，再做横向打磨**。也就是先把「搜索 → 添加 → 改状态 → 记进度 → 刷新不丢」跑通，而不是先把书架页做得很漂亮。样式细节放在最后统一处理。

### 可以顺手清理的小事（等你确认）

1. 删除 `.readflow-backup-20261014-153113\` 备份目录；
2. 清理不再被引用的模板资源（`src/assets/*`、`public/icons.svg`）；
3. 决定是否为未知网址加一个极简的「未找到」提示。

---

## 八、给项目学习者的总结

### 1. 目前项目的整体运行流程是什么？

一句话：**网址变了 → React Router 挑出对应的页面 → 塞进公共布局的 `<Outlet />` 里显示出来。**

展开成一条链路：

1. 浏览器打开 `http://localhost:5173/`，Vite 返回 `index.html`；
2. `index.html` 加载 `src/main.tsx`，它把 React 挂到 `#root` 上，并用 `<BrowserRouter>` 包住整个应用；
3. `<App>` 里的 `<Routes>` 读取当前网址，找出匹配的那条 `<Route>`；
4. 先渲染公共布局 `<AppLayout>`（导航栏 + 主体容器），再把匹配到的页面渲染进 `<Outlet />` 的位置；
5. 用户点击导航链接时，React Router **拦截这次跳转**，只更新网址和 `<Outlet />` 里的内容，页面不整体刷新；
6. 导航栏根据新网址重新计算哪个 `<NavLink>` 处于激活状态，自动加上高亮样式。

### 2. 我应该优先理解哪些文件？

按这个顺序读，从外到内：

| 顺序 | 文件 | 要理解的问题 |
| --- | --- | --- |
| 1 | `src/main.tsx` | 应用是从哪开始跑的？`BrowserRouter` 和 `StrictMode` 各是干什么的？ |
| 2 | `src/App.tsx` | 路由表怎么读？为什么外层那条 `<Route>` 没有 `path`？ |
| 3 | `src/components/AppLayout.tsx` | `<Outlet />` 是什么？导航高亮是怎么做出来的？ |
| 4 | `src/pages/BookDetailPage.tsx` | `useParams` 怎么从网址里取值？泛型 `<{ id: string }>` 是什么意思？ |
| 5 | `src/index.css` | CSS 变量是怎么用的？为什么把颜色和间距都定义成变量？ |
| 6 | `src/pages/HomePage.tsx` | 最简单的页面组件长什么样？`.map()` 怎么把数组渲染成一排卡片？ |

前 3 个是**核心**，能讲清楚这三个，就说明你真的理解了这个骨架。

### 3. 为了能在面试中解释这个项目，需要掌握哪些基础知识？

**必备（这个项目里真实用到、必须能讲）：**

1. **JSX 与组件** —— 函数组件怎么写、组件怎么组合、`props` 是什么。
2. **列表渲染与 `key`** —— 为什么 `.map()` 渲染列表要加 `key`（`HomePage.tsx` 和 `AppLayout.tsx` 里都用了）。
3. **React Router 的四个概念** —— `BrowserRouter`、`Routes/Route`、`Link/NavLink`、`Outlet`，以及「客户端路由不会刷新页面」这件事。
4. **动态路由参数** —— `:id` 与 `useParams`。
5. **TypeScript 基础** —— `type` 定义对象形状、数组类型、`?` 表示可选、泛型 `<T>` 的基本读法（`useParams<{ id: string }>` 就是泛型）。
6. **`strict` 模式的意义** —— 为什么开启它之后代码更难写但更安全。
7. **CSS 变量与基础布局** —— `--var` 的用法、Flex/Grid 基础、媒体查询。

**建议提前准备（下一阶段会用到，现在可以先了解概念）：**

8. `useState` 与 `useEffect` —— 状态怎么存、副作用在什么时机执行。
9. 受控组件 —— 输入框的值由 React 状态控制是什么意思。
10. 异步请求与三种状态 —— `fetch`、`await`、加载中 / 成功 / 失败的处理思路。

**面试时最容易被追问的两个点，现在就可以先想：**

- 「你为什么要用 `<Outlet />` 这种布局路由，而不是每个页面各写一遍导航栏？」（答案方向：复用、切换时不重建、以后加公共元素只改一处）
- 「为什么把 TS 的 `strict` 打开？它给你带来过什么实际好处？」（答案要举具体例子，比如导航项的 `type NavItem` 拦住了写错的字段名）

---

*本报告由 ReadFlow 开发协作流程生成，仅记录当前代码的真实状态，未对项目做任何修改。*
