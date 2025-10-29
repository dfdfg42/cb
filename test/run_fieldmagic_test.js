const assert = require('assert');
// require the compiled FieldMagicService (compiled to commonjs in .ts_tmp)
const FieldMagicService = require('../.ts_tmp/game/FieldMagicService.js').FieldMagicService;

function makePlayer(id, name) {
  return {
    id,
    name,
    health: 100,
    maxHealth: 100,
    mentalPower: 50,
    maxMentalPower: 50,
    cards: [],
    isAlive: true,
    isReady: true,
    debuffs: []
  };
}

function run() {
  console.log('Running JS runner for FieldMagicService (using compiled CommonJS module)...');

  // Test 화염의 대지
  {
    const p1 = makePlayer('p1', 'Alice');
    const p2 = makePlayer('p2', 'Bob');
    p1.health = 90;
    const session = {
      id: 's1',
      type: 'normal',
      players: [p1, p2],
      currentTurn: 1,
      currentPlayerId: p1.id,
      attackCards: [],
      defenseCards: [],
      fieldMagic: FieldMagicService.createFieldMagic('fm1', '화염의 대지', p1.id, 2),
      state: 'playing',
      deck: []
    };

    FieldMagicService.applyAndTick(session);
    assert.strictEqual(session.players.find(p => p.id === p2.id).health, 95, 'Bob should take 5 damage');
    if (!session.fieldMagic) throw new Error('fieldMagic unexpectedly undefined after first tick');

    FieldMagicService.applyAndTick(session);
    assert.strictEqual(session.fieldMagic, undefined, 'fieldMagic should be removed after duration ends');
  }

  // Test 치유의 성역
  {
    const p1 = makePlayer('p1', 'Alice');
    p1.health = 85;
    const session = {
      id: 's2',
      type: 'normal',
      players: [p1],
      currentTurn: 1,
      currentPlayerId: p1.id,
      attackCards: [],
      defenseCards: [],
      fieldMagic: FieldMagicService.createFieldMagic('fm2', '치유의 성역', p1.id, 1),
      state: 'playing',
      deck: []
    };

    FieldMagicService.applyAndTick(session);
    assert.strictEqual(session.players[0].health, 95, 'Caster should heal 10 HP');
    assert.strictEqual(session.fieldMagic, undefined, 'fieldMagic should be removed after single tick');
  }

  // Test 마력의 폭풍
  {
    const p1 = makePlayer('p1', 'Alice');
    p1.mentalPower = 48;
    const session = {
      id: 's3',
      type: 'normal',
      players: [p1],
      currentTurn: 1,
      currentPlayerId: p1.id,
      attackCards: [],
      defenseCards: [],
      fieldMagic: FieldMagicService.createFieldMagic('fm3', '마력의 폭풍', p1.id, 1),
      state: 'playing',
      deck: []
    };

    FieldMagicService.applyAndTick(session);
    assert.strictEqual(session.players[0].mentalPower, 50, 'MP should cap at max (50)');
    assert.strictEqual(session.fieldMagic, undefined);
  }

  console.log('All compiled FieldMagicService tests passed.');
}

try {
  run();
  process.exit(0);
} catch (e) {
  console.error('Test failed:', e);
  process.exit(1);
}
