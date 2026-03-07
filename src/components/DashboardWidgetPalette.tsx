'use client'

import React, { useState, useEffect } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import * as Checkbox from '@radix-ui/react-checkbox'
import { X, Check, LayoutGrid, Plus, Trash2 } from 'lucide-react'
import {
  ALL_WIDGET_IDS,
  WIDGET_META,
  BalanceWidgetInstance,
  type WidgetId,
} from '@/lib/dashboard-layout'

interface DashboardWidgetPaletteProps {
  /** Currently visible widget IDs (user preference). null = all. */
  visibleWidgetIds: Set<string> | null
  /** Which widgets have data available (used for info display) */
  dataAvailableIds: Set<string>
  /** Called when user changes visibility */
  onVisibilityChange: (visibleIds: string[]) => void
  accountTypes: Array<{ id: string; name: string }>
  balanceWidgetInstances: BalanceWidgetInstance[]
  onAddBalanceWidget: (accountTypeId: string, accountTypeName: string) => void
  onRemoveBalanceWidget: (instanceId: string) => void
}

export default function DashboardWidgetPalette({
  visibleWidgetIds,
  dataAvailableIds,
  onVisibilityChange,
  accountTypes,
  balanceWidgetInstances,
  onAddBalanceWidget,
  onRemoveBalanceWidget,
}: DashboardWidgetPaletteProps) {
  const [open, setOpen] = useState(false)
  // Local state for the checked set (initialized from props when dialog opens)
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [selectedAccountTypeId, setSelectedAccountTypeId] = useState('')

  // Sync local state when dialog opens
  useEffect(() => {
    if (open) {
      if (visibleWidgetIds) {
        setChecked(new Set(visibleWidgetIds))
      } else {
        // null = all visible by default
        setChecked(new Set(ALL_WIDGET_IDS))
      }
      setSelectedAccountTypeId(accountTypes[0]?.id ?? '')
    }
  }, [open, visibleWidgetIds, accountTypes])

  const handleToggle = (id: WidgetId) => {
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const handleSelectAll = () => {
    setChecked(new Set(ALL_WIDGET_IDS))
  }

  const handleDeselectAll = () => {
    setChecked(new Set())
  }

  const handleApply = () => {
    const allSelected = ALL_WIDGET_IDS.every((id) => checked.has(id))
    if (allSelected) {
      // If all are selected, pass empty array to signify "show all that have data" (default)
      onVisibilityChange([])
    } else {
      onVisibilityChange(Array.from(checked))
    }
    setOpen(false)
  }

  const handleAddBalanceWidget = () => {
    const selectedType = accountTypes.find((accountType) => accountType.id === selectedAccountTypeId)
    if (!selectedType) return
    onAddBalanceWidget(selectedType.id, selectedType.name)
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          className="btn btn-secondary flex items-center gap-2 text-sm"
          title="Customize dashboard widgets"
        >
          <LayoutGrid size={16} />
          Customize
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 z-50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl shadow-2xl p-6 w-full max-w-md z-50 max-h-[85vh] flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="text-lg font-semibold text-gray-900">
              Customize Dashboard
            </Dialog.Title>
            <Dialog.Close asChild>
              <button className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100">
                <X size={20} />
              </button>
            </Dialog.Close>
          </div>

          <Dialog.Description className="text-sm text-gray-500 mb-4">
            Choose which widgets appear on your dashboard. Widgets without data will be hidden automatically.
          </Dialog.Description>

          <div className="flex items-center gap-3 mb-4">
            <button
              onClick={handleSelectAll}
              className="text-xs font-medium text-primary-600 hover:text-primary-700"
            >
              Select all
            </button>
            <span className="text-gray-300">|</span>
            <button
              onClick={handleDeselectAll}
              className="text-xs font-medium text-primary-600 hover:text-primary-700"
            >
              Deselect all
            </button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-1 mb-4">
            {ALL_WIDGET_IDS.map((id) => {
              const meta = WIDGET_META[id]
              const hasData = dataAvailableIds.has(id)
              const isChecked = checked.has(id)

              return (
                <label
                  key={id}
                  className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <Checkbox.Root
                    className="shrink-0 mt-0.5 h-5 w-5 rounded border border-gray-300 bg-white data-[state=checked]:bg-primary-600 data-[state=checked]:border-primary-600 flex items-center justify-center transition-colors"
                    checked={isChecked}
                    onCheckedChange={() => handleToggle(id)}
                  >
                    <Checkbox.Indicator>
                      <Check size={14} className="text-white" />
                    </Checkbox.Indicator>
                  </Checkbox.Root>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900">
                        {meta.label}
                      </span>
                      {!hasData && (
                        <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                          no data
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {meta.description}
                    </p>
                  </div>
                </label>
              )
            })}
          </div>

          <div className="pt-3 border-t border-gray-100 mb-4">
            <h4 className="text-sm font-semibold text-gray-900 mb-2">
              Balance Graph Widgets
            </h4>
            <p className="text-xs text-gray-500 mb-3">
              Add one or more account-type balance widgets.
            </p>

            <div className="flex items-center gap-2 mb-3">
              <select
                value={selectedAccountTypeId}
                onChange={(event) => setSelectedAccountTypeId(event.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                {accountTypes.map((accountType) => (
                  <option key={accountType.id} value={accountType.id}>
                    {accountType.name}
                  </option>
                ))}
              </select>
              <button
                onClick={handleAddBalanceWidget}
                disabled={!selectedAccountTypeId || accountTypes.length === 0}
                className="btn btn-secondary text-sm px-3 py-2 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1"
              >
                <Plus size={14} />
                Add
              </button>
            </div>

            <div className="space-y-2 max-h-36 overflow-y-auto">
              {balanceWidgetInstances.length === 0 ? (
                <p className="text-xs text-gray-500">No custom balance widgets yet.</p>
              ) : (
                balanceWidgetInstances.map((instance) => (
                  <div
                    key={instance.instanceId}
                    className="flex items-center justify-between rounded-md border border-gray-200 px-3 py-2"
                  >
                    <span className="text-sm text-gray-800">{instance.config.accountTypeName}</span>
                    <button
                      onClick={() => onRemoveBalanceWidget(instance.instanceId)}
                      className="text-gray-400 hover:text-red-500 transition-colors"
                      title="Remove widget"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
            <Dialog.Close asChild>
              <button className="btn btn-secondary text-sm px-4 py-2">
                Cancel
              </button>
            </Dialog.Close>
            <button
              onClick={handleApply}
              className="btn btn-primary text-sm px-4 py-2"
            >
              Apply
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
