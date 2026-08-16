export const randomItem = <T,>(items: T[]): T => items[Math.floor(Math.random() * items.length)];

export function shuffled<T>(items: T[]): T[] {
    const result = [...items];
    for (let index = result.length - 1; index > 0; index--) {
        const swapIndex = Math.floor(Math.random() * (index + 1));
        [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
    }
    return result;
}
