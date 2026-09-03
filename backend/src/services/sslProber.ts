import tls from 'tls';
import { URL } from 'url';

export interface SslCertInfo {
  domain: string;
  issuer: string;
  subject: string;
  valid_from: string;
  valid_to: string;
  days_remaining: number;
  status: 'valid' | 'expiring_soon' | 'expired' | 'error';
  authorized: boolean;
  authorizationError?: string;
}

export function inspectSslCertificate(
  targetUrl: string,
  timeoutMs = 6000
): Promise<{ success: boolean; certInfo?: SslCertInfo; error?: string }> {
  return new Promise((resolve) => {
    let hostname: string;
    let port = 443;

    try {
      if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
        targetUrl = 'https://' + targetUrl;
      }
      const parsed = new URL(targetUrl);
      hostname = parsed.hostname;
      if (parsed.port) {
        port = parseInt(parsed.port, 10);
      }
    } catch (e: any) {
      return resolve({ success: false, error: `Invalid URL: ${e.message}` });
    }

    const socket = tls.connect(
      {
        host: hostname,
        port,
        servername: hostname,
        rejectUnauthorized: false, // Inspect certificate even if self-signed/expired
        timeout: timeoutMs,
      },
      () => {
        try {
          const peerCert = socket.getPeerCertificate();
          const authorized = socket.authorized;
          const authError = socket.authorizationError?.message;

          socket.end();

          if (!peerCert || Object.keys(peerCert).length === 0) {
            return resolve({ success: false, error: 'No SSL certificate returned by host.' });
          }

          const validFrom = peerCert.valid_from;
          const validTo = peerCert.valid_to;
          const validToTimestamp = new Date(validTo).getTime();
          const now = Date.now();
          const msRemaining = validToTimestamp - now;
          const daysRemaining = Math.floor(msRemaining / (1000 * 60 * 60 * 24));

          let status: 'valid' | 'expiring_soon' | 'expired' | 'error' = 'valid';
          if (daysRemaining <= 0) {
            status = 'expired';
          } else if (daysRemaining <= 14) {
            status = 'expiring_soon';
          }

          const toStr = (v: string | string[] | undefined) => (Array.isArray(v) ? v.join(', ') : v || '');
          const issuerOrg = toStr(peerCert.issuer?.O) || toStr(peerCert.issuer?.CN) || 'Unknown CA';
          const subjectName = toStr(peerCert.subject?.CN) || hostname;

          resolve({
            success: true,
            certInfo: {
              domain: hostname,
              issuer: issuerOrg,
              subject: subjectName,
              valid_from: validFrom,
              valid_to: validTo,
              days_remaining: daysRemaining,
              status,
              authorized,
              authorizationError: authError,
            },
          });
        } catch (err: any) {
          resolve({ success: false, error: `Failed to parse SSL certificate: ${err.message}` });
        }
      }
    );

    socket.on('timeout', () => {
      socket.destroy();
      resolve({ success: false, error: `TLS connection to ${hostname}:${port} timed out (${timeoutMs}ms)` });
    });

    socket.on('error', (err: any) => {
      resolve({ success: false, error: `TLS socket error: ${err.message}` });
    });
  });
}
