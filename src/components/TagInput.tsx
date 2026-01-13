'use client'

import { useState, KeyboardEvent } from 'react'
import { X } from 'lucide-react'

interface TagInputProps {
  tags: string[]
  onChange: (tags: string[]) => void
  placeholder?: string
  maxLength?: number
  disabled?: boolean
}

export default function TagInput({
  tags,
  onChange,
  placeholder = 'Type and press Enter to add tags',
  maxLength = 128,
  disabled = false,
}: TagInputProps) {
  const [inputValue, setInputValue] = useState('')

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && inputValue.trim()) {
      e.preventDefault()
      addTag(inputValue.trim())
    } else if (e.key === 'Backspace' && !inputValue && tags.length > 0) {
      // Remove last tag when backspace is pressed on empty input
      removeTag(tags.length - 1)
    }
  }

  const addTag = (tag: string) => {
    if (tag.length > maxLength) {
      return // Tag too long, don't add
    }
    if (tag && !tags.includes(tag)) {
      onChange([...tags, tag])
    }
    setInputValue('')
  }

  const removeTag = (index: number) => {
    onChange(tags.filter((_, i) => i !== index))
  }

  return (
    <div className="w-full">
      <div className="flex flex-wrap gap-2 p-2 border border-gray-300 rounded-lg focus-within:ring-2 focus-within:ring-primary-500 focus-within:border-transparent min-h-[42px]">
        {tags.map((tag, index) => (
          <span
            key={index}
            className="inline-flex items-center gap-1 px-2 py-1 bg-primary-100 text-primary-800 rounded-md text-sm"
          >
            {tag}
            {!disabled && (
              <button
                type="button"
                onClick={() => removeTag(index)}
                className="hover:bg-primary-200 rounded-full p-0.5"
                aria-label={`Remove tag ${tag}`}
              >
                <X size={14} />
              </button>
            )}
          </span>
        ))}
        {!disabled && (
          <input
            type="text"
            value={inputValue}
            onChange={(e) => {
              const value = e.target.value
              if (value.length <= maxLength) {
                setInputValue(value)
              }
            }}
            onKeyDown={handleKeyDown}
            placeholder={tags.length === 0 ? placeholder : ''}
            className="flex-1 min-w-[120px] outline-none bg-transparent"
            maxLength={maxLength}
          />
        )}
      </div>
      {inputValue.length > 0 && inputValue.length >= maxLength - 10 && (
        <p className="text-xs text-gray-500 mt-1">
          {maxLength - inputValue.length} characters remaining
        </p>
      )}
    </div>
  )
}
