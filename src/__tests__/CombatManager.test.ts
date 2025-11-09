import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CombatManager } from '../game/CombatManager';
import { IUIManager } from '../ui/IUIManager';
import { Player, Card, CardType, CardEffect } from '../types';

describe('CombatManager', () => {
  let mockUIManager: IUIManager;
  let combatManager: CombatManager;

  beforeEach(() => {
    // Mock UIManager
    mockUIManager = {
      showScreen: vi.fn(),
      getCurrentScreen: vi.fn(),
      showModal: vi.fn(),
      hideModal: vi.fn(),
      addLogMessage: vi.fn(),
      clearLog: vi.fn(),
      setUserName: vi.fn(),
      updateTurnNumber: vi.fn(),
      updateFieldMagic: vi.fn(),
      showCombatNames: vi.fn(),
      clearCombatNames: vi.fn(),
      setButtonEnabled: vi.fn(),
      showAlert: vi.fn()
    };

    combatManager = new CombatManager(mockUIManager);
  });

  describe('selectAttackCards', () => {
    it('should reject empty cards', () => {
      const player: Player = {
        id: '1',
        name: 'Player1',
        health: 100,
        maxHealth: 100,
        mentalPower: 100,
        maxMentalPower: 100,
        cards: [],
        isAlive: true,
        isReady: true,
        debuffs: []
      };

      const result = combatManager.selectAttackCards([], player);
      expect(result).toBe(false);
      expect(mockUIManager.showAlert).toHaveBeenCalledWith('카드를 선택해주세요!');
    });

    it('should validate field magic card', () => {
      const player: Player = {
        id: '1',
        name: 'Player1',
        health: 100,
        maxHealth: 100,
        mentalPower: 50,
        maxMentalPower: 100,
        cards: [],
        isAlive: true,
        isReady: true,
        debuffs: []
      };

      const cards: Card[] = [{
        id: '1',
        name: '화염의 대지',
        type: CardType.FIELD_MAGIC,
        mentalCost: 30,
        plusLevel: 0,
        defense: 0,
        healthDamage: 0,
        mentalDamage: 0,
        effect: CardEffect.NONE,
        description: '필드 마법'
      }];

      const result = combatManager.selectAttackCards(cards, player);
      expect(result).toBe(true);
      expect(mockUIManager.showAlert).not.toHaveBeenCalled();
    });

    it('should reject insufficient mental power', () => {
      const player: Player = {
        id: '1',
        name: 'Player1',
        health: 100,
        maxHealth: 100,
        mentalPower: 10,
        maxMentalPower: 100,
        cards: [],
        isAlive: true,
        isReady: true,
        debuffs: []
      };

      const cards: Card[] = [{
        id: '1',
        name: '화염의 대지',
        type: CardType.FIELD_MAGIC,
        mentalCost: 30,
        plusLevel: 0,
        defense: 0,
        healthDamage: 0,
        mentalDamage: 0,
        effect: CardEffect.NONE,
        description: ''
      }];

      const result = combatManager.selectAttackCards(cards, player);
      expect(result).toBe(false);
      expect(mockUIManager.showAlert).toHaveBeenCalledWith('정신력이 부족합니다!');
    });

    it('should allow mixing different plus cards within limits', () => {
      const player: Player = {
        id: '1',
        name: 'Player1',
        health: 100,
        maxHealth: 100,
        mentalPower: 100,
        maxMentalPower: 100,
        cards: [],
        isAlive: true,
        isReady: true,
        debuffs: []
      };

      const cards: Card[] = [
        {
          id: 'atk_plus_1',
          name: '+검격',
          type: CardType.ATTACK,
          mentalCost: 0,
          plusLevel: 1,
          defense: 0,
          healthDamage: 5,
          mentalDamage: 0,
          effect: CardEffect.NONE,
          description: ''
        },
        {
          id: 'atk_plus_2',
          name: '+화염구',
          type: CardType.ATTACK,
          mentalCost: 0,
          plusLevel: 1,
          defense: 0,
          healthDamage: 6,
          mentalDamage: 0,
          effect: CardEffect.NONE,
          description: ''
        }
      ];

      const result = combatManager.selectAttackCards(cards, player);
      expect(result).toBe(true);
    });
  });

  describe('applyDamage', () => {
    it('should apply health damage correctly', () => {
      const player: Player = {
        id: '1',
        name: 'Player1',
        health: 100,
        maxHealth: 100,
        mentalPower: 100,
        maxMentalPower: 100,
        cards: [],
        isAlive: true,
        isReady: true,
        debuffs: []
      };

      combatManager.applyDamage(player, 30, 0);
      
      expect(player.health).toBe(70);
      expect(mockUIManager.addLogMessage).toHaveBeenCalledWith(
        'Player1이(가) 30의 체력 데미지를 받았습니다!'
      );
    });

    it('should apply mental damage correctly', () => {
      const player: Player = {
        id: '1',
        name: 'Player1',
        health: 100,
        maxHealth: 100,
        mentalPower: 100,
        maxMentalPower: 100,
        cards: [],
        isAlive: true,
        isReady: true,
        debuffs: []
      };

      combatManager.applyDamage(player, 0, 40);
      
      expect(player.mentalPower).toBe(60);
      expect(mockUIManager.addLogMessage).toHaveBeenCalledWith(
        'Player1이(가) 40의 정신력 데미지를 받았습니다!'
      );
    });

    it('should mark player as dead when health reaches 0', () => {
      const player: Player = {
        id: '1',
        name: 'Player1',
        health: 20,
        maxHealth: 100,
        mentalPower: 100,
        maxMentalPower: 100,
        cards: [],
        isAlive: true,
        isReady: true,
        debuffs: []
      };

      combatManager.applyDamage(player, 20, 0);
      
      expect(player.health).toBe(0);
      expect(player.isAlive).toBe(false);
      expect(mockUIManager.addLogMessage).toHaveBeenCalledWith(
        '💀 Player1이(가) 쓰러졌습니다!'
      );
    });

    it('should not reduce health below 0', () => {
      const player: Player = {
        id: '1',
        name: 'Player1',
        health: 20,
        maxHealth: 100,
        mentalPower: 100,
        maxMentalPower: 100,
        cards: [],
        isAlive: true,
        isReady: true,
        debuffs: []
      };

      combatManager.applyDamage(player, 50, 0);
      
      expect(player.health).toBe(0);
    });
  });

  describe('selectDefenseCards', () => {
    it('should accept valid defense cards', () => {
      const cards: Card[] = [{
        id: '1',
        name: '방패',
        type: CardType.DEFENSE,
        mentalCost: 5,
        plusLevel: 0,
        defense: 10,
        healthDamage: 0,
        mentalDamage: 0,
        effect: CardEffect.NONE,
        description: ''
      }];

      const result = combatManager.selectDefenseCards(cards);
      expect(result).toBe(true);
    });

    it('should reject attack cards in defense', () => {
      const cards: Card[] = [{
        id: '1',
        name: '검격',
        type: CardType.ATTACK,
        mentalCost: 10,
        plusLevel: 0,
        defense: 0,
        healthDamage: 20,
        mentalDamage: 0,
        effect: CardEffect.NONE,
        description: ''
      }];

      const result = combatManager.selectDefenseCards(cards);
      expect(result).toBe(false);
      expect(mockUIManager.showAlert).toHaveBeenCalledWith(
        '방어 카드 또는 마법 카드만 사용 가능합니다!'
      );
    });
  });
});
