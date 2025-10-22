import { Card, CardType } from '../types';
import { soundManager } from '../audio/SoundManager';

export class CardComponent {
    private card: Card;
    private element: HTMLElement;
    private isSelected: boolean = false;
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
        if (this.card.healthDamage > 0) {
            // plusLevel이 있으면 공격력 앞에 + 표시
            const prefix = this.card.plusLevel > 0 ? '+' : '';
            stats.push(`⚔️${prefix}${this.card.healthDamage}`);
        }
        if (this.card.mentalDamage > 0) {
            stats.push(`🧠${this.card.mentalDamage}`);
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
        this.toggleSelect();
        soundManager.playCardSelect();
        if (this.onClickCallback) {
            this.onClickCallback(this.card);
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

        if (nameEl) nameEl.textContent = this.card.name;
        if (descEl) descEl.textContent = this.card.description;
        if (imageEl) imageEl.innerHTML = this.getCardIcon();
        
        if (statsEl) {
            const statsText: string[] = [];
            if (this.card.healthDamage > 0) {
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
}

export class HandManager {
    private cards: CardComponent[] = [];
    private container: HTMLElement;
    private maxSelection: number = 1;
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
    }

    public addCards(cards: Card[]): void {
        cards.forEach(card => this.addCard(card));
    }

    private handleCardSelection(selectedCard: CardComponent): void {
        const currentlySelected = this.cards.filter(c => c.getSelected());
        
        // 일반 최대 선택 수 확인
        if (currentlySelected.length > this.maxSelection && selectedCard.getSelected()) {
            // 가장 먼저 선택된 카드 선택 해제
            currentlySelected[0].deselect();
        }

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
    }

    public getCardCount(): number {
        return this.cards.length;
    }

    public onSelectionChanged(callback: (selectedCards: Card[]) => void): void {
        this.onSelectionChange = callback;
    }

    public setEnabled(enabled: boolean): void {
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
