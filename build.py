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
<footer><div class="wrap"><p>Have a project in mind?</p><a class="footer-title" href="/contact/">Let’s talk. <span aria-hidden="true">↗</span></a><div class="footer-meta"><span>Muhindo Vicent · Uganda</span><a href="https://unsplash.com/photos/laptop-with-code-headphones-phone-and-mouse-on-desk-41cG8-U74lc">Photo credit</a><a href="{github}">GitHub ↗</a></div></div></footer>
<script src="/motion.js" defer></script></body></html>""", encoding='utf-8')

def work_rows():
    rows = []
    for slug, name, label, *_ in projects:
        rows.append(f'<a class="row" href="/work/{slug}/"><span>{name}</span><small>{label}</small><span class="arrow" aria-hidden="true">↗</span></a>')
    return ''.join(rows)

page('/', 'Portfolio', f"""
<section class="hero">
<div class="hero-copy"><p class="intro">Hello, I’m Vicent.</p><h1>SOFTWARE<br><em>& Web</em><br>ENGINEER</h1><p class="hero-description">Thoughtful interfaces.<br>Connected systems.<br>Built with purpose.</p><a class="pill" href="/work/">Explore my work <span>↗</span></a></div>
<figure class="hero-art"><img src="/workspace.jpg" alt="Laptop displaying code on a wooden workspace" fetchpriority="high"><figcaption>Ideas into working software.</figcaption></figure>
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

page('/experience/', 'Experience', '<section class="wrap inner"><h1>Experience</h1><div class="case-body"><h2>Volunteering</h2><p>Role details are being prepared.</p><h2>Certifications</h2><p>Credential details are being prepared.</p></div></section>')
page('/about/', 'About', '<section class="wrap inner"><h1>About me</h1><p class="lead">I’m Muhindo Vicent, a software engineer and web developer based in Uganda.</p><div class="case-body"><h2>What I work on</h2><p>I’m interested in full-stack web development and networking. My projects explore how web software can make information and services easier to access.</p><a class="pill" href="/work/">Explore my work ↗</a></div></section>')
page('/contact/', 'Contact', f'<section class="wrap inner"><h1>Let’s talk.</h1><p class="lead">Find my projects and open-source activity on GitHub.</p><div class="actions"><a class="pill" href="{github}">Visit GitHub ↗</a></div></section>')
