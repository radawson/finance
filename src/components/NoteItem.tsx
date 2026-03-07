'use client'

import { Note } from '@/types'
import { formatDistanceToNow } from 'date-fns'
import { Circle, CheckCircle2, Trash2 } from 'lucide-react'

interface NoteItemProps {
  note: Note
  onToggleCleared: (id: string, isCleared: boolean) => void
  onDelete: (id: string) => void
}

export default function NoteItem({ note, onToggleCleared, onDelete }: NoteItemProps) {
  const todoActive = note.isTodo && !note.isCleared

  return (
    <div
      className={`p-4 border-b border-gray-200 transition-colors ${
        todoActive ? 'bg-blue-50' : 'hover:bg-gray-50'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="shrink-0 mt-0.5">
          {note.isTodo ? (
            <button
              onClick={() => onToggleCleared(note.id, !note.isCleared)}
              className="text-blue-600 hover:text-blue-700 transition-colors"
              title={note.isCleared ? 'Mark as active TODO' : 'Mark TODO as cleared'}
            >
              {note.isCleared ? <CheckCircle2 size={18} /> : <Circle size={18} />}
            </button>
          ) : (
            <Circle size={18} className="text-gray-300" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <p
                className={`text-sm ${
                  note.isCleared ? 'text-gray-500 line-through' : 'text-gray-800'
                }`}
              >
                {note.content}
              </p>
              <div className="mt-2 flex items-center gap-2">
                {note.isTodo && (
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      todoActive ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    TODO
                  </span>
                )}
                <span className="text-xs text-gray-500">
                  {formatDistanceToNow(new Date(note.createdAt), { addSuffix: true })}
                </span>
              </div>
            </div>

            <button
              onClick={() => onDelete(note.id)}
              className="text-gray-400 hover:text-red-500 transition-colors"
              title="Delete note"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
