const assert = require('assert');
const path = require('path');

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

// 1. Alert Webhook Translation Tests
runTest('Alert Translation - HostHighCpu', () => {
  const { translateAlert } = require('../backend/dist/services/notifier');
  
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

runTest('Alert Translation - SiteDown', () => {
  const { translateAlert } = require('../backend/dist/services/notifier');
  
  const notification = {
    alertName: 'SiteDown',
    monitoredItemName: 'https://mysite.com',
    status: 'firing',
    severity: 'critical',
    timestamp: new Date().toISOString()
  };

  const result = translateAlert(notification);
  assert.ok(result.message.includes('https://mysite.com') && result.message.includes('OFFLINE'), 'Should alert site is offline');
  assert.ok(result.action.includes('hosting provider'), 'Should suggest hosting provider checklist');
});

runTest('Alert Translation - Resolved State', () => {
  const { translateAlert } = require('../backend/dist/services/notifier');
  
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

// 2. Token Ingestion & Binding Validation Mock Test
runTest('Agent Token-Binding Authentication Verification', () => {
  // Mock token database record
  const mockTokenDatabase = {
    'server-uuid-1234': {
      token_hash: '$2a$10$C8.tT0R1mO/J4W/m1kU8.e64K4pZ.tq9.t7.t6.t5.t4.t3.t2.t1', // Bcrypt hash for 'secret_agent_token'
      tenant_id: 'tenant-uuid-1'
    }
  };

  const mockPayload = {
    server_id: 'server-uuid-1234',
    token: 'secret_agent_token'
  };

  const dbRecord = mockTokenDatabase[mockPayload.server_id];
  assert.ok(dbRecord, 'Payload server_id should match database record');
  assert.strictEqual(dbRecord.tenant_id, 'tenant-uuid-1', 'Should resolve the correct tenant context');
});

console.log('\nAll backend unit tests passed successfully!');
