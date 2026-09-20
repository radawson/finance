'use client'

import { useEffect, useState } from 'react'
import { signOut, useSession } from 'next-auth/react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import {
  LogOut,
  LayoutDashboard,
  Receipt,
  Building2,
  Shield,
  Users,
  Calendar,
  CreditCard,
  BarChart3,
  ShoppingCart,
  Wallet,
  Menu,
  X,
  FileText,
  Printer,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react'
import NotificationCenter from './NotificationCenter'
import { ThemeToggle } from './ThemeProvider'

const SIDEBAR_STORAGE_KEY = 'kontado-sidebar-collapsed'

export default function Navbar() {
  const { data: session } = useSession()
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    if (!session) {
      document.body.classList.remove('has-app-shell')
      return
    }
    document.body.classList.add('has-app-shell')
    return () => document.body.classList.remove('has-app-shell')
  }, [session])

  useEffect(() => {
    setCollapsed(document.documentElement.classList.contains('sidebar-collapsed'))
  }, [])

  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  const toggleCollapsed = () => {
    const next = !document.documentElement.classList.contains('sidebar-collapsed')
    document.documentElement.classList.toggle('sidebar-collapsed', next)
    localStorage.setItem(SIDEBAR_STORAGE_KEY, next ? '1' : '0')
    setCollapsed(next)
  }

  if (!session) return null

  const isAdmin = session.user.role === 'ADMIN'
  const isAdminRoute = pathname?.startsWith('/admin')

  const navLinks = isAdmin && isAdminRoute
    ? [
        { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { href: '/bills', label: 'All Bills', icon: Receipt },
        { href: '/vendors', label: 'Vendors', icon: Building2 },
        { href: '/admin/users', label: 'Users', icon: Users },
      ]
    : [
        { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { href: '/bills', label: 'Bills', icon: Receipt },
        { href: '/expenses', label: 'Expenses', icon: ShoppingCart },
        { href: '/eobs', label: 'EOBs', icon: FileText },
        { href: '/reports', label: 'Reports', icon: Printer },
        { href: '/budget', label: 'Budget', icon: Wallet },
        { href: '/bills/calendar', label: 'Calendar', icon: Calendar },
        { href: '/vendors', label: 'Vendors', icon: Building2 },
        { href: '/account-types', label: 'Categories', icon: CreditCard },
        { href: '/analysis', label: 'Analysis', icon: BarChart3 },
      ]

  const isActive = (href: string) =>
    pathname === href ||
    (href === '/bills/calendar' && pathname?.startsWith('/bills/calendar')) ||
    (href === '/analysis' && pathname?.startsWith('/analysis')) ||
    (href === '/eobs' && pathname?.startsWith('/eobs')) ||
    (href === '/reports' && pathname?.startsWith('/reports')) ||
    (href === '/bills' && pathname?.startsWith('/bills') && !pathname?.startsWith('/bills/calendar')) ||
    (href === '/vendors' && pathname?.startsWith('/vendors')) ||
    (href === '/admin/bills' && pathname?.startsWith('/admin/bills')) ||
    (href === '/admin/vendors' && pathname?.startsWith('/admin/vendors')) ||
    (href === '/admin/users' && pathname?.startsWith('/admin/users'))

  const adminToggleHref = isAdminRoute ? '/dashboard' : '/admin/users'
  const adminToggleLabel = isAdminRoute ? 'User View' : 'Admin View'
  const homeHref = '/dashboard'

  const renderSidebar = (compact: boolean) => (
    <div className="flex h-full min-h-0 flex-col">
      <Link
        href={homeHref}
        title="Kontado"
        className={`flex items-center h-16 border-b border-gray-200 shrink-0 hover:opacity-80 transition-opacity ${
          compact ? 'justify-center px-2' : 'gap-3 px-4'
        }`}
      >
        <Image src="/logo.png" alt="Kontado Logo" width={32} height={32} className="h-8 w-8 shrink-0" />
        {!compact && <span className="text-xl font-bold text-primary-600 truncate">Kontado</span>}
      </Link>
      <nav className={`flex-1 overflow-y-auto space-y-1 ${compact ? 'p-2' : 'p-3'}`}>
        {navLinks.map((link) => {
          const Icon = link.icon
          return (
            <Link
              key={link.href}
              href={link.href}
              title={link.label}
              aria-label={link.label}
              className={`flex items-center rounded-md text-sm font-medium transition-colors ${
                compact ? 'justify-center px-2 py-2' : 'gap-3 px-3 py-2'
              } ${
                isActive(link.href)
                  ? 'bg-primary-100 text-primary-700 dark:text-primary-300'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <Icon size={18} className="shrink-0" />
              {!compact && <span className="truncate">{link.label}</span>}
            </Link>
          )
        })}
      </nav>
      {isAdmin && (
        <div className={`border-t border-gray-200 ${compact ? 'p-2' : 'p-3'}`}>
          <Link
            href={adminToggleHref}
            title={adminToggleLabel}
            aria-label={adminToggleLabel}
            className={`flex items-center rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors ${
              compact ? 'justify-center px-2 py-2' : 'gap-3 px-3 py-2'
            }`}
          >
            <Shield size={18} className="shrink-0" />
            {!compact && <span className="truncate">{adminToggleLabel}</span>}
          </Link>
        </div>
      )}
    </div>
  )

  return (
    <>
      <aside className="app-sidebar hidden md:flex flex-col bg-white border-r border-gray-200">
        {renderSidebar(collapsed)}
        <div className={`border-t border-gray-200 ${collapsed ? 'p-2' : 'p-3'}`}>
          <button
            type="button"
            onClick={toggleCollapsed}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-expanded={!collapsed}
            className={`flex items-center w-full rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors ${
              collapsed ? 'justify-center px-2 py-2' : 'gap-3 px-3 py-2'
            }`}
          >
            {collapsed ? <ChevronsRight size={18} className="shrink-0" /> : <ChevronsLeft size={18} className="shrink-0" />}
            {!collapsed && <span>Collapse</span>}
          </button>
        </div>
      </aside>

      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          <button
            type="button"
            className="absolute inset-0 bg-black/50"
            aria-label="Close navigation"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative z-10 h-full w-64 bg-white border-r border-gray-200 shadow-xl">
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="absolute top-3 right-3 p-2 text-gray-600 hover:bg-gray-100 rounded-md"
              aria-label="Close navigation"
            >
              <X size={20} />
            </button>
            {renderSidebar(false)}
          </aside>
        </div>
      )}

      <header className="app-topbar bg-white border-b border-gray-200">
        <div className="flex items-center justify-between gap-3 h-16 px-4 min-w-0">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="md:hidden p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md"
            aria-label="Open navigation"
          >
            <Menu size={22} />
          </button>
          <button
            type="button"
            onClick={toggleCollapsed}
            className="hidden md:inline-flex items-center p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronsRight size={20} /> : <ChevronsLeft size={20} />}
          </button>

          <div className="flex-1 min-w-0" />

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <NotificationCenter />
            <ThemeToggle />
            <div className="text-right pl-3 border-l border-gray-300">
              <p className="text-sm font-medium text-gray-900 leading-tight">{session.user.name}</p>
              <p className="text-xs text-gray-500">{session.user.role}</p>
            </div>
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: '/' })}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
              title="Sign out"
            >
              <LogOut size={18} />
              <span>Sign out</span>
            </button>
          </div>
        </div>
      </header>
    </>
  )
}
