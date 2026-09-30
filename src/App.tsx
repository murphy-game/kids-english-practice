import {
  NavLink,
  Route,
  Routes,
} from 'react-router-dom'

import Home from './pages/Home'
import Practice from './pages/Practice'
import ContentCheck from './pages/ContentCheck'

export default function App() {
  return (
    <div className="min-h-screen bg-[#fff8ef] text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <nav className="mx-auto flex max-w-6xl items-center gap-6 px-5 py-3">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              isActive
                ? 'font-semibold text-emerald-600'
                : 'text-slate-700 hover:text-emerald-600'
            }
          >
            Home
          </NavLink>

          <NavLink
            to="/content-check"
            className={({ isActive }) =>
              isActive
                ? 'font-semibold text-emerald-600'
                : 'text-slate-700 hover:text-emerald-600'
            }
          >
            Content Check
          </NavLink>
        </nav>
      </header>

      <Routes>
        <Route
          path="/"
          element={<Home />}
        />

        <Route
          path="/practice"
          element={<Practice />}
        />

        <Route
          path="/content-check"
          element={<ContentCheck />}
        />

        <Route
          path="*"
          element={<Home />}
        />
      </Routes>
    </div>
  )
}
