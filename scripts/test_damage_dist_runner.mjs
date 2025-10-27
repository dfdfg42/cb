import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function run() {
  const { DamageCalculator } = await import(path.join(__dirname, '..', 'dist', 'game', 'DamageCalculator.js'));
  const { AttributeType } = await import(path.join(__dirname, '..', 'dist', 'types', 'gameTypes.js'));

  const makeAttack = (attack, attr) => ({ attack, attribute: attr });
  const makeDefense = (defense, attr) => ({ defense, attribute: attr });
  const assertEqual = (a, b, msg) => {
    if (a !== b) {
      console.error(`FAIL: ${msg} - expected ${b}, got ${a}`);
      process.exitCode = 1;
    } else {
      console.log(`OK: ${msg}`);
    }
  };

  console.log('Running compiled DamageCalculator tests (dist)...');

  let res = DamageCalculator.calculateHealthDamage([
    makeAttack(5, AttributeType.FIRE)
  ], [ makeDefense(5, AttributeType.WATER) ]);
  assertEqual(res.damage, 0, 'FIRE vs WATER should be blocked');

  res = DamageCalculator.calculateHealthDamage([
    makeAttack(5, AttributeType.FIRE)
  ], [ makeDefense(5, AttributeType.NONE) ]);
  assertEqual(res.damage, 5, 'FIRE vs NONE should not be blocked');

  res = DamageCalculator.calculateHealthDamage([
    makeAttack(6, AttributeType.WATER)
  ], [ makeDefense(2, AttributeType.FIRE), makeDefense(10, AttributeType.NONE) ]);
  assertEqual(res.damage, 4, 'WATER vs FIRE+NONE should consume FIRE first');

  res = DamageCalculator.calculateHealthDamage([
    makeAttack(3, AttributeType.LIGHT)
  ], [ makeDefense(1, AttributeType.LIGHT) ]);
  assertEqual(res.damage, 2, 'LIGHT vs LIGHT partially blocked');

  res = DamageCalculator.calculateHealthDamage([
    makeAttack(10, AttributeType.DARK)
  ], [ makeDefense(5, AttributeType.NONE) ]);
  assertEqual(res.damage, 5, 'DARK vs NONE should be partially blocked');

  res = DamageCalculator.calculateHealthDamage([
    makeAttack(5, AttributeType.FIRE), makeAttack(4, AttributeType.WATER)
  ], [ makeDefense(3, AttributeType.WATER), makeDefense(4, AttributeType.FIRE) ]);
  assertEqual(res.damage, 2, 'Mixed attributes should be resolved per rules');

  if (process.exitCode === 1) {
    console.error('Some tests failed');
    process.exit(1);
  } else {
    console.log('All compiled tests passed');
  }
}

run().catch(err => { console.error(err); process.exit(1); });
