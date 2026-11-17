from pathlib import Path
from html import escape

out = Path('dist')
projects = [
    ('mafuta-watch', 'MafutaWatch', 'Fuel price transparency', 'A Uganda-focused web platform for exploring fuel stations and fuel price information.', 'The product brings station discovery and public price information into one interface. The staging site is available to explore.', 'https://github.com/muhindovicent/Fuel-Monitoring-System-Uganda', 'https://mafuta-watch-staging.vercel.app/'),
    ('tunza', 'Tunza', 'Maternal health · SMS', 'An SMS companion designed to send pregnancy guidance and appointment reminders.', 'The project focuses on reaching people through SMS. Pregnancy guidance and appointment reminders are the initial workflows, with pilot work planned.', 'https://github.com/muhindovicent/TUNZA-SMS-COMPANION-PROJECT', ''),
    ('mckanim', 'McKanim Restaurant', 'Restaurant · Web experience', 'A responsive restaurant website for browsing the menu and exploring the venue.', 'The website brings the menu, gallery, and reservation entry point together. Its design focuses on making the restaurant easy to explore on a phone.', 'https://github.com/muhindovicent/McKanim-restaurant-website', ''),
]
nav = [('Work', '/work/'), ('Experience', '/experience/'), ('About', '/about/'), ('Contact', '/contact/')]
github = 'https://github.com/muhindovicent'

def page(path, title, body):
    links = ''.join(
        f'<a href="{url}"{" aria-current=page" if path == url else ""}>{label}</a>'
        for label, url in nav
    )
    target = out / path.strip('/') / 'index.html'
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>{escape(title)} · Muhindo Vicent</title>
<meta name="description" content="The engineering portfolio of Muhindo Vicent, software engineer and web developer in Uganda.">
<link rel="stylesheet" href="/style.css"></head>
<body class="{'home' if path == '/' else ''}">
<a class="skip" href="#main">Skip to content</a>
<header><a class="brand" href="/">● &nbsp; Muhindo Vicent</a><nav aria-label="Main navigation">{links}</nav><button class="menu-toggle" aria-expanded="false" aria-label="Open navigation">MENU ☰</button></header>
<main id="main">{body}</main>
<footer><div class="wrap"><p>Have a project in mind?</p><a class="footer-title" href="/contact/">Let’s talk. <span aria-hidden="true">↗</span></a><div class="footer-meta"><span>Muhindo Vicent · Uganda</span><a href="mailto:muhindovicent27@gmail.com">Email</a><a href="https://www.linkedin.com/in/muhindo-vicent-a53542382/">LinkedIn</a><a href="{github}">GitHub ↗</a></div></div></footer>
<script src="/motion.js" defer></script></body></html>""", encoding='utf-8')

def work_rows():
    rows = []
    for slug, name, label, *_ in projects:
        rows.append(f'<a class="row" href="/work/{slug}/"><span>{name}</span><small>{label}</small><span class="arrow" aria-hidden="true">↗</span></a>')
    return ''.join(rows)

page('/', 'Portfolio', f"""
<section class="hero">
<div class="hero-copy"><p class="intro">Hello, I’m Vicent.</p><h1>SOFTWARE<br><em>& Full-Stack</em><br>DEVELOPER</h1><p class="hero-description">Thoughtful interfaces.<br>Connected systems.<br>Built with purpose.</p><a class="pill" href="/work/">Explore my work <span>↗</span></a></div>
<figure class="hero-art"><img src="/images/01-259171.jpg" alt="Muhindo Vicent" fetchpriority="high"><figcaption>Muhindo Vicent · Uganda</figcaption></figure>
<aside class="hero-aside"><div><strong>Uganda</strong><span>Based in East Africa</span></div><a href="/work/"><strong>Web</strong><span>Selected projects</span></a><a href="/experience/"><strong>Beyond code</strong><span>Experience & credentials</span></a><a href="{github}"><strong>GitHub ↗</strong><span>Explore my work</span></a></aside>
</section>
<section class="disciplines"><div><h2>WEB DEVELOPMENT</h2><p>Interfaces that make information easy to explore.</p></div><div><h2>BACKEND SYSTEMS</h2><p>The services and logic behind the experience.</p></div><div><h2>DATABASES</h2><p>Organizing the information applications rely on.</p></div><div><h2>NETWORKING</h2><p>An ongoing interest in how systems connect.</p></div></section>
<section class="bio"><h2>BUILDING SOFTWARE<br>FOR EVERYDAY<br><em>possibilities.</em></h2><div><p>I’m Muhindo Vicent, a software engineer and web developer interested in practical problems and the people who experience them.</p><p class="secondary">My work explores public information, healthcare communication, and digital experiences for businesses.</p><a class="text-link" href="/about/">A little more about me ↗</a></div></section>
<section class="projects"><div class="section-title"><h2>SELECTED WORK</h2><p>A closer look at what I’m building.</p></div>
<a class="feature-project" href="/work/mafuta-watch/"><div class="project-art fuel"><span>MAFUTA<br>WATCH<span class="project-dot">●</span></span><p>Fuel price transparency<br>for Uganda</p><span class="project-open">↗</span></div><div class="project-caption"><h3>MafutaWatch</h3><span>Web platform · Uganda</span></div></a>
<div class="project-pair"><a class="feature-project" href="/work/tunza/"><div class="project-art health"><span>Tunza<em>Care, connected.</em></span><span class="project-open">↗</span></div><div class="project-caption"><h3>Tunza</h3><span>Maternal health · SMS</span></div></a><a class="feature-project" href="/work/mckanim/"><div class="project-art restaurant"><span>McKanim<em>A place at the table.</em></span><span class="project-open">↗</span></div><div class="project-caption"><h3>McKanim Restaurant</h3><span>Restaurant · Web experience</span></div></a></div>
</section>
<section class="experience-strip"><h2>THE PERSON<br><em>behind the work.</em></h2><div><p>Explore my experience, volunteering, and professional learning.</p><a class="pill" href="/experience/">Experience & certifications ↗</a></div></section>
""")

page('/work/', 'Work', f'<section class="wrap inner"><h1>Selected work</h1><p class="lead">Explore my web projects and the problems they address.</p><div class="list">{work_rows()}</div></section>')

for slug, name, label, summary, detail, repo, demo in projects:
    source_link = ''
    demo_link = f'<a class="pill" href="{demo}">Live staging ↗</a>' if demo else ''
    page(f'/work/{slug}/', name, f'''<article class="wrap inner case"><a href="/work/">← All work</a>
<p class="eyebrow">{label}</p><h1>{name}</h1><p class="lead">{summary}</p>
<div class="actions">{source_link}{demo_link}</div>
<section class="case-body"><h2>Project overview</h2><p>{detail}</p></section></article>''')

credentials = [
('03-313680.jpg','Third place — Launch Hackathon','4 November 2026','IEEE Cavendish University Student Branch & CUUCSA','As a member of Team Kodepalz, I earned third place at the launch hackathon at Cavendish University Uganda, Siyani Campus. The award recognizes creative problem-solving, technical skill, and teamwork.'),
('06-313681.jpg','Volunteer — Branch launch','4 November 2026','IEEE Cavendish University Student Branch & CUUCSA','I volunteered at the official branch and association launch at Siyani Campus and received a certificate of appreciation for my time, energy, and dedication.'),
('04-313683.jpg','Cancer education & awareness','2023','Children Caring About Cancer (3C)','I received a certificate of appreciation for contributing to cancer education and awareness. The certificate also carries Uganda Cancer Institute and UCCF recognition.'),
('05-313682.jpg','Leadership & entrepreneurship — Gold certificate','29 October 2022','Educate! · Nyakasura School','I completed an eight-month leadership and entrepreneurship course. It covered personal and cooperative leadership, business and financial literacy, business model development, and community development. As part of the Nyakasura School scholar team, I helped identify a community need and develop a solution.')
]
cards=''.join(f'<article class="credential"><div><p class="eyebrow">{date} · {issuer}</p><h2>{title}</h2><p>{description}</p><a class="text-link" href="/images/{file}" target="_blank" rel="noopener">View certificate ↗</a></div><a href="/images/{file}" target="_blank" rel="noopener"><img src="/images/{file}" alt="{escape(title)} certificate awarded to Muhindo Vicent" loading="lazy"></a></article>' for file,title,date,issuer,description in credentials)
page('/experience/','Experience & recognition',f'<section class="inner"><h1>Experience<br><em>& recognition.</em></h1><p class="lead">Community service, teamwork, and leadership development alongside software engineering.</p><div class="credentials">{cards}</div></section>')
skills = {
'Frontend':['HTML, CSS & JavaScript','TypeScript','React.js & Next.js','Tailwind CSS'],
'Backend':['Python & Java','Node.js','Express.js & NestJS','REST APIs'],
'Databases':['PostgreSQL & SQL','Prisma ORM','Database modelling','Relational database design'],
'Networking':['Cisco Packet Tracer','VLANs & inter-VLAN routing','Routing & switching','Network troubleshooting'],
'Engineering':['System architecture','SDLC & requirements engineering','UML & ERD modelling','Agile & Scrum'],
'Tools & deployment':['Git & GitHub','Vercel, Render & Neon','Figma','Visual Studio Code']
}
skill_cards=''.join(f'<section><h3>{title}</h3><ul>'+''.join(f'<li>{item}</li>' for item in items)+'</ul></section>' for title,items in skills.items())
page('/about/','About',f"""<section class="inner"><p class="eyebrow">MUHINDO VICENT · UGANDA</p><h1>Curiosity into<br><em>working software.</em></h1><div class="about-layout"><div><p class="lead">I’m a Software Engineer & Full-Stack Web Developer specializing in software engineering, UI/UX design, and systems development.</p><div class="case-body"><h2>What drives my work</h2><p>I’m interested in understanding problems, questioning assumptions, and turning ideas into useful digital experiences. My work spans web interfaces, backend services, and the databases that connect them.</p><h2>Learning through practice</h2><p>I am pursuing a Bachelor of Software Engineering at Cavendish University Uganda. My interests include innovation, emerging technologies, and computer networking. I develop my skills through projects, technical study, and hands-on practice.</p><h2>Community & collaboration</h2><p>As part of Team Kodepalz, I earned third place in the November 2026 IEEE Cavendish University Student Branch and CUUCSA launch hackathon. I also volunteered at the launch. My earlier experience includes cancer awareness work recognized in 2023 and an Educate! leadership and entrepreneurship programme completed at Nyakasura School in 2022.</p><h2>Beyond technology</h2><p>I enjoy novels and history, and I value critical thinking, creativity, and continuous learning. These interests shape how I explore ideas and approach unfamiliar problems.</p><a class="text-link" href="/experience/">View experience & recognition ↗</a></div></div><figure class="about-photo"><img src="/images/02-299423.jpg" alt="Muhindo Vicent seated at an event" loading="lazy"></figure></div><section class="skills-section"><h2>Technical skills</h2><p>Technologies and disciplines I have worked with or studied, with varying levels of proficiency.</p><div class="skills-grid">{skill_cards}</div></section></section>""")
page('/contact/','Contact',"""<section class="inner"><h1>Let’s start<br><em>a conversation.</em></h1><p class="lead">Based in Uganda. Get in touch about software engineering opportunities, web projects, or collaboration.</p><div class="contact-list"><a href="mailto:muhindovicent27@gmail.com"><span>Email</span><strong>muhindovicent27@gmail.com</strong><span>↗</span></a><a href="tel:+256791604927"><span>Phone</span><strong>+256 791 604927</strong><span>↗</span></a><a href="https://wa.me/256791604927"><span>WhatsApp</span><strong>Start a conversation</strong><span>↗</span></a><a href="https://www.linkedin.com/in/muhindo-vicent-a53542382/"><span>LinkedIn</span><strong>Muhindo Vicent</strong><span>↗</span></a><a href="https://github.com/muhindovicent"><span>GitHub</span><strong>@muhindovicent</strong><span>↗</span></a></div></section>""")
