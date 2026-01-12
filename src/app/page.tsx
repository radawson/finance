'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { DollarSign, LogIn, Plus, Calendar, FileText } from 'lucide-react'
import toast from 'react-hot-toast'

export default function Home() {
  const router = useRouter()
  const [categories, setCategories] = useState<any[]>([])
  const [vendors, setVendors] = useState<any[]>([])
  const [formData, setFormData] = useState({
    title: '',
    amount: '',
    dueDate: '',
    categoryId: '',
    vendorId: '',
    description: '',
  })

  useEffect(() => {
    // Fetch global categories for quick entry
    fetch('/api/categories')
      .then((res) => res.json())
      .then((data) => {
        if (!data.error) {
          setCategories(data.filter((cat: any) => cat.isGlobal))
        }
      })
      .catch(() => {
        // Silently fail
      })

    // Fetch vendors from public endpoint (works for both authenticated and anonymous users)
    fetch('/api/vendors/public')
      .then((res) => {
        if (res.ok) {
          return res.json()
        }
        // For errors, return empty array
        return []
      })
      .then((data) => {
        if (Array.isArray(data)) {
          setVendors(data)
        }
      })
      .catch(() => {
        // Silently fail - vendors are optional
        setVendors([])
      })
  }, [])

  const handleQuickEntry = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.title || !formData.amount || !formData.dueDate || !formData.categoryId) {
      toast.error('Please fill in all required fields')
      return
    }

    try {
      const response = await fetch('/api/bills/anonymous', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: formData.title,
          amount: parseFloat(formData.amount),
          dueDate: new Date(formData.dueDate).toISOString(),
          categoryId: formData.categoryId,
          vendorId: formData.vendorId || undefined,
          description: formData.description || undefined,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create bill')
      }

      toast.success('Bill created successfully!')
      
      // Reset form
      setFormData({
        title: '',
        amount: '',
        dueDate: '',
        categoryId: '',
        vendorId: '',
        description: '',
      })
    } catch (error: any) {
      toast.error(error.message || 'Failed to create bill')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-12">
          <div className="flex justify-center mb-6">
            <Image 
              src="/logo.png" 
              alt="Kontado Logo" 
              width={80} 
              height={80}
              className="h-20 w-20"
            />
          </div>
          <h1 className="text-5xl font-bold text-primary-900 mb-4">Kontado</h1>
          <p className="text-xl text-primary-700">
            Bill Tracking & Expense Management
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {/* Quick Bill Entry Card */}
          <div className="bg-white rounded-lg shadow-lg p-8 hover:shadow-xl transition-shadow md:col-span-2">
            <div className="flex justify-center mb-6">
              <div className="bg-primary-100 rounded-full p-6">
                <Plus className="h-12 w-12 text-primary-600" />
              </div>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4 text-center">
              Quick Bill Entry
            </h2>
            <p className="text-gray-600 mb-6 text-center">
              Enter a bill quickly. No login required.
            </p>
            
            <form onSubmit={handleQuickEntry} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Title *
                </label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="e.g., Electric Bill - January"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Amount *
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Due Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.dueDate}
                    onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Vendor (optional)
                </label>
                <select
                  value={formData.vendorId}
                  onChange={(e) => setFormData({ ...formData, vendorId: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="">No vendor</option>
                  {vendors.map((vendor) => (
                    <option key={vendor.id} value={vendor.id}>
                      {vendor.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Category *
                </label>
                <select
                  required
                  value={formData.categoryId}
                  onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="">Select a category</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description (optional)
                </label>
                <textarea
                  rows={2}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="Additional notes..."
                />
              </div>

              <button
                type="submit"
                className="w-full bg-primary-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-colors"
              >
                <Plus className="inline w-5 h-5 mr-2" />
                Create Bill
              </button>
            </form>
            <p className="text-sm text-gray-500 mt-4 text-center">
              No account required
            </p>
          </div>

          {/* Sign In Card */}
          <div className="bg-white rounded-lg shadow-lg p-8 hover:shadow-xl transition-shadow">
            <div className="flex justify-center mb-6">
              <div className="bg-primary-100 rounded-full p-6">
                <LogIn className="h-12 w-12 text-primary-600" />
              </div>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4 text-center">
              Sign In
            </h2>
            <p className="text-gray-600 mb-6 text-center">
              Already have an account? Sign in to manage your bills, view your dashboard, and track expenses.
            </p>
            <Link 
              href="/login"
              className="btn btn-secondary w-full flex items-center justify-center gap-2"
            >
              <LogIn size={20} />
              Sign In
            </Link>
            <p className="text-sm text-gray-500 mt-4 text-center">
              Or <Link href="/register" className="text-primary-600 hover:text-primary-700 font-medium">create an account</Link>
            </p>
          </div>
        </div>

        <div className="mt-16 text-center">
          <h3 className="text-xl font-semibold text-primary-900 mb-6">
            How It Works
          </h3>
          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div>
              <div className="bg-primary-600 text-white rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-4 text-xl font-bold">
                1
              </div>
              <h4 className="font-semibold text-gray-900 mb-2">Enter Your Bill</h4>
              <p className="text-gray-600 text-sm">
                Quickly add bills with title, amount, due date, and category
              </p>
            </div>
            <div>
              <div className="bg-primary-600 text-white rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-4 text-xl font-bold">
                2
              </div>
              <h4 className="font-semibold text-gray-900 mb-2">Track & Manage</h4>
              <p className="text-gray-600 text-sm">
                View all your bills, track due dates, and manage expenses
              </p>
            </div>
            <div>
              <div className="bg-primary-600 text-white rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-4 text-xl font-bold">
                3
              </div>
              <h4 className="font-semibold text-gray-900 mb-2">Stay Organized</h4>
              <p className="text-gray-600 text-sm">
                Categorize bills, set up recurring payments, and never miss a due date
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
