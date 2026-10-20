// Shared behavior for every page: theme, nav, reveal, images, filters,
// copy buttons, the path timeline and the CV contents list.

(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch {} },
  };

  // Theme: follow the system unless the visitor picked one.
  const saved = store.get("theme");
  if (saved === "light" || saved === "dark") document.documentElement.dataset.theme = saved;
  const themeBtn = $("[data-theme-toggle]");
  if (themeBtn) {
    themeBtn.addEventListener("click", () => {
      const cur = document.documentElement.dataset.theme
        || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
      const next = cur === "dark" ? "light" : "dark";
      document.documentElement.dataset.theme = next;
      store.set("theme", next);
      document.dispatchEvent(new CustomEvent("themechange"));
    });
  }

  // Mobile nav.
  const nav = $(".nav");
  const toggle = $(".nav-toggle");
  if (nav && toggle) {
    const set = (open) => {
      nav.classList.toggle("is-open", open);
      toggle.setAttribute("aria-expanded", String(open));
    };
    toggle.addEventListener("click", () => set(!nav.classList.contains("is-open")));
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") set(false); });
    document.addEventListener("click", (e) => { if (!nav.contains(e.target)) set(false); });
  }

  // Images: show a labeled placeholder until the real photo is added.
  const markMissing = (img) => img.closest(".media")?.classList.add("is-missing");
  $$(".media img").forEach((img) => {
    if (img.complete && img.naturalWidth === 0) markMissing(img);
    img.addEventListener("error", () => markMissing(img), { once: true });
  });

  // Reveal: a quick fade, once, as content enters the viewport.
  const reveal = $$("[data-reveal]");
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); }
      });
    }, { rootMargin: "0px 0px -4% 0px" });
    reveal.forEach((el) => io.observe(el));
  } else {
    reveal.forEach((el) => el.classList.add("is-in"));
  }

  // Filters: chips toggle items by data-tags.
  $$("[data-filter-group]").forEach((group) => {
    const items = $$(group.dataset.filterGroup);
    const chips = $$(".chip", group);
    const empty = $("[data-filter-empty]");
    chips.forEach((chip) => {
      const f = chip.dataset.filter;
      const n = f === "all" ? items.length : items.filter((it) => it.dataset.tags.split(" ").includes(f)).length;
      chip.insertAdjacentHTML("beforeend", `<span class="n">${n}</span>`);
      chip.addEventListener("click", () => {
        chips.forEach((c) => c.setAttribute("aria-pressed", String(c === chip)));
        let shown = 0;
        items.forEach((it) => {
          const on = f === "all" || it.dataset.tags.split(" ").includes(f);
          it.hidden = !on;
          if (on) { shown++; it.classList.add("is-in"); }
        });
        if (empty) empty.hidden = shown > 0;
      });
    });
  });

  // Copy buttons.
  $$("[data-copy]").forEach((btn) => {
    const label = btn.textContent;
    btn.addEventListener("click", async () => {
      const src = btn.dataset.copy;
      const text = src.startsWith("#") ? $(src)?.textContent.trim() : src;
      try {
        await navigator.clipboard.writeText(text);
        btn.textContent = "Copied";
      } catch {
        btn.textContent = "Copy failed";
      }
      setTimeout(() => (btn.textContent = label), 1600);
    });
  });

  // Path timeline: year ticks, a "now" line, and rows that open details.
  const tl = $("[data-timeline]");
  if (tl) {
    const cs = getComputedStyle(tl);
    const start = parseFloat(cs.getPropertyValue("--start"));
    const end = parseFloat(cs.getPropertyValue("--end"));
    const years = $(".tl-years", tl);
    for (let y = Math.ceil(start); y <= Math.floor(end); y++) {
      const s = document.createElement("span");
      s.textContent = `’${String(y).slice(2)}`;
      s.style.left = `${((y - start) / (end - start)) * 100}%`;
      years.append(s);
    }
    const d = new Date();
    const now = d.getFullYear() + d.getMonth() / 12;
    tl.style.setProperty("--now", Math.min(end, now).toFixed(2));
    $$(".is-ongoing .tl-bar", tl).forEach((b) => b.style.setProperty("--to", Math.min(end, now).toFixed(2)));
    $$(".tl-track", tl).forEach((t) => t.insertAdjacentHTML("beforeend", '<span class="tl-now" aria-hidden="true"></span>'));
    $$(".tl-row", tl).forEach((row) => {
      const detail = document.getElementById(row.getAttribute("aria-controls"));
      row.addEventListener("click", () => {
        const open = row.getAttribute("aria-expanded") !== "true";
        row.setAttribute("aria-expanded", String(open));
        detail.hidden = !open;
      });
    });
  }

  // CV contents: highlight the section in view.
  const toc = $(".cv-toc");
  if (toc && "IntersectionObserver" in window) {
    const links = $$("a", toc);
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        links.forEach((a) => a.classList.toggle("is-active", a.hash === `#${e.target.id}`));
      });
    }, { rootMargin: "-20% 0px -70% 0px" });
    $$(".cv-sec[id]").forEach((s) => io.observe(s));
  }

  $$("[data-year]").forEach((el) => (el.textContent = new Date().getFullYear()));
})();
