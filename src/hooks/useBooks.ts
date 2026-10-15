import { useRef, useState } from 'react'
import type { BookMetadata, ReadingRecord, ReadingStatus } from '../types/reading.ts'
import { loadRecords, saveRecords } from '../lib/storage.ts'
import type { SaveRecordsResult } from '../lib/storage.ts'
import { applyNote, applyProgress, applyStatusChange } from '../lib/reading.ts'

export type AddBookResult = { ok: true } | { ok: false; reason: 'duplicate' }

export interface UseBooksResult {
  /** 书架的完整数据，是全应用唯一的数据来源 */
  books: ReadingRecord[]
  /** 把一本书加入书架；已存在时返回 duplicate，不做重复写入 */
  addBook: (book: BookMetadata) => AddBookResult
  /** 修改阅读状态（内部按 applyStatusChange 做进度联动） */
  updateStatus: (id: string, status: ReadingStatus) => SaveRecordsResult
  /** 修改阅读进度；传 undefined 表示清空该项 */
  updateProgress: (id: string, currentPage?: number, totalPages?: number) => SaveRecordsResult
  /** 修改笔记；传空字符串表示清空 */
  updateNote: (id: string, note: string) => SaveRecordsResult
  /** 从书架移除某本书（连同它的进度、笔记、完成时间） */
  removeBook: (id: string) => SaveRecordsResult
  /** 本地存储相关的提示信息，正常时为 null */
  storageError: string | null
}

/** 新加入书架的书默认是「想读」 */
function createReadingRecord(book: BookMetadata): ReadingRecord {
  return {
    book,
    status: 'want-to-read',
    addedAt: new Date().toISOString(),
  }
}

/**
 * 书架数据的唯一入口：负责「读一次本地数据、之后每次改动写回去」。
 *
 * 页面组件只调用这里暴露的操作，不直接接触 localStorage，
 * 所以不会出现「某个页面改了数据却忘了保存」的情况。
 */
export function useBooks(): UseBooksResult {
  /*
   * useState 传函数 = 惰性初始化，只会在首次渲染时执行一次，而且是同步的。
   * 这样首屏拿到的就是已经读出来的数据，不存在「先渲染空数据、再异步加载」
   * 的中间状态，也就不会把空数据误写回 localStorage 覆盖掉原有内容。
   */
  const [initial] = useState(loadRecords)
  const [books, setBooks] = useState<ReadingRecord[]>(initial.records)
  const [storageError, setStorageError] = useState<string | null>(initial.readError)

  /*
   * 始终指向「当前最新的书架数据」。
   * 每次操作都基于它算出下一份数据再交给 commit，
   * 所以连续两次操作不会被彼此覆盖（如果用渲染时的 books 就会）。
   */
  const latestBooks = useRef(books)

  /**
   * 唯一的写入路径：更新内存状态 -> 立刻写回 localStorage -> 把结果返回给调用方。
   *
   * 为什么在操作里同步保存，而不是用 useEffect 监听 books 变化：
   * 1. 只有这里知道写入成功没有，页面才能给出真实的「保存成功 / 保存失败」提示；
   * 2. 因为没有 effect，也就不存在「首屏挂载时误写一次」的问题，不需要额外开关变量；
   * 3. 每次用户操作恰好写一次，不会在每次渲染后无条件重复写入。
   */
  function commit(next: ReadingRecord[]): SaveRecordsResult {
    latestBooks.current = next
    setBooks(next)
    const result = saveRecords(next)
    setStorageError(result.ok ? null : result.message)
    return result
  }

  function addBook(book: BookMetadata): AddBookResult {
    // 用图书的唯一标识判断是否重复
    if (latestBooks.current.some((record) => record.book.id === book.id)) {
      return { ok: false, reason: 'duplicate' }
    }
    commit([...latestBooks.current, createReadingRecord(book)])
    return { ok: true }
  }

  function updateStatus(id: string, status: ReadingStatus): SaveRecordsResult {
    return commit(
      latestBooks.current.map((record) =>
        record.book.id === id ? applyStatusChange(record, status) : record,
      ),
    )
  }

  function updateProgress(
    id: string,
    currentPage?: number,
    totalPages?: number,
  ): SaveRecordsResult {
    return commit(
      latestBooks.current.map((record) =>
        record.book.id === id ? applyProgress(record, currentPage, totalPages) : record,
      ),
    )
  }

  function updateNote(id: string, note: string): SaveRecordsResult {
    return commit(
      latestBooks.current.map((record) =>
        record.book.id === id ? applyNote(record, note) : record,
      ),
    )
  }

  function removeBook(id: string): SaveRecordsResult {
    // 按 id 过滤，只会移除匹配的那一条，其他图书不受影响
    return commit(latestBooks.current.filter((record) => record.book.id !== id))
  }

  return {
    books,
    addBook,
    updateStatus,
    updateProgress,
    updateNote,
    removeBook,
    storageError,
  }
}
