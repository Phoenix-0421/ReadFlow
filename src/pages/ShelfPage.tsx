import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router'
import BookListItem from '../components/BookListItem.tsx'
import ProgressBar from '../components/ProgressBar.tsx'
import { bookDetailPath } from '../lib/reading.ts'
import { countByStatus } from '../lib/stats.ts'
import { createManualBook } from '../lib/manualBook.ts'
import { STATUS_LABELS } from '../types/reading.ts'
import type { BookMetadata, ReadingRecord, ReadingStatus } from '../types/reading.ts'
import type { AddBookResult } from '../hooks/useBooks.ts'
import type { SaveRecordsResult } from '../lib/storage.ts'

type ShelfPageProps = {
  books: ReadingRecord[]
  addBook: (book: BookMetadata) => AddBookResult
  updateStatus: (id: string, status: ReadingStatus) => SaveRecordsResult
  removeBook: (id: string) => SaveRecordsResult
}

/** 筛选项 = 三种阅读状态 + 「全部」 */
type StatusFilter = ReadingStatus | 'all'

/** 筛选按钮的顺序与文案 */
const FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'want-to-read', label: '想读' },
  { value: 'reading', label: '正在读' },
  { value: 'finished', label: '已读完' },
]

/** 状态下拉框里选项的顺序 */
const STATUS_OPTIONS: ReadingStatus[] = ['want-to-read', 'reading', 'finished']

/** 下拉框按当前状态换颜色，让人一眼看出这本书处于什么阶段 */
const STATUS_SELECT_CLASSES: Record<ReadingStatus, string> = {
  'want-to-read': 'status-select status-select--want-to-read',
  reading: 'status-select status-select--reading',
  finished: 'status-select status-select--finished',
}

/** 手动添加表单的初始值 */
const EMPTY_FORM = { title: '', authors: '', firstPublishYear: '' }

type Feedback = { tone: 'ok' | 'warn'; text: string }

/**
 * 下拉框的 value 永远是字符串，这里是 DOM 边界上的运行时校验。
 * 加一层校验就不需要用 as 断言去"骗"TypeScript。
 */
function isReadingStatus(value: string): value is ReadingStatus {
  return value === 'want-to-read' || value === 'reading' || value === 'finished'
}

export default function ShelfPage({
  books,
  addBook,
  updateStatus,
  removeBook,
}: ShelfPageProps) {
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  /** 当前筛选条件。只存在于页面内部，刷新后回到默认的「全部」 */
  const [filter, setFilter] = useState<StatusFilter>('all')

  /*
   * 筛选结果是每次渲染时从 books 现算出来的，不额外存一份。
   * 所以状态一变、书一删，列表和数量会自动跟着变，
   * 不可能出现「计数和实际列表对不上」的问题。
   */
  const visibleBooks =
    filter === 'all' ? books : books.filter((record) => record.status === filter)

  // 各状态数量复用 lib/stats.ts 的同一套规则，避免这里再实现一遍"怎么数"
  const counts = countByStatus(books)

  function countOf(value: StatusFilter): number {
    return value === 'all' ? books.length : counts[value]
  }

  function updateField(field: keyof typeof EMPTY_FORM, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function closeForm() {
    setFormOpen(false)
    setForm(EMPTY_FORM)
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFeedback(null)

    const result = createManualBook(form)
    if (!result.ok) {
      setFeedback({ tone: 'warn', text: result.message })
      return
    }

    const added = addBook(result.book)
    if (!added.ok) {
      setFeedback({ tone: 'warn', text: '《' + result.book.title + '》已经在书架里了。' })
      return
    }

    setFeedback({ tone: 'ok', text: '《' + result.book.title + '》已加入书架。' })
    setForm(EMPTY_FORM)
    setFormOpen(false)
  }

  function handleStatusChange(record: ReadingRecord, next: ReadingStatus) {
    // 状态联动（比如改成已读完会把当前页补到总页数）由 useBooks 里的规则统一处理
    const result = updateStatus(record.book.id, next)
    const text = '《' + record.book.title + '》已改为「' + STATUS_LABELS[next] + '」。'
    setFeedback(result.ok ? { tone: 'ok', text } : { tone: 'warn', text: text + result.message })
  }

  function handleDelete(record: ReadingRecord) {
    // 用浏览器原生确认框，不引入弹窗库
    const confirmed = window.confirm(
      '确定要从书架移除《' +
        record.book.title +
        '》吗？\n\n这本书的阅读状态和本地阅读记录会一起删除，且无法恢复。',
    )
    if (!confirmed) return

    const result = removeBook(record.book.id)
    setFeedback(
      result.ok
        ? { tone: 'ok', text: '《' + record.book.title + '》已从书架移除。' }
        : {
            tone: 'warn',
            text: '《' + record.book.title + '》已从书架移除，但' + result.message,
          },
    )
  }

  const addButtonLabel = formOpen ? '收起表单' : '手动添加书籍'

  return (
    <section className="page">
      <header className="page__header">
        <h1 className="page__title">我的书架</h1>
        <p className="page__desc">
          这里会列出你添加过的书籍，并可以按照阅读状态筛选。
        </p>
      </header>

      {/* 书架为空时，引导按钮放在空状态里，避免和工具栏重复 */}
      {books.length > 0 ? (
        <div className="page__toolbar">
          <button
            className={formOpen ? 'button button--active' : 'button'}
            type="button"
            onClick={() => (formOpen ? closeForm() : setFormOpen(true))}
          >
            {addButtonLabel}
          </button>
          <Link className="button button--ghost" to="/search">
            用关键词搜索
          </Link>
        </div>
      ) : null}

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

      {formOpen ? (
        <form className="manual-form" onSubmit={handleSubmit}>
          <p className="manual-form__title">手动添加书籍</p>
          <p className="panel__hint">
            搜索结果不可用时，可以直接在这里填写书籍信息，数据会存到浏览器本地。
          </p>

          <label className="field">
            <span className="field__label">书名（必填）</span>
            <input
              className="field__input"
              value={form.title}
              onChange={(event) => updateField('title', event.target.value)}
              placeholder="例如：三体"
            />
          </label>

          <label className="field">
            <span className="field__label">作者</span>
            <input
              className="field__input"
              value={form.authors}
              onChange={(event) => updateField('authors', event.target.value)}
              placeholder="多个作者用逗号分隔，可留空"
            />
          </label>

          <label className="field">
            <span className="field__label">首次出版年份</span>
            <input
              className="field__input"
              inputMode="numeric"
              value={form.firstPublishYear}
              onChange={(event) => updateField('firstPublishYear', event.target.value)}
              placeholder="例如：2008，可留空"
            />
          </label>

          <div className="manual-form__actions">
            <button className="button" type="submit">
              加入书架
            </button>
            <button className="button button--ghost" type="button" onClick={closeForm}>
              取消
            </button>
          </div>
        </form>
      ) : null}

      {books.length === 0 ? (
        <div className="panel panel--empty">
          <p className="panel__title">书架还是空的</p>
          <p className="panel__hint">
            先加一本进来吧：可以自己填书籍信息，也可以到搜索页按关键词搜索。
          </p>
          <div className="panel__actions">
            <button
              className="button"
              type="button"
              onClick={() => (formOpen ? closeForm() : setFormOpen(true))}
            >
              {addButtonLabel}
            </button>
            <Link className="button button--ghost" to="/search">
              前往书籍搜索
            </Link>
          </div>
        </div>
      ) : (
        <>
          <div className="chip-row" role="group" aria-label="按阅读状态筛选">
            {FILTERS.map((item) => {
              const active = filter === item.value
              return (
                <button
                  key={item.value}
                  className={active ? 'chip chip--current' : 'chip'}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setFilter(item.value)}
                >
                  {item.label}
                  <span className="chip__count">{countOf(item.value)}</span>
                </button>
              )
            })}
          </div>

          {visibleBooks.length === 0 ? (
            <div className="panel panel--empty">
              <p className="panel__title">这个筛选下还没有书</p>
              <p className="panel__hint">
                「{filter === 'all' ? '全部' : STATUS_LABELS[filter]}」里暂时没有图书，
                可以切换其他状态看看。
              </p>
              <button
                className="button button--ghost"
                type="button"
                onClick={() => setFilter('all')}
              >
                查看全部图书
              </button>
            </div>
          ) : (
            <>
              <p className="page__note">
                {filter === 'all'
                  ? '共 ' + books.length + ' 本。'
                  : STATUS_LABELS[filter] +
                    '：' +
                    visibleBooks.length +
                    ' 本（书架共 ' +
                    books.length +
                    ' 本）。'}
              </p>

              <ul className="book-list">
                {visibleBooks.map((record) => (
                  <BookListItem
                    book={record.book}
                    key={record.book.id}
                    to={bookDetailPath(record)}
                    extra={
                      <ProgressBar
                        currentPage={record.currentPage}
                        totalPages={record.totalPages}
                        compact
                      />
                    }
                  >
                    <select
                      className={STATUS_SELECT_CLASSES[record.status]}
                      value={record.status}
                      aria-label={'《' + record.book.title + '》的阅读状态'}
                      onChange={(event) => {
                        const next = event.target.value
                        if (isReadingStatus(next)) handleStatusChange(record, next)
                      }}
                    >
                      {STATUS_OPTIONS.map((status) => (
                        <option value={status} key={status}>
                          {STATUS_LABELS[status]}
                        </option>
                      ))}
                    </select>

                    <button
                      className="button button--danger"
                      type="button"
                      onClick={() => handleDelete(record)}
                    >
                      移除
                    </button>
                  </BookListItem>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </section>
  )
}
