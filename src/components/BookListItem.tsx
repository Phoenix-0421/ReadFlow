import type { ReactNode } from 'react'
import { Link } from 'react-router'
import CoverImage from './CoverImage.tsx'
import { formatAuthors } from '../lib/reading.ts'
import type { BookMetadata } from '../types/reading.ts'

type BookListItemProps = {
  book: BookMetadata
  /** 附加展示：书架页放阅读进度，首页「最近读完」放完成时间 */
  extra?: ReactNode
  /** 传了就表示整行主体可点进详情页 */
  to?: string
  /** 右侧区域：搜索页放按钮，书架页放状态下拉框和删除按钮 */
  children?: ReactNode
}

/**
 * 一条图书记录的展示：封面 + 书名 + 作者 + 出版年份。
 *
 * 书架页、搜索页、首页三处复用同一套结构，
 * 需要的差异（进度 / 完成时间 / 操作按钮 / 是否可点击）分别由 extra / to / children 传入。
 */
export default function BookListItem({ book, extra, to, children }: BookListItemProps) {
  const body = (
    <>
      <CoverImage title={book.title} coverUrl={book.coverUrl} />

      <div className="book-item__info">
        <p className="book-item__title">{book.title}</p>
        <p className="book-item__meta">{formatAuthors(book.authors)}</p>
        {/* 没有出版年份时整行不显示 */}
        {book.firstPublishYear !== undefined && (
          <p className="book-item__meta">首次出版：{book.firstPublishYear}</p>
        )}
        {extra ? <div className="book-item__extra">{extra}</div> : null}
      </div>
    </>
  )

  return (
    <li className="book-item">
      {to ? (
        <Link className="book-item__link" to={to}>
          {body}
        </Link>
      ) : (
        body
      )}

      {children ? <div className="book-item__action">{children}</div> : null}
    </li>
  )
}
