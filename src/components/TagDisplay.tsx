'use client'

interface TagDisplayProps {
  tags: string[]
  className?: string
}

export default function TagDisplay({ tags, className = '' }: TagDisplayProps) {
  if (!tags || tags.length === 0) {
    return null
  }

  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {tags.map((tag, index) => (
        <span
          key={index}
          className="inline-flex items-center px-2 py-1 bg-gray-100 text-gray-800 rounded-md text-sm"
        >
          {tag}
        </span>
      ))}
    </div>
  )
}
