import { Route, Routes } from 'react-router'
import AppLayout from './components/AppLayout.tsx'
import BookDetailPage from './pages/BookDetailPage.tsx'
import HomePage from './pages/HomePage.tsx'
import SearchPage from './pages/SearchPage.tsx'
import ShelfPage from './pages/ShelfPage.tsx'
import { useBooks } from './hooks/useBooks.ts'
import './App.css'

export default function App() {
  // 书架数据只在 App 里取一次，再传给需要的页面，
  // 所以搜索页和书架页看到的永远是同一份数据，不需要额外同步。
  const { books, addBook, storageError } = useBooks()

  return (
    <Routes>
      <Route element={<AppLayout storageError={storageError} />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/shelf" element={<ShelfPage books={books} addBook={addBook} />} />
        <Route
          path="/search"
          element={<SearchPage books={books} addBook={addBook} />}
        />
        <Route path="/books/:id" element={<BookDetailPage />} />
      </Route>
    </Routes>
  )
}
