import twilio from 'twilio';
import dotenv from 'dotenv';

dotenv.config();

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhone = process.env.TWILIO_NUMBER || process.env.TWILIO_PHONE_NUMBER;

if (!accountSid || !authToken || !twilioPhone) {
  console.error('❌ Missing Twilio credentials in .env file');
  throw new Error('Twilio credentials not configured');
}

const client = twilio(accountSid, authToken);

/**
 * Send SMS using Twilio
 * @param {string} toNumber - Recipient phone number (e.g., '+1234567890')
 * @param {string} messageBody - Message text to send
 * @returns {Promise<Object>} - Message details including sid, status
 */
export async function sendSMS(toNumber, messageBody) {
  try {
    let number = toNumber;
    if (!number.startsWith('+')) {
      number = '+' + number;
    }

    number = number.replace(/\s|-/g, '');

    console.log(`📱 Sending SMS to ${number}`);
    console.log(`Message: ${messageBody}`);

    const message = await client.messages.create({
      body: messageBody,
      from: twilioPhone,
      to: number
    });

    console.log(`✅ SMS sent successfully`);
    console.log(`Message SID: ${message.sid}`);
    console.log(`Status: ${message.status}`);

    return {
      success: true,
      message_sid: message.sid,
      status: message.status,
      to: number
    };
  } catch (error) {
    console.error(`❌ Error sending SMS: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Send SMS to multiple recipients
 * @param {Array<string>} recipients - List of phone numbers
 * @param {string} messageBody - Message text to send
 * @returns {Promise<Array>} - List of send results
 */
export async function sendBulkSMS(recipients, messageBody) {
  const results = [];
  for (const recipient of recipients) {
    const result = await sendSMS(recipient, messageBody);
    results.push(result);
  }
  return results;
}
