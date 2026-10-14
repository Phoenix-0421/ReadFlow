import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import BookListItem from '../components/BookListItem.tsx'
import { isAbortError, searchBooks } from '../lib/openLibrary.ts'
import type { AddBookResult } from '../hooks/useBooks.ts'
import type { BookMetadata, ReadingRecord } from '../types/reading.ts'

/** 搜索页的四种状态。用联合类型表示，避免出现「既在加载又有错误」这类非法组合 */
type SearchState =
  | { phase: 'idle' }
  | { phase: 'loading' }
  | { phase: 'success'; results: BookMetadata[] }
  | { phase: 'error'; message: string }

type Feedback = { tone: 'ok' | 'warn'; text: string }

type SearchPageProps = {
  books: ReadingRecord[]
  addBook: (book: BookMetadata) => AddBookResult
}

export default function SearchPage({ books, addBook }: SearchPageProps) {
  const [keyword, setKeyword] = useState('')
  const [state, setState] = useState<SearchState>({ phase: 'idle' })
  const [feedback, setFeedback] = useState<Feedback | null>(null)

  /*
   * 请求序号 + AbortController 一起用，解决「旧请求的结果覆盖新请求」的问题。
   * 正确性以序号为准：响应回来时如果不是最新的一次请求，就整个丢弃结果。
   * AbortController 只是顺带省掉无用的网络传输。
   */
  const requestIdRef = useRef(0)
  const abortRef = useRef<AbortController | null>(null)

  async function runSearch(rawKeyword: string) {
    const trimmed = rawKeyword.trim()
    setFeedback(null)

    // 空关键词不发起请求
    if (!trimmed) {
      requestIdRef.current += 1
      abortRef.current?.abort()
      setState({ phase: 'idle' })
      return
    }

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    const requestId = requestIdRef.current + 1
    requestIdRef.current = requestId

    setState({ phase: 'loading' })
    try {
      const results = await searchBooks(trimmed, controller.signal)
      if (requestId !== requestIdRef.current) return
      setState({ phase: 'success', results })
    } catch (error) {
      // 主动取消不是错误，直接忽略
      if (isAbortError(error)) return
      if (requestId !== requestIdRef.current) return
      setState({
        phase: 'error',
        message: error instanceof Error ? error.message : '搜索失败，请稍后重试。',
      })
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void runSearch(keyword)
  }

  function handleAdd(book: BookMetadata) {
    const result = addBook(book)
    setFeedback(
      result.ok
        ? { tone: 'ok', text: '《' + book.title + '》已加入书架。' }
        : { tone: 'warn', text: '《' + book.title + '》已经在书架里了。' },
    )
  }

  const isSearching = state.phase === 'loading'

  return (
    <section className="page">
      <header className="page__header">
        <h1 className="page__title">书籍搜索</h1>
        <p className="page__desc">
          通过 Open Library 搜索书籍，并把选中的书加入书架。
        </p>
      </header>

      <form className="search-bar" role="search" onSubmit={handleSubmit}>
        <input
          className="search-bar__input"
          type="search"
          value={keyword}
          placeholder="输入书名，例如：三体"
          onChange={(event) => setKeyword(event.target.value)}
        />
        <button className="button" type="submit" disabled={isSearching}>
          {isSearching ? '搜索中…' : '搜索'}
        </button>
      </form>

      {feedback ? (
        <p
          className={
            feedback.tone === 'ok' ? 'feedback feedback--ok' : 'feedback feedback--warn'
          }
          role="status"
        >
          {feedback.text}
        </p>
      ) : null}

      {state.phase === 'idle' ? (
        <div className="panel panel--empty">
          <p className="panel__title">开始搜索</p>
          <p className="panel__hint">输入书名后按 Enter 键，或点击「搜索」按钮。</p>
          <p className="panel__hint">
            如果一直搜索失败，可以到「我的书架」用手动添加书籍。
          </p>
        </div>
      ) : null}

      {state.phase === 'loading' ? (
        <div className="panel panel--empty">
          <p className="panel__title">搜索中…</p>
          <p className="panel__hint">正在向 Open Library 请求数据。</p>
        </div>
      ) : null}

      {state.phase === 'error' ? (
        <div className="panel panel--error" role="alert">
          <p className="panel__title">搜索失败</p>
          <p className="panel__hint">{state.message}</p>
          <button
            className="button button--ghost"
            type="button"
            onClick={() => void runSearch(keyword)}
          >
            重试
          </button>
        </div>
      ) : null}

      {state.phase === 'success' && state.results.length === 0 ? (
        <div className="panel panel--empty">
          <p className="panel__title">没有找到相关书籍</p>
          <p className="panel__hint">换一个书名或关键词再试试。</p>
        </div>
      ) : null}

      {state.phase === 'success' && state.results.length > 0 ? (
        <>
          <p className="page__note">找到 {state.results.length} 本相关书籍。</p>
          <ul className="book-list">
            {state.results.map((book) => {
              const inShelf = books.some((record) => record.book.id === book.id)
              return (
                <BookListItem book={book} key={book.id}>
                  {inShelf ? (
                    <button className="button" type="button" disabled>
                      已在书架
                    </button>
                  ) : (
                    <button
                      className="button"
                      type="button"
                      onClick={() => handleAdd(book)}
                    >
                      加入书架
                    </button>
                  )}
                </BookListItem>
              )
            })}
          </ul>
        </>
      ) : null}
    </section>
  )
}
