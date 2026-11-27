import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const senderEmail = process.env.SENDER_EMAIL || process.env.SMTP_USER || 'your-email@gmail.com';
const senderPassword = process.env.SENDER_PASSWORD || process.env.SMTP_PASS || 'your-app-password';

const transporter = process.env.SMTP_HOST
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: false,
      auth: {
        user: senderEmail,
        pass: senderPassword
      }
    })
  : nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: senderEmail,
        pass: senderPassword
      }
    });

/**
 * Extract subject from email message
 * @param {string} message - Full email message
 * @returns {string} - Extracted subject
 */
function extractSubject(message) {
  const subjectMatch = message.match(/Subject:\s*(.+?)(?:\n|$)/i);
  return subjectMatch ? subjectMatch[1].trim() : 'Customer Support';
}

/**
 * Convert plain text email to HTML format while preserving structure
 * @param {string} message - Plain text email message
 * @returns {string} - HTML formatted email
 */
function convertToHTML(message) {
  let html = message
    // Replace line breaks with <br>
    .split('\n')
    .map(line => {
      // Bold the subject line
      if (line.includes('Subject:')) {
        return `<strong style="color: #007bff; font-size: 16px;">${line}</strong>`;
      }
      // Bold greeting
      if (line.startsWith('Dear')) {
        return `<strong>${line}</strong>`;
      }
      // Bold closing lines
      if (line.includes('Thank you') || line.includes('Warm regards') || line.includes('regards')) {
        return `<strong>${line}</strong>`;
      }
      // Preserve empty lines for spacing
      if (line.trim() === '') {
        return '<br>';
      }
      return line;
    })
    .join('<br>');

  // Wrap in styled container
  const styledHTML = `
    <div style="font-family: Arial, sans-serif; line-height: 1.8; color: #333; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #f9f9f9; padding: 20px; border-radius: 8px; border-left: 4px solid #007bff;">
        <pre style="font-family: Arial, sans-serif; white-space: pre-wrap; word-wrap: break-word; margin: 0;">
${html}
        </pre>
      </div>
      <div style="margin-top: 20px; padding-top: 15px; border-top: 1px solid #ddd; font-size: 12px; color: #666;">
        <p>This is an automated message. Please do not reply to this email.</p>
      </div>
    </div>
  `;

  return styledHTML;
}

/**
 * Send email using SMTP with professional formatting
 * @param {string} toEmail - Recipient email address
 * @param {string} messageBody - Generated email message (with Subject, greeting, body, closing)
 * @param {string} name - Recipient name
 * @param {string} purpose - Message purpose
 * @returns {Promise<Object>} - Email send result
 */
export async function sendEmail(toEmail, messageBody, name = 'Customer', purpose = 'General') {
  try {
    // Extract subject from the message
    const subject = extractSubject(messageBody);

    // Convert to HTML while preserving formatting
    const htmlBody = convertToHTML(messageBody);

    const mailOptions = {
      from: senderEmail,
      to: toEmail,
      subject: subject,
      text: messageBody, // Plain text fallback
      html: htmlBody // HTML with formatting
    };

    const info = await transporter.sendMail(mailOptions);

    console.log(`✅ Email sent successfully`);
    console.log(`Message ID: ${info.messageId}`);
    console.log(`To: ${toEmail}`);
    console.log(`Subject: ${subject}`);

    return {
      success: true,
      message_id: info.messageId,
      status: 'sent',
      subject: subject,
      recipient: toEmail
    };
  } catch (error) {
    console.error(`❌ Error sending email: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}
