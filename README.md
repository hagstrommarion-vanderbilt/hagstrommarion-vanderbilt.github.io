# Marion Hagstrom — personal site

Static HTML, CSS and JavaScript. No build step, no framework. Hosted on GitHub Pages.

## Files

| Path | What it is |
| --- | --- |
| `index.html` | About: hero, interactive knee figure, about, selected research, timeline, highlights, press, contact |
| `research.html` | Projects with filter chips |
| `publications.html` | Articles, data, patents, copy-citation buttons |
| `talks.html` | Talks and posters with filter chips |
| `teaching.html` | Teaching, mentorship, leadership, outreach |
| `cv.html` | CV with section links; prints cleanly to PDF |
| `css/site.css` | All styles. Colors are tokens at the top (`--accent`, `--steel`, …), with a dark theme |
| `js/site.js` | Theme toggle, mobile menu, quick fade-in, image placeholders, filters, copy buttons, timeline |
| `js/knee.js` | The interactive microprocessor-knee figure on the home page |

## Adding photos

Drop images into `assets/img/` with these names. Until a file exists, the page shows a labeled placeholder.

| File | Used on |
| --- | --- |
| `portrait.jpg` | Home, about (portrait, 4:5) |
| `ampk.jpg` | Home card + Research |
| `backward-walking.jpg` | Research |
| `activities.jpg` | Research |
| `assistive.jpg` | Research (gaming controllers / limb attachment / EMG hand) |
| `socket-brim.jpg` | Research (Gainesville Prosthetics) |
| `audiology-headbands.jpg` | Home card + Research |
| `venice.jpg` | Home card + Research |

Keep images around 1600 px wide and under ~400 KB (export as JPG at ~80% quality).

## Editing

- **Timeline** (home): each row is a `<button class="tl-row">`. Bars use `--from` / `--to` as decimal years (2024.5 = mid-2024); dots use `--at`. Rows with `is-ongoing` extend to today automatically.
- **Filters**: give an item `data-tags="knee assistive"` and a chip `data-filter="knee"`.
- **Knee figure**: the angle keyframes and valve schedule are at the top of `js/knee.js`. To use your own lab data, replace the `THIGH`, `KNEE`, `ANKLE` keyframes and `VALVE` schedule, and update the caption in `index.html`.
- **Fade-in speed**: `.js [data-reveal]` in `css/site.css` (currently 0.2 s, 6 px).

## Publishing

Copy these files into the root of the GitHub Pages repo, replacing the old ones, then commit and push.
