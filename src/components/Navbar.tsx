'use client'

import { useState } from 'react'
import { signOut, useSession } from 'next-auth/react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { LogOut, LayoutDashboard, Receipt, Building2, Shield, Users, Calendar, CreditCard, BarChart3, ShoppingCart, Wallet, Menu, X, FileText, Printer } from 'lucide-react'
import NotificationCenter from './NotificationCenter'

export default function Navbar() {
  const { data: session } = useSession()
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  if (!session) return null

  const isAdmin = session.user.role === 'ADMIN'
  const isAdminRoute = pathname?.startsWith('/admin')

  const navLinks = isAdmin && isAdminRoute
    ? [
        { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { href: '/admin/bills', label: 'All Bills', icon: Receipt },
        { href: '/admin/vendors', label: 'Vendors', icon: Building2 },
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
    (href === '/reports' && pathname?.startsWith('/reports'))

  const linkClasses = (href: string) =>
    `flex items-center gap-1.5 px-2 py-1.5 rounded-md text-sm font-medium whitespace-nowrap transition-colors ${
      isActive(href) ? 'bg-primary-100 text-primary-700' : 'text-gray-700 hover:bg-gray-100'
    }`

  const adminToggleHref = isAdminRoute ? '/dashboard' : '/admin/dashboard'
  const adminToggleLabel = isAdminRoute ? 'User View' : 'Admin View'

  return (
    <nav className="bg-white border-b border-gray-200 w-full overflow-x-hidden">
      <div className="app-nav-container">
        <div className="flex justify-between items-center min-h-16 gap-3 min-w-0">
          {/* Brand + desktop links */}
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <Link
              href={isAdmin && isAdminRoute ? '/admin/dashboard' : '/dashboard'}
              className="flex items-center gap-2 shrink-0 hover:opacity-80 transition-opacity"
            >
              <Image src="/logo.png" alt="Kontado Logo" width={32} height={32} className="h-8 w-8" />
              <h1 className="text-xl font-bold text-primary-600">Kontado</h1>
            </Link>
            <div className="hidden xl:flex flex-wrap items-center gap-0.5 min-w-0">
              {navLinks.map((link) => {
                const Icon = link.icon
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    title={link.label}
                    aria-label={link.label}
                    className={linkClasses(link.href)}
                  >
                    <Icon size={18} className="shrink-0" />
                    <span className="hidden 2xl:inline">{link.label}</span>
                  </Link>
                )
              })}
            </div>
          </div>

          {/* Desktop right cluster */}
          <div className="hidden xl:flex items-center gap-3 shrink-0">
            {isAdmin && (
              <Link href={adminToggleHref} className="flex items-center gap-1.5 px-2 py-1.5 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors whitespace-nowrap">
                <Shield size={18} />
                <span className="hidden 2xl:inline">{adminToggleLabel}</span>
              </Link>
            )}
            <div className="flex items-center gap-3 border-l border-gray-300 pl-3">
              <NotificationCenter />
              <div className="text-right hidden 2xl:block">
                <p className="text-sm font-medium text-gray-900">{session.user.name}</p>
                <p className="text-xs text-gray-500">{session.user.role}</p>
              </div>
              <button
                onClick={() => signOut({ callbackUrl: '/' })}
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
                title="Sign out"
              >
                <LogOut size={20} />
              </button>
            </div>
          </div>

          {/* Mobile / laptop: notifications + hamburger */}
          <div className="flex items-center gap-1 xl:hidden">
            <NotificationCenter />
            <button
              onClick={() => setMobileOpen((v) => !v)}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
              aria-label="Toggle navigation menu"
              aria-expanded={mobileOpen}
            >
              {mobileOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="xl:hidden border-t border-gray-200 bg-white">
          <div className="app-nav-container py-3 flex flex-col gap-1">
            {navLinks.map((link) => {
              const Icon = link.icon
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                    isActive(link.href) ? 'bg-primary-100 text-primary-700' : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <Icon size={18} />
                  {link.label}
                </Link>
              )
            })}
            {isAdmin && (
              <Link
                href={adminToggleHref}
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
              >
                <Shield size={18} />
                {adminToggleLabel}
              </Link>
            )}
            <div className="flex items-center justify-between border-t border-gray-200 mt-2 pt-3 px-3">
              <div>
                <p className="text-sm font-medium text-gray-900">{session.user.name}</p>
                <p className="text-xs text-gray-500">{session.user.role}</p>
              </div>
              <button onClick={() => signOut({ callbackUrl: '/' })} className="btn btn-secondary btn-sm">
                <LogOut size={16} />
                Sign out
              </button>
            </div>
          </div>
        </div>
      )}
    </nav>
  )
}
