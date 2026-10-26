import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import http from 'http';
import https from 'https';
import * as crypto from 'crypto';
import nodemailer from 'nodemailer';
import twilio from 'twilio';
import { adminQuery } from '../db';

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
    case 'HostHighMemory':
      return {
        message: `🚨 Your server [${monitoredItemName}] is using almost all RAM (Memory at ${value || '90+'}%).`,
        action: 'Inspect memory consumption using top/htop or scale up server instance size.'
      };
    case 'HostDiskFillingFast':
      return {
        message: `⚠️ Storage on your server [${monitoredItemName}] is filling up rapidly.`,
        action: 'Check recent log files, core dumps, or Docker storage to prevent full disk lockup.'
      };
    case 'HostHighNetworkErrors':
      return {
        message: `⚠️ Your server [${monitoredItemName}] is experiencing high network packet error rates.`,
        action: 'Check network hardware, virtual interface configuration, or cloud network throughput quotas.'
      };
    case 'SSLCertExpiringSoon':
      return {
        message: `⚠️ The SSL certificate for [${monitoredItemName}] will expire in less than 14 days (${value || '14'} days remaining).`,
        action: 'Renew your TLS certificate soon or verify Certbot / Let\'s Encrypt auto-renewal cron.'
      };
    case 'SSLCertExpiringCrit':
      return {
        message: `🚨 CRITICAL: The SSL certificate for [${monitoredItemName}] expires in less than 72 hours!`,
        action: 'Renew certificate immediately to avoid security warnings in visitor browsers.'
      };
    case 'AgentOffline':
      return {
        message: `🚨 We haven't heard from your server [${monitoredItemName}] in over a minute and a half.`,
        action: 'Check if the server is running and the allclear-agent systemd service is active.'
      };
    default:
      return {
        message: `🚨 Alert [${alertName}] is firing on [${monitoredItemName}]. Value: ${value || 'N/A'}.`,
        action: 'Inspect the system status on your AllClear dashboard.'
      };
  }
}

export async function sendAlert(tenantId: string, email: string, whatsappNumber: string | null, notification: AlertNotification) {
  const { message, action } = translateAlert(notification);
  const fullText = `AllClear Notification:\n${message}\n\nSuggested Next Step:\n${action}`;

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

  // 3. Dispatch to Configured Multi-Channel Integrations (Slack, Discord, Webhooks)
  try {
    const channelsRes = await adminQuery(
      'SELECT channel_type, config_json FROM notification_channels WHERE tenant_id = $1 AND is_enabled = true',
      [tenantId]
    );

    for (const channel of channelsRes.rows) {
      const config = channel.config_json || {};
      if (channel.channel_type === 'slack' && config.webhook_url) {
        await sendSlackAlert(config.webhook_url, notification);
      } else if (channel.channel_type === 'discord' && config.webhook_url) {
        await sendDiscordAlert(config.webhook_url, notification);
      } else if (channel.channel_type === 'webhook' && config.url) {
        await sendCustomWebhookAlert(config.url, config.secret, notification);
      } else if (channel.channel_type === 'telegram' && config.bot_token && config.chat_id) {
        await sendTelegramAlert(config.bot_token, config.chat_id, notification);
      } else if (channel.channel_type === 'pagerduty' && config.routing_key) {
        await sendPagerDutyAlert(config.routing_key, notification);
      } else if (channel.channel_type === 'msteams' && config.webhook_url) {
        await sendMSTeamsAlert(config.webhook_url, notification);
      }
    }
  } catch (err) {
    console.error('[Notification Channel Query Error]:', err);
  }

  // Fallback to environment variable webhooks if configured
  if (process.env.SLACK_WEBHOOK_URL) {
    await sendSlackAlert(process.env.SLACK_WEBHOOK_URL, notification);
  }
  if (process.env.DISCORD_WEBHOOK_URL) {
    await sendDiscordAlert(process.env.DISCORD_WEBHOOK_URL, notification);
  }
  if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
    await sendTelegramAlert(process.env.TELEGRAM_BOT_TOKEN, process.env.TELEGRAM_CHAT_ID, notification);
  }
  if (process.env.PAGERDUTY_ROUTING_KEY) {
    await sendPagerDutyAlert(process.env.PAGERDUTY_ROUTING_KEY, notification);
  }
  if (process.env.MSTEAMS_WEBHOOK_URL) {
    await sendMSTeamsAlert(process.env.MSTEAMS_WEBHOOK_URL, notification);
  }
}

/**
 * Low-level JSON HTTP/HTTPS POST helper with timeout
 */
export function postJson(
  targetUrl: string,
  body: any,
  customHeaders: Record<string, string> = {}
): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const url = new URL(targetUrl);
      const reqLib = url.protocol === 'https:' ? https : http;
      const data = JSON.stringify(body);
      const req = reqLib.request(
        targetUrl,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(data),
            'User-Agent': 'AllClear-Notifier/1.1',
            ...customHeaders,
          },
          timeout: 5000,
        },
        (res) => {
          const ok = (res.statusCode || 500) < 400;
          resolve(ok);
        }
      );
      req.on('error', (err) => {
        console.error(`[Notifier Error] Failed POST to ${targetUrl}:`, err.message);
        resolve(false);
      });
      req.on('timeout', () => {
        req.destroy();
        resolve(false);
      });
      req.write(data);
      req.end();
    } catch (e: any) {
      console.error(`[Notifier Error] Malformed URL ${targetUrl}:`, e.message);
      resolve(false);
    }
  });
}

/**
 * Slack Block Kit Builder
 */
export function buildSlackPayload(notification: AlertNotification): any {
  const { message, action } = translateAlert(notification);
  const isResolved = notification.status === 'resolved';
  const color = isResolved ? '#10b981' : notification.severity === 'critical' ? '#ef4444' : '#f59e0b';
  const title = isResolved ? '✅ AllClear: Status Resolved' : '🚨 AllClear: System Alert';

  return {
    attachments: [
      {
        color,
        blocks: [
          {
            type: 'header',
            text: { type: 'plain_text', text: title, emoji: true },
          },
          {
            type: 'section',
            text: { type: 'mrkdwn', text: `*Node:* \`${notification.monitoredItemName}\`\n${message}` },
          },
          {
            type: 'section',
            fields: [
              { type: 'mrkdwn', text: `*Severity:*\n${notification.severity.toUpperCase()}` },
              { type: 'mrkdwn', text: `*Status:*\n${notification.status.toUpperCase()}` },
            ],
          },
          {
            type: 'context',
            elements: [
              { type: 'mrkdwn', text: `💡 *Suggested Action:* ${action}` },
            ],
          },
        ],
      },
    ],
  };
}

export async function sendSlackAlert(webhookUrl: string, notification: AlertNotification): Promise<boolean> {
  const payload = buildSlackPayload(notification);
  const ok = await postJson(webhookUrl, payload);
  if (ok) console.log(`[Slack Dispatch] Alert successfully posted to Slack.`);
  return ok;
}

/**
 * Discord Rich Embed Builder
 */
export function buildDiscordPayload(notification: AlertNotification): any {
  const { message, action } = translateAlert(notification);
  const isResolved = notification.status === 'resolved';
  const color = isResolved ? 0x10b981 : notification.severity === 'critical' ? 0xef4444 : 0xf59e0b;

  return {
    embeds: [
      {
        title: `[AllClear] ${isResolved ? '✅ Status Normal' : '🚨 Alert Triggered'} — ${notification.monitoredItemName}`,
        description: message,
        color,
        fields: [
          { name: 'Suggested Action', value: action, inline: false },
          { name: 'Severity', value: notification.severity.toUpperCase(), inline: true },
          { name: 'Status', value: notification.status.toUpperCase(), inline: true },
          { name: 'Timestamp', value: new Date(notification.timestamp).toLocaleString(), inline: true },
        ],
        footer: { text: 'AllClear Multi-Cloud Observability Engine' },
      },
    ],
  };
}

export async function sendDiscordAlert(webhookUrl: string, notification: AlertNotification): Promise<boolean> {
  const payload = buildDiscordPayload(notification);
  const ok = await postJson(webhookUrl, payload);
  if (ok) console.log(`[Discord Dispatch] Alert successfully posted to Discord.`);
  return ok;
}

/**
 * Generic Custom Webhook Payload Builder with HMAC Signature support
 */
export function buildCustomWebhookPayload(notification: AlertNotification): any {
  const { message, action } = translateAlert(notification);
  return {
    event: 'allclear.alert',
    alert: notification,
    human_readable: {
      message,
      suggested_action: action,
    },
    timestamp: new Date().toISOString(),
  };
}

export async function sendCustomWebhookAlert(
  webhookUrl: string,
  secret: string | undefined,
  notification: AlertNotification
): Promise<boolean> {
  const payload = buildCustomWebhookPayload(notification);
  const headers: Record<string, string> = {};
  if (secret) {
    const signature = crypto.createHmac('sha256', secret).update(JSON.stringify(payload)).digest('hex');
    headers['X-AllClear-Signature'] = `sha256=${signature}`;
  }
  const ok = await postJson(webhookUrl, payload, headers);
  if (ok) console.log(`[Webhook Dispatch] Alert posted to custom webhook.`);
  return ok;
}

/**
 * Telegram Bot Alert Dispatcher
 */
export function buildTelegramMessage(notification: AlertNotification): string {
  const { message, action } = translateAlert(notification);
  const isResolved = notification.status === 'resolved';
  const header = isResolved ? '<b>[AllClear] System Status Normal</b>' : '<b>[AllClear] Incident Alert Triggered</b>';

  return (
    `${header}\n\n` +
    `<b>Node:</b> <code>${notification.monitoredItemName}</code>\n` +
    `<b>Severity:</b> ${notification.severity.toUpperCase()}\n` +
    `<b>Status:</b> ${notification.status.toUpperCase()}\n\n` +
    `<b>Summary:</b>\n${message}\n\n` +
    `<b>Suggested Action:</b>\n${action}`
  );
}

export async function sendTelegramAlert(
  botToken: string,
  chatId: string,
  notification: AlertNotification
): Promise<boolean> {
  const text = buildTelegramMessage(notification);
  const telegramUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
  const payload = {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
  };
  const ok = await postJson(telegramUrl, payload);
  if (ok) console.log(`[Telegram Dispatch] Alert message posted to chat ${chatId}.`);
  return ok;
}

/**
 * PagerDuty Events API v2 Payload Builder
 */
export function buildPagerDutyPayload(routingKey: string, notification: AlertNotification): any {
  const { message, action } = translateAlert(notification);
  return {
    routing_key: routingKey,
    event_action: notification.status === 'resolved' ? 'resolve' : 'trigger',
    dedup_key: `allclear-${notification.monitoredItemName}-${notification.alertName}`,
    payload: {
      summary: `[AllClear] ${notification.monitoredItemName}: ${notification.alertName} (${notification.severity})`,
      timestamp: new Date(notification.timestamp).toISOString(),
      severity: notification.severity === 'critical' ? 'critical' : 'warning',
      source: notification.monitoredItemName,
      component: 'infrastructure',
      custom_details: {
        message,
        suggested_action: action,
        status: notification.status,
        value: notification.value || null,
      },
    },
    client: 'AllClear Observability Engine',
    client_url: 'https://allclear.internal',
  };
}

export async function sendPagerDutyAlert(
  routingKey: string,
  notification: AlertNotification
): Promise<boolean> {
  const payload = buildPagerDutyPayload(routingKey, notification);
  const pagerDutyUrl = 'https://events.pagerduty.com/v2/enqueue';
  const ok = await postJson(pagerDutyUrl, payload);
  if (ok) console.log(`[PagerDuty Dispatch] Incident event posted to PagerDuty.`);
  return ok;
}

/**
 * Microsoft Teams Adaptive Card Builder
 */
export function buildMSTeamsPayload(notification: AlertNotification): any {
  const { message, action } = translateAlert(notification);
  const isResolved = notification.status === 'resolved';

  return {
    type: 'message',
    attachments: [
      {
        contentType: 'application/vnd.microsoft.card.adaptive',
        contentUrl: null,
        content: {
          $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
          type: 'AdaptiveCard',
          version: '1.4',
          body: [
            {
              type: 'TextBlock',
              size: 'Medium',
              weight: 'Bolder',
              text: isResolved ? '✅ AllClear: Status Resolved' : '🚨 AllClear: System Alert',
              color: isResolved ? 'Good' : 'Attention',
            },
            {
              type: 'TextBlock',
              text: `**Node:** ${notification.monitoredItemName}`,
              wrap: true,
            },
            {
              type: 'TextBlock',
              text: message,
              wrap: true,
            },
            {
              type: 'FactSet',
              facts: [
                { title: 'Severity', value: notification.severity.toUpperCase() },
                { title: 'Status', value: notification.status.toUpperCase() },
                { title: 'Suggested Action', value: action },
              ],
            },
          ],
        },
      },
    ],
  };
}

export async function sendMSTeamsAlert(
  webhookUrl: string,
  notification: AlertNotification
): Promise<boolean> {
  const payload = buildMSTeamsPayload(notification);
  const ok = await postJson(webhookUrl, payload);
  if (ok) console.log(`[MS Teams Dispatch] Card message posted to Microsoft Teams.`);
  return ok;
}
