
const listeners = new Set();

export function subscribeNotificationRefresh(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
}

export function triggerNotificationRefresh() {
    listeners.forEach((fn) => fn());
}