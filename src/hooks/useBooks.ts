import { useEffect, useRef, useState } from 'react'
import type { BookMetadata, ReadingRecord } from '../types/reading.ts'
import { loadRecords, saveRecords } from '../lib/storage.ts'

export type AddBookResult = { ok: true } | { ok: false; reason: 'duplicate' }

export interface UseBooksResult {
  /** 书架的完整数据，是全应用唯一的数据来源 */
  books: ReadingRecord[]
  /** 把一本书加入书架；已存在时返回 duplicate，不做重复写入 */
  addBook: (book: BookMetadata) => AddBookResult
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
 * 页面组件只调用这里暴露的 books / addBook，不直接接触 localStorage，
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
   * 只有用户真正改动过数据之后才允许写回本地存储。
   * 否则初始化阶段（包括开发模式下 StrictMode 的重复执行）会触发一次
   * 无意义的写入：数据损坏时，那一次写入会立刻把损坏内容覆盖掉。
   */
  const hasUserEdited = useRef(false)

  useEffect(() => {
    if (!hasUserEdited.current) return
    const result = saveRecords(books)
    setStorageError(result.ok ? null : result.message)
  }, [books])

  function addBook(book: BookMetadata): AddBookResult {
    // 用图书的唯一标识判断是否重复
    if (books.some((record) => record.book.id === book.id)) {
      return { ok: false, reason: 'duplicate' }
    }

    hasUserEdited.current = true
    setBooks((prev) =>
      // 再判断一次，防止同一次渲染内被连续添加两次
      prev.some((record) => record.book.id === book.id)
        ? prev
        : [...prev, createReadingRecord(book)],
    )
    return { ok: true }
  }

  return { books, addBook, storageError }
}
