export function loadWebFonts() {
  if (typeof document === 'undefined') return;
  const load = () => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Noto+Sans+SC:wght@400;500;700&family=Noto+Serif+SC:wght@500;600&display=swap';
    document.head.appendChild(link);
  };
  if (document.readyState === 'complete') load();
  else window.addEventListener('load', load, { once: true });
}
