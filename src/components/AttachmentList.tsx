'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { format } from 'date-fns'
import { Paperclip, Download, Trash2, Upload } from 'lucide-react'
import toast from 'react-hot-toast'
import FileUpload from './FileUpload'

interface Attachment {
  id: string
  fileName: string
  fileSize: number
  mimeType: string
  billId: string
  uploadedById?: string | null
  createdAt: Date
  uploadedBy?: {
    id: string
    name: string | null
    email: string
  } | null
}

interface AttachmentListProps {
  billId: string
}

export default function AttachmentList({ billId }: AttachmentListProps) {
  const { data: session } = useSession()
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showUpload, setShowUpload] = useState(false)

  useEffect(() => {
    fetchAttachments()
  }, [billId])

  const fetchAttachments = async () => {
    try {
      const response = await fetch(`/api/bills/${billId}/attachments`)
      if (response.ok) {
        const data = await response.json()
        setAttachments(data)
      }
    } catch (error) {
      toast.error('Failed to load attachments')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDownload = async (attachmentId: string, fileName: string) => {
    try {
      const response = await fetch(`/api/bills/${billId}/attachments/${attachmentId}`)
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = fileName
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      } else {
        toast.error('Failed to download attachment')
      }
    } catch (error) {
      toast.error('Failed to download attachment')
    }
  }

  const handleDelete = async (attachmentId: string) => {
    if (!confirm('Are you sure you want to delete this attachment?')) {
      return
    }

    try {
      const response = await fetch(`/api/bills/${billId}/attachments/${attachmentId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        setAttachments(attachments.filter((a) => a.id !== attachmentId))
        toast.success('Attachment deleted')
      } else {
        const data = await response.json()
        toast.error(data.error || 'Failed to delete attachment')
      }
    } catch (error) {
      toast.error('Failed to delete attachment')
    }
  }

  const handleUploadSuccess = (attachment: Attachment) => {
    setAttachments([attachment, ...attachments])
    setShowUpload(false)
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Paperclip className="w-5 h-5 text-gray-600" />
          <h3 className="text-lg font-semibold text-gray-900">
            Attachments ({attachments.length})
          </h3>
        </div>
        <button
          onClick={() => setShowUpload(!showUpload)}
          className="inline-flex items-center px-3 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm"
        >
          <Upload className="w-4 h-4 mr-2" />
          Upload
        </button>
      </div>

      {/* Upload Form */}
      {showUpload && (
        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
          <FileUpload
            billId={billId}
            onSuccess={handleUploadSuccess}
            onCancel={() => setShowUpload(false)}
          />
        </div>
      )}

      {/* Attachments List */}
      <div className="space-y-2">
        {attachments.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No attachments yet</p>
        ) : (
          attachments.map((attachment) => (
            <div
              key={attachment.id}
              className="bg-gray-50 rounded-lg p-4 border border-gray-200 flex items-center justify-between"
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <Paperclip className="w-5 h-5 text-gray-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900 truncate">
                    {attachment.fileName}
                  </div>
                  <div className="text-sm text-gray-500">
                    {formatFileSize(attachment.fileSize)} •{' '}
                    {format(new Date(attachment.createdAt), 'MMM d, yyyy')}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleDownload(attachment.id, attachment.fileName)}
                  className="p-2 text-primary-600 hover:text-primary-800 transition-colors"
                  title="Download"
                >
                  <Download className="w-5 h-5" />
                </button>
                {(session?.user?.id === attachment.uploadedById ||
                  session?.user?.role === 'ADMIN') && (
                  <button
                    onClick={() => handleDelete(attachment.id)}
                    className="p-2 text-red-600 hover:text-red-800 transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
