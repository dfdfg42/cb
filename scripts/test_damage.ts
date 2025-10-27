import { DamageCalculator } from '../src/game/DamageCalculator';
import { AttributeType } from '../src/types/gameTypes';

function makeAttack(attack: number, attr: AttributeType) {
  return { attack, attribute: attr } as any;
}

function makeDefense(defense: number, attr: AttributeType) {
  return { defense, attribute: attr } as any;
}

function assertEqual(a: any, b: any, msg?: string) {
  if (a !== b) {
    console.error(`FAIL: ${msg || ''} - expected ${b}, got ${a}`);
    process.exitCode = 1;
  } else {
    console.log(`OK: ${msg || ''}`);
  }
}

function runTests() {
  console.log('Running DamageCalculator attribute/blocking tests...');

  // 1) FIRE attack blocked by WATER defense
  let res = DamageCalculator.calculateHealthDamage(
    [makeAttack(5, AttributeType.FIRE)],
    [makeDefense(5, AttributeType.WATER)]
  );
  assertEqual(res.damage, 0, 'FIRE vs WATER should be blocked');

  // 2) FIRE attack not blocked by NONE defense
  res = DamageCalculator.calculateHealthDamage(
    [makeAttack(5, AttributeType.FIRE)],
    [makeDefense(5, AttributeType.NONE)]
  );
  assertEqual(res.damage, 5, 'FIRE vs NONE should not be blocked');

  // 3) WATER attack blocked only by FIRE defense
  res = DamageCalculator.calculateHealthDamage(
    [makeAttack(6, AttributeType.WATER)],
    [makeDefense(2, AttributeType.FIRE), makeDefense(10, AttributeType.NONE)]
  );
  // FIRE def absorbs 2 -> remaining 4 damage (NONE cannot block water)
  assertEqual(res.damage, 4, 'WATER vs FIRE+NONE should consume FIRE first');

  // 4) LIGHT blocked only by LIGHT
  res = DamageCalculator.calculateHealthDamage(
    [makeAttack(3, AttributeType.LIGHT)],
    [makeDefense(1, AttributeType.LIGHT)]
  );
  assertEqual(res.damage, 2, 'LIGHT vs LIGHT partially blocked');

  // 5) DARK blocked by any defense
  res = DamageCalculator.calculateHealthDamage(
    [makeAttack(10, AttributeType.DARK)],
    [makeDefense(5, AttributeType.NONE)]
  );
  assertEqual(res.damage, 5, 'DARK vs NONE should be partially blocked');

  // 6) Multiple attacks with different attrs
  res = DamageCalculator.calculateHealthDamage(
    [makeAttack(5, AttributeType.FIRE), makeAttack(4, AttributeType.WATER)],
    [makeDefense(3, AttributeType.WATER), makeDefense(4, AttributeType.FIRE)]
  );
  // FIRE5 blocked by WATER3 -> 2 dmg; WATER4 blocked by FIRE4 -> 0 dmg => total 2
  assertEqual(res.damage, 2, 'Mixed attributes should be resolved per rules');

  if (process.exitCode === 1) {
    console.error('Some tests failed');
    process.exit(1);
  } else {
    console.log('All tests passed');
  }
}

runTests();
