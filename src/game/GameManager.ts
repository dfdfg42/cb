import { GameSession, GameState, GameType, Player, Card, CardType, CardEffect, DebuffType, Debuff } from '../types';
import { uiManager } from '../ui/UIManager';
import { createShuffledDeck } from '../data/cards';

export class GameManager {
    private session: GameSession;
    private localPlayerId: string;

    constructor(gameType: GameType, players: Player[], localPlayerId: string) {
        this.localPlayerId = localPlayerId;
        
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
        
        uiManager.addLogMessage('게임이 시작되었습니다!');
        uiManager.addLogMessage(`${this.getCurrentPlayer().name}의 턴입니다.`);
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

        uiManager.updateTurnNumber(this.session.currentTurn);
        console.log(`턴 ${this.session.currentTurn}: ${currentPlayer.name}의 차례`);
    }

    public selectAttackCards(cards: Card[]): boolean {
        const currentPlayer = this.getCurrentPlayer();
        
        // 현재 플레이어 확인
        if (currentPlayer.id !== this.localPlayerId) {
            uiManager.showAlert('당신의 턴이 아닙니다!');
            return false;
        }

        // 카드 선택 가능 여부 확인
        if (!this.canPlayCards(cards, currentPlayer)) {
            return false;
        }

        this.session.attackCards = cards;
        this.session.state = GameState.ATTACKING;
        
        return true;
    }

    private canPlayCards(cards: Card[], player: Player): boolean {
        if (cards.length === 0) {
            uiManager.showAlert('카드를 선택해주세요!');
            return false;
        }

        // 필드 마법 카드 확인
        const fieldMagicCards = cards.filter(c => c.type === CardType.FIELD_MAGIC);
        if (fieldMagicCards.length > 0) {
            if (cards.length > 1) {
                uiManager.showAlert('필드 마법은 단독으로만 사용 가능합니다!');
                return false;
            }
            // 필드 마법은 정신력만 확인하면 됨
            const mentalCost = fieldMagicCards[0].mentalCost;
            if (mentalCost > player.mentalPower) {
                uiManager.showAlert('정신력이 부족합니다!');
                return false;
            }
            return true;
        }

        // 마법 카드는 1장만 가능
        const magicCards = cards.filter(c => c.type === CardType.MAGIC);
        if (magicCards.length > 1) {
            uiManager.showAlert('마법 카드는 한 번에 1장만 사용 가능합니다!');
            return false;
        }

        // 정신력 확인 (마법 카드)
        const totalMentalCost = cards.reduce((sum, card) => sum + card.mentalCost, 0);
        if (totalMentalCost > player.mentalPower) {
            uiManager.showAlert('정신력이 부족합니다!');
            return false;
        }

        // + 접두사 카드 확인
        const plusCards = cards.filter(c => c.plusLevel > 0);
        if (plusCards.length > 0) {
            const firstPlusCard = plusCards[0];
            const maxCards = firstPlusCard.plusLevel + 1;
            
            // 같은 카드만 선택 가능
            const allSameCard = plusCards.every(c => c.name === firstPlusCard.name);
            if (!allSameCard) {
                uiManager.showAlert('+ 접두사 카드는 같은 종류만 함께 사용 가능합니다!');
                return false;
            }
            
            if (plusCards.length > maxCards) {
                uiManager.showAlert(`이 카드는 최대 ${maxCards}장까지 사용 가능합니다!`);
                return false;
            }
        }

        // 일반 공격 카드 + 다른 카드 혼합 불가
        const normalAttacks = cards.filter(c => c.type === CardType.ATTACK && c.plusLevel === 0);
        if (normalAttacks.length > 0 && cards.length > 1) {
            uiManager.showAlert('일반 공격 카드는 1장만 사용 가능합니다!');
            return false;
        }

        return true;
    }

    public selectDefender(defenderId: string): void {
        const defender = this.session.players.find(p => p.id === defenderId);
        if (!defender || !defender.isAlive) {
            uiManager.showAlert('유효하지 않은 대상입니다!');
            return;
        }

        this.session.defenderId = defenderId;
        this.session.state = GameState.DEFENDING;

        uiManager.updateCombatNames(
            this.getCurrentPlayer().name,
            defender.name
        );

        uiManager.addLogMessage(
            `${this.getCurrentPlayer().name}이(가) ${defender.name}을(를) 공격합니다!`
        );
    }

    public selectDefenseCards(cards: Card[]): boolean {
        const defender = this.getDefender();
        if (!defender) return false;

        // 방어 카드 확인
        const validDefense = cards.every(c => 
            c.type === CardType.DEFENSE || 
            c.type === CardType.MAGIC
        );

        if (!validDefense) {
            uiManager.showAlert('방어 카드 또는 마법 카드만 사용 가능합니다!');
            return false;
        }

        this.session.defenseCards = cards;
        return true;
    }

    public resolveAttack(): void {
        const attacker = this.getCurrentPlayer();
        const defender = this.getDefender();
        
        if (!defender) {
            uiManager.showAlert('방어자가 지정되지 않았습니다!');
            return;
        }

        // 공격 데미지 계산
        let totalHealthDamage = this.session.attackCards.reduce(
            (sum, card) => sum + card.healthDamage, 0
        );
        let totalMentalDamage = this.session.attackCards.reduce(
            (sum, card) => sum + card.mentalDamage, 0
        );

        // 필드 마법: 화염의 대지 (발동자 공격력 +5)
        if (this.session.fieldMagic?.name === '화염의 대지' && 
            this.session.fieldMagic.casterId === attacker.id) {
            totalHealthDamage += 5;
        }

        // 필드 마법: 얼음 왕국 (적 공격력 -3)
        if (this.session.fieldMagic?.name === '얼음 왕국' && 
            this.session.fieldMagic.casterId !== attacker.id) {
            totalHealthDamage = Math.max(0, totalHealthDamage - 3);
        }

        // 정신력 소모
        const mentalCost = this.session.attackCards.reduce(
            (sum, card) => sum + card.mentalCost, 0
        );
        attacker.mentalPower = Math.max(0, attacker.mentalPower - mentalCost);

        // 방어 처리
        let totalDefense = 0;
        let hasReflect = false;
        let hasBounce = false;

        this.session.defenseCards.forEach(card => {
            if (card.effect === CardEffect.REFLECT) {
                hasReflect = true;
            } else if (card.effect === CardEffect.BOUNCE) {
                hasBounce = true;
            } else {
                totalDefense += card.defense;
            }

            // 정신력 소모 (방어 마법)
            defender.mentalPower = Math.max(0, defender.mentalPower - card.mentalCost);
        });

        // 필드 마법: 얼음 왕국 (발동자 방어력 +5)
        if (this.session.fieldMagic?.name === '얼음 왕국' && 
            this.session.fieldMagic.casterId === defender.id) {
            totalDefense += 5;
        }

        // 되받아치기 - 공격자가 새로운 방어자가 됨
        if (hasReflect) {
            uiManager.addLogMessage(`${defender.name}이(가) 공격을 되받아쳤습니다!`);
            
            // 공격자와 방어자 교체
            const originalAttacker = attacker.id;
            this.session.defenderId = originalAttacker;
            
            // 방어 카드 초기화하고 재귀적으로 방어 기회 제공
            this.session.defenseCards = [];
            
            uiManager.addLogMessage(`${attacker.name}이(가) 반격에 대응할 수 있습니다!`);
            // 여기서 이벤트를 발생시켜야 함 (연쇄 대응을 위해)
            return;
        }

        // 튕기기 - 랜덤한 다른 플레이어가 방어자가 됨
        if (hasBounce) {
            const alivePlayers = this.session.players.filter(
                p => p.isAlive && p.id !== attacker.id && p.id !== defender.id
            );
            
            if (alivePlayers.length > 0) {
                const randomTarget = alivePlayers[Math.floor(Math.random() * alivePlayers.length)];
                uiManager.addLogMessage(
                    `${defender.name}이(가) 공격을 튕겨냈습니다! ${randomTarget.name}이(가) 대상이 됩니다!`
                );
                
                // 새로운 방어자 지정
                this.session.defenderId = randomTarget.id;
                
                // 방어 카드 초기화하고 재귀적으로 방어 기회 제공
                this.session.defenseCards = [];
                
                uiManager.addLogMessage(`${randomTarget.name}이(가) 대응할 수 있습니다!`);
                // 여기서 이벤트를 발생시켜야 함 (연쇄 대응을 위해)
                return;
            }
        }

        // 방어력 적용
        const finalHealthDamage = Math.max(0, totalHealthDamage - totalDefense);

        uiManager.addLogMessage(
            `${attacker.name}의 공격! (${totalHealthDamage} 데미지, 방어 ${totalDefense})`
        );

        // 데미지 적용
        this.applyDamage(defender, finalHealthDamage, totalMentalDamage);

        this.endAttackPhase();
    }

    private applyDamage(player: Player, healthDamage: number, mentalDamage: number): void {
        player.health = Math.max(0, player.health - healthDamage);
        player.mentalPower = Math.max(0, player.mentalPower - mentalDamage);

        if (healthDamage > 0) {
            uiManager.addLogMessage(
                `${player.name}이(가) ${healthDamage}의 체력 데미지를 받았습니다!`
            );
        }
        
        if (mentalDamage > 0) {
            uiManager.addLogMessage(
                `${player.name}이(가) ${mentalDamage}의 정신력 데미지를 받았습니다!`
            );
        }

        // 정신력 0 체크
        if (player.mentalPower === 0 && player.isAlive) {
            this.applyMentalBreakDebuff(player);
        }

        // 사망 체크
        if (player.health === 0) {
            player.isAlive = false;
            uiManager.addLogMessage(`💀 ${player.name}이(가) 쓰러졌습니다!`);
            this.checkGameEnd();
        }
    }

    private applyMentalBreakDebuff(player: Player): void {
        const debuffTypes = [
            DebuffType.CARD_DECAY,
            DebuffType.RANDOM_TARGET,
            DebuffType.DAMAGE_INCREASE
        ];

        const randomDebuff = debuffTypes[Math.floor(Math.random() * debuffTypes.length)];
        const debuff: Debuff = {
            type: randomDebuff,
            duration: -1, // 영구
            value: randomDebuff === DebuffType.DAMAGE_INCREASE ? 50 : undefined
        };

        player.debuffs.push(debuff);
        
        const debuffNames = {
            [DebuffType.CARD_DECAY]: '카드 소멸 저주',
            [DebuffType.RANDOM_TARGET]: '혼돈의 저주',
            [DebuffType.DAMAGE_INCREASE]: '취약 저주'
        };

        uiManager.addLogMessage(
            `⚠️ ${player.name}의 정신력이 0이 되었습니다! [${debuffNames[randomDebuff]}] 디버프 적용!`
        );
    }

    private applyDebuffs(player: Player): void {
        player.debuffs.forEach(debuff => {
            switch (debuff.type) {
                case DebuffType.CARD_DECAY:
                    if (player.cards.length > 0) {
                        const randomIndex = Math.floor(Math.random() * player.cards.length);
                        const removedCard = player.cards.splice(randomIndex, 1)[0];
                        uiManager.addLogMessage(
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
                    this.applyDamage(player, 5, 0);
                    uiManager.addLogMessage(`🔥 ${player.name}이(가) 화염의 대지에서 5 데미지를 받았습니다!`);
                }
            });
        } else if (fieldMagic.name === '치유의 성역' && caster && caster.isAlive) {
            // 발동자는 매 턴 체력 10 회복
            caster.health = Math.min(caster.maxHealth, caster.health + 10);
            uiManager.addLogMessage(`✨ ${caster.name}이(가) 치유의 성역에서 체력 10을 회복했습니다!`);
        } else if (fieldMagic.name === '얼음 왕국' && caster && caster.isAlive) {
            // 공격력 감소는 resolveAttack에서 처리
            uiManager.addLogMessage(`❄️ 얼음 왕국이 모든 적의 공격력을 약화시킵니다!`);
        } else if (fieldMagic.name === '마력의 폭풍' && caster && caster.isAlive) {
            // 발동자는 매 턴 정신력 3 회복
            caster.mentalPower = Math.min(caster.maxMentalPower, caster.mentalPower + 3);
            uiManager.addLogMessage(`⚡ ${caster.name}이(가) 마력의 폭풍에서 정신력 3을 회복했습니다!`);
        } else if (fieldMagic.name === '혼돈의 소용돌이') {
            // 공격 대상 랜덤 지정은 showTargetSelection에서 처리
            uiManager.addLogMessage(`🌀 혼돈의 소용돌이가 전장을 휘감습니다!`);
        }

        // 지속 시간 감소
        fieldMagic.duration--;
        if (fieldMagic.duration <= 0) {
            uiManager.addLogMessage(`필드 마법 [${fieldMagic.name}]의 효과가 끝났습니다!`);
            this.session.fieldMagic = undefined;
            uiManager.updateFieldMagic(null);
        }
    }

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
            this.applyDamage(target, 10, 0);
            uiManager.addLogMessage(`😈 악마가 나타나 ${target.name}에게 10 데미지!`);
        } else if (eventRoll < 0.66) {
            this.applyDamage(target, 20, 0);
            uiManager.addLogMessage(`😈 악마가 나타나 ${target.name}에게 20 데미지!`);
        } else if (eventRoll < 0.9) {
            this.applyDamage(target, 30, 0);
            uiManager.addLogMessage(`😈 악마가 나타나 ${target.name}에게 30 데미지!`);
        } else {
            // 카드 2장 삭제
            const cardsToRemove = Math.min(2, target.cards.length);
            for (let i = 0; i < cardsToRemove; i++) {
                target.cards.pop();
            }
            uiManager.addLogMessage(`😈 악마가 ${target.name}의 카드 ${cardsToRemove}장을 파괴했습니다!`);
        }
    }

    private angelEvent(): void {
        const alivePlayers = this.session.players.filter(p => p.isAlive);
        if (alivePlayers.length === 0) return;

        const target = alivePlayers[Math.floor(Math.random() * alivePlayers.length)];
        
        if (Math.random() < 0.5) {
            target.health = Math.min(target.maxHealth, target.health + 10);
            uiManager.addLogMessage(`😇 천사가 나타나 ${target.name}의 체력을 10 회복!`);
        } else {
            target.mentalPower = Math.min(target.maxMentalPower, target.mentalPower + 10);
            uiManager.addLogMessage(`😇 천사가 나타나 ${target.name}의 정신력을 10 회복!`);
        }
    }

    private endAttackPhase(): void {
        // 사용한 카드 제거
        const attacker = this.getCurrentPlayer();
        const defender = this.getDefender();

        this.session.attackCards.forEach(card => {
            const index = attacker.cards.findIndex(c => c.id === card.id);
            if (index !== -1) {
                attacker.cards.splice(index, 1);
            }
        });

        if (defender) {
            this.session.defenseCards.forEach(card => {
                const index = defender.cards.findIndex(c => c.id === card.id);
                if (index !== -1) {
                    defender.cards.splice(index, 1);
                }
            });
        }

        // 상태 초기화
        this.session.attackCards = [];
        this.session.defenseCards = [];
        this.session.attackerId = undefined;
        this.session.defenderId = undefined;
        
        uiManager.updateCombatNames('-', '-');
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

        this.session.currentPlayerId = this.session.players[nextIndex].id;
        this.session.currentTurn++;
        this.session.state = GameState.PLAYING;

        this.startTurn();
    }

    private checkGameEnd(): void {
        const alivePlayers = this.session.players.filter(p => p.isAlive);
        
        if (alivePlayers.length === 1) {
            this.session.state = GameState.ENDED;
            const winner = alivePlayers[0];
            uiManager.addLogMessage(`🏆 ${winner.name}의 승리!`);
            uiManager.showAlert(`게임 종료! ${winner.name}의 승리!`);
        } else if (alivePlayers.length === 0) {
            this.session.state = GameState.ENDED;
            uiManager.addLogMessage('무승부!');
            uiManager.showAlert('게임 종료! 무승부!');
        }
    }

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
}
