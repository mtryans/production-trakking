import { defineConfig } from 'vite';
import laravel from 'laravel-vite-plugin';
import react from '@vitejs/plugin-react';

export default defineConfig({
    plugins: [
        laravel({
            input: ['resources/css/app.css', 'resources/js/app.jsx'], // Kita ubah entry point ke .jsx
            refresh: true,
        }),
        react(), // Tambahkan plugin React
    ],
});