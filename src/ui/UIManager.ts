import { Screen } from '../types';
import { IUIManager } from './IUIManager';

export class UIManager implements IUIManager {
    private currentScreen: Screen = Screen.MAIN;
    
    constructor() {
        this.hideAllScreens();
        this.showScreen(Screen.MAIN);
    }
    
    // 모든 화면 숨기기
    private hideAllScreens(): void {
        const screens = document.querySelectorAll('.screen');
        screens.forEach(screen => {
            screen.classList.remove('active');
        });
    }
    
    // 특정 화면 표시
    showScreen(screen: Screen): void {
        this.hideAllScreens();
        const screenElement = document.getElementById(screen);
        if (screenElement) {
            screenElement.classList.add('active');
            this.currentScreen = screen;
        }
    }
    
    // 현재 화면 가져오기
    getCurrentScreen(): Screen {
        return this.currentScreen;
    }
    
    // 모달 표시
    showModal(modalId: string): void {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('active');
        }
    }
    
    // 모달 숨기기
    hideModal(modalId: string): void {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('active');
        }
    }
    
    // 로그 메시지 추가
    addLogMessage(message: string): void {
        const gameLog = document.getElementById('game-log');
        if (gameLog) {
            const logDiv = document.createElement('div');
            logDiv.className = 'log-message';
            logDiv.textContent = message;
            gameLog.appendChild(logDiv);
            gameLog.scrollTop = gameLog.scrollHeight;
            
            // 로그가 너무 많아지면 오래된 것 제거
            const messages = gameLog.querySelectorAll('.log-message');
            if (messages.length > 20) {
                messages[0].remove();
            }
        }
    }
    
    // 로그 초기화
    clearLog(): void {
        const gameLog = document.getElementById('game-log');
        if (gameLog) {
            gameLog.innerHTML = '';
        }
    }
    
    // 사용자 이름 표시
    setUserName(name: string): void {
        const userNameDisplay = document.getElementById('user-name-display');
        if (userNameDisplay) {
            userNameDisplay.textContent = name;
        }
    }
    
    // 턴 번호 업데이트
    updateTurnNumber(turn: number): void {
        const turnNumber = document.getElementById('turn-number');
        if (turnNumber) {
            turnNumber.textContent = turn.toString();
        }
    }
    
    // 필드 마법 표시
    updateFieldMagic(magicName: string | null): void {
        const fieldMagicLabel = document.getElementById('summary-field-magic');
        if (fieldMagicLabel) {
            fieldMagicLabel.textContent = magicName || '필드 마법 없음';
        }
    }
    
    // 공격자/방어자 이름 업데이트
    // 공격자/방어자 이름 업데이트 — 실제 공격이 확정되었을 때만 호출하세요
    showCombatNames(attackerName: string, defenderName: string): void {
        const summaryPlayersEl = document.getElementById('summary-players');
        if (summaryPlayersEl) {
            summaryPlayersEl.textContent = `${attackerName} → ${defenderName}`;
        }
    }

    // 전투 중앙 이름 표시 초기화 (공격/방어가 끝났거나 취소되었을 때 호출)
    clearCombatNames(): void {
        const summaryPlayersEl = document.getElementById('summary-players');
        if (summaryPlayersEl) {
            summaryPlayersEl.textContent = '- → -';
        }
    }

    // 기존 updateCombatNames는 더이상 사용하지 않습니다. 필요하면 showCombatNames/clearCombatNames를 사용하세요.
    
    // 버튼 활성화/비활성화
    setButtonEnabled(buttonId: string, enabled: boolean): void {
        const button = document.getElementById(buttonId) as HTMLButtonElement;
        if (button) {
            button.disabled = !enabled;
        }
    }
    
    // 알림 표시 (간단한 알림)
    showAlert(message: string): void {
        // 게임 화면 내에서 표시할 수 있는 배너를 우선으로 사용합니다.
        const gameScreen = document.getElementById('game-screen');
        if (gameScreen && this.currentScreen === (window as any).Screen?.GAME) {
            // 배너 요소 생성
            const banner = document.createElement('div');
            banner.className = 'in-game-alert';
            banner.textContent = message;

            // 배너 추가 및 자동 제거
            gameScreen.appendChild(banner);
            // 트랜지션을 위해 약간의 딜레이 후 visible 클래스 추가
            requestAnimationFrame(() => banner.classList.add('visible'));

            setTimeout(() => {
                banner.classList.remove('visible');
                // 애니메이션 후 제거
                setTimeout(() => banner.remove(), 400);
            }, 3000);
            return;
        }

        // 게임 화면이 아니면 기본 alert 사용
        alert(message);
    }
}

export const uiManager = new UIManager();
