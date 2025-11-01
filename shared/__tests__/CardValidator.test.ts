import { describe, it, expect } from 'vitest';
import { CardValidator } from '../validators/CardValidator';

describe('CardValidator', () => {
  describe('validateCards', () => {
    it('should reject empty card array', () => {
      const result = CardValidator.validateCards([], 100);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('카드를 선택해주세요!');
    });

    it('should validate field magic card with sufficient mental power', () => {
      const cards = [
        {
          id: '1',
          name: '화염의 대지',
          type: 'FIELD_MAGIC',
          mentalCost: 30,
          plusLevel: 0
        }
      ];
      const result = CardValidator.validateCards(cards, 50);
      expect(result.valid).toBe(true);
    });

    it('should reject field magic with insufficient mental power', () => {
      const cards = [
        {
          id: '1',
          name: '화염의 대지',
          type: 'FIELD_MAGIC',
          mentalCost: 30,
          plusLevel: 0
        }
      ];
      const result = CardValidator.validateCards(cards, 20);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('정신력이 부족합니다!');
    });

    it('should reject field magic mixed with other cards', () => {
      const cards = [
        {
          id: '1',
          name: '화염의 대지',
          type: 'FIELD_MAGIC',
          mentalCost: 30,
          plusLevel: 0
        },
        {
          id: '2',
          name: '검격',
          type: 'ATTACK',
          mentalCost: 10,
          plusLevel: 0,
          healthDamage: 20
        }
      ];
      const result = CardValidator.validateCards(cards, 100);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('필드 마법은 단독으로만');
    });

    it('should reject multiple magic cards', () => {
      const cards = [
        {
          id: '1',
          name: '회복',
          type: 'MAGIC',
          mentalCost: 10,
          plusLevel: 0
        },
        {
          id: '2',
          name: '정신력 복원',
          type: 'MAGIC',
          mentalCost: 15,
          plusLevel: 0
        }
      ];
      const result = CardValidator.validateCards(cards, 100);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('마법 카드는');
    });

    it('should validate cards with sufficient mental power', () => {
      const cards = [
        {
          id: '1',
          name: '검격',
          type: 'ATTACK',
          mentalCost: 10,
          plusLevel: 0,
          healthDamage: 20
        }
      ];
      const result = CardValidator.validateCards(cards, 50);
      expect(result.valid).toBe(true);
    });

    it('should reject cards with insufficient mental power', () => {
      const cards = [
        {
          id: '1',
          name: '검격',
          type: 'ATTACK',
          mentalCost: 10,
          plusLevel: 0,
          healthDamage: 20
        },
        {
          id: '2',
          name: '회복',
          type: 'MAGIC',
          mentalCost: 15,
          plusLevel: 0
        }
      ];
      const result = CardValidator.validateCards(cards, 20);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('정신력이 부족합니다!');
    });
  });

  describe('validatePlusCards', () => {
    it('should accept valid plus cards', () => {
      const cards = [
        {
          id: '1',
          name: '+검격',
          type: 'ATTACK',
          mentalCost: 10,
          plusLevel: 1,
          healthDamage: 20
        },
        {
          id: '2',
          name: '+검격',
          type: 'ATTACK',
          mentalCost: 10,
          plusLevel: 1,
          healthDamage: 20
        }
      ];
      const result = CardValidator.validatePlusCards(cards);
      expect(result.valid).toBe(true);
    });

    it('should reject different plus cards combined', () => {
      const cards = [
        {
          id: '1',
          name: '+검격',
          type: 'ATTACK',
          mentalCost: 10,
          plusLevel: 1,
          healthDamage: 20
        },
        {
          id: '2',
          name: '+화염구',
          type: 'ATTACK',
          mentalCost: 15,
          plusLevel: 1,
          healthDamage: 25
        }
      ];
      const result = CardValidator.validatePlusCards(cards);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('같은 종류만');
    });

    it('should reject exceeding max plus card count', () => {
      const cards = [
        {
          id: '1',
          name: '+검격',
          type: 'ATTACK',
          mentalCost: 10,
          plusLevel: 1, // Max 2 cards (plusLevel + 1)
          healthDamage: 20
        },
        {
          id: '2',
          name: '+검격',
          type: 'ATTACK',
          mentalCost: 10,
          plusLevel: 1,
          healthDamage: 20
        },
        {
          id: '3',
          name: '+검격',
          type: 'ATTACK',
          mentalCost: 10,
          plusLevel: 1,
          healthDamage: 20
        }
      ];
      const result = CardValidator.validatePlusCards(cards);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('최대');
    });
  });

  describe('validateMentalCost', () => {
    it('should calculate total mental cost correctly', () => {
      const cards = [
        { id: '1', name: 'Card1', type: 'ATTACK', mentalCost: 10, plusLevel: 0 },
        { id: '2', name: 'Card2', type: 'MAGIC', mentalCost: 15, plusLevel: 0 }
      ];
      const result = CardValidator.validateMentalCost(cards, 50);
      expect(result.valid).toBe(true);
    });

    it('should reject if mental cost exceeds available', () => {
      const cards = [
        { id: '1', name: 'Card1', type: 'ATTACK', mentalCost: 30, plusLevel: 0 },
        { id: '2', name: 'Card2', type: 'MAGIC', mentalCost: 25, plusLevel: 0 }
      ];
      const result = CardValidator.validateMentalCost(cards, 50);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('정신력이 부족합니다!');
    });
  });
});
