import { GameSession, GameState, GameType, Player, Card, DebuffType } from '../types';
import { IUIManager } from '../ui/IUIManager';
import { createShuffledDeck } from '../data/cards';
import { CombatManager } from './CombatManager';
import { CardValidator } from './CardValidator';
import { EventEmitter } from './EventEmitter';

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

    constructor(gameType: GameType, players: Player[], localPlayerId: string, uiManager: IUIManager) {
        this.localPlayerId = localPlayerId;
        this.uiManager = uiManager;
        this.combatManager = new CombatManager(uiManager);
        this.eventEmitter = new EventEmitter();
        
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
            deck: createShuffledDeck()
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
        for (let i = 0; i < count && this.session.deck.length > 0; i++) {
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
        
        // 필드 마법 효과 적용
        if (this.session.fieldMagic) {
            this.applyFieldMagicEffect();
        }

        // 50턴 이후 악마/천사 이벤트
        if (this.session.currentTurn >= 50) {
            this.triggerSpecialEvent();
        }

        this.uiManager.updateTurnNumber(this.session.currentTurn);
        console.log(`턴 ${this.session.currentTurn}: ${currentPlayer.name}의 차례`);
        
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
        const validation = CardValidator.canPlayCards(cards, currentPlayer);
        if (!validation.valid) {
            this.uiManager.showAlert(validation.error!);
            return false;
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

    private applyFieldMagicEffect(): void {
        if (!this.session.fieldMagic) return;

        const caster = this.session.players.find(p => p.id === this.session.fieldMagic?.casterId);
        const fieldMagic = this.session.fieldMagic;
        
        // 필드 마법 효과 적용
        if (fieldMagic.name === '화염의 대지') {
            // 모든 적에게 매 턴 5 데미지
            this.session.players.forEach(player => {
                if (player.id !== fieldMagic.casterId && player.isAlive) {
                    this.combatManager.applyDamage(player, 5, 0);
                    this.uiManager.addLogMessage(`🔥 ${player.name}이(가) 화염의 대지에서 5 데미지를 받았습니다!`);
                }
            });
        } else if (fieldMagic.name === '치유의 성역' && caster && caster.isAlive) {
            // 발동자는 매 턴 체력 10 회복
            caster.health = Math.min(100, caster.health + 10);
            this.uiManager.addLogMessage(`✨ ${caster.name}이(가) 치유의 성역에서 체력 10을 회복했습니다!`);
        } else if (fieldMagic.name === '얼음 왕국' && caster && caster.isAlive) {
            this.uiManager.addLogMessage(`❄️ 얼음 왕국이 모든 적의 공격력을 약화시킵니다!`);
        } else if (fieldMagic.name === '마력의 폭풍' && caster && caster.isAlive) {
            // 발동자는 매 턴 정신력 3 회복
            caster.mentalPower = Math.min(caster.maxMentalPower, caster.mentalPower + 3);
            this.uiManager.addLogMessage(`⚡ ${caster.name}이(가) 마력의 폭풍에서 정신력 3을 회복했습니다!`);
        } else if (fieldMagic.name === '혼돈의 소용돌이') {
            this.uiManager.addLogMessage(`🌀 혼돈의 소용돌이가 전장을 휘감습니다!`);
        }

        // 지속 시간 감소
        fieldMagic.duration--;
        if (fieldMagic.duration <= 0) {
            this.uiManager.addLogMessage(`필드 마법 [${fieldMagic.name}]의 효과가 끝났습니다!`);
            this.session.fieldMagic = undefined;
            this.uiManager.updateFieldMagic(null);
        }
    }

    // ===========================================
    // 특수 이벤트 (천사/악마)
    // ===========================================

    private triggerSpecialEvent(): void {
        const roll = Math.random();
        
        if (roll < 0.1) { // 10% 확률로 천사
            this.angelEvent();
        } else if (roll < 0.4) { // 30% 확률로 악마
            this.devilEvent();
        }
    }

    private devilEvent(): void {
        const alivePlayers = this.session.players.filter(p => p.isAlive);
        if (alivePlayers.length === 0) return;

        const target = alivePlayers[Math.floor(Math.random() * alivePlayers.length)];
        const eventRoll = Math.random();

        if (eventRoll < 0.33) {
            this.combatManager.applyDamage(target, 10, 0);
            this.uiManager.addLogMessage(`😈 악마가 나타나 ${target.name}에게 10 데미지!`);
        } else if (eventRoll < 0.66) {
            this.combatManager.applyDamage(target, 20, 0);
            this.uiManager.addLogMessage(`😈 악마가 나타나 ${target.name}에게 20 데미지!`);
        } else if (eventRoll < 0.9) {
            this.combatManager.applyDamage(target, 30, 0);
            this.uiManager.addLogMessage(`😈 악마가 나타나 ${target.name}에게 30 데미지!`);
        } else {
            // 카드 2장 삭제
            const cardsToRemove = Math.min(2, target.cards.length);
            for (let i = 0; i < cardsToRemove; i++) {
                target.cards.pop();
            }
            this.uiManager.addLogMessage(`😈 악마가 ${target.name}의 카드 ${cardsToRemove}장을 파괴했습니다!`);
        }
        
        // 악마 이벤트 발행
        this.eventEmitter.emit('event:devil', target);
    }

    private angelEvent(): void {
        const alivePlayers = this.session.players.filter(p => p.isAlive);
        if (alivePlayers.length === 0) return;

        const target = alivePlayers[Math.floor(Math.random() * alivePlayers.length)];
        
        if (Math.random() < 0.5) {
            target.health = Math.min(100, target.health + 10);
            this.uiManager.addLogMessage(`😇 천사가 나타나 ${target.name}의 체력을 10 회복!`);
        } else {
            target.mentalPower = Math.min(target.maxMentalPower, target.mentalPower + 10);
            this.uiManager.addLogMessage(`😇 천사가 나타나 ${target.name}의 정신력을 10 회복!`);
        }
        
        // 천사 이벤트 발행
        this.eventEmitter.emit('event:angel', target);
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
}
