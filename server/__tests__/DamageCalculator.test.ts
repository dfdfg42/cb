import { describe, it, expect } from 'vitest';
import { DamageCalculator } from '../services/DamageCalculator';

describe('DamageCalculator', () => {
  describe('calculateDamage', () => {
    it('should calculate basic attack damage', () => {
      const cards = [
        {
          id: '1',
          name: '검격',
          type: 'ATTACK',
          mentalCost: 10,
          healthDamage: 20,
          mentalDamage: 0,
          plusLevel: 0
        }
      ];

      const result = DamageCalculator.calculateDamage(cards, null);
      expect(result.healthDamage).toBe(20);
      expect(result.mentalDamage).toBe(0);
    });

    it('should calculate multiple cards damage', () => {
      const cards = [
        {
          id: '1',
          name: '+검격',
          type: 'ATTACK',
          mentalCost: 10,
          healthDamage: 20,
          mentalDamage: 0,
          plusLevel: 1
        },
        {
          id: '2',
          name: '+검격',
          type: 'ATTACK',
          mentalCost: 10,
          healthDamage: 20,
          mentalDamage: 0,
          plusLevel: 1
        }
      ];

      const result = DamageCalculator.calculateDamage(cards, null);
      expect(result.healthDamage).toBe(40);
    });

    it('should apply fire field magic bonus (+5 damage)', () => {
      const cards = [
        {
          id: '1',
          name: '검격',
          type: 'ATTACK',
          mentalCost: 10,
          healthDamage: 20,
          mentalDamage: 0,
          plusLevel: 0
        }
      ];

      const fieldMagic = {
        name: '화염의 대지',
        casterId: 'attacker1',
        duration: 3
      };

      const result = DamageCalculator.calculateDamage(cards, fieldMagic, 'attacker1');
      expect(result.healthDamage).toBe(25); // 20 + 5
    });

    it('should apply ice field magic penalty (-3 damage for non-caster)', () => {
      const cards = [
        {
          id: '1',
          name: '검격',
          type: 'ATTACK',
          mentalCost: 10,
          healthDamage: 20,
          mentalDamage: 0,
          plusLevel: 0
        }
      ];

      const fieldMagic = {
        name: '얼음 왕국',
        casterId: 'defender1',
        duration: 3
      };

      const result = DamageCalculator.calculateDamage(cards, fieldMagic, 'attacker1');
      expect(result.healthDamage).toBe(17); // 20 - 3
    });

    it('should not reduce damage below 0', () => {
      const cards = [
        {
          id: '1',
          name: '약한 공격',
          type: 'ATTACK',
          mentalCost: 5,
          healthDamage: 2,
          mentalDamage: 0,
          plusLevel: 0
        }
      ];

      const fieldMagic = {
        name: '얼음 왕국',
        casterId: 'defender1',
        duration: 3
      };

      const result = DamageCalculator.calculateDamage(cards, fieldMagic, 'attacker1');
      expect(result.healthDamage).toBe(0); // Math.max(0, 2 - 3)
    });

    it('should calculate mental damage', () => {
      const cards = [
        {
          id: '1',
          name: '정신 공격',
          type: 'MAGIC',
          mentalCost: 15,
          healthDamage: 0,
          mentalDamage: 30,
          plusLevel: 0
        }
      ];

      const result = DamageCalculator.calculateDamage(cards, null);
      expect(result.healthDamage).toBe(0);
      expect(result.mentalDamage).toBe(30);
    });
  });

  describe('calculateDefense', () => {
    it('should calculate basic defense', () => {
      const cards = [
        {
          id: '1',
          name: '방패',
          type: 'DEFENSE',
          mentalCost: 5,
          defense: 15,
          plusLevel: 0
        }
      ];

      const result = DamageCalculator.calculateDefense(cards, null);
      expect(result.defense).toBe(15);
      expect(result.hasReflect).toBe(false);
      expect(result.hasBounce).toBe(false);
    });

    it('should detect reflect effect', () => {
      const cards = [
        {
          id: '1',
          name: '되받아치기',
          type: 'MAGIC',
          mentalCost: 20,
          defense: 0,
          effect: 'REFLECT',
          plusLevel: 0
        }
      ];

      const result = DamageCalculator.calculateDefense(cards, null);
      expect(result.defense).toBe(0);
      expect(result.hasReflect).toBe(true);
      expect(result.hasBounce).toBe(false);
    });

    it('should detect bounce effect', () => {
      const cards = [
        {
          id: '1',
          name: '튕기기',
          type: 'MAGIC',
          mentalCost: 15,
          defense: 0,
          effect: 'BOUNCE',
          plusLevel: 0
        }
      ];

      const result = DamageCalculator.calculateDefense(cards, null);
      expect(result.defense).toBe(0);
      expect(result.hasReflect).toBe(false);
      expect(result.hasBounce).toBe(true);
    });

    it('should apply ice field magic bonus (+5 defense for caster)', () => {
      const cards = [
        {
          id: '1',
          name: '방패',
          type: 'DEFENSE',
          mentalCost: 5,
          defense: 10,
          plusLevel: 0
        }
      ];

      const fieldMagic = {
        name: '얼음 왕국',
        casterId: 'defender1',
        duration: 3
      };

      const result = DamageCalculator.calculateDefense(cards, fieldMagic, 'defender1');
      expect(result.defense).toBe(15); // 10 + 5
    });

    it('should combine multiple defense cards', () => {
      const cards = [
        {
          id: '1',
          name: '방패',
          type: 'DEFENSE',
          mentalCost: 5,
          defense: 10,
          plusLevel: 0
        },
        {
          id: '2',
          name: '방어 마법',
          type: 'MAGIC',
          mentalCost: 8,
          defense: 8,
          plusLevel: 0
        }
      ];

      const result = DamageCalculator.calculateDefense(cards, null);
      expect(result.defense).toBe(18);
    });
  });
});
