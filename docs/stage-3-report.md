# 第三阶段报告：书架管理（筛选 / 状态切换 / 删除）

| 项目 | 内容 |
| --- | --- |
| 报告日期 | 2026-10-15 |
| 项目路径 | `D:\项目\ReadFlow` |
| 本阶段目标 | 完善书架管理：阅读状态切换、状态筛选、图书删除，以及数据同步 |
| 新增文件 | 0 个（全部复用已有模块） |
| 修改文件 | 4 个（`useBooks.ts`、`ShelfPage.tsx`、`App.tsx`、`App.css`） |
| 新增依赖 | 无 |
| 数据结构变更 | **无**（现有类型已满足要求，直接复用） |
| 验证 | `tsc -b --force` / `npm run build` / `npm run lint` 全部通过；**真实浏览器（Edge + Playwright over CDP）实测 5 个场景 + 回归，全部通过，控制台 0 报错** |

> 说明：报告按你的指令写到 `docs/stage-3-report.md`。我注意到你已经把前面的报告整理进了 `docs/1/`、`docs/2/` 这样的编号目录 —— 如果你想统一，把本文件移到 `docs/3/` 即可，或者告诉我，我来移。

---

## 一、本阶段完成的功能

### 1. 状态筛选（/shelf）

- 四个筛选项：**全部 / 想读 / 正在读 / 已读完**，默认「全部」。
- 每个筛选项后面显示**实时数量**（如「全部 3」）。
- 当前筛选有明确视觉反馈（复用第一阶段的 `.chip--current` 样式：墨绿描边 + 浅绿底 + 加粗）。
- 点击只改变"显示哪些书"，**不修改原始书架数据**。
- 筛选结果随状态变化、随删除**自动更新**（因为它是每次渲染现算的，不是存下来的）。
- 两种空状态分开处理：
  - **书架完全为空** → 「书架还是空的」+ 手动添加 / 前往搜索两个入口；
  - **当前筛选下没有书** → 「这个筛选下还没有书」+ 「查看全部图书」按钮。

### 2. 阅读状态切换

- 每条图书记录右侧有一个**状态下拉框**，直接选就能改：想读 ⇄ 正在读 ⇄ 已读完，**三个方向自由切换，不做限制**。
- 下拉框会按当前状态换颜色（想读=灰蓝、正在读=墨绿、已读完=棕），一眼能看出处于什么阶段。
- 改完立刻生效：状态文字变、筛选计数变；**如果这本书不再符合当前筛选，它会立刻从列表里移出**，并给出提示（如「《三体》已改为「正在读」。」）。
- 切换状态**不会碰到标题、作者、封面、年份、加入时间**（实现上是生成新对象并保留其余字段）。

### 3. 删除图书

- 每条记录有「移除」按钮。
- 点击后弹出**浏览器原生 `window.confirm`**，文案明确写出「这本书的阅读状态和本地阅读记录会一起删除，且无法恢复」（不引入任何弹窗库）。
- **取消** → 数据完全不变（实测：3 本还是 3 本，计数不变）。
- **确认** → 只移除目标那一条，其他图书不受影响；列表、各状态数量、筛选结果立即更新；localStorage 同步；删到最后一本时正确显示空书架。

### 4. 数据同步与持久化

- 添加、改状态、删除三个操作**都走同一份书架数据**（`App` 里那一次 `useBooks()` 提供的 `books`）。
- 三个操作都会触发同一条持久化路径，刷新后状态与删除结果都保持。
- 页面重新加载后默认筛选回到「全部」。
- 没有新增任何 localStorage 读写代码 —— 全部复用 `src/lib/storage.ts`。

### 5. 复用了已有实现（没有重复开发）

| 已有能力 | 本阶段如何处理 |
| --- | --- |
| `ReadingStatus` 联合类型、`STATUS_LABELS` | **直接复用**，没有重新定义 |
| `ReadingRecord` / `BookMetadata` 结构 | **完全没改**，没有重命名字段，localStorage 里的旧数据天然兼容 |
| localStorage 读写与容错 | **直接复用** `lib/storage.ts` |
| 图书列表渲染 | **直接复用** `components/BookListItem.tsx`（用它已有的 `children` 插槽塞进状态下拉框和删除按钮） |
| 封面占位 | **直接复用** `components/CoverImage.tsx` |
| 筛选按钮样式 | **直接复用** 第一阶段就写好但一直没用的 `.chip` / `.chip--current` |
| 手动添加书籍 | **保持原样可用**（实测回归通过） |

---

## 二、新增和修改的文件及职责

| 文件 | 类型 | 行数变化 | 职责 |
| --- | --- | --- | --- |
| `src/hooks/useBooks.ts` | 修改 | 72 → 93 | 新增 `updateStatus(id, status)` 与 `removeBook(id)` 两个操作，成为三种改动唯一的写入口 |
| `src/pages/ShelfPage.tsx` | 修改 | 170 → 318 | 筛选栏 + 筛选结果计算 + 状态下拉框 + 删除确认 + 两种空状态 |
| `src/App.tsx` | 修改 | 29 → 39 | 把 `updateStatus` / `removeBook` 传给书架页 |
| `src/App.css` | 修改 | 465 → 531 | 追加筛选计数、状态下拉框、危险按钮、空状态按钮组的样式；把 `.chip` 调整为可点击按钮、把 `.book-item__action` 改为横向排列 |

**新增文件：0 个。** 没有创建新的 Hook 或组件 —— 因为筛选是页面自己的事、状态更新与删除属于已有的数据层职责，抽出去只是把代码挪个地方，没有复用价值。

**未改动**（本阶段完全没碰）：`src/lib/storage.ts`、`src/lib/manualBook.ts`、`src/lib/openLibrary.ts`、`src/types/reading.ts`、`src/components/` 下三个组件、`src/pages/{HomePage,SearchPage,BookDetailPage}.tsx`、`src/index.css`、`src/main.tsx`、`package.json`、`vite.config.ts`、所有 tsconfig。

---

## 三、当前书架数据结构与阅读状态的类型定义

**本阶段没有修改任何类型**，以下就是当前代码里的实际定义（`src/types/reading.ts`）：

```
/** 阅读状态：只允许这三种取值 */
export type ReadingStatus = 'want-to-read' | 'reading' | 'finished'

/** 阅读状态对应的中文展示文案 */
export const STATUS_LABELS: Record<ReadingStatus, string> = {
  'want-to-read': '想读',
  reading: '正在读',
  finished: '已读完',
}

/** 图书元数据：来自 Open Library 的书目信息快照 */
export interface BookMetadata {
  id: string                 // 唯一标识（Open Library key 或 manual:书名|作者）
  title: string
  authors: string[]          // 空数组表示未知作者
  coverUrl?: string          // 缺失时走 CSS 占位
  firstPublishYear?: number  // 缺失时不显示该行
}

/** 书架里的一条记录 = 元数据快照 + 个人阅读数据 */
export interface ReadingRecord {
  book: BookMetadata
  status: ReadingStatus
  addedAt: string            // ISO 时间字符串
  // 以下为后续阶段预留，本阶段不读写
  currentPage?: number
  totalPages?: number
  note?: string
  finishedAt?: string
}
```

**三个要点**：

1. **状态是联合类型，不是 `string`**。写 `'reading1'` 这类值会直接在编译期报错；`STATUS_LABELS` 用 `Record<ReadingStatus, string>`，将来加第四种状态时如果忘了补文案，编译期也会报错。
2. **元数据（书本身）与阅读记录（我和书的关系）是分开的两层**，记录里放的是元数据的**快照**，所以展示书架完全不需要请求接口。
3. **localStorage 兼容性**：本阶段没有改结构、没有重命名字段，所以之前存下来的数据（包括手动添加的书）原样可用。读取时还有一层运行时校验（`storage.ts` 的 `parseRecord`）：字段缺失或状态值非法的记录会被单独丢弃，其余保留，不会因为一条坏数据毁掉整个书架。

---

## 四、筛选、状态更新、删除的核心实现

### 4.1 筛选：每次渲染现算，不存第二份数据

```
const visibleBooks =
  filter === 'all' ? books : books.filter((record) => record.status === filter)

function countOf(value: StatusFilter): number {
  return value === 'all'
    ? books.length
    : books.filter((record) => record.status === value).length
}
```

- `filter` 是页面局部状态（`useState<StatusFilter>('all')`），初始值就是「全部」，所以刷新后自动回到「全部」。
- **列表和数量都是从 `books` 现算的**，没有另存一份"筛选结果"或"各状态计数"。因此改一个状态、删一本书之后，列表与数量不可能对不上 —— 它们本来就是同一次计算的两个结果。
- 筛选是纯读取，不写回数据，所以"筛选操作不修改原始书架数据"是**结构上保证**的，不是靠自觉。

### 4.2 状态更新：生成新对象，只替换状态字段

`src/hooks/useBooks.ts`：

```
function updateStatus(id: string, status: ReadingStatus) {
  hasUserEdited.current = true
  setBooks((prev) =>
    prev.map((record) => (record.book.id === id ? { ...record, status } : record)),
  )
}
```

三处要点：

1. `prev.map(...)` 生成**新数组**，没有直接改原数组；
2. `{ ...record, status }` 生成**新对象**，且只覆盖 `status` 一个字段 —— `book`（标题/作者/封面/年份）、`addedAt` 以及将来预留的 `currentPage` / `note` 都原样带过去，所以不会"改状态把信息改没了"；
3. 按 `record.book.id` 精确定位，其他记录保持同一个对象引用（React 里可以少做无用渲染）。

### 4.3 删除：按 id 过滤掉一条

```
function removeBook(id: string) {
  hasUserEdited.current = true
  setBooks((prev) => prev.filter((record) => record.book.id !== id))
}
```

`filter` 只会剔除 id 匹配的那一条，**其他图书记录连引用都不变**，所以不存在"误删其他书"的可能。删到最后一条时数组变成 `[]`，页面走空书架分支。

### 4.4 删除确认

`ShelfPage` 里用原生 `window.confirm`：

```
const confirmed = window.confirm(
  '确定要从书架移除《' + record.book.title + '》吗？\n\n' +
  '这本书的阅读状态和本地阅读记录会一起删除，且无法恢复。',
)
if (!confirmed) return
removeBook(record.book.id)
```

取消时直接 `return`，**不触发任何写操作**，所以"取消后数据不变"是天然成立的。

### 4.5 为什么没有抽自定义 Hook 或新组件

- 筛选逻辑只有两行，且只服务于书架页 —— 抽成 Hook 只是换个地方写。
- 状态下拉框和删除按钮只出现在书架页（详情页本阶段没做同步编辑）—— 没有第二处使用，抽成组件没有复用价值。
- 与"数据"有关的三件事（添加 / 改状态 / 删除 + 持久化）**已经全部集中在 `useBooks`**，页面里剩下的只是"渲染 + 收集用户意图"，这个边界是清楚的。

---

## 五、React 状态与 localStorage 之间的数据流

```
                  ┌──────────────── useBooks()（唯一数据源与唯一写入口）────────────────┐
                  │                                                                    │
   首屏           │  useState(loadRecords)  ← 惰性初始化，同步读取，只执行一次          │
                  │        ↓                                                           │
                  │  books: ReadingRecord[]  ────────────────► localStorage             │
                  │        ↑                                        ↑                   │
                  │        │ setBooks(函数式更新)                    │ saveRecords(books)│
                  │        │                                        │                   │
                  │  addBook / updateStatus / removeBook ────────────┘                   │
                  │        └─ 三者都会先置 hasUserEdited.current = true                   │
                  └────────────────────────────────────────────────────────────────────┘
                           │
                           │ props 下发（同一个数组）
                           ▼
                  <ShelfPage books … />   <SearchPage books … />
                       │                        │
                  筛选/计数现算               判断是否已在书架
```

**关键点**：

1. **读一次**：`useState(loadRecords)` 是同步惰性初始化，首屏拿到的就是真实数据，不存在"先空再加载"的中间态。
2. **写多次，但只在用户真的改过之后**：`useEffect([books])` 里先判断 `hasUserEdited.current`，为 false 直接返回。这样初始化阶段（含开发模式 StrictMode 的重复执行）不会产生任何写入。
3. **三个操作共用同一条写入路径**，因为它们改的是同一个 state，effect 只需要写一处。
4. **写入失败不会被当成成功**：`saveRecords` 返回 `{ ok, message }`，失败时 `useBooks` 把消息塞进 `storageError`，`AppLayout` 在导航栏下方渲染成提示条。（本阶段未改动这条链路。）

---

## 六、重要的技术决策及原因

### 决策 1：不改数据结构，直接复用已有的预留字段

`ReadingRecord` 在第一阶段就预留了 `currentPage` / `totalPages` / `note` / `finishedAt`，本阶段只用到 `status`。**结果是零迁移成本**：localStorage 里已有的记录（包括第三阶段之前手动添加的）原样可读，因为字段名没变、结构没变。

### 决策 2：筛选状态放在页面里，不放全局

筛选条件是"我这个页面的临时视图状态"，刷新后回到默认「全部」是符合直觉的。放进全局反而会污染"书架数据"的语义。

### 决策 3：状态用下拉框而不是三个按钮

三个按钮横排会让每一行都很拥挤，尤其书架长了之后视觉噪音很大。下拉框一个控件解决"显示当前状态 + 切换状态"两件事，而且在移动端是原生的选择器体验。下拉框的颜色跟着状态变，视觉上仍然能一眼分辨。

### 决策 4：空状态分两种，而不是合成一种

"书架空了"和"这个筛选下没书"是**两个不同的问题**，给的出路也不同：前者要引导去录书，后者只需要切回全部。合成一种会让用户困惑"我明明有书啊"。

### 决策 5：就地替换规则而不是追加新规则

`.chip` / `.chip--current` 是第一阶段的样式，一直没人用。本阶段直接把筛选按钮做成 `<button class="chip">`，并且为了支持按钮补了 `display: inline-flex` / `cursor: pointer`；`.book-item__action` 也从"单个元素"改成横向 flex 容器。**没有新造一套筛选样式**，视觉与前两阶段自然一致。

---

## 七、构建、TypeScript 检查和实际测试结果

### 7.1 静态检查（真实执行）

| # | 命令 | 结果 |
| --- | --- | --- |
| 1 | `npx tsc -b --force` | 退出码 0，无任何输出（全量类型检查，绕过增量缓存） |
| 2 | `npm run build` | 退出码 0。转译 **105 个模块**；产出 `index.html` 0.46 kB、`index.css` 8.35 kB、`index.js` 275.00 kB（gzip 87.16 kB） |
| 3 | `npm run lint` | 退出码 0，无告警 |

### 7.2 浏览器交互测试（**实际执行**）

**测试方式**：本轮 Codex 的内置浏览器工具不可用，所以我改用另一条路 —— 从 Codex 运行时里加载 Playwright，用 PowerShell 启动一个**带远程调试端口的 headless Microsoft Edge**（不影响你正在用的浏览器，用的是临时 profile），再通过 **CDP** 连上去做真实点击。

> 也就是说：**这是真实浏览器、真实 DOM、真实点击和真实 `window.confirm`**，不是服务端渲染模拟，也不是靠读代码推断。测试用的 Data 存在临时 profile 里，**没有污染你真实浏览器的数据**；测试结束后 Edge、临时 profile、开发服务器都已关闭并删除。

**场景 1：筛选**

| 操作 | 结果 |
| --- | --- |
| 造 3 本书，状态分别为 想读 / 正在读 / 已读完 | 筛选按钮显示：全部 3 / 想读 1 / 正在读 1 / 已读完 1 |
| 点「全部」 | 列表 = 三体、活着、百年孤独；文案「共 3 本。」 |
| 点「想读」 | 列表 = 三体；文案「想读：1 本（书架共 3 本）。」 |
| 点「正在读」 | 列表 = 活着 |
| 点「已读完」 | 列表 = 百年孤独 |

每次都检查了**高亮项**（`.chip--current`）与点击项一致。**通过。**

**场景 2：状态切换与筛选联动**

在「想读」筛选下把《三体》改成「正在读」：

- 列表从 `["三体"]` 变成 `[]`（**从不符合筛选的结果里被正确移除**）
- 出现空状态「这个筛选下还没有书」
- 计数从 全部3/想读1/正在读1/已读完1 → **全部3/想读0/正在读2/已读完1**
- 反馈「《三体》已改为「正在读」。」
- 切回「全部」后三本书的**标题、作者、首次出版年份全部完好**（验证了"切换状态不清除元数据"）

**通过。**

**场景 3：删除**

| 操作 | 结果 |
| --- | --- |
| 点「移除」后**取消** | 弹窗文案 = 「确定要从书架移除《三体》吗？⏎⏎这本书的阅读状态和本地阅读记录会一起删除，且无法恢复。」；条数仍为 3；计数不变 |
| 点「移除」后**确认** | 条数 3 → 2；仅《三体》消失，另两本完好；计数 → 全部2/正在读1/已读完1；反馈「《三体》已从书架移除。」 |

**通过。**

**场景 4：持久化**

改状态后刷新：状态保持（都是 finished）、**默认筛选回到「全部」**、已删除的《三体》**没有复活**。
直接读 `localStorage.getItem('readflow:records:v1')`，内容是两条结构完整的记录（`book` 快照 + `status` + `addedAt`）。**通过。**

**场景 5：边界情况**

| 情况 | 结果 |
| --- | --- |
| 筛选结果为空 | 显示「这个筛选下还没有书」+ 「查看全部图书」按钮；点击后回到「全部」并显示 2 本 |
| 连续删除到一本不剩 | 显示「书架还是空的」，按钮为「手动添加书籍 / 前往书籍搜索」；筛选栏消失、工具栏隐藏；localStorage 变成 `[]` |
| 刷新后再确认 | 仍然 0 本 + 空状态 |

**通过。**

**回归检查**

- 手动添加书籍仍然正常（重新加了 3 本）；
- 重复添加校验仍然生效（提示「《三体》已经在书架里了。」，条数不变）；
- 全流程**浏览器控制台 0 个错误**。

### 7.3 未执行的检查

| 检查项 | 状态 |
| --- | --- |
| 单元测试 / E2E 测试框架 | **未执行** —— 项目没有配置测试框架（依赖里没有 vitest / jest / @playwright/test） |
| 移动端真机 / 窄屏视觉走查 | **未执行** —— 只验证了功能，没有在窄屏下实际查看布局 |

---

## 八、已知问题与未实现的功能

### 已知问题

1. **删除书架里的书是不可恢复的**，没有回收站或撤销（本阶段明确不做）。
2. **状态下拉框只能改状态**，标题/作者/年份仍然不能编辑；填错只能删了重加。
3. **筛选条件不做 URL 同步**，刷新或分享链接都会回到「全部」（这是有意选择，不是缺陷）。
4. **书架列表没有排序**，按加入顺序展示（先加的在前）。
5. **图书详情页（`/books/:id`）仍然是占位页**，看不到真实数据；导航栏的「书籍详情」入口仍指向 `/books/demo`。
6. **搜索功能仍不可用** —— 网络层被阻断（DNS 污染 + TLS 阻断），代码本身没问题，详见 `docs/openlibrary-debug-report.md` 与 `docs/openlibrary-proxy-report.md`。

### 未实现

- 阅读进度（当前页 / 总页数 / 百分比）
- 读书笔记
- 详情页展示真实数据
- 首页统计（三个计数、正在阅读、最近完成）
- 导入 / 导出、数据备份

---

## 九、你需要优先理解的文件与代码位置

按"读懂顺序"排列：

| 顺序 | 文件 | 重点看什么 |
| --- | --- | --- |
| 1 | `src/hooks/useBooks.ts`（93 行） | **整个阶段的核心**。看 `useState(loadRecords)` 为什么这么写、`hasUserEdited` 这个 ref 解决了什么问题、三个操作怎么都走同一条写入路径 |
| 2 | `src/pages/ShelfPage.tsx` 第 44-52 行 | `visibleBooks` 和 `countOf` —— 理解"派生状态"：为什么不把筛选结果和数量存下来 |
| 3 | `src/hooks/useBooks.ts` 第 73-77 行 | `updateStatus`：`map` + 展开运算符，理解"生成新对象只替换一个字段" |
| 4 | `src/hooks/useBooks.ts` 第 79-83 行 | `removeBook`：`filter` 按 id 剔除 |
| 5 | `src/pages/ShelfPage.tsx` 第 100-112 行 | `handleDelete`：原生 `confirm` + 提前返回 |
| 6 | `src/lib/storage.ts` | 持久化与容错：为什么读不抛异常、为什么写要返回结果 |
| 7 | `src/types/reading.ts` | 数据结构；注意 `STATUS_LABELS` 用 `Record<ReadingStatus, string>` 的用意 |

---

## 十、面试官可能提出的 5 个问题

**Q1：筛选后的列表和"每个状态有几本"你是怎么维护的？**

答：**没有维护，全部是每次渲染现算的**。`visibleBooks` 就是 `books.filter(...)`，计数就是 `books.filter(...).length`。这样做的直接好处是：改状态、删书之后，列表和数量不可能不一致 —— 它们是同一次计算的产物。如果存一份计数，就会出现"计数改了但列表没改"这类难查的问题。筛选条件本身存在页面局部 state，所以刷新后自然回到默认的「全部」。

> 追问：会不会有性能问题？书架规模在个人使用场景下是几十到几百本，每次渲染做几次 filter 的成本可以忽略；真到瓶颈，`useMemo` 就够了。

**Q2：修改一本书的状态时，你怎么保证不会把它的标题、作者、封面弄丢？**

答：用 `prev.map((r) => r.book.id === id ? { ...r, status } : r)`。关键字是**展开运算符只覆盖 `status` 这一个字段**，`book` 快照、`addedAt` 以及以后新增的字段都会被原样带到新对象里。同时 `map` 生成的是新数组、新对象，没有修改原对象 —— 符合 React 的状态更新方式。我在浏览器里实测过：把《三体》在筛选状态下改状态，切回「全部」后标题、作者、出版年份都还在。

**Q3：删除是怎么做的？删除时窗口关闭了怎么办？**

答：删除用 `prev.filter((r) => r.book.id !== id)`，按唯一 id 精确剔除一条，其他记录连引用都不变，所以不可能误删。删除前用浏览器原生 `window.confirm`，用户取消就直接 `return`，不触发任何写入 —— 所以"取消后数据不变"是结构上成立的。删除后 state 变化会触发同一个 `useEffect` 写回 localStorage。

> 追问：窗口直接关掉呢？数据已经在 localStorage 里了，`setBooks` 到写入之间是同步的一段代码，用户来不及在这个窗口里关掉页面。

**Q4：你怎么保证不会在每次渲染时都写一遍 localStorage？**

答：写入放在 `useEffect([books])` 里，只在 `books` 这个引用变化时执行。另外我在 effect 里先用一个 `hasUserEdited` 的 ref 做判断：**只有用户真正改动过数据之后才允许写**。这个 ref 同时解决了两件事 —— 一是初始化阶段（包括开发模式 StrictMode 会把 effect 跑两次）不会产生无意义写入；二是本地数据损坏时，不会被初始化时的一次空数组写回给覆盖掉。

**Q5：如果 localStorage 写失败，会不会出现"提示保存成功、其实没保存"？**

答：不会。`saveRecords` 内部用 try/catch 包住 `setItem`，返回 `{ ok: true }` 或 `{ ok: false, message }`，**它是唯一知道写入结果的地方**。`useBooks` 根据返回值设置 `storageError`，由 `AppLayout` 在导航栏下方渲染成提示条（比如"保存到浏览器本地存储失败，本次改动可能在刷新页面后丢失"）。页面上的"已加入书架"这类提示只表达"数据已经进入应用状态"，而存储层的问题有独立的、更显眼的通道，两者不会互相冒充。

---

*本报告只记录实际代码与实测结果。测试方式已在第七节说明，未执行的检查也已逐条标注。*
