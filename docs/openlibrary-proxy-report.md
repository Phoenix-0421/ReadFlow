# Vite 开发代理配置与验证报告

| 项目 | 内容 |
| --- | --- |
| 报告日期 | 2026-10-14 |
| 项目路径 | `D:\项目\ReadFlow` |
| 本次目标 | 配置 Vite 开发代理，尽可能在保留现有实现的前提下解决 Open Library 请求问题 |
| 修改文件 | `vite.config.ts`、`src/lib/openLibrary.ts`（仅这两处） |
| **结论** | **代理配置本身完全正确（已用可达目标实测证明），但目标服务器依然连不通 —— 代理不能解决网络层的封锁** |

---

## 一、检查现有项目的结果

### 1. vite.config.ts（修改前）

```
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
})
```

**结论**：项目**尚未配置任何代理**，也没有其他 server 配置。

### 2. Open Library 的请求地址与调用方式（修改前）

| 项 | 位置 | 内容 |
| --- | --- | --- |
| 搜索接口地址 | `src/lib/openLibrary.ts` 第 3 行 | `const SEARCH_ENDPOINT = 'https://openlibrary.org/search.json'` |
| 封面地址 | 第 4 行 | `const COVER_ENDPOINT = 'https://covers.openlibrary.org/b/id'` |
| 调用方式 | 第 48 行 | `fetch(url, { signal })`，由页面传入 AbortController 的 signal |
| URL 拼装 | 第 39-44 行 | 官方绝对地址 + `?q=编码后的关键词&limit=20` |

**问题**：这是**浏览器直接请求第三方域名**，同时受两件事影响 —— 目标域名是否可达、以及对方是否允许跨域。

### 3. package.json 启动脚本

| 脚本 | 命令 |
| --- | --- |
| dev | `vite` |
| build | `tsc -b && vite build` |
| lint | `oxlint` |
| preview | `vite preview` |

### 4. 现有的 API 服务层与错误处理（保持不动）

请求逻辑已经集中在 `src/lib/openLibrary.ts` 一个文件里，页面组件不直接发请求。错误处理有三条独立路径：

| 位置 | 情况 | 抛出的提示 |
| --- | --- | --- |
| 第 46-52 行 | fetch 本身失败 | 网络请求失败，请检查网络连接后重试。 |
| 第 54-56 行 | HTTP 非 2xx | 搜索服务返回了错误（HTTP xxx），请稍后重试。 |
| 第 58-63 行 | JSON 解析失败 | 搜索结果的格式无法解析，请稍后重试。 |

### 5. 有没有可用的本地代理客户端？

**没有。** 实测结果：

- **进程扫描**：没有 clash / v2ray / xray / sing-box / surge / mihomo 等常见代理工具在运行；
- **端口扫描**：本机监听的端口里没有 7890 / 7891 / 1080 / 10809 / 8889 等常见代理端口。

这一条很关键 —— 它意味着**没有现成的上游代理可以让 Vite 转发**。

### 6. 与本次问题无关的业务代码

**全部未改动**：`useBooks.ts`、`storage.ts`、`types/reading.ts`、`App.tsx`、`AppLayout.tsx`、四个页面、两个组件、`App.css`、`index.css` 一行未动。

---

## 二、配置 Vite 代理

### 1. 修改后的 vite.config.ts（完整内容）

```
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // 开发环境把 /api/openlibrary/... 转发到 https://openlibrary.org/...
      // 例：/api/openlibrary/search.json?q=harry%20potter
      //   → https://openlibrary.org/search.json?q=harry%20potter
      '/api/openlibrary': {
        target: 'https://openlibrary.org',
        changeOrigin: true,
        // 转发时去掉本地前缀；查询参数会原样带过去
        rewrite: (path) => path.replace(/^\/api\/openlibrary/, ''),
        // 上游连不上时不要无限期等待
        proxyTimeout: 10000,
        timeout: 10000,
      },
    },
  },
})
```

### 2. 为什么这么写（不是抄来的）

- `server.proxy` 是 Vite **从 2.x 到 8.x 一直沿用的稳定写法**，本次项目用的是 Vite 8.3.4，写法完全兼容。没有使用任何新版才有的实验性字段。
- 代理**前缀用字符串键** `'/api/openlibrary'`，Vite 会按前缀匹配，这个用法各版本一致。
- `rewrite` 用 `path.replace` 去掉前缀，这正是官方文档给的示例写法。
- `changeOrigin: true` 让转发请求携带目标站点的 Host，避免目标站点因 Host 不匹配而拒绝。
- `proxyTimeout` / `timeout` 是 http-proxy 的选项，Vite 原样透传。加这两个是因为实测发现：不加的话，上游连不上时浏览器要干等 20 多秒；加上以后本地请求会在 10 秒内结束。
- **没有改动 `plugins` 那段**，React 插件配置保持原样。
- **没有引入任何新依赖** —— 代理能力由 Vite 自带，`package.json` 未改动。

### 3. React Router 完全不受影响

代理只作用于 `/api/openlibrary` 开头的请求，而路由是 `/`、`/shelf`、`/search`、`/books/:id`，两者路径不重叠。实测四个页面跳转全部正常（见第四节）。

---

## 三、调整 API 请求层

### 修改内容（`src/lib/openLibrary.ts` 第 3-14 行）

```
/*
 * 搜索接口地址分环境：
 * - 开发环境走 Vite 代理（配置见 vite.config.ts 的 server.proxy），
 *   浏览器只请求同源的 /api/openlibrary/...，由 Vite 转发到 openlibrary.org；
 * - 生产构建产物没有代理服务器，所以直接请求官方地址。
 */
const SEARCH_ENDPOINT = import.meta.env.DEV
  ? '/api/openlibrary/search.json'
  : 'https://openlibrary.org/search.json'

// 封面图仍是官方地址（图片不受跨域限制，加载失败时有 CSS 占位兜底）
const COVER_ENDPOINT = 'https://covers.openlibrary.org/b/id'
```

### 说明

| 要求 | 落实情况 |
| --- | --- |
| 请求统一放在 API 服务层 | 搜索请求仍在 `src/lib/openLibrary.ts` 的 `searchBooks()` 里，页面组件依旧只调用它 |
| 开发环境用本地代理路径 | 用 Vite 内置的 `import.meta.env.DEV` 判断，开发环境走 `/api/openlibrary/search.json` |
| 保留数据映射与类型 | `toBookMetadata()`、`parseId()`、`buildCoverUrl()`、`BookMetadata` 类型**未改动** |
| 保留重复校验与 localStorage | `useBooks.ts` / `storage.ts` **未改动** |
| 正确处理 HTTP 非 2xx | 原有第 54-56 行的检查保留 |
| 网络失败给出清晰提示 | 原有第 46-52 行的提示保留 |
| 不安装额外依赖 | 未安装任何依赖，`package.json` 未改动 |
| 不把请求塞进页面 | 页面仍然只拿到 `BookMetadata[]` 或一条错误消息 |

### 为什么封面地址没有走代理

本次要求里代理规则只指定了 `openlibrary.org`。封面是图片，**图片加载不受跨域限制**，而且 `CoverImage` 组件已有 `onError` 兜底（失败时显示 CSS 占位）。如果将来需要，可以再加一条 `/api/openlibrary-cover` 指向 `covers.openlibrary.org`，但那不属于本次范围。

---

## 四、验证网络连通性

### 1. 配置是否存在语法 / 类型错误 —— 全部通过

| # | 命令 | 结果 |
| --- | --- | --- |
| 1 | `npx tsc -b --force` | ✅ 退出码 0，无任何输出（`vite.config.ts` 与 `src` 都在检查范围内，说明 `proxyTimeout` 等字段类型合法） |
| 2 | `npm run build` | ✅ 退出码 0，转译 104 个模块，产物 `index.html` 0.46 kB / `index.css` 6.62 kB / `index.js` 269.65 kB |
| 3 | `npm run lint` | ✅ 退出码 0，无告警 |

### 2. 代理是否真的生效 —— 是

启动开发服务器（`npx vite --port 5180 --strictPort`，228 ms 就绪），对比两条路径：

| 请求 | 结果 | 说明 |
| --- | --- | --- |
| `GET /search.json`（非代理路径） | HTTP 200，**0.015 s** | 由 Vite 自己的 SPA 回退处理（返回 index.html），瞬间返回 |
| `GET /api/openlibrary/search.json?q=test&limit=1` | HTTP 000，**10.011 s**，Empty reply from server | **等待了整 10 秒**，正好是配置的 `proxyTimeout` |

**结论：代理规则确实被命中**（否则会像第一条那样 15 毫秒返回）。

### 3. 关键验证：转发逻辑本身是否正确 —— 用可达目标实测证明

既然 openlibrary.org 连不上，就无法用它判断「是我的配置写错了，还是目标连不上」。所以我把 `target` **临时**换成一个可达的主机做对照实验（只改 target 一处，测完立即还原）：

#### 验证 A：前缀是否被正确去掉 + 是否真的转发

```
把 target 临时改为 https://registry.npmmirror.com
请求: http://localhost:5180/api/openlibrary/cookie-es/latest
预期转发到: https://registry.npmmirror.com/cookie-es/latest

结果: HTTP 200    响应长度 6957 字符
响应开头: {"name":"cookie-es","version":"3.1.1","license":"MIT",...
```

**结论：前缀 `/api/openlibrary` 被正确剥离，子路径被正确转发，并且拿到了目标站点的真实响应。**

#### 验证 B：查询参数是否被保留

```
请求: http://localhost:5180/api/openlibrary/-/v1/search?text=react-router&size=1
预期转发到: https://registry.npmmirror.com/-/v1/search?text=react-router&size=1

结果: HTTP 200    响应长度 30004 字符
响应里的包名: react-router
返回的是 react-router 而不是别的 → 查询参数确实被带过去了
```

**结论：查询参数完整保留。**

#### 还原确认

```
原始被改前的 vite.config.ts SHA256: C3FC47988CD0FA05F9BC6F1548F5AA7E07C30EE2E13FF424675F67CB0045FD92
还原后            SHA256: C3FC47988CD0FA05F9BC6F1548F5AA7E07C30EE2E13FF424675F67CB0045FD92
是否逐字节一致: 是
文件里是否还有 openlibrary.org: True
```

**"转发逻辑完全正确"这一条，是被实测证明的，不是推测。**

### 4. 用真实目标（openlibrary.org）时的实际结果 —— 失败

```
请求: http://localhost:5180/api/openlibrary/search.json?q=harry%20potter&limit=2
结果: HTTP=000   耗时=10.011 s   错误=Empty reply from server
curl 退出码: 52
```

对照上一轮的诊断结论（同一条网络）：

- `openlibrary.org` 的 DNS 被污染，解析到 Meta 的 IP 段；
- TCP 连不上，超时；
- 即便用真实 IP，TLS 握手也会被重置。

**Vite 的代理是在本机的 Node 进程里跑的，走的是同一条网络** —— 所以它遇到的是和浏览器一模一样的问题。

### 5. 浏览器端的实际表现

在 `http://localhost:5180/search` 里真实输入 harry potter 并提交：

| 时间点 | 观察结果 |
| --- | --- |
| 14 秒时 | 按钮仍是「搜索中…」，页面没有报错 |
| 约 24 秒时 | 出现错误面板：「网络请求失败，请检查网络连接后重试。」 |
| 是否白屏 | 否 |
| 是否有重试按钮 | 有 |
| 控制台 error / warning | 0 条 |

注意一个实测差异：**用 curl 请求时 10 秒就结束了，但浏览器里要 20 多秒**。原因很可能是 Chrome 在收到「连接被直接断开」后会**自动重试**一次 GET 请求，于是 10 秒变成了两个来回。这说明 `proxyTimeout` 能缩短 curl 的等待，但**没能缩短用户在浏览器里的等待** —— 这个我如实记下来，不夸大效果。

### 6. 四类情况的区分（按你的要求）

| 类别 | 本次是否发生 | 判断依据 |
| --- | --- | --- |
| **Vite 代理配置错误** | ❌ 没有 | 用可达目标实测：前缀剥离正确、转发成功、查询参数保留，HTTP 200 返回真实数据 |
| **目标服务器连接失败** | ✅ **就是这一类** | 代理路径 10 秒超时、Empty reply；结合上一轮诊断：DNS 污染 + TCP 超时 + TLS 被重置 |
| **HTTP 错误响应** | ❌ 没有 | 全程**没有拿到任何 HTTP 状态码**（curl 显示 000），失败在连接层，不是 4xx/5xx |
| **浏览器端请求错误** | ⚠️ 是结果，不是原因 | 浏览器最终报「网络请求失败」；控制台没有 CORS 报错、没有 403/429/500。因为请求是同源的本地路径，**CORS 问题被彻底绕开了** |

---

## 五、结论：代理配置正确，但没有解决网络问题

**必须说清楚的一句话：本次没有解决 Open Library 无法访问的问题。**

- ✅ 代理配置**正确**（已用可达目标逐项实测证明）；
- ✅ 请求架构**改善了**：浏览器现在只请求同源路径，不再直接跨域访问第三方域名，CORS 的隐患被消除；
- ❌ 但**目标本身还是连不上** —— 封锁在网络层，Vite 代理跑在同一条网络上，绕不过去；
- ❌ 浏览器里的等待时间**没有变短**（实测仍约 20 多秒）。

**要真正可用，仍然需要让这台机器能访问 openlibrary.org**（代理 / VPN / 换网络）。一旦能访问，现有代码**不需要再改任何东西**就能工作 —— 因为转发逻辑已经验证过了。

---

## 六、剩余问题

1. **openlibrary.org 依旧不可达**（DNS 污染 + TLS 阻断），这是唯一没有解决的问题，且无法用代码解决。
2. **浏览器端等待约 20 多秒才报错**：`proxyTimeout` 只让服务端在 10 秒时断开，Chrome 会重试一次。若要真正缩短，需要在**前端**给 fetch 加超时（例如 `AbortSignal.timeout(10000)`）—— 但这属于业务代码改动，本次未做。
3. **生产构建不经过代理**：`npm run build` 的产物直连官方地址。如果将来要部署，需要真正的服务端转发或让运行环境能访问该域名。
4. **封面域名 `covers.openlibrary.org` 同样不可达**：目前靠 CSS 占位兜底，不影响使用。

---

## 七、我无法验证的部分（如实说明）

| 项目 | 状态 | 原因 |
| --- | --- | --- |
| 代理能否取回真实图书数据 | **未能验证** | 目标域名连不通，没有任何一次成功返回过图书数据 |
| 浏览器 Network 面板里的具体错误码 | **未能检查** | 我可用的浏览器工具读不到 Network 面板（详见上一份故障排查报告） |
| 有代理/VPN 后是否恢复 | **未测试** | 本机没有代理客户端，也没有可用的上游代理地址 |

**建议你提供/测试的一件事**：如果你能开代理或换网络，重新打开 `http://localhost:5173/api/openlibrary/search.json?q=harry%20potter&limit=2`，看能否返回 JSON。能返回就说明整条链路已经打通。

---

## 八、本次修改的文件清单

| 文件 | 改动 | 是否影响业务逻辑 |
| --- | --- | --- |
| `vite.config.ts` | 新增 `server.proxy` 一段（其余原样保留） | 不影响 |
| `src/lib/openLibrary.ts` | 仅第 3-14 行：把搜索端点常量改为按环境区分 | 不影响 —— 映射、校验、类型全部未动 |

**未改动**：`package.json`、`package-lock.json`、所有 tsconfig、`src` 下其余全部文件、`public`、`index.html`、CSS。

**未安装任何依赖。**

**未做破坏性操作**；实验期间临时改过的 `vite.config.ts` 已按 SHA256 校验逐字节还原。

---

*本报告只记录实际执行的命令与观测结果。凡是"未能验证"的项目均已明确标注，未声称已解决网络问题。*
