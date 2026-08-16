export function getNextPackageVersion(now = new Date()): string {
    const year = now.getUTCFullYear();
    const dayOfYear = Math.floor((now.getTime() - Date.UTC(year, 0, 1)) / 86400000) + 1;
    const msOfDay = now.getTime() % 86400000;
    return `${year}.${dayOfYear}.${msOfDay}`;
}
