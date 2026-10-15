import { NavLink, Outlet } from 'react-router'

type AppLayoutProps = {
  /** 本地存储出问题时的提示；正常情况下是 null */
  storageError?: string | null
}

type NavItem = {
  to: string
  label: string
  end?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { to: '/', label: '首页', end: true },
  { to: '/shelf', label: '我的书架' },
  { to: '/search', label: '书籍搜索' },
  // 详情页需要具体的书籍 id，入口统一放在书籍卡片上（书架、首页都能点进去），
  // 所以这里不再放一个指向假 id 的导航项，避免点进去看到"没有找到这本书"。
]

export default function AppLayout({ storageError }: AppLayoutProps) {
  return (
    <div className="app">
      <header className="site-header">
        <div className="site-header__inner">
          <NavLink className="brand" to="/">
            ReadFlow
          </NavLink>

          <nav className="nav" aria-label="主导航">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  isActive ? 'nav__link nav__link--active' : 'nav__link'
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      {storageError ? (
        <p className="storage-warning" role="alert">
          {storageError}
        </p>
      ) : null}

      <main className="site-main">
        <Outlet />
      </main>
    </div>
  )
}
