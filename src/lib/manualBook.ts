import type { BookMetadata } from '../types/reading.ts'

/** 用户在「手动添加书籍」表单里填写的原始内容（都是字符串，因为来自 input） */
export interface ManualBookInput {
  title: string
  authors: string
  firstPublishYear: string
}

export type ManualBookResult =
  | { ok: true; book: BookMetadata }
  | { ok: false; message: string }

/** 手动录入的 ID 前缀，保证不会和 Open Library 的 key（/works/... 、/books/...）冲突 */
const MANUAL_ID_PREFIX = 'manual:'

/**
 * 把手动填写的内容转换成 BookMetadata。
 * 校验不通过时返回失败原因，由页面显示给用户。
 */
export function createManualBook(input: ManualBookInput): ManualBookResult {
  const title = input.title.trim()
  if (!title) {
    return { ok: false, message: '书名不能为空。' }
  }

  const authors = splitAuthors(input.authors)

  const yearText = input.firstPublishYear.trim()
  let firstPublishYear: number | undefined
  if (yearText !== '') {
    const year = Number(yearText)
    if (!Number.isInteger(year) || year < 1 || year > 3000) {
      return { ok: false, message: '出版年份请填写 1 到 3000 之间的整数，或者留空。' }
    }
    firstPublishYear = year
  }

  return {
    ok: true,
    book: {
      id: buildManualBookId(title, authors),
      title,
      authors,
      ...(firstPublishYear !== undefined ? { firstPublishYear } : {}),
    },
  }
}

/**
 * 手动录入的书没有 Open Library 的 work ID，这里按「书名 + 作者」生成一个稳定 ID。
 *
 * 用稳定 ID（而不是随机 ID）是为了让重复校验继续有效：
 * 同一本书再填一次，会被识别出来并提示「已经在书架里了」。
 */
export function buildManualBookId(title: string, authors: string[]): string {
  return MANUAL_ID_PREFIX + normalize(title) + '|' + normalize(authors.join('/'))
}

/** 忽略大小写与多余空格，避免「三体 」和「三体」被当成两本书 */
function normalize(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase()
}

/** 作者输入框支持用中英文逗号、分号、顿号分隔多个作者 */
function splitAuthors(value: string): string[] {
  return value
    .split(/[,，、;；]/)
    .map((author) => author.trim())
    .filter((author) => author !== '')
}
