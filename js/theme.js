// pick the theme before first paint: saved choice, else the system setting (same logic as biblioteca)
(function () {
  const root = document.documentElement;
  const query = window.matchMedia("(prefers-color-scheme: dark)");
  const saved = () => { try { return localStorage.getItem("theme"); } catch (e) { return null; } };
  const bar = document.createElement("meta");   // tints the browser bar on phones
  bar.name = "theme-color";
  document.head.appendChild(bar);
  const BAR_COLOR = { light: "#f0eadc", dark: "#282828" };
  function apply(theme) {
    root.setAttribute("data-theme", theme);
    bar.content = BAR_COLOR[theme];
    const button = document.getElementById("theme-toggle");
    if (button) button.setAttribute("aria-label", theme === "dark" ? "switch to light mode" : "switch to dark mode");
  }
  apply(saved() || (query.matches ? "dark" : "light"));
  query.addEventListener("change", e => { if (!saved()) apply(e.matches ? "dark" : "light"); });
  document.addEventListener("DOMContentLoaded", () => {
    const button = document.getElementById("theme-toggle");
    apply(root.getAttribute("data-theme"));
    button.addEventListener("click", () => {
      const next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
      try { localStorage.setItem("theme", next); } catch (e) {}
      apply(next);
    });
  });
})();
