'use client'

import { Notification } from '@/types'
import { formatDistanceToNow } from 'date-fns'
import { Receipt, MessageSquare, Paperclip, UserPlus } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface NotificationItemProps {
  notification: Notification
  onMarkAsRead: (id: string) => void
  onDelete: (id: string) => void
}

export default function NotificationItem({
  notification,
  onMarkAsRead,
  onDelete,
}: NotificationItemProps) {
  const router = useRouter()

  const getIcon = () => {
    switch (notification.type) {
      case 'bill_assigned':
        return <UserPlus size={18} className="text-blue-500" />
      case 'bill_updated':
        return <Receipt size={18} className="text-green-500" />
      case 'bill_comment':
        return <MessageSquare size={18} className="text-yellow-500" />
      case 'bill_attachment':
        return <Paperclip size={18} className="text-purple-500" />
      default:
        return <Receipt size={18} className="text-gray-500" />
    }
  }

  const handleClick = () => {
    if (!notification.read) {
      onMarkAsRead(notification.id)
    }
    if (notification.billId) {
      router.push(`/bills/${notification.billId}`)
    }
  }

  return (
    <div
      className={`p-4 border-b border-gray-200 hover:bg-gray-50 cursor-pointer transition-colors ${
        !notification.read ? 'bg-blue-50' : ''
      }`}
      onClick={handleClick}
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">{getIcon()}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <h4 className={`text-sm font-medium ${!notification.read ? 'text-gray-900' : 'text-gray-700'}`}>
                {notification.title}
              </h4>
              <p className="text-sm text-gray-600 mt-1">{notification.message}</p>
              {notification.billTitle && (
                <p className="text-xs text-gray-500 mt-1">Bill: {notification.billTitle}</p>
              )}
            </div>
            {!notification.read && (
              <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-1"></div>
            )}
          </div>
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-gray-500">
              {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation()
                onDelete(notification.id)
              }}
              className="text-xs text-gray-400 hover:text-red-500 transition-colors"
              title="Delete notification"
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
