import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  CalendarDays,
  MessageSquare,
  Settings,
  LogOut,
  ExternalLink,
  CloudUpload,
} from 'lucide-react'
import { clearToken } from '../../lib/auth'
import clsx from 'clsx'

const links = [
  { to: '/admin', end: true, label: 'Dashboard', icon: LayoutDashboard },
  { to: '/admin/eventos', label: 'Eventos', icon: CalendarDays },
  { to: '/admin/comentarios', label: 'Comentarios', icon: MessageSquare },
  { to: '/admin/migrar-r2', label: 'Migrar a R2', icon: CloudUpload },
  { to: '/admin/configuracion', label: 'Configuración', icon: Settings },
]

export default function AdminLayout() {
  const navigate = useNavigate()

  const logout = () => {
    clearToken()
    navigate('/admin/login')
  }

  return (
    <div className="flex min-h-screen bg-surface">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-line bg-white md:flex">
        <div className="border-b border-line px-5 py-5">
          <p className="font-display text-2xl font-semibold">
            ECA<span className="text-brand">360</span>
          </p>
          <p className="text-xs text-muted">Panel administrativo</p>
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-3">
          {links.map(({ to, end, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition',
                  isActive ? 'bg-brand/10 text-brand' : 'text-muted hover:bg-surface hover:text-ink',
                )
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="space-y-1 border-t border-line p-3">
          <a
            href="/"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted hover:bg-surface hover:text-ink"
          >
            <ExternalLink size={18} /> Ver sitio
          </a>
          <button
            type="button"
            onClick={logout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted hover:bg-surface hover:text-brand"
          >
            <LogOut size={18} /> Cerrar sesión
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-line bg-white px-4 py-3 md:hidden">
          <p className="font-display text-xl font-semibold">
            ECA<span className="text-brand">360</span>
          </p>
          <button type="button" onClick={logout} className="text-sm text-brand">
            Salir
          </button>
        </header>
        <div className="flex gap-1 overflow-x-auto border-b border-line bg-white px-2 py-2 md:hidden">
          {links.map(({ to, end, label }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                clsx(
                  'whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium',
                  isActive ? 'bg-brand text-white' : 'bg-surface text-muted',
                )
              }
            >
              {label}
            </NavLink>
          ))}
        </div>
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
