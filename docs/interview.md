# ReadFlow 面试讲解稿

> 这份文档里的每个说法都能在代码里找到对应位置。凡是**没有实现**的东西都会明确标出来，不要背成"已经做了"。

---

## 一、项目介绍

### 30 秒版本

> ReadFlow 是一个个人阅读管理的前端应用，用 **React + TypeScript + Vite** 写的，数据存在浏览器 localStorage 里，**不需要后端**。
> 主要功能是手动录入想读的书、按阅读状态管理书架、记录每本书读到第几页、写读书笔记；首页会汇总三种状态的数量、正在读的书和最近读完的 3 本。
> 一共四个页面，运行时依赖只有 React、React DOM 和 React Router 三个。

### 1 分钟版本

> ReadFlow 是一个「一个人自己用的阅读台账」，解决的问题是：书多了之后不知道哪些开过头没继续、读到第几页没有记录、读完的想法没地方存。
>
> 技术上它是一个纯前端项目，**React 19 + TypeScript + Vite 8 + React Router 8**，样式用原生 CSS，数据用 **localStorage** 持久化，没有后端也没有账号体系。运行时依赖只有三个包。
>
> 功能上分四块：**书架**负责按「想读 / 正在读 / 已读完」管理书籍并直接切换状态；**详情页**负责记录当前页数、总页数并显示进度条，以及保存一段纯文本笔记；**首页**把三种状态的数量、正在阅读的书和最近读完的 3 本汇总出来；**搜索页**对接 Open Library，但目前因为网络原因拿不到数据，所以实际录入走的是**手动添加**。
>
> 我在工程上比较注意三件事：一是**单一数据源** —— 四个页面的书籍数据都来自同一个自定义 Hook，任何增删改都走同一条写入路径，所以不存在"某个页面忘了刷新"；二是**校验和容错分层** —— 表单层严格校验、领域层信任入参、存储层修复脏数据；三是**数据损坏时的降级** —— 本地数据解析失败不会白屏，会按空书架启动并提示，同时把原文备份下来。
>
> 项目也做了完整的阶段文档，包括每轮做了什么、怎么验证的、以及**哪些没验证**。

---

## 二、核心技术实现

### 2.1 React 组件如何组织

四层，从上到下：

| 层 | 文件 | 职责 |
| --- | --- | --- |
| 入口 | `src/main.tsx` | 挂载 React，包一层 `BrowserRouter` 提供路由上下文 |
| 容器 | `src/App.tsx` | 只做两件事：调用一次 `useBooks()`，声明路由表并把数据传给各页面 |
| 页面 | `src/pages/` 四个文件 | 每个页面对应一条路由，各自持有自己的临时状态（筛选条件、搜索关键词、表单草稿） |
| 复用组件 | `src/components/` 五个文件 | 跨页面复用：布局、列表项、封面、进度条、阅读编辑区 |

加一条纪律：**`src/lib/` 里的文件不 import React**。状态联动、进度校验、统计计算都在那里，是纯函数，可以脱离浏览器单独推演。页面组件只负责"渲染 + 收集用户意图"。

### 2.2 React Router 如何实现页面路由

- `main.tsx` 里用 `<BrowserRouter>` 包住整个应用；
- `App.tsx` 里用 `<Routes>` / `<Route>` 声明四条路由：`/`、`/shelf`、`/search`、`/books/:id`；
- 四条路由**挂在同一个"布局路由"下**（那条 `<Route>` 没有写 `path`，只写了 `element={<AppLayout />}`）。`AppLayout` 里有导航栏、页面主体容器和一个 `<Outlet />`，子页面就渲染在 `<Outlet />` 的位置。**好处是切换页面时导航栏不会重建，而且以后加页脚只改一个文件。**
- 导航用 `<NavLink>`，它给 `className` 传的函数里带 `isActive`，据此加高亮样式；
- 详情页用 `useParams<{ id: string }>()` 从 URL 里取书籍 id；
- 跳转全部走 `<Link>`，是**客户端路由，不整页刷新**。

**没有使用** v6.4+ 的 `createBrowserRouter` / `loader` / `action` 数据路由 —— 那是另一套心智模型，本项目的数据全在本地，用不上。

### 2.3 书籍数据如何流转

```
localStorage
   │ 读一次（同步、惰性初始化）
   ▼
useBooks() 的 books: ReadingRecord[]  ← 全应用唯一数据源
   │ props 下发
   ▼
首页 / 书架 / 搜索 / 详情

任何修改：
页面操作 → useBooks 暴露的函数 → commit(next)
                                   ├─ latestBooks.current = next   （记住最新数组）
                                   ├─ setBooks(next)               （触发重渲染）
                                   ├─ saveRecords(next)            （同步写 localStorage，拿到结果）
                                   └─ 返回 { ok, message }          （页面据此提示）
```

### 2.4 不同页面如何共享和更新数据

**没有用 Context，也没有用任何状态管理库。**

因为层级只有一层（`App → 页面`），props 完全够用，而且看 props 就知道每个页面依赖什么。Context 的价值在"跨多层穿透"，这个项目还没有这个复杂度。

至于"同步"：**根本不存在同步代码**。四个页面渲染的是同一个数组，`commit` 换掉数组引用之后 React 重渲染，每个页面各自重算自己要显示的东西 —— 首页的统计、书架的筛选结果和数量，全是**渲染时现算的纯函数结果**，不存第二份。所以不可能出现"统计说 3 本、列表里 2 本"。

### 2.5 localStorage 如何读写

集中在 `src/lib/storage.ts`，页面组件里没有一处 `localStorage` 调用。

**读**：`loadRecords()`，在 `useBooks` 里用 `useState(loadRecords)` 调用 —— 这是 useState 的**惰性初始化**，只在首次渲染执行一次且是同步的，所以首屏拿到的就是真实数据，不存在"先渲染空数据再异步加载"的中间态。

**写**：`saveRecords()`，内部 `try/catch` 包住 `setItem`，返回 `{ ok: true }` 或 `{ ok: false, message }`。

两边都做了容错，具体规则见下面 2.7 和第三节难点 3。

### 2.6 阅读状态如何切换

状态只有三个：`'want-to-read' | 'reading' | 'finished'`，用 TypeScript 联合类型约束，不允许任意字符串。

切换逻辑集中在 `src/lib/reading.ts` 的 `applyStatusChange(record, status)`，**全应用只有这一处**：

```
export function applyStatusChange(record: ReadingRecord, status: ReadingStatus): ReadingRecord {
  if (status === 'finished') {
    const next = { ...record, status, finishedAt: new Date().toISOString() }
    if (record.totalPages !== undefined) next.currentPage = record.totalPages
    return next
  }
  const next = { ...record, status }
  delete next.finishedAt
  return next
}
```

三条规则：

- 状态之间**自由切换**，不限制方向；
- 改成 `finished` 时，**总页数已知就把当前页补到总页数**（读完了自然读到了最后一页），**总页数未知就只改状态、不伪造页数**；
- 离开 `finished` 时清掉 `finishedAt`，但**保留已经记录的进度和笔记**。

实现上用的是展开运算符生成新对象、只覆盖少数字段，所以标题、作者、封面、加入时间、笔记都不会被碰掉。

### 2.7 阅读进度如何校验和计算

**校验（保存时一次性做完）** —— `parseProgressInput`：

```
if (!/^\d+$/.test(currentText)) return { ok: false, message: '当前页数请填 0 或正整数…' }
if (totalPages < 1)             return { ok: false, message: '总页数必须大于 0…' }
if (currentPage > totalPages)   return { ok: false, message: '当前页数（X）不能大于总页数（Y）…' }
```

- 为什么用正则而不是直接用 `Number()`：`Number('')` 是 0、`Number('abc')` 是 NaN、`Number('-5')` 是 −5、`Number('1e3')` 是 1000 —— 它们都会"悄悄变成合法数字"。先用 `/^\d+$/` 卡住格式，就避免了 NaN、空串、负数、小数、科学计数法进库。
- 校验失败时**只提示、不改数据**，并且**保留用户当前输入**，让他改一个字符再提交。
- 当前页大于总页数时选择**阻止保存**而不是自动修正 —— 悄悄把 300 改成 200 等于替用户改了他填的数字。
- 改总页数时当前页会**重新校验**（同一段逻辑走一遍）。

**计算** —— `computeProgressPercent`：

```
if (totalPages === undefined || totalPages <= 0) return null
const percent = Math.round(((currentPage ?? 0) / totalPages) * 100)
return Math.min(100, Math.max(0, percent))
```

- **百分比永远是现算的，不落库** —— 存一份就等于同一件事有两份数据，页数一改就得记得同步改百分比。
- 总页数未知时返回 `null` 而不是 `0`：`0%` 的含义是"一页没读"，用它表示"不知道"是在编造信息；返回 `null` 还能用类型逼着调用方先判断，界面据此显示"未设置总页数"。
- 钳制到 0~100 是给异常数据兜底。

### 2.8 最近读完的书籍如何筛选和排序

`src/lib/stats.ts` 的 `selectRecentlyFinished`：

```
return records
  .filter((r) => r.status === 'finished' && toTimestamp(r.finishedAt) !== null)
  .sort((a, b) => (toTimestamp(b.finishedAt) ?? 0) - (toTimestamp(a.finishedAt) ?? 0))
  .slice(0, 3)
```

三个点：

1. **为什么要多判断 `finishedAt` 有效**：旧数据里可能存在"状态已完成但没有完成时间"的记录（比如数据被手工改过）。不判断的话 `new Date(undefined)` 会得到 Invalid Date，还要在渲染层处理一堆边界。**在数据层挡掉最省事。**
2. **排序前先 `filter`**：`Array.prototype.sort` 是**原地排序**，会改动调用它的数组。`filter` 先返回一个新数组，对它排序就不会碰到传进来的 `books` —— 直接对 props 排序等于在页面里偷偷改全局状态。
3. **`slice(0, 3)` 放最后**：不足 3 本时自然返回实际数量。

配套的 `toTimestamp` 是安全阀：缺失、空串、无法解析一律返回 `null`，调用方用 `?? 0` 兜底，所以"时间坏了"最多排序位置不理想，**不会让页面崩**。

### 2.9 TypeScript 如何描述书籍数据结构

```
export type ReadingStatus = 'want-to-read' | 'reading' | 'finished'

export const STATUS_LABELS: Record<ReadingStatus, string> = {
  'want-to-read': '想读', reading: '正在读', finished: '已读完',
}

export interface BookMetadata {      // 这本书本身（元数据快照）
  id: string
  title: string
  authors: string[]                  // 空数组 = 未知作者
  coverUrl?: string                  // 缺失时走 CSS 占位
  firstPublishYear?: number          // 缺失时不显示这一行
}

export interface ReadingRecord {     // 我和这本书的关系（个人数据）
  book: BookMetadata
  status: ReadingStatus
  addedAt: string
  currentPage?: number
  totalPages?: number
  note?: string
  finishedAt?: string
}
```

几个用法：

- **联合类型**：`status` 只能取三个值之一，写错在编译期就报错。
- **`Record<ReadingStatus, string>`**：如果将来加了第四种状态却忘了补中文文案，编译期会报错。
- **可选属性 `?`**：表示"可能不存在"，比 `| null` 或空字符串语义更清楚。而且约定用**"字段不存在"表示没有值**（笔记为空就不存 `note` 字段），这样"未知"和"确实是 0"不会混。
- **两层分离**：`BookMetadata` 是"这本书本身"，`ReadingRecord` 是"我和它的关系"，记录里存的是元数据的**快照** —— 所以展示书架完全不需要联网。
- **类型只在编译期有效**：从 localStorage 读出来的 `JSON.parse` 结果是 `unknown`，必须做运行时校验（见下），不能直接断言成 `ReadingRecord[]`。
- 另外还用了一个**可辨识联合**给搜索页的四种状态建模（`idle / loading / success / error`），避免"既在加载又有错误"这种非法组合。

---

## 三、项目难点

### 难点 1：组件复用导致的状态串味

**问题**：从 `/books/A` 跳到 `/books/B` 时，React Router **不会重新挂载页面组件** —— 它复用的是同一个组件实例，只是 `useParams` 的值变了。而 `useState` 的初始值只在首次挂载时计算一次，结果是 **B 书的输入框里残留着 A 书的笔记草稿**。

**为什么必须处理**：笔记和进度是用户手打的，串到另一本书上是**数据事故**，不是显示瑕疵。

**当前怎么解决**：给编辑区加 `key={record.book.id}`。

```
<ReadingEditor key={record.book.id} record={record} ... />
```

key 变了 React 就把它当成另一个元素：卸载旧的、挂载新的，`useState` 重新初始化，草稿自然跟着换成新书的内容。

同一类问题还有第二个实例：`CoverImage` 里原本用一个布尔 `failed` 表示"图片加载失败"，组件被复用去渲染另一本书时，失败状态会错误地延续过去。改法是把状态改成**记录"是哪张图失败了"**（`failedUrl === url` 才显示占位），换 URL 就自动失效。

**核心认识**：**组件复用是 React 的默认行为，"实例内部状态"必须和"它当前渲染的数据"绑在一起** —— 要么用 key 强制重建，要么让状态的语义带上标识。

**还有什么不足**：当前项目所有书都是手动录入、没有封面 URL，所以第二个问题**实际触发不了**，我是按代码审查顺手修的，没有真实复现。

### 难点 2：localStorage 与 React 状态的初始化时序

**问题**：如果写成"先 `useState([])`，再在 `useEffect` 里异步读取"，那么首次渲染后持久化逻辑可能先执行，把空数组写回 localStorage，**把用户原有数据覆盖掉**。更麻烦的是这种 Bug 只在特定写法 + 特定时序下出现。

**为什么必须处理**：这是**数据丢失**级别的问题，而且一旦发生不可恢复。

**当前怎么解决**：两层。

1. **`useState(loadRecords)` 惰性初始化** —— 传函数给 `useState` 时，它只在首次渲染执行一次、而且是同步的。所以首屏拿到的就是已经读出来的真实数据，**"空数据阶段"根本不存在**。
2. **写入发生在用户操作里，而不是 effect 里** —— 每次操作走 `commit`：更新 state → 同步调用 `saveRecords` → 把 `{ok, message}` 返回给页面。因为没有 effect，就不存在"挂载时误写一次"，也不存在"每次渲染后无条件写一次"。

顺带还解决了另一个问题：**保存结果的真实性**。原来用 effect 持久化时，点击保存的那一刻页面拿不到写入结果，只能无条件提示"已保存"；现在能拿到真实返回值，页面可以区分「已保存」和「已在页面上更新，但保存到本地存储失败」。

**还有什么不足**：没有处理"多个标签页同时打开"的场景（另一个标签页的修改会覆盖当前页面的数据）。

### 难点 3：校验与容错应该放在哪一层

**问题**：数据有三个来源 —— 用户输入、localStorage（外部可改）、以及程序内部的规则联动。如果只在 UI 层校验，存储层被改坏的数据就会直接进内存；如果只在领域层校验，用户就看不到**具体的错误原因**，只能被系统悄悄改掉数字。

**为什么必须处理**：既不能让非法数据进库，也不能替用户做决定；同时外部的脏数据还不能让应用崩掉。

**当前怎么解决**：**三层分工**。

| 层 | 位置 | 做什么 |
| --- | --- | --- |
| 边界（表单） | `parseProgressInput` | **严格校验 + 具体错误提示**；失败时保留用户输入、不动已存数据 |
| 领域 | `applyStatusChange` / `applyProgress` | **信任入参**，只负责把校验过的值写进记录、生成新对象 |
| 存储 | `parseRecord` / `loadRecords` | **修复脏数据**：字段级容错（坏字段当作没设置，不丢整条记录）、钳制 `currentPage > totalPages` 的不变式、解析失败时降级为空书架 + **备份原文** |

**还有什么不足**：领域层不再做二次钳制，所以如果将来有人绕过表单直接调 `updateProgress`，理论上可以写入越界值。目前的取舍是"不可达的防御性代码不如不写"，代价是这条约束依赖调用方守规矩。

---

## 四、项目局限

如实说明，不要遮：

1. **数据只存在本地。** 用 localStorage 保存，换浏览器、换设备、无痕模式都看不到；清除浏览器站点数据会**永久丢失**阅读记录。没有账号体系，也没有云端同步（这个项目根本没有后端）。
2. **没有导入 / 导出 / 备份。** 上面那条的直接后果就是数据可迁移性为零。唯一算得上的保护是：本地数据损坏时会把它备份到另一个键里，但那是异常兜底，不是常规备份手段。
3. **在线图书搜索目前拿不到数据。** 搜索页、Vite 开发代理、字段映射、加载/失败/空结果三种状态都实现了，但这台机器所在网络对 `openlibrary.org` 存在 DNS 污染和 TLS 阻断，请求到不了目标服务器。**所以现在录入书籍的唯一方式是手动添加。** 这一点在 README 和排查报告里都写明了。
4. **没有自动化测试。** 没有配单元测试或 E2E 框架，验证方式是每个阶段在真实浏览器里逐条手工验收（结果记在各阶段报告里）。
5. **没有 ErrorBoundary。** 已知的失败路径都在数据层处理了，但如果渲染阶段抛出未捕获异常，页面会白屏。
6. **功能上的小缺口**：首页统计卡片不可点击；书架筛选条件没同步到 URL；详情页不能切换阅读状态；书架没有排序；「最近读完」固定只显示 3 本。

---

## 五、面试问题（12 个）

### React

**Q1：四个页面共享同一份书籍数据，你为什么没用 Context 或 Redux？**

答：因为层级只有一层（`App → 页面`），props 完全够用，而且看 props 就能知道每个页面依赖什么。Context 的价值在"跨多层穿透"，这个项目没到那个复杂度；Redux 这类库解决的是一大堆共享状态和复杂更新流程，而这个项目本质是"一个数组 + 几个派生计算"，引入之后代码量会比功能还多。
不过我留了退路：所有页面只依赖 `useBooks()` 返回的那几个字段，将来详情页内部嵌套变深了再换 Context，改动只在 `App` 和各页面的一行。

**Q2：`key` 在 React 里有什么用？你项目里真实用到过吗？**

答：key 是**元素身份的标识**，不是性能开关。React 靠它判断两次渲染之间"哪个是哪个"。项目里的真实用例：书籍列表用 `key={record.book.id}`（不用数组下标，否则删一项会导致后面所有项的组件状态错位）；详情页的编辑区用 `key={record.book.id}` **强制重建**，解决从 A 书跳到 B 书时输入框残留上一本笔记的问题 —— 因为 React Router 在同一个路由不同参数之间不会重新挂载组件，`useState` 的初始值也就不会重算。

**Q3：详情页的表单为什么是"受控组件 + 草稿 + 显式保存"？**

答：受控是因为我需要"值在我手里"：要校验、要能在保存后清空、要能在切换书籍时重置，这些都得靠 state 驱动，而不是去读 DOM。草稿的意思是输入过程中**只改组件内部 state，不动全局数据** —— 所以打字不会触发全局重渲染、也不会写 localStorage。显式保存是因为笔记和进度是"正式数据"，我希望用户点一下按钮才落库；直接离开页面就等于放弃未保存的修改，不会偷偷保存。
另外我专门做了「放弃修改」按钮，把草稿还原成已保存的内容，避免用户没法撤销手误。

**Q4：为什么不在渲染时或者 `useEffect` 里写 localStorage？**

答：两个具体原因。
一、**渲染必须是纯的**。在渲染里写存储是副作用，会随重渲染次数、StrictMode 双执行而变化，行为不可预测。
二、**`useEffect` + `useState([])` 的经典写法会丢数据**：首次渲染后持久化逻辑可能先跑，把空数组写回存储，覆盖掉用户原有数据。我用 `useState(loadRecords)` 惰性初始化（同步、只执行一次）让"空数据阶段"根本不存在，再把写入放进用户操作里（`commit`）而非 effect —— 顺带还解决了第二个问题：这样点击保存时能拿到真实的写入结果，页面不会把失败提示成成功。

**Q5：为什么写一个 `commit` 函数，所有修改都走它？**

答：因为那是**唯一需要知道"怎么写存储"的地方**。`addBook / updateStatus / updateProgress / updateNote / removeBook` 五个操作各自算出下一份数组，然后统一交给 `commit` 去更新 state、写存储、返回结果。好处有三个：写入逻辑只有一份（不会某个操作漏了持久化）、保存失败的提示只在一条路径上（不会有的地方提示有的地方不提示）、每个操作都读写同一份最新数据。里面那个 `latestBooks` ref 是必要的 —— 如果操作里直接用渲染时的 `books`，那么"先改进度、马上改笔记"这种连续操作第二次会基于旧数组计算，把第一次的改动覆盖掉。

### TypeScript

**Q6：`ReadingStatus` 用联合类型、`STATUS_LABELS` 用 `Record`，比直接用 `string` 好在哪？**

答：联合类型把"合法取值"变成了编译期约束 —— `const s: ReadingStatus = 'readingg'` 会直接报错，而 `string` 要等到运行时才发现。`Record<ReadingStatus, string>` 的价值在**穷尽性**：如果将来给状态加了第四种，但忘了补中文文案，编译期就会报错，而不是在页面上显示 `undefined`。
这个模式在项目里用了不止一处：书架的 `STATUS_CLASSES`（状态 → 样式类名）、`countByStatus` 返回的 `StatusCounts` 都是 `Record<ReadingStatus, ...>`。

**Q7：`JSON.parse` 之后你为什么还要写一堆校验？直接 `as ReadingRecord[]` 不行吗？**

答：不行，**TypeScript 的类型只在编译期存在，运行时会被完全擦掉**。`JSON.parse` 的返回值是 `any`（我这边拿到的是 `unknown`），一条 `as` 只是"我让你闭嘴"，它不会检查任何东西 —— localStorage 里的内容用户随时可以改，也可能是旧版本程序写进去的。
所以我写了一个 `parseRecord` 做真实的运行时校验，而且是**字段级**的：`id`、`title`、合法 `status`、`addedAt` 缺一个才丢掉整条记录；`currentPage` / `totalPages` / `note` / `finishedAt` 这些可选字段不合法时只当作"没设置"，**不因为一个坏字段毁掉整条记录**。顺带还会修正越界数据（`currentPage > totalPages` 时钳到 `totalPages`），让不变式在数据层就成立。

**Q8：搜索页有四种界面状态，你是怎么建模的？**

答：用可辨识联合类型，而不是三四个独立的布尔/对象 state：

```
type SearchState =
  | { phase: 'idle' }
  | { phase: 'loading' }
  | { phase: 'success'; results: BookMetadata[] }
  | { phase: 'error'; message: string }
```

好处是**非法组合无法表示**。如果用 `isLoading` / `error` / `results``` 三个独立 state，理论上存在"既在加载又有错误"这种状态，代码里就得处理它；用联合类型之后，`switch (state.phase)` 会强制你在每一个分支里只访问该分支特有的字段。
这里还有一个细节：`success` 且 `results` 为空数组 才表示"搜过了没找到"，和 `idle`（还没搜）必须分开 —— 否则页面一打开就会显示"没有找到相关书籍"。

### 状态管理 / 数据流

**Q9：你怎么保证首页的统计和书架列表永远一致？**

答：**不去"保证"，而是让它们不可能不一致。** 两边渲染的都是 `App` 里那一次 `useBooks()` 产出的同一个数组；首页的统计是 `countByStatus(books)`，书架的列表是 `books.filter(...)`，全是**渲染时现算的纯函数结果**，谁都不额外存一份。所以既没有"同步"代码，也没有"统计存了但忘了更新"这种可能。
反过来说，如果每个页面各存一份 `useState`，或者把统计数字写进 localStorage，那才需要一堆同步逻辑，而且迟早会漏。

**Q10：阅读状态切换的规则为什么放在 `lib` 而不是组件里？**

答：因为那是**产品规则**，不是 UI 行为。规则内容是"改成已读完时，总页数已知就把当前页补到总页数并记完成时间；总页数未知就只改状态不伪造页数；离开已读完时清掉完成时间但保留进度和笔记"。这样的规则如果写在下拉框的 onChange 里，将来任何一个新的入口（比如详情页也想加状态切换）就会多一份拷贝，迟早不一致。
放在 `lib/reading.ts` 的 `applyStatusChange` 里还有两个好处：它是纯函数（不 import React），可以脱离浏览器单独推演；而且它用展开运算符生成新对象、只覆盖需要改的字段，天然满足了"不修改原状态"。

### 数据持久化

**Q11：如果让你把 localStorage 换成后端接口，你会改哪里？**

答：**理论上只需要改 `src/lib/storage.ts` 这一个文件。** 因为它的对外接口就是两个函数：`loadRecords()` 返回 `{ records, corrupted, readError }`，`saveRecords(records)` 返回 `{ ok, message }`。换成接口的话，就是把这两个函数的实现改成 `fetch`，保持同样的返回形状。
不过有两个必须一起处理的地方：一是 `loadRecords` 现在是**同步**的（靠它做 `useState` 惰性初始化），换成接口后必然变成异步，`useBooks` 里就得多一个"加载中"状态，首屏不能再假定数据已经到了；二是 `saveRecords` 现在同步返回结果，异步化之后"保存成功/失败"的提示要改成 await 之后设置。**能只改一个文件是当初分层的回报，但异步化会连带影响状态层的时序，这一点不能假装没事。**

### 业务逻辑 / 排查能力

**Q12：这个项目里你遇到过最麻烦的问题是什么？**

答：**搜索功能一直失败，而且浏览器控制台一条错误都没有。** 我的排查过程是这样的：
1. 先怀疑自己的代码 —— 用本地模拟接口（返回和 Open Library 同结构的数据）把"搜索 → 加入书架 → 书架展示 → 刷新不丢"整条链路跑通，证明代码没问题；
2. 排除 CORS —— CORS 报错的前提是请求已经到达服务器并返回响应头，而我这边**根本没拿到任何 HTTP 状态码**；
3. 定位到网络层：查 DNS 发现 `openlibrary.org` 解析到了 Meta 的 IP 段，而且两次查询结果还不一样（DNS 劫持的典型特征）；用加密 DNS 拿到真实 IP 后，TCP 能连通但 TLS 握手被重置，说明是**基于域名的阻断**；对照组（百度、npm 镜像、GitHub）全部正常，说明本机网络没问题；
4. 还试了配置 Vite 开发代理 —— 为了判断"是代理配置写错还是目标连不上"，我**临时把代理目标换成一个可达的主机**做对照，返回 200 和真实数据，证明转发逻辑正确；换回真实目标仍然失败。
最后我的结论是：这是网络层的问题，代码解决不了。于是我给项目补了一个**不依赖网络的录入入口**（手动添加书籍），让应用先真正可用。
我觉得这个回答的价值不在"我解决了"，而在**展示了怎么一层层把故障范围缩小，并且如实说明哪些结论是实测的、哪些没有验证**。

---

*本文档中所有代码位置与行为都对应仓库里的真实实现。凡是未能复现或未实现的内容，都已明确标注。*
