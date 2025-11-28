// Legacy placeholder. The React client now lives under src/ via Vite.
// Keeping this stub prevents stale browser tabs or server renders from crashing
// when they still request /client/main.js.
(function legacyClientNotice() {
    if (typeof window === 'undefined') return;

    console.warn('Legacy client script is no longer used. Run the React client instead.');

    const bannerId = 'legacy-client-banner';
    if (document.getElementById(bannerId)) return;

    const banner = document.createElement('div');
    banner.id = bannerId;
    banner.style.cssText = [
        'position:fixed',
        'top:0',
        'left:0',
        'right:0',
        'padding:12px',
        'background:#222',
        'color:#fff',
        'font-family:system-ui, sans-serif',
        'font-size:14px',
        'z-index:9999',
        'text-align:center'
    ].join(';');

    banner.textContent = 'The legacy client has been replaced. Run `npm run dev` inside client/ to launch the React UI.';
    document.body.appendChild(banner);
})();