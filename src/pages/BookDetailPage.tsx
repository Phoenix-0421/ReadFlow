import { Link, useParams } from 'react-router'

export default function BookDetailPage() {
  const { id } = useParams<{ id: string }>()

  return (
    <section className="page">
      <header className="page__header">
        <h1 className="page__title">书籍详情</h1>
        <p className="page__desc">
          这里会展示单本书的元数据、阅读状态、阅读进度和笔记。
        </p>
      </header>

      <div className="panel">
        <p className="panel__title">路由参数</p>
        <p className="panel__hint">
          当前书籍 ID：<code>{id}</code>
        </p>
        <p className="panel__hint">
          书籍数据、状态切换、进度记录与笔记都将在后续阶段实现。
        </p>
      </div>

      <p className="page__actions">
        <Link className="button button--ghost" to="/shelf">
          返回我的书架
        </Link>
      </p>
    </section>
  )
}
