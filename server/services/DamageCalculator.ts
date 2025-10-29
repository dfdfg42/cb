import { Card } from '../types';

/**
 * Damage calculation service
 * Handles all damage, heal, and cost calculations from cards
 */
export class DamageCalculator {
    /**
     * Calculate total costs (mana) from cards
     */
    calculateTotalCost(cards: Card[]): number {
        let totalCost = 0;
        
        for (const card of cards) {
            if (!card) continue;
            if (typeof card.cost === 'number') totalCost += card.cost;
            if (typeof card.mentalCost === 'number') totalCost += card.mentalCost;
        }
        
        return totalCost;
    }

    /**
     * Calculate damage, mental damage, and heal from cards
     */
    calculateDamageFromCards(cards: Card[]): {
        damage: number;
        mentalDamage: number;
        heal: number;
    } {
        let damage = 0;
        let mentalDamage = 0;
        let heal = 0;

        for (const card of cards) {
            if (!card) continue;

            // Heal cards
            if (card.effect && String(card.effect).toLowerCase() === 'heal') {
                heal += this.extractHealAmount(card);
                continue; // Don't add to damage
            }

            // Health damage
            if (typeof card.healthDamage === 'number') {
                damage += card.healthDamage;
            } else if (typeof card.damage === 'number') {
                damage += card.damage;
            } else if (typeof card.phys_atk === 'number') {
                damage += card.phys_atk;
            }

            // Mental damage
            if (typeof card.mentalDamage === 'number') {
                mentalDamage += card.mentalDamage;
            } else if (typeof card.mental_atk === 'number') {
                mentalDamage += card.mental_atk;
            }
        }

        return { damage, mentalDamage, heal };
    }

    /**
     * Calculate defense value from cards
     */
    calculateDefenseValue(cards: Card[]): number {
        let defense = 0;
        
        for (const card of cards) {
            if (card && typeof card.defense === 'number') {
                defense += card.defense;
            }
        }
        
        return defense;
    }

    /**
     * Check if defense is effective against attack attribute
     * @returns true if defense should be applied
     */
    isDefenseEffective(attackAttribute: string | null, defenseCards: Card[]): boolean {
        if (!attackAttribute) return true;

        const attackNorm = this.normalizeAttribute(attackAttribute);
        const defenseAttrs = defenseCards
            .map(dc => this.normalizeAttribute(dc?.attribute))
            .filter(Boolean);

        // Dark can be blocked by any defense
        if (attackNorm === 'dark') return defenseAttrs.length > 0;
        
        // Light can only be blocked by light defense
        if (attackNorm === 'light') return defenseAttrs.includes('light');
        
        // Fire attack is blocked by water defense
        if (attackNorm === 'fire') return defenseAttrs.includes('water');
        
        // Water attack is blocked by fire defense
        if (attackNorm === 'water') return defenseAttrs.includes('fire');
        
        // Default: allow any defense if defender used at least one defense card
        return defenseAttrs.length > 0;
    }

    /**
     * Extract attack attribute from cards
     */
    extractAttackAttribute(cards: Card[]): string | null {
        for (const card of cards) {
            if (card?.attribute) {
                return card.attribute;
            }
        }
        return null;
    }

    /**
     * Apply final damage calculation (after defense)
     */
    applyDefenseReduction(damage: number, defense: number): number {
        return Math.max(0, damage - defense);
    }

    /**
     * Extract heal amount from heal card
     */
    private extractHealAmount(card: Card): number {
        // Prefer healthDamage field
        if (typeof card.healthDamage === 'number' && card.healthDamage > 0) {
            return card.healthDamage;
        }
        
        // Fallback to damage field
        if (typeof card.damage === 'number' && card.damage > 0) {
            return card.damage;
        }
        
        // Parse from description
        if (card.description && typeof card.description === 'string') {
            const match = card.description.match(/(\d+)/);
            if (match) return parseInt(match[1], 10);
        }
        
        return 0;
    }

    /**
     * Normalize attribute string
     */
    private normalizeAttribute(attr: string | undefined | null): string {
        if (!attr) return 'none';
        
        const s = String(attr).toLowerCase();
        
        if (s === '화염' || s === 'fire' || s === 'flame') return 'fire';
        if (s === '물' || s === 'water' || s === 'aqua') return 'water';
        if (s === '빛' || s === 'light') return 'light';
        if (s === '암흑' || s === 'dark' || s === 'darkness') return 'dark';
        if (s === '없음' || s === 'none' || s === '') return 'none';
        
        return s;
    }
}
