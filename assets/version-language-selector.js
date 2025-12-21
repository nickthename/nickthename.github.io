(function () {
  const DEFAULT_VERSION_BY_LANGUAGE = { en: 'U', ja: 'J' };

  const normalizeLanguage = (value) => (String(value || '').toLowerCase() === 'ja' ? 'ja' : 'en');
  const normalizeVersion = (value) => (String(value || '').toUpperCase() === 'J' ? 'J' : 'U');

  const detectLanguage = (fallback = 'en') => {
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
      if (lower.startsWith('ja')) {
        return 'ja';
      }
      if (lower.startsWith('en')) {
        return 'en';
      }
    }

    return fallbackLang;
  };

  const getInitialValue = (select, value) => {
    if (!select) return value;
    const options = Array.from(select.options || []);
    if (options.some((option) => option.value === value)) {
      return value;
    }
    return options[0] ? options[0].value : value;
  };

  const parseSearchParams = (searchParams, key) => {
    if (!searchParams || !key) return null;
    const value = searchParams.get(key);
    return value ? value.trim() : null;
  };

  const init = (options = {}) => {
    const root = options.root || document.querySelector(options.selector || '[data-version-language-selector]');
    if (!root) return null;

    const languageSelect = options.languageSelect || root.querySelector('[data-lang-select]');
    const versionSelect = options.versionSelect || root.querySelector('[data-version-select]');
    const labelNode = options.labelNode || root.querySelector('[data-version-language-label]');
    const langButtons = Array.from(root.querySelectorAll('[data-lang-option]'));
    const versionButtons = Array.from(root.querySelectorAll('[data-version-option]'));

    if (!languageSelect || !versionSelect) {
      return null;
    }

    const versionByLanguage = options.versionByLanguage || DEFAULT_VERSION_BY_LANGUAGE;
    const defaultLanguage = normalizeLanguage(options.defaultLanguage || 'en');
    const defaultVersion = normalizeVersion(options.defaultVersion || 'U');
    const syncVersion = options.syncVersionOnLanguageChange === true;
    const emitInitial = options.emitInitial !== false;

    const searchParams = options.allowUrlParams === false
      ? null
      : new URLSearchParams(window.location.search);

    const urlLanguageRaw = parseSearchParams(searchParams, options.languageParam || 'lang');
    const urlVersionRaw = parseSearchParams(searchParams, options.versionParam || 'ver');
    const urlLanguage = urlLanguageRaw ? normalizeLanguage(urlLanguageRaw.toLowerCase()) : null;
    const urlVersion = urlVersionRaw ? normalizeVersion(urlVersionRaw.toUpperCase()) : null;

    let language = normalizeLanguage(options.initialLanguage || urlLanguage || detectLanguage(defaultLanguage));
    let version = normalizeVersion(options.initialVersion || urlVersion || versionByLanguage[language] || defaultVersion);

    language = getInitialValue(languageSelect, language);
    version = getInitialValue(versionSelect, version);

    languageSelect.value = language;
    versionSelect.value = version;

    let state = { language, version };

    const formatLabel = () => {
      if (!labelNode) return;
      const labels = options.labels || {
        en: { language: 'English', versionSuffix: 'Vers.' },
        ja: { language: '日本語', versionSuffix: '版' },
      };
      const langKey = normalizeLanguage(languageSelect.value);
      const verKey = normalizeVersion(versionSelect.value);
      const languageText = (labels[langKey] && labels[langKey].language) ? labels[langKey].language : 'English';
      const versionSuffix = (labels[langKey] && labels[langKey].versionSuffix) ? labels[langKey].versionSuffix : 'Vers.';
      labelNode.textContent = `${languageText} \u2022 (${verKey}) ${versionSuffix}`;
    };

    const updateButtonStates = () => {
      if (langButtons.length > 0 && languageSelect) {
        const activeLang = normalizeLanguage(languageSelect.value);
        langButtons.forEach((button) => {
          const isActive = normalizeLanguage(button.dataset.langOption) === activeLang;
          button.classList.toggle('is-active', isActive);
          button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        });
      }
      if (versionButtons.length > 0 && versionSelect) {
        const activeVersion = normalizeVersion(versionSelect.value);
        versionButtons.forEach((button) => {
          const isActive = normalizeVersion(button.dataset.versionOption) === activeVersion;
          button.classList.toggle('is-active', isActive);
          button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        });
      }
    };

    const emitChange = (source) => {
      state = { language: normalizeLanguage(languageSelect.value), version: normalizeVersion(versionSelect.value) };
      formatLabel();
      updateButtonStates();
      if (typeof options.onChange === 'function') {
        options.onChange({ ...state }, { source });
      }
      if (typeof CustomEvent === 'function') {
        root.dispatchEvent(new CustomEvent('versionlanguagechange', { detail: { ...state, source } }));
      }
    };

    languageSelect.addEventListener('change', () => {
      const nextLanguage = normalizeLanguage(languageSelect.value);
      if (syncVersion) {
        const mappedVersion = versionByLanguage[nextLanguage];
        if (mappedVersion) {
          versionSelect.value = normalizeVersion(mappedVersion);
        }
      }
      emitChange('language');
    });

    versionSelect.addEventListener('change', () => {
      emitChange('version');
    });

    if (languageSelect && langButtons.length > 0) {
      langButtons.forEach((button) => {
        button.type = 'button';
        button.addEventListener('click', () => {
          const value = normalizeLanguage(button.dataset.langOption);
          if (languageSelect.value === value) return;
          languageSelect.value = value;
          languageSelect.dispatchEvent(new Event('change', { bubbles: true }));
        });
      });
    }

    if (versionSelect && versionButtons.length > 0) {
      versionButtons.forEach((button) => {
        button.type = 'button';
        button.addEventListener('click', () => {
          const value = normalizeVersion(button.dataset.versionOption);
          if (versionSelect.value === value) return;
          versionSelect.value = value;
          versionSelect.dispatchEvent(new Event('change', { bubbles: true }));
        });
      });
    }

    formatLabel();
    updateButtonStates();

    if (emitInitial) {
      emitChange('init');
    }

    return {
      root,
      languageSelect,
      versionSelect,
      getState: () => ({ ...state }),
      setState: ({ language: nextLanguage, version: nextVersion } = {}) => {
        if (nextLanguage) {
          languageSelect.value = normalizeLanguage(nextLanguage);
        }
        if (nextVersion) {
          versionSelect.value = normalizeVersion(nextVersion);
        }
        emitChange('set');
      },
    };
  };

  window.VersionLanguageSelector = {
    init,
    detectLanguage,
    normalizeLanguage,
    normalizeVersion,
  };
})();
