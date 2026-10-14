import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router'
import BookListItem from '../components/BookListItem.tsx'
import { createManualBook } from '../lib/manualBook.ts'
import { STATUS_LABELS } from '../types/reading.ts'
import type { BookMetadata, ReadingRecord, ReadingStatus } from '../types/reading.ts'
import type { AddBookResult } from '../hooks/useBooks.ts'

type ShelfPageProps = {
  books: ReadingRecord[]
  addBook: (book: BookMetadata) => AddBookResult
}

/** 状态 → 样式类名。用 Record 保证三种状态都有对应样式，漏写会被类型检查发现 */
const STATUS_CLASSES: Record<ReadingStatus, string> = {
  'want-to-read': 'status status--want-to-read',
  reading: 'status status--reading',
  finished: 'status status--finished',
}

/** 手动添加表单的初始值 */
const EMPTY_FORM = { title: '', authors: '', firstPublishYear: '' }

type Feedback = { tone: 'ok' | 'warn'; text: string }

export default function ShelfPage({ books, addBook }: ShelfPageProps) {
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [feedback, setFeedback] = useState<Feedback | null>(null)

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

  return (
    <section className="page">
      <header className="page__header">
        <h1 className="page__title">我的书架</h1>
        <p className="page__desc">
          这里会列出你添加过的书籍，并可以按照阅读状态筛选。
        </p>
      </header>

      <div className="page__toolbar">
        <button
          className={formOpen ? 'button button--active' : 'button'}
          type="button"
          onClick={() => (formOpen ? closeForm() : setFormOpen(true))}
        >
          {formOpen ? '收起表单' : '手动添加书籍'}
        </button>
        <Link className="button button--ghost" to="/search">
          用关键词搜索
        </Link>
      </div>

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
            点击上方的「手动添加书籍」自己填一本，或者去搜索页按关键词搜索。
          </p>
        </div>
      ) : (
        <>
          <p className="page__note">
            共 {books.length} 本。状态筛选、阅读进度与笔记将在后续阶段实现。
          </p>
          <ul className="book-list">
            {books.map((record) => (
              <BookListItem book={record.book} key={record.book.id}>
                <span className={STATUS_CLASSES[record.status]}>
                  {STATUS_LABELS[record.status]}
                </span>
              </BookListItem>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}
