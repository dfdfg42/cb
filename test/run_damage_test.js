const assert = require('assert');
const DamageCalculator = require('../.ts_tmp/game/DamageCalculator.js').DamageCalculator;

function makeCard(overrides) {
  return Object.assign({ id: 'c1', name: 'atk', type: 'attack', healthDamage: 0, mentalDamage: 0, defense: 0, mentalCost: 0, plusLevel: 0, effect: 'none', description: '' }, overrides);
}

function run() {
  console.log('Running DamageCalculator tests...');

  // Test 1: simple attack minus defense
  {
    const atk = makeCard({ healthDamage: 10 });
    const def = makeCard({ defense: 3 });
    const res = DamageCalculator.calculateHealthDamage([atk], [def]);
    assert.strictEqual(res.damage, 7, '10 - 3 = 7');
  }

  // Test 2: reflect flag
  {
    const atk = makeCard({ healthDamage: 12 });
    const def = makeCard({ effect: 'reflect' });
    const res = DamageCalculator.calculateHealthDamage([atk], [def]);
    assert.strictEqual(res.isReflect, true, 'reflect should be true');
    // reflect doesn't change damage calculation here (damage still calculated but game uses flag)
  }

  // Test 3: attribute multiplier (fire vs water -> 0.5)
  {
    const atk = makeCard({ healthDamage: 10, attribute: 'fire' });
    const res = DamageCalculator.calculateHealthDamage([atk], [], 'water');
    // 10 * 0.5 = 5
    assert.strictEqual(res.damage, 5, 'fire vs water should halve damage');
  }

  console.log('All DamageCalculator tests passed.');
}

try { run(); process.exit(0); } catch (e) { console.error('Test failed:', e); process.exit(1); }
