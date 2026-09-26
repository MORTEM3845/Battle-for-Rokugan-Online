import { useState } from 'react';
import { loadPlayerName, savePlayerName } from './sessionStorage';

export function usePlayerName() {
    const [name, setName] = useState(loadPlayerName);
    return { name, setName, rememberName: () => savePlayerName(name) };
}
