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
    private pendingDefenseRequestId?: string | null = null;
    private pendingJoinMode: 'normal' | 'ranked' | null = null;
    private combatClearTimer: number | null = null;
    
    constructor() {
        this.playersManager = new PlayersManager();
        this.initializeEventListeners();
        this.setupSocketListeners();
        console.log('🎮 카드 배틀 게임 시작!');
        // MutationObserver for debugging: track creation/removal/attribute changes of #summary-take-btn
        try {
            const observeBtn = () => {
                const btn = document.getElementById('summary-take-btn') as HTMLButtonElement | null;
                if (btn) {
                    console.log('[MUTATION-DEBUG] summary-take-btn currently in DOM; display=', btn.style.display, ' onclick=', !!btn.onclick, ' classes=', btn.className);
                } else {
                    console.log('[MUTATION-DEBUG] summary-take-btn NOT in DOM');
                }
            };

            const observer = new MutationObserver((mutations) => {
                mutations.forEach(m => {
                    // log added/removed nodes
                    if (m.addedNodes && m.addedNodes.length > 0) {
                        m.addedNodes.forEach(n => {
                            if (n instanceof HTMLElement) {
                                if (n.id === 'summary-take-btn' || n.querySelector && n.querySelector('#summary-take-btn')) {
                                    console.log('[MUTATION-DEBUG] summary-take-btn added to DOM via node:', n);
                                }
                            }
                        });
                    }
                    if (m.removedNodes && m.removedNodes.length > 0) {
                        m.removedNodes.forEach(n => {
                            if (n instanceof HTMLElement) {
                                if (n.id === 'summary-take-btn' || (n.querySelector && n.querySelector('#summary-take-btn'))) {
                                    console.log('[MUTATION-DEBUG] summary-take-btn removed from DOM via node:', n);
                                }
                            }
                        });
                    }
                    // attribute changes can hide/show button via style/class
                    if (m.type === 'attributes' && m.target instanceof HTMLElement) {
                        const target = m.target as HTMLElement;
                        if (target.id === 'summary-take-btn') {
                            console.log('[MUTATION-DEBUG] summary-take-btn attribute changed:', m.attributeName, ' value=', target.getAttribute(m.attributeName || '') , ' style.display=', target.style.display);
                        }
                    }
                });
                // also sample current state
                observeBtn();
            });

            observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class'] });
            // sample initial state
            observeBtn();
        } catch (e) {
            console.warn('[MUTATION-DEBUG] failed to attach observer', e);
        }
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

    private scheduleCombatUIClear(delayMs: number): void {
        if (!this.combatUI) return;
        if (this.combatClearTimer) {
            window.clearTimeout(this.combatClearTimer);
        }

        this.combatClearTimer = window.setTimeout(() => {
            this.combatClearTimer = null;
            this.combatUI?.clearCombat();
        }, delayMs);
    }

    private cancelCombatUIClear(): void {
        if (this.combatClearTimer) {
            window.clearTimeout(this.combatClearTimer);
            this.combatClearTimer = null;
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
            const readyBtn = document.getElementById('ready-btn') as HTMLButtonElement | null;
            if (readyBtn && data.room.players.length >= 2) {
                const isHost = data.room.players[0].name === this.userName;
                // 호스트는 스스로 준비 버튼을 누를 필요가 없으므로 호스트를 제외한 모든 플레이어가 준비되어야 함
                const allOthersReady = data.room.players.slice(1).every(p => p.isReady);

                if (isHost && allOthersReady) {
                    // 호스트는 게임 시작 버튼을 누를 수 있게 활성화
                    readyBtn.textContent = '게임 시작';
                    readyBtn.classList.remove('btn-secondary');
                    readyBtn.classList.add('btn-primary');
                    readyBtn.disabled = false;
                    // 클릭 핸들러 재설정
                    readyBtn.onclick = () => {
                        soundManager.playClick();
                        socketClient.startGame();
                    };
                } else if (isHost) {
                    // 호스트인데 아직 모두 준비가 아니라면 비활성화 상태로 표시
                    readyBtn.textContent = '대기 중...';
                    readyBtn.classList.remove('btn-primary');
                    readyBtn.classList.add('btn-muted');
                    readyBtn.disabled = true;
                    // 안전을 위해 클릭 핸들러 제거
                    readyBtn.onclick = null;
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
            // 멀티플레이어 게임 초기화 — 즉시 시작하도록 변경 (기존에는 2초 대기)
            this.startMultiplayerGame(data.room.players);
        });

        // 권위적 공격 결과 수신 (서버에서 계산된 최종 결과)
        socketClient.setOnAttackResolved((resolved: any) => {
            console.log('권위적 공격 결과 수신:', resolved);
            if (!this.gameManager) return;

            // clear any pending countdown interval when an attack is resolved
            if ((this as any)._pendingCountdownInterval) {
                clearInterval((this as any)._pendingCountdownInterval);
                (this as any)._pendingCountdownInterval = undefined;
            }
            const tEl = document.getElementById('summary-timer');
            if (tEl) tEl.textContent = '-';

            // hide central take-it button if visible
            const summaryTakeBtn = document.getElementById('summary-take-btn') as HTMLButtonElement | null;
            if (summaryTakeBtn) {
                summaryTakeBtn.style.display = 'none';
                summaryTakeBtn.onclick = null;
            }

            const attacker = this.gameManager.getPlayerById(resolved.attackerId);
            const target = this.gameManager.getPlayerById(resolved.targetId);

            // Combat UI에 카드/방어 표시
            if (this.combatUI) {
                try {
                    this.combatUI.showAttackCards(resolved.cardsUsed || []);
                } catch (e) {
                    // ignore
                }
            }

            // 서버 권위 결과를 적용
            if (attacker) {
                // apply attacker's mental power (after mana cost deduction)
                if (typeof resolved.attackerMentalPower === 'number') {
                    (attacker as any).mentalPower = resolved.attackerMentalPower;
                }
            }
            
            if (target) {
                // apply health
                (target as any).health = resolved.targetHealth;
                (target as any).isAlive = !resolved.eliminated;
                
                // apply mental power
                if (typeof resolved.targetMentalPower === 'number') {
                    (target as any).mentalPower = resolved.targetMentalPower;
                }
            }

            // 사용된 카드 제거 (공격자 손패) — 서버가 보낸 카드 객체/ids를 사용
            try {
                const cardsUsed = Array.isArray(resolved.cardsUsed) ? resolved.cardsUsed : [];
                const cardsUsedIds = Array.isArray(resolved.cardsUsedIds) ? resolved.cardsUsedIds : cardsUsed.map((c:any)=>c && c.id).filter(Boolean);

                if (attacker) {
                    // remove non-magic used cards from attacker's hand and draw replacements
                    let removedCount = 0;
                    cardsUsed.forEach((c: any) => {
                        if (!c || !c.id) return;
                        // 마법 카드는 소모 예외일 수 있으므로(요청대로) 마법/필드마법은 제거하지 않음
                        if (c.type === 'magic' || c.type === 'field-magic') return;
                        const idx = attacker.cards.findIndex((x: any) => x.id === c.id);
                        if (idx !== -1) {
                            attacker.cards.splice(idx, 1);
                            removedCount++;
                        }
                    });

                    // If server provided ids only (no full objects), remove by ids
                    if (removedCount === 0 && Array.isArray(cardsUsedIds) && cardsUsedIds.length > 0) {
                        cardsUsedIds.forEach((id: string) => {
                            const idx = attacker.cards.findIndex((x: any) => x.id === id);
                            if (idx !== -1) {
                                attacker.cards.splice(idx, 1);
                                removedCount++;
                            }
                        });
                    }

                    // draw replacement cards equal to removedCount
                    if (removedCount > 0) {
                        const newCards = drawRandomCards(removedCount);
                        attacker.cards.push(...newCards);
                        uiManager.addLogMessage(`${attacker.name}이(가) ${removedCount}장의 카드를 보충했습니다.`);
                    }
                }
            } catch (e) {
                console.warn('사용된 카드 제거 중 오류:', e);
            }
            // 방어에 사용된 카드 제거 (방어자 손패)
            try {
                const defenseCards = Array.isArray(resolved.defenseCards) ? resolved.defenseCards : [];
                const defenseCardIds = Array.isArray(resolved.defenseCardIds) ? resolved.defenseCardIds : defenseCards.map((c:any)=>c && c.id).filter(Boolean);

                if (target) {
                    let removedDefCount = 0;
                    defenseCards.forEach((c: any) => {
                        if (!c || !c.id) return;
                        const idx = target.cards.findIndex((x: any) => x.id === c.id);
                        if (idx !== -1) {
                            target.cards.splice(idx, 1);
                            removedDefCount++;
                        }
                    });

                    // fallback by ids
                    if (removedDefCount === 0 && Array.isArray(defenseCardIds) && defenseCardIds.length > 0) {
                        defenseCardIds.forEach((id: string) => {
                            const idx = target.cards.findIndex((x: any) => x.id === id);
                            if (idx !== -1) {
                                target.cards.splice(idx, 1);
                                removedDefCount++;
                            }
                        });
                    }

                    if (removedDefCount > 0) {
                        const newCards = drawRandomCards(removedDefCount);
                        target.cards.push(...newCards);
                        uiManager.addLogMessage(`${target.name}이(가) ${removedDefCount}장의 카드를 보충했습니다.`);
                    }
                }
            } catch (e) {
                console.warn('방어 카드 제거 중 오류:', e);
            }

            // UI 갱신
            this.playersManager.refreshAll();
            if (this.handManager) {
                const local = this.gameManager.getLocalPlayer();
                this.handManager.clearHand();
                this.handManager.addCards(local.cards);
            }

            // 턴/상태 동기화
            const session = this.gameManager.getSession();
            session.currentPlayerId = resolved.nextPlayerId;
            session.currentTurn = resolved.currentTurn;
            this.playersManager.setActivePlayer(resolved.nextPlayerId);
            uiManager.updateTurnNumber(resolved.currentTurn);

            // Build damage message including mental damage
            let damageMsg = '';
            
            // Check for special effects (reflect/bounce)
            if (resolved.isReflected) {
                const originalDmg = resolved.originalDamage || 0;
                const originalMental = resolved.originalMentalDamage || 0;
                damageMsg = `🔄 ${resolved.targetName}이(가) 되받아치기 발동! ${originalDmg} 체력 데미지`;
                if (originalMental > 0) {
                    damageMsg += ` + ${originalMental} 정신 데미지`;
                }
                damageMsg += `를 막았습니다!`;
            } else if (resolved.isBounced) {
                const originalDmg = resolved.originalDamage || 0;
                const originalMental = resolved.originalMentalDamage || 0;
                damageMsg = `🌀 ${resolved.targetName}이(가) 튕기기 발동! ${originalDmg} 체력 데미지`;
                if (originalMental > 0) {
                    damageMsg += ` + ${originalMental} 정신 데미지`;
                }
                damageMsg += `를 막았습니다!`;
            } else {
                // Normal attack
                damageMsg = `${resolved.attackerName} -> ${resolved.targetName}: ${resolved.damageApplied} 체력 데미지`;
                if (resolved.mentalDamageApplied && resolved.mentalDamageApplied > 0) {
                    damageMsg += `, ${resolved.mentalDamageApplied} 정신 데미지`;
                }
                damageMsg += ` (서버 기준)`;
            }
            uiManager.addLogMessage(damageMsg);

            // applied debuffs (if any)
            if (resolved.appliedDebuffs && Array.isArray(resolved.appliedDebuffs) && resolved.appliedDebuffs.length > 0) {
                uiManager.addLogMessage(`상태 이상 적용: ${resolved.appliedDebuffs.join(', ')}`);
            }

            // Combat UI 정리
            if (this.combatUI) {
                // show final summary including applied debuffs and defense cards
                try {
                    const attackerName = resolved.attackerName || (this.gameManager && this.gameManager.getPlayerById(resolved.attackerId)?.name) || '-';
                    const defenderName = resolved.targetName || (this.gameManager && this.gameManager.getPlayerById(resolved.targetId)?.name) || '-';
                    const usedCards = resolved.cardsUsed || [];
                    const damageApplied = resolved.damageApplied || 0;
                    const appliedDebuffs = resolved.appliedDebuffs || [];
                    if (this.combatUI && typeof this.combatUI.showFinalSummary === 'function') {
                        this.combatUI.showFinalSummary(resolved);
                    } else {
                        this.combatUI.showSummary(attackerName, defenderName, usedCards, damageApplied, appliedDebuffs);
                    }

                    const shouldHoldSummary = Boolean(resolved.isReflected || resolved.isBounced);
                    if (shouldHoldSummary) {
                        this.cancelCombatUIClear();
                    } else {
                        this.scheduleCombatUIClear(1600);
                    }
                } catch (e) {
                    this.scheduleCombatUIClear(1600);
                }
            }
            // 손패 입력 재활성화 (로컬 플레이어의 턴인 경우)
            if (this.handManager) {
                this.handManager.setEnabled(resolved.nextPlayerId === this.currentPlayerId);
                // 로컬 손패 최신화
                const local = this.gameManager.getLocalPlayer();
                this.handManager.clearHand();
                this.handManager.addCards(local.cards);
                // restore confirm button to attack action (in case it was replaced during defense)
                this.restoreConfirmButton();
                // clear any stored pending defense request id
                this.pendingDefenseRequestId = null;
            }
        });

        // attack announced: show central info (attribute + damage)
        socketClient.setOnAttackAnnounced((data: any) => {
            this.cancelCombatUIClear();
            const attrEl = document.getElementById('defend-attribute');
            const dmgEl = document.getElementById('defend-damage');
            if (attrEl) attrEl.textContent = `속성: ${data.attackAttribute || '-'} `;
            if (dmgEl) dmgEl.textContent = `데미지: ${data.damage}`;

            // show central combat UI for attack (no modal)
            if (this.combatUI) {
                // show attacker cards if provided
                this.combatUI.showAttackCards(data.cardsUsed || []);
                // reset any previous defender cards
                this.combatUI.showDefenseCards([]);
                // also show the combat summary in the center (attacker -> defender, cards, damage)
                    try {
                        const attackerName = data.attackerName || (this.gameManager && this.gameManager.getPlayerById(data.attackerId)?.name) || '-';
                        const defenderName = data.targetName || (this.gameManager && this.gameManager.getPlayerById(data.targetId)?.name) || '-';
                        const chain = (data && (data.chainSource || data.chain)) ? (data.chainSource || data.chain) : undefined;
                        this.combatUI.showSummary(attackerName, defenderName, data.cardsUsed || [], data.damage || 0, [], chain);
                    } catch (e) {
                        // ignore
                    }
            }

            // hide inline action buttons until defend-request arrives
            const useBtn = document.getElementById('use-defense-btn') as HTMLButtonElement | null;
            const takeBtn = document.getElementById('take-it-btn') as HTMLButtonElement | null;
            if (useBtn) { useBtn.style.display = 'none'; useBtn.onclick = null; }
            if (takeBtn) { takeBtn.style.display = 'none'; takeBtn.onclick = null; }
        });

        // defend request comes to the defender specifically
        socketClient.setOnDefendRequest((data: any) => {
            console.log('defend-request handler in client', data);
            
            // ✅ 큐 기반 시스템: 자기가 방어자일 때만 pendingDefenseRequestId 업데이트
            // 다른 플레이어의 defend-request는 구경만 함
            if (data.defenderId !== this.currentPlayerId) {
                console.log(`[DEBUG] defend-request for other player (${data.defenderId}), ignoring for local state`);
                // Show info but don't update local pending request
                const attrEl = document.getElementById('defend-attribute');
                const dmgEl = document.getElementById('defend-damage');
                if (attrEl) attrEl.textContent = `속성: ${data.attackAttribute || '-'} `;
                if (dmgEl) dmgEl.textContent = `데미지: ${data.damage}`;

                // show central combat UI (attacker cards) so everyone can see
                if (this.combatUI) {
                    this.combatUI.showAttackCards(data.cardsUsed || []);
                    this.combatUI.showDefenseCards([]);
                }
                return; // 여기서 종료 - 다른 사람의 방어 요청
            }

            // 이 플레이어가 방어자인 경우만 처리
            console.log(`[DEBUG] defend-request for LOCAL player, setting pendingDefenseRequestId`);
            this.pendingDefenseRequestId = data.requestId;
            console.log(`[DEBUG] pendingDefenseRequestId set -> ${this.pendingDefenseRequestId}`);

            const attrEl = document.getElementById('defend-attribute');
            const dmgEl = document.getElementById('defend-damage');
            if (attrEl) attrEl.textContent = `속성: ${data.attackAttribute || '-'} `;
            
            // Display both health damage and mental damage
            let damageText = `체력 데미지: ${data.damage}`;
            if (data.mentalDamage && data.mentalDamage > 0) {
                damageText += ` | 정신 데미지: ${data.mentalDamage}`;
            }
            if (dmgEl) dmgEl.textContent = damageText;

            // show central combat UI (attacker cards) so defender can see what they're defending against
            if (this.combatUI) {
                this.combatUI.showAttackCards(data.cardsUsed || []);
                this.combatUI.showDefenseCards([]);
            }

            // ✅ 아래 코드는 위에서 defenderId 체크로 이미 보장됨
            // If the local player is the defender, enter defense selection mode and mark eligible cards
            // Do NOT open the blocking modal. Instead, show attack info in the central combat UI
            // so the defender can select defense cards from the hand below.
            // Ensure central names/cards are visible
            try {
                const attacker = this.gameManager!.getPlayerById(data.attackerId);
                const defender = this.gameManager!.getPlayerById(data.targetId || data.defenderId);
                if (attacker && defender) uiManager.showCombatNames(attacker.name, defender.name);
            } catch (e) {
                    // ignore if gameManager not available
                }

                // show attacker cards centrally (already done above, but ensure)
                if (this.combatUI) {
                    this.combatUI.showAttackCards(data.cardsUsed || []);
                    this.combatUI.showDefenseCards([]);
                }

                // enable defender hand and mark eligible defense cards based on attribute
                if (this.handManager) {
                    console.log('[DEBUG] entering defense selection mode for local defender');
                    this.handManager.clearSelection();
                    // refresh local hand from game state
                    const local = this.gameManager!.getLocalPlayer();
                    console.log(`[DEBUG] local hand cards count before refresh: ${local.cards.length}`);
                    this.handManager.clearHand();
                    this.handManager.addCards(local.cards);
                    this.handManager.markEligibleDefense(data.attackAttribute);
                    this.handManager.setEnabled(true);
                    console.log('[DEBUG] handManager marked eligible defenses and enabled');
                }

                // give a clear instruction in-game (non-blocking banner)
                uiManager.addLogMessage('방어할 카드를 선택하세요. 선택 후 하단의 확정 버튼을 눌러주세요.');

                // Wire confirm button to confirmDefense for defender
                const confirmBtn = document.getElementById('confirm-btn');
                if (confirmBtn) {
                    const newConfirmBtn = confirmBtn.cloneNode(true) as HTMLElement;
                    confirmBtn.parentNode?.replaceChild(newConfirmBtn, confirmBtn);
                    newConfirmBtn.addEventListener('click', () => this.confirmDefense());
                    // enable confirm button initially disabled state depends on selection handler
                }

                // start an auto-take timeout (e.g., 20s) to avoid stalling the game
                const expiresAt = data.expiresAt || (Date.now() + 20000);
                // show initial timer value
                const timerEl = document.getElementById('summary-timer');
                if (timerEl) {
                    const sec = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
                    timerEl.textContent = `${sec}s`;
                    timerEl.classList.add('timer');
                }

                // clear previous timers if any
                if ((this as any)._pendingDefenseTimer) clearTimeout((this as any)._pendingDefenseTimer);
                if ((this as any)._pendingCountdownInterval) clearInterval((this as any)._pendingCountdownInterval);

                if (this.pendingDefenseRequestId) {
                    (this as any)._pendingDefenseTimer = setTimeout(() => {
                        // auto take it (send empty defense)
                        if (this.isMultiplayer && this.pendingDefenseRequestId) {
                            socketClient.sendDefendWithRequest(this.pendingDefenseRequestId!, this.currentPlayerId, [], 0);
                        }
                        // disable hand selection after auto-take
                        if (this.handManager) this.handManager.setEnabled(false);
                        // clear combat names after auto-resolve
                        uiManager.clearCombatNames();
                        // clear countdown interval and UI
                        if ((this as any)._pendingCountdownInterval) {
                            clearInterval((this as any)._pendingCountdownInterval);
                            (this as any)._pendingCountdownInterval = undefined;
                        }
                        const tEl = document.getElementById('summary-timer');
                        if (tEl) tEl.textContent = '-';
                        (this as any)._pendingDefenseTimer = undefined;
                    }, Math.max(1000, (expiresAt - Date.now())));

                    // start a countdown interval to update the timer display
                    (this as any)._pendingCountdownInterval = setInterval(() => {
                        const now = Date.now();
                        const remainingMs = expiresAt - now;
                        const tEl = document.getElementById('summary-timer');
                        if (tEl) {
                            if (remainingMs <= 0) {
                                tEl.textContent = '0s';
                            } else {
                                tEl.textContent = `${Math.ceil(remainingMs / 1000)}s`;
                            }
                        }
                        if (remainingMs <= 0) {
                            if ((this as any)._pendingCountdownInterval) {
                                clearInterval((this as any)._pendingCountdownInterval);
                                (this as any)._pendingCountdownInterval = undefined;
                            }
                        }
                    }, 250);
                }

                // ensure the old modal (if active) is hidden so it doesn't block clicks
                uiManager.hideModal('defend-modal');

                // show central "그냥 맞기" button and wire it to send empty defense
                const summaryTakeBtnLocal = document.getElementById('summary-take-btn') as HTMLButtonElement | null;
                if (summaryTakeBtnLocal) {
                    console.log('[DEBUG] summaryTakeBtn element found; display before show =', summaryTakeBtnLocal.style.display, ' onclick=', !!summaryTakeBtnLocal.onclick);
                    summaryTakeBtnLocal.style.display = 'inline-block';
                    console.log('[DEBUG] summaryTakeBtn set to visible');
                    summaryTakeBtnLocal.onclick = () => {
                        console.log('[DEBUG] summary take-it button clicked');
                        if (this.isMultiplayer && this.pendingDefenseRequestId) {
                            console.log(`[DEBUG] auto-sending empty defense for request ${this.pendingDefenseRequestId}`);
                            socketClient.sendDefendWithRequest(this.pendingDefenseRequestId!, this.currentPlayerId, [], 0);
                        }
                        // disable hand selection after action
                        if (this.handManager) this.handManager.setEnabled(false);
                        // hide the button and clear handler
                        summaryTakeBtnLocal.style.display = 'none';
                        summaryTakeBtnLocal.onclick = null;
                        // clear pending timers/intervals
                        if ((this as any)._pendingDefenseTimer) {
                            clearTimeout((this as any)._pendingDefenseTimer);
                            (this as any)._pendingDefenseTimer = undefined;
                        }
                        if ((this as any)._pendingCountdownInterval) {
                            clearInterval((this as any)._pendingCountdownInterval);
                            (this as any)._pendingCountdownInterval = undefined;
                        }
                        const tElLocal = document.getElementById('summary-timer');
                        if (tElLocal) tElLocal.textContent = '-';
                        // clear combat names and stored request id
                        uiManager.clearCombatNames();
                        console.log('[DEBUG] clearing pendingDefenseRequestId');
                        this.pendingDefenseRequestId = null;
                    };
                } else {
                    console.log('[DEBUG] summaryTakeBtn element NOT found when trying to show it');
                }
            // ✅ 이미 위에서 로컬 플레이어만 처리하므로 여기 도달하지 않음
            // 아래 코드는 더 이상 실행되지 않음 (early return)
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
                // 서버로부터 공격이 실제로 발생한 경우에만 중앙 공격/방어자 이름을 표시
                uiManager.showCombatNames(attacker.name, target.name);
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
                // show defender cards centrally
                if (this.combatUI) {
                    this.combatUI.showDefenseCards(data.cards || []);
                }
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

        // turn-start 이벤트: 서버에서 권위적으로 현재 플레이어와 턴을 전송
        socketClient.setOnTurnStart((data) => {
            console.log('턴 시작 수신 (서버 권위):', data);
            console.log(`  로컬 플레이어: ${this.currentPlayerId}, 현재 턴 플레이어: ${data.currentPlayerId}`);
            if (!this.gameManager) return;

            // 서버에서 보낸 currentPlayerId와 currentTurn을 받아 클라이언트 상태 동기화
            const session = this.gameManager.getSession();
            session.currentPlayerId = data.currentPlayerId;
            session.currentTurn = data.currentTurn;
            this.gameManager.resetNormalAttackUsage();
            
            const currentPlayer = this.gameManager.getPlayerById(data.currentPlayerId);
            if (currentPlayer) {
                uiManager.addLogMessage(`${currentPlayer.name}의 턴입니다!`);
                this.playersManager.setActivePlayer(data.currentPlayerId);

                // 로컬 플레이어의 턴이면 카드 활성화
                if (data.currentPlayerId === this.currentPlayerId) {
                    console.log(`✅ 로컬 플레이어 턴: 손패 활성화`);
                    this.handManager?.setEnabled(true);
                } else {
                    console.log(`❌ 다른 플레이어 턴: 손패 비활성화`);
                    this.handManager?.setEnabled(false);
                }
            }
            
            // 턴 번호 업데이트
            uiManager.updateTurnNumber(data.currentTurn);
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
                // 마법 카드(또는 정신 공격/회복 카드 포함)는 대상 선택을 통해 발동하도록 변경합니다.
                // (필드 마법은 이미 위에서 처리되므로 여기서는 대상 선택만 처리)
                this.showTargetSelection();
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
            
                        if (!this.isMultiplayer) this.gameManager.selectDefender(randomTarget.id);

                        // Optimistic UI: immediately show attack and summary for local mode
                        try {
                            if (this.combatUI) {
                                const attackCards = this.gameManager.getSession().attackCards;
                                const totalDamage = attackCards.reduce((sum:any, card:any) => sum + (card.healthDamage || 0) + (card.mentalDamage || 0), 0);
                                const attacker = this.gameManager.getCurrentPlayer();
                                const defender = this.gameManager.getPlayerById(randomTarget.id);
                                this.combatUI.showAttackCards(attackCards || []);
                                this.combatUI.showSummary(attacker?.name || '-', defender?.name || '-', attackCards || [], totalDamage, []);
                            }
                        } catch (e) {
                            // ignore UI errors
                        }
            
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
                if (!this.isMultiplayer) {
                    if (randomTarget.id === this.gameManager!.getLocalPlayer().id) {
                        this.showDefenseSelection(randomTarget.id);
                    } else {
                        this.autoDefend(randomTarget.id);
                    }
                } else {
                    uiManager.addLogMessage('서버 응답을 기다리는 중...');
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
                    if (!this.isMultiplayer) this.gameManager!.selectDefender(player.id);

                    // Optimistic UI: immediately show attack and summary for local mode
                    try {
                        if (!this.isMultiplayer && this.combatUI && this.gameManager) {
                            const attackCards = this.gameManager.getSession().attackCards;
                            const totalDamage = attackCards.reduce((sum:any, card:any) => sum + (card.healthDamage || 0) + (card.mentalDamage || 0), 0);
                            const attacker = this.gameManager.getCurrentPlayer();
                            const defender = this.gameManager.getPlayerById(player.id);
                            this.combatUI.showAttackCards(attackCards || []);
                            this.combatUI.showSummary(attacker?.name || '-', defender?.name || '-', attackCards || [], totalDamage, []);
                        }
                    } catch (e) {
                        // ignore UI errors
                    }
                
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
                        if (!this.isMultiplayer) {
                            // 방어자가 로컬 플레이어인 경우 방어 카드 선택 UI 표시
                            if (player.id === this.gameManager!.getLocalPlayer().id) {
                                this.showDefenseSelection(player.id);
                            } else {
                                // AI는 자동 방어
                                this.autoDefend(player.id);
                            }
                        } else {
                            uiManager.addLogMessage('서버 응답을 기다리는 중...');
                        }
                    }, 500);
            });

            targetPlayersContainer.appendChild(btn);
        });

        uiManager.showModal('target-selection-modal');
    }

    private showDefenseSelection(defenderId: string, attackAttribute?: any): void {
        if (!this.gameManager) return;

        const defender = this.gameManager.getSession().players.find(p => p.id === defenderId);
        if (!defender) return;

        uiManager.showAlert('당신이 공격 대상입니다! 방어 카드를 선택하세요!');
        
        // 손패를 방어 카드만 선택 가능하도록 표시
        const localPlayer = this.gameManager.getLocalPlayer();
        this.handManager!.clearHand();
        this.handManager!.addCards(localPlayer.cards);

        // 방어 선택 모드: 속성에 맞는 방어 카드만 활성화
        if (this.handManager) {
            let attr = attackAttribute;
            if (!attr && this.gameManager) {
                // 세션의 공격 카드에서 속성 추출(첫 공격 카드 기준)
                const session = this.gameManager.getSession();
                const firstAttack = session.attackCards && session.attackCards.length > 0 ? session.attackCards[0] : undefined;
                attr = firstAttack ? (firstAttack as any).attribute : undefined;
            }
            this.handManager.markEligibleDefense(attr);
        }
        
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

    // (inline target selection UI removed — target selection now happens on confirm)

    private hideInlineTargetSelection(): void {
        const existing = document.getElementById('inline-target-selection');
        if (existing) existing.remove();
    }

    private confirmDefense(): void {
        if (!this.gameManager || !this.handManager) return;

        console.log('[DEBUG] confirmDefense invoked, pendingDefenseRequestId=', this.pendingDefenseRequestId);
        const selDebug = this.handManager.getSelectedCards().map(c=>c.name).join(', ');
        console.log('[DEBUG] selected defense cards:', selDebug || '(none)');

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
            if (this.pendingDefenseRequestId) {
                // send with requestId so server can match pending attack
                console.log(`[DEBUG] sending defendWithRequest id=${this.pendingDefenseRequestId} defense=${totalDefense}`);
                socketClient.sendDefendWithRequest(this.pendingDefenseRequestId, this.currentPlayerId, selectedCards, totalDefense);
            } else {
                socketClient.sendDefend(this.currentPlayerId, selectedCards, totalDefense);
            }
            // hide inline action buttons after sending
            const useBtn = document.getElementById('use-defense-btn') as HTMLButtonElement | null;
            const takeBtn = document.getElementById('take-it-btn') as HTMLButtonElement | null;
            if (useBtn) { useBtn.style.display = 'none'; useBtn.onclick = null; }
            if (takeBtn) { takeBtn.style.display = 'none'; takeBtn.onclick = null; }
            // hide defend modal and disable hand selection for defender
            uiManager.hideModal('defend-modal');
            if (this.handManager) this.handManager.setEnabled(false);
            // clear pending defense request id and any timeout/interval
            this.pendingDefenseRequestId = null;
            if ((this as any)._pendingDefenseTimer) {
                clearTimeout((this as any)._pendingDefenseTimer);
                (this as any)._pendingDefenseTimer = undefined;
            }
            if ((this as any)._pendingCountdownInterval) {
                clearInterval((this as any)._pendingCountdownInterval);
                (this as any)._pendingCountdownInterval = undefined;
            }
            const tEl = document.getElementById('summary-timer');
            if (tEl) tEl.textContent = '-';
        }
        
        // 전투 UI에 카드 표시
        if (this.combatUI) {
            this.combatUI.showAttackCards(this.gameManager.getSession().attackCards);
            this.combatUI.showDefenseCards(selectedCards);
        }
        
        // 공격 해결
        setTimeout(() => {
            if (!this.isMultiplayer) {
                this.gameManager!.resolveAttack();

                // 대응 턴이 있는지 확인 (되받아치기나 튕기기)
                const session = this.gameManager!.getSession();
                if (session.defenseCards.length === 0 && session.defenderId) {
                    // 새로운 방어자가 지정됨 - 연쇄 대응
                    const newDefender = session.players.find(p => p.id === session.defenderId);
                    if (newDefender) {
                        uiManager.addLogMessage(`${newDefender.name}의 대응 턴!`);

                // 이전 요약을 유지해 플레이어가 되받아치기 상황을 확인할 수 있도록 클리어 예약 취소
                this.cancelCombatUIClear();

                        // hide defend modal if open and clear pending id
                        const dm = document.getElementById('defend-modal');
                        if (dm) dm.classList.remove('active');
                        this.pendingDefenseRequestId = null;

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
                this.scheduleCombatUIClear(1500);

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
            } else {
                // 멀티플레이어 모드: 서버 응답을 기다리도록 UI만 유지
                uiManager.addLogMessage('서버 응답을 기다리는 중...');
            }
        }, 500);
    }

    private restoreConfirmButton(): void {
        const confirmBtn = document.getElementById('confirm-btn');
        if (confirmBtn) {
            console.log('[DEBUG] restoreConfirmButton called - restoring confirm button to attack action');
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
            if (!this.isMultiplayer) {
                this.gameManager!.resolveAttack();

                // 대응 턴이 있는지 확인 (되받아치기나 튕기기)
                const session = this.gameManager!.getSession();
                if (session.defenseCards.length === 0 && session.defenderId) {
                    // 새로운 방어자가 지정됨 - 연쇄 대응
                    const newDefender = session.players.find(p => p.id === session.defenderId);
                    if (newDefender) {
                        uiManager.addLogMessage(`${newDefender.name}의 대응 턴!`);

                        // 이전 요약을 유지해 플레이어가 되받아치기 상황을 확인할 수 있도록 클리어 예약 취소
                        this.cancelCombatUIClear();

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
                this.scheduleCombatUIClear(1500);

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
            } else {
                // 멀티플레이어: 서버 응답 대기
                uiManager.addLogMessage('서버 응답을 기다리는 중...');
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
                        if (!this.isMultiplayer) this.gameManager!.selectDefender(randomTarget.id);
                        
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
    uiManager.clearCombatNames();
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
        
        this.gameManager = new GameManager('normal' as any, testPlayers, this.currentPlayerId, uiManager);
        this.setupGameUI();
    }
    
    private startMultiplayerGame(serverPlayers: any[]): void {
        console.log('멀티플레이어 게임 시작!');
        this.isMultiplayer = true;
        
        uiManager.showScreen(Screen.GAME);
        uiManager.updateTurnNumber(1);
    uiManager.clearCombatNames();
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
        this.gameManager = new GameManager('normal' as any, multiPlayers, this.currentPlayerId, uiManager);
        this.setupGameUI();
    }
    
    private setupGameUI(): void {
        if (!this.gameManager) return;

        // 플레이어 정보 설정
        const session = this.gameManager.getSession();
        if (session) {
            this.playersManager.setPlayers(session.players);
            // 세션의 현재 턴 플레이어를 우선으로 사용합니다 (서버/게임 로직 권위)
            this.playersManager.setActivePlayer(session.currentPlayerId);
        }

        // 손패 매니저 초기화
        this.handManager = new HandManager('hand-cards');
        
        // 손패 선택 이벤트
        this.handManager.onSelectionChanged((selectedCards) => {
            const confirmBtn = document.getElementById('confirm-btn') as HTMLButtonElement;
            if (confirmBtn) {
                confirmBtn.disabled = selectedCards.length === 0;
            }

            // 항상 선택된 카드를 중앙 전투 영역에 노출
            if (this.combatUI) {
                this.combatUI.showAttackCards(selectedCards);
            }

            // 선택이 변경되면, 로컬 플레이어의 턴일 때 즉시 공격 준비(타겟 선택) UI를 표시
            if (this.gameManager && this.gameManager.isLocalPlayerTurn()) {
                if (selectedCards.length === 0) {
                    this.hideInlineTargetSelection();
                    return;
                }

                // 선택 카드가 공격 또는 공격성 마법(대상 필요)을 포함하면 타겟 선택 UI를 띄울 수 있음 (확정 버튼에서 처리)

                // Do not open inline target selection on mere card selection.
                // Target selection / attack confirmation happens when the player clicks the '확정' button.
                this.hideInlineTargetSelection();
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
(window as any).drawCard = () => game.drawCard();
(window as any).discardSelected = () => game.discardSelected();
(window as any).takeDamage = (playerIndex: number, damage: number) => game.takeDamage(playerIndex, damage);

console.log('💡 개발 모드 명령어:');
console.log('  - drawCard() : 카드 1장 뽑기 (테스트용)');
console.log('  - discardSelected() : 선택한 카드 버리기 (테스트용)');
console.log('  - takeDamage(playerIndex, damage) : 플레이어에게 데미지 (테스트용)');
