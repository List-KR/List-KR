const MS_PER_DAY = 86_400_000;

export function getNextPackageVersion(now = new Date()): string {
    const year = now.getUTCFullYear();
    const dayOfYear = Math.floor((now.getTime() - Date.UTC(year, 0, 1)) / MS_PER_DAY) + 1;
    const msOfDay = now.getTime() % MS_PER_DAY;
    return `${year}.${dayOfYear}.${msOfDay}`;
}
