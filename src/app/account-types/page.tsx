'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import Navbar from '@/components/Navbar'
import { AccountType } from '@/types'
import { Plus, Edit, Trash2, CreditCard } from 'lucide-react'
import toast from 'react-hot-toast'

export default function AccountTypesPage() {
  const { data: session } = useSession()
  const [accountTypes, setAccountTypes] = useState<AccountType[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingAccountType, setEditingAccountType] = useState<AccountType | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
  })

  useEffect(() => {
    if (session) {
      fetchAccountTypes()
    }
  }, [session])

  const fetchAccountTypes = async () => {
    try {
      const response = await fetch('/api/account-types')
      if (response.ok) {
        const data = await response.json()
        setAccountTypes(data)
      } else {
        toast.error('Failed to load account types')
      }
    } catch (error) {
      toast.error('Failed to load account types')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      const url = editingAccountType
        ? `/api/account-types/${editingAccountType.id}`
        : '/api/account-types'
      const method = editingAccountType ? 'PATCH' : 'POST'

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      if (response.ok) {
        toast.success(editingAccountType ? 'Account type updated' : 'Account type created')
        setIsModalOpen(false)
        setEditingAccountType(null)
        setFormData({ name: '', description: '' })
        fetchAccountTypes()
      } else {
        const data = await response.json()
        toast.error(data.error || 'Failed to save account type')
      }
    } catch (error) {
      toast.error('Failed to save account type')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this account type?')) {
      return
    }

    try {
      const response = await fetch(`/api/account-types/${id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        toast.success('Account type deleted')
        fetchAccountTypes()
      } else {
        const data = await response.json()
        toast.error(data.error || 'Failed to delete account type')
      }
    } catch (error) {
      toast.error('Failed to delete account type')
    }
  }

  const openEditModal = (accountType: AccountType) => {
    setEditingAccountType(accountType)
    setFormData({
      name: accountType.name,
      description: accountType.description || '',
    })
    setIsModalOpen(true)
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <p className="text-gray-600">Please log in to manage account types</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Account Types</h1>
            <p className="mt-2 text-gray-600">Manage account types for vendor accounts</p>
          </div>
          <button
            onClick={() => {
              setEditingAccountType(null)
              setFormData({ name: '', description: '' })
              setIsModalOpen(true)
            }}
            className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            <Plus className="w-5 h-5 mr-2" />
            New Account Type
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading account types...</p>
            </div>
          </div>
        ) : accountTypes.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <CreditCard className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 mb-4">No account types yet</p>
            <button
              onClick={() => {
                setEditingAccountType(null)
                setFormData({ name: '', description: '' })
                setIsModalOpen(true)
              }}
              className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              <Plus className="w-5 h-5 mr-2" />
              Create Your First Account Type
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Description
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {accountTypes.map((accountType) => (
                  <tr key={accountType.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{accountType.name}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-500">
                        {accountType.description || <span className="text-gray-400">—</span>}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => openEditModal(accountType)}
                          className="text-primary-600 hover:text-primary-900"
                          title="Edit"
                        >
                          <Edit className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleDelete(accountType.id)}
                          className="text-red-600 hover:text-red-900"
                          title="Delete"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
            <div className="bg-white rounded-lg shadow-xl p-6 max-w-lg w-full my-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                {editingAccountType ? 'Edit Account Type' : 'New Account Type'}
              </h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="e.g., Mortgage, Loan, Credit Card"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    rows={3}
                    placeholder="Optional description"
                  />
                </div>
                <div className="flex gap-4">
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                  >
                    {editingAccountType ? 'Update' : 'Create'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsModalOpen(false)
                      setEditingAccountType(null)
                      setFormData({ name: '', description: '' })
                    }}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
