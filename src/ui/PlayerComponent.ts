import { Player } from '../types';

export class PlayerInfoComponent {
    private player: Player;
    private element: HTMLElement;
    private index: number;

    constructor(player: Player, index: number) {
        this.player = player;
        this.index = index;
        this.element = this.createPlayerInfoElement();
    }

    private createPlayerInfoElement(): HTMLElement {
        const container = document.getElementById(`player-info-${this.index}`);
        if (!container) {
            throw new Error(`Player info container ${this.index} not found`);
        }

        // element를 먼저 설정하고 render 호출
        this.element = container;
        this.render();
        return container;
    }

    public updatePlayer(player: Player): void {
        this.player = player;
        this.render();
    }

    public setActive(isActive: boolean): void {
        if (isActive) {
            this.element.classList.add('active');
        } else {
            this.element.classList.remove('active');
        }
    }

    public setDead(isDead: boolean): void {
        if (isDead) {
            this.element.classList.add('dead');
        } else {
            this.element.classList.remove('dead');
        }
    }

    private render(): void {
        const healthPercent = (this.player.health / this.player.maxHealth) * 100;
        const mentalPercent = (this.player.mentalPower / this.player.maxMentalPower) * 100;

        this.element.innerHTML = `
            <div class="name" title="${this.player.name}">${this.player.name}</div>
            <div class="stat-bar">
                <div class="stat-label">HP: ${this.player.health}/${this.player.maxHealth}</div>
                <div class="bar">
                    <div class="bar-fill health" style="width: ${Math.max(0, healthPercent)}%"></div>
                </div>
            </div>
            <div class="stat-bar">
                <div class="stat-label">MP: ${this.player.mentalPower}/${this.player.maxMentalPower}</div>
                <div class="bar">
                    <div class="bar-fill mental" style="width: ${Math.max(0, mentalPercent)}%"></div>
                </div>
            </div>
            ${this.player.debuffs.length > 0 ? `
                <div class="debuffs">
                    ${this.player.debuffs.map(d => `<span class="debuff-icon" title="${d.type}">💀</span>`).join('')}
                </div>
            ` : ''}
        `;

        // 사망 상태 처리
        this.setDead(!this.player.isAlive);
    }

    public getElement(): HTMLElement {
        return this.element;
    }

    public getPlayer(): Player {
        return this.player;
    }
}

export class PlayersManager {
    private playerComponents: Map<string, PlayerInfoComponent> = new Map();
    private players: Player[] = [];

    constructor() {}

    public setPlayers(players: Player[]): void {
        this.players = players;
        this.renderAll();
    }

    public updatePlayer(player: Player): void {
        const index = this.players.findIndex(p => p.id === player.id);
        if (index !== -1) {
            this.players[index] = player;
            const component = this.playerComponents.get(player.id);
            if (component) {
                component.updatePlayer(player);
            }
        }
    }

    public setActivePlayer(playerId: string): void {
        this.playerComponents.forEach((component, id) => {
            component.setActive(id === playerId);
        });
    }

    private renderAll(): void {
        // 기존 컴포넌트 제거
        this.playerComponents.clear();

        // 새로운 컴포넌트 생성
        this.players.forEach((player, index) => {
            const component = new PlayerInfoComponent(player, index);
            this.playerComponents.set(player.id, component);
        });
    }

    public getPlayerById(playerId: string): Player | undefined {
        return this.players.find(p => p.id === playerId);
    }

    public getAlivePlayers(): Player[] {
        return this.players.filter(p => p.isAlive);
    }

    public refreshAll(): void {
        this.players.forEach(player => {
            const component = this.playerComponents.get(player.id);
            if (component) {
                component.updatePlayer(player);
            }
        });
    }

    public clear(): void {
        this.players = [];
        this.playerComponents.clear();
        
        // UI 초기화
        for (let i = 0; i < 4; i++) {
            const container = document.getElementById(`player-info-${i}`);
            if (container) {
                container.innerHTML = '';
                container.classList.remove('active', 'dead');
            }
        }
    }
}
