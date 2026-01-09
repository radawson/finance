import nodemailer from 'nodemailer'
import { Ticket, User, Comment } from '@/types'

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

export async function sendTicketCreatedEmail(ticket: Ticket, user: User, magicLink?: string) {
  // Determine the view link based on user type
  const viewLink = magicLink || `${APP_URL}/tickets/${ticket.id}`
  const isGuest = user.role === 'GUEST'
  
  const mailOptions = {
    from: process.env.SMTP_FROM,
    to: user.email,
    subject: `Ticket Created: ${ticket.title}`,
    html: `
      <h2>Your support ticket has been created</h2>
      <p>Hi ${user.name},</p>
      <p>Your support ticket has been successfully created and our team will review it shortly.</p>
      <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <h3 style="margin-top: 0;">Ticket Details</h3>
        <p><strong>Access Code:</strong> <code style="background-color: #e5e7eb; padding: 2px 6px; border-radius: 3px; font-family: monospace;">${ticket.id}</code></p>
        <p><strong>Title:</strong> ${ticket.title}</p>
        <p><strong>Priority:</strong> ${ticket.priority}</p>
        <p><strong>Status:</strong> ${ticket.status}</p>
        <p><strong>Category:</strong> ${ticket.category}</p>
      </div>
      <p><a href="${viewLink}" style="background-color: #3b82f6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">View Ticket</a></p>
      ${isGuest ? `
      <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0;">
        <p style="margin: 0;"><strong>Important:</strong> Save this link or your Access Code to check your ticket status anytime. This secure link is unique to you and expires in 3 days.</p>
      </div>
      ` : ''}
      <p>You will receive email updates as your ticket progresses.</p>
    `,
  }

  try {
    await transporter.sendMail(mailOptions)
  } catch (error) {
    console.error('Error sending ticket created email:', error)
  }
}

export async function sendNewTicketNotificationToAdmins(ticket: Ticket, creator: User, admins: User[]) {
  for (const admin of admins) {
    const mailOptions = {
      from: process.env.SMTP_FROM,
      to: admin.email,
      subject: `New Support Ticket: ${ticket.title}`,
      html: `
        <h2>New support ticket created</h2>
        <p>Hi ${admin.name},</p>
        <p>A new support ticket has been created and requires attention.</p>
        <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <h3 style="margin-top: 0;">Ticket Details</h3>
          <p><strong>Ticket ID:</strong> ${ticket.id}</p>
          <p><strong>Title:</strong> ${ticket.title}</p>
          <p><strong>Created By:</strong> ${creator.name} (${creator.email})</p>
          <p><strong>Priority:</strong> ${ticket.priority}</p>
          <p><strong>Category:</strong> ${ticket.category}</p>
          <p><strong>Description:</strong></p>
          <p>${ticket.description}</p>
        </div>
        <p><a href="${APP_URL}/admin/tickets/${ticket.id}" style="background-color: #3b82f6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">View & Assign Ticket</a></p>
      `,
    }

    try {
      await transporter.sendMail(mailOptions)
    } catch (error) {
      console.error(`Error sending email to admin ${admin.email}:`, error)
    }
  }
}

export async function sendTicketAssignedEmail(ticket: Ticket, assignedTo: User) {
  const mailOptions = {
    from: process.env.SMTP_FROM,
    to: assignedTo.email,
    subject: `Ticket Assigned to You: ${ticket.title}`,
    html: `
      <h2>Ticket assigned to you</h2>
      <p>Hi ${assignedTo.name},</p>
      <p>A support ticket has been assigned to you.</p>
      <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <h3 style="margin-top: 0;">Ticket Details</h3>
        <p><strong>Ticket ID:</strong> ${ticket.id}</p>
        <p><strong>Title:</strong> ${ticket.title}</p>
        <p><strong>Priority:</strong> ${ticket.priority}</p>
        <p><strong>Category:</strong> ${ticket.category}</p>
      </div>
      <p><a href="${APP_URL}/admin/tickets/${ticket.id}" style="background-color: #3b82f6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">View Ticket</a></p>
    `,
  }

  try {
    await transporter.sendMail(mailOptions)
  } catch (error) {
    console.error('Error sending ticket assigned email:', error)
  }
}

export async function sendTicketStatusUpdateEmail(ticket: Ticket, user: User, oldStatus: string, newStatus: string) {
  const mailOptions = {
    from: process.env.SMTP_FROM,
    to: user.email,
    subject: `Ticket Status Updated: ${ticket.title}`,
    html: `
      <h2>Your ticket status has been updated</h2>
      <p>Hi ${user.name},</p>
      <p>The status of your support ticket has been updated.</p>
      <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <h3 style="margin-top: 0;">Ticket Details</h3>
        <p><strong>Ticket ID:</strong> ${ticket.id}</p>
        <p><strong>Title:</strong> ${ticket.title}</p>
        <p><strong>Status Changed:</strong> ${oldStatus} → ${newStatus}</p>
        ${ticket.assignedTo ? `<p><strong>Assigned To:</strong> ${ticket.assignedTo.name}</p>` : ''}
      </div>
      <p><a href="${APP_URL}/tickets/${ticket.id}" style="background-color: #3b82f6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">View Ticket</a></p>
    `,
  }

  try {
    await transporter.sendMail(mailOptions)
  } catch (error) {
    console.error('Error sending status update email:', error)
  }
}

export async function sendNewCommentEmail(ticket: Ticket, comment: Comment, recipient: User, commenter: User) {
  // Don't send email if recipient is the commenter
  if (recipient.id === commenter.id) return

  // Don't send internal comments to non-admin users
  if (comment.isInternal && recipient.role !== 'ADMIN') return

  const mailOptions = {
    from: process.env.SMTP_FROM,
    to: recipient.email,
    subject: `New Comment on Ticket: ${ticket.title}`,
    html: `
      <h2>New comment on your ticket</h2>
      <p>Hi ${recipient.name},</p>
      <p>${commenter.name} has added a comment to ticket: <strong>${ticket.title}</strong></p>
      <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <p><strong>${commenter.name}</strong> commented:</p>
        <p>${comment.content}</p>
      </div>
      <p><a href="${APP_URL}/tickets/${ticket.id}" style="background-color: #3b82f6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">View Ticket</a></p>
    `,
  }

  try {
    await transporter.sendMail(mailOptions)
  } catch (error) {
    console.error('Error sending comment email:', error)
  }
}

