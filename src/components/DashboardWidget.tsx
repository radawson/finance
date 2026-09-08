'use client'

import React, { useState, forwardRef } from 'react'
import * as Collapsible from '@radix-ui/react-collapsible'
import { ChevronDown, GripVertical } from 'lucide-react'

interface DashboardWidgetProps {
  title: string
  children: React.ReactNode
  defaultOpen?: boolean
  collapsible?: boolean
  badge?: React.ReactNode
  action?: React.ReactNode
  className?: string
  /** Widget ID for collapse persistence; when provided with onCollapseChange, collapse state is controlled by parent */
  widgetId?: string
  /** When true, widget is collapsed (header-only). Used when parent controls state. */
  isCollapsed?: boolean
  /** Called when user toggles collapse. Parent should update collapsedWidgetIds and pass new isCollapsed. */
  onCollapseChange?: (widgetId: string, isCollapsed: boolean) => void
  // These are forwarded by react-grid-layout to the wrapper div
  style?: React.CSSProperties
  onMouseDown?: React.MouseEventHandler
  onMouseUp?: React.MouseEventHandler
  onTouchEnd?: React.TouchEventHandler
}

const DashboardWidget = forwardRef<HTMLDivElement, DashboardWidgetProps>(
  (
    {
      title,
      children,
      defaultOpen = true,
      collapsible = true,
      badge,
      action,
      className = '',
      widgetId,
      isCollapsed,
      onCollapseChange,
      style,
      onMouseDown,
      onMouseUp,
      onTouchEnd,
      ...rest
    },
    ref
  ) => {
    const isControlled = widgetId != null && onCollapseChange != null
    const [internalOpen, setInternalOpen] = useState(defaultOpen)
    const isOpen = isControlled ? !isCollapsed : internalOpen

    const handleOpenChange = (open: boolean) => {
      if (isControlled && widgetId) {
        onCollapseChange(widgetId, !open)
      } else {
        setInternalOpen(open)
      }
    }

    if (!collapsible) {
      return (
        <div
          ref={ref}
          style={style}
          className={`card-flush flex flex-col ${className}`}
          onMouseDown={onMouseDown}
          onMouseUp={onMouseUp}
          onTouchEnd={onTouchEnd}
          {...rest}
        >
          <div className="card-header">
            <div className="flex items-center gap-2">
              <GripVertical
                size={16}
                className="drag-handle text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing flex-shrink-0"
              />
              <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
              {badge}
            </div>
            {action && <div className="flex items-center">{action}</div>}
          </div>
          <div className="card-body flex-1 overflow-auto">{children}</div>
        </div>
      )
    }

    // When collapsed, override the grid-assigned height so the card shrinks
    // to just its header instead of leaving a blank body.
    const collapsedStyle = !isOpen
      ? { ...style, height: 'auto', minHeight: 'unset' }
      : style

    return (
      <Collapsible.Root
        open={isOpen}
        onOpenChange={handleOpenChange}
        asChild
      >
        <div
          ref={ref}
          style={collapsedStyle}
          className={`card-flush flex flex-col ${className}`}
          onMouseDown={onMouseDown}
          onMouseUp={onMouseUp}
          onTouchEnd={onTouchEnd}
          {...rest}
        >
          <div className="card-header">
            <div className="flex items-center gap-2">
              <GripVertical
                size={16}
                className="drag-handle text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing flex-shrink-0"
              />
              <Collapsible.Trigger asChild>
                <button
                  className="flex items-center gap-2 hover:text-gray-700 transition-colors"
                  type="button"
                >
                  <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
                  <ChevronDown
                    size={18}
                    className={`text-gray-500 transition-transform duration-200 ${
                      isOpen ? 'rotate-0' : '-rotate-90'
                    }`}
                  />
                </button>
              </Collapsible.Trigger>
              {badge}
            </div>
            {action && <div className="flex items-center">{action}</div>}
          </div>
          <Collapsible.Content className="flex-1 overflow-auto">
            <div className="card-body">{children}</div>
          </Collapsible.Content>
        </div>
      </Collapsible.Root>
    )
  }
)

DashboardWidget.displayName = 'DashboardWidget'

export default DashboardWidget
