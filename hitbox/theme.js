(() => {
  const storageKey = "hitboxTheme";

  try {
    const saved = localStorage.getItem(storageKey);
    if (saved === "dark") document.documentElement.dataset.hitboxTheme = "dark";
  } catch {
    // ignore
  }

  function setTheme(theme) {
    if (theme === "dark") document.documentElement.dataset.hitboxTheme = "dark";
    else delete document.documentElement.dataset.hitboxTheme;
  }

  function setOptionText(select, value, text) {
    if (!select) return;
    const opt = select.querySelector(`option[value="${value}"]`);
    if (opt) opt.textContent = text;
  }

  function syncLocalizedLabels(lang) {
    const versionSelect = document.getElementById("selectVersion");
    const themeSelect = document.getElementById("hitboxThemeSelect");

    if (lang === "ja") {
      setOptionText(versionSelect, "U", "海外版");
      setOptionText(versionSelect, "J", "日本版");
      setOptionText(themeSelect, "light", "ライト");
      setOptionText(themeSelect, "dark", "ダーク");
    } else {
      setOptionText(versionSelect, "U", "U Version");
      setOptionText(versionSelect, "J", "J Version");
      setOptionText(themeSelect, "light", "Light");
      setOptionText(themeSelect, "dark", "Dark");
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    const select = document.getElementById("hitboxThemeSelect");
    if (!select) return;

    const langSelect = document.getElementById("selectLang");

    select.value = document.documentElement.dataset.hitboxTheme === "dark" ? "dark" : "light";
    select.addEventListener("change", () => {
      const theme = select.value === "dark" ? "dark" : "light";
      setTheme(theme);
      try {
        localStorage.setItem(storageKey, theme);
      } catch {
        // ignore
      }
    });

    if (langSelect) {
      langSelect.addEventListener("change", () => {
        syncLocalizedLabels(langSelect.value);
      });
    }

    // Initial pass uses whatever is currently selected (may be updated later by framedisplay.js).
    syncLocalizedLabels(langSelect ? langSelect.value : "en");

    // framedisplay.js sets language on window.onload; run again after it finishes.
    window.addEventListener("load", () => {
      setTimeout(() => {
        const currentLang = (langSelect && langSelect.value) ? langSelect.value : "en";
        syncLocalizedLabels(currentLang);
      }, 0);
    });
  });
})();
