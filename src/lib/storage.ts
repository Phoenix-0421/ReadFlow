import type { BookMetadata, ReadingRecord, ReadingStatus } from '../types/reading.ts'

/** localStorage 的键名。带版本号，将来数据结构变化时可以平滑升级 */
const STORAGE_KEY = 'readflow:records:v1'

/** 读取结果：数据 + 是否发生异常，让调用方可以决定要不要提示用户 */
export interface LoadRecordsResult {
  records: ReadingRecord[]
  /** 存过数据，但内容无法完整解析成合法记录 */
  corrupted: boolean
  /** 本地存储不可用时的提示；一切正常时为 null */
  readError: string | null
}

export type SaveRecordsResult = { ok: true } | { ok: false; message: string }

const VALID_STATUSES: readonly string[] = ['want-to-read', 'reading', 'finished']

/**
 * 从 localStorage 读取书架数据。
 *
 * 这个函数不会抛异常：任何异常都会被转换成「空数据 + 提示信息」，
 * 这样即使本地数据损坏，页面也只会显示空书架，而不是整个应用白屏。
 */
export function loadRecords(): LoadRecordsResult {
  let raw: string | null
  try {
    raw = window.localStorage.getItem(STORAGE_KEY)
  } catch {
    // 例如浏览器无痕模式、或站点被禁止使用本地存储
    return {
      records: [],
      corrupted: false,
      readError: '浏览器本地存储不可用，本次的阅读记录将无法保存。',
    }
  }

  if (raw === null) {
    return { records: [], corrupted: false, readError: null }
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return {
      records: [],
      corrupted: true,
      readError: '本地保存的数据已损坏，无法解析，已按空书架处理。',
    }
  }

  if (!Array.isArray(parsed)) {
    return {
      records: [],
      corrupted: true,
      readError: '本地保存的数据格式不正确，已按空书架处理。',
    }
  }

  const records = parsed
    .map(parseRecord)
    .filter((record): record is ReadingRecord => record !== null)

  return {
    records,
    corrupted: records.length !== parsed.length,
    readError:
      records.length !== parsed.length
        ? '本地数据中有无法识别的记录，已忽略这部分内容。'
        : null,
  }
}

/**
 * 把书架数据写入 localStorage。
 * 失败时返回原因，由调用方决定如何提示用户，避免错误被无声吞掉。
 */
export function saveRecords(records: ReadingRecord[]): SaveRecordsResult {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records))
    return { ok: true }
  } catch {
    // 常见原因：存储空间已满，或浏览器禁止写入
    return {
      ok: false,
      message: '保存到浏览器本地存储失败，本次改动可能在刷新页面后丢失。',
    }
  }
}

/** 运行时校验：localStorage 里的内容不可信，必须逐条检查 */
function parseRecord(value: unknown): ReadingRecord | null {
  if (typeof value !== 'object' || value === null) return null
  const raw = value as Record<string, unknown>

  const book = parseBook(raw.book)
  if (!book) return null

  const status = parseStatus(raw.status)
  if (!status) return null

  if (typeof raw.addedAt !== 'string') return null

  return { book, status, addedAt: raw.addedAt }
}

function parseBook(value: unknown): BookMetadata | null {
  if (typeof value !== 'object' || value === null) return null
  const raw = value as Record<string, unknown>

  const id = typeof raw.id === 'string' ? raw.id.trim() : ''
  const title = typeof raw.title === 'string' ? raw.title.trim() : ''
  if (!id || !title) return null

  const authors = Array.isArray(raw.authors)
    ? raw.authors.filter((author): author is string => typeof author === 'string')
    : []

  const coverUrl =
    typeof raw.coverUrl === 'string' && raw.coverUrl !== '' ? raw.coverUrl : undefined
  const firstPublishYear =
    typeof raw.firstPublishYear === 'number' ? raw.firstPublishYear : undefined

  return {
    id,
    title,
    authors,
    ...(coverUrl ? { coverUrl } : {}),
    ...(firstPublishYear !== undefined ? { firstPublishYear } : {}),
  }
}

function parseStatus(value: unknown): ReadingStatus | null {
  if (typeof value !== 'string' || !VALID_STATUSES.includes(value)) return null
  return value as ReadingStatus
}
