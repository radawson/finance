'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { BillTitleSuggestion } from '@/types'

interface BillTitleAutocompleteProps {
  value: string
  onChange: (title: string) => void
  onSelectSuggestion: (suggestion: BillTitleSuggestion) => void
  required?: boolean
  disabled?: boolean
}

export default function BillTitleAutocomplete({
  value,
  onChange,
  onSelectSuggestion,
  required = false,
  disabled = false,
}: BillTitleAutocompleteProps) {
  const listId = useId()
  const containerRef = useRef<HTMLDivElement>(null)
  const [suggestions, setSuggestions] = useState<BillTitleSuggestion[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [highlightIndex, setHighlightIndex] = useState(-1)

  const fetchSuggestions = useCallback(async (query: string) => {
    try {
      const params = new URLSearchParams()
      if (query.trim()) params.set('q', query.trim())
      const response = await fetch(`/api/bills/suggestions?${params.toString()}`)
      if (!response.ok) {
        setSuggestions([])
        return
      }
      const data: BillTitleSuggestion[] = await response.json()
      setSuggestions(data)
    } catch {
      setSuggestions([])
    }
  }, [])

  useEffect(() => {
    if (disabled) return
    const handle = window.setTimeout(() => {
      void fetchSuggestions(value)
    }, 200)
    return () => window.clearTimeout(handle)
  }, [value, disabled, fetchSuggestions])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false)
        setHighlightIndex(-1)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const applySuggestion = (suggestion: BillTitleSuggestion) => {
    onSelectSuggestion(suggestion)
    setIsOpen(false)
    setHighlightIndex(-1)
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || suggestions.length === 0) {
      if (event.key === 'ArrowDown' && suggestions.length > 0) {
        setIsOpen(true)
        setHighlightIndex(0)
        event.preventDefault()
      }
      return
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setHighlightIndex((prev) => (prev + 1) % suggestions.length)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setHighlightIndex((prev) => (prev <= 0 ? suggestions.length - 1 : prev - 1))
    } else if (event.key === 'Enter' && highlightIndex >= 0) {
      event.preventDefault()
      applySuggestion(suggestions[highlightIndex])
    } else if (event.key === 'Escape') {
      setIsOpen(false)
      setHighlightIndex(-1)
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        required={required}
        disabled={disabled}
        value={value}
        autoComplete="off"
        role="combobox"
        aria-expanded={isOpen}
        aria-controls={listId}
        aria-autocomplete="list"
        onChange={(e) => {
          onChange(e.target.value)
          setIsOpen(true)
          setHighlightIndex(-1)
        }}
        onFocus={() => setIsOpen(true)}
        onKeyDown={handleKeyDown}
        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
      />
      {isOpen && suggestions.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg"
        >
          {suggestions.map((suggestion, index) => (
            <li key={`${suggestion.title}-${index}`} role="option" aria-selected={index === highlightIndex}>
              <button
                type="button"
                className={`flex w-full items-center justify-between px-4 py-2 text-left text-sm ${
                  index === highlightIndex ? 'bg-primary-50 text-primary-800' : 'text-gray-900 hover:bg-gray-50'
                }`}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => applySuggestion(suggestion)}
              >
                <span>{suggestion.title}</span>
                {suggestion.occurrenceCount > 1 && (
                  <span className="ml-2 text-xs text-gray-500">{suggestion.occurrenceCount}×</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
