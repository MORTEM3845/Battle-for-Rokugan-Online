import { useEffect, useRef, useState } from 'react';
import { useLanguage } from '../i18n';

const DEFAULT_TRACK = '/audio/rokugan-ambient.mp3';

export function AmbientPlayer({ className = '' }: { className?: string }) {
    const { t } = useLanguage();
    const audioRef = useRef<HTMLAudioElement>(null);
    const fileRef = useRef<HTMLInputElement>(null);
    const objectUrlRef = useRef<string | null>(null);
    const [playing, setPlaying] = useState(false);
    const [missing, setMissing] = useState(false);
    const [volume, setVolume] = useState(() => Number(localStorage.getItem('rokugan-audio-volume') ?? .28));

    useEffect(() => {
        const audio = audioRef.current;
        if (audio)
            audio.volume = volume;
        localStorage.setItem('rokugan-audio-volume', String(volume));
    }, [volume]);

    useEffect(() => () => {
        if (objectUrlRef.current)
            URL.revokeObjectURL(objectUrlRef.current);
    }, []);

    async function toggle() {
        const audio = audioRef.current;
        if (!audio)
            return;
        if (missing) {
            fileRef.current?.click();
            return;
        }
        if (!audio.paused) {
            audio.pause();
            setPlaying(false);
            return;
        }
        try {
            await audio.play();
            setPlaying(true);
        } catch {
            setMissing(true);
            fileRef.current?.click();
        }
    }

    async function chooseFile(file?: File) {
        if (!file || !audioRef.current)
            return;
        if (objectUrlRef.current)
            URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = URL.createObjectURL(file);
        audioRef.current.src = objectUrlRef.current;
        audioRef.current.load();
        setMissing(false);
        try {
            await audioRef.current.play();
            setPlaying(true);
        } catch {
            setPlaying(false);
        }
    }

    return <aside className={`ambient-player compact-audio ${playing ? 'is-playing' : ''} ${className}`.trim()}
        aria-label={playing ? t('music.pause') : t('music.play')}>
        <audio ref={audioRef} src={DEFAULT_TRACK} loop preload="none" onPause={() => setPlaying(false)}
            onPlay={() => setPlaying(true)} onError={() => setMissing(true)} />
        <input ref={fileRef} className="audio-file-input" type="file" accept="audio/*"
            onChange={event => void chooseFile(event.target.files?.[0])} />
        <button className="ambient-toggle" onClick={() => void toggle()} aria-pressed={playing}
            title={missing ? t('music.missing') : playing ? t('music.pause') : t('music.play')}>
            {missing ? '♫+' : playing ? 'Ⅱ' : '▶'}
        </button>
        <input className="ambient-volume" aria-label={t('music.volume')} title={t('music.volume')}
            type="range" min="0" max="1" step="0.01" value={volume}
            onChange={event => setVolume(Number(event.target.value))} />
    </aside>;
}
