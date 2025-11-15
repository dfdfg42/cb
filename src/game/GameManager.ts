import { GameSession, GameState, GameType, Player, Card, DebuffType, CardType } from '../types';
import { IUIManager } from '../ui/IUIManager';
import { createShuffledDeck } from '../data/cards';
import { CombatManager } from './CombatManager';
import { CardValidator } from './CardValidator';
import { EventEmitter } from './EventEmitter';
import { FieldMagicManager } from './FieldMagicManager';
import { getSystemEventCards, getSystemEventConfig, SystemEventCard, SystemEventCategory } from '../data/systemEvents';

/**
 * GameManager - 게임 흐름 제어 담당
 * 전투 로직은 CombatManager, 검증은 CardValidator에 위임
 */
export class GameManager {
    private session: GameSession;
    private localPlayerId: string;
    private uiManager: IUIManager;
    private combatManager: CombatManager;
    private eventEmitter: EventEmitter;
    private systemEventConfig = getSystemEventConfig();
    private systemEventCardsByCategory: Record<SystemEventCategory, SystemEventCard[]>;
    private totalSystemEventChance: number;

    constructor(gameType: GameType, players: Player[], localPlayerId: string, uiManager: IUIManager) {
        this.localPlayerId = localPlayerId;
        this.uiManager = uiManager;
        this.combatManager = new CombatManager(uiManager);
        this.eventEmitter = new EventEmitter();
        const systemEventCards = getSystemEventCards();
        this.systemEventCardsByCategory = {
            angel: systemEventCards.filter(card => card.category === 'angel'),
            demon: systemEventCards.filter(card => card.category === 'demon')
        };
        this.totalSystemEventChance = Math.min(
            1,
            (this.systemEventConfig?.angelChance ?? 0) +
            (this.systemEventConfig?.demonChance ?? 0)
        );
        
        // 게임 세션 초기화
        this.session = {
            id: `game-${Date.now()}`,
            type: gameType,
            players: players,
            currentTurn: 1,
            currentPlayerId: players[0].id,
            attackCards: [],
            defenseCards: [],
            state: GameState.STARTING,
            deck: createShuffledDeck(),
            normalAttackUsedBy: []
        };

        this.initializeGame();
    }

    // ===========================================
    // 게임 초기화 및 턴 관리
    // ===========================================

    private initializeGame(): void {
        console.log('🎮 게임 초기화 중...');
        
        // 각 플레이어에게 9장씩 카드 분배
        this.session.players.forEach(player => {
            player.cards = this.drawCardsFromDeck(9);
        });

        // 게임 상태를 플레이 중으로 변경
        this.session.state = GameState.PLAYING;
        
        // 첫 번째 플레이어 턴 시작
        this.startTurn();
        
        this.uiManager.addLogMessage('게임이 시작되었습니다!');
        this.uiManager.addLogMessage(`${this.getCurrentPlayer().name}의 턴입니다.`);
        
        // 게임 시작 이벤트 발행
        this.eventEmitter.emit('game:start', this.session);
    }

    private drawCardsFromDeck(count: number): Card[] {
        const cards: Card[] = [];
        for (let i = 0; i < count; i++) {
            if (this.session.deck.length === 0) {
                this.session.deck = createShuffledDeck();
            }
            const card = this.session.deck.pop();
            if (card) {
                cards.push(card);
            }
        }
        return cards;
    }

    private startTurn(): void {
        const currentPlayer = this.getCurrentPlayer();
        
        // 디버프 효과 적용
        this.applyDebuffs(currentPlayer);
        
        // 필드 마법 지속 효과 적용
        FieldMagicManager.applyTurnStartEffects(
            this.session,
            this.uiManager,
            (target, health, mental) => this.combatManager.applyDamage(target, health, mental)
        );

        this.uiManager.updateTurnNumber(this.session.currentTurn);
        console.log(`턴 ${this.session.currentTurn}: ${currentPlayer.name}의 차례`);
        
    // 매 턴 시작 시 일반 공격 사용 기록 초기화
    this.resetNormalAttackUsage();

        // 턴 시작 이벤트 발행
        this.eventEmitter.emit('turn:start', currentPlayer, this.session.currentTurn);
    }

    public endTurn(): void {
        // 다음 플레이어로 턴 넘김
        const currentIndex = this.session.players.findIndex(p => p.id === this.session.currentPlayerId);
        let nextIndex = (currentIndex + 1) % this.session.players.length;
        
        // 살아있는 플레이어 찾기
        let attempts = 0;
        while (!this.session.players[nextIndex].isAlive && attempts < 4) {
            nextIndex = (nextIndex + 1) % this.session.players.length;
            attempts++;
        }

        const previousPlayerId = this.session.currentPlayerId;
        this.session.currentPlayerId = this.session.players[nextIndex].id;
        this.session.currentTurn++;
        this.session.state = GameState.PLAYING;

        // 턴 종료 이벤트 발행
        this.eventEmitter.emit('turn:end', previousPlayerId, this.session.currentPlayerId);

        this.startTurn();
    }

    /**
     * 플레이어에게 카드를 지급하고, 드로우 시점 시스템 이벤트를 처리한다.
     */
    public drawCardsForPlayer(playerId: string, count: number): Card[] {
        const player = this.getPlayerById(playerId);
        if (!player || count <= 0) {
            return [];
        }

        const drawnCards: Card[] = [];
        for (let i = 0; i < count; i++) {
            const newCard = this.drawCardsFromDeck(1)[0];
            if (newCard) {
                drawnCards.push(newCard);
            }
            this.handleSystemEventOnDraw(player);
        }

        if (drawnCards.length > 0) {
            player.cards.push(...drawnCards);
        }

        return drawnCards;
    }

    // ===========================================
    // 공격/방어 플로우
    // ===========================================

    public selectAttackCards(cards: Card[]): boolean {
        const currentPlayer = this.getCurrentPlayer();
        
        // 현재 플레이어 확인
        if (currentPlayer.id !== this.localPlayerId) {
            this.uiManager.showAlert('당신의 턴이 아닙니다!');
            return false;
        }

        // CardValidator로 검증
        const validation = CardValidator.canPlayCards(cards, currentPlayer, this.session.fieldMagic);
        if (!validation.valid) {
            this.uiManager.showAlert(validation.error!);
            return false;
        }

        // 일반(플러스 없는) 공격 카드는 한 턴에 한 번만 사용 가능
        const normalAttackSelected = cards.some(c => c.type === CardType.ATTACK && c.plusLevel === 0);
        if (normalAttackSelected) {
            this.session.normalAttackUsedBy = this.session.normalAttackUsedBy || [];
            if (this.session.normalAttackUsedBy.includes(currentPlayer.id)) {
                this.uiManager.showAlert('이미 이 턴에 일반 공격 카드를 사용했습니다!');
                return false;
            }
            // 기록에 추가
            this.session.normalAttackUsedBy.push(currentPlayer.id);
        }

        this.session.attackCards = cards;
        this.session.state = GameState.ATTACKING;
        
        // 공격 카드 선택 이벤트 발행
        this.eventEmitter.emit('attack:cards-selected', cards, currentPlayer);
        
        return true;
    }

    public selectDefender(defenderId: string): void {
        const defender = this.session.players.find(p => p.id === defenderId);
        if (!defender || !defender.isAlive) {
            this.uiManager.showAlert('유효하지 않은 대상입니다!');
            return;
        }

        this.session.defenderId = defenderId;
        this.session.state = GameState.DEFENDING;

        // 공격이 확정되었을 때만 중앙 전투 이름 표시
        this.uiManager.showCombatNames(
            this.getCurrentPlayer().name,
            defender.name
        );

        this.uiManager.addLogMessage(
            `${this.getCurrentPlayer().name}이(가) ${defender.name}을(를) 공격합니다!`
        );
        
        // 방어자 선택 이벤트 발행
        this.eventEmitter.emit('defender:selected', defender);
    }

    public selectDefenseCards(cards: Card[]): boolean {
        const defender = this.getDefender();
        if (!defender) return false;

        // CardValidator로 검증
        if (!this.combatManager.selectDefenseCards(cards)) {
            return false;
        }

        this.session.defenseCards = cards;
        
        // 방어 카드 선택 이벤트 발행
        this.eventEmitter.emit('defense:cards-selected', cards, defender);
        
        return true;
    }

    public resolveAttack(): void {
        const attacker = this.getCurrentPlayer();
        const defender = this.getDefender();
        
        if (!defender) {
            this.uiManager.showAlert('방어자가 지정되지 않았습니다!');
            return;
        }

        // CombatManager에게 전투 해결 위임
        const result = this.combatManager.resolveAttack(this.session, attacker, defender);

        if (!result.resolved) {
            // Reflect/Bounce - 연쇄 대응
            this.session.defenderId = result.newDefenderId;
            this.session.defenseCards = [];
            
            // 연쇄 대응 이벤트 발행
            this.eventEmitter.emit('combat:chain-reaction', result.newDefenderId);
            return;
        }

        // 전투 종료
        this.endAttackPhase();
        
        // 게임 종료 체크
        if (this.checkGameEnd()) {
            return;
        }

        // 다음 턴으로
        this.endTurn();
    }

    private endAttackPhase(): void {
        const attacker = this.getCurrentPlayer();
        const defender = this.getDefender();

        // CombatManager에게 카드 제거 위임
        this.combatManager.removeUsedCards(
            attacker,
            defender,
            this.session.attackCards,
            this.session.defenseCards
        );

        // 상태 초기화
        this.session.attackCards = [];
        this.session.defenseCards = [];
        this.session.attackerId = undefined;
        this.session.defenderId = undefined;
        
        this.uiManager.clearCombatNames();
        
        // 공격 종료 이벤트 발행
        this.eventEmitter.emit('attack:end');
    }

    // ===========================================
    // 디버프 및 특수 효과
    // ===========================================

    private applyDebuffs(player: Player): void {
        player.debuffs.forEach(debuff => {
            switch (debuff.type) {
                case DebuffType.CARD_DECAY:
                    if (player.cards.length > 0) {
                        const randomIndex = Math.floor(Math.random() * player.cards.length);
                        const removedCard = player.cards.splice(randomIndex, 1)[0];
                        this.uiManager.addLogMessage(
                            `💀 ${player.name}의 카드 [${removedCard.name}]이(가) 소멸했습니다!`
                        );
                    }
                    break;
            }
        });
    }

    private handleSystemEventOnDraw(triggeringPlayer: Player): void {
        if (!this.systemEventConfig) return;
        if (this.session.currentTurn < this.systemEventConfig.turnLimit) return;
        if (this.totalSystemEventChance <= 0) return;

        const roll = Math.random();
        if (roll >= this.totalSystemEventChance) {
            return;
        }

        const eventType: SystemEventCategory =
            roll < (this.systemEventConfig.angelChance ?? 0) ? 'angel' : 'demon';
        const pool = this.systemEventCardsByCategory[eventType] || [];
        if (pool.length === 0) return;

        const card = pool[Math.floor(Math.random() * pool.length)];
        this.resolveSystemEventCard(card, triggeringPlayer);
    }

    private resolveSystemEventCard(card: SystemEventCard, triggeringPlayer: Player): void {
        const target = this.getRandomAlivePlayer();
        if (!target) return;

        const triggerMessage = `⚙️ ${triggeringPlayer.name}의 드로우로 시스템 이벤트 [${card.name}] 발동!`;
        this.uiManager.addLogMessage(triggerMessage);

        if (card.category === 'angel') {
            if (card.effect === 'hp+10') {
                target.health = Math.min(target.maxHealth, target.health + 10);
                this.uiManager.addLogMessage(`😇 ${target.name}이(가) 체력 10을 회복했습니다!`);
            } else if (card.effect === 'mp+10') {
                target.mentalPower = Math.min(target.maxMentalPower, target.mentalPower + 10);
                this.uiManager.addLogMessage(`😇 ${target.name}이(가) 정신력을 10 회복했습니다!`);
            } else {
                this.uiManager.addLogMessage(`😇 ${target.name}이(가) 천사의 축복을 받았습니다.`);
            }
            this.eventEmitter.emit('event:angel', { card, targetId: target.id });
            return;
        }

        if (card.id === 'EVT-DEMON-DISCARD2') {
            const cardsToRemove = Math.min(2, target.cards.length);
            for (let i = 0; i < cardsToRemove; i++) {
                const removeIndex = Math.floor(Math.random() * target.cards.length);
                target.cards.splice(removeIndex, 1);
            }
            this.uiManager.addLogMessage(`😈 악마가 ${target.name}의 카드 ${cardsToRemove}장을 파괴했습니다!`);
        } else {
            const healthDamage = Math.max(card.physicalDamage, 0);
            const mentalDamage = Math.max(card.mentalDamage, 0);
            this.combatManager.applyDamage(target, healthDamage, mentalDamage);
            this.uiManager.addLogMessage(`😈 [${card.name}]이(가) ${target.name}을(를) 강타했습니다!`);
        }

        this.eventEmitter.emit('event:devil', { card, targetId: target.id });
    }

    // ===========================================
    // 게임 종료
    // ===========================================

    private checkGameEnd(): boolean {
        const alivePlayers = this.session.players.filter(p => p.isAlive);
        
        if (alivePlayers.length === 1) {
            this.session.state = GameState.ENDED;
            const winner = alivePlayers[0];
            this.uiManager.addLogMessage(`🏆 ${winner.name}의 승리!`);
            this.uiManager.showAlert(`게임 종료! ${winner.name}의 승리!`);
            
            // 게임 종료 이벤트 발행
            this.eventEmitter.emit('game:end', winner);
            return true;
        } else if (alivePlayers.length === 0) {
            this.session.state = GameState.ENDED;
            this.uiManager.addLogMessage('무승부!');
            this.uiManager.showAlert('게임 종료! 무승부!');
            
            // 게임 종료 이벤트 발행
            this.eventEmitter.emit('game:draw');
            return true;
        }
        
        return false;
    }

    // ===========================================
    // Getters
    // ===========================================

    public getCurrentPlayer(): Player {
        return this.session.players.find(p => p.id === this.session.currentPlayerId)!;
    }

    public getDefender(): Player | undefined {
        if (!this.session.defenderId) return undefined;
        return this.session.players.find(p => p.id === this.session.defenderId);
    }

    public getSession(): GameSession {
        return this.session;
    }

    public resetNormalAttackUsage(): void {
        this.session.normalAttackUsedBy = [];
    }

    public getLocalPlayer(): Player {
        return this.session.players.find(p => p.id === this.localPlayerId)!;
    }

    public getPlayerById(playerId: string): Player | undefined {
        return this.session.players.find(p => p.id === playerId);
    }

    public isLocalPlayerTurn(): boolean {
        return this.session.currentPlayerId === this.localPlayerId;
    }

    public getEventEmitter(): EventEmitter {
        return this.eventEmitter;
    }

    private getRandomAlivePlayer(): Player | undefined {
        const alive = this.session.players.filter(p => p.isAlive);
        if (alive.length === 0) return undefined;
        const index = Math.floor(Math.random() * alive.length);
        return alive[index];
    }
}
