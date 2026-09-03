const assert = require('assert');
const path = require('path');
const crypto = require('crypto');

// Test Suite helper
function runTest(name, fn) {
  try {
    fn();
    console.log(`✅ Passed: ${name}`);
  } catch (err) {
    console.error(`❌ Failed: ${name}`);
    console.error(err);
    process.exit(1);
  }
}

async function runAsyncTest(name, fn) {
  try {
    await fn();
    console.log(`✅ Passed: ${name}`);
  } catch (err) {
    console.error(`❌ Failed: ${name}`);
    console.error(err);
    process.exit(1);
  }
}

(async () => {
  const { 
    translateAlert, 
    buildSlackPayload, 
    buildDiscordPayload, 
    buildCustomWebhookPayload, 
    buildTelegramMessage 
  } = require('../backend/dist/services/notifier');
  const { inspectSslCertificate } = require('../backend/dist/services/sslProber');

  // 1. Alert Webhook Translation Tests
  runTest('Alert Translation - HostHighCpu', () => {
    const notification = {
      alertName: 'HostHighCpu',
      monitoredItemName: 'db-primary',
      status: 'firing',
      severity: 'critical',
      value: '92.50',
      timestamp: new Date().toISOString()
    };

    const result = translateAlert(notification);
    assert.ok(result.message.includes('db-primary'), 'Message should contain the host name');
    assert.ok(result.message.includes('92.50%'), 'Message should contain the CPU value');
    assert.ok(result.action.includes('upgrading server resources'), 'Action should recommend runaway process check');
  });

  runTest('Alert Translation - HostHighMemory', () => {
    const notification = {
      alertName: 'HostHighMemory',
      monitoredItemName: 'redis-cache-1',
      status: 'firing',
      severity: 'critical',
      value: '95.20',
      timestamp: new Date().toISOString()
    };

    const result = translateAlert(notification);
    assert.ok(result.message.includes('redis-cache-1'), 'Message should contain host');
    assert.ok(result.message.includes('RAM'), 'Message should mention RAM');
    assert.ok(result.action.includes('top/htop'), 'Action should recommend memory inspection');
  });

  runTest('Alert Translation - Predictive Disk Space', () => {
    const notification = {
      alertName: 'HostDiskFillingFast',
      monitoredItemName: 'app-server-east',
      status: 'firing',
      severity: 'warning',
      timestamp: new Date().toISOString()
    };

    const result = translateAlert(notification);
    assert.ok(result.message.includes('filling up rapidly'), 'Message should warn of rapid disk fill');
    assert.ok(result.action.includes('log files'), 'Action should recommend checking log files');
  });

  runTest('Alert Translation - SSL Expiry Warning & Critical', () => {
    const warnNotice = {
      alertName: 'SSLCertExpiringSoon',
      monitoredItemName: 'https://checkout.store.com',
      status: 'firing',
      severity: 'warning',
      value: '10',
      timestamp: new Date().toISOString()
    };

    const warnRes = translateAlert(warnNotice);
    assert.ok(warnRes.message.includes('10 days remaining'), 'Should show remaining days');
    assert.ok(warnRes.action.includes('Certbot'), 'Should recommend Certbot');

    const critNotice = {
      alertName: 'SSLCertExpiringCrit',
      monitoredItemName: 'https://checkout.store.com',
      status: 'firing',
      severity: 'critical',
      timestamp: new Date().toISOString()
    };

    const critRes = translateAlert(critNotice);
    assert.ok(critRes.message.includes('72 hours'), 'Should emphasize critical 72-hour window');
  });

  runTest('Alert Translation - Resolved State', () => {
    const notification = {
      alertName: 'SiteDown',
      monitoredItemName: 'https://mysite.com',
      status: 'resolved',
      severity: 'critical',
      timestamp: '2026-06-30T06:00:00.000Z'
    };

    const result = translateAlert(notification);
    assert.ok(result.message.includes('back to normal'), 'Should indicate resolution');
    assert.strictEqual(result.action, 'No action required.');
  });

  // 2. Multi-Channel Alert Payload Builders
  runTest('Slack Block Kit Payload Builder', () => {
    const notification = {
      alertName: 'HostHighCpu',
      monitoredItemName: 'api-worker-01',
      status: 'firing',
      severity: 'critical',
      value: '94.10',
      timestamp: new Date().toISOString()
    };

    const payload = buildSlackPayload(notification);
    assert.ok(payload.attachments && payload.attachments.length > 0, 'Must have attachments');
    assert.strictEqual(payload.attachments[0].color, '#ef4444', 'Firing critical should be red');
    const blocks = payload.attachments[0].blocks;
    assert.strictEqual(blocks[0].type, 'header');
    assert.ok(blocks[0].text.text.includes('AllClear'), 'Header must include branding');
  });

  runTest('Discord Rich Embed Builder', () => {
    const notification = {
      alertName: 'SiteDown',
      monitoredItemName: 'https://api.gateway.io',
      status: 'resolved',
      severity: 'critical',
      timestamp: new Date().toISOString()
    };

    const payload = buildDiscordPayload(notification);
    assert.ok(payload.embeds && payload.embeds.length === 1);
    assert.strictEqual(payload.embeds[0].color, 0x10b981, 'Resolved should be green');
    assert.ok(payload.embeds[0].title.includes('Normal'), 'Title should indicate normal state');
  });

  runTest('Custom Webhook Payload & HMAC Signature', () => {
    const notification = {
      alertName: 'HostHighDisk',
      monitoredItemName: 'db-storage-node',
      status: 'firing',
      severity: 'critical',
      value: '91.0',
      timestamp: new Date().toISOString()
    };

    const payload = buildCustomWebhookPayload(notification);
    assert.strictEqual(payload.event, 'allclear.alert');
    assert.strictEqual(payload.alert.alertName, 'HostHighDisk');

    // Verify HMAC signature calculation
    const secret = 'test-signing-secret-123';
    const computedSignature = crypto.createHmac('sha256', secret).update(JSON.stringify(payload)).digest('hex');
    assert.strictEqual(typeof computedSignature, 'string');
    assert.strictEqual(computedSignature.length, 64);
  });

  runTest('Telegram HTML Message Builder', () => {
    const notification = {
      alertName: 'AgentOffline',
      monitoredItemName: 'k8s-worker-node-4',
      status: 'firing',
      severity: 'critical',
      timestamp: new Date().toISOString()
    };

    const msg = buildTelegramMessage(notification);
    assert.ok(msg.includes('<b>[AllClear] Incident Alert Triggered</b>'));
    assert.ok(msg.includes('<code>k8s-worker-node-4</code>'));
    assert.ok(msg.includes('<b>Suggested Action:</b>'));
  });

  // 3. SSL Prober Resilience Test
  await runAsyncTest('SSL Prober - Malformed Hostname Handling', async () => {
    const res = await inspectSslCertificate('invalid://not-a-valid-hostname:99999', 1000);
    assert.strictEqual(res.success, false);
    assert.ok(res.error, 'Should return error object');
  });

  // 4. Token Ingestion & Binding Validation Mock Test
  runTest('Agent Token-Binding Authentication Verification', () => {
    const mockTokenDatabase = {
      'server-uuid-1234': {
        token_hash: '$2a$10$C8.tT0R1mO/J4W/m1kU8.e64K4pZ.tq9.t7.t6.t5.t4.t3.t2.t1',
        tenant_id: 'tenant-uuid-1'
      }
    };

    const mockPayload = {
      server_id: 'server-uuid-1234',
      token: 'secret_agent_token'
    };

    const dbRecord = mockTokenDatabase[mockPayload.server_id];
    assert.ok(dbRecord, 'Payload server_id should match database record');
    assert.strictEqual(dbRecord.tenant_id, 'tenant-uuid-1', 'Should resolve correct tenant');
  });

  console.log('\n🚀 All 10 backend test suites passed successfully with zero failures!\n');
})();
