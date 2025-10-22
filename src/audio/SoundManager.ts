// 사운드 매니저
export class SoundManager {
    private static instance: SoundManager;
    private enabled: boolean = true;
    private volume: number = 0.5;

    private constructor() {}

    public static getInstance(): SoundManager {
        if (!SoundManager.instance) {
            SoundManager.instance = new SoundManager();
        }
        return SoundManager.instance;
    }

    public setEnabled(enabled: boolean): void {
        this.enabled = enabled;
    }

    public setVolume(volume: number): void {
        this.volume = Math.max(0, Math.min(1, volume));
    }

    // 카드 선택 사운드
    public playCardSelect(): void {
        if (!this.enabled) return;
        this.playTone(800, 0.1, 'sine');
    }

    // 카드 사용 사운드
    public playCardUse(): void {
        if (!this.enabled) return;
        this.playTone(600, 0.15, 'square');
    }

    // 공격 사운드
    public playAttack(): void {
        if (!this.enabled) return;
        this.playSequence([
            { freq: 300, duration: 0.05 },
            { freq: 200, duration: 0.1 }
        ], 'sawtooth');
    }

    // 방어 사운드
    public playDefense(): void {
        if (!this.enabled) return;
        this.playTone(400, 0.2, 'triangle');
    }

    // 데미지 사운드
    public playDamage(): void {
        if (!this.enabled) return;
        this.playSequence([
            { freq: 150, duration: 0.08 },
            { freq: 100, duration: 0.12 }
        ], 'sawtooth');
    }

    // 치유 사운드
    public playHeal(): void {
        if (!this.enabled) return;
        this.playSequence([
            { freq: 400, duration: 0.1 },
            { freq: 500, duration: 0.1 },
            { freq: 600, duration: 0.1 }
        ], 'sine');
    }

    // 승리 사운드
    public playVictory(): void {
        if (!this.enabled) return;
        this.playSequence([
            { freq: 523, duration: 0.2 },
            { freq: 659, duration: 0.2 },
            { freq: 784, duration: 0.2 },
            { freq: 1047, duration: 0.4 }
        ], 'sine');
    }

    // 패배 사운드
    public playDefeat(): void {
        if (!this.enabled) return;
        this.playSequence([
            { freq: 400, duration: 0.2 },
            { freq: 300, duration: 0.2 },
            { freq: 200, duration: 0.3 }
        ], 'sawtooth');
    }

    // 버튼 클릭 사운드
    public playClick(): void {
        if (!this.enabled) return;
        this.playTone(1000, 0.05, 'sine');
    }

    // 에러 사운드
    public playError(): void {
        if (!this.enabled) return;
        this.playTone(200, 0.2, 'square');
    }

    // 단일 톤 재생
    private playTone(frequency: number, duration: number, type: OscillatorType): void {
        try {
            const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);

            oscillator.frequency.value = frequency;
            oscillator.type = type;

            gainNode.gain.setValueAtTime(this.volume, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);

            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + duration);
        } catch (e) {
            console.warn('Audio not supported:', e);
        }
    }

    // 시퀀스 재생
    private playSequence(notes: Array<{ freq: number, duration: number }>, type: OscillatorType): void {
        let currentTime = 0;
        notes.forEach(note => {
            setTimeout(() => {
                this.playTone(note.freq, note.duration, type);
            }, currentTime * 1000);
            currentTime += note.duration;
        });
    }
}

export const soundManager = SoundManager.getInstance();
