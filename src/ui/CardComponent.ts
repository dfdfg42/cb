import { Card, CardType } from '../types';
import { soundManager } from '../audio/SoundManager';

export class CardComponent {
    private card: Card;
    private element: HTMLElement;
    private isSelected: boolean = false;
    private selectable: boolean = true;
    private onClickCallback?: (card: Card) => void;

    constructor(card: Card) {
        this.card = card;
        this.element = this.createCardElement();
    }

    private createCardElement(): HTMLElement {
        const cardDiv = document.createElement('div');
        cardDiv.className = `card ${this.card.type}`;
        cardDiv.setAttribute('data-card-id', this.card.id);

        // 카드 통계 정보 (왼쪽 상단)
        const statsDiv = document.createElement('div');
        statsDiv.className = 'card-stats';
        
        const stats: string[] = [];
        const prefix = this.card.plusLevel > 0 ? '+' : '';
        const showMagicDamageAsMental =
            this.card.type === CardType.MAGIC &&
            this.card.healthDamage > 0 &&
            this.card.mentalDamage === 0;

        if (showMagicDamageAsMental) {
            stats.push(`🧠${prefix}${this.card.healthDamage}`);
        } else if (this.card.healthDamage > 0) {
            // plusLevel이 있으면 공격력 앞에 + 표시
            stats.push(`⚔️${prefix}${this.card.healthDamage}`);
        }

        if (this.card.mentalDamage > 0) {
            stats.push(`🧠${prefix}${this.card.mentalDamage}`);
        }
        if (this.card.defense > 0) {
            stats.push(`🛡️${this.card.defense}`);
        }
        if (this.card.mentalCost > 0) {
            stats.push(`💧${this.card.mentalCost}`);
        }
        
        statsDiv.innerHTML = stats.join(' ');

        // 카드 이름
        const nameDiv = document.createElement('div');
        nameDiv.className = 'card-name';
        nameDiv.textContent = this.card.name;
    this.applyAttributeColor(nameDiv);

        // 카드 이미지 (임시)
        const imageDiv = document.createElement('div');
        imageDiv.className = 'card-image';
        imageDiv.innerHTML = this.getCardIcon();

        // 카드 조립
        cardDiv.appendChild(statsDiv);
        cardDiv.appendChild(imageDiv);
        cardDiv.appendChild(nameDiv);

    // 클릭 이벤트
    cardDiv.addEventListener('click', () => this.handleClick());
        
        // 길게 누르면 상세 정보 (모바일)
        let pressTimer: number;
        cardDiv.addEventListener('touchstart', () => {
            pressTimer = window.setTimeout(() => {
                this.showCardDetail();
            }, 500);
        });
        cardDiv.addEventListener('touchend', () => {
            clearTimeout(pressTimer);
        });
        
        // PC에서는 더블클릭으로 상세 정보
        cardDiv.addEventListener('dblclick', () => {
            this.showCardDetail();
        });

        return cardDiv;
    }

    private getCardIcon(): string {
        // 카드 타입별 아이콘
        const icons: Record<CardType, string> = {
            [CardType.ATTACK]: '⚔️',
            [CardType.DEFENSE]: '🛡️',
            [CardType.MAGIC]: '✨',
            [CardType.FIELD_MAGIC]: '🌟'
        };
        return `<div class="card-icon">${icons[this.card.type]}</div>`;
    }

    private handleClick(): void {
        if (!this.selectable) return; // 선택 불가 상태면 클릭 무시

        this.toggleSelect();
        soundManager.playCardSelect();
        if (this.onClickCallback) {
            this.onClickCallback(this.card);
        }
    }

    // UI 상에서 선택 가능 여부 설정 (방어 선택 모드 등에서 사용)
    public setSelectable(enabled: boolean): void {
        this.selectable = enabled;
        const el = this.getElement();
        if (enabled) {
            el.classList.remove('not-eligible');
            el.style.pointerEvents = 'auto';
            el.style.opacity = '1';
            el.style.filter = 'none';
            el.style.cursor = 'pointer';
        } else {
            el.classList.add('not-eligible');
            // visually and interactively mark as not selectable
            el.style.pointerEvents = 'none';
            el.style.opacity = '0.4';
            el.style.filter = 'grayscale(80%)';
            el.style.cursor = 'not-allowed';
        }
    }

    public toggleSelect(): void {
        this.isSelected = !this.isSelected;
        if (this.isSelected) {
            this.element.classList.add('selected');
        } else {
            this.element.classList.remove('selected');
        }
    }

    public select(): void {
        this.isSelected = true;
        this.element.classList.add('selected');
    }

    public deselect(): void {
        this.isSelected = false;
        this.element.classList.remove('selected');
    }

    public getSelected(): boolean {
        return this.isSelected;
    }

    public getCard(): Card {
        return this.card;
    }

    public getElement(): HTMLElement {
        return this.element;
    }

    public onClick(callback: (card: Card) => void): void {
        this.onClickCallback = callback;
    }

    private showCardDetail(): void {
        const modal = document.getElementById('card-detail-modal');
        if (!modal) return;

        const nameEl = modal.querySelector('.card-detail-name');
        const statsEl = modal.querySelector('.card-detail-stats');
        const descEl = modal.querySelector('.card-detail-description');
        const imageEl = modal.querySelector('.card-detail-image');

        if (nameEl instanceof HTMLElement) {
            nameEl.textContent = this.card.name;
            this.applyAttributeColor(nameEl);
        } else if (nameEl) {
            nameEl.textContent = this.card.name;
        }
        if (descEl) descEl.textContent = this.card.description;
        if (imageEl) imageEl.innerHTML = this.getCardIcon();
        
        if (statsEl) {
            const statsText: string[] = [];
            const showMagicDamageAsMental =
                this.card.type === CardType.MAGIC &&
                this.card.healthDamage > 0 &&
                this.card.mentalDamage === 0;

            if (showMagicDamageAsMental) {
                statsText.push(`정신 공격력: ${this.card.healthDamage}`);
            } else if (this.card.healthDamage > 0) {
                statsText.push(`체력 공격력: ${this.card.healthDamage}`);
            }
            if (this.card.mentalDamage > 0) {
                statsText.push(`정신 공격력: ${this.card.mentalDamage}`);
            }
            if (this.card.defense > 0) {
                statsText.push(`방어력: ${this.card.defense}`);
            }
            if (this.card.mentalCost > 0) {
                statsText.push(`정신력 소모: ${this.card.mentalCost}`);
            }
            if (this.card.plusLevel > 0) {
                statsText.push(`연속 사용: +${this.card.plusLevel} (최대 ${this.card.plusLevel + 1}장)`);
            }
            statsEl.innerHTML = statsText.join('<br>');
        }

        modal.classList.add('active');
    }

    public destroy(): void {
        this.element.remove();
    }

    private applyAttributeColor(target: HTMLElement): void {
        const attrClass = this.getAttributeClass(this.card.attribute);
        const classesToRemove = Array.from(target.classList).filter(cls => cls.startsWith('attr-'));
        classesToRemove.forEach(cls => target.classList.remove(cls));

        if (attrClass) {
            target.classList.add(attrClass);
        }
    }

    private getAttributeClass(attribute?: string | null): string | null {
        if (!attribute) {
            return null;
        }

        const normalized = this.normalizeAttribute(attribute);
        if (!normalized || normalized === 'none') {
            return null;
        }

        switch (normalized) {
            case 'fire':
                return 'attr-fire';
            case 'water':
                return 'attr-water';
            case 'light':
                return 'attr-light';
            case 'dark':
                return 'attr-dark';
            case 'wind':
                return 'attr-wind';
            case 'earth':
                return 'attr-earth';
            case 'ice':
                return 'attr-ice';
            case 'lightning':
                return 'attr-lightning';
            case 'poison':
                return 'attr-poison';
            default:
                return 'attr-generic';
        }
    }

    private normalizeAttribute(attribute?: string | null): string | null {
        if (!attribute) {
            return null;
        }

        const value = attribute.trim().toLowerCase();
        if (!value) {
            return null;
        }

        const mapping: Record<string, string> = {
            fire: 'fire',
            '화염': 'fire',
            '불': 'fire',
            '불꽃': 'fire',
            water: 'water',
            '물': 'water',
            '물속성': 'water',
            light: 'light',
            '빛': 'light',
            holy: 'light',
            '성속성': 'light',
            dark: 'dark',
            darkness: 'dark',
            shadow: 'dark',
            '암흑': 'dark',
            '어둠': 'dark',
            wind: 'wind',
            air: 'wind',
            '바람': 'wind',
            '풍': 'wind',
            earth: 'earth',
            ground: 'earth',
            stone: 'earth',
            '대지': 'earth',
            '땅': 'earth',
            ice: 'ice',
            frost: 'ice',
            '얼음': 'ice',
            '빙결': 'ice',
            lightning: 'lightning',
            thunder: 'lightning',
            electric: 'lightning',
            '전기': 'lightning',
            '번개': 'lightning',
            poison: 'poison',
            toxic: 'poison',
            venom: 'poison',
            '독': 'poison',
            none: 'none',
            '없음': 'none'
        };

        return mapping[value] ?? value;
    }
}

export class HandManager {
    private cards: CardComponent[] = [];
    private container: HTMLElement;
    // Allow multiple selection in UI; game rules will validate selections server-side or in GameManager.
    private maxSelection: number = 99;
    private onSelectionChange?: (selectedCards: Card[]) => void;

    constructor(containerId: string = 'hand-cards') {
        const container = document.getElementById(containerId);
        if (!container) {
            throw new Error(`Container ${containerId} not found`);
        }
        this.container = container;
    }

    public addCard(card: Card): void {
        const cardComponent = new CardComponent(card);
        
        cardComponent.onClick(() => {
            this.handleCardSelection(cardComponent);
        });

        this.cards.push(cardComponent);
        this.render();
        console.log(`[DEBUG][HandManager] addCard: ${card.name} (type=${card.type}) - total now ${this.cards.length}`);
    }

    public addCards(cards: Card[]): void {
        cards.forEach(card => this.addCard(card));
        console.log(`[DEBUG][HandManager] addCards called, added ${cards.length} cards`);
    }

    private handleCardSelection(_selectedCard: CardComponent): void {
        // reference maxSelection to avoid unused-field lint warning
        void this.maxSelection;
        // Toggle selection and notify. We intentionally avoid enforcing strict UI limits here so
        // server/game-manager rules can validate the combination (e.g., + cards, single-magic, etc.).
        if (this.onSelectionChange) {
            const selected = this.cards
                .filter(c => c.getSelected())
                .map(c => c.getCard());
            this.onSelectionChange(selected);
        }
    }

    public setMaxSelection(max: number): void {
        this.maxSelection = max;
    }

    public getSelectedCards(): Card[] {
        return this.cards
            .filter(c => c.getSelected())
            .map(c => c.getCard());
    }

    public clearSelection(): void {
        this.cards.forEach(c => c.deselect());
        if (this.onSelectionChange) {
            this.onSelectionChange([]);
        }
    }

    public removeSelectedCards(): void {
        const selectedCards = this.cards.filter(c => c.getSelected());
        selectedCards.forEach(card => {
            card.destroy();
        });
        this.cards = this.cards.filter(c => !c.getSelected());
        this.render();
    }

    public removeCard(cardId: string): void {
        const index = this.cards.findIndex(c => c.getCard().id === cardId);
        if (index !== -1) {
            this.cards[index].destroy();
            this.cards.splice(index, 1);
            this.render();
        }
    }

    public clearHand(): void {
        this.cards.forEach(c => c.destroy());
        this.cards = [];
        this.container.innerHTML = '';
        console.log('[DEBUG][HandManager] clearHand called - hand emptied');
    }

    public getCardCount(): number {
        return this.cards.length;
    }

    public onSelectionChanged(callback: (selectedCards: Card[]) => void): void {
        this.onSelectionChange = callback;
    }

    // 방어 선택 모드에서 특정 속성의 공격을 막을 수 있는 카드만 선택 가능하도록 표시/제한
    public markEligibleDefense(attackAttribute?: any): void {
        // 로컬 helper: 공격 속성에 대해 방어 카드가 막을 수 있는지 판단
        const normalize = (s?: string | null) => {
            if (!s) return 'none';
            const x = String(s).toLowerCase();
            if (x === '화염' || x === 'fire') return 'fire';
            if (x === '물' || x === 'water') return 'water';
            if (x === '빛' || x === 'light') return 'light';
            if (x === '암흑' || x === 'dark') return 'dark';
            if (x === '없음' || x === 'none') return 'none';
            return x;
        };

        const canDefenseBlock = (attackAttr: string | undefined, defenseAttr: string | undefined) => {
            const a = normalize(attackAttr);
            const d = normalize(defenseAttr);

            if (a === 'fire') return d === 'water';
            if (a === 'water') return d === 'fire';
            if (a === 'light') return d === 'light';
            if (a === 'dark') return true;
            return true;
        };

        console.log(`[DEBUG][HandManager] markEligibleDefense attackAttribute=${attackAttribute}`);
        this.cards.forEach(cc => {
            const card = cc.getCard() as any;
            if (card.type === CardType.DEFENSE) {
                const eligible = attackAttribute ? canDefenseBlock(attackAttribute, card.attribute) : true;
                cc.setSelectable(eligible);
            } else {
                // 공격/마법 등은 방어 선택 시 선택 불가
                cc.setSelectable(false);
            }
        });
    }

    public setEnabled(enabled: boolean): void {
        console.log(`[DEBUG][HandManager] setEnabled -> ${enabled}`);
        this.cards.forEach(card => {
            const element = card.getElement();
            if (element) {
                if (enabled) {
                    element.style.opacity = '1';
                    element.style.pointerEvents = 'auto';
                } else {
                    element.style.opacity = '0.5';
                    element.style.pointerEvents = 'none';
                }
            }
        });
    }

    private render(): void {
        // 컨테이너 비우기
        this.container.innerHTML = '';

        // 부채꼴 배치를 위한 계산
        const cardCount = this.cards.length;
        const maxSpread = 30; // 최대 각도 범위 (도)

        this.cards.forEach((card, index) => {
            const element = card.getElement();
            
            if (cardCount > 1) {
                // 부채꼴 각도 계산
                const angleStep = Math.min(maxSpread / (cardCount - 1), 10);
                const angle = (index - (cardCount - 1) / 2) * angleStep;
                
                // 곡선 배치를 위한 Y 오프셋
                const yOffset = Math.abs(angle) * 0.5;
                
                element.style.transform = `rotate(${angle}deg) translateY(${yOffset}px)`;
                element.style.transformOrigin = 'bottom center';
            } else {
                element.style.transform = 'none';
            }

            this.container.appendChild(element);
        });
    }
}
