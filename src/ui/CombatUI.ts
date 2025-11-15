import { Player } from '../types';

export class CombatUI {
    private attackerCardsContainer: HTMLElement;
    private defenderCardsContainer: HTMLElement;
    private summaryPlayersEl: HTMLElement | null = null;
    private summaryDamageEl: HTMLElement | null = null;
    private summaryDebuffsEl: HTMLElement | null = null;
    private pendingHealthDamage = 0;
    private pendingMentalDamage = 0;

    constructor() {
        const attackerCards = document.getElementById('summary-attacker-cards');
        const defenderCards = document.getElementById('summary-defender-cards');

        if (!attackerCards || !defenderCards) {
            throw new Error('Combat UI containers not found');
        }

        this.attackerCardsContainer = attackerCards;
        this.defenderCardsContainer = defenderCards;

        // summary elements (optional)
        this.summaryPlayersEl = document.getElementById('summary-players');
        this.summaryDamageEl = document.getElementById('summary-damage');
        this.summaryDebuffsEl = document.getElementById('summary-debuffs');
    }

    public showAttackCards(cards: any[]): void {
        this.attackerCardsContainer.innerHTML = '';
        
        const totals = this.estimateDamageTotals(cards);
        cards.forEach(card => {
            this.attackerCardsContainer.appendChild(this.createCardChip(card, 'attack'));
        });
        this.updateDamagePreview(totals.health, totals.mental);
    }

    public showDefenseCards(cards: any[]): void {
        this.defenderCardsContainer.innerHTML = '';
        
        let totalDefense = 0;
        cards.forEach(card => {
            this.defenderCardsContainer.appendChild(this.createCardChip(card, 'defense'));
            totalDefense += Number(card?.defense || 0);
        });
        this.updateDefenseEstimate(totalDefense);
    }

    public clearCombat(): void {
        this.attackerCardsContainer.innerHTML = '';
        this.defenderCardsContainer.innerHTML = '';
        if (this.summaryPlayersEl) this.summaryPlayersEl.textContent = '- → -';
        if (this.summaryDamageEl) this.summaryDamageEl.textContent = '0';
        if (this.summaryDebuffsEl) this.summaryDebuffsEl.textContent = '-';
        this.pendingHealthDamage = 0;
        this.pendingMentalDamage = 0;
        this.updateDamagePreview(0, 0);
    }

    public showSummary(attackerName: string, defenderName: string, cards: any[], damage: number, debuffs?: string[], chainSource?: string): void {
        if (this.summaryPlayersEl) this.summaryPlayersEl.textContent = `${attackerName} → ${defenderName}`;
        if (cards && cards.length > 0) {
            this.showAttackCards(cards);
        } else if (this.summaryDamageEl) {
            this.summaryDamageEl.textContent = '0';
        }
        if (this.summaryDamageEl) this.summaryDamageEl.textContent = String(damage || 0);

        // Show chainSource (reflect/bounce) prominently if present, else show debuffs
        if (this.summaryDebuffsEl) {
            if (chainSource) {
                this.summaryDebuffsEl.textContent = chainSource === 'reflect' ? '되받아치기(반사)' : chainSource === 'bounce' ? '튕기기(반사)' : chainSource;
            } else {
                this.summaryDebuffsEl.textContent = (debuffs && debuffs.length > 0) ? debuffs.join(', ') : '-';
            }
        }
    }

    // Show a detailed final summary based on the resolved payload from server
    public showFinalSummary(resolved: any): void {
        if (!resolved) return;
        const attackerName = resolved.attackerName || '-';
        const defenderName = resolved.targetName || '-';
        const cards = resolved.cardsUsed || [];
        const defenseCards = resolved.defenseCards || [];
        const damage = resolved.damageApplied || 0;
        const mentalDamage = resolved.mentalDamageApplied || 0;
        const heal = resolved.healApplied || 0;
        const isReflect = Boolean(resolved.isReflected);
        const isBounce = Boolean(resolved.isBounced);
        const originalHealthDamage = resolved.originalDamage ?? damage;
        const originalMentalDamage = resolved.originalMentalDamage ?? mentalDamage;

        if (this.summaryPlayersEl) {
            if (isReflect) {
                this.summaryPlayersEl.textContent = `${defenderName} ↺ ${attackerName}`;
            } else if (isBounce && resolved?.redirectTargetName) {
                this.summaryPlayersEl.textContent = `${defenderName} 🌀 ${resolved.redirectTargetName}`;
            } else {
                this.summaryPlayersEl.textContent = `${attackerName} → ${defenderName}`;
            }
        }

        this.showAttackCards(cards || []);
        this.showDefenseCards(defenseCards || []);

        if (this.summaryDamageEl) {
            if (isReflect) {
                let dmgText = `반사: ${originalHealthDamage} 체력`;
                if (originalMentalDamage > 0) {
                    dmgText += ` • ${originalMentalDamage} 정신`;
                }
                this.summaryDamageEl.textContent = dmgText;
            } else if (isBounce) {
                let dmgText = `튕김: ${originalHealthDamage} 체력`;
                if (originalMentalDamage > 0) {
                    dmgText += ` • ${originalMentalDamage} 정신`;
                }
                this.summaryDamageEl.textContent = dmgText;
            } else {
                let dmgText = `${damage} 체력 데미지`;
                if (mentalDamage > 0) dmgText += ` • ${mentalDamage} 정신 데미지`;
                if (heal > 0) dmgText += ` • +${heal} HP 회복`;
                this.summaryDamageEl.textContent = dmgText;
            }
        }

        // show debuffs / special tags
        const tags: string[] = [];
        if (defenseCards && defenseCards.some((d: any) => d && d.effect === 'reflect')) tags.push('되받아치기(반사)');
        if (defenseCards && defenseCards.some((d: any) => d && d.effect === 'bounce')) tags.push('튕기기(반사)');
        if (resolved.appliedDebuffs && resolved.appliedDebuffs.length > 0) tags.push(...resolved.appliedDebuffs);

        if (this.summaryDebuffsEl) this.summaryDebuffsEl.textContent = tags.length > 0 ? tags.join(', ') : '-';

        // visual popups for damage/heal
        try {
            const targetPlayer = null as any; // caller can still call showDamageAnimation with real player object if desired
            if (heal > 0) this.showHealAnimation(targetPlayer, heal);
            if (damage > 0) this.showDamageAnimation(targetPlayer, damage);
            if (mentalDamage > 0) this.showMentalDamageAnimation(targetPlayer, mentalDamage);
        } catch (e) {
            // ignore animation errors
        }

        this.setIncomingDamage(0, 0, false);
    }

    private createCardChip(card: any, fallbackVariant: 'attack' | 'defense'): HTMLElement {
        const cardEl = document.createElement('div');
        const normalizedType = (card?.type || '').toLowerCase();
        let variant: string = fallbackVariant;
        if (normalizedType.includes('defense')) {
            variant = 'defense';
        } else if (normalizedType.includes('magic')) {
            variant = 'magic';
        } else if (normalizedType.includes('field')) {
            variant = 'field';
        } else if (normalizedType.includes('attack')) {
            variant = 'attack';
        }

        cardEl.className = `summary-card-chip ${variant}`;
        cardEl.textContent = card?.name || '카드';
        cardEl.title = card?.description || '';
        return cardEl;
    }

    public setIncomingDamage(healthDamage: number, mentalDamage: number = 0, updateDisplay: boolean = true): void {
        this.pendingHealthDamage = Math.max(0, Math.floor(healthDamage || 0));
        this.pendingMentalDamage = Math.max(0, Math.floor(mentalDamage || 0));
        if (updateDisplay) {
            this.updateDefenseEstimate(0);
        }
    }

    public estimateDamageTotals(cards: any[]): { health: number; mental: number } {
        return cards.reduce(
            (acc, card) => {
                const dmg = this.extractDamage(card);
                acc.health += dmg.health;
                acc.mental += dmg.mental;
                return acc;
            },
            { health: 0, mental: 0 }
        );
    }

    private extractDamage(card: any): { health: number; mental: number } {
        const health = Number(
            card?.healthDamage ??
            card?.phys_atk ??
            card?.damage ??
            0
        );
        const mental = Number(
            card?.mentalDamage ??
            card?.mind_atk ??
            card?.mental ??
            0
        );
        return {
            health: Number.isFinite(health) ? health : 0,
            mental: Number.isFinite(mental) ? mental : 0
        };
    }

    private updateDamagePreview(health: number, mental: number): void {
        if (!this.summaryDamageEl) return;
        this.summaryDamageEl.textContent = this.formatDamageText(health, mental);
    }

    private updateDefenseEstimate(totalDefense: number): void {
        if (!this.summaryDamageEl) return;
        if (this.pendingHealthDamage === 0 && this.pendingMentalDamage === 0 && totalDefense === 0) {
            this.summaryDamageEl.textContent = '0';
            return;
        }
        const remainingHealth = Math.max(0, this.pendingHealthDamage - totalDefense);
        const parts: string[] = [];
        parts.push(`체력 ${remainingHealth}`);
        if (this.pendingMentalDamage > 0) {
            parts.push(`정신 ${this.pendingMentalDamage}`);
        }
        let text = `예상 피해: ${parts.join(' / ')}`;
        if (totalDefense > 0) {
            text += ` (방어력 ${totalDefense})`;
        }
        this.summaryDamageEl.textContent = text;
    }

    private formatDamageText(health: number, mental: number): string {
        const segments: string[] = [];
        segments.push(`체력 ${health}`);
        if (mental > 0) {
            segments.push(`정신 ${mental}`);
        }
        if (segments.length === 0) {
            return '0';
        }
        return segments.join(' / ');
    }

    public showDamageAnimation(_targetPlayer: Player, damage: number): void {
        if (damage <= 0) return;

        const damageText = document.createElement('div');
        damageText.className = 'damage-popup';
        damageText.textContent = `-${damage}`;
        damageText.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            font-size: 48px;
            font-weight: bold;
            color: #e74c3c;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.8);
            z-index: 9999;
            pointer-events: none;
            animation: damageFloat 1s ease-out forwards;
        `;

        document.body.appendChild(damageText);

        setTimeout(() => {
            damageText.remove();
        }, 1000);
    }

    public showMentalDamageAnimation(_targetPlayer: Player, damage: number): void {
        if (damage <= 0) return;

        const mentalText = document.createElement('div');
        mentalText.className = 'damage-popup';
        mentalText.textContent = `-${damage} MP`;
        mentalText.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            font-size: 42px;
            font-weight: bold;
            color: #3498db;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.8);
            z-index: 9999;
            pointer-events: none;
            animation: damageFloat 1s ease-out forwards;
        `;

        document.body.appendChild(mentalText);

        setTimeout(() => {
            mentalText.remove();
        }, 1000);
    }

    public showHealAnimation(_targetPlayer: Player, amount: number): void {
        const healText = document.createElement('div');
        healText.className = 'heal-popup';
        healText.textContent = `+${amount}`;
        healText.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            font-size: 48px;
            font-weight: bold;
            color: #2ecc71;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.8);
            z-index: 9999;
            pointer-events: none;
            animation: healFloat 1s ease-out forwards;
        `;

        document.body.appendChild(healText);

        setTimeout(() => {
            healText.remove();
        }, 1000);
    }
}
