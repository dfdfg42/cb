import { Player } from '../types';

export class PlayerInfoComponent {
    private player: Player;
    private element: HTMLElement;
    private index: number;
    private damageTimeout?: number;

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

    public playDamageEffect(healthDamage: number, mentalDamage: number): void {
        if (healthDamage <= 0 && mentalDamage <= 0) {
            return;
        }

        // Remove any existing floating labels to avoid stacking
        this.element.querySelectorAll('.player-damage-float').forEach(node => node.remove());

        // Force reflow so repeated hits restart the animation
        this.element.classList.remove('damage-hit');
        void this.element.offsetWidth;
        this.element.classList.add('damage-hit');

        const label = document.createElement('div');
        label.className = 'player-damage-float';

        const segments: HTMLElement[] = [];
        if (healthDamage > 0) {
            const hpSpan = document.createElement('span');
            hpSpan.className = 'hp-damage';
            hpSpan.textContent = `-${healthDamage} HP`;
            segments.push(hpSpan);
        }
        if (mentalDamage > 0) {
            const mpSpan = document.createElement('span');
            mpSpan.className = 'mp-damage';
            mpSpan.textContent = `-${mentalDamage} MP`;
            segments.push(mpSpan);
        }

        segments.forEach((segment, idx) => {
            if (idx > 0) {
                const divider = document.createElement('span');
                divider.className = 'damage-separator';
                divider.textContent = '•';
                label.appendChild(divider);
            }
            label.appendChild(segment);
        });

        this.element.appendChild(label);

        label.addEventListener('animationend', () => {
            label.remove();
        }, { once: true });

        if (this.damageTimeout) {
            window.clearTimeout(this.damageTimeout);
        }
        this.damageTimeout = window.setTimeout(() => {
            this.element.classList.remove('damage-hit');
            this.damageTimeout = undefined;
        }, 600);
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
    private snapshots: Map<string, { health: number; mental: number }> = new Map();

    constructor() {}

    public setPlayers(players: Player[]): void {
        this.players = players;
        this.renderAll();
    }

    public updatePlayer(player: Player): void {
        const index = this.players.findIndex(p => p.id === player.id);
        if (index !== -1) {
            this.players[index] = player;
        } else {
            this.players.push(player);
        }
        this.applyPlayerState(player, true);
    }

    public setActivePlayer(playerId: string): void {
        this.playerComponents.forEach((component, id) => {
            component.setActive(id === playerId);
        });
    }

    private renderAll(): void {
        // 기존 컴포넌트 제거
        this.playerComponents.clear();
        this.snapshots.clear();

        // 새로운 컴포넌트 생성
        this.players.forEach((player, index) => {
            const component = new PlayerInfoComponent(player, index);
            this.playerComponents.set(player.id, component);
            this.snapshots.set(player.id, {
                health: player.health,
                mental: player.mentalPower
            });
        });
    }

    public getPlayerById(playerId: string): Player | undefined {
        return this.players.find(p => p.id === playerId);
    }

    public getAlivePlayers(): Player[] {
        return this.players.filter(p => p.isAlive);
    }

    public refreshAll(options: { triggerEffects?: boolean } = {}): void {
        const triggerEffects = options.triggerEffects ?? true;
        this.players.forEach(player => {
            this.applyPlayerState(player, triggerEffects);
        });
    }

    public clear(): void {
        this.players = [];
        this.playerComponents.clear();
        this.snapshots.clear();
        
        // UI 초기화
        for (let i = 0; i < 4; i++) {
            const container = document.getElementById(`player-info-${i}`);
            if (container) {
                container.innerHTML = '';
                container.classList.remove('active', 'dead');
            }
        }
    }

    private applyPlayerState(player: Player, triggerEffects: boolean): void {
        let component = this.playerComponents.get(player.id);
        if (!component) {
            const index = this.players.findIndex(p => p.id === player.id);
            component = new PlayerInfoComponent(player, index === -1 ? this.playerComponents.size : index);
            this.playerComponents.set(player.id, component);
        }

        const snapshot = this.snapshots.get(player.id) || {
            health: player.health,
            mental: player.mentalPower
        };

        component.updatePlayer(player);

        if (triggerEffects) {
            const healthDamage = Math.max(0, snapshot.health - player.health);
            const mentalDamage = Math.max(0, snapshot.mental - player.mentalPower);
            if (healthDamage > 0 || mentalDamage > 0) {
                component.playDamageEffect(healthDamage, mentalDamage);
            }
        }

        this.snapshots.set(player.id, {
            health: player.health,
            mental: player.mentalPower
        });
    }
}
