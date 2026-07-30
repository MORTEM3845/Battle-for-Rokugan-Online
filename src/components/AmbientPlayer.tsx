import { useEffect, useRef, useState } from 'react';

interface AudioEngine {
    context: AudioContext;
    master: GainNode;
    wind: AudioBufferSourceNode;
    timer: number;
}

const SCALE = [220, 246.94, 261.63, 329.63, 349.23, 440];

function createWind(context: AudioContext, master: GainNode): AudioBufferSourceNode {
    const buffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < data.length; index++)
        data[index] = Math.random() * 2 - 1;

    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    source.buffer = buffer;
    source.loop = true;
    filter.type = 'lowpass';
    filter.frequency.value = 520;
    gain.gain.value = .035;
    source.connect(filter).connect(gain).connect(master);
    source.start();
    return source;
}

function playNote(engine: AudioEngine): void {
    const { context, master } = engine;
    const now = context.currentTime;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const frequency = SCALE[Math.floor(Math.random() * SCALE.length)] * (Math.random() > .78 ? 2 : 1);

    oscillator.type = Math.random() > .45 ? 'sine' : 'triangle';
    oscillator.frequency.setValueAtTime(frequency, now);
    gain.gain.setValueAtTime(.0001, now);
    gain.gain.exponentialRampToValueAtTime(.12, now + .08);
    gain.gain.exponentialRampToValueAtTime(.0001, now + 2.8);
    oscillator.connect(gain).connect(master);
    oscillator.start(now);
    oscillator.stop(now + 3);
}

export function AmbientPlayer() {
    const [playing, setPlaying] = useState(false);
    const [volume, setVolume] = useState(() => Number(localStorage.getItem('rokugan-audio-volume') ?? .32));
    const engineRef = useRef<AudioEngine | null>(null);

    useEffect(() => {
        if (engineRef.current)
            engineRef.current.master.gain.value = volume;
        localStorage.setItem('rokugan-audio-volume', String(volume));
    }, [volume]);

    useEffect(() => () => stopEngine(), []);

    async function startEngine() {
        const context = new AudioContext();
        await context.resume();
        const master = context.createGain();
        master.gain.value = volume;
        master.connect(context.destination);
        const engine: AudioEngine = { context, master, wind: createWind(context, master), timer: 0 };
        engine.timer = window.setInterval(() => playNote(engine), 3600);
        engineRef.current = engine;
        playNote(engine);
        setPlaying(true);
    }

    function stopEngine() {
        const engine = engineRef.current;
        if (!engine)
            return;
        window.clearInterval(engine.timer);
        engine.wind.stop();
        void engine.context.close();
        engineRef.current = null;
        setPlaying(false);
    }

    async function toggle() {
        if (playing)
            stopEngine();
        else
            await startEngine();
    }

    return <aside className={`ambient-player ${playing ? 'is-playing' : ''}`} aria-label="Фоновая музыка">
        <button className="ambient-toggle" onClick={() => void toggle()} aria-pressed={playing}>
            <span>{playing ? 'Ⅱ' : '▶'}</span>
            <div><b>Атмосфера Рокугана</b><small>{playing ? 'процедурная музыка играет' : 'включить музыку'}</small></div>
        </button>
        {playing && <label className="ambient-volume">Громкость
            <input type="range" min="0" max="0.7" step="0.01" value={volume}
                onChange={event => setVolume(Number(event.target.value))} />
        </label>}
    </aside>;
}
