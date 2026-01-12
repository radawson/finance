'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useParams, useRouter } from 'next/navigation'
import Navbar from '@/components/Navbar'
import { Vendor, VendorAccount, AccountType } from '@/types'
import { ArrowLeft, Plus, Edit, Trash2, Building2, CreditCard } from 'lucide-react'
import toast from 'react-hot-toast'
import Link from 'next/link'
import { useSocket } from '@/components/SocketProvider'
import { SocketEvents } from '@/lib/socketio-server'
import { formatPhoneForDisplay } from '@/lib/phone-formatting'

export default function VendorDetailsPage() {
  const { data: session } = useSession()
  const params = useParams()
  const router = useRouter()
  const vendorId = params.id as string

  const [vendor, setVendor] = useState<Vendor | null>(null)
  const [accounts, setAccounts] = useState<VendorAccount[]>([])
  const [accountTypes, setAccountTypes] = useState<AccountType[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false)
  const [isQuickAddModalOpen, setIsQuickAddModalOpen] = useState(false)
  const [editingAccount, setEditingAccount] = useState<VendorAccount | null>(null)
  const [accountFormData, setAccountFormData] = useState({
    accountNumber: '',
    accountTypeId: '',
    nickname: '',
    notes: '',
  })
  const [quickAddFormData, setQuickAddFormData] = useState({
    name: '',
  })

  const { socket, isConnected } = useSocket()

  useEffect(() => {
    if (session && vendorId) {
      fetchVendor()
      fetchAccounts()
      fetchAccountTypes()
    }
  }, [session, vendorId])

  // Listen for WebSocket events for real-time updates
  useEffect(() => {
    if (!socket || !isConnected || !vendorId) return

    // Join vendor room
    socket.emit('join', `vendor:${vendorId}`)

    // Listen for account events
    const handleAccountCreated = (account: VendorAccount) => {
      if (account.vendorId === vendorId) {
        setAccounts((prev) => [account, ...prev])
        // No toast - user who created it already got feedback from API call
        // This is for real-time updates for other users viewing the same vendor
      }
    }

    const handleAccountUpdated = (account: VendorAccount) => {
      if (account.vendorId === vendorId) {
        setAccounts((prev) =>
          prev.map((acc) => (acc.id === account.id ? account : acc))
        )
        // No toast - user who updated it already got feedback from API call
      }
    }

    const handleAccountDeleted = (data: { id: string; vendorId: string }) => {
      if (data.vendorId === vendorId) {
        setAccounts((prev) => prev.filter((acc) => acc.id !== data.id))
        // No toast - user who deleted it already got feedback from API call
      }
    }

    socket.on(SocketEvents.VENDOR_ACCOUNT_CREATED, handleAccountCreated)
    socket.on(SocketEvents.VENDOR_ACCOUNT_UPDATED, handleAccountUpdated)
    socket.on(SocketEvents.VENDOR_ACCOUNT_DELETED, handleAccountDeleted)

    return () => {
      socket.emit('leave', `vendor:${vendorId}`)
      socket.off(SocketEvents.VENDOR_ACCOUNT_CREATED, handleAccountCreated)
      socket.off(SocketEvents.VENDOR_ACCOUNT_UPDATED, handleAccountUpdated)
      socket.off(SocketEvents.VENDOR_ACCOUNT_DELETED, handleAccountDeleted)
    }
  }, [socket, isConnected, vendorId])

  const fetchVendor = async () => {
    try {
      const response = await fetch(`/api/vendors/${vendorId}`)
      if (response.ok) {
        const data = await response.json()
        setVendor(data)
      } else {
        toast.error('Failed to load vendor')
        router.push('/vendors')
      }
    } catch (error) {
      toast.error('Failed to load vendor')
      router.push('/vendors')
    } finally {
      setIsLoading(false)
    }
  }

  const fetchAccounts = async () => {
    try {
      const response = await fetch(`/api/vendors/${vendorId}/accounts`)
      if (response.ok) {
        const data = await response.json()
        setAccounts(data)
      }
    } catch (error) {
      // Silently fail
    }
  }

  const fetchAccountTypes = async () => {
    try {
      const response = await fetch('/api/account-types')
      if (response.ok) {
        const data = await response.json()
        setAccountTypes(data)
      }
    } catch (error) {
      // Silently fail
    }
  }

  const handleQuickAdd = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      const response = await fetch('/api/account-types', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: quickAddFormData.name }),
      })

      if (response.ok) {
        const newAccountType = await response.json()
        setAccountTypes([...accountTypes, newAccountType])
        setAccountFormData({ ...accountFormData, accountTypeId: newAccountType.id })
        setQuickAddFormData({ name: '' })
        setIsQuickAddModalOpen(false)
        toast.success('Account type created')
      } else {
        const data = await response.json()
        toast.error(data.error || 'Failed to create account type')
      }
    } catch (error) {
      toast.error('Failed to create account type')
    }
  }

  const handleAccountSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      const url = editingAccount
        ? `/api/vendors/${vendorId}/accounts/${editingAccount.id}`
        : `/api/vendors/${vendorId}/accounts`
      const method = editingAccount ? 'PATCH' : 'POST'

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accountNumber: accountFormData.accountNumber,
          accountTypeId: accountFormData.accountTypeId || null,
          nickname: accountFormData.nickname || null,
          notes: accountFormData.notes || null,
        }),
      })

      if (response.ok) {
        toast.success(editingAccount ? 'Account updated' : 'Account created')
        setIsAccountModalOpen(false)
        setEditingAccount(null)
        setAccountFormData({
          accountNumber: '',
          accountTypeId: '',
          nickname: '',
          notes: '',
        })
        fetchAccounts()
      } else {
        const data = await response.json()
        toast.error(data.error || 'Failed to save account')
      }
    } catch (error) {
      toast.error('Failed to save account')
    }
  }

  const handleDeleteAccount = async (accountId: string) => {
    if (!confirm('Are you sure you want to delete this account?')) {
      return
    }

    try {
      const response = await fetch(`/api/vendors/${vendorId}/accounts/${accountId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        toast.success('Account deleted')
        fetchAccounts()
      } else {
        const data = await response.json()
        toast.error(data.error || 'Failed to delete account')
      }
    } catch (error) {
      toast.error('Failed to delete account')
    }
  }

  const openEditAccountModal = (account: VendorAccount) => {
    setEditingAccount(account)
    setAccountFormData({
      accountNumber: account.accountNumber,
      accountTypeId: account.accountTypeId || account.type?.id || '',
      nickname: account.nickname || '',
      notes: account.notes || '',
    })
    setIsAccountModalOpen(true)
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <p className="text-gray-600">Please log in to view vendor details</p>
          </div>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading vendor...</p>
          </div>
        </div>
      </div>
    )
  }

  if (!vendor) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link
          href="/vendors"
          className="inline-flex items-center text-gray-600 hover:text-gray-900 mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Vendors
        </Link>

        {/* Vendor Info */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center">
              <Building2 className="w-8 h-8 text-gray-400 mr-3" />
              <div>
                <h1 className="text-3xl font-bold text-gray-900">{vendor.name}</h1>
                {vendor.description && (
                  <p className="text-gray-600 mt-1">{vendor.description}</p>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
            {vendor.email && (
              <div>
                <span className="text-sm font-medium text-gray-500">Email</span>
                <p className="text-gray-900">{vendor.email}</p>
              </div>
            )}
            {vendor.phone && (
              <div>
                <span className="text-sm font-medium text-gray-500">Phone</span>
                <p className="text-gray-900">{formatPhoneForDisplay(vendor.phone)}</p>
              </div>
            )}
            {vendor.address && (
              <div className="md:col-span-2">
                <span className="text-sm font-medium text-gray-500">Address</span>
                <p className="text-gray-900">
                  {vendor.address}
                  {vendor.city && `, ${vendor.city}`}
                  {vendor.state && `, ${vendor.state}`}
                  {vendor.zip && ` ${vendor.zip}`}
                  {vendor.country && `, ${vendor.country}`}
                </p>
              </div>
            )}
            {vendor.website && (
              <div>
                <span className="text-sm font-medium text-gray-500">Website</span>
                <p className="text-gray-900">
                  <a
                    href={vendor.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary-600 hover:text-primary-700"
                  >
                    {vendor.website}
                  </a>
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Accounts Section */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Account Numbers</h2>
              <p className="text-sm text-gray-600 mt-1">
                Manage account numbers for this vendor (optional)
              </p>
            </div>
            <button
              onClick={() => {
                setEditingAccount(null)
                setAccountFormData({
                  accountNumber: '',
                  accountTypeId: '',
                  nickname: '',
                  notes: '',
                })
                setIsAccountModalOpen(true)
              }}
              className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              <Plus className="w-5 h-5 mr-2" />
              Add Account
            </button>
          </div>

          {accounts.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed border-gray-300 rounded-lg">
              <CreditCard className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 mb-4">No account numbers added yet</p>
              <p className="text-sm text-gray-500">
                Account numbers are optional and can be added later
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {accounts.map((account) => (
                <div
                  key={account.id}
                  className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <CreditCard className="w-5 h-5 text-gray-400" />
                      <div>
                        <h3 className="font-medium text-gray-900">
                          {account.nickname || account.type?.name || account.accountType || 'Account'}
                        </h3>
                        <p className="text-sm text-gray-600">
                          {account.accountNumber && account.accountNumber.length >= 4 
                            ? `****${account.accountNumber.slice(-4)}` 
                            : account.accountNumber}
                          {account.type?.name && ` • ${account.type.name}`}
                        </p>
                        {account.notes && (
                          <p className="text-sm text-gray-500 mt-1">{account.notes}</p>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openEditAccountModal(account)}
                      className="p-2 text-gray-600 hover:text-primary-600 transition-colors"
                      title="Edit account"
                    >
                      <Edit className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleDeleteAccount(account.id)}
                      className="p-2 text-gray-600 hover:text-red-600 transition-colors"
                      title="Delete account"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Account Modal */}
        {isAccountModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
            <div className="bg-white rounded-lg shadow-xl p-6 max-w-lg w-full my-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                {editingAccount ? 'Edit Account' : 'Add Account'}
              </h2>
              <form onSubmit={handleAccountSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Account Number *
                  </label>
                  <input
                    type="text"
                    required
                    value={accountFormData.accountNumber}
                    onChange={(e) => {
                      const value = e.target.value
                      setAccountFormData({
                        ...accountFormData,
                        accountNumber: value,
                      })
                    }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="Enter account number"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Account Type
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={accountFormData.accountTypeId}
                      onChange={(e) => setAccountFormData({ ...accountFormData, accountTypeId: e.target.value })}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    >
                      <option value="">No account type</option>
                      {accountTypes.map((type) => (
                        <option key={type.id} value={type.id}>
                          {type.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => setIsQuickAddModalOpen(true)}
                      className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm"
                      title="Add new account type"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nickname
                  </label>
                  <input
                    type="text"
                    value={accountFormData.nickname}
                    onChange={(e) => setAccountFormData({ ...accountFormData, nickname: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="e.g., Primary Mortgage, HELOC"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Notes
                  </label>
                  <textarea
                    value={accountFormData.notes}
                    onChange={(e) => setAccountFormData({ ...accountFormData, notes: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    rows={3}
                    placeholder="Optional notes about this account"
                  />
                </div>
                <div className="flex gap-4">
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                  >
                    {editingAccount ? 'Update' : 'Create'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsAccountModalOpen(false)
                      setEditingAccount(null)
                      setAccountFormData({
                        accountNumber: '',
                        accountTypeId: '',
                        nickname: '',
                        notes: '',
                      })
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

        {/* Quick Add Account Type Modal */}
        {isQuickAddModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Add Account Type</h2>
              <form onSubmit={handleQuickAdd} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={quickAddFormData.name}
                    onChange={(e) => setQuickAddFormData({ name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="e.g., Mortgage, Loan"
                    autoFocus
                  />
                </div>
                <div className="flex gap-4">
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                  >
                    Create
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsQuickAddModalOpen(false)
                      setQuickAddFormData({ name: '' })
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
