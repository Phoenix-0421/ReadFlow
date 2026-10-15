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
  /*
   * 记录"哪一张图加载失败了"，而不是一个简单的布尔值。
   * 这样即使这个组件实例被复用去渲染另一本书（封面地址变了），
   * 上一张图失败的状态也不会错误地延续到新书上。
   * 下面的 url 是局部常量，所以类型收窄在 onError 闭包里依然有效。
   */
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  const url = coverUrl

  if (!url || failedUrl === url) {
    return (
      <div className="cover cover--placeholder" aria-hidden="true">
        {title.trim().slice(0, 1)}
      </div>
    )
  }

  return (
    <img
      className="cover"
      src={url}
      alt={'《' + title + '》封面'}
      loading="lazy"
      onError={() => setFailedUrl(url)}
    />
  )
}
