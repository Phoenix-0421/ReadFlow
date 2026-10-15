import { computeProgressPercent } from '../lib/reading.ts'

type ProgressBarProps = {
  currentPage?: number
  totalPages?: number
  /** 书架卡片里使用：文案更短，没有进度时干脆不占位置 */
  compact?: boolean
}

/**
 * 阅读进度展示：百分比 + 一条纯 CSS 进度条。
 *
 * 百分比是现算的，不额外保存；
 * 总页数未知时不显示百分比，也不会编一个数字出来。
 */
export default function ProgressBar({
  currentPage,
  totalPages,
  compact,
}: ProgressBarProps) {
  const percent = computeProgressPercent(currentPage, totalPages)

  if (percent === null) {
    // 总页数未知：不显示百分比
    if (compact) {
      return currentPage === undefined ? null : (
        <p className="progress__hint">已读 {currentPage} 页</p>
      )
    }
    return (
      <p className="progress__hint">
        {currentPage === undefined
          ? '还没有记录阅读进度。'
          : '已读 ' + currentPage + ' 页（未设置总页数，无法计算百分比）。'}
      </p>
    )
  }

  return (
    <div className="progress">
      <div className="progress__track">
        <div className="progress__fill" style={{ width: percent + '%' }} />
      </div>
      <p className="progress__text">
        {percent}%　·　{currentPage ?? 0} / {totalPages} 页
      </p>
    </div>
  )
}
