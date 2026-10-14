const STATUS_CARDS = [
  { key: 'want-to-read', label: '想读' },
  { key: 'reading', label: '正在读' },
  { key: 'finished', label: '已读完' },
]

export default function HomePage() {
  return (
    <section className="page">
      <header className="page__header">
        <h1 className="page__title">首页</h1>
        <p className="page__desc">
          阅读概览：这里会汇总三种阅读状态的数量、正在阅读的书和最近读完的书。
        </p>
      </header>

      <div className="stat-grid">
        {STATUS_CARDS.map((card) => (
          <article className="stat-card" key={card.key}>
            <p className="stat-card__label">{card.label}</p>
            <p className="stat-card__value">—</p>
          </article>
        ))}
      </div>

      <section className="panel">
        <h2 className="panel__title">正在阅读</h2>
        <p className="panel__hint">当前为静态占位，书籍数据将在后续阶段接入。</p>
      </section>

      <section className="panel">
        <h2 className="panel__title">最近完成</h2>
        <p className="panel__hint">当前为静态占位，书籍数据将在后续阶段接入。</p>
      </section>
    </section>
  )
}
