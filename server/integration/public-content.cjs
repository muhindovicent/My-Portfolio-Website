// Public portfolio API and content-import integration tests.
// Verifies publication visibility, live updates, direct project URLs and the
// create-only importer against a disposable local PostgreSQL database.
const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const { randomBytes } = require('node:crypto');
const request = require('supertest');

const url = new URL(process.env.DATABASE_URL);
if (url.hostname !== '127.0.0.1' || url.pathname !== '/studio_test') {
  throw Error('Use disposable local studio_test database');
}
Object.assign(process.env, {
  NODE_ENV: 'test',
  SESSION_SECRET: randomBytes(32).toString('hex'),
  ENCRYPTION_KEY: randomBytes(32).toString('hex'),
});

const app = require('../dist/src/app').default;
const { db } = require('../dist/src/config/db');

const publishedSlug = 'public-test-published';
const draftSlug = 'public-test-draft';
const archivedSlug = 'public-test-archived';
const importScript = path.resolve(__dirname, '..', 'dist', 'scripts', 'import-content.js');

async function cleanFixtures() {
  await db.contactMessage.deleteMany({ where: { email: { startsWith: 'public-test-' } } });
  await db.certification.deleteMany({
    where: { OR: [{ title: { startsWith: 'Public Test' } }, { id: { in: ['cert-1', 'cert-2', 'cert-3', 'cert-4'] } }] },
  });
  await db.project.deleteMany({
    where: { OR: [{ slug: { startsWith: 'public-test-' } }, { slug: { in: ['mafuta-watch', 'tunza', 'mckanim'] } }] },
  });
  await db.personalProfile.deleteMany();
  await db.mediaAsset.deleteMany({
    where: { OR: [{ id: { startsWith: 'public-test-' } }, { id: { startsWith: 'media-cert-' } }] },
  });
  await db.websiteSetting.deleteMany({
    where: { key: { in: ['nav', 'hero', 'about', 'contact', 'footer'] } },
  });
  await db.skill.deleteMany({ where: { OR: [{ category: 'Public Test' }, { id: { startsWith: 'skill-' } }] } });
  await db.education.deleteMany({
    where: { OR: [{ institution: { startsWith: 'Public Test' } }, { id: 'education-cavendish' }] },
  });
  await db.professionalExperience.deleteMany({
    where: { OR: [{ company: { startsWith: 'Public Test' } }, { id: 'experience-team-kodepalz' }] },
  });
  await db.leadershipPosition.deleteMany({ where: { id: 'leadership-ieee-cavendish' } });
}

function runImporter(args = []) {
  return execFileSync(process.execPath, [importScript, ...args], {
    cwd: path.resolve(__dirname, '..'),
    env: { ...process.env, NODE_ENV: 'test' },
    encoding: 'utf8',
  });
}

before(async () => {
  await cleanFixtures();
  const media = await db.mediaAsset.create({
    data: { id: 'public-test-media', filename: 'public-test.jpg', url: 'https://example.test/public-test.jpg', alt: 'Public test image' },
  });
  await db.project.createMany({
    data: [
      {
        slug: publishedSlug,
        name: 'Public Test Project',
        label: 'Published project',
        summary: 'Visible summary',
        detail: 'Visible detail',
        repoUrl: 'https://example.test/repo',
        demoUrl: 'https://example.test/demo',
        status: 'PUBLISHED',
        mediaAssetId: media.id,
        sortOrder: 1,
      },
      { slug: draftSlug, name: 'Public Test Draft', status: 'DRAFT', sortOrder: 2 },
      { slug: archivedSlug, name: 'Public Test Archived', status: 'ARCHIVED', sortOrder: 3 },
    ],
  });
  await db.personalProfile.createMany({
    data: [
      { fullName: 'Public Test Inactive', title: 'Inactive', isActive: false },
      { fullName: 'Public Test Active', title: 'Active profile', bio: 'Active bio', isActive: true },
    ],
  });
  await db.education.createMany({
    data: [
      { institution: 'Public Test University', degree: 'Published degree', status: 'PUBLISHED', sortOrder: 1 },
      { institution: 'Public Test Draft University', degree: 'Draft degree', status: 'DRAFT', sortOrder: 2 },
      { institution: 'Public Test Archived University', degree: 'Archived degree', status: 'ARCHIVED', sortOrder: 3 },
    ],
  });
  await db.professionalExperience.createMany({
    data: [
      { company: 'Public Test Company', role: 'Published role', status: 'PUBLISHED', sortOrder: 1 },
      { company: 'Public Test Draft Company', role: 'Draft role', status: 'DRAFT', sortOrder: 2 },
      { company: 'Public Test Archived Company', role: 'Archived role', status: 'ARCHIVED', sortOrder: 3 },
    ],
  });
  await db.certification.createMany({
    data: [
      { title: 'Public Test Certificate', issuer: 'Public Test Issuer', status: 'PUBLISHED', imageId: media.id, sortOrder: 1 },
      { title: 'Public Test Draft Certificate', issuer: 'Public Test Issuer', status: 'DRAFT', sortOrder: 2 },
      { title: 'Public Test Archived Certificate', issuer: 'Public Test Issuer', status: 'ARCHIVED', sortOrder: 3 },
    ],
  });
  await db.skill.createMany({
    data: [
      { category: 'Public Test', name: 'Public Test Skill', sortOrder: 1 },
      { category: 'Public Test', name: 'Public Test Skill Two', sortOrder: 2 },
    ],
  });
});

after(async () => {
  await cleanFixtures();
  await db.$disconnect();
});

describe('Published public content API', () => {
  test('lists only published projects and exposes public fields', async () => {
    const response = await request(app).get('/api/public/projects').expect(200);
    const slugs = response.body.data.map((project) => project.slug);
    assert.ok(slugs.includes(publishedSlug));
    assert.equal(slugs.includes(draftSlug), false);
    assert.equal(slugs.includes(archivedSlug), false);
    const published = response.body.data.find((project) => project.slug === publishedSlug);
    assert.equal(published.name, 'Public Test Project');
    assert.equal(published.mediaAsset.alt, 'Public test image');
    assert.equal('status' in published, false);
    assert.equal('updatedBy' in published, false);
  });

  test('project detail returns published content and 404 for draft or archived', async () => {
    const published = await request(app).get(`/api/public/projects/${publishedSlug}`).expect(200);
    assert.equal(published.body.data.detail, 'Visible detail');
    await request(app).get(`/api/public/projects/${draftSlug}`).expect(404);
    await request(app).get(`/api/public/projects/${archivedSlug}`).expect(404);
  });

  test('filters collections and selects the active profile', async () => {
    const [profile, education, experience, certifications, skills] = await Promise.all([
      request(app).get('/api/public/profile').expect(200),
      request(app).get('/api/public/education').expect(200),
      request(app).get('/api/public/experience').expect(200),
      request(app).get('/api/public/certifications').expect(200),
      request(app).get('/api/public/skills').expect(200),
    ]);
    assert.equal(profile.body.data.fullName, 'Public Test Active');
    const institutions = education.body.data.map((item) => item.institution);
    const companies = experience.body.data.map((item) => item.company);
    const certificateTitles = certifications.body.data.map((item) => item.title);
    const skillNames = skills.body.data.map((item) => item.name);
    assert.ok(institutions.includes('Public Test University'));
    assert.equal(institutions.includes('Public Test Draft University'), false);
    assert.equal(institutions.includes('Public Test Archived University'), false);
    assert.ok(companies.includes('Public Test Company'));
    assert.equal(companies.includes('Public Test Draft Company'), false);
    assert.equal(companies.includes('Public Test Archived Company'), false);
    assert.ok(certificateTitles.includes('Public Test Certificate'));
    assert.equal(certificateTitles.includes('Public Test Draft Certificate'), false);
    assert.equal(certificateTitles.includes('Public Test Archived Certificate'), false);
    assert.ok(skillNames.includes('Public Test Skill'));
    assert.ok(skillNames.includes('Public Test Skill Two'));
  });

  test('reflects content updates immediately', async () => {
    await db.project.update({ where: { slug: publishedSlug }, data: { name: 'Updated Public Project' } });
    await db.personalProfile.updateMany({ where: { isActive: true }, data: { fullName: 'Updated Active Profile' } });
    const project = await request(app).get(`/api/public/projects/${publishedSlug}`).expect(200);
    const profile = await request(app).get('/api/public/profile').expect(200);
    assert.equal(project.body.data.name, 'Updated Public Project');
    assert.equal(profile.body.data.fullName, 'Updated Active Profile');
  });

  test('serves the public listing and direct project shells in test/dev', async () => {
    const listing = await request(app).get('/work/').expect(200);
    assert.match(listing.text, /data-public-projects/);
    assert.match(listing.text, /public-content\.js/);
    const detail = await request(app).get(`/work/${publishedSlug}/`).expect(200);
    assert.match(detail.text, /data-project-detail/);
    assert.match(detail.text, /data-project-status/);
  });
});

describe('Create-only content importer', () => {
  test('dry-runs, imports once, stays idempotent and preserves administrator edits', async () => {
    await cleanFixtures();
    try {
      const dryRun = runImporter();
      assert.match(dryRun, /dry-run complete/);
      assert.equal(await db.project.findUnique({ where: { slug: 'mafuta-watch' } }), null);
      assert.equal(await db.personalProfile.count({ where: { id: 'profile-default' } }), 0);

      const applied = runImporter(['--apply']);
      assert.match(applied, /apply complete/);
      const project = await db.project.findUniqueOrThrow({ where: { slug: 'mafuta-watch' } });
      assert.equal(project.name, 'MafutaWatch');
      assert.equal(project.status, 'PUBLISHED');
      const profile = await db.personalProfile.findFirstOrThrow({ where: { id: 'profile-default' } });
      assert.equal(profile.fullName, 'Muhindo Vicent');
      assert.equal(await db.project.count({ where: { slug: { in: ['mafuta-watch', 'tunza', 'mckanim'] } } }), 3);
      assert.equal(await db.certification.count({ where: { id: { startsWith: 'cert-' } } }), 4);
      assert.equal(await db.skill.count({ where: { id: { startsWith: 'skill-' } } }), 24);
      assert.ok(await db.certification.findUniqueOrThrow({ where: { id: 'cert-1' } }).then((item) => item.imageId));

      const secondRun = runImporter(['--apply']);
      assert.match(secondRun, /apply complete: 0 created/);
      assert.equal(await db.project.count({ where: { slug: { in: ['mafuta-watch', 'tunza', 'mckanim'] } } }), 3);

      await db.project.update({ where: { slug: 'mafuta-watch' }, data: { name: 'Admin Edited Project', status: 'DRAFT' } });
      await db.personalProfile.updateMany({ where: { id: 'profile-default' }, data: { fullName: 'Admin Edited Name' } });
      const thirdRun = runImporter(['--apply']);
      assert.match(thirdRun, /apply complete: 0 created/);
      const preservedProject = await db.project.findUniqueOrThrow({ where: { slug: 'mafuta-watch' } });
      const preservedProfile = await db.personalProfile.findUniqueOrThrow({ where: { id: 'profile-default' } });
      assert.equal(preservedProject.name, 'Admin Edited Project');
      assert.equal(preservedProject.status, 'DRAFT');
      assert.equal(preservedProfile.fullName, 'Admin Edited Name');
    } finally {
      await cleanFixtures();
    }
  });
});
