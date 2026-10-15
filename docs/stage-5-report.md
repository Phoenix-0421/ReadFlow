# 第五阶段报告：首页数据看板与阅读概览

| 项目 | 内容 |
| --- | --- |
| 报告日期 | 2026-10-15 |
| 项目路径 | `D:\项目\ReadFlow` |
| 本阶段目标 | 让首页基于现有书籍数据展示统计、正在阅读和最近读完 |
| 新增文件 | 1 个（`src/lib/stats.ts`） |
| 修改文件 | 6 个 |
| 新增依赖 | 无 |
| 数据模型变更 | **无**（没加字段，也没往 localStorage 里存任何统计数据） |
| 验证 | `tsc -b --force` / `npm run build` / `npm run lint` 全部退出码 0；**真实浏览器实测 12 个场景全部通过，控制台 0 报错** |

---

## 一、本阶段完成的功能

### 1. 阅读统计卡片

- 三张卡片（沿用第一阶段就存在的 `.stat-grid` / `.stat-card` 结构和样式）：**想读 / 正在读 / 已读完** 各显示一个数字。
- 数字由当前 `books` 现算，**没有存进 localStorage，也没有在页面里维护第二份数据**（实测确认 localStorage 里只有图书记录字段，没有任何统计字段）。
- 添加、删除、改状态之后数字自动跟着变（实测四个方向都验证过）。
- 没有书时三项都显示 0（实测确认）。

### 2. 正在阅读区域

- 展示所有状态为 `reading` 的书，按书架里的原有顺序。
- 每条包含：封面（缺失或加载失败走既有 CSS 占位）、书名、作者（缺失显示「未知作者」）、出版年份、**阅读进度**、「查看详情」入口。
- **整行可点击**：封面和文字部分包在 `<Link>` 里，点一下直接进 `/books/:id`（实测跳转成功）。另有一个显式的「查看详情」链接。
- 进度展示复用已有的 `ProgressBar` 组件：
  - 总页数有效 → 进度条 + 「28% · 86 / 302 页」
  - 当前页为 0 → 正确显示 0%
  - 总页数未知 → 「已读 35 页（未设置总页数，无法计算百分比）」，**不显示百分比、不显示进度条**（实测确认）
- 没有正在阅读的书 → 显示「还没有正在阅读的书」+ 「前往我的书架」按钮。

### 3. 最近读完区域

- 只取 **状态是 `finished` 且 `finishedAt` 能解析** 的书，按完成时间**从新到旧**排，**最多 3 本**。
- 每条展示封面、书名、作者、「读完于 2026/10/15」。
- 同样整行可点击进详情页。
- 实测：书架里 5 本已读完，这里只显示最新 3 本且顺序正确；删掉最新那本后，第 4 本会自动补进来。
- 没有已读完的书 → 显示「还没有读完的书」+ 入口。

### 4. 顺手做的一处复用

`BookDetailPage` 里原本用 `new Date(record.finishedAt).toLocaleDateString()` 内联格式化日期。本阶段把它抽成 `lib/reading.ts` 的 `formatDate()`，**详情页和首页共用同一个实现**，避免两处各写一份格式规则。日期只用了原生 `Date`，没有引入任何日期库。

### 5. 明确没有做的事

- 没有接入任何外部 API（Open Library / Google Books 都没碰）。
- 没有新增依赖（`package.json` 未改动）。
- 没有改数据结构、没有加新字段、没有动 `storage.ts` 和 `useBooks.ts` 的任何逻辑。
- 没有把统计数字、正在阅读列表或最近读完列表存进 localStorage。
- 没有重做整体布局，只加了两条新样式规则和一处类名改名（见第二节）。

---

## 二、修改或新增的文件及其作用

### 新增（1 个）

| 文件 | 行数 | 作用 |
| --- | --- | --- |
| `src/lib/stats.ts` | 47 | **集合级的派生计算**（纯函数、不依赖 React）：`countByStatus` 数三种状态各有几本、`selectReadingBooks` 挑正在阅读、`selectRecentlyFinished` 挑最近读完并排序截断、`toTimestamp` 安全解析时间字符串 |

> 为什么不放进已有的 `lib/reading.ts`：那里放的是**单条记录的规则**（改状态、写进度、写笔记、校验），而这里是**对整个数组的统计与筛选**，职责不同。一个文件一个关注点，也让首页变得很薄。

### 修改（6 个）

| 文件 | 行数变化 | 改了什么 |
| --- | --- | --- |
| `src/pages/HomePage.tsx` | 38 → 120 | 从静态占位改成真实看板：统计卡片 + 正在阅读 + 最近读完 + 两个空状态 |
| `src/components/BookListItem.tsx` | 37 → 54 | ① `progress` prop 改名为 `extra`（现在既放进度也放完成时间，"progress"这个名字已经名不副实）；② 新增可选 `to`，传了就把封面+信息包成一个 `<Link>`，让整行可点 |
| `src/lib/reading.ts` | 134 → 147 | 新增 `formatDate`（原生 Date 实现，无效输入返回空字符串） |
| `src/pages/BookDetailPage.tsx` | 100 → 100 | 日期格式化改为复用 `formatDate`（去掉内联的 `toLocaleDateString`） |
| `src/App.tsx` | 49 → 49 | 一行：给首页传 `books` |
| `src/pages/ShelfPage.tsx` | 336 → 336 | 跟着把 `progress={` 改成 `extra={`（配合改名） |
| `src/App.css` | 668 → 706 | 新增 `.home-section` / `.home-section__title` / `.book-item__link` / `.book-item__hint`；把 `.book-item__progress` 改名为 `.book-item__extra`（共 5 处）；顺手合并了一处重复定义 |

**完全没动**：`src/lib/storage.ts`、`src/hooks/useBooks.ts`、`src/components/ProgressBar.tsx`、`src/components/CoverImage.tsx`、`src/components/AppLayout.tsx`、`src/pages/SearchPage.tsx`、`src/types/reading.ts`、`src/lib/{manualBook,openLibrary}.ts`、`package.json`、所有 tsconfig。

---

## 三、首页的数据来源和计算逻辑

### 3.1 数据来源：一条链路，零新增状态

```
useBooks()（App 里调用一次）
   └─ books: ReadingRecord[]        <- 唯一数据源，来自 localStorage
        │
        ├─ props 传给 <HomePage books={books} />
        │
        └─ HomePage 渲染时现算三样东西：
             countByStatus(books)           -> 统计数字
             selectReadingBooks(books)      -> 正在阅读列表
             selectRecentlyFinished(books)  -> 最近读完列表
```

**首页自己没有 `useState`、没有 `useEffect`、不读 localStorage、不请求任何接口。** 它只是一个纯展示层：拿到数组 → 算出三块内容 → 渲染。

### 3.2 两个刻意的"不做"

**不做 1：不存统计。**
如果往 localStorage 里写 `{ wantToRead: 2, reading: 1, finished: 5 }`，那么每次增删改都得记着同步改这份统计，漏一处就会出现"卡片说 8 本、书架里只有 7 本"这类最难查的问题。现在统计是 `books` 的一个投影，**从结构上不可能不一致**。

**不做 2：不在页面里复制一份数组。**
首页直接使用传进来的 `books`，筛选和排序都用 `filter` / `sort` 生成的新数组，不保存成 state。

---

## 四、统计数字、阅读进度、最近读完的计算方式

### 4.1 统计数字：一次遍历数三种状态

```
export function countByStatus(records: ReadingRecord[]): StatusCounts {
  const counts: StatusCounts = { 'want-to-read': 0, reading: 0, finished: 0 }
  for (const record of records) {
    counts[record.status] += 1        // 状态是联合类型，key 一定存在
  }
  return counts
}
```

- 返回类型是 `Record<ReadingStatus, number>`，**三种状态都有值**：没有书时三项是 0，而不是 `undefined`（否则页面上会出现空白或 undefined）。
- 状态是联合类型 `'want-to-read' | 'reading' | 'finished'`，所以 `counts[record.status]` 不会越界；将来如果加了第四种状态，`StatusCounts` 少写一个 key 会在编译期报错。
- 复杂度 O(n)，个人使用规模（几十到几百本）下每次渲染跑一遍完全可以忽略。

### 4.2 阅读进度：复用第二/四阶段已有的计算

首页没有重新写百分比逻辑，直接用 `ProgressBar` 组件，而它内部调的是 `computeProgressPercent`：

```
export function computeProgressPercent(currentPage?: number, totalPages?: number): number | null {
  if (totalPages === undefined || totalPages <= 0) return null   // 未知 -> null，不编造
  const current = currentPage ?? 0
  return Math.min(100, Math.max(0, Math.round((current / totalPages) * 100)))
}
```

首页对三种情况的表现（实测）：

| 数据 | 首页显示 |
| --- | --- |
| `currentPage: 86, totalPages: 302` | 进度条（width 28%）+ 「28% · 86 / 302 页」 |
| `currentPage: 0, totalPages: 200` | 0%（不是空、不是 NaN） |
| `currentPage: 35`，无 `totalPages` | 「已读 35 页（未设置总页数，无法计算百分比）」，**无条、无百分比** |
| 两项都没有 | 「还没有记录阅读进度。」 |

百分比**也是现算的，没有存储**。

### 4.3 最近读完：过滤 → 排序 → 截断

```
export function selectRecentlyFinished(
  records: ReadingRecord[],
  limit: number = RECENTLY_FINISHED_LIMIT,   // 3
): ReadingRecord[] {
  return records
    .filter((record) => record.status === 'finished' && toTimestamp(record.finishedAt) !== null)
    .sort((a, b) => (toTimestamp(b.finishedAt) ?? 0) - (toTimestamp(a.finishedAt) ?? 0))
    .slice(0, limit)
}
```

四个要点：

1. **只保留状态是已读完、并且 `finishedAt` 能解析成时间的记录**。
   为什么要多这个判断：第四阶段之前的旧数据里，`finishedAt` 是可选字段，状态是已完成但没有完成时间的记录可能存在（比如数据被手工改过）。如果不判断，`new Date(undefined)` 会得到 Invalid Date，展示层就得处理一堆边界情况；**在数据这一层挡掉最省事**。
2. **排序前先 `filter`**。`Array.prototype.sort` 是**原地排序**，会改动调用它的那个数组。这里 `filter` 已经返回了一个新数组，对它排序不会碰到传进来的 `books` —— 这一点很重要，直接对 props 排序就是在偷偷改 React 状态。
3. **`b - a` 是从新到旧**（降序）。时间字符串先经 `Date.parse` 转成毫秒数再比较，不能直接比字符串（不同格式/时区的字符串字典序不可靠）。
4. **`slice(0, 3)` 在最后**：不足 3 本时自然返回实际数量（实测 1 本时就显示 1 本）。

**`toTimestamp` 是安全阀**：

```
export function toTimestamp(iso: string | undefined): number | null {
  if (typeof iso !== 'string' || iso === '') return null
  const time = Date.parse(iso)
  return Number.isNaN(time) ? null : time
}
```

缺失、空串、乱码一律返回 `null`，调用方用 `?? 0` 兜底。这样"时间坏了"最多导致排序位置不理想，**不会让页面崩**。

### 4.4 日期展示

```
export function formatDate(iso: string | undefined): string {
  if (typeof iso !== 'string' || iso === '') return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString()
}
```

原生 `Date` + `toLocaleDateString()`，没有引入 dayjs / date-fns。无效输入返回空字符串，页面上会显示成「读完于 」而不是「读完于 Invalid Date」。

---

## 五、首页如何与现有书籍状态及持久化逻辑保持同步

### 5.1 同步机制：根本没有"同步"这回事

```
用户在书架/详情页操作
   -> useBooks 的某个操作（addBook / updateStatus / updateProgress / updateNote / removeBook）
   -> commit(next)：更新 state + 同步写 localStorage + 返回结果
   -> books 引用变化 -> React 重渲染
   -> <HomePage books={books} /> 拿到新数组
   -> 三块内容现算一遍 -> 页面自动是最新的
```

**首页不需要订阅、不需要事件、不需要 useEffect 去"拉"数据**。它渲染的东西就是那个被替换掉的数组，所以只要数据变了它就一定会重新算。这也是为什么"添加 / 删除 / 改状态 / 改进度后首页是否更新"这种问题在本项目里不需要单独处理。

本阶段**没有修改** `useBooks` 和 `storage.ts` 一行代码 —— 第四阶段把保存改成操作内同步 `commit` 之后，这条链路已经能满足首页的需要。

### 5.2 持久化：首页不参与，但受益于已有的容错

- 首页**不读也不写** localStorage。
- 刷新时仍是 `main.tsx → App → useBooks → useState(loadRecords)` 一次性同步读入；首页拿到的是已经恢复好的数据。
- 如果 localStorage 内容损坏，`loadRecords` 会按"字段级容错 + 丢弃非法条目"的方式降级，首页只需要展示剩下的合法数据，**不会白屏**。

### 5.3 实测的同步方向

| 操作 | 首页的表现 |
| --- | --- |
| 添加一本（想读） | 想读 0 → 1 |
| 改成正在读 | 想读 1 → 0、正在读 0 → 1，书出现在「正在阅读」 |
| 改进度到 86/302 | 「正在阅读」里的进度变成 28% · 86 / 302 页 |
| 清空总页数 | 变成「已读 35 页（未设置总页数…）」，不再显示百分比 |
| 改成已读完 | 从「正在阅读」消失，进入「最近读完」并显示完成日期 |
| 再添加 4 本并依次标记已读完 | 「最近读完」始终只显示最新 3 本，顺序正确 |
| 删除最新读完的那本 | 已读完 4，列表变成 围城 / 百年孤独 / 活着（第 4 本自动补位） |
| 刷新页面 | 统计、正在阅读、最近读完全部与刷新前一致 |

---

## 六、实际执行的检查、测试结果与未验证的部分

### 6.1 静态检查（真实执行）

| # | 命令 | 结果 |
| --- | --- | --- |
| 1 | `npx tsc -b --force` | 退出码 0，无输出（全量类型检查） |
| 2 | `npm run build` | 退出码 0。转译 **109 个模块**；`index.html` 0.46 kB、`index.css` 10.41 kB、`index.js` 283.92 kB（gzip 89.10 kB） |
| 3 | `npm run lint` | 退出码 0，无告警 |

> 项目没有单独的 `typecheck` 脚本，所以类型检查用的是 `npx tsc -b --force`（`npm run build` 里其实也包含 `tsc -b`，但加 `--force` 可以绕过增量缓存，确保是全量检查）。

### 6.2 浏览器交互测试（**实际执行**）

**测试方式**：本轮 Codex 内置浏览器工具不可用，因此从 Codex 运行时加载 Playwright，用 PowerShell 启动**带远程调试端口的 headless Microsoft Edge**（独立临时 profile），通过 CDP 连上去做真实点击与输入。

> 是真实浏览器、真实 DOM、真实点击。测试数据存在临时 profile 里，**没有污染你真实浏览器的数据**；测试结束后 Edge 进程、临时 profile、开发服务器全部已关闭并删除。

| # | 场景 | 结果 |
| --- | --- | --- |
| 1 | 没有任何书籍时 | 三张卡片都是 **0**；两个区域分别显示「还没有正在阅读的书」「还没有读完的书」；不白屏 |
| 2 | 添加一本「想读」的书 | 统计变成 想读 1 / 正在读 0 / 已读完 0 |
| 3 | 改成「正在读」 | 统计变成 0 / 1 / 0；书出现在「正在阅读」，显示书名、作者、进度、整行可点 + 「查看详情」；链接是 `/books/manual%3A…`（已正确编码） |
| 4 | 修改当前页数（86 / 302） | 首页显示 **28% · 86 / 302 页**，进度条 `width: 28%` |
| 5 | 总页数未知（当前页 35、总页数留空） | 显示「已读 35 页（未设置总页数，无法计算百分比）」；**页面里既没有百分比也没有进度条** |
| 6 | 改成「已读完」 | 从「正在阅读」消失（该区域回到空状态）；统计变 已读完 1 |
| 7 | 已读完且有完成时间 | 进入「最近读完」，显示「读完于 2026/10/15」；点它跳转到 `/books/manual:三体|刘慈欣`，详情页标题「三体」、状态「已读完」 |
| 8 | 最多 3 本 + 顺序 | 书架里 5 本已读完 → 首页只显示最新 3 本，顺序为 **平凡的世界 → 围城 → 百年孤独**（最后标记的排最前，最早的三体、活着被截掉） |
| 9 | 删除书籍 | 删掉「平凡的世界」后：已读完 5 → 4；列表变成 围城 / 百年孤独 / 活着（第 4 本自动补位） |
| 10 | 刷新页面 | 统计（0 / 1 / 4）、正在阅读、最近读完顺序，与刷新前完全一致 |
| 11 | 信息缺失 | 一本「没作者、没年份、没封面」的书出现在「正在阅读」：作者显示 **未知作者**、封面显示 **CSS 占位块**（提示显示"已读…"或"还没有记录阅读进度"），页面正常 |
| 12 | 窄屏 | 视口 360px：文档滚动宽度 345px，**无横向溢出**，越界元素数 **0** |
| 附加 | 控制台 | 全流程 **0 个 error** |
| 附加 | localStorage 检查 | 记录 key 只有 `book / status / addedAt / totalPages / currentPage / finishedAt`，**没有任何统计字段**，确认"不单独保存统计" |

### 6.3 未验证的部分（如实标注）

| 项目 | 状态 | 原因 |
| --- | --- | --- |
| 单元测试 / E2E 框架 | **未执行** | 项目没有配置测试框架；我用的 Playwright 来自 Codex 运行时，**没有加进项目依赖** |
| 封面图**加载失败**的 onError 兜底 | **未验证** | 本项目所有书都是手动录入、没有 `coverUrl`，走的是"没有封面 → 占位"这条路径；"有 URL 但图片 404 → onError 切占位"这条路径需要真实图片地址才能触发，本阶段没有外部数据可测 |
| 其它断点（平板 ~768px） | **未执行** | 只测了 1280px（桌面）和 360px（窄屏）两端 |
| 大量数据下的性能 | **未执行** | 只到 5～6 本的规模，没有做几百本的压测 |

---

## 七、当前仍存在的问题和已知限制

1. **统计卡片不可点击**。它只是展示数字，点了不会跳到书架的对应筛选。原因是书架的筛选条件存在页面 state 里、没有同步到 URL，做不到"点统计卡片直接看到那一类书"。要支持的话得先把筛选条件放进 query string（属于下一阶段的改动）。
2. **「最近读完」只显示 3 本，没有"查看全部"入口**。这是按需求实现的上限，但书读多了会想看全部。
3. **「正在阅读」会全部列出**，没有折叠或分页。个人使用规模下可接受，但如果同时"正在读"几十本，首页会很长。
4. **首页没有"添加书籍"入口**。空状态里给的是「前往我的书架」按钮，而添加表单在书架页顶部（需要再点一次「手动添加书籍」）。
5. **导航栏的「书籍详情」仍是占位入口**（指向 `/books/demo`），点进去会看到"没有找到这本书"。
6. **书架卡片本身还不能点进详情页**（首页可以，书架不行）—— 这是上一阶段遗留的，本次没动书架列表。
7. **搜索功能仍不可用**：网络层对 `openlibrary.org` 的阻断（DNS 污染 + TLS 阻断），与代码无关，详见 `docs/openlibrary-debug-report.md`。
8. **没有导入 / 导出 / 备份**：清空浏览器数据 = 记录全丢。

---

## 八、与本阶段相关的 5 个前端面试问题

**Q1：首页的三个统计数字是怎么得到的？为什么不把它们存起来？**

答：每次渲染时用 `countByStatus(books)` 遍历一遍数组数出来的，**不存**。存的话就变成了同一件事有两份数据 —— 每次添加、删除、改状态都得记着同步更新统计，漏一处就会出现"卡片说已读完 8 本、书架里只有 7 本"这种最难排查的问题。现在统计只是 `books` 的一个投影，从结构上不可能不一致。代价是每次渲染多一次 O(n) 遍历，个人使用规模（几十到几百本）下完全可以忽略；真到瓶颈再加 `useMemo` 就行。

**Q2：`selectRecentlyFinished` 里为什么先 `filter` 再 `sort`？如果直接对传进来的数组 `sort` 会怎样？**

答：因为 `Array.prototype.sort` 是**原地排序**，会修改调用它的那个数组。`books` 是从 `useBooks` 传来的 React 状态，直接 `sort` 就等于**在页面里偷偷改了全局状态**，而且改的是数组顺序、不会触发重渲染，属于那种"看起来没事、某一刻突然错乱"的 Bug。这里 `filter` 已经返回了一个**新数组**，对它排序是安全的。这也是 React 里最基本的一条纪律：**不要修改 props 和 state，要生成新的**。

**Q3：首页为什么不用 `useEffect` 去"监听数据变化"或者主动刷新？**

答：因为不需要 —— **首页自己没有状态**。它渲染的三块内容都是拿当前的 `books` 现算出来的纯函数结果。任何操作最终都会走到 `useBooks` 的 `commit`，替换掉 `books` 这个引用，React 就会重新渲染首页，三块内容自然重算。用 `useEffect` + `useState` 去"把数据同步到本地状态"反而会多出一份可能过期的副本，还要处理依赖数组，是典型的自找麻烦。判断标准很简单：**能在渲染时算出来的东西，就不要用 state 存**。

**Q4：如果某本书状态是"已读完"但 `finishedAt` 丢失或者格式坏了，会怎样？**

答：会被 `toTimestamp` 挡在列表外面。它先判断是不是非空字符串，再用 `Date.parse` 解析，解析出 `NaN` 就返回 `null`，而过滤条件是 `record.status === 'finished' && toTimestamp(record.finishedAt) !== null` —— 所以这类记录**不会进入「最近读完」**，也就不会在页面上渲染出 "读完于 Invalid Date" 或者因为拿 `undefined` 调 `new Date()` 而报错。另外排序时用 `(toTimestamp(...) ?? 0)` 兜底，即使出现意外也不会把排序搞乱。**核心思路是在数据这一层把脏数据挡掉，别把边界判断推给渲染层。**

**Q5：`BookListItem` 现在同时被书架、搜索页和首页使用，你怎么让一个组件服务三种场景又不变得臃肿？**

答：靠三个互不干扰的插槽，而不是往组件里塞 `mode` 之类的开关：
- `book`：必填，展示封面 / 书名 / 作者 / 年份，这三处完全一样；
- `extra`：可选，书架放阅读进度条，首页「最近读完」放完成时间；
- `to`：可选，传了就把封面+信息包成一个 `<Link>`（首页整行可点），不传就是普通展示；
- `children`：可选，右侧操作区，搜索页放「加入书架」按钮、书架页放状态下拉框和删除按钮。

这样差异全部由**调用方**决定，组件只负责"这三个场景共同的骨架"。如果哪天首页需要另一种附加信息，再加一个 `extra` 就够，不用改组件内部逻辑。反过来说，如果一开始就做成 `<BookListItem mode="shelf" | "search" | "home" />`，组件里就会出现一堆针对某个页面的条件分支 —— 那才是真正会变臃肿的写法。

---

*本报告只记录实际执行与观测到的结果。测试方式已在第六节说明，未验证的部分已逐条标注。*
