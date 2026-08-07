// Minimal pub/sub so any component that mutates a training (create/update/delete) can
// tell the navbar to refresh its notification bell immediately

const listeners = new Set();

export function subscribeNotificationRefresh(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
}

export function triggerNotificationRefresh() {
    listeners.forEach((fn) => fn());
}