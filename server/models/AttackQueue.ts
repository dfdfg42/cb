import { AttackQueueItem } from '../types';

/**
 * Attack queue manager
 * Handles sequential processing of attacks with support for chains (reflect/bounce)
 */
export class AttackQueue {
    private queue: AttackQueueItem[] = [];
    private currentAttackId: string | null = null;

    /**
     * Add attack to queue
     */
    enqueue(attack: AttackQueueItem): void {
        this.queue.push(attack);
        console.log(`[AttackQueue] Enqueued attack ${attack.id}, queue length: ${this.queue.length}`);
    }

    /**
     * Get and remove next attack from queue
     */
    dequeue(): AttackQueueItem | null {
        const attack = this.queue.shift();
        if (attack) {
            this.currentAttackId = attack.id;
            console.log(`[AttackQueue] Dequeued attack ${attack.id}, remaining: ${this.queue.length}`);
        }
        return attack || null;
    }

    /**
     * Get current attack being processed
     */
    getCurrentAttack(): AttackQueueItem | null {
        if (!this.currentAttackId) return null;
        return this.queue.find(a => a.id === this.currentAttackId) || null;
    }

    /**
     * Find attack by ID
     */
    getAttackById(id: string): AttackQueueItem | null {
        return this.queue.find(a => a.id === id) || null;
    }

    /**
     * Find attack by request ID
     */
    getAttackByRequestId(requestId: string): AttackQueueItem | null {
        return this.queue.find(a => a.requestId === requestId) || null;
    }

    /**
     * Update attack status
     */
    updateAttackStatus(id: string, status: AttackQueueItem['status']): void {
        const attack = this.queue.find(a => a.id === id);
        if (attack) {
            attack.status = status;
            console.log(`[AttackQueue] Updated attack ${id} status to ${status}`);
        }
    }

    /**
     * Remove attack from queue
     */
    removeAttack(id: string): void {
        const index = this.queue.findIndex(a => a.id === id);
        if (index !== -1) {
            this.queue.splice(index, 1);
            console.log(`[AttackQueue] Removed attack ${id}, remaining: ${this.queue.length}`);
        }
        if (this.currentAttackId === id) {
            this.currentAttackId = null;
        }
    }

    /**
     * Clear all attacks from queue
     */
    clear(): void {
        this.queue = [];
        this.currentAttackId = null;
        console.log(`[AttackQueue] Cleared queue`);
    }

    /**
     * Get queue size
     */
    size(): number {
        return this.queue.length;
    }

    /**
     * Check if queue is empty
     */
    isEmpty(): boolean {
        return this.queue.length === 0;
    }

    /**
     * Check if can process next attack
     */
    canProcessNext(): boolean {
        return this.currentAttackId === null || this.queue.length > 0;
    }
}
