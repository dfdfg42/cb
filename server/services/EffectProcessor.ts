import { Card, CardEffect } from '../types';

/**
 * Card effect processor
 * Handles special card effects (reflect, bounce, debuffs, etc.)
 */
export class EffectProcessor {
    /**
     * Check if cards contain special defense effect (reflect or bounce)
     */
    findSpecialDefenseEffect(cards: Card[]): { type: 'reflect' | 'bounce'; card: Card } | null {
        for (const card of cards) {
            if (!card?.effect) continue;
            
            if (card.effect === 'reflect') {
                return { type: 'reflect', card };
            }
            
            if (card.effect === 'bounce') {
                return { type: 'bounce', card };
            }
        }
        
        return null;
    }

    /**
     * Extract debuffs from attacker's cards (excluding reflect/bounce)
     */
    extractDebuffs(cards: Card[]): string[] {
        const debuffs: string[] = [];
        
        for (const card of cards) {
            if (!card?.effect) continue;
            
            const effect = String(card.effect);
            
            // Skip special defense effects
            if (effect === 'reflect' || effect === 'bounce') continue;
            
            // Skip non-debuff effects
            if (effect === 'heal' || effect === 'none') continue;
            
            debuffs.push(effect);
        }
        
        return debuffs;
    }

    /**
     * Apply debuffs to target (no duplicates)
     */
    applyDebuffs(
        currentDebuffs: string[] | undefined,
        newDebuffs: string[]
    ): { debuffs: string[]; applied: string[] } {
        const current = currentDebuffs || [];
        const applied: string[] = [];
        
        for (const debuff of newDebuffs) {
            if (!current.includes(debuff)) {
                current.push(debuff);
                applied.push(debuff);
            }
        }
        
        return { debuffs: current, applied };
    }

    /**
     * Check if effect is a special defense effect
     */
    isSpecialDefenseEffect(effect: CardEffect | undefined): boolean {
        return effect === 'reflect' || effect === 'bounce';
    }
}
