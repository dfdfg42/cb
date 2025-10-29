import assert from 'assert';
import { FieldMagicService } from '../src/game/FieldMagicService';
import { GameSession, Player } from '../src/types';

function makePlayer(id: string, name: string): Player {
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

function runTests() {
  console.log('Running FieldMagicService tests...');

  // Test 1: 화염의 대지 - 다른 플레이어에게 5 데미지
  {
    const p1 = makePlayer('p1', 'Alice');
    const p2 = makePlayer('p2', 'Bob');
    p1.health = 90; // caster lower hp to ensure not affected

    const session: GameSession = {
      id: 's1',
      type: 'normal' as any,
      players: [p1, p2],
      currentTurn: 1,
      currentPlayerId: p1.id,
      attackCards: [],
      defenseCards: [],
      fieldMagic: FieldMagicService.createFieldMagic('fm1', '화염의 대지', p1.id, 2),
      state: 'playing' as any,
      deck: []
    };

    FieldMagicService.applyAndTick(session);
    assert.strictEqual(session.players.find(p => p.id === p2.id)!.health, 95 - 0, 'Bob should take 5 damage (100 -> 95)');
    assert.strictEqual(session.fieldMagic!.duration, 1);

    // second tick -> duration becomes 0 and removed
    FieldMagicService.applyAndTick(session);
    assert.strictEqual(session.fieldMagic, undefined);
  }

  // Test 2: 치유의 성역 - 시전자 체력 회복, 최대치 제한
  {
    const p1 = makePlayer('p1', 'Alice');
    p1.health = 85;
    const session: GameSession = {
      id: 's2',
      type: 'normal' as any,
      players: [p1],
      currentTurn: 1,
      currentPlayerId: p1.id,
      attackCards: [],
      defenseCards: [],
      fieldMagic: FieldMagicService.createFieldMagic('fm2', '치유의 성역', p1.id, 1),
      state: 'playing' as any,
      deck: []
    };

    FieldMagicService.applyAndTick(session);
    assert.strictEqual(session.players[0].health, 95);
    assert.strictEqual(session.fieldMagic, undefined, 'duration 1 should remove field magic after apply');
  }

  // Test 3: 마력의 폭풍 - 시전자 정신력 회복, 최대치 제한
  {
    const p1 = makePlayer('p1', 'Alice');
    p1.mentalPower = 48;
    const session: GameSession = {
      id: 's3',
      type: 'normal' as any,
      players: [p1],
      currentTurn: 1,
      currentPlayerId: p1.id,
      attackCards: [],
      defenseCards: [],
      fieldMagic: FieldMagicService.createFieldMagic('fm3', '마력의 폭풍', p1.id, 1),
      state: 'playing' as any,
      deck: []
    };

    FieldMagicService.applyAndTick(session);
    assert.strictEqual(session.players[0].mentalPower, 50, 'mentalPower should cap at maxMentalPower (50)');
    assert.strictEqual(session.fieldMagic, undefined);
  }

  console.log('All FieldMagicService tests passed.');
}

try {
  runTests();
  process.exit(0);
} catch (err) {
  console.error('FieldMagicService tests failed:', err);
  process.exit(1);
}
