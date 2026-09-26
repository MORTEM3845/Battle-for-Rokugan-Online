import { HomeScreen, useHome } from '../home';

export function HomePage() {
    const state = useHome();
    return <HomeScreen {...state} />;
}
