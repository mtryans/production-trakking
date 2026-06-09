const BASE_URL = '/api';

export const api = {
    // GET semua production orders
    getTrackers: async () => {
        const res = await fetch(`${BASE_URL}/tracker`);
        return res.json();
    },

    // POST buat WO baru
    createTracker: async (data: any) => {
        const res = await fetch(`${BASE_URL}/tracker`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': getCSRF() },
            body: JSON.stringify(data),
        });
        return res.json();
    },

    // PUT update WO
    updateTracker: async (id: number, data: any) => {
        const res = await fetch(`${BASE_URL}/tracker/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': getCSRF() },
            body: JSON.stringify(data),
        });
        return res.json();
    },

    // DELETE WO
    deleteTracker: async (id: number) => {
        const res = await fetch(`${BASE_URL}/tracker/${id}`, {
            method: 'DELETE',
            headers: { 'X-CSRF-TOKEN': getCSRF() },
        });
        return res.json();
    },

    // POST tutup hari
    closeDay: async (id: number, user: string) => {
        const res = await fetch(`${BASE_URL}/tracker/${id}/close-day`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': getCSRF() },
            body: JSON.stringify({ user }),
        });
        return res.json();
    },

    // POST update hourly
    updateHourly: async (id: number, type: string, slot: string, value: number) => {
        const res = await fetch(`${BASE_URL}/hourly`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': getCSRF() },
            body: JSON.stringify({ id, type, slot, value }),
        });
        return res.json();
    },

    // POST add cutting
    addCutting: async (id: number, qty: number, user: string) => {
        const res = await fetch(`${BASE_URL}/material/cutting`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': getCSRF() },
            body: JSON.stringify({ id, qty, user }),
        });
        return res.json();
    },

    // POST add prep
    addPrep: async (id: number, process: string, qty: number, user: string) => {
        const res = await fetch(`${BASE_URL}/material/prep`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': getCSRF() },
            body: JSON.stringify({ id, process, qty, user }),
        });
        return res.json();
    },

    // POST kirim SPM ke line
    spmSend: async (id: number, qty: number) => {
        const res = await fetch(`${BASE_URL}/material/spm-send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': getCSRF() },
            body: JSON.stringify({ id, qty }),
        });
        return res.json();
    },
};

// Helper ambil CSRF token dari meta tag
function getCSRF(): string {
    return (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement)?.content ?? '';
}