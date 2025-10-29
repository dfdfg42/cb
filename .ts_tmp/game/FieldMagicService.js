"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FieldMagicService = void 0;
/**
 * FieldMagicService
 * - FieldMagic 관련 순수 로직(효과 적용 및 지속시간 감소)을 담당합니다.
 * - GameManager에서 호출 가능하도록 설계되었으며 유닛 테스트로 검증됩니다.
 */
class FieldMagicService {
    /**
     * session.fieldMagic이 존재하면 해당 효과를 적용하고 duration을 감소시킵니다.
     * 만료되면 session.fieldMagic을 undefined로 만듭니다.
     */
    static applyAndTick(session) {
        const fm = session.fieldMagic;
        if (!fm)
            return;
        const caster = session.players.find(p => p.id === fm.casterId);
        switch (fm.name) {
            case '화염의 대지':
                // 시전자 제외 모든 생존자에게 5 데미지
                session.players.forEach(p => {
                    if (p.isAlive && p.id !== fm.casterId) {
                        p.health = Math.max(0, p.health - 5);
                    }
                });
                break;
            case '치유의 성역':
                if (caster && caster.isAlive) {
                    caster.health = Math.min(caster.maxHealth, caster.health + 10);
                }
                break;
            case '마력의 폭풍':
                if (caster && caster.isAlive) {
                    caster.mentalPower = Math.min(caster.maxMentalPower, caster.mentalPower + 3);
                }
                break;
            case '혼돈의 소용돌이':
                // 혼돈 효과는 타겟 선택 로직에서 처리되므로 여기선 부작용 없음
                break;
            default:
                // 알려지지 않은 필드 마법: 무시
                break;
        }
        // 지속시간 감소 및 만료 처리
        fm.duration = fm.duration - 1;
        if (fm.duration <= 0) {
            session.fieldMagic = undefined;
        }
    }
    static createFieldMagic(id, name, casterId, duration, effect) {
        return {
            id,
            name,
            casterId,
            duration,
            effect: effect || ''
        };
    }
}
exports.FieldMagicService = FieldMagicService;
exports.default = FieldMagicService;
