'use client'

import { useEffect, useMemo, useState } from 'react'
import { Eob, EobAttachment } from '@/types'
import { format } from 'date-fns'
import { Plus, Save, Trash2, Upload, X } from 'lucide-react'
import toast from 'react-hot-toast'
import TagInput from '@/components/TagInput'

type ProcedureRow = {
  key: string
  dateOfService: string
  procedureCode: string
  description: string
  billedAmount: string
  insurancePaid: string
  patientResponsibility: string
}

export interface EobFormData {
  payerName: string
  providerName: string
  claimNumber: string
  memberId: string
  eobDate: string
  serviceStart: string
  serviceEnd: string
  billedAmount: string
  insurancePaid: string
  adjustmentAmount: string
  patientResponsibility: string
  tags: string[]
  isTaxItem: boolean
  notes: string
  procedures: ProcedureRow[]
}

function emptyProcedure(date: string): ProcedureRow {
  return {
    key: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    dateOfService: date,
    procedureCode: '',
    description: '',
    billedAmount: '',
    insurancePaid: '',
    patientResponsibility: '',
  }
}

function toDateInput(value?: Date | string | null) {
  if (!value) return ''
  return format(new Date(value), 'yyyy-MM-dd')
}

function money(n: number | string | null | undefined) {
  if (n == null || n === '') return ''
  const num = Number(n)
  return Number.isFinite(num) ? num.toFixed(2) : ''
}

function buildPayload(form: EobFormData) {
  const procedures = form.procedures
    .filter((p) => p.description.trim() && p.dateOfService)
    .map((p) => ({
      dateOfService: new Date(`${p.dateOfService}T12:00:00`).toISOString(),
      procedureCode: p.procedureCode.trim() || null,
      description: p.description.trim(),
      billedAmount: p.billedAmount || '0',
      insurancePaid: p.insurancePaid || '0',
      patientResponsibility: p.patientResponsibility || '0',
    }))

  return {
    payerName: form.payerName.trim(),
    providerName: form.providerName.trim(),
    claimNumber: form.claimNumber.trim() || null,
    memberId: form.memberId.trim() || null,
    eobDate: new Date(`${form.eobDate}T12:00:00`).toISOString(),
    serviceStart: form.serviceStart ? new Date(`${form.serviceStart}T12:00:00`).toISOString() : null,
    serviceEnd: form.serviceEnd ? new Date(`${form.serviceEnd}T12:00:00`).toISOString() : null,
    billedAmount: form.billedAmount || '0',
    insurancePaid: form.insurancePaid || '0',
    adjustmentAmount: form.adjustmentAmount || '0',
    patientResponsibility: form.patientResponsibility || '0',
    tags: form.tags,
    isTaxItem: form.isTaxItem,
    notes: form.notes.trim() || null,
    procedures,
  }
}

interface EobFormProps {
  eob?: Eob | null
  onSaved: (eob: Eob) => void
  onCancel: () => void
  isSaving?: boolean
}

export default function EobForm({ eob, onSaved, onCancel, isSaving = false }: EobFormProps) {
  const today = format(new Date(), 'yyyy-MM-dd')
  const [form, setForm] = useState<EobFormData>({
    payerName: eob?.payerName || '',
    providerName: eob?.providerName || '',
    claimNumber: eob?.claimNumber || '',
    memberId: eob?.memberId || '',
    eobDate: toDateInput(eob?.eobDate) || today,
    serviceStart: toDateInput(eob?.serviceStart),
    serviceEnd: toDateInput(eob?.serviceEnd),
    billedAmount: money(eob?.billedAmount),
    insurancePaid: money(eob?.insurancePaid),
    adjustmentAmount: money(eob?.adjustmentAmount),
    patientResponsibility: money(eob?.patientResponsibility),
    tags: eob?.tags || [],
    isTaxItem: eob?.isTaxItem !== false,
    notes: eob?.notes || '',
    procedures:
      eob?.procedures && eob.procedures.length > 0
        ? eob.procedures.map((p) => ({
            key: p.id,
            dateOfService: toDateInput(p.dateOfService),
            procedureCode: p.procedureCode || '',
            description: p.description,
            billedAmount: money(p.billedAmount),
            insurancePaid: money(p.insurancePaid),
            patientResponsibility: money(p.patientResponsibility),
          }))
        : [emptyProcedure(today)],
  })
  const [saving, setSaving] = useState(isSaving)
  const [attachments, setAttachments] = useState<EobAttachment[]>(eob?.attachments || [])
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    setSaving(isSaving)
  }, [isSaving])

  const procedureTotals = useMemo(() => {
    return form.procedures.reduce(
      (acc, p) => ({
        billed: acc.billed + (Number(p.billedAmount) || 0),
        insurance: acc.insurance + (Number(p.insurancePaid) || 0),
        patient: acc.patient + (Number(p.patientResponsibility) || 0),
      }),
      { billed: 0, insurance: 0, patient: 0 },
    )
  }, [form.procedures])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.payerName.trim() || !form.providerName.trim() || !form.eobDate) {
      toast.error('Payer, provider, and EOB date are required')
      return
    }
    setSaving(true)
    try {
      const payload = buildPayload(form)
      const url = eob ? `/api/eobs/${eob.id}` : '/api/eobs'
      const res = await fetch(url, {
        method: eob ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error || 'Failed to save EOB')
        return
      }
      const saved: Eob = await res.json()
      toast.success(eob ? 'EOB saved' : 'EOB created')
      onSaved(saved)
    } catch {
      toast.error('Failed to save EOB')
    } finally {
      setSaving(false)
    }
  }

  const copyProcedureTotals = () => {
    setForm((f) => ({
      ...f,
      billedAmount: procedureTotals.billed.toFixed(2),
      insurancePaid: procedureTotals.insurance.toFixed(2),
      patientResponsibility: procedureTotals.patient.toFixed(2),
    }))
  }

  const handleUpload = async (file: File) => {
    if (!eob) return
    setUploading(true)
    try {
      const data = new FormData()
      data.append('file', file)
      const res = await fetch(`/api/eobs/${eob.id}/attachments`, { method: 'POST', body: data })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        toast.error(body.error || 'Failed to upload file')
        return
      }
      const attachment: EobAttachment = await res.json()
      setAttachments((prev) => [attachment, ...prev])
      toast.success('File uploaded')
    } catch {
      toast.error('Failed to upload file')
    } finally {
      setUploading(false)
    }
  }

  const handleDeleteAttachment = async (attachmentId: string) => {
    if (!eob) return
    if (!confirm('Delete this attachment?')) return
    try {
      const res = await fetch(`/api/eobs/${eob.id}/attachments/${attachmentId}`, { method: 'DELETE' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        toast.error(body.error || 'Failed to delete attachment')
        return
      }
      setAttachments((prev) => prev.filter((a) => a.id !== attachmentId))
      toast.success('Attachment deleted')
    } catch {
      toast.error('Failed to delete attachment')
    }
  }

  const inputClass =
    'w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent'

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md p-6 space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Payer *</label>
          <input
            required
            value={form.payerName}
            onChange={(e) => setForm({ ...form, payerName: e.target.value })}
            placeholder="e.g. BCBS"
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Provider *</label>
          <input
            required
            value={form.providerName}
            onChange={(e) => setForm({ ...form, providerName: e.target.value })}
            placeholder="Clinic or hospital"
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Claim number</label>
          <input
            value={form.claimNumber}
            onChange={(e) => setForm({ ...form, claimNumber: e.target.value })}
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Member ID</label>
          <input
            value={form.memberId}
            onChange={(e) => setForm({ ...form, memberId: e.target.value })}
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">EOB date *</label>
          <input
            type="date"
            required
            value={form.eobDate}
            onChange={(e) => setForm({ ...form, eobDate: e.target.value })}
            className={inputClass}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Service start</label>
            <input
              type="date"
              value={form.serviceStart}
              onChange={(e) => setForm({ ...form, serviceStart: e.target.value })}
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Service end</label>
            <input
              type="date"
              value={form.serviceEnd}
              onChange={(e) => setForm({ ...form, serviceEnd: e.target.value })}
              className={inputClass}
            />
          </div>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-gray-900">Procedures</h3>
          <button
            type="button"
            onClick={() =>
              setForm((f) => ({
                ...f,
                procedures: [...f.procedures, emptyProcedure(f.serviceStart || f.eobDate || today)],
              }))
            }
            className="inline-flex items-center text-sm text-primary-700 hover:text-primary-800"
          >
            <Plus className="w-4 h-4 mr-1" />
            Add line
          </button>
        </div>
        <div className="overflow-x-auto border border-gray-200 rounded-lg">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-gray-500">Date</th>
                <th className="px-3 py-2 text-left font-medium text-gray-500">CPT</th>
                <th className="px-3 py-2 text-left font-medium text-gray-500">Description</th>
                <th className="px-3 py-2 text-right font-medium text-gray-500">Billed</th>
                <th className="px-3 py-2 text-right font-medium text-gray-500">Insurance paid</th>
                <th className="px-3 py-2 text-right font-medium text-gray-500">Patient</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {form.procedures.map((row, index) => (
                <tr key={row.key}>
                  <td className="px-3 py-2">
                    <input
                      type="date"
                      value={row.dateOfService}
                      onChange={(e) => {
                        const procedures = [...form.procedures]
                        procedures[index] = { ...row, dateOfService: e.target.value }
                        setForm({ ...form, procedures })
                      }}
                      className={inputClass}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      value={row.procedureCode}
                      onChange={(e) => {
                        const procedures = [...form.procedures]
                        procedures[index] = { ...row, procedureCode: e.target.value }
                        setForm({ ...form, procedures })
                      }}
                      className={inputClass}
                    />
                  </td>
                  <td className="px-3 py-2 min-w-[12rem]">
                    <input
                      value={row.description}
                      onChange={(e) => {
                        const procedures = [...form.procedures]
                        procedures[index] = { ...row, description: e.target.value }
                        setForm({ ...form, procedures })
                      }}
                      className={inputClass}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={row.billedAmount}
                      onChange={(e) => {
                        const procedures = [...form.procedures]
                        procedures[index] = { ...row, billedAmount: e.target.value }
                        setForm({ ...form, procedures })
                      }}
                      className={`${inputClass} text-right`}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={row.insurancePaid}
                      onChange={(e) => {
                        const procedures = [...form.procedures]
                        procedures[index] = { ...row, insurancePaid: e.target.value }
                        setForm({ ...form, procedures })
                      }}
                      className={`${inputClass} text-right`}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={row.patientResponsibility}
                      onChange={(e) => {
                        const procedures = [...form.procedures]
                        procedures[index] = { ...row, patientResponsibility: e.target.value }
                        setForm({ ...form, procedures })
                      }}
                      className={`${inputClass} text-right`}
                    />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          procedures:
                            f.procedures.length === 1
                              ? [emptyProcedure(f.eobDate || today)]
                              : f.procedures.filter((_, i) => i !== index),
                        }))
                      }
                      className="text-red-600 hover:text-red-800"
                      title="Remove line"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-gray-500">
          Line totals: billed ${procedureTotals.billed.toFixed(2)} · insurance $
          {procedureTotals.insurance.toFixed(2)} · patient ${procedureTotals.patient.toFixed(2)}. Header
          totals may differ from the lines.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Billed</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={form.billedAmount}
            onChange={(e) => setForm({ ...form, billedAmount: e.target.value })}
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Insurance paid</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={form.insurancePaid}
            onChange={(e) => setForm({ ...form, insurancePaid: e.target.value })}
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Adjustments</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={form.adjustmentAmount}
            onChange={(e) => setForm({ ...form, adjustmentAmount: e.target.value })}
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Patient responsibility</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={form.patientResponsibility}
            onChange={(e) => setForm({ ...form, patientResponsibility: e.target.value })}
            className={inputClass}
          />
        </div>
      </div>
      <button
        type="button"
        onClick={copyProcedureTotals}
        className="text-sm text-primary-700 hover:text-primary-800"
      >
        Copy line totals into header
      </button>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Tags</label>
        <TagInput tags={form.tags} onChange={(tags) => setForm({ ...form, tags })} />
      </div>

      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={form.isTaxItem}
          onChange={(e) => setForm({ ...form, isTaxItem: e.target.checked })}
          className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
        />
        <span className="text-sm font-medium text-gray-700">Tax item</span>
      </label>
      <p className="-mt-4 text-xs text-gray-500">EOBs are included on the tax report by default.</p>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
        <textarea
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          rows={3}
          className={inputClass}
        />
      </div>

      {eob && (
        <div className="border-t border-gray-200 pt-4 space-y-3">
          <h3 className="text-sm font-semibold text-gray-900">Attachments</h3>
          <label className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm cursor-pointer hover:bg-gray-50">
            <Upload className="w-4 h-4" />
            {uploading ? 'Uploading…' : 'Upload file'}
            <input
              type="file"
              className="hidden"
              disabled={uploading}
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleUpload(file)
                e.target.value = ''
              }}
            />
          </label>
          {attachments.length === 0 ? (
            <p className="text-sm text-gray-500">No attachments yet. Save the EOB first, then upload.</p>
          ) : (
            <ul className="space-y-2">
              {attachments.map((a) => (
                <li key={a.id} className="flex items-center justify-between text-sm">
                  <a
                    href={`/api/eobs/${eob.id}/attachments/${a.id}`}
                    className="text-primary-700 hover:underline"
                  >
                    {a.fileName}
                  </a>
                  <button
                    type="button"
                    onClick={() => handleDeleteAttachment(a.id)}
                    className="text-red-600 hover:text-red-800"
                  >
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="flex gap-4 pt-2">
        <button
          type="submit"
          disabled={saving}
          className="flex-1 inline-flex items-center justify-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
        >
          <Save className="w-5 h-5 mr-2" />
          {saving ? 'Saving…' : eob ? 'Save changes' : 'Create EOB'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="flex-1 inline-flex items-center justify-center px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          <X className="w-5 h-5 mr-2" />
          Cancel
        </button>
      </div>
    </form>
  )
}
