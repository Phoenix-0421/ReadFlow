import type { ReactNode } from 'react'
import CoverImage from './CoverImage.tsx'
import type { BookMetadata } from '../types/reading.ts'

type BookListItemProps = {
  book: BookMetadata
  /** 右侧区域：搜索页放「加入书架」按钮，书架页放阅读状态标签 */
  children?: ReactNode
}

/** 接口没有作者时统一显示「未知作者」 */
function formatAuthors(authors: string[]): string {
  return authors.length > 0 ? authors.join(' / ') : '未知作者'
}

/**
 * 一条图书记录的展示：封面 + 书名 + 作者 + 出版年份。
 * 搜索页和书架页复用同一个组件，右侧内容由调用方通过 children 决定。
 */
export default function BookListItem({ book, children }: BookListItemProps) {
  return (
    <li className="book-item">
      <CoverImage title={book.title} coverUrl={book.coverUrl} />

      <div className="book-item__info">
        <p className="book-item__title">{book.title}</p>
        <p className="book-item__meta">{formatAuthors(book.authors)}</p>
        {/* 没有出版年份时整行不显示 */}
        {book.firstPublishYear !== undefined && (
          <p className="book-item__meta">首次出版：{book.firstPublishYear}</p>
        )}
      </div>

      {children ? <div className="book-item__action">{children}</div> : null}
    </li>
  )
}
