import './styles/main.css';
import { uiManager } from './ui/UIManager';
import { Screen, Player } from './types';
import { HandManager } from './ui/CardComponent';
import { PlayersManager } from './ui/PlayerComponent';
import { drawRandomCards } from './data/cards';
import { GameManager } from './game/GameManager';
import { CombatUI } from './ui/CombatUI';
import { soundManager } from './audio/SoundManager';
import { socketClient } from './network/SocketClient';

class Game {
    private userName: string = '';
    private handManager?: HandManager;
    private playersManager: PlayersManager;
    private currentPlayerId: string = '';
    private gameManager?: GameManager;
    private combatUI?: CombatUI;
    private isMultiplayer: boolean = false;
    private pendingJoinMode: 'normal' | 'ranked' | null = null;
    
    constructor() {
        this.playersManager = new PlayersManager();
        this.initializeEventListeners();
        this.setupSocketListeners();
        console.log('🎮 카드 배틀 게임 시작!');
    }
    
    private initializeEventListeners(): void {
        // 메인 화면 - 입장하기
        const enterBtn = document.getElementById('enter-btn');
        const usernameInput = document.getElementById('username-input') as HTMLInputElement;
        
        if (enterBtn && usernameInput) {
            enterBtn.addEventListener('click', () => {
                soundManager.playClick();
                const name = usernameInput.value.trim();
                if (name.length === 0) {
                    uiManager.showAlert('닉네임을 입력해주세요!');
                    return;
                }
                if (name.length > 12) {
                    uiManager.showAlert('닉네임은 12자 이하로 입력해주세요!');
                    return;
                }
                this.userName = name;
                this.enterLobby();
            });
            
            // Enter 키로도 입장 가능
            usernameInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    enterBtn.click();
                }
            });
        }
        
        // 로비 화면 - 게임 모드 선택
        const normalGameBtn = document.getElementById('normal-game-btn');
        const rankGameBtn = document.getElementById('rank-game-btn');
        const helpBtn = document.getElementById('help-btn');
        
        if (normalGameBtn) {
            normalGameBtn.addEventListener('click', () => {
                soundManager.playClick();
                this.joinGame('normal');
            });
        }
        
        if (rankGameBtn) {
            rankGameBtn.addEventListener('click', () => {
                soundManager.playClick();
                this.joinGame('ranked');
            });
        }
        
        if (helpBtn) {
            helpBtn.addEventListener('click', () => {
                soundManager.playClick();
                uiManager.showScreen(Screen.HELP);
            });
        }
        
        // 도움말 화면 - 뒤로가기
        const backToLobbyBtn = document.getElementById('back-to-lobby-btn');
        if (backToLobbyBtn) {
            backToLobbyBtn.addEventListener('click', () => {
                uiManager.showScreen(Screen.LOBBY);
            });
        }
        
        // 대기실 - 나가기
        const leaveRoomBtn = document.getElementById('leave-room-btn');
        if (leaveRoomBtn) {
            leaveRoomBtn.addEventListener('click', () => {
                this.leaveRoom();
            });
        }
        
        // 대기실 - 준비
        const readyBtn = document.getElementById('ready-btn');
        if (readyBtn) {
            readyBtn.addEventListener('click', () => {
                this.toggleReady();
            });
        }
        
        // 게임 화면 - 확정/턴 종료
        const confirmBtn = document.getElementById('confirm-btn');
        const endTurnBtn = document.getElementById('end-turn-btn');
        
        if (confirmBtn) {
            confirmBtn.addEventListener('click', () => {
                soundManager.playClick();
                this.confirmAction();
            });
        }
        
        if (endTurnBtn) {
            endTurnBtn.addEventListener('click', () => {
                soundManager.playClick();
                this.endTurn();
            });
        }
        
        // 카드 상세 모달 닫기
        const closeModalBtns = document.querySelectorAll('.close-modal');
        closeModalBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                uiManager.hideModal('card-detail-modal');
            });
        });
        
        // 게임 오버 버튼
        const restartBtn = document.getElementById('restart-btn');
        const toLobbyBtn = document.getElementById('to-lobby-btn');
        
        if (restartBtn) {
            restartBtn.addEventListener('click', () => {
                soundManager.playClick();
                this.startGame();
            });
        }
        
        if (toLobbyBtn) {
            toLobbyBtn.addEventListener('click', () => {
                soundManager.playClick();
                uiManager.showScreen(Screen.LOBBY);
            });
        }
    }
    
    private setupSocketListeners(): void {
        // 방 생성 완료
        socketClient.setOnRoomCreated((data) => {
            console.log('방 생성 완료:', data.roomId);
            uiManager.showScreen(Screen.WAITING);
            this.updateRoomPlayers(data.room.players);
        });
        
        // 방 참가 완료
        socketClient.setOnRoomJoined((data) => {
            console.log('방 참가 완료:', data.roomId);
            uiManager.showScreen(Screen.WAITING);
            this.updateRoomPlayers(data.room.players);
        });
        
        // 방 상태 업데이트
    socketClient.setOnRoomUpdated((data) => {
            console.log('방 업데이트');
            this.updateRoomPlayers(data.room.players);
            
            // 모든 플레이어가 준비되었는지 확인
            const readyBtn = document.getElementById('ready-btn');
            if (readyBtn && data.room.players.length >= 2) {
                const isHost = data.room.players[0].name === this.userName;
                const allReady = data.room.players.slice(1).every(p => p.isReady);
                
                if (isHost && allReady) {
                    readyBtn.textContent = '게임 시작';
                    readyBtn.classList.add('btn-primary');
                    readyBtn.onclick = () => {
                        soundManager.playClick();
                        socketClient.startGame();
                    };
                }
            }
        });

        // 방 목록 수신 (getRooms 결과)
        socketClient.setOnRoomsList((data) => {
            console.log('rooms-list 수신:', data.rooms);

            if (!this.pendingJoinMode) return;

            // 같은 모드의 방 중 첫 번째 사용 가능한 방으로 참가
            const targetRoom = data.rooms.find((r: any) => r.gameType === this.pendingJoinMode);

            if (targetRoom) {
                console.log('빈 방 발견, 참가 시도:', targetRoom.id);
                socketClient.joinRoom(targetRoom.id);
            } else {
                console.log('빈 방 없음, 새로 방 생성:', this.pendingJoinMode);
                socketClient.createRoom(this.pendingJoinMode);
            }

            this.pendingJoinMode = null;
        });
        
        // 게임 시작
        socketClient.setOnGameStarting((data) => {
            console.log('게임 시작!');
            uiManager.showAlert('게임이 곧 시작됩니다!');
            
            // 멀티플레이어 게임 초기화
            setTimeout(() => {
                this.startMultiplayerGame(data.room.players);
            }, 2000);
        });
        
        // 에러 처리
        socketClient.setOnError((data) => {
            uiManager.showAlert(data.message);
        });
        
        // 플레이어 연결 해제
        socketClient.setOnPlayerDisconnected((data) => {
            uiManager.showAlert(`${data.playerName}님이 연결을 종료했습니다.`);
        });
        
        // 공격 수신
        socketClient.setOnPlayerAttack((data) => {
            console.log('공격 수신:', data);
            if (!this.gameManager) return;
            
            // 공격 애니메이션 및 UI 업데이트
            const attacker = this.gameManager.getPlayerById(data.attackerId);
            const target = this.gameManager.getPlayerById(data.targetId);
            
            if (attacker && target) {
                uiManager.updateCombatNames(attacker.name, target.name);
                uiManager.addLogMessage(`${attacker.name}이(가) ${target.name}을(를) 공격! (${data.damage} 데미지)`);
                this.playersManager.refreshAll();
            }
        });
        
        // 방어 수신
        socketClient.setOnPlayerDefend((data) => {
            console.log('방어 수신:', data);
            if (!this.gameManager) return;
            
            const defender = this.gameManager.getPlayerById(data.defenderId);
            if (defender) {
                uiManager.addLogMessage(`${defender.name}이(가) 방어! (${data.defense} 방어력)`);
                this.playersManager.refreshAll();
            }
        });
        
        // 턴 종료 수신
        socketClient.setOnTurnEnd((data) => {
            console.log('턴 종료 수신:', data);
            if (!this.gameManager) return;
            
            const currentPlayer = this.gameManager.getPlayerById(data.nextPlayerId);
            if (currentPlayer) {
                uiManager.addLogMessage(`${currentPlayer.name}의 턴입니다!`);
                this.playersManager.setActivePlayer(data.nextPlayerId);
                
                // 로컬 플레이어의 턴이면 카드 활성화
                if (data.nextPlayerId === this.currentPlayerId) {
                    this.handManager?.setEnabled(true);
                } else {
                    this.handManager?.setEnabled(false);
                }
            }
        });
        
        // 특수 이벤트 수신
        socketClient.setOnSpecialEvent((data) => {
            console.log('특수 이벤트 수신:', data);
            if (!this.gameManager) return;
            
            uiManager.addLogMessage(`특수 이벤트 발생: ${data.eventType}`);
            // 특수 이벤트 처리 로직
        });
        
        // 플레이어 상태 업데이트 수신
        socketClient.setOnPlayerStateUpdate((data) => {
            console.log('플레이어 상태 업데이트:', data);
            if (!this.gameManager) return;
            
            this.playersManager.refreshAll();
        });
        
        // 게임 종료 수신
        socketClient.setOnGameOver((data) => {
            console.log('게임 종료 수신:', data);
            if (!this.gameManager) return;
            
            const winner = this.gameManager.getPlayerById(data.winnerId);
            this.showGameOver(winner);
        });
    }
    
    private updateRoomPlayers(players: any[]): void {
        // 모든 슬롯 초기화
        for (let i = 0; i < 4; i++) {
            const slot = document.getElementById(`player-slot-${i}`);
            if (slot) {
                if (i < players.length) {
                    const player = players[i];
                    const isHost = i === 0;
                    slot.innerHTML = `
                        <div class="player-info-waiting">
                            <div class="name">${player.name}${isHost ? ' 👑' : ''}</div>
                            <div class="status ${player.isReady || isHost ? 'ready' : 'not-ready'}">
                                ${player.isReady || isHost ? '준비 완료' : '대기 중'}
                            </div>
                        </div>
                    `;
                } else {
                    slot.innerHTML = '<div class="player-info-waiting empty">빈 슬롯</div>';
                }
            }
        }
        
        // 준비 버튼 상태 업데이트
        const readyBtn = document.getElementById('ready-btn');
        if (readyBtn) {
            const myPlayer = players.find(p => p.name === this.userName);
            if (myPlayer) {
                const isHost = players[0].name === this.userName;
                if (isHost) {
                    (readyBtn as HTMLButtonElement).textContent = '대기 중...';
                    (readyBtn as HTMLButtonElement).disabled = true;
                    readyBtn.classList.remove('btn-primary');
                } else {
                    (readyBtn as HTMLButtonElement).textContent = myPlayer.isReady ? '준비 취소' : '준비';
                    (readyBtn as HTMLButtonElement).disabled = false;
                    if (myPlayer.isReady) {
                        readyBtn.classList.add('btn-secondary');
                    } else {
                        readyBtn.classList.remove('btn-secondary');
                    }
                }
            }
        }
    }
    
    private enterLobby(): void {
        console.log(`${this.userName} 님이 로비에 입장했습니다.`);
        uiManager.setUserName(this.userName);
        uiManager.showScreen(Screen.LOBBY);
        
        // 서버 연결
        socketClient.connect(this.userName);
    }
    
    private joinGame(mode: 'normal' | 'ranked'): void {
        console.log(`${mode} 게임 참가`);
        soundManager.playClick();
        
        const roomType = document.getElementById('room-type');
        if (roomType) {
            roomType.textContent = mode === 'normal' ? '일반전 대기실' : '랭크전 대기실';
        }
        
    // 멀티플레이어 모드
    this.isMultiplayer = true;

    // 빈 방이 있는지 서버에 요청하고, 있으면 참가, 없으면 방 생성
    this.pendingJoinMode = mode;
    socketClient.getRooms(mode);
    }
    
    private leaveRoom(): void {
        console.log('방 나가기');
        soundManager.playClick();
        
        if (this.isMultiplayer) {
            socketClient.leaveRoom();
        }
        
        uiManager.showScreen(Screen.LOBBY);
    }
    
    private toggleReady(): void {
        soundManager.playClick();
        
        if (this.isMultiplayer) {
            socketClient.toggleReady();
        } else {
            // 로컬 모드
            const readyBtn = document.getElementById('ready-btn');
            if (readyBtn) {
                const isReady = readyBtn.textContent === '준비';
                readyBtn.textContent = isReady ? '준비 취소' : '준비';
                readyBtn.classList.toggle('btn-secondary');
                
                // 첫 번째 슬롯 (내 슬롯) 준비 상태 업데이트
                this.updatePlayerSlot(0, this.userName, isReady);
            }
        }
    }
    
    private updatePlayerSlot(index: number, name: string, isReady: boolean): void {
        const slot = document.getElementById(`player-slot-${index}`);
        if (slot) {
            slot.innerHTML = `
                <div class="player-info-waiting">
                    <div class="name">${name}</div>
                    <div class="status ${isReady ? 'ready' : 'not-ready'}">
                        ${isReady ? '준비 완료' : '대기 중'}
                    </div>
                </div>
            `;
        }
    }
    
    private confirmAction(): void {
        if (!this.gameManager || !this.handManager) return;

        if (!this.gameManager.isLocalPlayerTurn()) {
            uiManager.showAlert('당신의 턴이 아닙니다!');
            return;
        }

        const selectedCards = this.handManager.getSelectedCards();
        
        if (selectedCards.length === 0) {
            uiManager.showAlert('카드를 선택하세요!');
            return;
        }

        // 공격 페이즈: 공격/마법 카드만 선택 가능
        const invalidCards = selectedCards.filter(c => 
            c.type !== 'attack' && c.type !== 'magic' && c.type !== 'field-magic'
        );
        
        if (invalidCards.length > 0) {
            uiManager.showAlert('공격 턴에는 공격 카드나 마법 카드만 사용할 수 있습니다!');
            return;
        }

        // 마법 카드는 단독으로만 사용 가능
        const hasMagic = selectedCards.some(c => c.type === 'magic' || c.type === 'field-magic');
        if (hasMagic && selectedCards.length > 1) {
            uiManager.showAlert('마법 카드는 단독으로만 사용할 수 있습니다!');
            return;
        }

        // 공격 카드 선택
        if (this.gameManager.selectAttackCards(selectedCards)) {
            soundManager.playCardUse();
            
            // 필드 마법 카드 확인
            const hasFieldMagic = selectedCards.some(c => c.type === 'field-magic');
            if (hasFieldMagic) {
                // 필드 마법 사용
                this.useFieldMagic(selectedCards[0]);
                return;
            }
            
            // 마법 카드가 아니면 대상 선택
            if (!hasMagic) {
                this.showTargetSelection();
            } else {
                // 마법 카드는 즉시 사용
                this.gameManager.resolveAttack();
                this.updateGameState();
                
                // 손패 업데이트
                const localPlayer = this.gameManager.getLocalPlayer();
                this.handManager.clearHand();
                this.handManager.addCards(localPlayer.cards);
            }
        } else {
            uiManager.showAlert('카드를 사용할 수 없습니다!');
        }
    }
    
    private useFieldMagic(card: any): void {
        if (!this.gameManager) return;
        
        const currentPlayer = this.gameManager.getCurrentPlayer();
        
        // 기존 필드 마법 제거
        const session = this.gameManager.getSession();
        if (session.fieldMagic) {
            uiManager.addLogMessage(`기존 필드 마법 [${session.fieldMagic.name}]이(가) 사라졌습니다!`);
        }
        
        // 새 필드 마법 적용
        session.fieldMagic = {
            id: card.id,
            name: card.name,
            casterId: currentPlayer.id,
            effect: card.effect,
            duration: 5  // 5턴 지속
        };
        
        // 정신력 소모
        currentPlayer.mentalPower = Math.max(0, currentPlayer.mentalPower - card.mentalCost);
        
        // 카드 제거
        const cardIndex = currentPlayer.cards.findIndex(c => c.id === card.id);
        if (cardIndex !== -1) {
            currentPlayer.cards.splice(cardIndex, 1);
        }
        
        uiManager.addLogMessage(`${currentPlayer.name}이(가) [${card.name}]을(를) 발동했습니다!`);
        uiManager.updateFieldMagic(card.name);
        soundManager.playClick();
        
        // 멀티플레이어: 특수 이벤트 전송
        if (this.isMultiplayer) {
            socketClient.sendSpecialEvent('field-magic', {
                card,
                fieldMagic: session.fieldMagic
            });
        }
        
        this.updateGameState();
        
        // 손패 업데이트
        const localPlayer = this.gameManager.getLocalPlayer();
        if (this.handManager) {
            this.handManager.clearHand();
            this.handManager.addCards(localPlayer.cards);
        }
    }

    private showTargetSelection(): void {
        if (!this.gameManager) return;

        const currentPlayer = this.gameManager.getCurrentPlayer();
        const session = this.gameManager.getSession();
        
        // 혼돈의 저주 (RANDOM_TARGET) 또는 혼돈의 소용돌이 필드 마법 체크
        const hasRandomTargetDebuff = currentPlayer.debuffs.some(
            d => d.type === 'random-target'
        );
        const hasChaosField = session.fieldMagic?.name === '혼돈의 소용돌이';
        
        if (hasRandomTargetDebuff || hasChaosField) {
            // 대상 랜덤 지정
            const alivePlayers = this.gameManager.getSession().players.filter(
                p => p.isAlive && p.id !== currentPlayer.id
            );
            
            if (alivePlayers.length === 0) return;
            
            const randomTarget = alivePlayers[Math.floor(Math.random() * alivePlayers.length)];
            
            if (hasRandomTargetDebuff) {
                uiManager.showAlert(`혼돈의 저주! 대상이 랜덤으로 지정됩니다: ${randomTarget.name}`);
            } else {
                uiManager.showAlert(`혼돈의 소용돌이! 대상이 랜덤으로 지정됩니다: ${randomTarget.name}`);
            }
            
            this.gameManager.selectDefender(randomTarget.id);
            
            // 멀티플레이어: 공격 전송
            if (this.isMultiplayer) {
                const attackCards = this.gameManager.getSession().attackCards;
                const totalDamage = attackCards.reduce((sum, card) => 
                    sum + card.healthDamage + card.mentalDamage, 0);
                
                socketClient.sendAttack(
                    this.currentPlayerId,
                    randomTarget.id,
                    attackCards,
                    totalDamage
                );
            }
            
            // 방어 카드 선택 대기
            setTimeout(() => {
                if (randomTarget.id === this.gameManager!.getLocalPlayer().id) {
                    this.showDefenseSelection(randomTarget.id);
                } else {
                    this.autoDefend(randomTarget.id);
                }
            }, 1500);
            
            return;
        }

        // 모든 살아있는 플레이어를 대상으로 선택 가능 (자기 자신 포함)
        const alivePlayers = this.gameManager.getSession().players.filter(
            p => p.isAlive
        );

        // 대상 선택 모달 표시
        const targetPlayersContainer = document.getElementById('target-players');
        if (!targetPlayersContainer) return;

        targetPlayersContainer.innerHTML = '';

        alivePlayers.forEach(player => {
            const btn = document.createElement('button');
            btn.className = 'target-player-btn';
            btn.innerHTML = `
                <div class="target-player-info">
                    <div class="target-player-name">${player.name}</div>
                    <div class="target-player-stats">
                        <span class="target-player-hp">❤️ ${player.health}/${player.maxHealth}</span>
                        <span class="target-player-mp">💧 ${player.mentalPower}/${player.maxMentalPower}</span>
                    </div>
                </div>
            `;
            
            btn.addEventListener('click', () => {
                soundManager.playClick();
                uiManager.hideModal('target-selection-modal');
                this.gameManager!.selectDefender(player.id);
                
                // 멀티플레이어: 공격 전송
                if (this.isMultiplayer) {
                    const attackCards = this.gameManager!.getSession().attackCards;
                    const totalDamage = attackCards.reduce((sum, card) => 
                        sum + card.healthDamage + card.mentalDamage, 0);
                    
                    socketClient.sendAttack(
                        this.currentPlayerId,
                        player.id,
                        attackCards,
                        totalDamage
                    );
                }
                
                // 방어 카드 선택 대기
                setTimeout(() => {
                    // 방어자가 로컬 플레이어인 경우 방어 카드 선택 UI 표시
                    if (player.id === this.gameManager!.getLocalPlayer().id) {
                        this.showDefenseSelection(player.id);
                    } else {
                        // AI는 자동 방어
                        this.autoDefend(player.id);
                    }
                }, 500);
            });

            targetPlayersContainer.appendChild(btn);
        });

        uiManager.showModal('target-selection-modal');
    }

    private showDefenseSelection(defenderId: string): void {
        if (!this.gameManager) return;

        const defender = this.gameManager.getSession().players.find(p => p.id === defenderId);
        if (!defender) return;

        uiManager.showAlert('당신이 공격 대상입니다! 방어 카드를 선택하세요!');
        
        // 손패를 방어 카드만 선택 가능하도록 표시
        const localPlayer = this.gameManager.getLocalPlayer();
        this.handManager!.clearHand();
        this.handManager!.addCards(localPlayer.cards);
        
        // 방어 확정 버튼 이벤트 재설정
        const confirmBtn = document.getElementById('confirm-btn');
        if (confirmBtn) {
            const newConfirmBtn = confirmBtn.cloneNode(true) as HTMLElement;
            confirmBtn.parentNode?.replaceChild(newConfirmBtn, confirmBtn);
            
            newConfirmBtn.addEventListener('click', () => {
                this.confirmDefense();
            });
        }
    }

    private confirmDefense(): void {
        if (!this.gameManager || !this.handManager) return;

        const selectedCards = this.handManager.getSelectedCards();
        
        // 방어 카드만 선택 가능
        const invalidCards = selectedCards.filter(c => c.type !== 'defense');
        if (invalidCards.length > 0) {
            uiManager.showAlert('방어 카드만 선택할 수 있습니다!');
            return;
        }

        // 방어 카드 선택 (빈 배열도 가능 - 방어하지 않음, 여러 장 선택 가능)
        this.gameManager.selectDefenseCards(selectedCards);
        
        if (selectedCards.length > 0) {
            soundManager.playDefense();
        }
        
        // 멀티플레이어: 방어 전송
        if (this.isMultiplayer) {
            const totalDefense = selectedCards.reduce((sum, card) => sum + card.defense, 0);
            socketClient.sendDefend(this.currentPlayerId, selectedCards, totalDefense);
        }
        
        // 전투 UI에 카드 표시
        if (this.combatUI) {
            this.combatUI.showAttackCards(this.gameManager.getSession().attackCards);
            this.combatUI.showDefenseCards(selectedCards);
        }
        
        // 공격 해결
        setTimeout(() => {
            this.gameManager!.resolveAttack();
            
            // 대응 턴이 있는지 확인 (되받아치기나 튕기기)
            const session = this.gameManager!.getSession();
            if (session.defenseCards.length === 0 && session.defenderId) {
                // 새로운 방어자가 지정됨 - 연쇄 대응
                const newDefender = session.players.find(p => p.id === session.defenderId);
                if (newDefender) {
                    uiManager.addLogMessage(`${newDefender.name}의 대응 턴!`);
                    
                    // Combat UI 초기화
                    if (this.combatUI) {
                        setTimeout(() => {
                            this.combatUI!.clearCombat();
                        }, 1000);
                    }
                    
                    // 새로운 방어자가 로컬 플레이어인지 확인
                    setTimeout(() => {
                        if (newDefender.id === this.gameManager!.getLocalPlayer().id) {
                            this.showDefenseSelection(newDefender.id);
                        } else {
                            this.autoDefend(newDefender.id);
                        }
                    }, 1500);
                    return;
                }
            }
            
            // 대응이 끝났으면 일반 처리
            this.updateGameState();
            
            // Combat UI 초기화
            if (this.combatUI) {
                setTimeout(() => {
                    this.combatUI!.clearCombat();
                }, 1500);
            }
            
            // 손패 업데이트 및 확인 버튼 복원
            const localPlayer = this.gameManager!.getLocalPlayer();
            this.handManager!.clearHand();
            this.handManager!.addCards(localPlayer.cards);
            
            // 확인 버튼을 원래 동작으로 복원
            this.restoreConfirmButton();
            
            // 다음 턴 진행
            if (!this.gameManager!.isLocalPlayerTurn()) {
                setTimeout(() => {
                    this.playAITurn();
                }, 1000);
            }
        }, 500);
    }

    private restoreConfirmButton(): void {
        const confirmBtn = document.getElementById('confirm-btn');
        if (confirmBtn) {
            const newConfirmBtn = confirmBtn.cloneNode(true) as HTMLElement;
            confirmBtn.parentNode?.replaceChild(newConfirmBtn, confirmBtn);
            
            newConfirmBtn.addEventListener('click', () => {
                this.confirmAction();
            });
        }
    }

    private autoDefend(defenderId: string): void {
        if (!this.gameManager) return;

        const defender = this.gameManager.getSession().players.find(p => p.id === defenderId);
        if (!defender) return;

        // 간단한 AI: 랜덤으로 방어 카드 선택
        const defenseCards = defender.cards.filter(c => c.type === 'defense');
        const selectedDefense = defenseCards.length > 0 && Math.random() > 0.3
            ? [defenseCards[0]]
            : [];

        this.gameManager.selectDefenseCards(selectedDefense);
        
        if (selectedDefense.length > 0) {
            soundManager.playDefense();
        }
        
        // 전투 UI에 카드 표시
        if (this.combatUI) {
            this.combatUI.showAttackCards(this.gameManager.getSession().attackCards);
            this.combatUI.showDefenseCards(selectedDefense);
        }
        
        // 공격 해결
        setTimeout(() => {
            this.gameManager!.resolveAttack();
            
            // 대응 턴이 있는지 확인 (되받아치기나 튕기기)
            const session = this.gameManager!.getSession();
            if (session.defenseCards.length === 0 && session.defenderId) {
                // 새로운 방어자가 지정됨 - 연쇄 대응
                const newDefender = session.players.find(p => p.id === session.defenderId);
                if (newDefender) {
                    uiManager.addLogMessage(`${newDefender.name}의 대응 턴!`);
                    
                    // Combat UI 초기화
                    if (this.combatUI) {
                        setTimeout(() => {
                            this.combatUI!.clearCombat();
                        }, 1000);
                    }
                    
                    // 새로운 방어자가 로컬 플레이어인지 확인
                    setTimeout(() => {
                        if (newDefender.id === this.gameManager!.getLocalPlayer().id) {
                            this.showDefenseSelection(newDefender.id);
                        } else {
                            this.autoDefend(newDefender.id);
                        }
                    }, 1500);
                    return;
                }
            }
            
            // 대응이 끝났으면 일반 처리
            this.updateGameState();
            
            // Combat UI 초기화
            if (this.combatUI) {
                setTimeout(() => {
                    this.combatUI!.clearCombat();
                }, 1500);
            }
            
            // 손패 업데이트
            const localPlayer = this.gameManager!.getLocalPlayer();
            this.handManager!.clearHand();
            this.handManager!.addCards(localPlayer.cards);
            
            // 현재 플레이어가 AI면 자동으로 턴 종료 후 다음 턴 진행
            if (!this.gameManager!.isLocalPlayerTurn()) {
                setTimeout(() => {
                    this.gameManager!.endTurn();
                    this.updateGameState();
                    
                    // 다음 AI 턴 또는 플레이어 턴 진행
                    setTimeout(() => {
                        this.playAITurn();
                    }, 1000);
                }, 1000);
            }
        }, 500);
    }
    
    private endTurn(): void {
        if (!this.gameManager) return;

        if (!this.gameManager.isLocalPlayerTurn()) {
            uiManager.showAlert('당신의 턴이 아닙니다!');
            return;
        }

        const session = this.gameManager.getSession();
        const nextPlayer = this.getNextAlivePlayer(session.currentPlayerId);
        
        this.gameManager.endTurn();
        this.updateGameState();
        uiManager.addLogMessage('턴을 종료했습니다.');

        // 멀티플레이어: 턴 종료 전송
        if (this.isMultiplayer && nextPlayer) {
            socketClient.sendTurnEnd(this.currentPlayerId, nextPlayer.id);
        }

        // AI 턴 자동 진행 (싱글플레이어만)
        if (!this.isMultiplayer) {
            setTimeout(() => {
                this.playAITurn();
            }, 1000);
        }
    }

    private getNextAlivePlayer(currentPlayerId: string): Player | undefined {
        if (!this.gameManager) return undefined;
        
        const session = this.gameManager.getSession();
        const currentIndex = session.players.findIndex(p => p.id === currentPlayerId);
        
        for (let i = 1; i <= session.players.length; i++) {
            const nextIndex = (currentIndex + i) % session.players.length;
            const nextPlayer = session.players[nextIndex];
            if (nextPlayer.isAlive) {
                return nextPlayer;
            }
        }
        
        return undefined;
    }

    private playAITurn(): void {
        if (!this.gameManager || !this.handManager) return;

        const currentPlayer = this.gameManager.getCurrentPlayer();
        
        // 로컬 플레이어 턴이면 종료
        if (this.gameManager.isLocalPlayerTurn()) {
            uiManager.addLogMessage(`${currentPlayer.name}의 턴입니다!`);
            return;
        }

        uiManager.addLogMessage(`${currentPlayer.name}의 턴...`);

        // 간단한 AI: 랜덤 공격
        setTimeout(() => {
            const attackCards = currentPlayer.cards.filter(c => 
                c.type === 'attack' || c.type === 'magic'
            );
            
            if (attackCards.length > 0) {
                const selectedCard = [attackCards[0]];
                
                if (this.gameManager!.selectAttackCards(selectedCard)) {
                    // 랜덤 대상 선택
                    const targets = this.gameManager!.getSession().players.filter(
                        p => p.isAlive && p.id !== currentPlayer.id
                    );
                    
                    if (targets.length > 0) {
                        const randomTarget = targets[Math.floor(Math.random() * targets.length)];
                        this.gameManager!.selectDefender(randomTarget.id);
                        
                        // 방어자가 로컬 플레이어인 경우
                        if (randomTarget.id === this.gameManager!.getLocalPlayer().id) {
                            uiManager.showAlert('당신이 공격 대상입니다! 방어 카드를 선택하세요!');
                            // 여기서 방어 카드 선택 UI 표시 (추후 구현)
                            // 임시로 자동 방어
                            setTimeout(() => {
                                this.autoDefend(randomTarget.id);
                            }, 1000);
                        } else {
                            // AI vs AI
                            setTimeout(() => {
                                this.autoDefend(randomTarget.id);
                            }, 500);
                        }
                    }
                }
            } else {
                // 공격 카드 없으면 턴 종료
                setTimeout(() => {
                    this.gameManager!.endTurn();
                    this.updateGameState();
                    this.playAITurn();
                }, 500);
            }
        }, 1000);
    }

    private updateGameState(): void {
        if (!this.gameManager) return;

        const session = this.gameManager.getSession();
        
        // 플레이어 정보 업데이트
        session.players.forEach(player => {
            this.playersManager.updatePlayer(player);
        });

        // 현재 턴 플레이어 하이라이트
        this.playersManager.setActivePlayer(session.currentPlayerId);

        // 턴 번호 업데이트
        uiManager.updateTurnNumber(session.currentTurn);
        
        // 게임 오버 체크
        this.checkGameOver();
    }
    
    private checkGameOver(): void {
        if (!this.gameManager) return;
        
        const session = this.gameManager.getSession();
        const alivePlayers = session.players.filter(p => p.isAlive);
        
        // 생존자가 1명 이하면 게임 종료
        if (alivePlayers.length <= 1) {
            setTimeout(() => {
                this.showGameOver(alivePlayers[0]);
            }, 1500);
        }
    }
    
    private showGameOver(winner?: Player): void {
        if (!this.gameManager) return;
        
        const session = this.gameManager.getSession();
        const localPlayer = this.gameManager.getLocalPlayer();
        
        const gameOverTitle = document.getElementById('game-over-title');
        const gameOverMessage = document.getElementById('game-over-message');
        const finalTurn = document.getElementById('final-turn');
        const finalHealth = document.getElementById('final-health');
        const finalMental = document.getElementById('final-mental');
        
        if (winner && winner.id === localPlayer.id) {
            // 승리
            soundManager.playVictory();
            if (gameOverTitle) {
                gameOverTitle.textContent = '🎉 승리!';
                gameOverTitle.className = 'game-over-title victory';
            }
            if (gameOverMessage) {
                gameOverMessage.textContent = '축하합니다! 모든 적을 물리쳤습니다!';
            }
        } else {
            // 패배
            soundManager.playDefeat();
            if (gameOverTitle) {
                gameOverTitle.textContent = '💀 패배...';
                gameOverTitle.className = 'game-over-title defeat';
            }
            if (gameOverMessage) {
                if (winner) {
                    gameOverMessage.textContent = `${winner.name}님이 승리했습니다.`;
                } else {
                    gameOverMessage.textContent = '전투에서 패배했습니다...';
                }
            }
        }
        
        // 최종 통계
        if (finalTurn) finalTurn.textContent = session.currentTurn.toString();
        if (finalHealth) finalHealth.textContent = localPlayer.health.toString();
        if (finalMental) finalMental.textContent = localPlayer.mentalPower.toString();
        
        uiManager.showScreen(Screen.GAME_OVER);
    }
    
    // 게임 시작 (테스트용)
    startGame(): void {
        console.log('게임 시작!');
        this.isMultiplayer = false; // 로컬 모드
        uiManager.showScreen(Screen.GAME);
        uiManager.updateTurnNumber(1);
        uiManager.updateCombatNames('-', '-');
        uiManager.addLogMessage('게임이 시작되었습니다!');
        
        // Combat UI 초기화
        this.combatUI = new CombatUI();
        
        // 4명의 테스트 플레이어 생성
        const testPlayers: Player[] = [
            {
                id: 'player-1',
                name: this.userName || '플레이어1',
                health: 100,
                maxHealth: 100,
                mentalPower: 100,
                maxMentalPower: 100,
                cards: [],
                isAlive: true,
                isReady: true,
                debuffs: []
            },
            {
                id: 'player-2',
                name: 'AI 플레이어2',
                health: 100,
                maxHealth: 100,
                mentalPower: 100,
                maxMentalPower: 100,
                cards: [],
                isAlive: true,
                isReady: true,
                debuffs: []
            },
            {
                id: 'player-3',
                name: 'AI 플레이어3',
                health: 100,
                maxHealth: 100,
                mentalPower: 100,
                maxMentalPower: 100,
                cards: [],
                isAlive: true,
                isReady: true,
                debuffs: []
            },
            {
                id: 'player-4',
                name: 'AI 플레이어4',
                health: 100,
                maxHealth: 100,
                mentalPower: 100,
                maxMentalPower: 100,
                cards: [],
                isAlive: true,
                isReady: true,
                debuffs: []
            }
        ];
        
        this.currentPlayerId = testPlayers[0].id;
        
        this.gameManager = new GameManager('normal' as any, testPlayers, this.currentPlayerId);
        this.setupGameUI();
    }
    
    private startMultiplayerGame(serverPlayers: any[]): void {
        console.log('멀티플레이어 게임 시작!');
        this.isMultiplayer = true;
        
        uiManager.showScreen(Screen.GAME);
        uiManager.updateTurnNumber(1);
        uiManager.updateCombatNames('-', '-');
        uiManager.addLogMessage('멀티플레이어 게임이 시작되었습니다!');
        
        // Combat UI 초기화
        this.combatUI = new CombatUI();
        
        // 서버 플레이어를 게임 플레이어로 변환
        const multiPlayers: Player[] = serverPlayers.map(sp => ({
            id: sp.id,
            name: sp.name,
            health: 100,
            maxHealth: 100,
            mentalPower: 100,
            maxMentalPower: 100,
            cards: drawRandomCards(5),
            isAlive: true,
            isReady: true,
            debuffs: []
        }));
        
        // 로컬 플레이어 찾기
        const multiLocalPlayer = multiPlayers.find(p => p.name === this.userName);
        if (!multiLocalPlayer) {
            console.error('로컬 플레이어를 찾을 수 없습니다!');
            return;
        }
        
        this.currentPlayerId = multiLocalPlayer.id;
        
        // GameManager 초기화
        this.gameManager = new GameManager('normal' as any, multiPlayers, this.currentPlayerId);
        this.setupGameUI();
    }
    
    private setupGameUI(): void {
        if (!this.gameManager) return;

        // 플레이어 정보 설정
        const session = this.gameManager.getSession();
        if (session) {
            this.playersManager.setPlayers(session.players);
        }
        this.playersManager.setActivePlayer(this.currentPlayerId);

        // 손패 매니저 초기화
        this.handManager = new HandManager('hand-cards');
        
        // 손패 선택 이벤트
        this.handManager.onSelectionChanged((selectedCards) => {
            const confirmBtn = document.getElementById('confirm-btn') as HTMLButtonElement;
            if (confirmBtn) {
                confirmBtn.disabled = selectedCards.length === 0;
            }
        });

        // 로컬 플레이어 카드 표시
        const localPlayer = this.gameManager.getLocalPlayer();
        if (localPlayer) {
            this.handManager.addCards(localPlayer.cards);
        }

        const players = session?.players || [];
        uiManager.addLogMessage(`${players.length}명의 플레이어가 게임에 참가했습니다.`);
        uiManager.addLogMessage('각 플레이어는 9장의 카드를 받았습니다.');
        
        const currentPlayer = this.gameManager.getCurrentPlayer();
        if (currentPlayer) {
            uiManager.addLogMessage(`${currentPlayer.name}의 턴입니다!`);
        }
        
        console.log('✅ 실제 게임 시작!');
        console.log('💡 카드를 선택하고 "확정" 버튼을 눌러 공격하세요!');
        console.log('💡 "턴 종료" 버튼으로 턴을 넘길 수 있습니다.');
    }

    // 테스트용: 플레이어 데미지
    takeDamage(playerIndex: number, damage: number): void {
        if (!this.gameManager) {
            console.log('게임이 시작되지 않았습니다. startGame()을 먼저 실행하세요.');
            return;
        }
        
        const players = this.playersManager.getAlivePlayers();
        if (players[playerIndex]) {
            const player = players[playerIndex];
            player.health = Math.max(0, player.health - damage);
            if (player.health === 0) {
                player.isAlive = false;
            }
            this.playersManager.updatePlayer(player);
            uiManager.addLogMessage(`${player.name}이(가) ${damage}의 데미지를 받았습니다!`);
        }
    }

    // 테스트용: 카드 추가
    drawCard(): void {
        if (this.handManager) {
            const newCard = drawRandomCards(1)[0];
            this.handManager.addCard(newCard);
            uiManager.addLogMessage('카드 1장을 뽑았습니다.');
        }
    }

    // 테스트용: 선택 카드 제거
    discardSelected(): void {
        if (this.handManager) {
            const selected = this.handManager.getSelectedCards();
            if (selected.length > 0) {
                this.handManager.removeSelectedCards();
                uiManager.addLogMessage(`카드 ${selected.length}장을 버렸습니다.`);
            }
        }
    }
}

// 앱 초기화
const game = new Game();

// 개발 모드: 콘솔에서 게임 시작 가능
(window as any).game = game;
(window as any).startGame = () => game.startGame();
(window as any).drawCard = () => game.drawCard();
(window as any).discardSelected = () => game.discardSelected();
(window as any).takeDamage = (playerIndex: number, damage: number) => game.takeDamage(playerIndex, damage);

console.log('💡 개발 모드 명령어:');
console.log('  - startGame() : 실제 게임 시작 (AI와 대전)');
console.log('  - drawCard() : 카드 1장 뽑기 (테스트용)');
console.log('  - discardSelected() : 선택한 카드 버리기 (테스트용)');
console.log('  - takeDamage(playerIndex, damage) : 플레이어에게 데미지 (테스트용)');
