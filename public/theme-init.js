try {
  var theme = localStorage.getItem('theme');
  if (theme !== 'light' && theme !== 'dark') {
    theme = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    localStorage.setItem('theme', theme);
  }
  document.documentElement.dataset.theme = theme;
  var meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme === 'light' ? '#F7F6F2' : '#0a0a0a');
  var lang = localStorage.getItem('expend_lang');
  if (lang === 'id' || lang === 'en') document.documentElement.lang = lang;
} catch (e) {
  // localStorage bisa diblokir (mode privat/kebijakan browser); tema default
  // tetap dipilih CSS lewat prefers-color-scheme.
}
