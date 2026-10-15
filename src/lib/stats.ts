import type { ReadingRecord, ReadingStatus } from '../types/reading.ts'

/** 最近读完最多展示几本 */
export const RECENTLY_FINISHED_LIMIT = 3

/** 三种状态各自有多少本。由传入的数组现算，不缓存、不落库 */
export type StatusCounts = Record<ReadingStatus, number>

export function countByStatus(records: ReadingRecord[]): StatusCounts {
  const counts: StatusCounts = { 'want-to-read': 0, reading: 0, finished: 0 }
  for (const record of records) {
    counts[record.status] += 1
  }
  return counts
}

/** 正在阅读的书（保持书架里的原有顺序） */
export function selectReadingBooks(records: ReadingRecord[]): ReadingRecord[] {
  return records.filter((record) => record.status === 'reading')
}

/**
 * 最近读完：只挑「已读完 + 完成时间有效」的书，按完成时间从新到旧排，最多取 limit 本。
 *
 * 注意 filter 先返回的是一个新数组，再对它 sort，
 * 所以不会改动传进来的原数组（React 状态不可直接修改）。
 */
export function selectRecentlyFinished(
  records: ReadingRecord[],
  limit: number = RECENTLY_FINISHED_LIMIT,
): ReadingRecord[] {
  return records
    .filter((record) => record.status === 'finished' && toTimestamp(record.finishedAt) !== null)
    .sort((a, b) => (toTimestamp(b.finishedAt) ?? 0) - (toTimestamp(a.finishedAt) ?? 0))
    .slice(0, limit)
}

/**
 * 把时间字符串转成可比较的时间戳。
 * 缺失、空字符串、无法解析的值一律返回 null，调用方据此安全降级。
 */
export function toTimestamp(iso: string | undefined): number | null {
  if (typeof iso !== 'string' || iso === '') return null
  const time = Date.parse(iso)
  return Number.isNaN(time) ? null : time
}
