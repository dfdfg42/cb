import { Player } from '../types';

export class CombatUI {
    private attackerCardsContainer: HTMLElement;
    private defenderCardsContainer: HTMLElement;
    private summaryPlayersEl: HTMLElement | null = null;
    private summaryCardsEl: HTMLElement | null = null;
    private summaryDamageEl: HTMLElement | null = null;
    private summaryDebuffsEl: HTMLElement | null = null;

    constructor() {
        const attackerCards = document.getElementById('attacker-cards');
        const defenderCards = document.getElementById('defender-cards');

        if (!attackerCards || !defenderCards) {
            throw new Error('Combat UI containers not found');
        }

        this.attackerCardsContainer = attackerCards;
        this.defenderCardsContainer = defenderCards;

        // summary elements (optional)
        this.summaryPlayersEl = document.getElementById('summary-players');
        this.summaryCardsEl = document.getElementById('summary-cards');
        this.summaryDamageEl = document.getElementById('summary-damage');
        this.summaryDebuffsEl = document.getElementById('summary-debuffs');
    }

    public showAttackCards(cards: any[]): void {
        this.attackerCardsContainer.innerHTML = '';
        
        cards.forEach(card => {
            const cardEl = document.createElement('div');
            cardEl.className = 'combat-card-mini';
            cardEl.textContent = card.name;
            cardEl.title = `${card.healthDamage || 0}데미지`;
            this.attackerCardsContainer.appendChild(cardEl);
        });
    }

    public showDefenseCards(cards: any[]): void {
        this.defenderCardsContainer.innerHTML = '';
        
        cards.forEach(card => {
            const cardEl = document.createElement('div');
            cardEl.className = 'combat-card-mini defense';
            cardEl.textContent = card.name;
            cardEl.title = `${card.defense || 0}방어`;
            this.defenderCardsContainer.appendChild(cardEl);
        });
    }

    public clearCombat(): void {
        this.attackerCardsContainer.innerHTML = '';
        this.defenderCardsContainer.innerHTML = '';
        if (this.summaryPlayersEl) this.summaryPlayersEl.textContent = '- → -';
        if (this.summaryCardsEl) this.summaryCardsEl.textContent = '-';
        if (this.summaryDamageEl) this.summaryDamageEl.textContent = '0';
        if (this.summaryDebuffsEl) this.summaryDebuffsEl.textContent = '-';
    }

    public showSummary(attackerName: string, defenderName: string, cards: any[], damage: number, debuffs?: string[], chainSource?: string): void {
        if (this.summaryPlayersEl) this.summaryPlayersEl.textContent = `${attackerName} → ${defenderName}`;
        if (this.summaryCardsEl) {
            if (!cards || cards.length === 0) {
                this.summaryCardsEl.textContent = '-';
            } else {
                this.summaryCardsEl.textContent = cards.map((c: any) => c.name).join(', ');
            }
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

        if (this.summaryCardsEl) {
            const atkList = (cards && cards.length > 0) ? cards.map((c: any) => c.name).join(', ') : '-';
            const defList = (defenseCards && defenseCards.length > 0) ? defenseCards.map((c: any) => c.name).join(', ') : '-';
            this.summaryCardsEl.textContent = `공격: ${atkList} | 방어: ${defList}`;
        }

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
        } catch (e) {
            // ignore animation errors
        }
    }

    public showDamageAnimation(_targetPlayer: Player, damage: number): void {
        // 간단한 데미지 표시 (나중에 애니메이션 추가)
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
