(function () {
  const LOCAL_STORAGE_LANGUAGE_KEY = 'smash64:lang';

  const normalizeLanguage = (value) => (String(value || '').toLowerCase() === 'ja' ? 'ja' : 'en');

  const detectLanguage = (fallback = 'en') => {
    if (window.VersionLanguageSelector && typeof window.VersionLanguageSelector.detectLanguage === 'function') {
      return window.VersionLanguageSelector.detectLanguage(fallback);
    }

    const fallbackLang = normalizeLanguage(fallback);
    const candidates = [];
    if (Array.isArray(navigator.languages)) {
      candidates.push(...navigator.languages);
    }
    if (navigator.language) {
      candidates.push(navigator.language);
    }

    for (const entry of candidates) {
      if (!entry) continue;
      const lower = String(entry).toLowerCase();
      if (lower.startsWith('ja')) return 'ja';
      if (lower.startsWith('en')) return 'en';
    }

    return fallbackLang;
  };

  const init = (root) => {
    if (!root) return;

    const languageSelect = root.querySelector('[data-lang-select]');
    const langButtons = Array.from(root.querySelectorAll('[data-lang-option]'));
    if (!languageSelect) return;

    const pathByLanguage = {
      en: root.dataset.langPathEn || '/vods/',
      ja: root.dataset.langPathJa || '/ja/vods/',
    };

    const currentLanguage = normalizeLanguage(document.documentElement.lang || languageSelect.value || 'en');
    const searchParams = new URLSearchParams(window.location.search);
    const urlLanguageRaw = searchParams.get('lang');
    const urlLanguage = urlLanguageRaw ? normalizeLanguage(urlLanguageRaw) : null;

    const buildTargetUrl = (language) => {
      const targetPath = pathByLanguage[language] || pathByLanguage.en;
      const url = new URL(targetPath, window.location.origin);
      const params = new URLSearchParams(window.location.search);
      params.delete('lang');
      params.forEach((value, key) => url.searchParams.set(key, value));
      return url;
    };

    if (urlLanguage && urlLanguage !== currentLanguage) {
      window.location.replace(buildTargetUrl(urlLanguage).toString());
      return;
    }

    const storedLanguage = window.localStorage ? window.localStorage.getItem(LOCAL_STORAGE_LANGUAGE_KEY) : null;
    const storedPreference = storedLanguage ? normalizeLanguage(storedLanguage) : null;
    if (currentLanguage === 'en' && !urlLanguage) {
      const preferred = storedPreference || detectLanguage(currentLanguage);
      if (preferred === 'ja') {
        window.location.replace(buildTargetUrl('ja').toString());
        return;
      }
    }

    languageSelect.value = currentLanguage;

    const updateButtons = () => {
      const activeLang = normalizeLanguage(languageSelect.value);
      langButtons.forEach((button) => {
        const isActive = normalizeLanguage(button.dataset.langOption) === activeLang;
        button.classList.toggle('is-active', isActive);
        button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
      });
    };

    updateButtons();

    languageSelect.addEventListener('change', () => {
      const nextLanguage = normalizeLanguage(languageSelect.value);
      if (window.localStorage) {
        window.localStorage.setItem(LOCAL_STORAGE_LANGUAGE_KEY, nextLanguage);
      }
      window.location.href = buildTargetUrl(nextLanguage).toString();
    });

    langButtons.forEach((button) => {
      button.addEventListener('click', () => {
        const value = normalizeLanguage(button.dataset.langOption);
        if (languageSelect.value === value) return;
        languageSelect.value = value;
        languageSelect.dispatchEvent(new Event('change', { bubbles: true }));
      });
    });
  };

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-language-selector]').forEach(init);
  });
})();
