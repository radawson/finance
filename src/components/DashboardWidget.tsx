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
      style,
      onMouseDown,
      onMouseUp,
      onTouchEnd,
      ...rest
    },
    ref
  ) => {
    const [isOpen, setIsOpen] = useState(defaultOpen)

    if (!collapsible) {
      return (
        <div
          ref={ref}
          style={style}
          className={`bg-white rounded-lg shadow-md overflow-hidden flex flex-col ${className}`}
          onMouseDown={onMouseDown}
          onMouseUp={onMouseUp}
          onTouchEnd={onTouchEnd}
          {...rest}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
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
          <div className="p-4 flex-1 overflow-auto">{children}</div>
        </div>
      )
    }

    return (
      <Collapsible.Root
        open={isOpen}
        onOpenChange={setIsOpen}
        asChild
      >
        <div
          ref={ref}
          style={style}
          className={`bg-white rounded-lg shadow-md overflow-hidden flex flex-col ${className}`}
          onMouseDown={onMouseDown}
          onMouseUp={onMouseUp}
          onTouchEnd={onTouchEnd}
          {...rest}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
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
            <div className="p-4">{children}</div>
          </Collapsible.Content>
        </div>
      </Collapsible.Root>
    )
  }
)

DashboardWidget.displayName = 'DashboardWidget'

export default DashboardWidget
