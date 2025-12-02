// Alternative email service using Resend
// Install: npm install resend

import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function sendGroupInviteEmail({
  to,
  groupName,
  senderName,
  customNote,
  inviteId,
  appUrl
}: {
  to: string
  groupName: string
  senderName: string
  customNote?: string
  inviteId: string
  appUrl: string
}) {
  const signupLink = `${appUrl}/signup?invite=${inviteId}`
  const note = customNote ? `\n\nNote from ${senderName}: ${customNote}` : ''
  
  const { data, error } = await resend.emails.send({
    from: 'Care-N-Care <noreply@care-n-care.com>',
    to: [to],
    subject: `Group Invitation: ${groupName}`,
    html: `
      <h2>You're Invited to Join a Care Group!</h2>
      <p>Hello!</p>
      <p><strong>${senderName}</strong> has invited you to join the group <strong>"${groupName}"</strong> on Care-N-Care.</p>
      <p>Care-N-Care is a platform where parents can coordinate childcare and support each other in their communities.</p>
      ${note}
      <p>To accept this invitation and create your account, click the button below:</p>
      <a href="${signupLink}" style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px;">Join ${groupName}</a>
      <p>Or copy and paste this link into your browser:</p>
      <p><a href="${signupLink}">${signupLink}</a></p>
    `,
  })

  if (error) {
    console.error('Resend email error:', error)
    return { success: false, error: error.message }
  }

  return { success: true, data }
}




