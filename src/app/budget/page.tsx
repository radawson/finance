'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import { Category, BudgetEnvelope, CategoryKind } from '@/types'
import { Wallet } from 'lucide-react'
import toast from 'react-hot-toast'

export default function BudgetPage() {
  const { data: session } = useSession()
  const isAdmin = session?.user?.role === 'ADMIN'

  const [categories, setCategories] = useState<Category[]>([])
  const [envelopes, setEnvelopes] = useState<BudgetEnvelope[]>([])
  const [spentByCat, setSpentByCat] = useState<Record<string, number>>({})
  const [inputs, setInputs] = useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (session) loadAll()
  }, [session])

  const loadAll = async () => {
    try {
      const [catRes, envRes, statsRes] = await Promise.all([
        fetch('/api/categories'),
        fetch('/api/budget/envelopes'),
        fetch('/api/stats?categoryPeriod=month'),
      ])
      const cats: Category[] = catRes.ok ? await catRes.json() : []
      const envs: BudgetEnvelope[] = envRes.ok ? await envRes.json() : []
      setCategories(cats)
      setEnvelopes(envs)
      const initialInputs: Record<string, string> = {}
      envs.forEach((e) => {
        initialInputs[e.categoryId] = String(Number(e.amount))
      })
      setInputs(initialInputs)
      if (statsRes.ok) {
        const stats = await statsRes.json()
        const map: Record<string, number> = {}
        for (const c of stats.categoryBreakdown ?? []) {
          map[c.categoryId] = c.totalAmount
        }
        setSpentByCat(map)
      }
    } catch {
      toast.error('Failed to load budget data')
    } finally {
      setIsLoading(false)
    }
  }

  const envelopeFor = (categoryId: string) => envelopes.find((e) => e.categoryId === categoryId)
  const spentFor = (categoryId: string) => spentByCat[categoryId] ?? 0

  const saveBudget = async (category: Category) => {
    const raw = inputs[category.id]?.trim() ?? ''
    const num = Number(raw)
    const existing = envelopeFor(category.id)

    // Cleared or zero → remove any envelope
    if (!raw || isNaN(num) || num <= 0) {
      if (existing) {
        const res = await fetch(`/api/budget/envelopes/${existing.id}`, { method: 'DELETE' })
        if (res.ok) {
          setEnvelopes((prev) => prev.filter((e) => e.id !== existing.id))
          toast.success(`Cleared budget for ${category.name}`)
        } else {
          toast.error('Failed to clear budget')
        }
      }
      return
    }

    // No change
    if (existing && Number(existing.amount) === num) return

    const res = await fetch('/api/budget/envelopes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ categoryId: category.id, amount: raw }),
    })
    if (res.ok) {
      const saved: BudgetEnvelope = await res.json()
      setEnvelopes((prev) => {
        const others = prev.filter((e) => e.categoryId !== category.id)
        return [...others, saved]
      })
      toast.success(`Budget set for ${category.name}`)
    } else {
      toast.error('Failed to save budget')
    }
  }

  const changeKind = async (category: Category, kind: CategoryKind) => {
    const res = await fetch(`/api/categories/${category.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind }),
    })
    if (res.ok) {
      setCategories((prev) => prev.map((c) => (c.id === category.id ? { ...c, kind } : c)))
      toast.success(`${category.name} marked ${kind.toLowerCase()}`)
    } else {
      const data = await res.json().catch(() => ({}))
      toast.error(data.error || 'Failed to change category type')
    }
  }

  const sorted = [...categories].sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'VARIABLE' ? -1 : 1
    return a.name.localeCompare(b.name)
  })

  const totalBudget = envelopes.reduce((s, e) => s + Number(e.amount), 0)
  const totalSpentBudgeted = envelopes.reduce((s, e) => s + spentFor(e.categoryId), 0)
  const remaining = totalBudget - totalSpentBudgeted

  if (!session) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <p className="text-gray-600">Please log in to manage budgets</p>
            <Link href="/login" className="text-primary-600 hover:text-primary-700 mt-4 inline-block">
              Login
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="app-page-container-wide">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Budgets</h1>
          <p className="mt-2 text-gray-600">
            Set a monthly target for your variable categories and track spend against it this month.
          </p>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-md p-6">
            <p className="text-sm text-gray-500">Monthly budget</p>
            <p className="text-2xl font-bold text-gray-900">${totalBudget.toFixed(2)}</p>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6">
            <p className="text-sm text-gray-500">Spent this month</p>
            <p className="text-2xl font-bold text-gray-900">${totalSpentBudgeted.toFixed(2)}</p>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6">
            <p className="text-sm text-gray-500">Remaining</p>
            <p className={`text-2xl font-bold ${remaining < 0 ? 'text-red-600' : 'text-green-600'}`}>
              ${remaining.toFixed(2)}
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading budgets...</p>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Monthly budget</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Spent (mo.)</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-64">Progress</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {sorted.map((category) => {
                    const env = envelopeFor(category.id)
                    const budget = env ? Number(env.amount) : 0
                    const spent = spentFor(category.id)
                    const isVariable = category.kind === 'VARIABLE'
                    const kindEditable = isAdmin || !category.isGlobal
                    const ratio = budget > 0 ? spent / budget : 0
                    const barColor =
                      ratio >= 1 ? 'bg-red-500' : ratio >= 0.8 ? 'bg-yellow-500' : 'bg-green-500'
                    return (
                      <tr key={category.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            {category.color && (
                              <div className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: category.color }} />
                            )}
                            <span className="text-sm font-medium text-gray-900">{category.name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {kindEditable ? (
                            <select
                              value={category.kind}
                              onChange={(e) => changeKind(category, e.target.value as CategoryKind)}
                              className="text-sm border border-gray-300 rounded-md px-2 py-1 focus:ring-2 focus:ring-primary-500"
                            >
                              <option value="VARIABLE">Variable</option>
                              <option value="FIXED">Fixed</option>
                            </select>
                          ) : (
                            <span className="text-sm text-gray-600">
                              {category.kind === 'VARIABLE' ? 'Variable' : 'Fixed'}
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {isVariable ? (
                            <div className="relative w-32">
                              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500">$</span>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={inputs[category.id] ?? ''}
                                onChange={(e) => setInputs({ ...inputs, [category.id]: e.target.value })}
                                onBlur={() => saveBudget(category)}
                                placeholder="0.00"
                                className="w-full pl-7 pr-2 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
                              />
                            </div>
                          ) : (
                            <span className="text-sm text-gray-400" title="Fixed categories are projected from obligations">
                              from bills
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                          ${spent.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {budget > 0 ? (
                            <div>
                              <div className="w-full bg-gray-200 rounded-full h-2">
                                <div
                                  className={`${barColor} h-2 rounded-full`}
                                  style={{ width: `${Math.min(100, ratio * 100)}%` }}
                                />
                              </div>
                              <p className={`text-xs mt-1 ${budget - spent < 0 ? 'text-red-600' : 'text-gray-500'}`}>
                                ${(budget - spent).toFixed(2)} {budget - spent < 0 ? 'over' : 'left'}
                              </p>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
