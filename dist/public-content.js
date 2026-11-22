(() => {
  const list = document.querySelector('[data-public-projects]');
  const detail = document.querySelector('[data-project-detail]');
  if (!list && !detail) return;

  function setStatus(root, message) {
    const status = root.querySelector('[data-public-status], [data-project-status]');
    if (!status) return;
    status.textContent = message;
    status.hidden = !message;
  }

  async function getJSON(path) {
    const response = await fetch(path, {
      headers: { Accept: 'application/json' },
      credentials: 'same-origin',
    });
    if (!response.ok) {
      const error = new Error(`Request failed with ${response.status}`);
      error.status = response.status;
      throw error;
    }
    const payload = await response.json();
    if (!payload || payload.ok !== true || !('data' in payload)) {
      throw new Error('Unexpected response');
    }
    return payload.data;
  }

  function setText(root, selector, value) {
    const element = root.querySelector(selector);
    if (element) element.textContent = value || '';
  }

  function renderLinks(container, project) {
    if (!container) return;
    container.replaceChildren();
    if (project.demoUrl) {
      const demo = document.createElement('a');
      demo.className = 'pill';
      demo.href = project.demoUrl;
      demo.target = '_blank';
      demo.rel = 'noopener';
      demo.textContent = 'Live staging ↗';
      container.append(demo);
    }
    if (project.repoUrl) {
      const repo = document.createElement('a');
      repo.className = 'text-link';
      repo.href = project.repoUrl;
      repo.target = '_blank';
      repo.rel = 'noopener';
      repo.textContent = 'View source ↗';
      container.append(repo);
    }
  }

  function renderProjectRows(projects) {
    list.replaceChildren();
    if (projects.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'lead';
      empty.textContent = 'No published projects yet.';
      list.append(empty);
      return;
    }
    for (const project of projects) {
      const row = document.createElement('a');
      row.className = 'row';
      row.href = `/work/${encodeURIComponent(project.slug)}/`;
      row.dataset.projectSlug = project.slug;
      const name = document.createElement('span');
      name.textContent = project.name;
      const label = document.createElement('small');
      label.textContent = project.label || 'Project';
      const arrow = document.createElement('span');
      arrow.className = 'arrow';
      arrow.setAttribute('aria-hidden', 'true');
      arrow.textContent = '↗';
      row.append(name, label, arrow);
      list.append(row);
    }
  }

  function renderProject(project) {
    detail.removeAttribute('aria-busy');
    setText(detail, '[data-project-label]', project.label || 'Work');
    setText(detail, '[data-project-name]', project.name);
    setText(detail, '[data-project-summary]', project.summary);
    setText(detail, '[data-project-detail]', project.detail);
    renderLinks(detail.querySelector('[data-project-links]'), project);
    setStatus(detail, '');
    document.title = `${project.name} · Muhindo Vicent`;
  }

  function showUnavailable(message) {
    detail.removeAttribute('aria-busy');
    setText(detail, '[data-project-label]', 'Work');
    setText(detail, '[data-project-name]', 'Project unavailable');
    setText(detail, '[data-project-summary]', '');
    setText(detail, '[data-project-detail]', '');
    renderLinks(detail.querySelector('[data-project-links]'), {});
    setStatus(detail, message);
  }

  if (list) {
    list.setAttribute('aria-busy', 'true');
    getJSON('/api/public/projects')
      .then((projects) => {
        list.removeAttribute('aria-busy');
        renderProjectRows(projects);
        setStatus(list.parentElement, '');
      })
      .catch(() => {
        list.removeAttribute('aria-busy');
        setStatus(list.parentElement, 'Showing the built-in project list. Live content is temporarily unavailable.');
      });
  }

  if (detail) {
    const parts = window.location.pathname.split('/').filter(Boolean);
    const slug = parts[0] === 'work' ? decodeURIComponent(parts[1] || '') : '';
    if (!slug || slug === '_project') {
      showUnavailable('This project is not available.');
      return;
    }
    getJSON(`/api/public/projects/${encodeURIComponent(slug)}`)
      .then(renderProject)
      .catch((error) => {
        showUnavailable(
          error.status === 404
            ? 'This project is not available.'
            : 'We couldn’t load this project right now. Please try again.'
        );
      });
  }
})();
