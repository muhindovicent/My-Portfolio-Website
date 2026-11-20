// Small DOM and formatting helpers shared by every Studio page.

let modalSequence = 0;

export function h(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === null || value === undefined || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'html') node.innerHTML = value;
    else if (key === 'text') node.textContent = value;
    else if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2).toLowerCase(), value);
    else if (value === true) node.setAttribute(key, '');
    else node.setAttribute(key, value);
  }
  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
  return node;
}

export const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
};

export const formatRelative = (value) => {
  if (!value) return '—';
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return '—';
  const seconds = Math.round((then - Date.now()) / 1000);
  const units = [
    ['year', 31536000],
    ['month', 2592000],
    ['week', 604800],
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60],
  ];
  for (const [label, size] of units) {
    const amount = Math.round(seconds / size);
    if (Math.abs(amount) >= 1) return `${amount} ${label}${Math.abs(amount) === 1 ? '' : 's'} ago`;
  }
  return 'just now';
};

export function statusPill(status) {
  return h('span', { class: `pill ${status}` }, status);
}

export function stateView({ status, title, message, action = null }) {
  if (status === 'loading') {
    return h('div', { class: 'state', role: 'status', 'aria-live': 'polite' },
      h('div', { class: 'spinner', 'aria-hidden': 'true' }),
      h('p', {}, title || 'Loading…'),
    );
  }
  if (status === 'error') {
    return h('div', { class: 'state error', role: 'alert' },
      h('strong', {}, title || 'Something went wrong'),
      h('p', {}, message || 'Please try again.'),
      action,
    );
  }
  return h('div', { class: 'state' },
    h('strong', {}, title || 'Nothing here yet'),
    h('p', {}, message || 'Records you create will appear here.'),
    action,
  );
}

export function skeletonRows(columns = 4, rows = 4) {
  return h(
    'div',
    { class: 'table-wrap', 'aria-hidden': 'true' },
    h('div', { class: 'table' },
      h('div', { class: 'skeleton', style: `height:38px` }),
      Array.from({ length: rows }, () =>
        h('div', { style: 'display:grid;grid-template-columns:repeat(4,1fr);gap:16px;padding:12px 16px' },
          Array.from({ length: columns }, () => h('div', { class: 'skeleton' })),
        ),
      ),
    ),
  );
}

export function breadcrumbs(items) {
  const nav = h('nav', { class: 'breadcrumbs', 'aria-label': 'Breadcrumb' });
  items.forEach((item, index) => {
    if (index > 0) nav.append(h('span', { class: 'sep', 'aria-hidden': 'true' }, '›'));
    if (item.href && index < items.length - 1) {
      nav.append(h('a', { href: item.href, 'data-link': '' }, item.label));
    } else {
      nav.append(h('span', { 'aria-current': 'page' }, item.label));
    }
  });
  return nav;
}

export function toast(message, type = 'success') {
  const region = document.getElementById('toast-region');
  const node = h('div', { class: `toast ${type}`, role: 'status' }, message);
  region.append(node);
  setTimeout(() => {
    node.style.opacity = '0';
    node.style.transition = 'opacity 160ms ease';
    setTimeout(() => node.remove(), 170);
  }, 4200);
}

export function modal({ title, content, actions = [], wide = false }) {
  const root = document.getElementById('modal-root');
  const previousFocus = document.activeElement;
  let closeImpl = null;
  const close = () => {
    if (!closeImpl) return;
    closeImpl();
    closeImpl = null;
  };
  const onKey = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
    }
  };
  const backdrop = h('div', { class: 'modal-backdrop' },
    h('div', { class: `modal${wide ? ' modal-wide' : ''}`, role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
      h('div', { class: 'modal-header' },
        h('h2', {}, title),
        h('button', { class: 'icon-button', type: 'button', 'aria-label': 'Close dialog', onclick: close },
          h('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true', html: '<path d="M6 6l12 12M18 6L6 18"/>' }),
        ),
      ),
      h('div', { class: 'modal-body' }, content),
      h('div', { class: 'modal-footer' }, actions),
    ),
  );
  closeImpl = () => {
    backdrop.remove();
    document.body.style.overflow = '';
    if (previousFocus && previousFocus.focus) previousFocus.focus();
    document.removeEventListener('keydown', onKey);
  };
  backdrop.addEventListener('mousedown', (event) => {
    if (event.target === backdrop) close();
  });
  const form = backdrop.querySelector('.modal-body form');
  if (form && !form.id) form.id = `studio-modal-form-${++modalSequence}`;
  if (form) {
    backdrop.querySelectorAll('.modal-footer button[type="submit"]').forEach((button) => {
      if (!button.hasAttribute('form')) button.setAttribute('form', form.id);
    });
  }
  document.addEventListener('keydown', onKey);
  document.body.style.overflow = 'hidden';
  root.append(backdrop);
  const first = backdrop.querySelector('.modal-body input, .modal-body select, .modal-body textarea')
    || backdrop.querySelector('.modal-footer button, button');
  if (first) first.focus();
  return { close, node: backdrop };
}

export function confirmDialog({ title, message, confirmLabel = 'Delete', requireText = null }) {
  return new Promise((resolve) => {
    let input = null;
    const content = [h('p', { class: 'lede' }, message)];
    if (requireText) {
      content.push(h('div', { class: 'field' },
        h('label', { for: 'confirm-input' }, `Type “${requireText}” to confirm`),
        input = h('input', { id: 'confirm-input', type: 'text', autocomplete: 'off' }),
      ));
    }
    let modalClose = null;
    const finish = (value) => {
      modalClose?.();
      resolve(value);
    };
    modalClose = modal({
      title,
      content,
      actions: [
        h('button', { class: 'button ghost', type: 'button', onclick: () => finish(false) }, 'Cancel'),
        h('button', {
          class: 'button danger',
          type: 'button',
          onclick: () => {
            if (requireText && (!input || input.value.trim() !== requireText)) {
              toast(`Please type “${requireText}” to confirm.`, 'error');
              return;
            }
            finish(true);
          },
        }, confirmLabel),
      ],
    }).close;
  });
}

export function dataTable({ columns, rows, renderRow, empty }) {
  if (!rows || rows.length === 0) {
    return empty || stateView({ status: 'empty', title: 'No records', message: 'Records you create will appear here.' });
  }
  const table = h('table', { class: 'table' },
    h('thead', {}, h('tr', {}, columns.map((c) => h('th', { scope: 'col', text: c.label })))),
    h('tbody', {}, rows.map((row) => renderRow(row))),
  );
  return h('div', { class: 'table-wrap' }, table);
}

export function pagination(meta, onPage) {
  if (!meta || meta.totalPages <= 1) return null;
  const wrap = h('div', { class: 'toolbar' },
    h('span', { class: 'sub-cell' }, `${meta.total} record${meta.total === 1 ? '' : 's'}`),
    h('span', { class: 'spacer' }),
  );
  const prev = h('button', {
    class: 'button small ghost',
    type: 'button',
    disabled: meta.page <= 1,
    onclick: () => onPage(meta.page - 1),
  }, 'Previous');
  const next = h('button', {
    class: 'button small',
    type: 'button',
    disabled: meta.page >= meta.totalPages,
    onclick: () => onPage(meta.page + 1),
  }, 'Next');
  wrap.append(prev, h('span', { class: 'sub-cell' }, `Page ${meta.page} of ${meta.totalPages}`), next);
  return wrap;
}

export function field({ label, name, type = 'text', value = '', hint = '', required = false, options = null, full = false, step = null, min = null, max = null, placeholder = '' }) {
  const id = `field-${name}`;
  let control;
  if (options) {
    control = h('select', { id, name, required: required || null },
      options.map((opt) => {
        const value_ = typeof opt === 'string' ? opt : opt.value;
        const label_ = typeof opt === 'string' ? opt : opt.label;
        return h('option', { value: value_, selected: String(value_) === String(value) ? '' : null }, label_);
      }),
    );
  } else if (type === 'textarea') {
    control = h('textarea', { id, name, required: required || null, placeholder }, value ?? '');
  } else {
    control = h('input', { id, name, type, value: value ?? '', required: required || null, placeholder, step, min, max });
  }
  return h('div', { class: `field${full ? ' field--full' : ''}` },
    h('label', { for: id }, label),
    control,
    hint ? h('span', { class: 'hint' }, hint) : null,
  );
}

export const debounce = (fn, delay = 280) => {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
};

export const ICONS = {
  dashboard: '<rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/>',
  projects: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/>',
  about: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  education: '<path d="m12 3 10 5-10 5L2 8Z"/><path d="M6 10v5c0 1.5 3 3 6 3s6-1.5 6-3v-5"/>',
  experience: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  leadership: '<path d="M12 3v3M5 6h14l-2 5H7Z"/><path d="M7 11v9M17 11v9M4 20h16"/>',
  certifications: '<circle cx="12" cy="9" r="6"/><path d="m9 14-2 7 5-3 5 3-2-7"/>',
  skills: '<path d="M4 20 20 4"/><path d="M14 4h6v6"/>',
  media: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/>',
  messages: '<path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/>',
  security: '<path d="M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7Z"/><path d="m9 12 2 2 4-4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  trash: '<path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>',
  external: '<path d="M14 4h6v6M20 4l-9 9M9 5H7a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2"/>',
};

export function icon(name) {
  return h('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true', html: ICONS[name] || '' });
}
