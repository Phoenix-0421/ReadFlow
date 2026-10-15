# 第四阶段报告：阅读进度管理与读书笔记

| 项目 | 内容 |
| --- | --- |
| 报告日期 | 2026-10-15 |
| 项目路径 | `D:\项目\ReadFlow` |
| 本阶段目标 | 为每本书增加阅读进度管理与纯文本读书笔记，并保证校验、状态联动与本地持久化正确 |
| 新增文件 | 3 个 |
| 修改文件 | 7 个 |
| 类型定义变更 | **无**（`ReadingRecord` 早已预留相关字段，直接启用） |
| 新增依赖 | 无 |
| 验证 | `tsc -b --force` / `npm run build` / `npm run lint` 全部通过；**真实浏览器（headless Edge + Playwright over CDP）实测 6 个场景 + 3 项补测，全部通过** |

> 报告按你的指令写到 `docs/stage-4-report.md`。你前面把报告整理进了 `docs/1/`、`docs/2/`，`stage-3-report.md` 目前在 `docs/` 根下 —— 要统一编号的话告诉我，我来整理。

---

## 一、本阶段完成的功能

### 1. 阅读进度（数据 + 编辑 + 展示）

- **编辑**：详情页新增「阅读进度」区，两个输入框（当前读到第几页 / 总页数）+「保存进度」按钮。**点保存才写进正式数据**，输入过程中只改组件内部草稿。
- **校验**：负数、小数、文字、总页数为 0、当前页大于总页数——全部在保存前拦下，给出**具体**原因，并**保留用户已输入的内容**（实测确认）。
- **展示**：详情页显示百分比 + 一条纯 CSS 进度条 + 「86 / 302 页」；书架卡片上也显示同样的进度（紧凑模式）。
- **总页数未知**：只显示「已读 35 页」，**不显示百分比、不显示进度条**，不编造数字。
- **百分比不落库**：每次渲染由 `currentPage / totalPages` 现算，存储里只有页数，没有百分比字段。

### 2. 读书笔记

- 详情页新增「读书笔记」区：一个支持换行的 textarea + 「保存笔记」按钮，另有「放弃修改」把草稿还原成已保存的内容。
- **不自动保存**：直接离开页面 = 放弃未保存的修改（实测：切走后回来，未保存的编辑不会残留）。
- 已保存的笔记在详情页以**纯文本**展示（`white-space: pre-wrap` 保留换行），**没有使用 `dangerouslySetInnerHTML`**。
- 笔记跟着图书记录走：删除图书时笔记一并消失（实测确认）。
- 保存成功/失败都有提示；保存失败时提示语明确写成「笔记已在页面上更新，但保存到浏览器本地存储失败……」，不会把失败说成成功。

### 3. 阅读状态与进度联动

- 状态切换为 **已读完** 时：总页数已知 → 当前页自动补到总页数（实测 20/200 → 200/200，100%）；总页数未知 → **只改状态，不虚构页数**（实测确认）。
- 进入已读完时记录 `finishedAt`，详情页显示「读完于 2026/10/15」。
- 从已读完切回其他状态时：**清空 `finishedAt`**，但**保留原有进度**（实测仍是 200/200，没有被清零），**笔记也保留**。
- 规则只实现了一处（`lib/reading.ts` 的 `applyStatusChange`），书架页的状态下拉框调的就是它 —— 没有第二套逻辑。

### 4. 顺手修掉的一个隐藏 Bug（重要）

`src/lib/storage.ts` 里的 `parseRecord` 原来只返回 `{ book, status, addedAt }`，**把其它字段全丢了**。也就是说：即使把 `currentPage` / `note` 存进 localStorage，**刷新一次就会消失**。

本阶段把它改成：可选字段合法就带上、不合法就当作没设置（而不是丢掉整条记录），并顺手维持「当前页不超过总页数」这条不变式。**不修这个，进度和笔记功能等于白做。**

### 5. 复用而非重建

| 已有能力 | 本阶段处理 |
| --- | --- |
| `ReadingRecord` 里的 `currentPage` / `totalPages` / `note` / `finishedAt` | 第一阶段就预留好了，**直接启用，零迁移** |
| `storage.ts` 的读写与容错框架 | 复用，只补了字段解析 |
| `useBooks` 作为唯一数据源 | 复用，新增三个操作挂在同一个 `commit` 上 |
| `BookListItem` / `CoverImage` / `.panel` / `.field` / `.feedback` 等 | 复用，只给 `BookListItem` 加了一个可选插槽 |
| 书架页的状态下拉框、筛选、删除 | 未改动逻辑，只把 `updateStatus` 的返回值用于提示 |

---

## 二、新增和修改的文件及其职责

### 新增（3 个）

| 文件 | 行数 | 职责 |
| --- | --- | --- |
| `src/lib/reading.ts` | 134 | **纯业务规则**：状态联动的 `applyStatusChange`、写进度的 `applyProgress`、写笔记的 `applyNote`、算百分比的 `computeProgressPercent`、保存前校验的 `parseProgressInput`、作者文案 `formatAuthors`。不依赖 React。 |
| `src/components/ProgressBar.tsx` | 50 | 进度展示：百分比 + CSS 进度条；总页数未知时不给百分比；`compact` 模式供书架卡片用。 |
| `src/components/ReadingEditor.tsx` | 194 | 详情页的「阅读进度 + 读书笔记」编辑区：两套草稿状态、两套校验与提示、两个保存按钮。**必须带 `key={图书id}` 使用**（见第四节说明）。 |

### 修改（7 个）

| 文件 | 行数变化 | 改了什么 |
| --- | --- | --- |
| `src/lib/storage.ts` | 138 → 163 | 修 `parseRecord`：保留 `currentPage` / `totalPages` / `note` / `finishedAt`；新增 `parsePageNumber` |
| `src/hooks/useBooks.ts` | 93 → 126 | 新增 `updateProgress` / `updateNote`；把「保存」从 `useEffect` 改成操作内同步 `commit`（原因见第五节） |
| `src/components/BookListItem.tsx` | 38 → 37 | 加可选 `progress` 插槽；`formatAuthors` 改为从 `lib/reading.ts` 引入（消除重复） |
| `src/pages/BookDetailPage.tsx` | 33 → 100 | 从占位页改成真实详情页：图书信息 + 状态标签 + 完成时间 + 编辑区；找不到书时给友好提示 |
| `src/pages/ShelfPage.tsx` | 334 → 336 | 卡片加进度展示；状态切换/删除改用返回值区分「成功」与「成功但没存进本地」 |
| `src/App.tsx` | 39 → 49 | 把 `books` / `updateProgress` / `updateNote` 传给详情页 |
| `src/App.css` | 531 → 668 | 追加进度条、详情页头部、编辑表单、笔记展示等样式（全部复用已有 CSS 变量） |

**未改动**：`src/pages/HomePage.tsx`、`src/pages/SearchPage.tsx`、`src/lib/openLibrary.ts`、`src/lib/manualBook.ts`、`src/components/{AppLayout,CoverImage}.tsx`、`src/types/reading.ts`、`package.json`、`vite.config.ts`、所有 tsconfig。

---

## 三、阅读进度与笔记的数据结构

**类型定义一个字都没改**（`src/types/reading.ts`），因为第一阶段就预留好了：

```
export interface ReadingRecord {
  book: BookMetadata
  status: ReadingStatus
  addedAt: string          // ISO 时间字符串

  currentPage?: number     // 当前读到第几页；非负整数；未记录时字段不存在
  totalPages?: number      // 总页数；正整数；未知时字段不存在
  note?: string            // 纯文本笔记；为空时字段不存在（不存空字符串）
  finishedAt?: string      // 读完时间；只有已读完状态才存在
}
```

四条约定：

1. **「没有值」用「字段不存在」表示，不用 0 或空字符串**
   - 总页数未知 → `totalPages` 字段不存在（而不是 0）
   - 笔记为空 → `note` 字段不存在（而不是 `''`）
   - 这样"未知"和"确实为 0"不会混淆。清除时用 `delete next.totalPages` 而不是赋 undefined，存进 JSON 后更干净。
2. **`currentPage` 允许为 0**（刚翻开第一页之前），**`totalPages` 必须 ≥ 1**。
3. **不存百分比**。百分比永远由 `currentPage / totalPages` 现算，避免"存了两份、对不上"。
4. **localStorage 里的形状就是 `ReadingRecord[]` 的 JSON**，键名仍是 `readflow:records:v1`。因为只新增了可选字段，**前三个阶段存下来的数据原样可读**，不需要迁移。

一条真实记录长这样（测试时从 localStorage 里读出来的）：

```
{
  "book": { "id": "manual:三体|刘慈欣", "title": "三体", "authors": ["刘慈欣"], "firstPublishYear": 2008 },
  "status": "reading",
  "addedAt": "2026-10-15T06:42:27.358Z",
  "totalPages": 200,
  "currentPage": 200,
  "note": "第三章读书笔记：\n黑暗森林法则的推演很精彩。\n\n1. 猜疑链\n2. 技术爆炸\n\n待整理。"
}
```

---

## 四、输入校验与进度百分比的计算逻辑

### 4.1 校验：保存前一次性检查，全部通过才写

集中在 `lib/reading.ts` 的 `parseProgressInput`（返回 `{ ok: true, currentPage, totalPages }` 或 `{ ok: false, message }`）：

```
// 空字符串 = 不设置这一项
if (currentText !== '') {
  if (!/^\d+$/.test(currentText)) {
    return { ok: false, message: '当前页数请填 0 或正整数，不要填负数、小数或文字。' }
  }
  currentPage = Number(currentText)
  if (!Number.isSafeInteger(currentPage)) return { ok: false, message: '当前页数太大了…' }
}

if (totalText !== '') {
  if (!/^\d+$/.test(totalText)) return { ok: false, message: '总页数请填正整数…' }
  totalPages = Number(totalText)
  if (totalPages < 1) {
    return { ok: false, message: '总页数必须大于 0；如果不知道总页数，请把它留空。' }
  }
}

// 改了总页数之后，当前页要重新检查一遍
if (totalPages !== undefined && currentPage !== undefined && currentPage > totalPages) {
  return { ok: false, message: '当前页数（X）不能大于总页数（Y），请修改后再保存。' }
}
```

**为什么用正则而不是 `Number()` 直接转**：
`Number('')` 是 0、`Number('abc')` 是 NaN、`Number('-5')` 是 -5、`Number('1e3')` 是 1000 —— 这些都能"悄悄变成数字"然后被写进数据里。用 `/^\d+$/` 先卡住格式，就从源头上避免了 NaN、空字符串、负数、小数、科学计数法进库。这也是"不要滥用 any"之外的另一半：**类型正确不等于数据正确，外部输入必须做运行时校验**。

**校验失败时的行为**（实测确认）：只显示错误提示，**不动任何已保存数据**，并**保留用户当前输入**，方便改一个字符再按保存。

**当前页 > 总页数时选择"阻止保存"而不是"自动修正"**：因为自动把 300 改成 200 会**悄悄改掉用户填的数字**，用户可能只是打错了一位；明确告诉用户哪里不对、让他自己改，比替他做决定更安全。

### 4.2 百分比：现算 + 钳制 + 未知时返回 null

```
export function computeProgressPercent(currentPage?: number, totalPages?: number): number | null {
  if (totalPages === undefined || totalPages <= 0) return null   // 未知 -> null
  const current = currentPage ?? 0
  const percent = Math.round((current / totalPages) * 100)
  return Math.min(100, Math.max(0, percent))                     // 钳制到 0~100
}
```

三个返回值语义分明：

| 情况 | 返回 | 页面表现 |
| --- | --- | --- |
| 有合法总页数 | 0~100 的整数 | 进度条 + 「86% · 86 / 302 页」 |
| 没有总页数 | `null` | 「已读 35 页（未设置总页数，无法计算百分比）」 |
| 什么都没记 | `null` | 「还没有记录阅读进度」 |

返回 `null` 而不是 `0` 是关键 —— 如果用 0 表示"未知"，页面就只能显示 0%，那是在**编造一个"你一点没读"的假信息**。类型上用 `number | null` 强制调用方先判断，想混也混不了。

**为什么钳制**：正常情况下校验保证了 `current ≤ total`，钳制是给"localStorage 被外部改坏"这种异常兜底，让界面永远不出现 −20% 或 340%。

### 4.3 草稿状态：为什么编辑要好几个 state

`ReadingEditor` 里有 4 个 state：

| state | 作用 |
| --- | --- |
| `progressForm` | 两个输入框的草稿（`{ currentPage: string, totalPages: string }`） |
| `noteDraft` | 笔记输入框的草稿 |
| `progressFeedback` | 进度区的提示（成功/错误） |
| `noteFeedback` | 笔记区的提示 |

**输入框里是字符串，不是数字**。这是必须的：用户输入空串（比如 ""）、"`20.`"、"`abc`" 这种中间状态时，如果 state 是 `number` 就没法表示。所以草稿用字符串保存"用户正在打的东西"，**只有保存时**才把它转成数字并写进正式数据。

### 4.4 一个必须用 key 解决的坑

从《三体》跳到《活着》时，**React Router 是复用同一个 `BookDetailPage` 实例**，组件不会重新挂载，`useState` 的初始值也不会重新计算 —— 结果就是 **A 书的笔记残留在 B 书的输入框里**。

解决办法是在详情页给编辑区加 `key`：

```
<ReadingEditor
  key={record.book.id}      // 书变了 -> React 认为是不同元素 -> 卸载重建 -> 草稿自然重置
  record={record}
  updateProgress={updateProgress}
  updateNote={updateNote}
/>
```

**这一点在真实浏览器里验证过**（用浏览器后退/前进触发客户端路由切换，不是整页刷新）：
- A → B：三个输入框全部为空、不显示已保存笔记区、进度提示回到"还没有记录阅读进度"；
- B → A：输入框恢复成 A 的已保存数据。

---

## 五、阅读状态与进度之间的联动逻辑

只有一处实现（`lib/reading.ts` → `applyStatusChange`），书架页的状态下拉框调的就是它：

```
export function applyStatusChange(record: ReadingRecord, status: ReadingStatus): ReadingRecord {
  if (status === 'finished') {
    const next = { ...record, status, finishedAt: new Date().toISOString() }
    // 总页数已知：把当前页补到总页数；总页数未知：只改状态，不虚构页数
    if (record.totalPages !== undefined) next.currentPage = record.totalPages
    return next
  }

  // 离开「已读完」：清掉完成时间；已记录的进度和笔记原样保留
  const next = { ...record, status }
  delete next.finishedAt
  return next
}
```

逐条对应要求：

| 要求 | 实现 | 实测 |
| --- | --- | --- |
| 状态自由切换 | 没有方向限制，任何状态都能切到任何状态 | 通过 |
| 变成 finished 且总页数已知 → 当前页 = 总页数 | `if (record.totalPages !== undefined) next.currentPage = record.totalPages` | 20/200 → 200/200，100% |
| 变成 finished 且总页数未知 → 不虚构 | 上面的 if 不成立，什么都不做 | 状态变 finished、记录里没有 currentPage/totalPages、卡片不显示进度 |
| 进入 finished 记录完成时间 | `finishedAt = new Date().toISOString()` | 详情页显示「读完于 2026/10/15」 |
| 离开 finished 清除 finishedAt | `delete next.finishedAt` | 详情页该行消失 |
| 离开 finished 不清零进度 | 只删 finishedAt，不碰 currentPage | 切回「正在读」后仍是 200/200 |
| 改状态不丢笔记 | `{ ...record }` 展开保留了 `note` | 笔记仍在 |
| 状态变化正确写进 localStorage | 走 `commit`（下一节） | 直接读 localStorage 核对通过 |

**为什么规则放在 lib 而不是组件里**：这是产品规则，不是 UI 行为。放在纯函数里，第一书架页的状态下拉框能用，第二将来详情页加状态切换也能用，第三可以脱离浏览器单独推演。如果写在下拉框的 `onChange` 里，将来多一个入口就会多一份拷贝，迟早不一致。

---

## 六、localStorage 的数据更新流程

### 6.1 本阶段对写入机制做的一次修改（重要）

原来是「`setBooks` → `useEffect([books])` → `saveRecords`」。本阶段改成**在操作里同步保存**：

```
function commit(next: ReadingRecord[]): SaveRecordsResult {
  latestBooks.current = next          // ① 记住最新数组（下一次操作基于它算）
  setBooks(next)                      // ② 更新 React 状态 -> 触发重渲染
  const result = saveRecords(next)    // ③ 立刻写 localStorage，并拿到结果
  setStorageError(result.ok ? null : result.message)
  return result                       // ④ 把结果返回给调用它的页面
}
```

**为什么改**：
1. **只有这里知道写入成功没有**。要求里说"不要把保存失败提示为保存成功"——原来保存发生在 effect 里，点击处理器拿不到结果，页面只能无条件提示"已保存"。改完之后页面写的是「已是保存状态」还是「已更新，但保存到本地失败」取决于真实返回值。
2. **顺带解决了"挂载时误写一次"**：以前要靠 `hasUserEdited` 这个 ref 挡住初始化阶段的写入；现在没有 effect，只有用户操作才会调 `commit`，这个隐患从结构上消失了（那个 ref 也删掉了，代码更少）。
3. **不会在每次渲染后无条件写入**：一次用户操作 = 一次写入。

> ⚠️ 说明：这一改动让 `docs/stage-3-report.md` 第五节里画的"`setBooks` → `useEffect` → `saveRecords`"流程**已过时**，以本节为准。其余结论（单一数据源、派生筛选、写失败有提示）不变。改完后我重新跑了第三阶段的全部行为（筛选 / 改状态 / 删除 / 刷新持久化），没有回归。

**`latestBooks` 这个 ref 解决什么**：如果操作里直接用渲染时的 `books`，那么"先改进度、紧接着改笔记"这种连续操作，第二次会基于**旧数组**计算，把第一次的修改覆盖掉。用 ref 始终指向最新数组就没有这个问题。

### 6.2 三种操作的完整链路

```
【保存进度】
ReadingEditor.handleProgressSubmit
  → parseProgressInput(草稿)              校验，不通过就只提示、不改数据
  → useBooks.updateProgress(id, cur, tot)
      → latestBooks.current.map(...)      生成新数组，目标那本换成新的 ReadingRecord
      → applyProgress(record, cur, tot)   生成新对象（改 currentPage/totalPages，其余字段原样带过）
      → commit(next)                      → setBooks(next)
                                          → saveRecords(next)
                                          → setStorageError(...)
                                          → 返回 SaveRecordsResult

【保存笔记】
ReadingEditor.handleNoteSubmit → updateNote(id, noteDraft) → applyNote → commit

【切换状态（书架页下拉框）】
ShelfPage.handleStatusChange → updateStatus(id, status) → applyStatusChange → commit
```

### 6.3 读与容错（未改动，但本阶段修了字段解析）

```
刷新页面 → useBooks() → useState(loadRecords)   ← 惰性初始化，同步执行一次
  → localStorage.getItem('readflow:records:v1')
      ├─ 抛异常（无痕模式）        → 空数组 + 提示
      ├─ null（首次使用）           → 空数组
      ├─ JSON.parse 失败 / 不是数组 → 空数组 + corrupted
      └─ 成功 → 逐条 parseRecord
            ├─ book / status / addedAt 不合法       → 丢弃这一条
            ├─ totalPages 非法（≤0 / 非整数）        → 当作没设置
            ├─ currentPage 非法（<0 / 非整数）       → 当作没设置
            ├─ currentPage > totalPages              → 钳到 totalPages（维持不变式）
            ├─ note / finishedAt 非字符串            → 当作没设置
            └─ 其余照常保留
  → 首屏渲染的就是真实数据
```

**关键原则**：读取时"字段级容错"，不因为一个坏字段丢掉整条记录；写入时"严格校验"，不合法就不写。

---

## 七、实际执行的构建、类型检查与测试结果

### 7.1 静态检查（真实执行）

| # | 命令 | 结果 |
| --- | --- | --- |
| 1 | `npx tsc -b --force` | 退出码 0，无输出（全量类型检查） |
| 2 | `npm run build` | 退出码 0。转译 **108 个模块**；`index.html` 0.46 kB、`index.css` 10.04 kB、`index.js` 282.17 kB（gzip 88.79 kB） |
| 3 | `npm run lint` | 退出码 0，无告警 |

> 中间过程有一次真实报错：改完 `useBooks` 的返回类型后，`ShelfPage` 的 props 还写着返回 `void`，`tsc` 报了 4 个 `TS2339`。我修正了 props 类型后重跑通过 —— 这里记录下来是因为它正好说明类型约束起了作用（如果当时用 `any` 糊过去，这个不一致就会被带到运行时）。

### 7.2 浏览器交互测试（**实际执行**）

**测试方式**：本轮 Codex 的内置浏览器工具不可用，所以从 Codex 运行时加载 Playwright，用 PowerShell 启动一个**带远程调试端口的 headless Microsoft Edge**（独立临时 profile，不影响你日常使用的浏览器），通过 **CDP** 连上去做真实点击与输入。

> 这是**真实浏览器、真实 DOM、真实键盘输入、真实 `window.confirm`**，不是服务端渲染模拟，也不是读代码推断。测试数据存在临时 profile 里，**没有污染你真实浏览器的数据**；测试结束后 Edge 进程、临时 profile、开发服务器全部已关闭并删除。

#### 场景 1：正常更新进度 —— 通过

| 步骤 | 观察结果 |
| --- | --- |
| 填 20 / 200 并保存 | 提示「阅读进度已保存。」；显示 **10% · 20 / 200 页**；进度条 `width: 10%` |
| 刷新页面 | 仍是 **10% · 20 / 200 页**，输入框恢复为 20 / 200 |
| 直接读 localStorage | 记录里出现 `"currentPage": 20, "totalPages": 200` |

> 这一条同时验证了 `storage.ts` 的修复 —— 修复前刷新后这两个字段会消失。

#### 场景 2：非法输入 —— 通过（5 种全部拦下）

| 输入 | 提示 | 输入框 | 已保存的进度 |
| --- | --- | --- | --- |
| 当前页 `-1` | 当前页数请填 0 或正整数，不要填负数、小数或文字。 | 保留 `-1 / 200` | 未被改坏（仍是 10% · 20/200） |
| 总页数 `0` | 总页数必须大于 0；如果不知道总页数，请把它留空。 | 保留 | 未被改坏 |
| `300 / 200` | 当前页数（300）不能大于总页数（200），请修改后再保存。 | 保留 | 未被改坏 |
| 当前页 `abc` | 当前页数请填 0 或正整数…… | 保留 | 未被改坏 |
| 当前页 `20.5` | 当前页数请填 0 或正整数…… | 保留 | 未被改坏 |
| 两项都留空 | 阅读进度已保存。 | — | 记录里 `currentPage` / `totalPages` 字段消失 |

#### 场景 3：未知总页数 —— 通过

清空总页数、当前页填 35 并保存后：

- 详情页显示「**已读 35 页（未设置总页数，无法计算百分比）。**」
- **没有百分比**（`.progress__text` 数量为 0）、**没有进度条**（`.progress__fill` 数量为 0）
- 刷新后依然保留，输入框为 `["35", ""]`
- 书架卡片显示紧凑版「已读 35 页」

#### 场景 4：读书笔记 —— 通过

| 步骤 | 观察结果 |
| --- | --- |
| 输入 6 行、含空行的多行笔记并保存 | 提示「笔记已保存。」；笔记以纯文本原样展示，换行保留 |
| 刷新页面 | textarea 内容与已保存笔记完全一致 |
| 切到《活着》 | textarea **为空**、不显示已保存笔记区、提示「还没有笔记」 |
| 切回《三体》 | 笔记完整恢复 |

**另外补测了客户端路由切换**（用浏览器后退/前进触发，不是整页刷新）：A → B 时三个输入框全部为空、不显示上一本的笔记；B → A 时正确恢复 A 的数据。**这验证了 `key={record.book.id}` 确实解决了串书问题。**

#### 场景 5：状态联动 —— 通过

| 步骤 | 观察结果 |
| --- | --- |
| 进度设成 20 / 200（10%） | — |
| 在书架把《三体》标记为已读完 | 书架卡片立即变成 **100% · 200 / 200 页** |
| 去详情页看 | 100% · 200 / 200 页；输入框 200 / 200；状态标签「已读完」；出现「读完于 2026/10/15」；**笔记仍在** |
| 在书架改回「正在读」 | 进度**仍是 200 / 200**（没被清零）；详情页「读完于」那一行**消失**；**笔记仍在** |
| localStorage 核对 | `status: "reading"`、`currentPage: 200`、`totalPages: 200`、**无 `finishedAt`**、`note` 完整 |

**补测（无总页数的书标记已读完）**：《活着》没有记过页数，标记为已读完之后，记录里只有 `status: "finished"` 和 `finishedAt`，**没有生成 `currentPage` / `totalPages`**，书架卡片也没有显示任何进度 —— 符合"不虚构页数"的要求。

#### 场景 6：删除 —— 通过

| 检查项 | 结果 |
| --- | --- |
| 删除《三体》（有进度 + 笔记） | 反馈「《三体》已从书架移除。」 |
| 剩余图书 | 只有《活着》，数据完好 |
| 筛选计数 | 全部 1 / 想读 0 / 正在读 0 / 已读完 1 |
| 笔记是否随之消失 | **是**（localStorage 里已搜不到"黑暗森林"） |
| 其他图书是否受影响 | **否** |

### 7.3 控制台

累计 2 条 error，内容都是：

```
WebSocket connection to 'ws://localhost:5180/?token=...' failed: Page entered Back-Forward Cache.
```

这是 **Vite 开发服务器的 HMR WebSocket 在我做"后退/前进"测试时被浏览器放进 BFCache 而断开**的提示，**属于我的测试手法产生的，不是应用代码的报错**。除此之外全流程 0 报错。

### 7.4 未执行的检查

| 检查项 | 状态 |
| --- | --- |
| 单元测试 / E2E 测试框架 | **未执行** —— 项目没有配置测试框架（依赖里没有 vitest / jest / @playwright/test），我用的 Playwright 来自 Codex 运行时，**没有加进项目依赖** |
| localStorage 写入失败的真实场景 | **未执行** —— 需要把浏览器配额写满或禁用存储才能复现，本次没做；代码路径是 `try/catch` + 返回值 + 提示条 |
| 窄屏 / 移动端视觉走查 | **未执行** |

---

## 八、已知问题与未实现的功能

### 已知问题

1. **详情页没有状态切换控件**。状态切换仍然只在书架页的下拉框里做。这是本阶段有意的范围控制（要求里详情页只提了"进度"和"笔记"两区），但确实不够顺手 —— 想标记"读完"得先回书架。
2. **书架卡片还不能点进详情页**。详情页入口尚未实现，目前只能直接输入 `/books/<id>` 访问。导航栏的「书籍详情」也仍指向占位的 `/books/demo`。
3. **笔记是"纯文本 + 保换行"，没有做 Markdown 渲染**（有意为之：渲染用户输入需要额外依赖和 XSS 防护，不在本阶段范围）。
4. **详情页的进度输入框在全书级别上不会实时联动**：例如你在输入框里把总页数从 200 改成 100，但当前页还是 200，必须点保存才会看到"不能大于总页数"的提示。这是"显式保存"设计的必然结果，我认为比"边打字边报错"更好用。
5. **删除不可恢复**，没有回收站 / 撤销。
6. **搜索功能仍不可用** —— 网络层被阻断，与本阶段无关（见 `docs/openlibrary-debug-report.md`）。

### 未实现

- 首页统计（三个状态计数、正在阅读、最近完成）—— 首页仍是静态占位
- 导入 / 导出 / 备份
- 笔记检索、标记、富文本
- 阅读时长、阅读目标、图表

---

## 九、你应该优先理解的关键代码

| 顺序 | 位置 | 为什么重要 |
| --- | --- | --- |
| 1 | `src/lib/reading.ts` 的 `parseProgressInput` | **本阶段最该吃透的一段**：正则校验、错误信息、以及"为什么不用 Number()" |
| 2 | `src/lib/reading.ts` 的 `computeProgressPercent` | 理解「返回 null 而不是 0」的语义差别，以及钳制的意义 |
| 3 | `src/lib/reading.ts` 的 `applyStatusChange` | 状态联动的全部规则；注意"总页数未知时不虚构页数"那个 if |
| 4 | `src/hooks/useBooks.ts` 的 `commit` | 唯一写入路径；理解 `latestBooks` ref 为什么必须存在 |
| 5 | `src/components/ReadingEditor.tsx` 顶部注释 + `useState` 初始化 | 草稿模型；以及为什么详情页必须用 `key` |
| 6 | `src/pages/BookDetailPage.tsx` 里 `key={record.book.id}` 那一行 | 一个字符解决一个真实 Bug |
| 7 | `src/lib/storage.ts` 的 `parseRecord` | 运行时校验的写法：字段级容错、不合法就丢弃、顺手维持不变式 |

---

## 十、面试官可能针对本阶段提出的 5 个问题

**Q1：用户输入页数，你怎么保证不会把 NaN 或者空字符串写进数据里？**

答：分两层。**第一层是类型**：输入框的值在 state 里始终是 `string`，因为用户打字过程中必然出现 `""`、`"20."` 这种中间态，用 `number` 存根本表示不了。**第二层是保存前的运行时校验**：`parseProgressInput` 用 `/^\d+$/` 先卡格式，再 `Number()` 转换。为什么不直接用 `Number()`？因为 `Number('')` 是 0、`Number('abc')` 是 NaN、`Number('-5')` 是 −5、`Number('1e3')` 是 1000 —— 它们都会"悄悄变成数字"。校验不通过就只提示、不改数据。**类型正确不等于数据正确，所以外部输入必须校验。**

**Q2：进度百分比你是存一份还是算出来的？为什么要钳制到 0~100？**

答：**只算不存**。存一份百分比就等于同一个事实有了两份数据，页数一改就得记着同步改百分比，迟早不一致。钳制是给异常数据兜底 —— 正常情况下校验已经保证当前页不超过总页数，但如果 localStorage 被外部改坏，没有钳制就会渲染出 −20% 或 340% 这种明显不正常的东西。另外没有总页数时我返回 `null` 而不是 `0`：`0%` 的含义是"一页没读"，用来表示"不知道"就是在编造信息；返回 `null` 还能用类型逼着调用方先判断。

**Q3：把状态改成"已读完"的时候，进度和笔记会不会丢？**

答：不会，而且这条我专门测过。`applyStatusChange` 里用的是展开运算符生成新对象：变成已读完时，如果总页数已知就把 `currentPage` 补成总页数，同时写入 `finishedAt`；如果总页数未知就**只改状态，不碰页数字段**（不虚构）。从已读完切回其他状态时，只 `delete finishedAt`，`currentPage` 和 `note` 原样保留 —— 实测改回"正在读"后进度仍是 200/200，笔记也还在。

**Q4：从一本书的详情页点到另一本书，输入框里的内容是怎么处理的？**

答：这是本阶段最容易踩的坑。React Router 在不同参数（`/books/A` → `/books/B`）之间**不会重新挂载页面组件**，`useState` 的初始值只在首次挂载时算一次，所以 B 书的输入框会显示 A 书的内容 —— 就是"串书"。解决办法是给编辑区加 `key={record.book.id}`：key 变了 React 就当成另一个元素，卸载旧的、挂载新的，草稿自然重置。我用浏览器的后退/前进触发客户端路由切换实测过：A→B 时输入框全空、不显示上一本的笔记；B→A 时正确恢复。

**Q5：保存失败的时候，页面上会不会还显示"保存成功"？**

答：不会。这是我这一阶段特意改的一处：原来数据是用 `useEffect` 监听 state 变化再写 localStorage 的，点击保存的那一刻页面拿不到写入结果，只能无条件提示"已保存"。现在把写入挪进操作里同步执行 —— `commit` 先更新状态、再调 `saveRecords`、拿到 `{ ok, message }` 并返回给调用方。页面据此显示「阅读进度已保存」或者「进度已在页面上更新，但保存到浏览器本地存储失败……」，用词上也能看出区别。顺带还消掉了一个隐患：没有 effect 就不存在"首屏挂载时误写一次"，原来用来挡这个的 `hasUserEdited` ref 也就删掉了。

---

*本报告只记录实际执行与观测到的结果。测试方式已在第七节说明，未执行的检查已逐条标注，没有把未完成的功能写成已完成。*
