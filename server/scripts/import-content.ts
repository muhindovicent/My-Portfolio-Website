/**
 * Content import script — Phase 2
 *
 * Seeds the Neon/PostgreSQL database with the portfolio content that is
 * currently hardcoded in `build.py`. The script is idempotent: it uses
 * upserts keyed on slug / email / key so it can be re-run safely.
 *
 * Usage:
 *   cp .env.example .env   # populate DATABASE_URL + ADMIN_*
 *   npm run prisma:generate
 *   npm run prisma:migrate
 *   npm run prisma:seed
 */

import { db } from '../src/config/db';
import type { Prisma } from '@prisma/client';
import { hashPassword } from '../src/lib/password';

async function main() {
  console.log('[import] Starting content migration from build.py snapshot...');

  // -------------------------------------------------------------------------
  // 1. Default administrator (one-time). Credentials come from env.
  // -------------------------------------------------------------------------
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminEmail || !adminPassword) {
    throw new Error('[import] ADMIN_EMAIL and ADMIN_PASSWORD must be set in .env');
  }

  let admin = await db.administrator.findUnique({ where: { email: adminEmail } });
  if (!admin) {
    const passwordHash = await hashPassword(adminPassword);
    admin = await db.administrator.create({
      data: {
        email: adminEmail,
        passwordHash,
        name: 'Muhindo Vicent',
        role: 'ADMIN',
        isActive: true,
      },
    });
    console.log(`[import] Created administrator: ${adminEmail}`);
  } else {
    console.log(`[import] Administrator already exists: ${adminEmail}`);
  }

  // -------------------------------------------------------------------------
  // 2. Personal profile (mirrors build.py hero/about/contact copy)
  // -------------------------------------------------------------------------
  const profile = await db.personalProfile.upsert({
    where: { id: 'profile-default' },
    update: {},
    create: {
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
    },
  });
  console.log('[import] Personal profile seeded');

  // -------------------------------------------------------------------------
  // 3. Website settings (navigation + hero + about + footer)
  // -------------------------------------------------------------------------
  const settings: Record<string, unknown>[] = [
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
        description:
          'Thoughtful interfaces.<br>Connected systems.<br>Built with purpose.',
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

  for (const setting of settings) {
    await db.websiteSetting.upsert({
      where: { key: setting.key as string },
      update: { value: setting.value as Prisma.InputJsonValue, updatedBy: admin.id },
      create: {
        key: setting.key as string,
        value: setting.value as Prisma.InputJsonValue,
        updatedBy: admin.id,
      },
    });
  }
  console.log('[import] Website settings seeded');

  // -------------------------------------------------------------------------
  // 4. Projects (mirrors build.py `projects` array)
  //    All imported as DRAFT so the admin reviews/publishes them.
  // -------------------------------------------------------------------------
  const projects = [
    {
      slug: 'mafuta-watch',
      name: 'MafutaWatch',
      label: 'Fuel price transparency',
      summary:
        'A Uganda-focused web platform for exploring fuel stations and fuel price information.',
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
      summary:
        'An SMS companion designed to send pregnancy guidance and appointment reminders.',
      detail:
        'The project focuses on reaching people through SMS. Pregnancy guidance and appointment reminders are the initial workflows, with pilot work planned.',
      repoUrl: 'https://github.com/muhindovicent/TUNZA-SMS-COMPANION-PROJECT',
      demoUrl: '',
      featured: true,
      sortOrder: 2,
    },
    {
      slug: 'mckanim',
      name: 'McKanim Restaurant',
      label: 'Restaurant · Web experience',
      summary:
        'A responsive restaurant website for browsing the menu and exploring the venue.',
      detail:
        'The website brings the menu, gallery, and reservation entry point together. Its design focuses on making the restaurant easy to explore on a phone.',
      repoUrl: 'https://github.com/muhindovicent/McKanim-restaurant-website',
      demoUrl: '',
      featured: true,
      sortOrder: 3,
    },
  ];

  for (const project of projects) {
    await db.project.upsert({
      where: { slug: project.slug },
      update: {
        name: project.name,
        label: project.label,
        summary: project.summary,
        detail: project.detail,
        repoUrl: project.repoUrl,
        demoUrl: project.demoUrl || null,
        featured: project.featured,
        sortOrder: project.sortOrder,
        updatedBy: admin.id,
        // Keep existing status if already set; otherwise DRAFT
        status: undefined,
      },
      create: {
        slug: project.slug,
        name: project.name,
        label: project.label,
        summary: project.summary,
        detail: project.detail,
        repoUrl: project.repoUrl,
        demoUrl: project.demoUrl || null,
        status: 'DRAFT',
        featured: project.featured,
        sortOrder: project.sortOrder,
        updatedBy: admin.id,
      },
    });
  }
  console.log(`[import] ${projects.length} projects seeded (status: DRAFT)`);

  // -------------------------------------------------------------------------
  // 5. Certifications (mirrors build.py `credentials` array)
  // -------------------------------------------------------------------------
  const credentials = [
    {
      title: 'Third place — Launch Hackathon',
      issuer: 'IEEE Cavendish University Student Branch & CUUCSA',
      date: new Date('2026-11-04'),
      description:
        'As a member of Team Kodepalz, I earned third place at the launch hackathon at Cavendish University Uganda, Siyani Campus. The award recognizes creative problem-solving, technical skill, and teamwork.',
      imageFile: '03-313680.jpg',
      sortOrder: 1,
    },
    {
      title: 'Volunteer — Branch launch',
      issuer: 'IEEE Cavendish University Student Branch & CUUCSA',
      date: new Date('2026-11-04'),
      description:
        'I volunteered at the official branch and association launch at Siyani Campus and received a certificate of appreciation for my time, energy, and dedication.',
      imageFile: '06-31361.jpg',
      sortOrder: 2,
    },
    {
      title: 'Cancer education & awareness',
      issuer: 'Children Caring About Cancer (3C)',
      date: new Date('2023-01-01'),
      description:
        'I received a certificate of appreciation for contributing to cancer education and awareness. The certificate also carries Uganda Cancer Institute and UCCF recognition.',
      imageFile: '04-313683.jpg',
      sortOrder: 3,
    },
    {
      title: 'Leadership & entrepreneurship — Gold certificate',
      issuer: 'Educate! · Nyakasura School',
      date: new Date('2022-10-29'),
      description:
        'I completed an eight-month leadership and entrepreneurship course. It covered personal and cooperative leadership, business and financial literacy, business model development, and community development. As part of the Nyakasura School scholar team, I helped identify a community need and develop a solution.',
      imageFile: '05-313682.jpg',
      sortOrder: 4,
    },
  ];

  for (const cert of credentials) {
    await db.certification.upsert({
      where: { id: `cert-${cert.sortOrder}` },
      update: {},
      create: {
        id: `cert-${cert.sortOrder}`,
        title: cert.title,
        issuer: cert.issuer,
        date: cert.date,
        description: cert.description,
        status: 'PUBLISHED',
        sortOrder: cert.sortOrder,
        updatedBy: admin.id,
      },
    });
  }
  console.log(`[import] ${credentials.length} certifications seeded (status: PUBLISHED)`);

  // -------------------------------------------------------------------------
  // 6. Skills (mirrors build.py `skills` dictionary)
  // -------------------------------------------------------------------------
  const skills: Record<string, string[]> = {
    Frontend: ['HTML, CSS & JavaScript', 'TypeScript', 'React.js & Next.js', 'Tailwind CSS'],
    Backend: ['Python & Java', 'Node.js', 'Express.js & NestJS', 'REST APIs'],
    Databases: ['PostgreSQL & SQL', 'Prisma ORM', 'Database modelling', 'Relational database design'],
    Networking: ['Cisco Packet Tracer', 'VLANs & inter-VLAN routing', 'Routing & switching', 'Network troubleshooting'],
    Engineering: ['System architecture', 'SDLC & requirements engineering', 'UML & ERD modelling', 'Agile & Scrum'],
    'Tools & deployment': ['Git & GitHub', 'Vercel, Render & Neon', 'Figma', 'Visual Studio Code'],
  };

  let skillCount = 0;
  for (const [category, items] of Object.entries(skills)) {
    for (const [index, name] of items.entries()) {
      await db.skill.upsert({
        where: { id: `skill-${category}-${index}` },
        update: {},
        create: {
          id: `skill-${category}-${index}`,
          category,
          name,
          sortOrder: index,
          updatedBy: admin.id,
        },
      });
      skillCount++;
    }
  }
  console.log(`[import] ${skillCount} skills seeded across ${Object.keys(skills).length} categories`);

  // -------------------------------------------------------------------------
  // 7. Education & professional experience placeholders (DRAFT)
  //    build.py marks these as pending; we seed empty draft records so the
  //    admin can complete them in the CMS.
  // -------------------------------------------------------------------------
  await db.education.upsert({
    where: { id: 'education-placeholder' },
    update: {},
    create: {
      id: 'education-placeholder',
      institution: 'Cavendish University Uganda',
      degree: 'Bachelor of Software Engineering',
      fieldOfStudy: 'Software Engineering',
      status: 'DRAFT',
      sortOrder: 1,
      updatedBy: admin.id,
    },
  });

  await db.professionalExperience.upsert({
    where: { id: 'experience-placeholder' },
    update: {},
    create: {
      id: 'experience-placeholder',
      company: 'Team Kodepalz',
      role: 'Software Engineer',
      location: 'Uganda',
      description:
        'Third place at the November 2026 IEEE Cavendish University Student Branch and CUUCSA launch hackathon.',
      status: 'DRAFT',
      sortOrder: 1,
      updatedBy: admin.id,
    },
  });

  await db.leadershipPosition.upsert({
    where: { id: 'leadership-placeholder' },
    update: {},
    create: {
      id: 'leadership-placeholder',
      organization: 'IEEE Cavendish University Student Branch & CUUCSA',
      position: 'Member — Team Kodepalz',
      description:
        'Earned third place at the launch hackathon; volunteered at the official branch and association launch.',
      status: 'DRAFT',
      sortOrder: 1,
      updatedBy: admin.id,
    },
  });

  console.log('[import] Placeholder education, experience, and leadership records seeded (status: DRAFT)');

  console.log('[import] Content migration complete.');
  await db.$disconnect();
}

main().catch((err) => {
  console.error('[import] Fatal error:', err);
  process.exit(1);
});
