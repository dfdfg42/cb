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

    public showSummary(attackerName: string, defenderName: string, cards: any[], damage: number, debuffs?: string[]): void {
        if (this.summaryPlayersEl) this.summaryPlayersEl.textContent = `${attackerName} → ${defenderName}`;
        if (this.summaryCardsEl) {
            if (!cards || cards.length === 0) {
                this.summaryCardsEl.textContent = '-';
            } else {
                this.summaryCardsEl.textContent = cards.map((c: any) => c.name).join(', ');
            }
        }
        if (this.summaryDamageEl) this.summaryDamageEl.textContent = String(damage || 0);
        if (this.summaryDebuffsEl) this.summaryDebuffsEl.textContent = (debuffs && debuffs.length > 0) ? debuffs.join(', ') : '-';
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
