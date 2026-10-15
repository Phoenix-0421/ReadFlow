import type { ReadingRecord, ReadingStatus } from '../types/reading.ts'

/**
 * 阅读状态变化时的联动规则。
 *
 * 全应用只有这一处实现 —— 书架页的状态下拉框和其它任何会改状态的地方都调它，
 * 避免出现两套不一致的规则。
 */
export function applyStatusChange(record: ReadingRecord, status: ReadingStatus): ReadingRecord {
  if (status === 'finished') {
    const next: ReadingRecord = { ...record, status, finishedAt: new Date().toISOString() }
    // 总页数已知：把当前页补到总页数；总页数未知：只改状态，不虚构页数
    if (record.totalPages !== undefined) {
      next.currentPage = record.totalPages
    }
    return next
  }

  // 离开「已读完」：清掉完成时间；已记录的进度和笔记原样保留
  const next: ReadingRecord = { ...record, status }
  delete next.finishedAt
  return next
}

/**
 * 写入阅读进度。
 * 传 undefined 表示「清空这一项」。传进来的值必须已经过 parseProgressInput 校验。
 */
export function applyProgress(
  record: ReadingRecord,
  currentPage?: number,
  totalPages?: number,
): ReadingRecord {
  const next: ReadingRecord = { ...record }
  if (currentPage === undefined) delete next.currentPage
  else next.currentPage = currentPage
  if (totalPages === undefined) delete next.totalPages
  else next.totalPages = totalPages
  return next
}

/** 写入笔记。空字符串表示清空笔记（不保留空字段） */
export function applyNote(record: ReadingRecord, note: string): ReadingRecord {
  const next: ReadingRecord = { ...record }
  if (note === '') delete next.note
  else next.note = note
  return next
}

/**
 * 计算阅读进度百分比。
 *
 * 没有总页数（或总页数非法）时返回 null —— 调用方据此显示「未设置总页数」，
 * 而不是编造一个百分比出来。结果会钳制在 0~100，即使外部数据被改坏也不会越界。
 */
export function computeProgressPercent(
  currentPage?: number,
  totalPages?: number,
): number | null {
  if (totalPages === undefined || totalPages <= 0) return null
  const current = currentPage ?? 0
  const percent = Math.round((current / totalPages) * 100)
  return Math.min(100, Math.max(0, percent))
}

/** 把已保存的进度转成表单里的字符串（没有值就是空字符串） */
export function toProgressFormInput(record: ReadingRecord): ProgressFormInput {
  return {
    currentPage: record.currentPage !== undefined ? String(record.currentPage) : '',
    totalPages: record.totalPages !== undefined ? String(record.totalPages) : '',
  }
}

export interface ProgressFormInput {
  currentPage: string
  totalPages: string
}

export type ProgressParseResult =
  | { ok: true; currentPage?: number; totalPages?: number }
  | { ok: false; message: string }

/**
 * 保存前的输入校验。全部通过才返回结果，否则给出**具体**的错误原因。
 *
 * 用正则 /^\d+$/ 拦掉：负数、小数、科学计数法、文字、以及空白字符串，
 * 所以不会把 NaN / 空字符串 / 无效数字写进正式数据。
 */
export function parseProgressInput(input: ProgressFormInput): ProgressParseResult {
  const currentText = input.currentPage.trim()
  const totalText = input.totalPages.trim()

  let currentPage: number | undefined
  if (currentText !== '') {
    if (!/^\d+$/.test(currentText)) {
      return { ok: false, message: '当前页数请填 0 或正整数，不要填负数、小数或文字。' }
    }
    currentPage = Number(currentText)
    if (!Number.isSafeInteger(currentPage)) {
      return { ok: false, message: '当前页数太大了，请填写合理的页数。' }
    }
  }

  let totalPages: number | undefined
  if (totalText !== '') {
    if (!/^\d+$/.test(totalText)) {
      return { ok: false, message: '总页数请填正整数，不要填负数、小数或文字。' }
    }
    totalPages = Number(totalText)
    if (totalPages < 1) {
      return { ok: false, message: '总页数必须大于 0；如果不知道总页数，请把它留空。' }
    }
    if (!Number.isSafeInteger(totalPages)) {
      return { ok: false, message: '总页数太大了，请填写合理的页数。' }
    }
  }

  // 改了总页数之后，当前页也要重新检查一遍
  if (totalPages !== undefined && currentPage !== undefined && currentPage > totalPages) {
    return {
      ok: false,
      message:
        '当前页数（' + currentPage + '）不能大于总页数（' + totalPages + '），请修改后再保存。',
    }
  }

  return { ok: true, currentPage, totalPages }
}

/**
 * 详情页路径。手动录入的 id 里可能带中文、冒号和竖线，必须编码。
 * 收在这里是为了让"怎么拼详情页地址"只有一处实现，避免哪个页面忘记编码。
 */
export function bookDetailPath(record: ReadingRecord): string {
  return '/books/' + encodeURIComponent(record.book.id)
}

/** 作者列表的展示文案（书架、详情页、首页共用） */
export function formatAuthors(authors: string[]): string {
  return authors.length > 0 ? authors.join(' / ') : '未知作者'
}

/**
 * 把 ISO 时间字符串格式化成适合展示的日期。
 *
 * 用原生 Date + toLocaleDateString，不引入日期库；
 * 缺失或解析不出来时返回空字符串，让调用方决定显示什么，而不是抛异常。
 */
export function formatDate(iso: string | undefined): string {
  if (typeof iso !== 'string' || iso === '') return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString()
}
