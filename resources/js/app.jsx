import './bootstrap';

import React from 'react';
import { createRoot } from 'react-dom/client';

// Pakai dynamic import
import('/resources/js/App.tsx').then(({ default: App }) => {
    const container = document.getElementById('app');
    if (container) {
        createRoot(container).render(
            React.createElement(React.StrictMode, null,
                React.createElement(App, null)
            )
        );
    }
});