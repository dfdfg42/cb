"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Screen = exports.LogType = exports.ActionType = exports.EventType = exports.GameType = exports.GameState = exports.DebuffType = exports.CardEffect = exports.CardType = void 0;
// 카드 타입
var CardType;
(function (CardType) {
    CardType["ATTACK"] = "attack";
    CardType["DEFENSE"] = "defense";
    CardType["MAGIC"] = "magic";
    CardType["FIELD_MAGIC"] = "field-magic";
})(CardType || (exports.CardType = CardType = {}));
// 카드 특수 효과
var CardEffect;
(function (CardEffect) {
    CardEffect["NONE"] = "none";
    CardEffect["REFLECT"] = "reflect";
    CardEffect["BOUNCE"] = "bounce";
    CardEffect["ON_DAMAGE"] = "on-damage";
    CardEffect["HEAL"] = "heal";
    CardEffect["BUFF"] = "buff";
    CardEffect["DEBUFF"] = "debuff"; // 디버프
})(CardEffect || (exports.CardEffect = CardEffect = {}));
// 디버프 타입
var DebuffType;
(function (DebuffType) {
    DebuffType["CARD_DECAY"] = "card-decay";
    DebuffType["RANDOM_TARGET"] = "random-target";
    DebuffType["MENTAL_DRAIN"] = "mental-drain";
    DebuffType["DAMAGE_INCREASE"] = "damage-increase"; // 받는 데미지 증가
})(DebuffType || (exports.DebuffType = DebuffType = {}));
// 게임 상태
var GameState;
(function (GameState) {
    GameState["WAITING"] = "waiting";
    GameState["STARTING"] = "starting";
    GameState["PLAYING"] = "playing";
    GameState["ATTACKING"] = "attacking";
    GameState["DEFENDING"] = "defending";
    GameState["ENDED"] = "ended";
})(GameState || (exports.GameState = GameState = {}));
// 게임 타입
var GameType;
(function (GameType) {
    GameType["NORMAL"] = "normal";
    GameType["RANKED"] = "ranked";
})(GameType || (exports.GameType = GameType = {}));
// 이벤트 타입
var EventType;
(function (EventType) {
    EventType["DEVIL"] = "devil";
    EventType["ANGEL"] = "angel";
})(EventType || (exports.EventType = EventType = {}));
// 액션 타입
var ActionType;
(function (ActionType) {
    ActionType["PLAY_CARD"] = "play-card";
    ActionType["SELECT_TARGET"] = "select-target";
    ActionType["CONFIRM_ACTION"] = "confirm-action";
    ActionType["END_TURN"] = "end-turn";
    ActionType["READY"] = "ready";
    ActionType["JOIN_ROOM"] = "join-room";
    ActionType["LEAVE_ROOM"] = "leave-room";
})(ActionType || (exports.ActionType = ActionType = {}));
// 로그 메시지 타입
var LogType;
(function (LogType) {
    LogType["INFO"] = "info";
    LogType["ATTACK"] = "attack";
    LogType["DEFENSE"] = "defense";
    LogType["DAMAGE"] = "damage";
    LogType["HEAL"] = "heal";
    LogType["EVENT"] = "event";
    LogType["DEATH"] = "death";
})(LogType || (exports.LogType = LogType = {}));
// 화면 타입
var Screen;
(function (Screen) {
    Screen["MAIN"] = "main-screen";
    Screen["LOBBY"] = "lobby-screen";
    Screen["WAITING"] = "waiting-screen";
    Screen["GAME"] = "game-screen";
    Screen["HELP"] = "help-screen";
    Screen["GAME_OVER"] = "game-over-screen";
})(Screen || (exports.Screen = Screen = {}));
