# ReadFlow 阶段二报告：数据模型、图书搜索、加入书架与本地持久化

| 项目 | 内容 |
| --- | --- |
| 报告日期 | 2026-10-14 |
| 项目路径 | `D:\项目\ReadFlow` |
| 本阶段目标 | 完成图书数据模型、Open Library 搜索、加入书架、重复校验、localStorage 持久化、书架页数据展示 |
| 新增文件 | 6 个 |
| 修改文件 | 5 个 |
| 未改动 | `src/main.tsx`、`src/index.css`、`src/pages/HomePage.tsx`、`src/pages/BookDetailPage.tsx`、`tsconfig*.json`、`vite.config.ts`、`package.json` |

---

## 零、必须先说明的问题：本机无法访问 openlibrary.org

这是本阶段最重要的一条结论，**它会直接影响你能不能实际用到搜索功能**。

**实测结果（三种方式都失败）**：

| 测试方式 | 结果 |
| --- | --- |
| 从 JS 运行时 `fetch` 请求 `openlibrary.org` | 连接超时 |
| 从 PowerShell `Invoke-WebRequest` 请求（含提权） | 连接超时 / 连接方无响应 |
| **从你本机的浏览器直接打开接口地址** | **`ERR_CONNECTION_TIMED_OUT`**（浏览器错误页） |

也就是说：**不是代码的问题，也不是执行环境的问题 —— 这台机器本身就访问不了 openlibrary.org**（国内网络对该域名的访问不稳定或被阻断是常见情况）。

**当前的实际表现**：在搜索页输入关键词并回车后，页面会显示「搜索失败 / 网络请求失败，请检查网络连接后重试。」并给出「重试」按钮 —— 不会白屏，这是**符合要求**的错误处理，但你要知道搜索拿不到结果。

**我做了什么**：为了不让这一阶段的核心功能停留在「无法验证」，我用一个**本地模拟接口**（临时启动的本地 HTTP 服务，返回与 Open Library 相同结构的数据）把「搜索 → 加入书架 → 书架展示 → 刷新不丢」这条链路**完整跑通并逐项验证**；验证完成后已把接口端点**逐字节还原**（sha256 校验一致），临时服务已停止、临时文件已删除。

**你需要知道的一点**：模拟验证证明的是**代码逻辑正确**，不能证明「真实接口的字段名一定和映射代码一致」。原因就是上面那条网络限制。等网络能访问 openlibrary.org 后，建议先用真实请求核对一次字段（见第八节）。

---

## 一、本次新增与修改的文件

### 新增（6 个）

| 文件 | 行数 | 职责 |
| --- | --- | --- |
| `src/types/reading.ts` | 55 | 类型定义：`ReadingStatus`、`STATUS_LABELS`、`BookMetadata`、`ReadingRecord` |
| `src/lib/storage.ts` | 138 | localStorage 读写、运行时数据校验、异常兜底 |
| `src/lib/openLibrary.ts` | 131 | 搜索请求、接口原始数据到内部类型的映射、取消判断 |
| `src/hooks/useBooks.ts` | 72 | 书架状态的唯一入口：读一次、改多处、写完持久化 |
| `src/components/CoverImage.tsx` | 33 | 封面图 + 缺失或加载失败时的 CSS 占位 |
| `src/components/BookListItem.tsx` | 38 | 图书条目展示（搜索页与书架页共用） |

### 修改（5 个）

| 文件 | 行数变化 | 改动 |
| --- | --- | --- |
| `src/App.tsx` | 21 → 29 | 调用 `useBooks()`，把 `books` / `addBook` 下发给搜索页与书架页 |
| `src/components/AppLayout.tsx` | 50 → 61 | 新增 `storageError` 参数，在导航栏下方渲染本地存储异常提示条 |
| `src/pages/SearchPage.tsx` | 39 → 184 | 从静态骨架改为完整的搜索页（表单、四种状态、结果列表、加入书架） |
| `src/pages/ShelfPage.tsx` | 39 → 54 | 从静态骨架改为读取真实书架数据展示 |
| `src/App.css` | 269 → 408 | 追加图书列表、封面占位、状态标签、反馈与错误提示的样式 |

**没有删除任何文件。** 第一阶段的导航、路由结构、视觉变量（配色 / 间距 / 圆角）全部保留，`.chip` 等样式也保留下来了（下一阶段做状态筛选时会用到）。

---

## 二、关键文件的职责

### 数据层（不依赖 React）

**`src/types/reading.ts`** —— 三个概念被明确区分开：

- `ReadingStatus`：`'want-to-read' | 'reading' | 'finished'` 联合类型，写错的值会在编译期报错。
- `BookMetadata`：**这本书本身**的信息（id / 标题 / 作者 / 封面 / 年份），来源是外部接口。
- `ReadingRecord`：**我和这本书的关系**（状态 / 加入时间），里面内嵌一份 `book` 元数据**快照**。

`ReadingRecord` 里还预留了 `currentPage` / `totalPages` / `note` / `finishedAt` 四个可选字段，供后续阶段做进度与笔记使用，**本阶段不读写它们**。

**为什么元数据要存快照，而不是只存一个 id？**
因为书架是本地优先的：如果只存 id，每次打开书架都要请求接口才能显示书名，一旦接口不可用（比如现在这台机器的情况）书架就会变成一片空白。存快照后，书架展示完全不依赖网络。

**`src/lib/storage.ts`** —— 把 localStorage 的脏活关在一个文件里：

- `loadRecords()`：读 + 解析 + 逐条校验。**任何异常都不会抛出**，最差情况返回「空数组 + 一条提示信息」。
- `saveRecords()`：写。失败时返回失败原因，而不是静默吞掉。
- 键名 `readflow:records:v1` 带版本号，将来结构变化时可以平滑升级。

### 接口层

**`src/lib/openLibrary.ts`** —— 页面看不到接口原始数据：

- `searchBooks(keyword, signal)`：拼 URL、`encodeURIComponent` 编码、`fetch`、检查 HTTP 状态、解析、映射、过滤。
- `toBookMetadata(doc)`：单条数据的转换。缺少 key 或缺标题 → 返回 `null`，调用方会跳过这条。
- `isAbortError(error)`：判断「请求被主动取消」，避免把取消当成错误提示给用户。

**ID 的处理（重复校验的基础）**：只采用 Open Library 返回的 `key`（形如 `/works/OL45804W`），并用正则 `^\/(works|books)\/[A-Za-z0-9]+$` 校验格式。**格式不对就跳过这条结果，绝不自己拼一个 ID**。

### 状态层

**`src/hooks/useBooks.ts`** —— 全应用唯一的书架数据入口。页面组件里**不出现任何 localStorage 代码**，所以不可能出现「某个页面改了数据却忘了保存」。

### 视图层

| 文件 | 说明 |
| --- | --- |
| `App.tsx` | 调用一次 `useBooks()`，把同一份 `books` 传给搜索页和书架页 |
| `AppLayout.tsx` | 公共外壳；新增存储异常提示条 |
| `SearchPage.tsx` | 搜索表单 + 四种状态 + 结果列表 + 加入书架 |
| `ShelfPage.tsx` | 读取 `books` 并展示；空书架时给出前往搜索页的入口 |
| `CoverImage.tsx` | 有封面用 `<img>`，加载失败（`onError`）或没有封面 → 显示书名首字的 CSS 占位块 |
| `BookListItem.tsx` | 一条图书记录：封面 + 书名 + 作者 + 年份；右侧内容由调用方通过 `children` 决定 |

**为什么搜索页和书架页共用一个 `BookListItem`？**
因为两者展示的主体（封面、书名、作者、年份）完全一样，差别只在右侧：搜索页放「加入书架」按钮，书架页放阅读状态标签。用 `children` 把这个差异交给调用方，既消除了重复代码，也不需要为「右侧区域」设计复杂的配置项。

---

## 三、图书数据的完整流转过程

### 1. 从接口到页面

```
用户在搜索框输入关键词，点按钮或按 Enter
        ↓  SearchPage 的 handleSubmit 调用 runSearch(keyword)
        ↓  关键词先 trim()；为空则直接返回，不发请求
openLibrary.searchBooks(keyword, signal)
        ↓  encodeURIComponent 编码
        ↓  fetch("https://openlibrary.org/search.json?q=...&limit=20")
        ↓  失败 → 抛出带友好文案的 Error
        ↓  成功 → response.json()
extractDocs(payload)            取 docs 数组；结构不对就返回空数组
        ↓
toBookMetadata(doc) 逐条映射     缺 key 或 缺标题 → null（被过滤掉）
        ↓  cover_i 有值 → 拼成封面 URL；没有 → coverUrl 为 undefined
        ↓  author_name 缺失 → authors 为 []
BookMetadata[]                  页面拿到的是内部类型，不是接口原始数据
        ↓
SearchPage 判断每本是否已在书架：books.some(r => r.book.id === book.id)
        ↓  已在 → 显示「已在书架」并禁用按钮
        ↓  未在 → 显示「加入书架」按钮
```

### 2. 从点击到写入本地

```
点击「加入书架」→ SearchPage.handleAdd(book) → useBooks.addBook(book)
        ↓  books.some(r => r.book.id === book.id) ？
        ↓      是 → 返回 { ok: false, reason: 'duplicate' }，不写入，页面提示「已经在书架里了」
        ↓      否 → hasUserEdited.current = true
        ↓           setBooks(prev => [...prev, { book, status: 'want-to-read', addedAt: now }])
React 重新渲染
        ↓  App 里的 books 变了 → 搜索页与书架页同时拿到新数据（同一个数组，不需要通知机制）
        ↓  搜索页：该条的按钮自动变成「已在书架」
useEffect([books]) 触发
        ↓  首次挂载不写入（hasUserEdited 还是 false）
        ↓  用户改动过 → saveRecords(books) → localStorage.setItem('readflow:records:v1', JSON.stringify(books))
        ↓      写入失败 → 设置 storageError → 导航栏下方出现提示条
```

### 3. 从刷新到恢复

```
刷新页面 → React 重新挂载 → useBooks() 执行
        ↓  const [initial] = useState(loadRecords)     惰性初始化：只执行一次，且是同步的
        ↓      raw = localStorage.getItem(...)
        ↓          读不到 → 空数组（首次使用，正常）
        ↓          读到了 → JSON.parse
        ↓              解析失败 或 不是数组 → 空数组 + corrupted = true + 提示信息
        ↓              解析成功 → 逐条 parseRecord 校验
        ↓                  缺 id 或 缺 title 或 状态非法 或 缺 addedAt → 丢弃这一条
        ↓     返回 { records, corrupted, readError }
        ↓  useState(initial.records) → 首屏就拿到真实数据
书架页直接渲染出来（不需要再请求任何接口）
```

**一个容易踩的坑，这里特意避开了**：
如果写成「先 `useState([])`，再在 `useEffect` 里异步读取」，那么首次渲染后持久化逻辑可能先执行，把空数组写回 localStorage，**把用户原有数据覆盖掉**。本项目的做法是：

1. 用 `useState(loadRecords)` 同步惰性初始化，根本不存在「空数据阶段」；
2. 再用 `hasUserEdited` 这个 ref 兜底 —— **只有用户真正改动过数据之后才允许写回**，这样初始化阶段（包括开发模式下 StrictMode 的重复执行）不会产生任何写入，数据损坏时也不会被立刻覆盖。

---

## 四、已完成的功能

### 1. 图书数据结构

- 三种阅读状态用联合类型 `'want-to-read' | 'reading' | 'finished'` 表示，中文文案通过 `STATUS_LABELS` 映射。
- 图书元数据（`BookMetadata`）与个人阅读记录（`ReadingRecord`）分开定义，记录里内嵌元数据快照。
- 新加入的书默认状态是 `want-to-read`。
- 为进度、笔记预留了 4 个可选字段，但本阶段不读写。

### 2. Open Library 搜索

- 用原生 `fetch` 请求 `/search.json`，关键词用 `encodeURIComponent` 正确编码（中文可用）。
- 对响应做类型处理与字段映射，页面拿到的是内部类型，不是接口原始数据。
- 优先使用 work ID，并用正则校验格式；**缺少 ID 或 ID 格式不对的结果直接跳过，不生成伪 ID**。
- 缺标题的结果跳过；缺作者显示「未知作者」；缺出版年份则不显示该行；缺封面用 CSS 占位。
- 加载中、搜索失败、无结果三种状态都有独立界面；失败时有明确提示 + 重试按钮，不会白屏。

### 3. 搜索页面

- 输入框 + 搜索按钮，支持点击按钮和按 Enter 两种方式提交。
- 空关键词（含只有空格）不发起请求。
- 结果列表展示封面 / 占位、标题、作者、出版年份、添加状态。
- 未添加的显示「加入书架」，已添加的显示「已在书架」且按钮禁用。

### 4. 加入书架与重复校验

- 点击后把元数据快照 + 默认状态 + 加入时间一起写入书架。
- 以 work ID 判断重复；重复时不写入并给出文字反馈。
- 添加成功后搜索结果**立即**变为「已在书架」，不需要刷新页面。

### 5. localStorage 持久化

- 启动时读取；添加后保存；刷新后数据仍在。
- 解析失败、结构不对、单条数据非法都有兜底，**不会导致应用崩溃**。
- 读写逻辑集中在 `src/lib/storage.ts`，页面里没有重复的存储代码。
- 存储不可用或写入失败时，导航栏下方会出现提示条，不会静默失败。

### 6. 书架页数据展示

- 读取并展示本地保存的图书：封面 / 占位、标题、作者、当前阅读状态。
- 书架为空时显示友好空状态，并提供「前往书籍搜索」入口。
- 与搜索页共享同一份数据（都来自 `App` 里那一次 `useBooks()`），添加后立即可见。

### 7. 未越界实现

- 没有做状态筛选、进度编辑、笔记、删除。
- 没有引入 axios / Redux / Zustand / UUID 或任何新依赖（`package.json` 未改动）。
- 没有把接口原始数据直接当业务对象用，没有用 `any` 绕过类型检查（全项目搜索不到 `any`）。

---

## 五、验证情况

### 1. 静态检查命令与结果（真实执行）

| # | 命令 | 结果 |
| --- | --- | --- |
| 1 | `npx tsc -b --force` | ✅ 退出码 0，无任何输出（`--force` 绕过增量缓存，是全量类型检查） |
| 2 | `npm run build` | ✅ 退出码 0。转译 **104 个模块**；产出 `dist/index.html` 0.46 kB、`index.css` 6.62 kB、`index.js` 269.65 kB（gzip 85.74 kB），169 ms |
| 3 | `npm run lint` | ✅ 退出码 0，无告警 |
| 4 | 全项目搜索 `any` | ✅ 未发现使用 `any` |

### 2. 运行时功能验证（在真实浏览器中操作，逐项记录）

用本地模拟接口提供与 Open Library 同结构的数据（含若干「应该被跳过」的异常数据），实际点击操作并读取页面 DOM：

| # | 验证项 | 结果 |
| --- | --- | --- |
| 1 | 搜索页初始状态 | ✅ 输入框可用，显示「开始搜索」引导 |
| 2 | 空关键词提交 | ✅ 保持「开始搜索」，**未发起请求，无结果列表** |
| 3 | 输入「三体」按 Enter | ✅ 显示「找到 3 本相关书籍。」 |
| 4 | **异常数据过滤** | ✅ 模拟数据给了 6 条，其中「无 key」「无标题」「key 格式非法（not-a-valid-key）」3 条被正确跳过，只渲染 3 条 |
| 5 | 封面正常加载 | ✅ 有 `cover_i` 的那条，`img.naturalWidth > 0`，图片确实加载成功 |
| 6 | 无封面 → CSS 占位 | ✅ 另两条渲染出 `.cover--placeholder` |
| 7 | 无作者 → 未知作者 | ✅ 显示「未知作者」 |
| 8 | 无年份 → 整行不显示 | ✅ 该条只有作者一行，没有年份行 |
| 9 | 点击「加入书架」 | ✅ 反馈「《三体》已加入书架。」；该条按钮变「已在书架」且 `disabled`；其他条目仍可添加 |
| 10 | 书架页展示 | ✅ 显示 1 本，标题「三体」、作者「刘慈欣」、状态标签「想读」（样式类 `status--want-to-read`） |
| 11 | **刷新页面后数据仍在** | ✅ F5 刷新 `/shelf` → 仍显示 1 本，状态「想读」，未显示空书架 |
| 12 | **刷新后重复校验** | ✅ 重新搜索同一关键词 → 第一条显示「已在书架（禁用）」，其余两条仍为「加入书架」 |
| 13 | 服务端返回 500 | ✅ 显示「搜索失败 / 搜索服务返回了错误（HTTP 500），请稍后重试。」+ 重试按钮，页面非空白 |
| 14 | 无搜索结果 | ✅ 显示「没有找到相关书籍」 |
| 15 | 浏览器控制台 | ✅ **0 个 error** |
| 16 | **真实端点（无模拟）** | ✅ 搜索后显示「搜索失败 / 网络请求失败，请检查网络连接后重试。」+ 重试按钮，页面非空白（符合失败时的要求） |

### 3. 验证过程的清理（如实说明）

为了让第 2 节的验证能够进行，我做了几处**临时**改动，并且都已完成还原：

| 临时改动 | 还原情况 |
| --- | --- |
| 把 `src/lib/openLibrary.ts` 里两个端点地址临时指向 `http://localhost:8123` | ✅ 已还原为 `openlibrary.org` / `covers.openlibrary.org`，**sha256 与原文件完全一致**，文件中已无 `localhost:8123` 残留 |
| 在 `public/` 下临时放了一个 `__clear-storage.html`（用于清除验证时写入的测试书目） | ✅ 已删除；`public/` 现在只有 `favicon.svg` 和 `icons.svg` |
| 临时启动的本地模拟服务（端口 8123） | ✅ 进程已停止，端口已释放，临时脚本文件已从系统临时目录删除 |
| 验证时写入浏览器的测试书目 | ✅ 已清除（清除前 203 字符 → 清除后 null） |

### 4. 未执行的检查（如实标注）

| 检查项 | 状态 | 原因 |
| --- | --- | --- |
| 真实 Open Library 接口的字段名核对 | **未执行** | 本机无法访问 openlibrary.org（三种方式实测均超时） |
| 真实接口下的搜索结果正确性 | **未执行** | 同上 |
| 单元测试 | **未执行** | 项目未配置测试框架 |
| E2E 测试 | **未执行** | 项目未配置 Playwright / Cypress 之类工具 |

**特别说明**：第 2 节的 16 项验证**是真的在浏览器里一步步点出来的**，不是推测。但其中第 3 到 12 项和第 14 项使用的是本地模拟数据，**不能替代真实接口的验证**。

---

## 六、已知问题

1. **【最重要】本机访问不了 openlibrary.org**，导致真实搜索不可用。当前表现为搜索结果处显示明确的失败提示（不是白屏），但这意味着这一功能在你当前网络下拿不到数据。
2. **真实接口的字段名未经核对**：`key` / `title` / `author_name` / `cover_i` / `first_publish_year` 这五个字段名是按 Open Library 的公开文档写的，没有在本机用真实响应验证过。若真实字段不同，只需要改 `src/lib/openLibrary.ts` 一个文件。
3. **`limit=20` 参数未经实测**：用于限制返回条数、避免渲染上百条结果。若该参数不生效，只会让结果列表变长，不会出错。
4. **书架没有排序**：目前按加入顺序（先加的在前）展示，新加的书排在末尾。是否需要「最近添加在前」等你决定。
5. **导航栏「书籍详情」仍是占位入口**（指向 `/books/demo`），详情页也还没接入真实数据。
6. **未知网址仍然渲染空白主体**（第一阶段起就存在，属已知缺口）。
7. **模板遗留资源仍未清理**：`src/assets/hero.png`、`react.svg`、`vite.svg`、`public/icons.svg` 已不被引用。
8. `.readflow-backup-20261014-153113/` 备份目录仍在项目里。

---

## 七、本阶段未实现的功能（下一阶段范围）

- 阅读状态切换（切换状态、进入「已读完」时记录完成时间）
- 书架页的状态筛选（`.chip` 样式已保留，还没接逻辑）
- 阅读进度记录（当前页 / 总页数 / 百分比 / 越界钳制）
- 阅读笔记（单文本输入 + 显式保存）
- 删除图书（含原生 `confirm` 二次确认）
- 首页统计（三个计数、正在阅读列表、最近完成列表）—— 目前仍是写死的占位符
- 书籍详情页接入真实数据（现在只显示路由参数）
- 书籍详情页的入口（把书架的卡片链到 `/books/:id`）

---

## 八、下一阶段建议

### 最优先：先用真实网络核对一次接口字段

在写更多功能之前，建议先解决网络问题（例如给浏览器 / 系统配置可用的代理），然后在浏览器里直接打开这个地址确认字段：

```
https://openlibrary.org/search.json?q=三体&limit=2
```

只要能看到返回的 JSON，就核对这五个字段是否存在、类型是否与 `src/lib/openLibrary.ts` 里写的一致：`key`、`title`、`author_name`、`cover_i`、`first_publish_year`。
如果不一致，**只需要修改 `src/lib/openLibrary.ts` 这一个文件**，其余代码不用动 —— 这正是把接口转换层单独分出来的意义。

### 然后：按顺序补完核心流程

| 顺序 | 内容 | 预计涉及文件 |
| --- | --- | --- |
| 1 | **阅读状态切换**：详情页把状态改掉；进入「已读完」时写 `finishedAt` | `src/hooks/useBooks.ts`（加 `updateStatus`）、`src/pages/BookDetailPage.tsx` |
| 2 | **书架卡片链接到详情页**，并移除导航栏那个占位入口 | `src/components/BookListItem.tsx`、`src/components/AppLayout.tsx` |
| 3 | **阅读进度**：当前页 / 总页数 + 越界钳制规则 | `src/lib/reading.ts`（新建，放纯函数规则）、`src/pages/BookDetailPage.tsx` |
| 4 | **笔记**：单文本 + 显式保存 | `src/pages/BookDetailPage.tsx` |
| 5 | **删除图书**：原生 `confirm` + 删除整条记录 | `src/hooks/useBooks.ts`、`src/pages/ShelfPage.tsx` |
| 6 | **书架状态筛选**（复用已有的 `.chip` 样式） | `src/pages/ShelfPage.tsx` |
| 7 | **首页统计**：由同一份 `books` 派生，不单独存储 | `src/lib/stats.ts`（新建）、`src/pages/HomePage.tsx` |

**建议顺序的理由**：1、2 打通「进详情页 → 改状态 → 回书架看到变化」的闭环；3、4 是详情页内的工作，可以连着做；5、6 是书架页的能力；7 放最后，因为首页统计要依赖状态数据已经能正确变化。

### 需要你决定的小事（都不影响下一步开工）

- 书架是否改成「最近添加在前」
- 是否清理模板遗留资源与 `.readflow-backup-*` 备份目录
- 是否为未知网址加一个极简的「未找到」提示

---

*本报告只记录真实的执行与验证结果，未执行的项目均已标注为「未执行」。*
