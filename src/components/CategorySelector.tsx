'use client'

import { Category } from '@/types'

interface CategorySelectorProps {
  categories: Category[]
  value: string
  onChange: (categoryId: string) => void
  required?: boolean
  includeGlobal?: boolean
}

export default function CategorySelector({
  categories,
  value,
  onChange,
  required = false,
  includeGlobal = true,
}: CategorySelectorProps) {
  const filteredCategories = includeGlobal
    ? categories
    : categories.filter((cat) => !cat.isGlobal)

  return (
    <select
      required={required}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
    >
      <option value="">Select a category</option>
      {filteredCategories.map((category) => (
        <option key={category.id} value={category.id}>
          {category.name}
        </option>
      ))}
    </select>
  )
}
