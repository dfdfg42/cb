import { Screen } from '../types';

export class UIManager {
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
        const fieldMagicArea = document.getElementById('field-magic-area');
        if (fieldMagicArea) {
            const label = fieldMagicArea.querySelector('.field-magic-label');
            if (label) {
                label.textContent = magicName || '필드 마법 없음';
            }
        }
    }
    
    // 공격자/방어자 이름 업데이트
    updateCombatNames(attackerName: string, defenderName: string): void {
        const attackerNameEl = document.getElementById('attacker-name');
        const defenderNameEl = document.getElementById('defender-name');
        
        if (attackerNameEl) attackerNameEl.textContent = attackerName;
        if (defenderNameEl) defenderNameEl.textContent = defenderName;
    }
    
    // 버튼 활성화/비활성화
    setButtonEnabled(buttonId: string, enabled: boolean): void {
        const button = document.getElementById(buttonId) as HTMLButtonElement;
        if (button) {
            button.disabled = !enabled;
        }
    }
    
    // 알림 표시 (간단한 알림)
    showAlert(message: string): void {
        // TODO: 더 나은 알림 UI 구현
        alert(message);
    }
}

export const uiManager = new UIManager();
