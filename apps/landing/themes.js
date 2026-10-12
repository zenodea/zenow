// Picking a theme repaints the whole page, since every colour hangs off
// data-theme on <html>. The choice is remembered for this browser only; the
// inline script in <head> puts it back before the next first paint.
(function () {
  var KEY = "zenow.landing.theme";
  var root = document.documentElement;
  var buttons = document.querySelectorAll("[data-pick]");

  function show(theme) {
    root.dataset.theme = theme;
    buttons.forEach(function (button) {
      button.setAttribute("aria-pressed", String(button.dataset.pick === theme));
    });
  }

  buttons.forEach(function (button) {
    button.addEventListener("click", function () {
      show(button.dataset.pick);
      try {
        localStorage.setItem(KEY, button.dataset.pick);
      } catch (_) {}
    });
  });

  show(root.dataset.theme || "base");
})();
