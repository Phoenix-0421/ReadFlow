import { Link } from 'react-router'
import BookListItem from '../components/BookListItem.tsx'
import ProgressBar from '../components/ProgressBar.tsx'
import { bookDetailPath, formatDate } from '../lib/reading.ts'
import { countByStatus, selectReadingBooks, selectRecentlyFinished } from '../lib/stats.ts'
import { STATUS_LABELS } from '../types/reading.ts'
import type { ReadingRecord, ReadingStatus } from '../types/reading.ts'

type HomePageProps = {
  books: ReadingRecord[]
}

/** 统计卡片的展示顺序 */
const STATUS_ORDER: ReadingStatus[] = ['want-to-read', 'reading', 'finished']

export default function HomePage({ books }: HomePageProps) {
  /*
   * 三块内容全部在渲染时从 books 现算：
   * 不往 localStorage 里存统计数字，也不在页面里复制一份书籍数组。
   * 所以添加、改状态、删书之后首页会自动跟着变，不需要任何同步逻辑。
   */
  const counts = countByStatus(books)
  const readingBooks = selectReadingBooks(books)
  const recentlyFinished = selectRecentlyFinished(books)

  return (
    <section className="page">
      <header className="page__header">
        <h1 className="page__title">首页</h1>
        <p className="page__desc">
          阅读概览：三种阅读状态的数量、正在阅读的书，以及最近读完的书。
        </p>
      </header>

      <div className="stat-grid">
        {STATUS_ORDER.map((status) => (
          <article className="stat-card" key={status}>
            <p className="stat-card__label">{STATUS_LABELS[status]}</p>
            <p className="stat-card__value">{counts[status]}</p>
          </article>
        ))}
      </div>

      <section className="home-section">
        <h2 className="home-section__title">正在阅读</h2>

        {readingBooks.length === 0 ? (
          <div className="panel panel--empty">
            <p className="panel__title">还没有正在阅读的书</p>
            <p className="panel__hint">
              在书架里把一本书的状态改成「正在读」，它就会出现在这里。
            </p>
            <Link className="button" to="/shelf">
              前往我的书架
            </Link>
          </div>
        ) : (
          <ul className="book-list">
            {readingBooks.map((record) => (
              <BookListItem
                key={record.book.id}
                book={record.book}
                to={bookDetailPath(record)}
                extra={
                  <ProgressBar
                    currentPage={record.currentPage}
                    totalPages={record.totalPages}
                  />
                }
              >
                <Link className="book-item__hint" to={bookDetailPath(record)}>
                  查看详情
                </Link>
              </BookListItem>
            ))}
          </ul>
        )}
      </section>

      <section className="home-section">
        <h2 className="home-section__title">最近读完</h2>

        {recentlyFinished.length === 0 ? (
          <div className="panel panel--empty">
            <p className="panel__title">还没有读完的书</p>
            <p className="panel__hint">
              把书的状态改成「已读完」，它就会按完成时间出现在这里（最多 3 本）。
            </p>
            <Link className="button button--ghost" to="/shelf">
              前往我的书架
            </Link>
          </div>
        ) : (
          <ul className="book-list">
            {recentlyFinished.map((record) => (
              <BookListItem
                key={record.book.id}
                book={record.book}
                to={bookDetailPath(record)}
                extra={
                  <p className="book-item__meta">读完于 {formatDate(record.finishedAt)}</p>
                }
              >
                <Link className="book-item__hint" to={bookDetailPath(record)}>
                  查看详情
                </Link>
              </BookListItem>
            ))}
          </ul>
        )}
      </section>
    </section>
  )
}
