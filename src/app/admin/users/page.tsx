'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import Navbar from '@/components/Navbar'
import { Search, Shield, User, UserX, UserCheck } from 'lucide-react'
import toast from 'react-hot-toast'
import { format } from 'date-fns'

interface UserData {
  id: string
  email: string
  name: string
  role: 'GUEST' | 'USER' | 'ADMIN'
  department: string | null
  isKeycloakUser: boolean
  isActive: boolean
  createdAt: string
  _count: {
    createdTickets: number
    assignedTickets: number
  }
}

export default function AdminUsersPage() {
  const { data: session } = useSession()
  const [users, setUsers] = useState<UserData[]>([])
  const [filteredUsers, setFilteredUsers] = useState<UserData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('ALL')

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/admin/users')
      if (res.ok) {
        const data = await res.json()
        setUsers(data)
        setFilteredUsers(data)
      } else {
        toast.error('Failed to load users')
      }
    } catch (error) {
      toast.error('Failed to load users')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  useEffect(() => {
    let filtered = users

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(
        (user) =>
          user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          user.email.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // Role filter
    if (roleFilter !== 'ALL') {
      filtered = filtered.filter((user) => user.role === roleFilter)
    }

    setFilteredUsers(filtered)
  }, [users, searchTerm, roleFilter])

  const handleRoleChange = async (userId: string, newRole: 'USER' | 'ADMIN') => {
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      })

      if (res.ok) {
        toast.success('User role updated')
        fetchUsers()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Failed to update role')
      }
    } catch (error) {
      toast.error('An error occurred')
    }
  }

  const handleToggleActive = async (userId: string, isActive: boolean) => {
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !isActive }),
      })

      if (res.ok) {
        toast.success(isActive ? 'User deactivated' : 'User activated')
        fetchUsers()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Failed to update user')
      }
    } catch (error) {
      toast.error('An error occurred')
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading users...</p>
          </div>
        </div>
      </div>
    )
  }

  const stats = {
    total: users.length,
    admins: users.filter((u) => u.role === 'ADMIN').length,
    users: users.filter((u) => u.role === 'USER').length,
    guests: users.filter((u) => u.role === 'GUEST').length,
    inactive: users.filter((u) => !u.isActive).length,
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">User Management</h1>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
          <div className="card">
            <p className="text-sm text-gray-600">Total Users</p>
            <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
          </div>
          <div className="card">
            <p className="text-sm text-gray-600">Admins</p>
            <p className="text-2xl font-bold text-purple-600">{stats.admins}</p>
          </div>
          <div className="card">
            <p className="text-sm text-gray-600">Users</p>
            <p className="text-2xl font-bold text-blue-600">{stats.users}</p>
          </div>
          <div className="card">
            <p className="text-sm text-gray-600">Guests</p>
            <p className="text-2xl font-bold text-gray-600">{stats.guests}</p>
          </div>
          <div className="card">
            <p className="text-sm text-gray-600">Inactive</p>
            <p className="text-2xl font-bold text-red-600">{stats.inactive}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="card mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Search by name or email..."
                className="input pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <select
              className="input"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
            >
              <option value="ALL">All Roles</option>
              <option value="ADMIN">Admins</option>
              <option value="USER">Users</option>
              <option value="GUEST">Guests</option>
            </select>
          </div>
        </div>

        {/* Users Table */}
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tickets
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Joined
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredUsers.map((user) => (
                  <tr key={user.id} className={!user.isActive ? 'opacity-50' : ''}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {user.name}
                          {user.id === session?.user?.id && (
                            <span className="ml-2 text-xs text-gray-500">(You)</span>
                          )}
                        </p>
                        <p className="text-sm text-gray-500">{user.email}</p>
                        {user.department && (
                          <p className="text-xs text-gray-400">{user.department}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {user.role === 'ADMIN' && (
                          <span className="px-2 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-800">
                            <Shield size={12} className="inline mr-1" />
                            Admin
                          </span>
                        )}
                        {user.role === 'USER' && (
                          <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                            <User size={12} className="inline mr-1" />
                            User
                          </span>
                        )}
                        {user.role === 'GUEST' && (
                          <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800">
                            <User size={12} className="inline mr-1" />
                            Guest
                          </span>
                        )}
                        {user.isKeycloakUser && (
                          <span className="text-xs text-gray-500">SSO</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        <div>Created: {user._count.createdTickets}</div>
                        {user.role === 'ADMIN' && (
                          <div>Assigned: {user._count.assignedTickets}</div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {user.isActive ? (
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                          Active
                        </span>
                      ) : (
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {format(new Date(user.createdAt), 'MMM d, yyyy')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end gap-2">
                        {user.role !== 'GUEST' && user.id !== session?.user?.id && (
                          <>
                            {user.role === 'USER' && (
                              <button
                                onClick={() => handleRoleChange(user.id, 'ADMIN')}
                                className="text-purple-600 hover:text-purple-900"
                                title="Promote to Admin"
                              >
                                <Shield size={18} />
                              </button>
                            )}
                            {user.role === 'ADMIN' && (
                              <button
                                onClick={() => handleRoleChange(user.id, 'USER')}
                                className="text-blue-600 hover:text-blue-900"
                                title="Demote to User"
                              >
                                <User size={18} />
                              </button>
                            )}
                          </>
                        )}
                        {user.id !== session?.user?.id && (
                          <button
                            onClick={() => handleToggleActive(user.id, user.isActive)}
                            className={
                              user.isActive
                                ? 'text-red-600 hover:text-red-900'
                                : 'text-green-600 hover:text-green-900'
                            }
                            title={user.isActive ? 'Deactivate' : 'Activate'}
                          >
                            {user.isActive ? <UserX size={18} /> : <UserCheck size={18} />}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {filteredUsers.length === 0 && (
              <div className="text-center py-12">
                <p className="text-gray-500">No users found</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

