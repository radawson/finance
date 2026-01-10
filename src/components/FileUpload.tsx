'use client'

import { useState } from 'react'
import { Upload, X } from 'lucide-react'
import toast from 'react-hot-toast'

interface Attachment {
  id: string
  fileName: string
  fileSize: number
  mimeType: string
  billId: string
  uploadedById?: string | null
  createdAt: Date
}

interface FileUploadProps {
  billId: string
  onSuccess: (attachment: Attachment) => void
  onCancel: () => void
}

export default function FileUpload({ billId, onSuccess, onCancel }: FileUploadProps) {
  const [file, setFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      // Check file size (10MB limit)
      const maxSize = 10 * 1024 * 1024 // 10MB
      if (selectedFile.size > maxSize) {
        toast.error('File size exceeds 10MB limit')
        return
      }
      setFile(selectedFile)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) {
      toast.error('Please select a file')
      return
    }

    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch(`/api/bills/${billId}/attachments`, {
        method: 'POST',
        body: formData,
      })

      if (response.ok) {
        const attachment = await response.json()
        onSuccess(attachment)
        setFile(null)
        toast.success('File uploaded successfully')
      } else {
        const data = await response.json()
        toast.error(data.error || 'Failed to upload file')
      }
    } catch (error) {
      toast.error('Failed to upload file')
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Select File
        </label>
        <div className="flex items-center gap-4">
          <label className="flex-1 cursor-pointer">
            <input
              type="file"
              onChange={handleFileChange}
              className="hidden"
              accept="image/*,application/pdf,.doc,.docx"
            />
            <div className="flex items-center justify-center px-4 py-2 border-2 border-dashed border-gray-300 rounded-lg hover:border-primary-500 transition-colors">
              <Upload className="w-5 h-5 mr-2 text-gray-400" />
              <span className="text-sm text-gray-600">
                {file ? file.name : 'Click to select file'}
              </span>
            </div>
          </label>
          {file && (
            <button
              type="button"
              onClick={() => setFile(null)}
              className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
        <p className="mt-1 text-sm text-gray-500">
          Maximum file size: 10MB. Supported: Images, PDF, Word documents
        </p>
      </div>

      <div className="flex gap-4">
        <button
          type="submit"
          disabled={!file || isUploading}
          className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isUploading ? 'Uploading...' : 'Upload'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
