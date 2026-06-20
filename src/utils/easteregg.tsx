const konami = [
  "ArrowUp", "ArrowUp",
  "ArrowDown", "ArrowDown",
  "ArrowLeft", "ArrowRight",
  "ArrowLeft", "ArrowRight",
  "b", "a",
];


console.log(
    "%c⚛ PhysicsSims",
    `
    color:#38bdf8;
    font-size:42px;
    font-weight:900;
    text-shadow:0 0 10px #38bdf8;
  `
  );

  console.log(
    "%cSTOPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPP",
    "color:#ef4444;font-size:28px;font-weight:bold;"
  );

  console.log(
    "%cThis is a browser feature intended for developers.\nIf someone told you to paste something here, don't. \nCuz we will know and then we will come for you and we will find you and we will hurt you.",
    "font-size:14px;color:#fbbf24;"
  );

export function initEasterEgg() {
  let index = 0;
  let enabled = false;

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key !== konami[index]) {
      index = 0;
      return;
    }

    index++;

    if (index === konami.length) {
      index = 0;
      enabled = !enabled;

      document.body.style.transition = "filter 0.6s ease";

      if (enabled) {
        document.body.style.filter =
          "hue-rotate(35deg) saturate(1.3)";
      } else {
        document.body.style.filter = "";
      }

      console.log(
        "%cChaos Mode Activated",
        "color:#22d3ee;font-size:14px;font-weight:bold;"
      );
    }
  };

  window.addEventListener('keydown', handleKeyDown);

  return () => {
    window.removeEventListener('keydown', handleKeyDown);
    document.body.style.transition = '';
    document.body.style.filter = '';
  };
}