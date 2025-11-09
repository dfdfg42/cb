import { Player, Card, CardType, CardEffect, GameSession, Debuff, DebuffType } from '../types';
import { IUIManager } from '../ui/IUIManager';

/**
 * CombatManager - 전투 로직 전담 클래스
 * 공격/방어 선택, 데미지 계산, 특수 효과 처리
 */
export class CombatManager {
    private uiManager: IUIManager;

    constructor(uiManager: IUIManager) {
        this.uiManager = uiManager;
    }

    /**
     * 공격 카드 선택
     */
    public selectAttackCards(
        cards: Card[],
        currentPlayer: Player
    ): boolean {
        if (cards.length === 0) {
            this.uiManager.showAlert('카드를 선택해주세요!');
            return false;
        }

        // 필드 마법 카드 확인
        const fieldMagicCards = cards.filter(c => c.type === CardType.FIELD_MAGIC);
        if (fieldMagicCards.length > 0) {
            if (cards.length > 1) {
                this.uiManager.showAlert('필드 마법은 단독으로만 사용 가능합니다!');
                return false;
            }
            // 필드 마법은 정신력만 확인
            const mentalCost = fieldMagicCards[0].mentalCost;
            if (mentalCost > currentPlayer.mentalPower) {
                this.uiManager.showAlert('정신력이 부족합니다!');
                return false;
            }
            return true;
        }

        // 마법 카드는 1장만 가능
        const magicCards = cards.filter(c => c.type === CardType.MAGIC);
        if (magicCards.length > 1) {
            this.uiManager.showAlert('마법 카드는 한 번에 1장만 사용 가능합니다!');
            return false;
        }

        // 정신력 확인 (마법 카드)
        const totalMentalCost = cards.reduce((sum, card) => sum + card.mentalCost, 0);
        if (totalMentalCost > currentPlayer.mentalPower) {
            this.uiManager.showAlert('정신력이 부족합니다!');
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
                this.uiManager.showAlert('+ 접두사 카드는 같은 종류만 함께 사용 가능합니다!');
                return false;
            }
            
            if (plusCards.length > maxCards) {
                this.uiManager.showAlert(`이 카드는 최대 ${maxCards}장까지 사용 가능합니다!`);
                return false;
            }
        }

        // 일반 공격 카드 + 다른 카드 혼합 불가
        const normalAttacks = cards.filter(c => c.type === CardType.ATTACK && c.plusLevel === 0);
        if (normalAttacks.length > 0 && cards.length > 1) {
            this.uiManager.showAlert('일반 공격 카드는 1장만 사용 가능합니다!');
            return false;
        }

        return true;
    }

    /**
     * 방어 카드 선택
     */
    public selectDefenseCards(cards: Card[]): boolean {
        // 방어 카드 확인
        const validDefense = cards.every(c => 
            c.type === CardType.DEFENSE || 
            c.type === CardType.MAGIC
        );

        if (!validDefense) {
            this.uiManager.showAlert('방어 카드 또는 마법 카드만 사용 가능합니다!');
            return false;
        }

        return true;
    }

    /**
     * 공격 해결 로직
     * @returns true if combat resolved, false if chained (reflect/bounce)
     */
    public resolveAttack(
        session: GameSession,
        attacker: Player,
        defender: Player
    ): { resolved: boolean; newDefenderId?: string } {
        // 공격/회복 처리
        let totalHealthDamage = 0;
        let totalMentalDamage = 0;

        // 필드 마법: 화염의 대지 (발동자 공격력 +5)
        if (session.fieldMagic?.name === '화염의 대지' && 
            session.fieldMagic.casterId === attacker.id) {
            totalHealthDamage += 5;
        }

        // 필드 마법: 얼음 왕국 (적 공격력 -3)
        if (session.fieldMagic?.name === '얼음 왕국' && 
            session.fieldMagic.casterId !== attacker.id) {
            totalHealthDamage = Math.max(0, totalHealthDamage - 3);
        }

        // 각 카드 적용: HEAL은 즉시 회복을 적용
        session.attackCards.forEach(card => {
            if (card.effect === CardEffect.HEAL) {
                const healAmt = this.extractHealAmount(card);
                if (healAmt > 0 && defender.isAlive) {
                    defender.health = Math.min(100, defender.health + healAmt);
                    this.uiManager.addLogMessage(
                        `✨ ${defender.name}이(가) ${healAmt}의 체력을 회복했습니다!`
                    );
                }
            } else {
                totalHealthDamage += card.healthDamage || 0;
                totalMentalDamage += card.mentalDamage || 0;
            }
        });

        // 정신력 소모
        const mentalCost = session.attackCards.reduce((sum, card) => sum + card.mentalCost, 0);
        attacker.mentalPower = Math.max(0, attacker.mentalPower - mentalCost);

        // 방어 처리
        let totalDefense = 0;
        let hasReflect = false;
        let hasBounce = false;

        session.defenseCards.forEach(card => {
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
        if (session.fieldMagic?.name === '얼음 왕국' && 
            session.fieldMagic.casterId === defender.id) {
            totalDefense += 5;
        }

        // 되받아치기 - 공격자가 새로운 방어자가 됨
        if (hasReflect) {
            this.uiManager.addLogMessage(`${defender.name}이(가) 공격을 되받아쳤습니다!`);
            this.uiManager.addLogMessage(`${attacker.name}이(가) 반격에 대응할 수 있습니다!`);
            
            return { 
                resolved: false, 
                newDefenderId: attacker.id 
            };
        }

        // 튕기기 - 랜덤한 다른 플레이어가 방어자가 됨
        if (hasBounce) {
            const alivePlayers = session.players.filter(
                p => p.isAlive && p.id !== attacker.id && p.id !== defender.id
            );
            
            if (alivePlayers.length > 0) {
                const randomTarget = alivePlayers[Math.floor(Math.random() * alivePlayers.length)];
                this.uiManager.addLogMessage(
                    `${defender.name}이(가) 공격을 튕겨냈습니다! ${randomTarget.name}이(가) 대상이 됩니다!`
                );
                this.uiManager.addLogMessage(`${randomTarget.name}이(가) 대응할 수 있습니다!`);
                
                return { 
                    resolved: false, 
                    newDefenderId: randomTarget.id 
                };
            }
        }

        // 방어력 적용
        const finalHealthDamage = Math.max(0, totalHealthDamage - totalDefense);

        this.uiManager.addLogMessage(
            `${attacker.name}의 공격! (${totalHealthDamage} 데미지, 방어 ${totalDefense})`
        );

        // 데미지 적용
        this.applyDamage(defender, finalHealthDamage, totalMentalDamage);

        return { resolved: true };
    }

    /**
     * 데미지 적용
     */
    public applyDamage(player: Player, healthDamage: number, mentalDamage: number): void {
        player.health = Math.max(0, player.health - healthDamage);
        player.mentalPower = Math.max(0, player.mentalPower - mentalDamage);

        if (healthDamage > 0) {
            this.uiManager.addLogMessage(
                `${player.name}이(가) ${healthDamage}의 체력 데미지를 받았습니다!`
            );
        }
        
        if (mentalDamage > 0) {
            this.uiManager.addLogMessage(
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
            this.uiManager.addLogMessage(`💀 ${player.name}이(가) 쓰러졌습니다!`);
        }
    }

    /**
     * 정신력 고갈 시 디버프 적용
     */
    private applyMentalBreakDebuff(player: Player): void {
        const debuffTypes = [
            DebuffType.CARD_DECAY,
            DebuffType.RANDOM_TARGET,
            DebuffType.MENTAL_DRAIN,
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
            [DebuffType.MENTAL_DRAIN]: '정신력 고갈',
            [DebuffType.DAMAGE_INCREASE]: '취약 저주'
        };

        this.uiManager.addLogMessage(
            `⚠️ ${player.name}의 정신력이 0이 되었습니다! [${debuffNames[randomDebuff]}] 디버프 적용!`
        );
    }

    /**
     * 사용한 카드들을 플레이어 손에서 제거
     */
    public removeUsedCards(
        attacker: Player,
        defender: Player | undefined,
        attackCards: Card[],
        defenseCards: Card[]
    ): void {
        attackCards.forEach(card => {
            const index = attacker.cards.findIndex(c => c.id === card.id);
            if (index !== -1) {
                attacker.cards.splice(index, 1);
            }
        });

        if (defender) {
            defenseCards.forEach(card => {
                const index = defender.cards.findIndex(c => c.id === card.id);
                if (index !== -1) {
                    defender.cards.splice(index, 1);
                }
            });
        }
    }

    /**
     * 힐 카드에서 회복량 추출
     */
    private extractHealAmount(card: Card): number {
        // 우선적으로 healthDamage 필드를 사용
        if (card.healthDamage && card.healthDamage > 0) return card.healthDamage;
        
        // description에서 숫자 추출
        if (card.description) {
            const m = card.description.match(/(\d+)/);
            if (m) return parseInt(m[1], 10);
        }
        return 0;
    }
}
