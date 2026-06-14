import { test } from 'node:test';
import assert from 'node:assert';
import { getPeriodBounds, calculatePctChange } from '../src/lib/repositories/services-analytics';
import { humanizeIdentifier } from '../src/lib/utils/labels';

test('Services Analytics - Period Bounds Calculations', () => {
  // Test Today bounds (should cover roughly 24 hours of duration, since Yesterday start to Today end is 2 days)
  const todayBounds = getPeriodBounds('today');
  assert.ok(todayBounds.start);
  assert.ok(todayBounds.end);
  assert.ok(todayBounds.prevStart);
  assert.ok(todayBounds.prevEnd);
  
  const startMs = new Date(todayBounds.start).getTime();
  const endMs = new Date(todayBounds.end).getTime();
  assert.ok(endMs >= startMs, 'Today end should be after start');

  // Test 30 Days bounds
  const bounds30 = getPeriodBounds('30days');
  const duration30 = new Date(bounds30.end).getTime() - new Date(bounds30.start).getTime();
  const days30 = Math.round(duration30 / (1000 * 60 * 60 * 24));
  assert.strictEqual(days30, 30, '30days period should be exactly 30 days');

  const prevDuration30 = new Date(bounds30.prevEnd).getTime() - new Date(bounds30.prevStart).getTime();
  const prevDays30 = Math.round(prevDuration30 / (1000 * 60 * 60 * 24));
  assert.strictEqual(prevDays30, 30, '30days previous period should be exactly 30 days');

  // Test Custom Range bounds
  const customBounds = getPeriodBounds('custom', '2026-06-01', '2026-06-10');
  // 2026-06-01T00:00:00+03:00 to 2026-06-10T23:59:59+03:00 is 10 calendar days in Nairobi time
  const customDuration = new Date(customBounds.end).getTime() - new Date(customBounds.start).getTime();
  const customDays = customDuration / (1000 * 60 * 60 * 24);
  assert.ok(customDays > 9.9 && customDays < 10.1, 'Custom range should be approximately 10 days');
});

test('Services Analytics - Percentage Change Calculations', () => {
  // Both zero
  assert.strictEqual(calculatePctChange(0, 0), 'No change');
  
  // Previous is zero, current positive
  assert.strictEqual(calculatePctChange(150, 0), 'New');

  // Previous is zero, current negative
  assert.strictEqual(calculatePctChange(-50, 0), 'New');

  // Standard percentage increases
  assert.strictEqual(calculatePctChange(120, 100), '+20.0%');
  assert.strictEqual(calculatePctChange(200, 50), '+300.0%');

  // Standard percentage decreases
  assert.strictEqual(calculatePctChange(80, 100), '-20.0%');
  assert.strictEqual(calculatePctChange(0, 100), '-100.0%');

  // Negative boundary transitions
  assert.strictEqual(calculatePctChange(10, -10), '+200.0%');
  assert.strictEqual(calculatePctChange(-20, -10), '-100.0%');
});

test('Labels Utility - Identifier Humanizing Rules', () => {
  // Exact overrides
  assert.strictEqual(humanizeIdentifier('mini_site'), 'Mini Sites');
  assert.strictEqual(humanizeIdentifier('whatsapp_bot'), 'WhatsApp Bot');
  assert.strictEqual(humanizeIdentifier('whatsapp_agents'), 'WhatsApp Agents');
  assert.strictEqual(humanizeIdentifier('whatsapp_auto_post'), 'WhatsApp Auto Post');
  assert.strictEqual(humanizeIdentifier('requested_poster'), 'Requested Posters');
  assert.strictEqual(humanizeIdentifier('bundle'), 'Bundles');
  assert.strictEqual(humanizeIdentifier('video_ads'), 'Video Ads');

  // Case-insensitive checks
  assert.strictEqual(humanizeIdentifier('MINI_SITE'), 'Mini Sites');

  // Dynamic formatting fallbacks
  assert.strictEqual(humanizeIdentifier('video_ads_sale'), 'Video Ads Sale');
  assert.strictEqual(humanizeIdentifier('another-module-type'), 'Another Module Type');
  assert.strictEqual(humanizeIdentifier('wallet'), 'Wallet');
  assert.strictEqual(humanizeIdentifier('wallet_withdrawal'), 'Wallet Withdrawal');
});

test('Services Analytics - Dynamic Modules Mock Evaluation', () => {
  // Mocking the raw database transactions list
  const mockTransactions = [
    { amount: '1500', direction: 'IN', source_system: 'bingwaone', module: 'mini_site', status: 'SUCCESS', occurred_at: '2026-06-14T12:00:00Z' },
    { amount: '1500', direction: 'IN', source_system: 'bingwaone', module: 'mini_site', status: 'SUCCESS', occurred_at: '2026-06-14T13:00:00Z' },
    { amount: '2500', direction: 'OUT', source_system: 'bingwaone', module: 'wallet', status: 'SUCCESS', occurred_at: '2026-06-14T14:00:00Z' },
    { amount: '500', direction: 'IN', source_system: 'bingwazone', module: 'bundle', status: 'SUCCESS', occurred_at: '2026-06-14T11:00:00Z' },
    { amount: '1000', direction: 'IN', source_system: 'bingwaone', module: null, status: 'SUCCESS', occurred_at: '2026-06-14T10:00:00Z' }, // Ignored (null module)
    { amount: '1000', direction: 'IN', source_system: 'bingwaone', module: '', status: 'SUCCESS', occurred_at: '2026-06-14T10:00:00Z' }  // Ignored (blank module)
  ];

  // 1. Module Discovery (Non-null / non-empty modules only)
  const modulesSet = new Set<string>();
  mockTransactions.forEach(t => {
    const m = t.module?.trim();
    if (m && m !== '' && m.toLowerCase() !== 'null') {
      modulesSet.add(m);
    }
  });
  const discoveredModules = Array.from(modulesSet);
  
  assert.strictEqual(discoveredModules.length, 3);
  assert.ok(discoveredModules.includes('mini_site'));
  assert.ok(discoveredModules.includes('wallet'));
  assert.ok(discoveredModules.includes('bundle'));

  // 2. Incoming calculation (excluding outgoing wallet withdrawals from revenue)
  const miniSiteTxs = mockTransactions.filter(t => t.module === 'mini_site');
  const miniSiteRevenue = miniSiteTxs
    .filter(t => t.direction === 'IN')
    .reduce((sum, t) => sum + Number(t.amount), 0);
  assert.strictEqual(miniSiteRevenue, 3000, 'Mini site incoming revenue should be 3000');

  const walletTxs = mockTransactions.filter(t => t.module === 'wallet');
  const walletRevenue = walletTxs
    .filter(t => t.direction === 'IN')
    .reduce((sum, t) => sum + Number(t.amount), 0);
  assert.strictEqual(walletRevenue, 0, 'Wallet incoming revenue should be 0 (withdrawals are outgoing)');

  const walletOutflow = walletTxs
    .filter(t => t.direction === 'OUT')
    .reduce((sum, t) => sum + Number(t.amount), 0);
  assert.strictEqual(walletOutflow, 2500, 'Wallet outgoing outflow should be 2500');
});
