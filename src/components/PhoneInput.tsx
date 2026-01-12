'use client'

import { useState, useEffect, useRef } from 'react'
import { formatPhoneForDisplay, normalizePhoneInput, formatPhoneForStorage } from '@/lib/phone-formatting'

interface PhoneInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  required?: boolean
  id?: string
  name?: string
}

export default function PhoneInput({
  value,
  onChange,
  placeholder = '+1 (XXX) XXX-XXXX',
  className = '',
  required = false,
  id,
  name,
}: PhoneInputProps) {
  const [displayValue, setDisplayValue] = useState('')
  const [cursorPosition, setCursorPosition] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  // Update display value when value prop changes (e.g., from parent)
  useEffect(() => {
    if (value) {
      const formatted = formatPhoneForDisplay(value)
      setDisplayValue(formatted)
    } else {
      setDisplayValue('')
    }
  }, [value])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value
    const cursorPos = e.target.selectionStart || 0

    // Get digits before cursor in the input
    const inputBeforeCursor = input.substring(0, cursorPos)
    const digitsBeforeCursor = inputBeforeCursor.replace(/\D/g, '').length

    // Normalize and format
    const normalized = normalizePhoneInput(input)
    const formatted = formatPhoneForDisplay(normalized)
    setDisplayValue(formatted)

    // Calculate new cursor position
    // Find position in formatted string that corresponds to the same number of digits
    let newCursorPos = formatted.length
    let digitsCounted = 0

    for (let i = 0; i < formatted.length; i++) {
      const char = formatted[i]
      // Count digits and + sign
      if (/\d/.test(char) || char === '+') {
        if (digitsCounted >= digitsBeforeCursor) {
          newCursorPos = i
          break
        }
        digitsCounted++
      }
    }

    // If we're at the end and user is typing, place cursor at end
    if (input.length > displayValue.length && digitsBeforeCursor >= digitsCounted) {
      newCursorPos = formatted.length
    }

    setCursorPosition(newCursorPos)

    // Emit normalized value to parent
    const storageValue = formatPhoneForStorage(normalized)
    onChange(storageValue)
  }

  // Restore cursor position after state update
  useEffect(() => {
    if (inputRef.current && cursorPosition !== null) {
      inputRef.current.setSelectionRange(cursorPosition, cursorPosition)
    }
  }, [displayValue, cursorPosition])

  const handleBlur = () => {
    // On blur, ensure we have a properly formatted value
    if (value) {
      const normalized = normalizePhoneInput(value)
      const formatted = formatPhoneForDisplay(normalized)
      setDisplayValue(formatted)
      const storageValue = formatPhoneForStorage(normalized)
      if (storageValue !== value) {
        onChange(storageValue)
      }
    }
  }

  return (
    <input
      ref={inputRef}
      type="tel"
      id={id}
      name={name}
      value={displayValue}
      onChange={handleChange}
      onBlur={handleBlur}
      placeholder={placeholder}
      required={required}
      className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent ${className}`}
    />
  )
}
