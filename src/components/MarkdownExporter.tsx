'use client'

import { HistoricBillsData, BudgetPredictionData } from '@/types'
import { Download, Printer } from 'lucide-react'
import { format } from 'date-fns'

interface MarkdownExporterProps {
  type: 'history' | 'budget'
  data: HistoricBillsData | BudgetPredictionData
  startDate?: string
  endDate?: string
}

export function exportToMarkdown(
  type: 'history' | 'budget',
  data: HistoricBillsData | BudgetPredictionData,
  startDate?: string,
  endDate?: string
): string {
  const lines: string[] = []
  const now = new Date()

  // Header
  lines.push(`# ${type === 'history' ? 'Historic Bills Analysis' : 'Budget Predictions'}`)
  lines.push('')
  lines.push(`**Generated:** ${format(now, 'yyyy-MM-dd HH:mm:ss')}`)
  if (startDate && endDate) {
    lines.push(`**Date Range:** ${format(new Date(startDate), 'yyyy-MM-dd')} to ${format(new Date(endDate), 'yyyy-MM-dd')}`)
  }
  lines.push(`**Period:** ${data.period}`)
  lines.push('')
  lines.push('---')
  lines.push('')

  if (type === 'history') {
    const historyData = data as HistoricBillsData
    lines.push('## Summary')
    lines.push('')
    const totalAmount = historyData.data.reduce((sum, period) => sum + period.totalAmount, 0)
    const totalBills = historyData.data.reduce((sum, period) => sum + period.billCount, 0)
    lines.push(`- **Total Periods:** ${historyData.data.length}`)
    lines.push(`- **Total Bills:** ${totalBills}`)
    lines.push(`- **Total Amount:** $${totalAmount.toFixed(2)}`)
    lines.push('')
    lines.push('## Period Breakdown')
    lines.push('')
    lines.push('| Period | Total Amount | Bill Count |')
    lines.push('|--------|--------------|------------|')
    
    historyData.data.forEach((period) => {
      lines.push(`| ${period.periodLabel} | $${period.totalAmount.toFixed(2)} | ${period.billCount} |`)
    })
    
    lines.push('')
    lines.push('## Detailed Bills')
    lines.push('')
    
    historyData.data.forEach((period) => {
      lines.push(`### ${period.periodLabel}`)
      lines.push('')
      lines.push(`**Total:** $${period.totalAmount.toFixed(2)} | **Count:** ${period.billCount}`)
      lines.push('')
      lines.push('| Title | Amount | Due Date | Paid Date | Category | Vendor |')
      lines.push('|-------|--------|----------|-----------|----------|--------|')
      
      period.bills.forEach((bill) => {
        const paidDate = bill.paidDate ? format(new Date(bill.paidDate), 'yyyy-MM-dd') : 'N/A'
        const dueDate = format(new Date(bill.dueDate), 'yyyy-MM-dd')
        const category = bill.category?.name || 'N/A'
        const vendor = bill.vendor?.name || 'N/A'
        lines.push(`| ${bill.title} | $${Number(bill.amount).toFixed(2)} | ${dueDate} | ${paidDate} | ${category} | ${vendor} |`)
      })
      
      lines.push('')
    })
  } else {
    const budgetData = data as BudgetPredictionData
    lines.push('## Summary')
    lines.push('')
    const totalPredicted = budgetData.predictions.reduce((sum, period) => sum + period.predictedAmount, 0)
    const totalBills = budgetData.predictions.reduce((sum, period) => sum + period.billCount, 0)
    lines.push(`- **Total Periods:** ${budgetData.predictions.length}`)
    lines.push(`- **Total Predicted Bills:** ${totalBills}`)
    lines.push(`- **Total Predicted Amount:** $${totalPredicted.toFixed(2)}`)
    lines.push('')
    
    if (budgetData.historicData && budgetData.historicData.length > 0) {
      lines.push('## Historic Comparison')
      lines.push('')
      const totalHistoric = budgetData.historicData.reduce((sum, period) => sum + period.totalAmount, 0)
      lines.push(`- **Historic Total:** $${totalHistoric.toFixed(2)}`)
      lines.push('')
    }
    
    lines.push('## Predicted Periods')
    lines.push('')
    lines.push('| Period | Predicted Amount | Bill Count |')
    lines.push('|--------|------------------|------------|')
    
    budgetData.predictions.forEach((period) => {
      lines.push(`| ${period.periodLabel} | $${period.predictedAmount.toFixed(2)} | ${period.billCount} |`)
    })
    
    lines.push('')
    lines.push('## Detailed Predictions')
    lines.push('')
    
    budgetData.predictions.forEach((period) => {
      lines.push(`### ${period.periodLabel}`)
      lines.push('')
      lines.push(`**Predicted Total:** $${period.predictedAmount.toFixed(2)} | **Count:** ${period.billCount}`)
      lines.push('')
      lines.push('| Title | Amount | Due Date | Method | Confidence | Source |')
      lines.push('|-------|--------|----------|--------|------------|--------|')
      
      period.bills.forEach((bill) => {
        const dueDate = format(new Date(bill.dueDate), 'yyyy-MM-dd')
        let source = 'Recurrence Pattern'
        if (bill.source === 'detected') {
          source = 'Detected Pattern'
        } else if (bill.source === 'historical-analysis') {
          source = 'Historical Analysis'
        }
        
        const method = bill.method || 'Base'
        const confidence = bill.confidence !== undefined ? `${Math.round(bill.confidence * 100)}%` : 'N/A'
        lines.push(`| ${bill.title} | $${bill.amount.toFixed(2)} | ${dueDate} | ${method} | ${confidence} | ${source} |`)
      })
      
      lines.push('')
    })
    
    // Show information about prediction methods used
    const hasDetectedPatterns = budgetData.predictions.some((p) =>
      p.bills.some((b) => b.source === 'detected')
    )
    const hasEnhancedPredictions = budgetData.predictions.some((p) =>
      p.bills.some((b) => b.method && b.method !== 'synthetic')
    )
    
    if (hasDetectedPatterns || hasEnhancedPredictions) {
      lines.push('')
      lines.push('## Prediction Methods')
      lines.push('')
      lines.push('The system uses intelligent forecasting algorithms:')
      lines.push('- **Trend**: Linear regression for bills with clear increasing/decreasing patterns')
      lines.push('- **Weighted Avg**: Weighted moving average when trend is unclear')
      lines.push('- **Seasonal**: Average of same month across multiple years')
      lines.push('- **Synthetic**: Virtual bills generated for recurring bills with < 3 data points')
      lines.push('- **Average**: Simple average for bills with limited data')
      lines.push('')
      if (hasDetectedPatterns) {
        lines.push('> **Note:** Some predictions are based on automatically detected patterns from historical bills.')
        lines.push('')
      }
    }
  }

  // Footer
  lines.push('---')
  lines.push('')
  lines.push(`*Report generated by Kontado on ${format(now, 'yyyy-MM-dd HH:mm:ss')}*`)

  return lines.join('\n')
}

export default function MarkdownExporter({
  type,
  data,
  startDate,
  endDate,
}: MarkdownExporterProps) {
  const handleDownload = () => {
    const markdown = exportToMarkdown(type, data, startDate, endDate)
    const blob = new Blob([markdown], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${type === 'history' ? 'historic-bills' : 'budget-predictions'}-${format(new Date(), 'yyyy-MM-dd')}.md`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handlePrint = () => {
    const markdown = exportToMarkdown(type, data, startDate, endDate)
    const printWindow = window.open('', '_blank')
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>${type === 'history' ? 'Historic Bills Analysis' : 'Budget Predictions'}</title>
            <style>
              body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                max-width: 800px;
                margin: 40px auto;
                padding: 20px;
                line-height: 1.6;
                color: #333;
              }
              pre {
                white-space: pre-wrap;
                font-family: inherit;
              }
              @media print {
                body { margin: 0; padding: 20px; }
              }
            </style>
          </head>
          <body>
            <pre>${markdown.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
          </body>
        </html>
      `)
      printWindow.document.close()
      printWindow.print()
    }
  }

  return (
    <div className="flex gap-2">
      <button
        onClick={handleDownload}
        className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
      >
        <Download size={18} />
        Download Markdown
      </button>
      <button
        onClick={handlePrint}
        className="inline-flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
      >
        <Printer size={18} />
        Print
      </button>
    </div>
  )
}
