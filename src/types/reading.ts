/**
 * 阅读状态：只允许这三种取值。
 * 用联合类型而不是 string，写错的值会在编译期就被发现。
 */
export type ReadingStatus = 'want-to-read' | 'reading' | 'finished'

/** 阅读状态对应的中文展示文案 */
export const STATUS_LABELS: Record<ReadingStatus, string> = {
  'want-to-read': '想读',
  reading: '正在读',
  finished: '已读完',
}

/**
 * 图书元数据：来自 Open Library 的书目信息。
 *
 * 注意它与 ReadingRecord 的区别：
 * - BookMetadata 描述的是「这本书本身」，内容来自外部接口；
 * - ReadingRecord 描述的是「我和这本书的关系」，是用户的个人数据。
 *
 * 书架里保存的是元数据的**快照**，所以展示书架时不需要再次请求接口。
 */
export interface BookMetadata {
  /** 唯一标识，直接用 Open Library 的 key，例如 "/works/OL45804W" */
  id: string
  title: string
  /** 作者名列表；空数组表示接口没有提供作者 */
  authors: string[]
  /** 封面地址；接口没提供封面时为 undefined */
  coverUrl?: string
  /** 首次出版年份；接口没提供时为 undefined */
  firstPublishYear?: number
}

/**
 * 书架里的一条记录 = 图书元数据快照 + 用户的个人阅读数据。
 *
 * currentPage / totalPages / note / finishedAt 是给后续阶段预留的字段，
 * 本阶段只写入 book、status、addedAt，其余字段暂时不会被读写。
 */
export interface ReadingRecord {
  book: BookMetadata
  status: ReadingStatus
  /** 加入书架的时间，ISO 格式字符串，例如 "2026-10-14T07:31:18.000Z" */
  addedAt: string
  /** 预留：当前读到第几页 */
  currentPage?: number
  /** 预留：总页数 */
  totalPages?: number
  /** 预留：阅读笔记 */
  note?: string
  /** 预留：读完时间 */
  finishedAt?: string
}
