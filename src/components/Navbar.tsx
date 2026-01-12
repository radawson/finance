'use client'

import { signOut, useSession } from 'next-auth/react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { LogOut, LayoutDashboard, Receipt, Building2, Shield, Users, Calendar, CreditCard, BarChart3 } from 'lucide-react'
import NotificationCenter from './NotificationCenter'

export default function Navbar() {
  const { data: session } = useSession()
  const pathname = usePathname()

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
        { href: '/bills', label: 'My Bills', icon: Receipt },
        { href: '/bills/calendar', label: 'Calendar', icon: Calendar },
        { href: '/vendors', label: 'Vendors', icon: Building2 },
        { href: '/account-types', label: 'Account Types', icon: CreditCard },
        { href: '/analysis', label: 'Analysis', icon: BarChart3 },
      ]

  return (
    <nav className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center gap-8">
            <Link 
              href={isAdmin && isAdminRoute ? '/admin/dashboard' : '/dashboard'}
              className="flex items-center gap-3 hover:opacity-80 transition-opacity"
            >
              <Image 
                src="/logo.png" 
                alt="Kontado Logo" 
                width={32} 
                height={32}
                className="h-8 w-8"
              />
              <h1 className="text-xl font-bold text-primary-600">Kontado</h1>
            </Link>
            <div className="flex gap-4">
              {navLinks.map((link) => {
                const Icon = link.icon
                const isActive = pathname === link.href || (link.href === '/bills/calendar' && pathname?.startsWith('/bills/calendar')) || (link.href === '/analysis' && pathname?.startsWith('/analysis'))
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-primary-100 text-primary-700'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <Icon size={18} />
                    {link.label}
                  </Link>
                )
              })}
            </div>
          </div>

          <div className="flex items-center gap-4">
            {isAdmin && (
              <Link
                href={isAdminRoute ? '/dashboard' : '/admin/dashboard'}
                className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
              >
                <Shield size={18} />
                {isAdminRoute ? 'User View' : 'Admin View'}
              </Link>
            )}
            <div className="flex items-center gap-3 border-l border-gray-300 pl-4">
              <NotificationCenter />
              <div className="text-right">
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
        </div>
      </div>
    </nav>
  )
}

