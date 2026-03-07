'use client'

import { FormEvent, useMemo, useState } from 'react'
import { Note } from '@/types'
import NoteItem from './NoteItem'
import { NotebookPen } from 'lucide-react'

interface NotesPanelProps {
  notes: Note[]
  isLoading: boolean
  onCreateNote: (content: string, isTodo: boolean) => Promise<void>
  onToggleCleared: (id: string, isCleared: boolean) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

export default function NotesPanel({
  notes,
  isLoading,
  onCreateNote,
  onToggleCleared,
  onDelete,
}: NotesPanelProps) {
  const [content, setContent] = useState('')
  const [isTodo, setIsTodo] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const activeTodoCount = useMemo(
    () => notes.filter((note) => note.isTodo && !note.isCleared).length,
    [notes]
  )

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmed = content.trim()
    if (!trimmed || isSubmitting) return

    setIsSubmitting(true)
    try {
      await onCreateNote(trimmed, isTodo)
      setContent('')
      setIsTodo(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-gray-200 bg-gray-50">
        <h3 className="text-lg font-semibold text-gray-900">Notes</h3>
        <p className="text-sm text-gray-600 mt-1">
          {activeTodoCount} active TODO{activeTodoCount !== 1 ? 's' : ''}
        </p>

        <form onSubmit={handleSubmit} className="mt-3 space-y-2">
          <textarea
            value={content}
            onChange={(event) => setContent(event.target.value)}
            rows={2}
            maxLength={500}
            placeholder="Write a quick note..."
            className="w-full text-sm border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
          />
          <div className="flex items-center justify-between">
            <label className="inline-flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={isTodo}
                onChange={(event) => setIsTodo(event.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              Mark as TODO
            </label>
            <button
              type="submit"
              disabled={isSubmitting || content.trim().length === 0}
              className="px-3 py-1.5 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-md transition-colors"
            >
              Add note
            </button>
          </div>
        </form>
      </div>

      <div className="overflow-y-auto flex-1">
        {isLoading ? (
          <div className="p-6 text-center text-gray-500 text-sm">Loading notes...</div>
        ) : notes.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <NotebookPen size={48} className="mx-auto mb-4 text-gray-300" />
            <p>No notes yet</p>
          </div>
        ) : (
          notes.map((note) => (
            <NoteItem
              key={note.id}
              note={note}
              onToggleCleared={onToggleCleared}
              onDelete={onDelete}
            />
          ))
        )}
      </div>
    </div>
  )
}
