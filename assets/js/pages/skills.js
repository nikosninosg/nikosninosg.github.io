/**
 * pages/skills.js: collapses long skill lists ([data-skill-list], used on Home and About) to the first LIMIT items
 * and adds a "Show N more" toggle (lists marked [data-skill-all] are never collapsed). Without JS every item stays visible. Items beyond the limit get [data-extra];
 * the CSS (about.css / home.css) hides them while the list has .is-collapsed. Print expands everything.
 */
const LIMIT = 8;

function init() {
  document.querySelectorAll('[data-skill-list]').forEach((list, n) => {
    if (list.hasAttribute('data-skill-all')) return; // e.g. Technologies: always shown in full
    const items = [...list.children];
    if (items.length <= LIMIT) return;
    const extra = items.slice(LIMIT);
    extra.forEach((li) => li.setAttribute('data-extra', ''));
    list.classList.add('is-collapsible', 'is-collapsed');
    if (!list.id) list.id = `skill-list-${n + 1}`;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'skill-more';
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-controls', list.id);
    const label = (open) => {
      btn.textContent = open ? 'Show less' : `Show ${extra.length} more`;
    };
    label(false);
    btn.addEventListener('click', () => {
      const open = list.classList.toggle('is-collapsed') === false;
      btn.setAttribute('aria-expanded', String(open));
      label(open);
    });
    list.after(btn);
  });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
else init();
