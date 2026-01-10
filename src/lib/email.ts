import nodemailer from 'nodemailer'
import { Bill, User, Comment } from '@/types'

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_PORT === '465',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
})

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

export async function sendBillCreatedEmail(bill: Bill, user: User, magicLink?: string) {
  // Determine the view link based on user type
  const viewLink = magicLink || `${APP_URL}/bills/${bill.id}`
  const isGuest = user.role === 'GUEST'

  const mailOptions = {
    from: process.env.SMTP_FROM,
    to: user.email,
    subject: `Bill Created: ${bill.title}`,
    html: `
      <h2>Your bill has been created</h2>
      <p>Hi ${user.name},</p>
      <p>Your bill has been successfully created and will be tracked for payment.</p>
      <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <h3 style="margin-top: 0;">Bill Details</h3>
        <p><strong>Access Code:</strong> <code style="background-color: #e5e7eb; padding: 2px 6px; border-radius: 3px; font-family: monospace;">${bill.id}</code></p>
        <p><strong>Title:</strong> ${bill.title}</p>
        <p><strong>Amount:</strong> $${bill.amount.toFixed(2)}</p>
        <p><strong>Due Date:</strong> ${bill.dueDate.toLocaleDateString()}</p>
        <p><strong>Status:</strong> ${bill.status}</p>
        <p><strong>Category:</strong> ${bill.category?.name || 'Uncategorized'}</p>
        ${bill.vendor ? `<p><strong>Vendor:</strong> ${bill.vendor.name}</p>` : ''}
      </div>
      <p><a href="${viewLink}" style="background-color: #3b82f6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">View Bill</a></p>
      ${isGuest ? `
      <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0;">
        <p style="margin: 0;"><strong>Important:</strong> Save this link or your Access Code to check your bill status anytime. This secure link is unique to you and expires in 3 days.</p>
      </div>
      ` : ''}
      <p>You will receive email updates as your bill status changes.</p>
    `,
  }

  try {
    await transporter.sendMail(mailOptions)
  } catch (error) {
    console.error('Error sending bill created email:', error)
  }
}

export async function sendNewBillNotificationToAdmins(bill: Bill, creator: User, admins: User[]) {
  for (const admin of admins) {
    const mailOptions = {
      from: process.env.SMTP_FROM,
      to: admin.email,
      subject: `New Bill Created: ${bill.title}`,
      html: `
        <h2>New bill created</h2>
        <p>Hi ${admin.name},</p>
        <p>A new bill has been created and requires attention.</p>
        <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <h3 style="margin-top: 0;">Bill Details</h3>
          <p><strong>Bill ID:</strong> ${bill.id}</p>
          <p><strong>Title:</strong> ${bill.title}</p>
          <p><strong>Amount:</strong> $${bill.amount.toFixed(2)}</p>
          <p><strong>Due Date:</strong> ${bill.dueDate.toLocaleDateString()}</p>
          <p><strong>Created By:</strong> ${creator.name} (${creator.email})</p>
          <p><strong>Category:</strong> ${bill.category?.name || 'Uncategorized'}</p>
          ${bill.vendor ? `<p><strong>Vendor:</strong> ${bill.vendor.name}</p>` : ''}
          ${bill.description ? `<p><strong>Description:</strong></p><p>${bill.description}</p>` : ''}
        </div>
        <p><a href="${APP_URL}/admin/bills/${bill.id}" style="background-color: #3b82f6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">View Bill</a></p>
      `,
    }

    try {
      await transporter.sendMail(mailOptions)
    } catch (error) {
      console.error(`Error sending email to admin ${admin.email}:`, error)
    }
  }
}

// Removed sendTicketAssignedEmail - bills don't get assigned like tickets

export async function sendBillStatusUpdateEmail(bill: Bill, user: User, oldStatus: string, newStatus: string) {
  const mailOptions = {
    from: process.env.SMTP_FROM,
    to: user.email,
    subject: `Bill Status Updated: ${bill.title}`,
    html: `
      <h2>Your bill status has been updated</h2>
      <p>Hi ${user.name},</p>
      <p>The status of your bill has been updated.</p>
      <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <h3 style="margin-top: 0;">Bill Details</h3>
        <p><strong>Bill ID:</strong> ${bill.id}</p>
        <p><strong>Title:</strong> ${bill.title}</p>
        <p><strong>Amount:</strong> $${bill.amount.toFixed(2)}</p>
        <p><strong>Status Changed:</strong> ${oldStatus} → ${newStatus}</p>
        <p><strong>Due Date:</strong> ${bill.dueDate.toLocaleDateString()}</p>
        ${bill.vendor ? `<p><strong>Vendor:</strong> ${bill.vendor.name}</p>` : ''}
      </div>
      <p><a href="${APP_URL}/bills/${bill.id}" style="background-color: #3b82f6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">View Bill</a></p>
    `,
  }

  try {
    await transporter.sendMail(mailOptions)
  } catch (error) {
    console.error('Error sending status update email:', error)
  }
}

export async function sendNewCommentEmail(bill: Bill, comment: Comment, recipient: User, commenter: User) {
  // Don't send email if recipient is the commenter
  if (recipient.id === commenter.id) return

  const mailOptions = {
    from: process.env.SMTP_FROM,
    to: recipient.email,
    subject: `New Comment on Bill: ${bill.title}`,
    html: `
      <h2>New comment on your bill</h2>
      <p>Hi ${recipient.name},</p>
      <p>${commenter.name} has added a comment to bill: <strong>${bill.title}</strong></p>
      <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <p><strong>${commenter.name}</strong> commented:</p>
        <p>${comment.content}</p>
      </div>
      <p><a href="${APP_URL}/bills/${bill.id}" style="background-color: #3b82f6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">View Bill</a></p>
    `,
  }

  try {
    await transporter.sendMail(mailOptions)
  } catch (error) {
    console.error('Error sending comment email:', error)
  }
}

