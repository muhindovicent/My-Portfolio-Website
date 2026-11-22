/**
 * Import the portfolio content that predates the CMS.
 *
 * The import is conservative and idempotent:
 * - dry-run is the default and performs no writes;
 * - `--apply` creates missing records only;
 * - existing records are never updated, so administrator edits are preserved.
 *
 * Usage:
 *   npm run import:content          # dry-run
 *   npm run import:content:apply    # create missing records
 */

import { db } from '../src/config/db';
import type { Prisma } from '@prisma/client';

const apply = process.argv.includes('--apply') && !process.argv.includes('--dry-run');
const mode = apply ? 'apply' : 'dry-run';
let created = 0;
let planned = 0;
let skipped = 0;

async function needsCreate(label: string, exists: () => Promise<unknown>): Promise<boolean> {
  if (await exists()) {
    skipped++;
    console.log(`[${mode}] skip ${label} (already exists)`);
    return false;
  }
  if (!apply) {
    planned++;
    console.log(`[dry-run] create ${label}`);
    return false;
  }
  created++;
  console.log(`[apply] create ${label}`);
  return true;
}

async function ensureMedia(id: string, filename: string, alt: string): Promise<string | null> {
  const url = `/images/${filename}`;
  const existing = await db.mediaAsset.findFirst({ where: { url }, select: { id: true } });
  if (existing) {
    skipped++;
    console.log(`[${mode}] skip media ${url} (already exists)`);
    return existing.id;
  }
  if (!apply) {
    planned++;
    console.log(`[dry-run] create media ${url}`);
    return null;
  }
  const media = await db.mediaAsset.create({
    data: { id, filename, originalName: filename, mimeType: 'image/jpeg', url, alt },
    select: { id: true },
  });
  created++;
  console.log(`[apply] create media ${url}`);
  return media.id;
}

const profile = {
  id: 'profile-default',
  fullName: 'Muhindo Vicent',
  title: 'Software Engineer & Full-Stack Web Developer',
  bio:
    "I'm Muhindo Vicent, a software engineer and web developer interested in practical problems and the people who experience them. My work explores public information, healthcare communication, and digital experiences for businesses.",
  location: 'Uganda',
  email: 'muhindovicent27@gmail.com',
  phone: '+256 791 604927',
  whatsapp: 'https://wa.me/256791604927',
  linkedin: 'https://www.linkedin.com/in/muhindo-vicent-a53542382/',
  github: 'https://github.com/muhindovicent',
  isActive: true,
};

const settings: Array<{ key: string; value: Prisma.InputJsonValue }> = [
  {
    key: 'nav',
    value: [
      { label: 'Work', url: '/work/' },
      { label: 'Experience', url: '/experience/' },
      { label: 'About', url: '/about/' },
      { label: 'Contact', url: '/contact/' },
    ],
  },
  {
    key: 'hero',
    value: {
      intro: 'Hello, I’m Vicent.',
      title: 'SOFTWARE & Full-Stack DEVELOPER',
      description: 'Thoughtful interfaces.<br>Connected systems.<br>Built with purpose.',
      ctaLabel: 'Explore my work',
      ctaUrl: '/work/',
      location: 'Uganda',
      locationSub: 'Based in East Africa',
    },
  },
  {
    key: 'about',
    value: {
      eyebrow: 'MUHINDO VICENT · UGANDA',
      title: 'Curiosity into working software.',
      lead:
        "I'm a Software Engineer & Full-Stack Web Developer specializing in software engineering, UI/UX design, and systems development.",
    },
  },
  {
    key: 'contact',
    value: {
      email: 'muhindovicent27@gmail.com',
      phone: '+256 791 604927',
      whatsapp: 'https://wa.me/256791604927',
      linkedin: 'https://www.linkedin.com/in/muhindo-vicent-a53542382/',
      github: 'https://github.com/muhindovicent',
    },
  },
  {
    key: 'footer',
    value: {
      brand: 'Muhindo Vicent',
      location: 'Muhindo Vicent · Uganda',
    },
  },
];

const projects = [
  {
    slug: 'mafuta-watch',
    name: 'MafutaWatch',
    label: 'Fuel price transparency',
    summary: 'A Uganda-focused web platform for exploring fuel stations and fuel price information.',
    detail:
      'The product brings station discovery and public price information into one interface. The staging site is available to explore.',
    repoUrl: 'https://github.com/muhindovicent/Fuel-Monitoring-System-Uganda',
    demoUrl: 'https://mafuta-watch-staging.vercel.app/',
    featured: true,
    sortOrder: 1,
  },
  {
    slug: 'tunza',
    name: 'Tunza',
    label: 'Maternal health · SMS',
    summary: 'An SMS companion designed to send pregnancy guidance and appointment reminders.',
    detail:
      'The project focuses on reaching people through SMS. Pregnancy guidance and appointment reminders are the initial workflows, with pilot work planned.',
    repoUrl: 'https://github.com/muhindovicent/TUNZA-SMS-COMPANION-PROJECT',
    demoUrl: null,
    featured: true,
    sortOrder: 2,
  },
  {
    slug: 'mckanim',
    name: 'McKanim Restaurant',
    label: 'Restaurant · Web experience',
    summary: 'A responsive restaurant website for browsing the menu and exploring the venue.',
    detail:
      'The website brings the menu, gallery, and reservation entry point together. Its design focuses on making the restaurant easy to explore on a phone.',
    repoUrl: 'https://github.com/muhindovicent/McKanim-restaurant-website',
    demoUrl: null,
    featured: true,
    sortOrder: 3,
  },
];

const certifications = [
  {
    id: 'cert-1',
    title: 'Third place — Launch Hackathon',
    issuer: 'IEEE Cavendish University Student Branch & CUUCSA',
    date: new Date('2026-11-04'),
    description:
      'As a member of Team Kodepalz, I earned third place at the launch hackathon at Cavendish University Uganda, Siyani Campus. The award recognizes creative problem-solving, technical skill, and teamwork.',
    imageFile: '03-313680.jpg',
    sortOrder: 1,
  },
  {
    id: 'cert-2',
    title: 'Volunteer — Branch launch',
    issuer: 'IEEE Cavendish University Student Branch & CUUCSA',
    date: new Date('2026-11-04'),
    description:
      'I volunteered at the official branch and association launch at Siyani Campus and received a certificate of appreciation for my time, energy, and dedication.',
    imageFile: '06-313681.jpg',
    sortOrder: 2,
  },
  {
    id: 'cert-3',
    title: 'Cancer education & awareness',
    issuer: 'Children Caring About Cancer (3C)',
    date: new Date('2023-01-01'),
    description:
      'I received a certificate of appreciation for contributing to cancer education and awareness. The certificate also carries Uganda Cancer Institute and UCCF recognition.',
    imageFile: '04-313683.jpg',
    sortOrder: 3,
  },
  {
    id: 'cert-4',
    title: 'Leadership & entrepreneurship — Gold certificate',
    issuer: 'Educate! · Nyakasura School',
    date: new Date('2022-10-29'),
    description:
      'I completed an eight-month leadership and entrepreneurship course. It covered personal and cooperative leadership, business and financial literacy, business model development, and community development. As part of the Nyakasura School scholar team, I helped identify a community need and develop a solution.',
    imageFile: '05-313682.jpg',
    sortOrder: 4,
  },
];

const skills: Record<string, string[]> = {
  Frontend: ['HTML, CSS & JavaScript', 'TypeScript', 'React.js & Next.js', 'Tailwind CSS'],
  Backend: ['Python & Java', 'Node.js', 'Express.js & NestJS', 'REST APIs'],
  Databases: ['PostgreSQL & SQL', 'Prisma ORM', 'Database modelling', 'Relational database design'],
  Networking: ['Cisco Packet Tracer', 'VLANs & inter-VLAN routing', 'Routing & switching', 'Network troubleshooting'],
  Engineering: ['System architecture', 'SDLC & requirements engineering', 'UML & ERD modelling', 'Agile & Scrum'],
  'Tools & deployment': ['Git & GitHub', 'Vercel, Render & Neon', 'Figma', 'Visual Studio Code'],
};

async function main() {
  console.log(`[import] mode: ${mode}${apply ? '' : ' (no writes; pass --apply to import)'}`);

  if (
    await needsCreate('profile profile-default', async () => db.personalProfile.findFirst({ select: { id: true } }))
  ) {
    await db.personalProfile.create({ data: profile });
  }

  for (const setting of settings) {
    if (await needsCreate(`setting ${setting.key}`, async () => db.websiteSetting.findUnique({ where: { key: setting.key } }))) {
      await db.websiteSetting.create({ data: setting });
    }
  }

  for (const project of projects) {
    if (await needsCreate(`project ${project.slug}`, async () => db.project.findUnique({ where: { slug: project.slug } }))) {
      await db.project.create({ data: { ...project, status: 'PUBLISHED' } });
    }
  }

  for (const certification of certifications) {
    const imageId = await ensureMedia(
      `media-${certification.id}`,
      certification.imageFile,
      `${certification.title} certificate awarded to Muhindo Vicent`,
    );
    const { imageFile: _imageFile, ...data } = certification;
    void _imageFile;
    if (await needsCreate(`certification ${certification.id}`, async () => db.certification.findUnique({ where: { id: certification.id } }))) {
      await db.certification.create({
        data: {
          ...data,
          imageId: imageId ?? undefined,
          status: 'PUBLISHED',
        },
      });
    }
  }

  for (const [category, items] of Object.entries(skills)) {
    for (const [index, name] of items.entries()) {
      const id = `skill-${category}-${index}`;
      if (await needsCreate(`skill ${category} / ${name}`, async () => db.skill.findUnique({ where: { id } }))) {
        await db.skill.create({ data: { id, category, name, sortOrder: index } });
      }
    }
  }

  if (
    await needsCreate('education Cavendish University Uganda', async () =>
      db.education.findFirst({
        where: { institution: 'Cavendish University Uganda', degree: 'Bachelor of Software Engineering' },
        select: { id: true },
      }))
  ) {
    await db.education.create({
      data: {
        id: 'education-cavendish',
        institution: 'Cavendish University Uganda',
        degree: 'Bachelor of Software Engineering',
        fieldOfStudy: 'Software Engineering',
        status: 'PUBLISHED',
        sortOrder: 1,
      },
    });
  }

  if (
    await needsCreate('draft experience Team Kodepalz', async () =>
      db.professionalExperience.findFirst({
        where: { company: 'Team Kodepalz', role: 'Software Engineer' },
        select: { id: true },
      }))
  ) {
    await db.professionalExperience.create({
      data: {
        id: 'experience-team-kodepalz',
        company: 'Team Kodepalz',
        role: 'Software Engineer',
        location: 'Uganda',
        description:
          'Third place at the November 2026 IEEE Cavendish University Student Branch and CUUCSA launch hackathon.',
        status: 'DRAFT',
        sortOrder: 1,
      },
    });
  }

  if (
    await needsCreate('draft leadership IEEE Cavendish University', async () =>
      db.leadershipPosition.findFirst({
        where: { organization: 'IEEE Cavendish University Student Branch & CUUCSA' },
        select: { id: true },
      }))
  ) {
    await db.leadershipPosition.create({
      data: {
        id: 'leadership-ieee-cavendish',
        organization: 'IEEE Cavendish University Student Branch & CUUCSA',
        position: 'Member — Team Kodepalz',
        description:
          'Earned third place at the launch hackathon; volunteered at the official branch and association launch.',
        status: 'DRAFT',
        sortOrder: 1,
      },
    });
  }

  const summary = apply
    ? `${created} created, ${skipped} existing; no existing records were modified.`
    : `${planned} would be created, ${skipped} existing; no writes performed.`;
  console.log(`[import] ${mode} complete: ${summary}`);
}

main()
  .catch((error) => {
    console.error('[import] Fatal error:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
