'use client'

import { useEffect, useState, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { Bell } from 'lucide-react'
import { Note, Notification, NotificationBadgeType } from '@/types'
import NotificationItem from './NotificationItem'
import NotesPanel from './NotesPanel'
import { useSocket } from './SocketProvider'
import { SocketEvents } from '@/lib/socketio-server'
import toast from 'react-hot-toast'

type ActiveTab = 'notifications' | 'notes'

export default function NotificationCenter() {
  const { data: session } = useSession()
  const { socket, isConnected } = useSocket()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [notes, setNotes] = useState<Note[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isLoadingNotes, setIsLoadingNotes] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<ActiveTab>('notifications')
  const dropdownRef = useRef<HTMLDivElement>(null)

  const badgeStyles: Record<NotificationBadgeType, string> = {
    notification: 'bg-red-500',
    todo: 'bg-blue-500',
  }
  const todoAlertCount = notes.filter((note) => note.isTodo && !note.isCleared).length

  // Fetch notifications
  const fetchNotifications = async () => {
    try {
      const response = await fetch('/api/notifications')
      if (response.ok) {
        const data = await response.json()
        setNotifications(data)
        setUnreadCount(data.filter((n: Notification) => !n.read).length)
      }
    } catch (error) {
      console.error('Failed to fetch notifications:', error)
    }
  }

  const fetchNotes = async () => {
    setIsLoadingNotes(true)
    try {
      const response = await fetch('/api/notes')
      if (response.ok) {
        const data = await response.json()
        setNotes(data)
      }
    } catch (error) {
      console.error('Failed to fetch notes:', error)
    } finally {
      setIsLoadingNotes(false)
    }
  }

  // Initial fetch
  useEffect(() => {
    if (session) {
      fetchNotifications()
      fetchNotes()
    }
  }, [session])

  // Listen for new notifications via WebSocket
  useEffect(() => {
    if (!socket || !isConnected || !session) return

    const handleNewNotification = (notification: Notification) => {
      setNotifications((prev) => [notification, ...prev])
      setUnreadCount((prev) => prev + 1)
    }

    socket.on(SocketEvents.NOTIFICATION_NEW, handleNewNotification)

    return () => {
      socket.off(SocketEvents.NOTIFICATION_NEW, handleNewNotification)
    }
  }, [socket, isConnected, session])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const handleMarkAsRead = async (id: string) => {
    try {
      const response = await fetch(`/api/notifications/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ read: true }),
      })

      if (response.ok) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, read: true } : n))
        )
        setUnreadCount((prev) => Math.max(0, prev - 1))
      }
    } catch (error) {
      console.error('Failed to mark notification as read:', error)
      toast.error('Failed to update notification')
    }
  }

  const handleDeleteNotification = async (id: string) => {
    try {
      const response = await fetch(`/api/notifications/${id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        const deletedNotification = notifications.find((n) => n.id === id)
        setNotifications((prev) => prev.filter((n) => n.id !== id))
        if (deletedNotification && !deletedNotification.read) {
          setUnreadCount((prev) => Math.max(0, prev - 1))
        }
      }
    } catch (error) {
      console.error('Failed to delete notification:', error)
      toast.error('Failed to delete notification')
    }
  }

  const handleCreateNote = async (content: string, isTodo: boolean) => {
    try {
      const response = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, isTodo }),
      })

      if (!response.ok) {
        throw new Error('Failed to create note')
      }

      await fetchNotes()
    } catch (error) {
      console.error('Failed to create note:', error)
      toast.error('Failed to create note')
    }
  }

  const handleToggleNoteCleared = async (id: string, isCleared: boolean) => {
    try {
      const response = await fetch(`/api/notes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isCleared }),
      })

      if (!response.ok) {
        throw new Error('Failed to update note')
      }

      setNotes((prev) =>
        prev.map((note) =>
          note.id === id
            ? {
                ...note,
                isCleared,
                clearedAt: isCleared ? new Date() : null,
              }
            : note
        )
      )
    } catch (error) {
      console.error('Failed to update note:', error)
      toast.error('Failed to update note')
    }
  }

  const handleDeleteNote = async (id: string) => {
    try {
      const response = await fetch(`/api/notes/${id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to delete note')
      }

      setNotes((prev) => prev.filter((note) => note.id !== id))
    } catch (error) {
      console.error('Failed to delete note:', error)
      toast.error('Failed to delete note')
    }
  }

  if (!session) return null

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
        title="Notifications"
      >
        <Bell size={20} />
        <div className="absolute -top-1 -right-1 flex flex-col gap-0.5">
          {unreadCount > 0 && (
            <span
              className={`flex items-center justify-center min-w-5 h-5 px-1 text-xs font-bold text-white rounded-full ${badgeStyles.notification}`}
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
          {todoAlertCount > 0 && (
            <span
              className={`flex items-center justify-center min-w-5 h-5 px-1 text-xs font-bold text-white rounded-full ${badgeStyles.todo}`}
            >
              {todoAlertCount > 9 ? '9+' : todoAlertCount}
            </span>
          )}
        </div>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-96 bg-white rounded-lg shadow-lg border border-gray-200 z-50 max-h-96 overflow-hidden flex flex-col">
          <div className="p-4 border-b border-gray-200 bg-gray-50">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveTab('notifications')}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  activeTab === 'notifications'
                    ? 'bg-primary-100 text-primary-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                Notifications
              </button>
              <button
                onClick={() => setActiveTab('notes')}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  activeTab === 'notes'
                    ? 'bg-primary-100 text-primary-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                Notes
              </button>
            </div>
            {activeTab === 'notifications' && unreadCount > 0 && (
              <p className="text-sm text-gray-600 mt-2">
                {unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}
              </p>
            )}
            {activeTab === 'notes' && (
              <p className="text-sm text-gray-600 mt-2">
                {todoAlertCount} active TODO{todoAlertCount !== 1 ? 's' : ''}
              </p>
            )}
          </div>
          {activeTab === 'notifications' ? (
            <div className="overflow-y-auto flex-1">
              {notifications.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <Bell size={48} className="mx-auto mb-4 text-gray-300" />
                  <p>No notifications</p>
                </div>
              ) : (
                notifications.map((notification) => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                    onMarkAsRead={handleMarkAsRead}
                    onDelete={handleDeleteNotification}
                  />
                ))
              )}
            </div>
          ) : (
            <NotesPanel
              notes={notes}
              isLoading={isLoadingNotes}
              onCreateNote={handleCreateNote}
              onToggleCleared={handleToggleNoteCleared}
              onDelete={handleDeleteNote}
            />
          )}
        </div>
      )}
    </div>
  )
}
