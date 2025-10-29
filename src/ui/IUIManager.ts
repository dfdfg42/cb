import { Screen } from '../types';

/**
 * IUIManager - UI 관리자 인터페이스
 * UIManager의 계약을 정의하여 의존성 역전 원칙(DIP) 준수
 */
export interface IUIManager {
    // 화면 관리
    showScreen(screen: Screen): void;
    getCurrentScreen(): Screen;
    
    // 모달 관리
    showModal(modalId: string): void;
    hideModal(modalId: string): void;
    
    // 로그 메시지
    addLogMessage(message: string): void;
    clearLog(): void;
    
    // 사용자 정보
    setUserName(name: string): void;
    
    // 게임 상태 표시
    updateTurnNumber(turn: number): void;
    updateFieldMagic(magicName: string | null): void;
    showCombatNames(attackerName: string, defenderName: string): void;
    clearCombatNames(): void;
    
    // 버튼 제어
    setButtonEnabled(buttonId: string, enabled: boolean): void;
    
    // 알림
    showAlert(message: string): void;
}
