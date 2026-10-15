import { Link, useParams } from 'react-router'
import CoverImage from '../components/CoverImage.tsx'
import ReadingEditor from '../components/ReadingEditor.tsx'
import { formatAuthors, formatDate } from '../lib/reading.ts'
import { STATUS_LABELS } from '../types/reading.ts'
import type { ReadingRecord, ReadingStatus } from '../types/reading.ts'
import type { SaveRecordsResult } from '../lib/storage.ts'

type BookDetailPageProps = {
  books: ReadingRecord[]
  updateProgress: (id: string, currentPage?: number, totalPages?: number) => SaveRecordsResult
  updateNote: (id: string, note: string) => SaveRecordsResult
}

/** 状态 -> 样式类名（详情页这里是只读标签） */
const STATUS_CLASSES: Record<ReadingStatus, string> = {
  'want-to-read': 'status status--want-to-read',
  reading: 'status status--reading',
  finished: 'status status--finished',
}

export default function BookDetailPage({
  books,
  updateProgress,
  updateNote,
}: BookDetailPageProps) {
  const { id } = useParams<{ id: string }>()
  // 直接从书架数据里找 —— 不额外存一份详情数据，避免两处不一致
  const record = books.find((item) => item.book.id === id)

  if (!record) {
    return (
      <section className="page">
        <header className="page__header">
          <h1 className="page__title">书籍详情</h1>
        </header>

        <div className="panel panel--empty">
          <p className="panel__title">没有找到这本书</p>
          <p className="panel__hint">
            它可能已经被移出书架，或者这个链接不正确。
          </p>
          <Link className="button" to="/shelf">
            返回我的书架
          </Link>
        </div>
      </section>
    )
  }

  return (
    <section className="page">
      <header className="page__header">
        <h1 className="page__title">书籍详情</h1>
        <p className="page__desc">记录阅读进度，也可以写下自己的想法。</p>
      </header>

      <div className="detail-head">
        <CoverImage title={record.book.title} coverUrl={record.book.coverUrl} />

        <div className="detail-head__info">
          <h2 className="detail-head__title">{record.book.title}</h2>
          <p className="book-item__meta">{formatAuthors(record.book.authors)}</p>
          {record.book.firstPublishYear !== undefined && (
            <p className="book-item__meta">首次出版：{record.book.firstPublishYear}</p>
          )}

          <p className="detail-head__status">
            <span className={STATUS_CLASSES[record.status]}>
              {STATUS_LABELS[record.status]}
            </span>
            {record.finishedAt !== undefined && (
              <span className="detail-head__meta">
                读完于 {formatDate(record.finishedAt)}
              </span>
            )}
          </p>
        </div>
      </div>

      {/*
        key 用书的 id：从 A 书跳到 B 书时强制重建编辑区，
        否则草稿（进度输入框、笔记）会残留上一本书的内容。
      */}
      <ReadingEditor
        key={record.book.id}
        record={record}
        updateProgress={updateProgress}
        updateNote={updateNote}
      />

      <p className="page__actions">
        <Link className="button button--ghost" to="/shelf">
          返回我的书架
        </Link>
      </p>
    </section>
  )
}
