import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import nodemailer from 'nodemailer';
import twilio from 'twilio';

dotenv.config();

const LOG_DIR = path.join(__dirname, '../../logs');
const LOG_FILE = path.join(LOG_DIR, 'alerts.log');

// Ensure log directory exists
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

export interface AlertNotification {
  alertName: string;
  monitoredItemName: string;
  status: 'firing' | 'resolved'; // 'firing' or 'resolved'
  severity: string;
  value?: string;
  timestamp: string;
}

export function translateAlert(notification: AlertNotification): { message: string; action: string } {
  const { alertName, monitoredItemName, status, value, timestamp } = notification;

  if (status === 'resolved') {
    return {
      message: `✅ [${monitoredItemName}] is back to normal as of ${new Date(timestamp).toLocaleString()}.`,
      action: 'No action required.'
    };
  }

  // Firing alerts
  switch (alertName) {
    case 'HostHighCpu':
      return {
        message: `🚨 Your server [${monitoredItemName}] is working very hard right now (CPU at ${value || '90+'}% ) and may slow down for visitors.`,
        action: 'Consider upgrading server resources or checking for runaway processes using top/htop.'
      };
    case 'HostHighDisk':
      return {
        message: `🚨 Your server [${monitoredItemName}] is almost out of storage space (${value || '85+'}% used).`,
        action: 'Free up disk space soon (e.g. check logs, temp files) or increase storage to avoid service issues.'
      };
    case 'SiteDown':
      return {
        message: `🚨 Your website [${monitoredItemName}] is currently OFFLINE.`,
        action: "Check your hosting provider's status page, verify DNS settings, or restart your web server."
      };
    case 'SiteSlow':
      return {
        message: `🚨 Your website [${monitoredItemName}] is loading slowly for visitors (response time at ${value || '3+'}s).`,
        action: 'Check server load, optimize static assets, or contact your hosting provider if this continues.'
      };
    case 'AgentOffline':
      return {
        message: `🚨 We haven't heard from your server [${monitoredItemName}] in over a minute and a half.`,
        action: 'Check if the server is running and the cloudmon-agent systemd service is active.'
      };
    default:
      return {
        message: `🚨 Alert [${alertName}] is firing on [${monitoredItemName}]. Value: ${value || 'N/A'}.`,
        action: 'Inspect the system status on your CloudMon dashboard.'
      };
  }
}

export async function sendAlert(tenantId: string, email: string, whatsappNumber: string | null, notification: AlertNotification) {
  const { message, action } = translateAlert(notification);
  const fullText = `CloudMon Notification:\n${message}\n\nSuggested Next Step:\n${action}`;

  // Log to debug alert log file
  const logEntry = `[${new Date().toISOString()}] Tenant: ${tenantId} | Email: ${email} | WhatsApp: ${whatsappNumber || 'None'}\n${fullText}\n----------------------------------------\n`;
  fs.appendFileSync(LOG_FILE, logEntry);
  console.log(`[ALERT NOTIFICATION LOGGED]:\n${fullText}`);

  // 1. Send Email (via Nodemailer)
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = parseInt(process.env.SMTP_PORT || '587');
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const smtpFrom = process.env.SMTP_FROM || 'alerts@cloudmon.io';

  if (smtpHost && smtpUser && smtpPass) {
    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });

      await transporter.sendMail({
        from: smtpFrom,
        to: email,
        subject: `[CloudMon Alert] ${notification.status === 'resolved' ? 'Fixed: ' : 'Alert: '}${notification.monitoredItemName}`,
        text: fullText,
      });
      console.log(`[Email Sent] Successful email dispatch to ${email}`);
    } catch (err) {
      console.error('[Email Error] Failed to send email via SMTP:', err);
    }
  } else {
    console.log('[Email Mock] SMTP credentials not set. Falling back to logs.');
  }

  // 2. Send WhatsApp (via Twilio)
  const twilioSid = process.env.TWILIO_ACCOUNT_SID;
  const twilioToken = process.env.TWILIO_AUTH_TOKEN;
  const twilioFrom = process.env.TWILIO_WHATSAPP_NUMBER || 'whatsapp:+14155238886'; // Twilio sandbox number

  if (twilioSid && twilioToken && whatsappNumber) {
    try {
      const client = twilio(twilioSid, twilioToken);
      // Ensure number is formatted for WhatsApp sandbox/live
      const targetNumber = whatsappNumber.startsWith('whatsapp:') ? whatsappNumber : `whatsapp:${whatsappNumber}`;
      
      await client.messages.create({
        from: twilioFrom,
        to: targetNumber,
        body: fullText,
      });
      console.log(`[WhatsApp Sent] Successful message dispatch to ${targetNumber}`);
    } catch (err) {
      console.error('[WhatsApp Error] Failed to send WhatsApp via Twilio:', err);
    }
  } else {
    console.log('[WhatsApp Mock] Twilio credentials not set or no client number. Falling back to logs.');
  }
}
