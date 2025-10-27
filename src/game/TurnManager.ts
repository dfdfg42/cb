import { GameState, PlayerState, GamePhase } from '../types/gameTypes';

export class TurnManager {
  private state: GameState;
  private subscribers: ((state: GameState) => void)[] = [];

  constructor(initialState: GameState) {
    this.state = initialState;
  }

  // 턴 진행
  nextTurn(): void {
    // 다음 생존 플레이어 찾기
    let nextPlayerIndex = this.getCurrentPlayerIndex();
    do {
      nextPlayerIndex = (nextPlayerIndex + 1) % this.state.players.length;
    } while (!this.state.players[nextPlayerIndex].isAlive);

    // 턴 정보 업데이트
    this.state.currentTurn++;
    this.state.currentPlayer = this.state.players[nextPlayerIndex].id;
    this.state.phase = GamePhase.DRAW;
    this.state.turnCount++;

    // 50턴 이후 악마 이벤트 체크
    if (this.state.turnCount >= 50) {
      this.checkDevilEvent();
    }

    // 천사 이벤트 체크 (5% 확률)
    if (Math.random() < 0.05) {
      this.checkAngelEvent();
    }

    this.notifySubscribers();
  }

  // 현재 플레이어 인덱스 찾기
  private getCurrentPlayerIndex(): number {
    return this.state.players.findIndex(p => p.id === this.state.currentPlayer);
  }

  // 악마 이벤트 체크 (50턴 이후 10% 확률)
  private checkDevilEvent(): void {
    if (Math.random() < 0.1) {
      const alivePlayers = this.state.players.filter(p => p.isAlive);
      if (alivePlayers.length > 0) {
        const target = alivePlayers[Math.floor(Math.random() * alivePlayers.length)];
        this.applyDevilEffect(target);
      }
    }
  }

  // 악마 효과 적용
  private applyDevilEffect(player: PlayerState): void {
    const effectType = Math.random();
    if (effectType < 0.3) {
      player.health = Math.max(0, player.health - 10); // 10 데미지
    } else if (effectType < 0.6) {
      player.health = Math.max(0, player.health - 20); // 20 데미지
    } else if (effectType < 0.9) {
      player.health = Math.max(0, player.health - 30); // 30 데미지
    } else {
      // 카드 2장 랜덤 삭제
      for (let i = 0; i < 2 && player.cards.length > 0; i++) {
        const randomIndex = Math.floor(Math.random() * player.cards.length);
        player.cards.splice(randomIndex, 1);
      }
    }

    if (player.health <= 0) {
      player.isAlive = false;
    }
  }

  // 천사 이벤트 체크
  private checkAngelEvent(): void {
    const alivePlayers = this.state.players.filter(p => p.isAlive);
    if (alivePlayers.length > 0) {
      const target = alivePlayers[Math.floor(Math.random() * alivePlayers.length)];
      this.applyAngelEffect(target);
    }
  }

  // 천사 효과 적용
  private applyAngelEffect(player: PlayerState): void {
    if (Math.random() < 0.5) {
      player.mentalPower = Math.min(player.maxMentalPower, player.mentalPower + 10);
    } else {
      player.health = Math.min(player.maxHealth, player.health + 10);
    }
  }

  // 구독
  subscribe(callback: (state: GameState) => void): void {
    this.subscribers.push(callback);
  }

  // 구독자들에게 알림
  private notifySubscribers(): void {
    this.subscribers.forEach(callback => callback(this.state));
  }
}