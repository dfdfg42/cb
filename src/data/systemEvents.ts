import CARDS, { RawCard } from './cards.generated';

export type SystemEventCategory = 'angel' | 'demon';

export interface SystemEventConfig {
    turnLimit: number;
    angelChance: number;
    demonChance: number;
}

export interface SystemEventCard {
    id: string;
    name: string;
    tooltip?: string | null;
    category: SystemEventCategory;
    physicalDamage: number;
    mentalDamage: number;
    effect?: string;
}

const SYSTEM_CARD_ID = 'SYS-001';

function parseTags(tags?: string | null): Record<string, string> {
    if (!tags) return {};
    return tags.split(';').reduce<Record<string, string>>((acc, part) => {
        const [rawKey, rawValue] = part.split('=');
        const key = rawKey?.trim();
        if (!key) return acc;
        acc[key] = (rawValue ?? '').trim();
        return acc;
    }, {});
}

export function getSystemEventConfig(): SystemEventConfig | null {
    const card = CARDS.find(c => c.id === SYSTEM_CARD_ID);
    if (!card) {
        return null;
    }

    const tags = parseTags(card.tags);
    const turnLimit = Number(tags['turn_limit'] ?? 50);
    const angelChance = Number(tags['angel_chance'] ?? 0.1);
    const demonChance = Number(tags['demon_chance'] ?? 0.9);

    return {
        turnLimit: Number.isNaN(turnLimit) ? 50 : turnLimit,
        angelChance: Number.isNaN(angelChance) ? 0.1 : angelChance,
        demonChance: Number.isNaN(demonChance) ? 0.9 : demonChance
    };
}

const SYSTEM_EVENT_CARDS: SystemEventCard[] = CARDS.filter(card => card.type === 'EVENT').map((card: RawCard) => {
    const tags = parseTags(card.tags);
    const category = (tags['roll'] === 'angel' ? 'angel' : 'demon') as SystemEventCategory;

    return {
        id: card.id,
        name: card.name || card.id,
        tooltip: card.tooltip,
        category,
        physicalDamage: Number(card.phys_atk || 0),
        mentalDamage: Number(card.mind_atk || 0),
        effect: tags['effect']
    };
});

export function getSystemEventCards(): SystemEventCard[] {
    return SYSTEM_EVENT_CARDS;
}

export function getEventCardsByCategory(category: SystemEventCategory): SystemEventCard[] {
    return SYSTEM_EVENT_CARDS.filter(card => card.category === category);
}
