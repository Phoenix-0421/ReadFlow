# 手动添加书籍：改动报告 · 完整数据流 · 面试要点

| 项目 | 内容 |
| --- | --- |
| 报告日期 | 2026-10-14 |
| 项目路径 | `D:\项目\ReadFlow` |
| 本次改动 | 新增「手动添加书籍」功能，让应用在搜索接口不可用时依然可以录入书籍 |
| 新增文件 | 1 个（`src/lib/manualBook.ts`） |
| 修改文件 | 4 个（`ShelfPage.tsx`、`App.tsx`、`SearchPage.tsx`、`App.css`） |
| 新增依赖 | 无 |
| 验证 | `tsc -b --force` / `npm run build` / `npm run lint` 全部通过；真机浏览器逐项验证通过，控制台 0 报错 |

---

## 一、为什么做这个改动

前置事实：本机**无法访问 `openlibrary.org`**（DNS 污染 + TLS 阻断，已用 curl / TCP / DoH 多轮实测确认，详见 `docs/openlibrary-debug-report.md`）。

结果是：搜索的代码本身是对的，但**拿不到数据**。而原本「加入书架」的唯一入口就是从搜索结果里点按钮 —— 于是整个应用等于用不了。

所以本次补上一个**不依赖网络**的录入入口：用户自己填书名，直接进书架。

---

## 二、改动清单

| 文件 | 类型 | 行数变化 | 具体改了什么 |
| --- | --- | --- | --- |
| `src/lib/manualBook.ts` | **新增** | 0 → 72 | 把表单输入转成 `BookMetadata`：字段校验、作者拆分、生成稳定 ID |
| `src/pages/ShelfPage.tsx` | 修改 | 54 → 170 | 加「手动添加书籍」按钮 + 表单（开关、3 个输入框、校验反馈、提交） |
| `src/App.tsx` | 修改 | 29 → 29 | 一行：把 `addBook` 传给书架页 |
| `src/pages/SearchPage.tsx` | 修改 | 184 → 187 | 三行：在「开始搜索」面板加一句指引，指向手动添加 |
| `src/App.css` | 修改 | 408 → 465 | 追加 57 行：工具栏、表单、输入框样式 |

### 2.1 src/lib/manualBook.ts（新增）

**导出的东西**：

```
export interface ManualBookInput {
  title: string
  authors: string
  firstPublishYear: string
}

export type ManualBookResult =
  | { ok: true; book: BookMetadata }
  | { ok: false; message: string }

export function createManualBook(input: ManualBookInput): ManualBookResult
export function buildManualBookId(title: string, authors: string[]): string
```

**它做的三件事**：

1. **校验**：书名不能为空；年份必须能解析成 1～3000 的整数，或者留空。
2. **规范化**：作者输入框用中英文逗号、分号、顿号分隔（正则 `/[,，、;；]/`），拆成字符串数组。
3. **生成 ID**：`manual:` + 规范化后的书名 + `|` + 规范化后的作者。

**ID 生成是本次最关键的一处设计**：

```
const MANUAL_ID_PREFIX = 'manual:'

export function buildManualBookId(title: string, authors: string[]): string {
  return MANUAL_ID_PREFIX + normalize(title) + '|' + normalize(authors.join('/'))
}

function normalize(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase()
}
```

举例：填「三体」+「刘慈欣」→ ID 是 `manual:三体|刘慈欣`。

**为什么这么做**（下面第五节和第六节还会展开）：

- **用稳定 ID 而不是随机 ID**：因为整个应用的去重逻辑是 `record.book.id` 比较。随机 ID 会导致同一本书填两次就变成两条记录，去重直接失效。
- **加 `manual:` 前缀**：Open Library 的 key 形如 `/works/OL45804W`，加前缀可以保证两种来源的 ID 永不冲突。
- **normalize 里做 toLowerCase 和空格压缩**：避免「三体 」和「三体」被当成两本书。

### 2.2 src/pages/ShelfPage.tsx（54 → 170 行）

**新增的三个页面状态**：

```
const EMPTY_FORM = { title: '', authors: '', firstPublishYear: '' }

const [formOpen, setFormOpen] = useState(false)      // 表单是否展开
const [form, setForm] = useState(EMPTY_FORM)          // 三个输入框的值
const [feedback, setFeedback] = useState<Feedback | null>(null)  // 成功/警告提示
```

**新增的三个函数**：

| 函数 | 职责 |
| --- | --- |
| `updateField(field, value)` | 用一个函数更新三个输入框中的任意一个（`setForm(prev => ({ ...prev, [field]: value }))`） |
| `closeForm()` | 收起表单并清空内容 |
| `handleSubmit(event)` | 阻止默认提交 → 调 `createManualBook` 校验 → 调 `addBook` 写入 → 设置提示、清空并收起表单 |

**提交流程的三个分支**（这是最容易写错的地方）：

```
1. createManualBook 返回 ok: false  → 显示校验错误，表单保持打开（用户改一下就能重提）
2. addBook 返回 ok: false            → 显示「已经在书架里了」，表单保持打开
3. 两步都成功                        → 显示成功提示，清空表单、收起
```

### 2.3 src/App.tsx（1 行）

```
- <Route path="/shelf" element={<ShelfPage books={books} />} />
+ <Route path="/shelf" element={<ShelfPage books={books} addBook={addBook} />} />
```

### 2.4 src/pages/SearchPage.tsx（3 行）

在「开始搜索」面板里加了一句：

```
<p className="panel__hint">
  如果一直搜索失败，可以到「我的书架」用手动添加书籍。
</p>
```

### 2.5 src/App.css（+57 行）

新增 `.page__toolbar`、`.button--active`、`.manual-form`、`.manual-form__title`、`.manual-form__actions`、`.field`、`.field__label`、`.field__input`。
全部复用第一阶段定义的 CSS 变量（`--space-*`、`--color-*`、`--radius-*`），**没有引入新的颜色或尺寸**，所以视觉风格与原有页面一致。

---

## 三、没有改动的部分（很重要）

| 文件 | 为什么不用改 |
| --- | --- |
| `src/hooks/useBooks.ts` | 已经有 `addBook(book)`，它对「任何 `BookMetadata`」都适用 —— 手动录入的书也是 `BookMetadata`，所以复用它就够了 |
| `src/lib/storage.ts` | 读写 localStorage 的逻辑与"书从哪来"无关，天然复用 |
| `src/types/reading.ts` | `BookMetadata` 的字段（id / title / authors / coverUrl / firstPublishYear）已经够用，不需要加字段 |
| `src/components/BookListItem.tsx` | 它只认 `BookMetadata`，手动书照样能渲染 |
| `src/components/CoverImage.tsx` | 手动书没有 `coverUrl`，正好走它已有的 CSS 占位分支 |
| `src/lib/openLibrary.ts`、`vite.config.ts` | 与本次功能无关 |

**这说明了什么**：因为第一阶段就把「图书元数据」抽象成了统一的 `BookMetadata` 类型、把「数据入口」收在 `useBooks` 一个 Hook 里，所以新增一种数据来源只需要写"怎么把输入变成 `BookMetadata`"，其余全部自动复用。

---

## 四、完整数据流

### 4.1 全局架构（一句话）

**所有书架数据只有一个来源：`App` 组件里调用一次的 `useBooks()`。** 页面组件不碰 localStorage，也不各自存一份数据。

```
src/main.tsx
  └─ <BrowserRouter>
       └─ <App>  ← 这里调用一次 useBooks()
            │
            ├─ books: ReadingRecord[]        ← 唯一数据源
            ├─ addBook(book): AddBookResult  ← 唯一写入口
            └─ storageError: string | null
                 │
                 └─ <Routes>
                      ├─ /shelf   → <ShelfPage   books addBook />
                      ├─ /search  → <SearchPage  books addBook />
                      ├─ /        → <HomePage />
                      └─ /books/:id → <BookDetailPage />
```

### 4.2 路径 A：手动添加（本次新增）

```
① 用户在 /shelf 点「手动添加书籍」
      → setFormOpen(true)                    【页面局部状态，与全局数据无关】

② 用户在三个输入框里打字
      → updateField('title', value)
      → setForm(prev => ({ ...prev, title: value }))
      → 只是页面局部状态变化，全局 books 没有任何变化

③ 用户点「加入书架」或按 Enter
      → <form onSubmit={handleSubmit}> 触发 handleSubmit

④ handleSubmit 里：
      event.preventDefault()                 阻止浏览器刷新页面
      setFeedback(null)                       清掉上一次的提示
      createManualBook(form) ← src/lib/manualBook.ts
            ├─ 书名 trim 后为空？        → 返回 { ok: false, message: '书名不能为空。' }
            ├─ 年份不是 1~3000 整数？     → 返回 { ok: false, message: '出版年份请填写…' }
            └─ 通过 → 生成 BookMetadata：
                    {
                      id: 'manual:三体|刘慈欣',     ← 由书名+作者推导的稳定 ID
                      title: '三体',
                      authors: ['刘慈欣'],
                      firstPublishYear: 2008
                      // 没有 coverUrl → 后面会走 CSS 占位
                    }

⑤ addBook(book) ← src/hooks/useBooks.ts
      ├─ books.some(r => r.book.id === book.id) ？ 有 → 返回 { ok:false, reason:'duplicate' }
      └─ 没有 →
            hasUserEdited.current = true            （允许后续写入本地存储）
            setBooks(prev => [...prev, {
              book,                                  ← 元数据快照
              status: 'want-to-read',                ← 新书默认状态
              addedAt: new Date().toISOString()
            }])

⑥ React 重新渲染
      App 里的 books 变了
        → <ShelfPage books={books}> 拿到新数组 → 列表多了一本
        → useBooks 里的 useEffect([books]) 触发 → saveRecords(books)
              → localStorage.setItem('readflow:records:v1', JSON.stringify(books))
              → 失败则 setStorageError(...) → 导航栏下方出现提示条

⑦ 页面收尾
      成功 → setFeedback({ tone:'ok', text:'《三体》已加入书架。' })
             setForm(EMPTY_FORM)   清空输入框
             setFormOpen(false)    收起表单
```

**关键点**：全程**没有手动"通知"书架列表更新**。列表之所以变了，是因为它渲染的 `books` 就是那个被 `setBooks` 换掉的数组 —— 这也是为什么全程不需要任何"同步"代码。

### 4.3 路径 B：搜索添加（原有路径，供对比）

```
① 用户在 /search 输入关键词并提交
② runSearch(keyword) → searchBooks(keyword, signal)   ← src/lib/openLibrary.ts
      → fetch('/api/openlibrary/search.json?q=...&limit=20')
      → JSON → extractDocs() → toBookMetadata() 逐条映射 → BookMetadata[]
③ setState({ phase:'success', results })
④ 渲染列表时，每一条判断是否已在书架：
      books.some(r => r.book.id === book.id)
⑤ 点「加入书架」→ addBook(book) → 【从这里开始和路径 A 的 ⑤⑥⑦ 完全一样】
```

**两条路径在第 ⑤ 步汇合**。这说明设计是对的：`addBook` 不关心书从哪来，只关心"是不是一个合法的 `BookMetadata`"。

### 4.4 路径 C：启动与刷新恢复

```
浏览器加载 → main.tsx → <App> → useBooks() 首次执行
      ↓
const [initial] = useState(loadRecords)
      ↓  ← 传函数给 useState = 惰性初始化：只在首次渲染执行一次，而且是同步的
      ↓
loadRecords() ← src/lib/storage.ts
      ├─ localStorage.getItem('readflow:records:v1')
      │     ├─ 抛异常（无痕模式/被禁用） → { records: [], readError: '本地存储不可用…' }
      │     ├─ null（第一次使用）        → { records: [], readError: null }
      │     └─ 有字符串 → JSON.parse
      │           ├─ 解析失败 / 不是数组 → { records: [], corrupted: true, readError: '数据已损坏…' }
      │           └─ 成功 → 逐条 parseRecord 校验
      │                 ├─ 缺 id / 缺 title / status 非法 / 缺 addedAt → 丢弃这一条
      │                 └─ 合法 → 保留
      └─ 返回 { records, corrupted, readError }
      ↓
const [books, setBooks] = useState(initial.records)
const [storageError, setStorageError] = useState(initial.readError)
      ↓
首屏渲染时 books 就是真实数据 —— 不存在"先空再加载"的中间状态
      ↓
useEffect([books]) 首次执行时 hasUserEdited.current === false → 直接 return
      ↓  【关键】初始化阶段不写回 localStorage
```

**为什么初始化阶段必须不写回？**
假如写成"先 `useState([])`，再 `useEffect` 里异步读取"，那么首次渲染后写回逻辑可能先跑，把空数组写进 localStorage，**把用户原有数据覆盖掉**。本项目的两层防护：

1. `useState(loadRecords)` 同步惰性初始化 → 根本不存在"空数据阶段"；
2. `hasUserEdited` 这个 ref → **只有用户真正改动过数据之后才允许写回**（顺带也让开发模式下 StrictMode 的重复执行不会误写）。

### 4.5 数据在每一层的形态

| 阶段 | 数据长什么样 |
| --- | --- |
| 表单输入 | `{ title: '三体', authors: '刘慈欣', firstPublishYear: '2008' }` —— 全是字符串 |
| 校验后 | `{ id: 'manual:三体|刘慈欣', title: '三体', authors: ['刘慈欣'], firstPublishYear: 2008 }` —— 年份变成数字，作者变成数组 |
| 存进书架 | 上面这个对象 + `{ status: 'want-to-read', addedAt: '2026-10-14T…Z' }` |
| 内存里的书架 | `ReadingRecord[]` 数组 |
| localStorage | 同一个数组的 JSON 字符串，key 是 `readflow:records:v1` |
| 渲染时 | `<BookListItem book={record.book}>` 只拿元数据；`<span className="status …">` 拿状态 |

### 4.6 覆盖的数据边界

| 场景 | 表现 |
| --- | --- |
| 刷新页面（F5） | 数据都在（已实测：2 本 → 刷新 → 仍 2 本） |
| 关闭标签页再打开 | 数据都在（localStorage 不随标签页消失） |
| 换浏览器 / 无痕模式 | 数据不在（localStorage 按浏览器 + 按域名隔离） |
| 清空浏览器数据 | 数据永久丢失（**目前没有导出/备份功能**） |
| 手动把 localStorage 改坏 | 不会白屏：走 corrupted 分支，按空书架处理并在导航栏给出提示 |

---

## 五、关键设计决策与取舍

### 决策 1：手动录入的书用「书名 + 作者」生成稳定 ID，而不是随机 ID

| 方案 | 优点 | 缺点 |
| --- | --- | --- |
| **稳定 ID（采用）** | 去重继续有效；同一本书填两次会被拦住 | 同名同作者的不同书会被误判为同一本 |
| 随机 ID（如 crypto.randomUUID） | 每本书绝对独立 | **去重完全失效**：同一本书填两次就是两条记录，而"防止重复"是项目已确认的业务规则 |

**取舍理由**：去重是这个项目已经确认的功能，随机 ID 会直接破坏它。同名同作者的极端情况（比如两本不同的《XX 文集》）属于可接受的边界。

### 决策 2：把转换逻辑单独放 `src/lib/manualBook.ts`

它没有放在 `ShelfPage.tsx` 里，原因是：

- 它是**纯函数**（不 import React），可以脱离浏览器单独理解和测试；
- 页面组件只负责"渲染 + 收集输入 + 显示提示"，不负责业务规则；
- 将来如果要在别的地方也支持手动录入（比如搜索页加一个入口），直接复用。

### 决策 3：表单放在书架页，而不是新开一个路由

- 书架是"书最终归属于哪里"的地方，入口放这里最直观；
- 不新增路由就不用碰 `App.tsx` 的路由表，也不会和 `/books/:id` 这种动态路由产生"`/books/new` 到底匹配哪条"的歧义；
- 对一个"只有一个输入框组"的功能，新开页面属于过度设计。

### 决策 4：没有顺手做「删除」

你现在没法删掉书架里的《三体》，这是**有意**的：删除属于下一阶段范围，本次只做"能录进去"。不做删除是有代价的（测试数据留在书架里了），但**擅自扩大范围的风险更大**。

### 决策 5：没有给数据加"来源"字段

手动书和搜索来的书现在共用一个 `BookMetadata` 结构，没有区分字段。加 `source: 'manual' | 'openlibrary'` 能让 UI 显示"手动"/"来自搜索"的标记，但**现在没有这个需求**，加了就是提前实现。

---

## 六、面试可能会问到的问题

> 下面按主题分组。每题给"怎么答"和"可能被追问什么"。

### A. 关于唯一标识（最容易被追问）

**Q1：手动录入的书没有 Open Library 的 work ID，你怎么生成唯一标识？**

答：我按「书名 + 作者」推导了一个**稳定 ID**，格式是 `manual:书名|作者`，比如 `manual:三体|刘慈欣`。之所以不用随机 UUID，是因为整个应用的重复校验就是比较 `record.book.id` —— 如果用随机 ID，同一本书填两次就会变成两条记录，去重直接失效。加 `manual:` 前缀是为了保证和 Open Library 的 key（形如 `/works/OL45804W`）永不冲突。

> 追问：那同名同作者的两本不同的书怎么办？
> 答：会被误判成同一本，这是我的方案已知的边界。如果要解决，得引入额外区分维度（比如出版社、ISBN、版次），但那等于要求用户填更多字段，对"手动录入"来说体验反而更差。我目前的取舍是优先保证"防重复"这条已确认的规则。

**Q2：为什么 normalize 里要做 toLowerCase 和把多个空格压成一个？**

答：避免同一个书名因为格式差异被当成两本不同的书。比如「三体 」结尾多一个空格、或者「Harry  Potter」中间两个空格，规范化之后都会得到同一个 ID。中文其实不受 toLowerCase 影响，但书名里经常混英文，所以还是加上了。

**Q3：如果以后要给同一本书加"版本"概念，你会怎么改？**

答：`ReadingRecord` 上追加一个可选字段，比如 `editionKey?: string`，ID 规则不变。因为是可选字段，**已有数据不需要迁移**，旧记录照常能读。这也是当初把 ID 设计成"稳定且带来源前缀"的好处。

### B. 关于分层

**Q4：为什么 createManualBook 要单独放一个文件，而不是写在页面组件里？**

答：三层考虑。第一，它是纯函数、不依赖 React，可以脱离浏览器单独推演和测试；第二，页面组件的职责是"渲染 + 收集输入 + 显示提示"，业务规则（字段校验、作者拆分、ID 生成）放进去会让组件越来越臃肿；第三，将来别的地方要复用（比如搜索页也加一个手动入口）直接 import 就行。

> 追问：这不就是过度设计吗？
> 答：它是 72 行、只做一件事、没有任何抽象层的模块，不是"为了分层而分层"。判据是：如果把它塞回组件，组件会从 170 行变成 240 行，而且校验规则和 UI 混在一起 —— 那样更难改。

**Q5：新增一种图书来源，一共改了几个文件？**

答：五个，其中核心只有两个：新增 `lib/manualBook.ts`（怎么把输入变成 `BookMetadata`），改 `ShelfPage.tsx`（表单 UI）。另外三个是接线（`App.tsx` 传一个 prop）、一句提示（搜索页）、样式。**数据存储、去重、持久化、列表渲染全部零改动** —— 因为第一阶段就把"图书元数据"统一成了 `BookMetadata` 类型、把数据入口收在一个 `useBooks` 里。

### C. 关于状态管理

**Q6：新增一本书之后，书架列表为什么立刻刷新了？你写了什么同步逻辑？**

答：**没有写任何同步代码**。书架列表渲染的 `books` 和搜索页用的是同一个数组（都来自 `App` 里那一次 `useBooks()`）。`addBook` 里 `setBooks` 换掉这个数组之后，React 重新渲染，所有用到它的地方自然就更新了 —— 这是"单一数据源"的直接结果，不是"同步"。

> 追问：那为什么不用 Context？
> 答：这里只有一层传递（App → 页面），props 完全够用，而且看 props 就知道每个页面依赖什么。Context 的价值在"跨多层穿透"，本项目还没到那个复杂度。将来详情页内部嵌套变深了再换，改动只在 `App` 和各页面一行。

**Q7：addBook 为什么返回 `{ ok, reason }` 而不是抛异常？**

答："重复添加"不是异常，是**预期内的业务结果**，用返回值表达更直白，调用方也不会忘记处理（类型上逼着你判断 `ok`）。真正意外的东西（localStorage 写失败）才用另一条通道：`useBooks` 暴露一个 `storageError`，由导航栏统一提示。

**Q8：表单有三个输入框，为什么用一个对象 state 而不是三个 useState？**

答：用对象 + 一个 `updateField` 函数，能避免三份几乎一样的 `onChange` 代码；提交时也直接把整个对象交给 `createManualBook`，不用手工拼三次。而且 `keyof typeof EMPTY_FORM` 这个类型写法能让 TypeScript 保证只能传这三个字段名，写错字段会编译报错。

**Q9：为什么要 `event.preventDefault()`？**

答：表单默认提交会让浏览器刷新整个页面（把应用状态全部丢掉）。这里要用 JS 接管提交，所以必须阻止默认行为。

### D. 关于 localStorage

**Q10：数据具体是在什么时刻写进 localStorage 的？**

答：在 `useBooks` 里的 `useEffect([books])` 中，`books` 变化后触发 `saveRecords(books)`。但有个前提：必须先满足 `hasUserEdited.current === true`（也就是用户真正改过数据）。

**Q11：为什么要用 `useState(loadRecords)` 这种"传函数"的写法？**

答：这是 `useState` 的**惰性初始化**：传函数时它只在首次渲染执行一次，而且是同步的。这样首屏拿到的就是已经读出来的真实数据。如果写成"先 `useState([])`，再 `useEffect` 里异步读取"，首次渲染后持久化逻辑有可能先执行，把空数组写回 localStorage，**把用户数据覆盖掉**。

> 追问：那 StrictMode 会执行两次 effect，不会有问题吗？
> 答：我另外用 `hasUserEdited` 这个 ref 兜了一层 —— 初始化阶段无论 effect 执行几次，都不会产生写入。开发环境看到 effect 跑两次是 React 的预期行为，不是 bug。

**Q12：用户把 localStorage 里的内容手动改坏了会怎样？**

答：不会白屏。`loadRecords()` 把 `JSON.parse` 包在 try/catch 里，解析失败或结构不对就返回空数组 + 一条提示，应用按"空书架"正常渲染，导航栏下方显示提示条。单条记录字段不合法（缺 id、状态不是三个合法值之一）会被单独丢弃，其余合法的保留。

### E. 关于 React 细节

**Q13：表单为什么用受控组件？**

答：因为提交前要做校验、提交后要清空、还要根据打开/关闭状态重置 —— 这些都需要"值在我手里"。受控组件让输入框的值始终等于 React state，清空就是把 state 设回初始值，不需要去操作 DOM。

**Q14：`key={record.book.id}` 在这里有什么用？**

答：让 React 能正确识别列表里每一项的身份。如果不用 key（或用数组下标当 key），删除/插入一项时 React 可能复用错组件，导致渲染内容和数据错位、或组件内部状态残留。用书的 id 是最稳的。

**Q15：提交成功后为什么要 reset 表单并收起？**

答：一是避免用户在已经成功的情况下反复点提交；二是清空内容能防止"下一本书沿用上一本的字段"这种误操作；三是收起之后书架列表的位置不会被表单占着。**但注意**：校验失败和重复添加这两种情况，我**故意保持表单打开**，因为用户需要改一下再提交。

**Q16：`MANUAL_ID_PREFIX` 为什么不放在 `types/reading.ts` 里？**

答：因为它是 `manualBook` 模块的实现细节，只有这个模块需要知道。放在类型文件里会让"类型定义"和"某个模块的内部约定"混在一起。类型文件只描述数据结构，不应该包含某个具体功能的常量。

### F. 关于这次踩的网络坑（很好的项目经历素材）

**Q17：项目里遇到过什么比较麻烦的问题？**

可以参考这样的讲述顺序（重点展示**排查方法**，而不是"我遇到一个报错"）：

1. **现象**：搜索一直失败。界面显示"网络请求失败"，浏览器控制台却**一条错误都没有**。
2. **第一次排除**：先怀疑自己代码 —— 检查 URL 拼装、编码、`fetch` 调用、错误处理。用本地模拟接口（返回与 Open Library 同结构的数据）把整条链路跑通，**证明代码没问题**。
3. **第二次排除**：怀疑 CORS —— 但 CORS 报错的前提是请求已经到达服务器并返回响应头。这里**根本没拿到任何 HTTP 状态码**，所以不可能是 CORS。
4. **定位到网络层**：
   - `Resolve-DnsName` 发现 `openlibrary.org` 解析到 Meta 的 IP 段，**而且两次查询结果不同** → DNS 污染；
   - 用 DoH（`doh.pub`）拿到真实 IP `207.241.234.205`（Internet Archive 的地址）；
   - TCP 直连真实 IP **能通**，但加上 SNI 发起 TLS 时**连接被重置** → 说明是**基于域名的 TLS 阻断**；
   - 对照组（baidu、npm 镜像、GitHub）全部正常 → 不是本机网络挂了。
5. **又试了配置 Vite 开发代理**：为了判断"是配置写错了还是目标连不上"，我**临时把代理目标换成一个可达主机**做对照 —— 返回 200 和真实数据，证明**转发逻辑完全正确**；换回真实目标仍然失败。结论：代理跑在同一条网络上，绕不过去。
6. **最终处理**：既然网络这条路短期解决不了，就补了一个**不依赖网络的录入入口**（手动添加书籍），让应用先真正可用。

> 这个回答的价值在于：**不说"我不会"，而是展示了"怎么把故障一层层缩小范围"** —— 分层排除、用对照组、区分"配置错误 / 目标不可达 / HTTP 错误 / 浏览器端错误"，并且**如实说明哪些结论是实测的、哪些没有验证**。

**Q18：为什么不换成 Google Books API？**

答：我实际测过。`www.googleapis.com` 的 DNS 解析是**正确的**（返回真实的 Google IP），但 **TCP 443 全部超时** —— 是 IP 层被阻断。也就是说换数据源解决不了问题，两个接口都连不上，只是失败机制不同（Open Library 是 DNS 污染 + SNI 重置，Google 是 IP 被墙）。真正要解决只能走代理/VPN。而且我提前把接口转换层单独放在 `lib/openLibrary.ts` 一个文件里，所以就算将来真的要换数据源，**只需要改这一个文件**。

---

## 七、已知限制（如实列出）

1. **无法删除书籍** —— 删除属于下一阶段，本次没做。所以验证时加的《三体》目前删不掉。
2. **同名同作者的不同书会被误判为重复** —— 稳定 ID 方案的已知边界。
3. **手动书没有封面** —— 走 CSS 占位（显示书名首字），这是预期行为。
4. **手动书不能编辑** —— 填错书名只能删了重加，而删除还没做。
5. **没有导入/导出** —— 清空浏览器数据 = 数据永久丢失。
6. **搜索功能仍然不可用** —— 网络层的问题，代码已就绪，一旦能访问 openlibrary.org 即可用。

---

*本报告只记录实际代码与实测结果，未验证的部分均已标注。*
