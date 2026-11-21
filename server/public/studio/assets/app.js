import { api, request, refreshCsrfToken, getCsrfToken } from './api.js';
import {
  h, clear, formatDate, formatRelative, statusPill, stateView, breadcrumbs, toast, modal,
  confirmDialog, dataTable, pagination, field, debounce, icon, skeletonRows,
} from './ui.js';

const view = document.getElementById('view');
const breadcrumbNav = document.getElementById('breadcrumbs');
const studio = document.getElementById('studio');

/* ------------------------------------------------------------------ */
/* Configuration                                                       */
/* ------------------------------------------------------------------ */

const NAV = [
  { section: 'Overview', items: [{ path: '/admin', label: 'Dashboard', icon: 'dashboard', exact: true }] },
  {
    section: 'Content',
    items: [
      { path: '/admin/projects', label: 'Projects', icon: 'projects' },
      { path: '/admin/about', label: 'About Me', icon: 'about' },
      { path: '/admin/education', label: 'Education', icon: 'education' },
      { path: '/admin/experience', label: 'Experience', icon: 'experience' },
      { path: '/admin/leadership', label: 'Leadership', icon: 'leadership' },
      { path: '/admin/certifications', label: 'Certifications', icon: 'certifications' },
      { path: '/admin/skills', label: 'Skills', icon: 'skills' },
      { path: '/admin/media', label: 'Media Library', icon: 'media' },
    ],
  },
  { section: 'Communication', items: [{ path: '/admin/messages', label: 'Messages', icon: 'messages' }] },
  {
    section: 'System',
    items: [
      { path: '/admin/settings', label: 'Settings', icon: 'settings' },
      { path: '/admin/security', label: 'Security', icon: 'security' },
    ],
  },
];

const LIST_CONFIG = {
  projects: {
    label: 'Project',
    plural: 'Projects',
    idKey: 'slug',
    columns: [
      { label: 'Name', key: 'name' },
      { label: 'Status', key: 'status' },
      { label: 'Featured', key: 'featured' },
      { label: 'Updated', key: 'updatedAt' },
    ],
    fields: [
      { label: 'Name', name: 'name', required: true },
      { label: 'Slug', name: 'slug', required: true, hint: 'Lowercase letters, numbers and hyphens.' },
      { label: 'Label', name: 'label' },
      { label: 'Summary', name: 'summary', type: 'textarea' },
      { label: 'Detail', name: 'detail', type: 'textarea', full: true },
      { label: 'Repository URL', name: 'repoUrl', type: 'url' },
      { label: 'Demo URL', name: 'demoUrl', type: 'url' },
      { label: 'Status', name: 'status', type: 'select', options: ['DRAFT', 'PUBLISHED', 'ARCHIVED'] },
      { label: 'Sort order', name: 'sortOrder', type: 'number', min: 0 },
      { label: 'Featured', name: 'featured', type: 'select', options: [{ value: 'true', label: 'Yes' }, { value: 'false', label: 'No' }] },
    ],
    renderRow: (row) => h('tr', { key: row.id },
      h('td', {}, h('div', { class: 'title-cell' }, row.name), h('div', { class: 'sub-cell' }, row.slug)),
      h('td', {}, statusPill(row.status)),
      h('td', {}, row.featured ? 'Yes' : '—'),
      h('td', { class: 'sub-cell' }, formatRelative(row.updatedAt)),
      h('td', {}, rowActions(row, 'projects')),
    ),
  },
  education: {
    label: 'Education',
    plural: 'Education',
    columns: [
      { label: 'Institution', key: 'institution' },
      { label: 'Degree', key: 'degree' },
      { label: 'Status', key: 'status' },
      { label: 'Updated', key: 'updatedAt' },
    ],
    fields: [
      { label: 'Institution', name: 'institution', required: true },
      { label: 'Degree', name: 'degree', required: true },
      { label: 'Field of study', name: 'fieldOfStudy' },
      { label: 'Start date', name: 'startDate', type: 'date' },
      { label: 'End date', name: 'endDate', type: 'date' },
      { label: 'Status', name: 'status', type: 'select', options: ['DRAFT', 'PUBLISHED', 'ARCHIVED'] },
      { label: 'Sort order', name: 'sortOrder', type: 'number', min: 0 },
    ],
    renderRow: (row) => h('tr', { key: row.id },
      h('td', {}, h('div', { class: 'title-cell' }, row.institution), h('div', { class: 'sub-cell' }, row.fieldOfStudy || '')),
      h('td', {}, row.degree),
      h('td', {}, statusPill(row.status)),
      h('td', { class: 'sub-cell' }, formatRelative(row.updatedAt)),
      h('td', {}, rowActions(row, 'education')),
    ),
  },
  experience: {
    label: 'Experience',
    plural: 'Experience',
    columns: [
      { label: 'Company', key: 'company' },
      { label: 'Role', key: 'role' },
      { label: 'Status', key: 'status' },
      { label: 'Updated', key: 'updatedAt' },
    ],
    fields: [
      { label: 'Company', name: 'company', required: true },
      { label: 'Role', name: 'role', required: true },
      { label: 'Location', name: 'location' },
      { label: 'Start date', name: 'startDate', type: 'date' },
      { label: 'End date', name: 'endDate', type: 'date' },
      { label: 'Current', name: 'current', type: 'select', options: [{ value: 'true', label: 'Yes' }, { value: 'false', label: 'No' }] },
      { label: 'Description', name: 'description', type: 'textarea', full: true },
      { label: 'Status', name: 'status', type: 'select', options: ['DRAFT', 'PUBLISHED', 'ARCHIVED'] },
      { label: 'Sort order', name: 'sortOrder', type: 'number', min: 0 },
    ],
    renderRow: (row) => h('tr', { key: row.id },
      h('td', {}, h('div', { class: 'title-cell' }, row.company), h('div', { class: 'sub-cell' }, row.location || '')),
      h('td', {}, row.role),
      h('td', {}, statusPill(row.status)),
      h('td', { class: 'sub-cell' }, formatRelative(row.updatedAt)),
      h('td', {}, rowActions(row, 'experience')),
    ),
  },
  leadership: {
    label: 'Leadership',
    plural: 'Leadership',
    columns: [
      { label: 'Organization', key: 'organization' },
      { label: 'Position', key: 'position' },
      { label: 'Status', key: 'status' },
      { label: 'Updated', key: 'updatedAt' },
    ],
    fields: [
      { label: 'Organization', name: 'organization', required: true },
      { label: 'Position', name: 'position', required: true },
      { label: 'Start date', name: 'startDate', type: 'date' },
      { label: 'End date', name: 'endDate', type: 'date' },
      { label: 'Description', name: 'description', type: 'textarea', full: true },
      { label: 'Status', name: 'status', type: 'select', options: ['DRAFT', 'PUBLISHED', 'ARCHIVED'] },
      { label: 'Sort order', name: 'sortOrder', type: 'number', min: 0 },
    ],
    renderRow: (row) => h('tr', { key: row.id },
      h('td', {}, h('div', { class: 'title-cell' }, row.organization)),
      h('td', {}, row.position),
      h('td', {}, statusPill(row.status)),
      h('td', { class: 'sub-cell' }, formatRelative(row.updatedAt)),
      h('td', {}, rowActions(row, 'leadership')),
    ),
  },
  certifications: {
    label: 'Certification',
    plural: 'Certifications',
    columns: [
      { label: 'Title', key: 'title' },
      { label: 'Issuer', key: 'issuer' },
      { label: 'Status', key: 'status' },
      { label: 'Updated', key: 'updatedAt' },
    ],
    fields: [
      { label: 'Title', name: 'title', required: true },
      { label: 'Issuer', name: 'issuer', required: true },
      { label: 'Date', name: 'date', type: 'date' },
      { label: 'Description', name: 'description', type: 'textarea', full: true },
      { label: 'Status', name: 'status', type: 'select', options: ['DRAFT', 'PUBLISHED', 'ARCHIVED'] },
      { label: 'Sort order', name: 'sortOrder', type: 'number', min: 0 },
    ],
    renderRow: (row) => h('tr', { key: row.id },
      h('td', {}, h('div', { class: 'title-cell' }, row.title)),
      h('td', {}, row.issuer),
      h('td', {}, statusPill(row.status)),
      h('td', { class: 'sub-cell' }, formatRelative(row.updatedAt)),
      h('td', {}, rowActions(row, 'certifications')),
    ),
  },
  skills: {
    label: 'Skill',
    plural: 'Skills',
    columns: [
      { label: 'Name', key: 'name' },
      { label: 'Category', key: 'category' },
      { label: 'Proficiency', key: 'proficiency' },
      { label: 'Updated', key: 'updatedAt' },
    ],
    fields: [
      { label: 'Name', name: 'name', required: true },
      { label: 'Category', name: 'category', required: true },
      { label: 'Proficiency', name: 'proficiency', type: 'number', min: 0, max: 100 },
      { label: 'Sort order', name: 'sortOrder', type: 'number', min: 0 },
    ],
    renderRow: (row) => h('tr', { key: row.id },
      h('td', {}, h('div', { class: 'title-cell' }, row.name)),
      h('td', {}, row.category),
      h('td', {}, row.proficiency == null ? '—' : `${row.proficiency}%`),
      h('td', { class: 'sub-cell' }, formatRelative(row.updatedAt)),
      h('td', {}, rowActions(row, 'skills')),
    ),
  },
};

/* ------------------------------------------------------------------ */
/* Session and theme                                                   */
/* ------------------------------------------------------------------ */

let session = null;

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  const toggle = document.getElementById('theme-toggle');
  toggle.setAttribute('aria-pressed', theme === 'dark' ? 'true' : 'false');
  toggle.setAttribute('aria-label', theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
}

function initTheme() {
  const stored = localStorage.getItem('studio-theme');
  const theme = stored || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  applyTheme(theme);
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (event) => {
    if (!localStorage.getItem('studio-theme')) applyTheme(event.matches ? 'dark' : 'light');
  });
  document.getElementById('theme-toggle').addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('studio-theme', next);
    applyTheme(next);
  });
}

/* ------------------------------------------------------------------ */
/* Shell                                                               */
/* ------------------------------------------------------------------ */

function buildSidebar() {
  const nav = document.getElementById('sidebar-nav');
  clear(nav);
  for (const group of NAV) {
    const section = h('div', { class: 'nav-section' });
    if (group.section) section.append(h('div', { class: 'nav-section-title' }, group.section));
    for (const item of group.items) {
      const count = item.path === '/admin/messages' && session ? session.unreadMessages : null;
      const link = h('a', {
        class: 'sidebar-link',
        href: item.path,
        'data-link': '',
        'aria-current': 'false',
      }, icon(item.icon), h('span', {}, item.label), count ? h('span', { class: 'count', 'data-unread': '' }, String(count)) : null);
      link.addEventListener('click', (event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey) return;
        event.preventDefault();
        navigate(item.path);
      });
      section.append(link);
    }
    nav.append(section);
  }
}

function markActive(path) {
  document.querySelectorAll('.sidebar-link').forEach((link) => {
    const href = link.getAttribute('href');
    const active = href === path || (href !== '/admin' && path.startsWith(`${href}/`));
    link.setAttribute('aria-current', active ? 'page' : 'false');
  });
}

function initSidebar() {
  const collapse = document.getElementById('collapse-button');
  collapse.addEventListener('click', () => {
    const collapsed = studio.classList.toggle('nav-collapsed');
    collapse.setAttribute('aria-expanded', String(!collapsed));
    collapse.setAttribute('aria-label', collapsed ? 'Expand navigation' : 'Collapse navigation');
    localStorage.setItem('studio-nav-collapsed', collapsed ? '1' : '0');
  });
  if (localStorage.getItem('studio-nav-collapsed') === '1') {
    studio.classList.add('nav-collapsed');
    collapse.setAttribute('aria-expanded', 'false');
    collapse.setAttribute('aria-label', 'Expand navigation');
  }

  const menu = document.getElementById('menu-button');
  const backdrop = document.getElementById('sidebar-backdrop');
  const setOpen = (open) => {
    document.getElementById('sidebar').classList.toggle('open', open);
    backdrop.hidden = !open;
    if (open) requestAnimationFrame(() => backdrop.classList.add('show'));
    else backdrop.classList.remove('show');
    menu.setAttribute('aria-expanded', String(open));
    menu.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
  };
  menu.addEventListener('click', () => setOpen(!document.getElementById('sidebar').classList.contains('open')));
  backdrop.addEventListener('click', () => setOpen(false));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && document.getElementById('sidebar').classList.contains('open')) setOpen(false);
  });
}

function initSearch() {
  const form = document.getElementById('search-form');
  const input = document.getElementById('search-input');
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const q = input.value.trim();
    if (q) navigate(`/admin/search?q=${encodeURIComponent(q)}`);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === '/' && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
      event.preventDefault();
      input.focus();
    }
    if (event.key === 'Escape' && document.activeElement === input) {
      input.value = '';
      input.blur();
    }
  });
}

function closePopover(id) {
  const pop = document.getElementById(id);
  if (pop) pop.hidden = true;
  const toggle = document.getElementById(`${id.replace('-popover', '-toggle')}`);
  if (toggle) toggle.setAttribute('aria-expanded', 'false');
}

function initPopovers() {
  const notifToggle = document.getElementById('notifications-toggle');
  const notifPop = document.getElementById('notifications-popover');
  notifToggle.addEventListener('click', async () => {
    const open = notifPop.hidden;
    closePopover('profile-popover');
    notifPop.hidden = !open;
    notifToggle.setAttribute('aria-expanded', String(open));
    if (open) await renderNotifications();
  });

  const profileToggle = document.getElementById('profile-toggle');
  const profilePop = document.getElementById('profile-popover');
  profileToggle.addEventListener('click', () => {
    const open = profilePop.hidden;
    closePopover('notifications-popover');
    profilePop.hidden = !open;
    profileToggle.setAttribute('aria-expanded', String(open));
  });

  document.addEventListener('click', (event) => {
    if (!event.target.closest('#notifications')) closePopover('notifications-popover');
    if (!event.target.closest('#profile-menu')) closePopover('profile-popover');
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closePopover('notifications-popover');
      closePopover('profile-popover');
    }
  });

  document.getElementById('logout-button').addEventListener('click', async () => {
    closePopover('profile-popover');
    await api.logout();
    session = null;
    toast('Signed out.', 'success');
    navigate('/admin/login', { replace: true });
  });
}

async function renderNotifications() {
  const pop = document.getElementById('notifications-popover');
  clear(pop);
  pop.append(h('h3', {}, 'Notifications'));
  try {
    const data = (await api.notifications()).data;
    if (!data.messages.length && !data.security.length) {
      pop.append(h('div', { class: 'notification-item' }, 'You are all caught up.'));
      return;
    }
    for (const message of data.messages) {
      pop.append(h('button', {
        class: 'notification-item',
        type: 'button',
        onclick: () => navigate('/admin/messages'),
      }, h('strong', {}, message.subject || message.name), h('time', {}, formatRelative(message.createdAt))));
    }
    for (const event of data.security) {
      pop.append(h('div', { class: 'notification-item' }, h('strong', {}, event.action), h('time', {}, formatRelative(event.createdAt))));
    }
  } catch (error) {
    pop.append(h('div', { class: 'notification-item' }, 'Unable to load notifications.'));
  }
}

function updateNotificationBadge(unread) {
  const badge = document.getElementById('notification-badge');
  if (unread > 0) {
    badge.hidden = false;
    badge.textContent = unread > 99 ? '99+' : String(unread);
  } else {
    badge.hidden = true;
  }
}

function applySession(session_) {
  session = session_;
  const admin = session_ && session_.admin ? session_.admin : session_;
  document.getElementById('profile-name').textContent = admin.name || admin.email || 'Administrator';
  document.getElementById('profile-email').textContent = admin.email || '';
  const initials = (admin.name || admin.email || 'A').trim().charAt(0);
  document.getElementById('profile-avatar').textContent = initials;
  if (typeof admin.unreadMessages === 'number') updateNotificationBadge(admin.unreadMessages);
}

/* ------------------------------------------------------------------ */
/* Router                                                              */
/* ------------------------------------------------------------------ */

const routes = {
  '/admin': { title: 'Dashboard', render: renderDashboard, breadcrumb: ['Dashboard'] },
  '/admin/projects': { title: 'Projects', render: () => renderList('projects'), breadcrumb: ['Projects'] },
  '/admin/about': { title: 'About Me', render: renderAbout, breadcrumb: ['About Me'] },
  '/admin/education': { title: 'Education', render: () => renderList('education'), breadcrumb: ['Education'] },
  '/admin/experience': { title: 'Experience', render: () => renderList('experience'), breadcrumb: ['Experience'] },
  '/admin/leadership': { title: 'Leadership', render: () => renderList('leadership'), breadcrumb: ['Leadership'] },
  '/admin/certifications': { title: 'Certifications', render: () => renderList('certifications'), breadcrumb: ['Certifications'] },
  '/admin/skills': { title: 'Skills', render: () => renderList('skills'), breadcrumb: ['Skills'] },
  '/admin/media': { title: 'Media Library', render: renderMedia, breadcrumb: ['Media Library'] },
  '/admin/messages': { title: 'Messages', render: renderMessages, breadcrumb: ['Messages'] },
  '/admin/settings': { title: 'Settings', render: renderSettings, breadcrumb: ['Settings'] },
  '/admin/security': { title: 'Security', render: renderSecurity, breadcrumb: ['Security'] },
  '/admin/search': { title: 'Search', render: renderSearch, breadcrumb: ['Search'] },
};

function currentPath() {
  return window.location.pathname.replace(/\/+$/, '') || '/admin';
}

async function render() {
  const path = currentPath();
  if (path === '/admin/login') {
    document.body.classList.add('is-unauthenticated');
    clear(breadcrumbNav);
    await renderLogin();
    return;
  }
  document.body.classList.remove('is-unauthenticated');

  const route = routes[path];
  if (!route) {
    clear(breadcrumbNav);
    clear(view);
    view.append(stateView({ status: 'error', title: 'Page not found', message: `No Studio page exists at ${path}.` }));
    return;
  }
  markActive(path);
  clear(breadcrumbNav);
  breadcrumbNav.append(breadcrumbs(route.breadcrumb.map((label, index) => ({
    label,
    href: index < route.breadcrumb.length - 1 ? path : null,
  }))));
  document.title = `${route.title} · Portfolio Studio`;
  clear(view);
  try {
    await route.render();
  } catch (error) {
    clear(view);
    view.append(stateView({
      status: 'error',
      title: 'Unable to load this page',
      message: error.message || 'Please try again.',
      action: h('button', { class: 'button', type: 'button', onclick: () => render() }, 'Retry'),
    }));
  }
}

function navigate(path, { replace = false } = {}) {
  if (replace) window.history.replaceState({}, '', path);
  else window.history.pushState({}, '', path);
  render();
  document.getElementById('studio-main').focus({ preventScroll: true });
  window.scrollTo({ top: 0 });
}

function initRouter() {
  document.addEventListener('click', (event) => {
    const link = event.target.closest('a[data-link]');
    if (!link) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || link.target === '_blank') return;
    const href = link.getAttribute('href');
    if (!href || href.startsWith('http') || href.startsWith('/api') || href === '/') return;
    event.preventDefault();
    closePopover('notifications-popover');
    closePopover('profile-popover');
    navigate(href);
  });
  window.addEventListener('popstate', render);
}

/* ------------------------------------------------------------------ */
/* Shared page helpers                                                 */
/* ------------------------------------------------------------------ */

function pageHeader(title, lede, actions = null) {
  return h('div', { class: 'page-header' },
    h('div', {}, h('h1', {}, title), lede ? h('p', { class: 'lede' }, lede) : null),
    actions ? h('div', { class: 'actions' }, actions) : null,
  );
}

function rowActions(row, resource) {
  const config = LIST_CONFIG[resource];
  const label = row.name || row.title || row.institution || row.company || row.organization || row.category || row.id;
  return h('div', { class: 'row-actions' },
    h('button', {
      class: 'button small ghost',
      type: 'button',
      'aria-label': `Edit ${config.label} ${label}`,
      onclick: () => openEditor(resource, row),
    }, icon('edit')),
    h('button', {
      class: 'button small danger',
      type: 'button',
      'aria-label': `Delete ${config.label} ${label}`,
      onclick: () => removeRecord(resource, row),
    }, icon('trash')),
  );
}

function readForm(form, fields) {
  const body = {};
  for (const f of fields) {
    const input = form.elements[f.name];
    if (!input) continue;
    const raw = input.value.trim();
    if (f.type === 'number') {
      body[f.name] = raw === '' ? (f.optional ? undefined : 0) : Number(raw);
    } else if (f.type === 'select' && (raw === 'true' || raw === 'false')) {
      body[f.name] = raw === 'true';
    } else if (f.type === 'date') {
      body[f.name] = raw ? new Date(raw).toISOString() : undefined;
    } else {
      body[f.name] = raw === '' ? undefined : raw;
    }
  }
  return body;
}

async function openEditor(resource, row = null) {
  const config = LIST_CONFIG[resource];
  const fields = config.fields;
  const form = h('form', { class: 'form-grid', novalidate: '' },
    fields.map((f) => field({
      ...f,
      value: row ? normalizeValue(row[f.name], f.type) : defaultFieldValue(f),
    })),
  );

  let closeEditor = () => {};
  const { close } = modal({
    title: row ? `Edit ${config.label}` : `New ${config.label}`,
    content: form,
    actions: [
      h('button', { class: 'button ghost', type: 'button', onclick: () => closeEditor() }, 'Cancel'),
      h('button', { class: 'button primary', type: 'submit' }, row ? 'Save changes' : 'Create'),
    ],
  });
  closeEditor = close;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const submit = document.querySelector(`button[form="${form.id}"][type="submit"]`) || form.querySelector('button[type="submit"]');
    submit.disabled = true;
    submit.textContent = 'Saving…';
    try {
      const body = readForm(form, fields);
      if (resource === 'projects' && !row) {
        body.slug = String(body.slug || '').toLowerCase();
      }
      if (row) await api.update(resource, row[config.idKey || 'id'], body);
      else await api.create(resource, body);
      close();
      toast(row ? `${config.label} updated.` : `${config.label} created.`);
      render();
    } catch (error) {
      toast(error.message, 'error');
      submit.disabled = false;
      submit.textContent = row ? 'Save changes' : 'Create';
    }
  });
}

async function removeRecord(resource, row) {
  const config = LIST_CONFIG[resource];
  const name = row.name || row.title || row.institution || row.company || row.organization || row.id;
  const ok = await confirmDialog({
    title: `Delete ${config.label.toLowerCase()}`,
    message: `This permanently removes “${name}”. This action cannot be undone.`,
    confirmLabel: 'Delete',
  });
  if (!ok) return;
  try {
    await api.remove(resource, row[config.idKey || 'id']);
    toast(`${config.label} deleted.`);
    render();
  } catch (error) {
    toast(error.message, 'error');
  }
}

function normalizeValue(value, type) {
  if (value === null || value === undefined) return '';
  if (type === 'date') return String(value).slice(0, 10);
  if (type === 'select' && (value === true || value === false)) return String(value);
  return value;
}

function defaultFieldValue(f) {
  if (f.type === 'select') {
    if (f.name === 'status') return 'DRAFT';
    if (f.options && f.options[0]) return typeof f.options[0] === 'string' ? f.options[0] : f.options[0].value;
  }
  if (f.type === 'number') return f.name === 'sortOrder' ? 0 : '';
  return '';
}

/* ------------------------------------------------------------------ */
/* Generic list page                                                   */
/* ------------------------------------------------------------------ */

async function renderList(resource) {
  const config = LIST_CONFIG[resource];
  const state = { page: 1, status: '' };
  const toolbar = h('div', { class: 'toolbar' },
    h('select', { 'aria-label': 'Filter by status' },
      h('option', { value: '' }, 'All statuses'),
      h('option', { value: 'PUBLISHED' }, 'Published'),
      h('option', { value: 'DRAFT' }, 'Draft'),
      h('option', { value: 'ARCHIVED' }, 'Archived'),
    ),
    h('span', { class: 'spacer' }),
    h('button', { class: 'button primary', type: 'button' }, icon('plus'), ' New ', config.label),
  );
  toolbar.querySelector('select').addEventListener('change', (event) => {
    state.status = event.target.value;
    state.page = 1;
    load();
  });
  toolbar.querySelector('button').addEventListener('click', () => openEditor(resource));

  const container = h('div', {});
  view.append(
    pageHeader(config.plural, `Manage your ${config.label.toLowerCase()} records.`, null),
    toolbar,
    container,
  );

  async function load() {
    clear(container);
    container.append(skeletonRows(4, 4));
    try {
      const response = await api.list(resource, { page: state.page, limit: 12, status: state.status || undefined });
      clear(container);
      container.append(dataTable({
        columns: config.columns,
        rows: response.data,
        renderRow: (row) => config.renderRow(row),
      }));
      const pager = pagination(response.meta, (page) => { state.page = page; load(); });
      if (pager) container.append(pager);
    } catch (error) {
      clear(container);
      container.append(stateView({
        status: 'error',
        title: 'Could not load records',
        message: error.message,
        action: h('button', { class: 'button', type: 'button', onclick: load }, 'Retry'),
      }));
    }
  }
  await load();
}

/* ------------------------------------------------------------------ */
/* Dashboard                                                           */
/* ------------------------------------------------------------------ */

async function renderDashboard() {
  view.append(stateView({ status: 'loading', title: 'Loading your studio…' }));
  let data;
  try {
    data = (await api.dashboard()).data;
  } catch (error) {
    clear(view);
    view.append(stateView({
      status: 'error',
      title: 'Could not load dashboard',
      message: error.message,
      action: h('button', { class: 'button', type: 'button', onclick: render }, 'Retry'),
    }));
    return;
  }

  const { stats, profile, activity, security } = data;
  clear(view);

  view.append(pageHeader(
    `Welcome back${profile && profile.fullName ? `, ${profile.fullName.split(' ')[0]}` : ''}`,
    'A live view of your portfolio content, pulled directly from the database.',
    h('a', { class: 'button primary', href: '/admin/projects', 'data-link': '' }, icon('plus'), ' New project'),
  ));

  view.append(h('section', { class: 'grid grid-stats', 'aria-label': 'Content statistics' },
    statCard('Projects', stats.projects.total, `${stats.projects.published} published · ${stats.projects.draft} draft`),
    statCard('Published', stats.projects.published + stats.education.published, 'Projects and education'),
    statCard('Skills', stats.skills.total, `${stats.skills.categories} categories`),
    statCard('Messages', stats.messages.unread, `${stats.messages.total} total`),
  ));

  view.append(h('section', { class: 'grid grid-3', style: 'margin-top:24px' },
    h('div', { class: 'card', style: 'grid-column:span 2' },
      h('h2', { class: 'card-title' }, 'Recent activity'),
      activity.length
        ? h('div', { class: 'activity-list' }, activity.map((item) => h('div', { class: 'activity-item' },
            h('span', { class: 'activity-dot' }, (item.admin && (item.admin.name || item.admin.email) || 'S').charAt(0)),
            h('div', {},
              h('p', {}, `${item.action} · ${item.entity}`),
              h('time', {}, `${formatRelative(item.createdAt)} — ${formatDate(item.createdAt)}`),
            ),
          )))
        : stateView({ status: 'empty', title: 'No activity yet', message: 'Edits you make will appear here.' }),
    ),
    h('div', { class: 'card' },
      h('h2', { class: 'card-title' }, 'Quick actions'),
      h('div', { class: 'quick-actions' },
        quickAction('/admin/projects', 'projects', 'New project', 'Add a project to your portfolio'),
        quickAction('/admin/about', 'about', 'Edit about', 'Update your bio and details'),
        quickAction('/admin/messages', 'messages', 'Messages', `${stats.messages.unread} unread`),
        quickAction('/admin/media', 'media', 'Media library', `${stats.media.total} files`),
      ),
    ),
  ));

  view.append(h('section', { class: 'card', style: 'margin-top:24px' },
    h('h2', { class: 'card-title' }, 'Security activity'),
    security.length
      ? h('div', { class: 'activity-list' }, security.map((item) => h('div', { class: 'activity-item' },
          h('span', { class: 'activity-dot' }, '!'),
          h('div', {}, h('p', {}, item.action), h('time', {}, formatRelative(item.createdAt))),
        )))
      : stateView({ status: 'empty', title: 'No security events', message: 'Login and recovery events will appear here.' }),
  ));
}

function statCard(label, value, meta) {
  return h('div', { class: 'card stat-card' },
    h('span', { class: 'stat-label' }, label),
    h('span', { class: 'stat-value' }, String(value ?? 0)),
    h('span', { class: 'stat-meta' }, meta),
  );
}

function quickAction(path, iconName, title, description) {
  return h('a', { class: 'quick-action', href: path, 'data-link': '' },
    icon(iconName),
    h('div', {}, h('strong', {}, title), h('span', {}, description)),
  );
}

/* ------------------------------------------------------------------ */
/* About Me                                                            */
/* ------------------------------------------------------------------ */

async function renderAbout() {
  view.append(stateView({ status: 'loading', title: 'Loading profile…' }));
  let profile = null;
  try {
    const response = await api.list('profile', { page: 1, limit: 1 });
    profile = response.data[0] || null;
  } catch (error) {
    clear(view);
    view.append(stateView({ status: 'error', title: 'Could not load profile', message: error.message }));
    return;
  }

  clear(view);
  view.append(pageHeader('About Me', 'The biography and contact details shown across your public portfolio.'));

  const form = h('form', { class: 'card', novalidate: '' },
    h('div', { class: 'form-grid' },
      field({ label: 'Full name', name: 'fullName', required: true, value: profile?.fullName }),
      field({ label: 'Title', name: 'title', required: true, value: profile?.title }),
      field({ label: 'Location', name: 'location', value: profile?.location }),
      field({ label: 'Email', name: 'email', type: 'email', value: profile?.email }),
      field({ label: 'Phone', name: 'phone', value: profile?.phone }),
      field({ label: 'WhatsApp', name: 'whatsapp', value: profile?.whatsapp }),
      field({ label: 'LinkedIn', name: 'linkedin', type: 'url', value: profile?.linkedin }),
      field({ label: 'GitHub', name: 'github', type: 'url', value: profile?.github }),
      field({ label: 'Bio', name: 'bio', type: 'textarea', full: true, value: profile?.bio }),
    ),
    h('div', { class: 'form-actions' },
      h('button', { class: 'button ghost', type: 'reset' }, 'Reset'),
      h('button', { class: 'button primary', type: 'submit' }, profile ? 'Save changes' : 'Create profile'),
    ),
  );

  view.append(form);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const submit = form.querySelector('button[type="submit"]');
    submit.disabled = true;
    try {
      const body = readForm(form, [
        { name: 'fullName' }, { name: 'title' }, { name: 'location' }, { name: 'email' },
        { name: 'phone' }, { name: 'whatsapp' }, { name: 'linkedin' }, { name: 'github' }, { name: 'bio' },
      ]);
      if (profile) await api.update('profile', profile.id, body);
      else await api.create('profile', body);
      toast('Profile saved.');
      render();
    } catch (error) {
      toast(error.message, 'error');
      submit.disabled = false;
    }
  });
}

/* ------------------------------------------------------------------ */
/* Media library                                                       */
/* ------------------------------------------------------------------ */

async function renderMedia() {
  view.append(pageHeader('Media Library', 'Files referenced by your projects, certifications and profile.'));
  const container = h('div', {});
  view.append(
    h('div', { class: 'toolbar' },
      h('button', { class: 'button primary', type: 'button' }, icon('plus'), ' Add media'),
      h('span', { class: 'spacer' }),
      h('span', { class: 'sub-cell', id: 'media-count' }),
    ),
    container,
  );

  const addButton = view.querySelector('.toolbar button');
  addButton.addEventListener('click', () => openMediaEditor());

  async function load() {
    clear(container);
    container.append(stateView({ status: 'loading', title: 'Loading media…' }));
    try {
      const response = await api.list('media', { page: 1, limit: 60 });
      clear(container);
      document.getElementById('media-count').textContent = `${response.meta.total} file${response.meta.total === 1 ? '' : 's'}`;
      if (!response.data.length) {
        container.append(stateView({ status: 'empty', title: 'No media yet', message: 'Add images to use across your portfolio.' }));
        return;
      }
      container.append(h('div', { class: 'media-grid' }, response.data.map((item) => h('div', { class: 'media-item' },
        h('img', { src: item.url, alt: item.alt || item.filename, loading: 'lazy' }),
        h('div', { class: 'media-meta' }, item.filename),
        h('div', { class: 'media-actions' },
          h('button', {
            class: 'button small danger',
            type: 'button',
            'aria-label': `Delete ${item.filename}`,
            onclick: async () => {
              const ok = await confirmDialog({ title: 'Delete media', message: `Remove “${item.filename}”?`, confirmLabel: 'Delete' });
              if (!ok) return;
              await api.remove('media', item.id);
              toast('Media deleted.');
              load();
            },
          }, 'Delete'),
        ),
      ))));
    } catch (error) {
      clear(container);
      container.append(stateView({ status: 'error', title: 'Could not load media', message: error.message }));
    }
  }

  function openMediaEditor() {
    const urlField = field({ label: 'Image URL', name: 'url', type: 'url', required: true, hint: 'Use an absolute HTTPS URL.' });
    const altField = field({ label: 'Alt text', name: 'alt' });
    const nameField = field({ label: 'Filename', name: 'filename', required: true });
    const typeField = field({ label: 'MIME type', name: 'mimeType', placeholder: 'image/jpeg' });
    const form = h('form', { class: 'form-grid', novalidate: '' }, urlField, altField, nameField, typeField);
    let closeMedia = () => {};
    const { close } = modal({
      title: 'Add media',
      content: form,
      actions: [
        h('button', { class: 'button ghost', type: 'button', onclick: () => closeMedia() }, 'Cancel'),
        h('button', { class: 'button primary', type: 'submit' }, 'Add'),
      ],
    });
    closeMedia = close;
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      try {
        await api.create('media', {
          url: form.elements.url.value.trim(),
          alt: form.elements.alt.value.trim() || undefined,
          filename: form.elements.filename.value.trim(),
          mimeType: form.elements.mimeType.value.trim() || undefined,
        });
        close();
        toast('Media added.');
        load();
      } catch (error) {
        toast(error.message, 'error');
      }
    });
  }

  await load();
}

/* ------------------------------------------------------------------ */
/* Messages                                                            */
/* ------------------------------------------------------------------ */

async function renderMessages() {
  view.append(pageHeader('Messages', 'Enquiries submitted through your public contact page.'));
  const container = h('div', {});
  view.append(
    h('div', { class: 'toolbar' },
      h('select', { 'aria-label': 'Filter messages' },
        h('option', { value: '' }, 'All'),
        h('option', { value: 'NEW' }, 'New'),
        h('option', { value: 'READ' }, 'Read'),
        h('option', { value: 'REPLIED' }, 'Replied'),
        h('option', { value: 'ARCHIVED' }, 'Archived'),
      ),
      h('span', { class: 'spacer' }),
      h('span', { class: 'sub-cell', id: 'message-count' }),
    ),
    container,
  );

  const filter = view.querySelector('.toolbar select');
  filter.addEventListener('change', () => load(filter.value));

  async function load(status = '') {
    clear(container);
    container.append(skeletonRows(3, 3));
    try {
      const params = { page: 1, limit: 30 };
      if (status) params.status = status;
      const response = await api.list('contact-messages', params);
      clear(container);
      document.getElementById('message-count').textContent = `${response.meta.total} message${response.meta.total === 1 ? '' : 's'}`;
      if (!response.data.length) {
        container.append(stateView({ status: 'empty', title: 'No messages', message: 'Contact form submissions will appear here.' }));
        return;
      }
      container.append(dataTable({
        columns: [
          { label: 'Sender', key: 'name' },
          { label: 'Subject', key: 'subject' },
          { label: 'Status', key: 'status' },
          { label: 'Received', key: 'createdAt' },
          { label: '', key: 'actions' },
        ],
        rows: response.data,
        renderRow: (row) => h('tr', { key: row.id },
          h('td', {}, h('div', { class: 'title-cell' }, row.name), h('div', { class: 'sub-cell' }, row.email)),
          h('td', {}, row.subject || '—'),
          h('td', {}, statusPill(row.status)),
          h('td', { class: 'sub-cell' }, formatRelative(row.createdAt)),
          h('td', {}, h('div', { class: 'row-actions' },
            h('button', { class: 'button small ghost', type: 'button', 'aria-label': 'View message', onclick: () => openMessage(row) }, 'View'),
            h('button', {
              class: 'button small ghost',
              type: 'button',
              'aria-label': 'Mark as read',
              onclick: async () => { await api.update('contact-messages', row.id, { status: 'READ' }); toast('Marked as read.'); load(filter.value); },
            }, 'Mark read'),
            h('button', {
              class: 'button small danger',
              type: 'button',
              'aria-label': 'Delete message',
              onclick: async () => {
                const ok = await confirmDialog({ title: 'Delete message', message: 'This cannot be undone.', confirmLabel: 'Delete' });
                if (!ok) return;
                await api.remove('contact-messages', row.id);
                toast('Message deleted.');
                load(filter.value);
              },
            }, 'Delete'),
          )),
        ),
      }));
    } catch (error) {
      clear(container);
      container.append(stateView({ status: 'error', title: 'Could not load messages', message: error.message }));
    }
  }

  function openMessage(row) {
    const dialog = modal({
      title: row.subject || `Message from ${row.name}`,
      content: h('div', {},
        h('p', { class: 'sub-cell' }, `${row.name} · ${row.email}`),
        h('p', { style: 'margin-top:12px;white-space:pre-wrap' }, row.message),
      ),
      actions: [
        h('button', { class: 'button ghost', type: 'button', onclick: async () => {
          await api.update('contact-messages', row.id, { status: 'READ' });
          toast('Marked as read.');
          dialog.close();
          load(filter.value);
        } }, 'Mark as read'),
        h('button', { class: 'button primary', type: 'button', onclick: () => dialog.close() }, 'Close'),
      ],
    });
  }

  await load();
}

/* ------------------------------------------------------------------ */
/* Settings                                                            */
/* ------------------------------------------------------------------ */

async function renderSettings() {
  view.append(pageHeader('Settings', 'Key-value settings used by your public site and Studio.'));
  const container = h('div', {});
  view.append(h('div', { class: 'toolbar' },
    h('button', { class: 'button primary', type: 'button', onclick: () => editSetting() }, icon('plus'), ' New setting'),
  ), container);

  try {
    const response = await api.list('settings', { page: 1, limit: 100 });
    clear(container);
    const entries = response.data;
    if (!entries.length) {
      container.append(stateView({ status: 'empty', title: 'No settings', message: 'Settings you create will appear here.' }));
      return;
    }
    container.append(dataTable({
      columns: [{ label: 'Key', key: 'key' }, { label: 'Value', key: 'value' }, { label: 'Updated', key: 'updatedAt' }, { label: '', key: 'actions' }],
      rows: entries,
      renderRow: (row) => h('tr', { key: row.id },
        h('td', {}, h('div', { class: 'title-cell' }, row.key)),
        h('td', { class: 'sub-cell' }, JSON.stringify(row.value).slice(0, 80)),
        h('td', { class: 'sub-cell' }, formatRelative(row.updatedAt)),
        h('td', {}, h('div', { class: 'row-actions' },
          h('button', { class: 'button small ghost', type: 'button', onclick: () => editSetting(row) }, 'Edit'),
        )),
      ),
    }));
  } catch (error) {
    clear(container);
    container.append(stateView({ status: 'error', title: 'Could not load settings', message: error.message }));
  }

  function editSetting(row = null) {
    const keyField = field({ label: 'Key', name: 'key', required: true, value: row?.key });
    const valueField = field({ label: 'Value (JSON)', name: 'value', type: 'textarea', required: true, value: row ? JSON.stringify(row.value, null, 2) : '' });
    const form = h('form', { novalidate: '' }, keyField, valueField);
    let closeSetting = () => {};
    const { close } = modal({
      title: row ? 'Edit setting' : 'New setting',
      content: form,
      actions: [
        h('button', { class: 'button ghost', type: 'button', onclick: () => closeSetting() }, 'Cancel'),
        h('button', { class: 'button primary', type: 'submit' }, 'Save'),
      ],
    });
    closeSetting = close;
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      try {
        const key = form.elements.key.value.trim();
        const value = JSON.parse(form.elements.value.value);
        await api.create('settings', { key, value });
        close();
        toast('Setting saved.');
        await render();
      } catch (error) {
        toast(error.message, 'error');
      }
    });
  }
}

/* ------------------------------------------------------------------ */
/* Security                                                            */
/* ------------------------------------------------------------------ */

async function renderSecurity() {
  view.append(pageHeader('Security', 'Your verified session, multi-factor status and recent account events.'));
  const container = h('div', {});
  view.append(container);

  try {
    const [me, notifications] = await Promise.all([
      api.me().catch(() => null),
      api.notifications().then((response) => response.data).catch(() => ({ security: [] })),
    ]);
    clear(container);
    const admin = me && me.admin ? me.admin : session;
    container.append(h('div', { class: 'card' },
      h('h2', { class: 'card-title' }, 'Account'),
      h('div', { class: 'security-row' },
        h('span', { class: 'status-dot', 'aria-hidden': 'true' }),
        h('div', { class: 'security-copy' },
          h('h3', {}, admin ? (admin.email || 'Administrator') : 'Administrator'),
          h('p', {}, 'Verified owner session with multi-factor authentication.'),
        ),
      ),
      h('div', { class: 'security-row' },
        h('span', { class: 'status-dot', 'aria-hidden': 'true' }),
        h('div', { class: 'security-copy' },
          h('h3', {}, 'Multi-factor authentication'),
          h('p', {}, 'Required at sign-in. TOTP secrets are encrypted at rest.'),
        ),
      ),
      h('div', { class: 'security-row' },
        h('span', { class: 'status-dot warn', 'aria-hidden': 'true' }),
        h('div', { class: 'security-copy' },
          h('h3', {}, 'Session'),
          h('p', {}, 'Sessions are stored server-side and revoked on sign-out or password reset.'),
        ),
      ),
    ));

    container.append(h('div', { class: 'card' },
      h('h2', { class: 'card-title' }, 'Recent security events'),
      notifications.security && notifications.security.length
        ? h('div', { class: 'activity-list' }, notifications.security.map((item) => h('div', { class: 'activity-item' },
            h('span', { class: 'activity-dot' }, '!'),
            h('div', {}, h('p', {}, item.action), h('time', {}, formatRelative(item.createdAt))),
          )))
        : stateView({ status: 'empty', title: 'No security events', message: 'Sign-in and recovery events will appear here.' }),
    ));
  } catch (error) {
    clear(container);
    container.append(stateView({ status: 'error', title: 'Could not load security', message: error.message }));
  }
}

/* ------------------------------------------------------------------ */
/* Search                                                              */
/* ------------------------------------------------------------------ */

async function renderSearch() {
  const params = new URLSearchParams(window.location.search);
  const q = params.get('q') || '';
  view.append(pageHeader('Search', q ? `Results for “${q}”.` : 'Search across your content.'));
  const container = h('div', {});
  view.append(container);

  if (!q) {
    clear(container);
    container.append(stateView({ status: 'empty', title: 'Enter a search term', message: 'Search projects, education, experience, certifications, skills and messages.' }));
    return;
  }

  clear(container);
  container.append(stateView({ status: 'loading', title: 'Searching…' }));
  try {
    const data = (await api.search(q)).data;
    clear(container);
    if (!data.total) {
      container.append(stateView({ status: 'empty', title: 'No matches', message: `Nothing matched “${q}”.` }));
      return;
    }
    const groups = [
      ['Projects', data.projects, (row) => `${row.name} · ${row.status}`],
      ['Education', data.education, (row) => `${row.institution} · ${row.degree}`],
      ['Experience', data.experience, (row) => `${row.company} · ${row.role}`],
      ['Leadership', data.leadership, (row) => `${row.organization} · ${row.position}`],
      ['Certifications', data.certifications, (row) => `${row.title} · ${row.issuer}`],
      ['Skills', data.skills, (row) => `${row.name} · ${row.category}`],
      ['Messages', data.messages, (row) => `${row.name} · ${row.subject || 'Message'}`],
    ];
    for (const [label, rows, describe] of groups) {
      if (!rows.length) continue;
      container.append(h('section', { class: 'card', style: 'margin-bottom:16px' },
        h('h2', { class: 'card-title' }, `${label} (${rows.length})`),
        h('ul', {}, rows.map((row) => h('li', { style: 'padding:6px 0' }, describe(row)))),
      ));
    }
  } catch (error) {
    clear(container);
    container.append(stateView({ status: 'error', title: 'Search failed', message: error.message }));
  }
}

/* ------------------------------------------------------------------ */
/* Login                                                               */
/* ------------------------------------------------------------------ */

async function renderLogin() {
  const card = h('div', { class: 'login' });
  clear(view);
  view.append(card);

  const emailField = field({ label: 'Email', name: 'email', type: 'email', required: true, value: '' });
  const passwordField = field({ label: 'Password', name: 'password', type: 'password', required: true, value: '' });
  const tokenField = field({ label: 'Authentication code', name: 'token', required: true, value: '', hint: 'Enter the 6-digit code, or a backup code.' });
  const form = h('form', { id: 'login-form', novalidate: '' }, emailField, passwordField, tokenField);
  const submit = h('button', {
    class: 'button primary',
    type: 'submit',
    form: 'login-form',
    style: 'width:100%;margin-top:8px',
  }, 'Continue');
  const message = h('p', { class: 'mfa-note', role: 'alert' });
  const shell = h('div', { class: 'login-card card' },
    h('div', { class: 'brand' }, h('span', { class: 'brand-mark', 'aria-hidden': 'true' }, 'P'), h('strong', {}, 'Portfolio Studio')),
    h('h1', {}, 'Sign in'),
    h('p', { class: 'lede' }, 'Manage your portfolio with a verified owner session.'),
    form, message, submit,
  );
  card.append(shell);

  let pendingCsrf = null;

  function showStep(step) {
    const isFactor = step === 'factor';
    emailField.style.display = isFactor ? 'none' : '';
    passwordField.style.display = isFactor ? 'none' : '';
    tokenField.style.display = isFactor ? '' : 'none';
    submit.disabled = false;
    submit.textContent = isFactor ? 'Verify and sign in' : 'Continue';
    message.textContent = '';
  }

  showStep('password');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    submit.disabled = true;
    message.textContent = '';
    try {
      if (pendingCsrf) {
        const token = form.elements.token.value.trim();
        const isBackup = token.length === 32 && /^[0-9a-f]+$/i.test(token);
        const body = isBackup ? { code: token.toLowerCase() } : { token };
        const path = isBackup ? '/api/admin/auth/login/backup-code' : '/api/admin/auth/login/mfa';
        const result = await request(path, {
          method: 'POST',
          body,
          headers: { 'X-CSRF-Token': pendingCsrf },
        });
        window.history.replaceState({}, '', '/admin');
        await bootstrap(result.csrfToken);
        return;
      }
      const email = form.elements.email.value.trim();
      const password = form.elements.password.value;
      const result = await request('/api/admin/auth/login', {
        method: 'POST',
        body: { email, password },
        headers: { 'X-CSRF-Token': getCsrfToken() || '' },
      });
      pendingCsrf = result.csrfToken;
      showStep('factor');
      toast('Password verified. Enter your second factor.');
    } catch (error) {
      message.textContent = error.message;
      submit.disabled = false;
    }
  });
}

/* ------------------------------------------------------------------ */
/* Bootstrap                                                           */
/* ------------------------------------------------------------------ */

async function bootstrap(csrf) {
  if (csrf) await refreshCsrfToken();
  try {
    const me = await api.me();
    applySession(me);
  } catch (error) {
    if (error.status === 401 || error.status === 403) {
      await renderLogin();
      return;
    }
    clear(view);
    view.append(stateView({ status: 'error', title: 'Could not reach the studio', message: error.message }));
    return;
  }
  buildSidebar();
  await render();
  try {
    const notifications = (await api.notifications()).data;
    applySession({ ...session, unreadMessages: notifications.unread });
    buildSidebar();
    updateNotificationBadge(notifications.unread);
  } catch {
    /* notifications are non-critical */
  }
}

async function start() {
  initTheme();
  initSidebar();
  initSearch();
  initPopovers();
  initRouter();
  try {
    await refreshCsrfToken();
  } catch {
    /* login screen will surface any session problem */
  }
  await bootstrap();
}

start();
