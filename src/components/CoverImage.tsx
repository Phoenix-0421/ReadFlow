import { useState } from 'react'

type CoverImageProps = {
  title: string
  coverUrl?: string
}

/**
 * 封面图。接口没有提供封面、或者图片地址打不开时，
 * 都退回成纯 CSS 的占位块（显示书名首字），不使用任何图片库或图标库。
 */
export default function CoverImage({ title, coverUrl }: CoverImageProps) {
  const [failed, setFailed] = useState(false)

  if (!coverUrl || failed) {
    return (
      <div className="cover cover--placeholder" aria-hidden="true">
        {title.trim().slice(0, 1)}
      </div>
    )
  }

  return (
    <img
      className="cover"
      src={coverUrl}
      alt={'《' + title + '》封面'}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  )
}
