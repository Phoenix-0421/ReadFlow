import type { BookMetadata } from '../types/reading.ts'

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
const SEARCH_LIMIT = 20

/**
 * Open Library 的图书标识格式：/works/OL45804W 或 /books/OL7353617M。
 * 只有符合这个格式的标识我们才采用，避免用不确定的字段拼出「伪 ID」。
 */
const KEY_PATTERN = /^\/(works|books)\/[A-Za-z0-9]+$/

/**
 * 判断一个错误是不是「请求被主动取消」。
 * 用户连续搜索时我们会取消上一次请求，这种情况不应该显示成错误。
 */
export function isAbortError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    (error as { name?: unknown }).name === 'AbortError'
  )
}

/**
 * 按关键词搜索图书。
 *
 * 返回的是已经转换成内部类型的 BookMetadata 列表，
 * 页面拿到的不是接口原始数据，所以接口字段变化时只需要改这个文件。
 */
export async function searchBooks(
  keyword: string,
  signal?: AbortSignal,
): Promise<BookMetadata[]> {
  const trimmed = keyword.trim()
  if (!trimmed) return []

  const url =
    SEARCH_ENDPOINT +
    '?q=' +
    encodeURIComponent(trimmed) +
    '&limit=' +
    String(SEARCH_LIMIT)

  let response: Response
  try {
    response = await fetch(url, { signal })
  } catch (error) {
    if (isAbortError(error)) throw error
    throw new Error('网络请求失败，请检查网络连接后重试。')
  }

  if (!response.ok) {
    throw new Error('搜索服务返回了错误（HTTP ' + String(response.status) + '），请稍后重试。')
  }

  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    throw new Error('搜索结果的格式无法解析，请稍后重试。')
  }

  return extractDocs(payload)
    .map(toBookMetadata)
    .filter((book): book is BookMetadata => book !== null)
}

/** 从接口响应里取出 docs 数组；结构不符合预期时返回空数组而不是崩溃 */
function extractDocs(payload: unknown): unknown[] {
  if (typeof payload !== 'object' || payload === null) return []
  const docs = (payload as { docs?: unknown }).docs
  return Array.isArray(docs) ? docs : []
}

/**
 * 把接口返回的一条原始数据转换成 BookMetadata。
 * 缺少必要字段（标识或标题）时返回 null，调用方会跳过这一条。
 * 单独导出是为了方便脱离网络单独验证这段转换逻辑。
 */
export function toBookMetadata(doc: unknown): BookMetadata | null {
  if (typeof doc !== 'object' || doc === null) return null
  const raw = doc as Record<string, unknown>

  const id = parseId(raw.key)
  if (!id) return null

  const title = typeof raw.title === 'string' ? raw.title.trim() : ''
  if (!title) return null

  const authors = Array.isArray(raw.author_name)
    ? raw.author_name
        .filter((author): author is string => typeof author === 'string')
        .map((author) => author.trim())
        .filter((author) => author !== '')
    : []

  const coverUrl = buildCoverUrl(raw.cover_i)
  const firstPublishYear =
    typeof raw.first_publish_year === 'number' && Number.isInteger(raw.first_publish_year)
      ? raw.first_publish_year
      : undefined

  return {
    id,
    title,
    authors,
    ...(coverUrl ? { coverUrl } : {}),
    ...(firstPublishYear !== undefined ? { firstPublishYear } : {}),
  }
}

function parseId(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const key = value.trim()
  return KEY_PATTERN.test(key) ? key : null
}

function buildCoverUrl(value: unknown): string | undefined {
  const coverId =
    typeof value === 'number' && Number.isInteger(value) && value > 0
      ? value
      : typeof value === 'string' && /^\d+$/.test(value)
        ? Number(value)
        : null

  if (coverId === null) return undefined
  return COVER_ENDPOINT + '/' + String(coverId) + '-M.jpg'
}
