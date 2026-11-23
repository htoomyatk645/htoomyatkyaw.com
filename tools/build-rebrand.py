import json, glob, re, sys
"""Generate tools/rebrand.json (run from the repo root: python3 tools/build-rebrand.py).

The template's nav logo SVG, as written in the JS and as rendered in the HTML,
is kept in tools/rebrand-src/ so it can be matched exactly."""
S = "tools/rebrand-src"
SITE = "site/_ext/framerusercontent.com/sites/5m1IdKzbH9qlRGKoqc19kU/"
HOME = ["site/index.html", "tKk4BI1IeMOMfz2OeE9Rm5Ng3bq8SlLJDVdOtS2wD04"]
ABOUT = ["site/about.html", "ebcPKwnxLArQv7NWmWepjkjnomHrDSOje0je1g8Eyp0"]
SERVICES = ["site/services.html", "VIGVWIlQjzb1djAyRJmH49B9oW6pb13oxHnQJngdpOE"]
BLOG = ["site/blog.html"]
CARDS_HTML = ["site/index.html", "site/case-study.html", "site/case-study/"]
DATE_MODULES = ["dCzIeJ1zOtbadg7gAZ8tOWvZXEVwMIluwXwJJn_9J9A", "jFDzg-Fq9D8SbFZq_IRIC-M9TBUP4nfs0oE7GAAyVUI", "tKk4BI1IeMOMfz2OeE9Rm5Ng3bq8SlLJDVdOtS2wD04"]

R = []
def rep(find, replace, only=None, **kw):
    e = {"find": find, "replace": replace}
    if only: e["only"] = only
    e.update(kw)
    R.append(e)

# ---------------------------------------------------------------- template bits
rep("text:`BUY NUDGE`,textColor:`var(--token-4f4ed186-9023-4858-830a-5202d69249c1, rgb(17, 18, 18))`,visible:!0",
    "text:`BUY NUDGE`,textColor:`var(--token-4f4ed186-9023-4858-830a-5202d69249c1, rgb(17, 18, 18))`,visible:!1")
rep("https://buy.polar.sh/polar_cl_9a5vgJf76xch9cThQ1yzFU4r218QMmvCzyUiR0YxC4R", "/")
rep("https://huehaus.supply/", "/")
BASE_CSS = ("#__framer-badge-container,.framer-tg9meo-container,.framer-xso6nc-container{display:none!important}"
            # "Htoo Myat Kyaw" is twice as long as the template name: scale it to fit.
            ".framer-tdbbdt .framer-text{font-size:min(150px,calc((100vw - 56px) / 7.9))!important;letter-spacing:-.025em!important}"
            # "my app" polaroid: taller photo area for the app screenshot (984x2000).
            ".framer-1g6trdm-container:has(img[src*=jaipCY]){height:407px!important}"
            ".framer-1g6trdm-container:has(img[src*=jaipCY]) .framer-82wh8q{height:auto!important}"
            ".framer-1g6trdm-container:has(img[src*=jaipCY]) .framer-1ywu17f{height:auto!important;aspect-ratio:984/2000}"
            "@media (max-width:1199.98px){.framer-ljnwxn:has(img[src*=jaipCY]){height:auto!important}}")
BLOG_CSS = ".framer-18htyvr{display:none!important}"
OLD_STYLE = "<style>#__framer-badge-container{display:none!important}</style>"
rep(OLD_STYLE, f"<style>{BASE_CSS}{BLOG_CSS}</style>", BLOG)
rep(OLD_STYLE, f"<style>{BASE_CSS}</style>")
rep('<link href="/_ext/framerusercontent.com/images/wjwqrOUY5j7XeCzEQHXDiOX9dE.png" rel="icon" media="(prefers-color-scheme: dark)">',
    '<link href="/brand/favicon-dark.png" rel="icon" media="(prefers-color-scheme: dark)">')
NEW_LOGO = '<svg width="100%" height="100%" viewBox="0 0 50 25" xmlns="http://www.w3.org/2000/svg"><image href="/brand/portrait-mark.png" x="12.5" y="0" width="25" height="25"/></svg>'
rep(open(f"{S}/logo_js.txt").read(), NEW_LOGO)
rep(open(f"{S}/logo_html.txt").read(), NEW_LOGO)

# ---------------------------------------------------------------- site-wide
rep(" - Nudge - Premium Portfolio Template", " | Htoo Myat Kyaw")
rep("Nudge - Premium Portfolio Template", "Networking with Professionals | Htoo Myat Kyaw", ["play-ground.html"])
rep("Nudge - Premium Portfolio Template", "Htoo Myat Kyaw | Co-founder of Briefly")
rep("Nudge is a bold, personality-driven portfolio template for product designers who want to stand out. Built for storytelling, not just showcasing.",
    "Htoo Myat Kyaw is co-founder of Briefly, an audio-native short form podcast discovery app. He leads UI/UX and product design.")
rep(" - My Framer Site", " | Briefly by Htoo Myat Kyaw")
rep("Page Not Found | Framer", "Page Not Found | Htoo Myat Kyaw")
rep("Create a free website with Framer, the website builder loved by startups, designers and agencies.", "Htoo Myat Kyaw")
# Hero clock: show the visitor's local time, not the template's fixed Canada/Pacific zone.
rep("hour12:!n,timeZone:e}", "hour12:!n,timeZone:void 0}", HOME[1:])
rep("`EM`", "`HK`"); rep(">EM<", ">HK<")
rep("`PH`", "`BR`"); rep(">PH<", ">BR<")
rep("mailto:Hello@selenadesigns.com", "mailto:Htoo.Kyaw@tufts.edu")
# "download resume" on the nav avatar's hover card (rewritten to the email above).
rep("href:`mailto:Htoo.Kyaw@tufts.edu`,motionChild:!0,nodeId:`TZH86zigh`", "href:`/Htoo_Myat_Kyaw_Resume.pdf`,motionChild:!0,nodeId:`TZH86zigh`")
# Clicking that hover card downloads a file: the template's sample resume image.
rep("file:`/_ext/framerusercontent.com/assets/5D0eDc95VXdjgoSNI5fR7NpyX0k.jpg`,fileName:`Bejamin's Resume`",
    "file:`/Htoo_Myat_Kyaw_Resume.pdf`,fileName:`Htoo_Myat_Kyaw_Resume.pdf`")
rep("children:`download resume`", "children:`السلام عليكم`")
rep("tel:+123456789", "https://briefly.briefa.net")

# Services hero intro shares its text with the footer; change it first.
FOOTER_OLD = "I'm most energized by projects where I can dig into complex problems, collaborate with smart people, and ship things that genuinely improve someone's day."
rep(FOOTER_OLD, "Product design, UI/UX redesigns, and app and product consulting. Every project is custom priced, so reach out first.", ["VIGVWIlQjzb1djAyRJmH49B9oW6pb13oxHnQJngdpOE"])
rep(FOOTER_OLD, "Product design, UI/UX redesigns, and app and product consulting. Every project is custom priced, so reach out first.", ["site/services.html"], split=True)
rep(FOOTER_OLD, "I love talking about CPG businesses, human psychology, collaborating on ideas, and poetry. If curiosity and action is the main driver of your pursuits, I'd love to chat with you!")
rep("Open to contract work, full-time roles, and interesting conversations about hard design problems.", "My most passionate invention, Briefly, is live on the App Store. Give it a chance to enlighten you!")
rep("COntact me", "Contact me")

# ---------------------------------------------------------------- home
rep("Currently at Meridian Health", "Co-founder at Briefly")
rep("Previously at Searchless AI", "Leading UI/UX, Product design, and Strategy")
rep("Available for thoughtful projects", "Launched October 2026")
rep("I design ", "I'm building ", ["site/index.html"])
rep("`I design", "`I'm building", HOME[1:])
rep("outstanding digital products", "a better way to listen")
rep("Product designer", "Cognitive Science centered builder & designer")
rep("Chicago, IL", "Boston, MA")
rep("what's up", "wassup")
rep("my workspace", "my app")
rep("I'm Bejaman", "I'm Htoo a.k.a Zaid,", HOME)
rep("a product designer in Chicago who gets excited", "founder, operator, and a lifelong student who gets excited", HOME)
rep("about making complicated things simple", "about making consumer products easy to use and scaling them worldwide", HOME)
rep("Interaction Design", "Product Interaction Design", HOME)
rep("Motion Design", "Scaling 🌏", HOME)
rep("This is a showcase of what happens when curiosity drives the process.", "Here's a sneak peek of the surface level behind the scenes")

# ---------------------------------------------------------------- about
rep("a product designer in Chicago who gets excited", "a first-generation QuestBridge Scholar studying Cognitive and Brain Science and Computer Science at Tufts, who gets excited", ABOUT)
rep("about making complicated things simple", "about neurotechnology and consumer products built around the mind", ABOUT)
rep("I spend my days designing for healthcare platforms, booking systems, and other products where 'just figure it out' isn't an option. The people using these tools are busy, stressed, and have actual work to do. My job is to get out of their way.",
    "I study Cognitive and Brain Science alongside Computer Science at Tufts, an interdisciplinary path that combines neuroscience, computer science, and philosophy to study the mind. I'm drawn to neuroscience research for its rigor, to tech policy for its role in protecting human rights, and to consumer neurotechnology and wearables that bring the science into everyday life.")
rep("I've worked on teams of two and teams of twenty. I've had access to endless user research and I've had to make educated guesses with limited data. I've worked within strict component libraries and I've built design systems from scratch. What stays consistent is asking good questions, collaborating with people who know more than me, and shipping things that actually help",
    "I'm the co-founder of Briefly, a short-form, audio-only podcast app. I lead product UI/UX design, organic marketing, and day-to-day operations with a team of three, and I direct AI coding agents and review their code, so I stay close to how an idea becomes a product.")
rep("Currently, I'm at Meridian Health working on experiences for mental health clinicians and administrators. Before that, I spent almost two years at StyleBook helping salons manage their businesses (and discovering that stylists have very strong opinions about scheduling interfaces, which I deeply respect). ",
    "I study how legendary operators build, and I run Briefly by the Islamic ideals of commerce. Honest dealing, fair value, and mutual consent turn trade into a relationship instead of an extraction. When both sides can trust what they are getting, customers stay, teams stay, and a business earns something bigger than profit: the trust of the people it serves. If it isn't good for everyone it touches, it isn't worth building. ")
rep("When I'm not designing, you'll find me thinking about why some interfaces feel intuitive and others make you want to throw your laptop out a window. Usually with coffee. ",
    "When I'm not working on Briefly or studying, I'm training Brazilian Jiu-Jitsu, cooking, spending time with family and friends, or practicing languages: English, Urdu, and Burmese (fluent), Chinese (intermediate), and Turkish (beginner). ")
# principles
rep("Starting with why, not what", "Start with attention")
rep("Before jumping into wireframes, I want to understand what problem we're actually solving. Sometimes the thing people ask for isn't the thing they need. My favorite projects start with good questions and end with solutions that feel obvious in hindsight.",
    "People often listen while commuting, cooking, or driving, when their hands and eyes are occupied. Because attention is limited, I design experiences that accommodate the listener's environment rather than demanding their full attention.")
rep("think first, draw later.", "Attention is a limited resource.")
rep("Designing for real constraints", "Lower the cognitive load")
rep("Perfect conditions don't exist. Budgets are tight, timelines are aggressive, legacy systems are messy, and sometimes you just can't talk to users directly. I'm comfortable making smart decisions with imperfect information and finding creative solutions within real limitations.",
    "Working memory can only process a limited amount of information at once, so I design each screen around a single clear decision. By using familiar patterns and intuitive navigation, I make interactions easier to understand and the next step easier to recognize.")
rep("no perfect world here!", "Simplicity reduces mental effort.")
rep("Collaboration over hero design", "Accessible by default")
rep("The best work happens when designers, engineers, and product folks are actually talking to each other—not throwing things over the wall. I genuinely enjoy the back-and-forth of figuring out what's possible, what's practical, and what's going to create the most value.",
    "Designing for people who are distracted, tired, or navigating noisy environments creates a better experience for everyone, including those with visual or motor impairments. This principle guides my emphasis on audio-first interactions, CarPlay compatibility, and larger touch targets.")
rep("Making the invisible visible", "Build trust through feedback")
rep("Some of the most impactful design work isn't flashy—it's the progress indicator that keeps people oriented, the auto-save that prevents panic, the validation message that actually helps instead of just saying 'error.' These details build trust.",
    "Trust develops when people understand what to expect from a product and how it responds to their actions. By preserving the original speaker's voice and providing clear feedback for every interaction, I ensure listeners understand what is happening and remain confident in their experience.")
rep("we, not me.", "Accessibility benefits everyone.", ABOUT)
rep("details build trust.", "Clarity creates confidence and trust.", ABOUT)
rep("Main bio", "A peek into my world", ABOUT)
rep("Timeline", "My non-linear journey so far......", ABOUT)
rep("What dive into my work", "A dive into my work")
rep("A dive into my work", "This is my approach to Briefly", ABOUT, near="framer-19x1pr")

# timeline (About only; the same names are case-study titles elsewhere)
TL = [
    ("Meridian Health", "Briefly Apps Inc.", "Sep 2025 - Current", "Mar 2026 - Present",
     "Designing across scheduling, case management, treatment planning, and clinical documentation for mental health practices. The challenge is balancing what clinicians need with what administrators need—often very different things—while keeping everything HIPAA-compliant and actually usable. ",
     "Co-Founder & Member of Technical Staff. Co-founded a short-form, audio-only podcast app that turns full episodes into a personalized feed of AI-selected highlights. I co-built the AI pipeline and recommendation engine, lead product and UI/UX design, and grew our social presence organically to 2,700 followers and 1.5M+ views. "),
    ("StyleBook", "Tufts HRI Lab", "Mar 2024 - aug 2025", "Sep 2026 - Present",
     "Redesigned everything from appointment booking to inventory management for a salon management platform. Worked directly with salon owners and stylists to understand their workflows, then rebuilt features to match how they actually work instead of how we thought they worked.",
     "Paid Research Assistant in the Human-Robot Interaction & Trustworthy AI Lab. I recruit participants, support IRB-compliant HRI studies, and analyze trust and usability data in R with ggplot2."),
    ("Northlight Consulting", "The RNA Institute", "Feb 2024 - dec 2024", "Jul 2025 - Aug 2025",
     "Led UX strategy and discovery for enterprise clients. Facilitated workshops with stakeholders who had very different ideas about what they were building, then helped everyone land on the same page. Also mentored junior designers, which taught me how to articulate my process instead of just doing it. ",
     "Research Student, Computational Biology. Selected for a small national cohort studying spinocerebellar ataxia. I analyzed real RNA datasets in R and on the Linux command line and presented the findings on a research poster. "),
    ("Homestead", "Albany Medical Center", "jan 2022 - dec 2023", "Mar 2025 - Aug 2026",
     "Joined when the product was technically functional but deeply confusing. Talked to users who were struggling, mapped out where the interface was failing them, and redesigned the core experience to actually make sense. Also helped establish initial brand direction. ",
     "Anesthesia Technician. Kept 10+ daily surgical procedures running across 34 ORs, 14 non-ORs, and 5 cath labs, and troubleshot 50+ anesthesia machine and monitoring issues before procedures. "),
]
for old, new, od, nd, otext, ntext in TL:
    rep(otext, ntext, ABOUT)
    rep(od, nd, ABOUT)
    rep(old, new, ABOUT)

# ---------------------------------------------------------------- services
rep("available for Q4 projects ots", "open to new projects")
rep("my services", "what i do")
CARDS = [("Product Design", "Product Design", "Designing digital products from the first idea to the final interface.", "From a first idea to a product people can use: flows, screens, and a prototype you can test.", "framer-515de4"),
         ("web design", "UI/UX Reimagining", "Strong visual direction with thoughtful structure to create digital experiences that are as effective as they are memorable", "A fresh look at an app or site you already have: what confuses people, what to cut, and a redesign that is easier to use.", "framer-10v42ac"),
         ("Design systems", "App Development Consulting", "Building flexible visual systems that make products easier to design, build, and scale.", "Advice on building and shipping an app: choosing the stack, working with AI coding agents, and getting to the App Store.", "framer-1b8ygq1"),
         ("Creative direction", "Product Development Consulting", "Building flexible visual systems that make products easier to design, build, and scale.", "A thinking partner from idea to launch: who it is for, what to build first, and how to grow it.", "framer-bbkleu")]
for oh, nh, od, nd, cls in CARDS:
    if oh != nh:
        rep(oh, nh, SERVICES, near={"Product Design": "framer-g58dri", "web design": "framer-1igbjtj", "Design systems": "framer-g4c9lv", "Creative direction": "framer-1zotpg"}[oh])
        rep(oh, nh, ["site/services.html"], split=True)
    rep(od, nd, SERVICES, near=cls)
TAGS = {  # container -> new tag, in card order
    "framer-h4g844-container": "Product Strategy", "framer-183rdj3-container": "User Flows", "framer-yc6h9r-container": "Wireframes",
    "framer-g0c05d-container": "Prototyping", "framer-1lueen2-container": "Mobile and Web",
    "framer-o4mpja-container": "UX Audit", "framer-zho5e9-container": "Redesign", "framer-1mejb2k-container": "Visual Refresh",
    "framer-vpkjn5-container": "Accessibility", "framer-1slb844-container": "Design System",
    "framer-1tlax7p-container": "React Native and Expo", "framer-toxuni-container": "Agentic Coding", "framer-1ad3zi6-container": "AI Pipelines",
    "framer-mq8bwj-container": "App Store Launch", "framer-1rdpkrn-container": "Code Review",
    "framer-49eqph-container": "Positioning", "framer-n6gm6d-container": "MVP Scoping", "framer-1kbjuiu-container": "Roadmap",
    "framer-1ipfo84-container": "Organic Growth", "framer-15adn40-container": "Launch Plan",
}
# Read the template text from the unmodified mirror, not the rebranded site/.
import subprocess
MIRROR = "1d2ecb4"
vt = subprocess.run(["git", "show", f"{MIRROR}:" + glob.glob(SITE + "VIGV*.mjs")[0]], capture_output=True, text=True, check=True).stdout
for cont, new in TAGS.items():
    old = re.search(r"className:`" + cont + r"`,nodeId:`\w+`,scopeId:`\w+`,children:d\(q,\{a_X5HpvjX:`([^`]*)`", vt).group(1)
    rep(old, new, SERVICES, near=cont, findHtml=old.replace("&", "&amp;"))
STEPS = [("First, I get familiar with the problem, the people, and the bigger picture.", "First, I get to know your users, your product, and the problem worth solving."),
         ("I translate what I learn into a clear direction, structure, and set of priorities.", "I turn that into one clear direction and a short list of priorities."),
         ("Then I explore, iterate, and refine until the right solution starts to take shape.", "Then I explore, test, and refine until it feels right."),
         ("Finally, I bring everything together into a polished, flexible system ready to ship.", "Finally, I hand it over ready to build, and stay close while it ships.")]
for o, n in STEPS: rep(o, n)
GROUPS = [("Strategy", "Languages"), ("design", "Build"), ("Systems", "AI & Agents"), ("Motion", "Design")]
for o, n in GROUPS:
    rep(f"rTmzt9Hxo:`{o}`", f"rTmzt9Hxo:`{n}`", SERVICES[1:])
    rep(o, n, SERVICES[:1], near="framer-s1tccs")
ITEMS = [("framer-1174bva", "Python"), ("framer-tnni55", "C++"), ("framer-kf7xgw", "TypeScript, JavaScript"), ("framer-1pzv9qn", "CSS"), ("framer-1h1fn2c", "R (ggplot2)"),
         ("framer-1hqf9cr", "React Native (Expo)"), ("framer-1hmretn", "Supabase"), ("framer-hh4awa", "Vercel"), ("framer-1uig92t", "FFmpeg"), ("framer-h2xm5", "Linux command line"),
         ("framer-1jv364m", "Claude Code, Codex, Cursor"), ("framer-1gnhxkk", "Grok Bot, Dots, Conductor"), ("framer-1agb8lf", "Skills Diversification"), ("framer-1talren", "Recommendation Systems"),
         ("framer-iw1feu", "Figma, Paper"), ("framer-qr5bbu", "Adobe Creative Cloud"), ("framer-1griwbb", "Wireframing"), ("framer-1fp0der", "UI/UX")]
for cls, new in ITEMS:
    i = vt.find("className:`" + cls + "`")
    old_js = re.findall(r"children:`([^`]*)`", vt[i - 600:i])[-1]
    old_html = old_js.replace("\\u2028", " ")
    rep(old_html, new, SERVICES, near=cls, findJs=old_js, findHtml=old_html)
FAQ = [("Does Bejaman design websites, or only digital products?", "How much does it cost?"),
       ("Both. Alongside app/dashboard product design, Bejaman also designs websites and landing pages with a storytelling approach, not just visuals.",
        "Every project is custom priced. Tell me what you need through the contact page and I will reply with a scope and a quote."),
       ("Does he build Design Systems, or just individual screens?", "What kinds of projects do you take?"),
       ("Yes. Especially for multi stakeholder enterprise work like North Light, where a shared design language and reusable components are key to scaling the product.",
        "Product design, UI/UX redesigns, and consulting on app and product development, mostly for consumer apps."),
       ("What does the Product Design process look like?", "What have you built yourself?"),
       ("Four pillars: User Research to find the real problem, Interaction Design to shape the flow, Prototyping to test ideas fast, and Motion Design to polish the experience. Meridian Health and StyleBook are good examples of this in action.",
        "Briefly, a short-form, audio-only podcast app I co-founded. It launched on the iOS App Store in October 2026 and works with CarPlay."),
       ("What does Creative Direction mean here?", "Is the college admissions help really free?"),
       ("It's guiding the overall visual identity, tone, and experience across a project, making sure every design decision (color, motion, storytelling) stays consistent and serves the client's business goals.",
        "Yes. It is for first-generation, low-income students. Fill out the short survey on this page and I will do my best to help.")]
for o, n in FAQ: rep(o, n)

# ---------------------------------------------------------------- case-study cards (HTML side; CMS edited by cms-edit.mjs)
rep("dateStyle:`medium`,timeZone:`UTC`", "year:`numeric`,timeZone:`UTC`", DATE_MODULES)
for o in ["Mar 19, 2026", "Mar 2, 2026", "Jan 2, 2025"]: rep(f">{o}<", ">2026<", CARDS_HTML)
CARD_TEXT = [("Meridian Health", "Briefly: All Things Podcasts"), ("StyleBook", "The Briefly Look"), ("Homestead", "Seven Slides a Day"), ("North Light",  "Bionic Redr"),
             ("When therapists spend less time clicking, they have more time for patients.", "Podcasts briefs that stay audio."),
             ("From 'I hate this system' to 'Can we show other salons?", "Dark, minimal, and quiet enough to let the voice lead."),
             ("Helping first-time homebuyers actually understand what they're looking at.", "How a small team builds an audience on Instagram, one carousel at a time."),
             ("Getting seven stakeholders to agree on what they're actually building.", "A Chrome extension that makes any web page easier to read, on device.")]
for o, n in CARD_TEXT: rep(o, n, CARDS_HTML + ["searchIndex"])
for o, n in [("Healthcare", "Product"), ("Workflow Design", "Audio"), ("SaaS", "Brand"), ("Transformation", "UI/UX"), ("Proptech", "Content"), ("0 -&gt; 1", "Growth"), ("Strategy", "Engineering"), ("Enterprise", "AI"), ("Product Designer", "Co-founder")]:
    rep(f">{o}<", f">{n}<", CARDS_HTML)

# The page's embedded "handover" data (what the client hydrates from) holds the
# same CMS values as quoted JSON strings.
for o in ["2026-03-19T00:00:00.000Z", "2026-03-02T00:00:00.000Z", "2025-01-02T00:00:00.000Z"]:
    rep(f'"{o}"', '"2026-05-01T00:00:00.000Z"', CARDS_HTML)
for o, n in [("Healthcare", "Product"), ("Workflow Design", "Audio"), ("SaaS", "Brand"), ("Transformation", "UI/UX"), ("Proptech", "Content"), ("0 -> 1", "Growth"), ("Strategy", "Engineering"), ("Enterprise", "AI")]:
    rep(f'"{o}"', f'"{n}"', CARDS_HTML)

rep("random shot", "on my way to reply", ["site/contact.html", "BtP3pvF_fYTo_Pg8rSB-HB_aaFqbK-TxzQyB0k7Exy4"])

# ---------------------------------------------------------------- playground
for o, n in [("nothing big, still feels nice", "Picture Before Getting Promoted"), ("Brain’s messy, but it’s okay", "Tabling to Cure Bone Cancer"), 
             ("Good weather", "Thank You!"), ("Random shot", "random shot"), ("Tiny moments", "First Time Training with a Former UFC Fighter"),
             ("Not sure what I’m doing", "Muslims in Business Conference"), ("bus bus bus", "at the Pakistan conference @ HBS"), ("flower!", "First Day Working in the OR at 17")]:
    rep(o, n)

# Playground's tab title (all pages share one metadata function).
rep("title:`Htoo Myat Kyaw | Co-founder of Briefly`}}",
    "title:typeof location<`u`&&location.pathname.startsWith(`/play-ground`)?`Networking with Professionals | Htoo Myat Kyaw`:`Htoo Myat Kyaw | Co-founder of Briefly`}}",
    ["shared-lib"])

# ---------------------------------------------------------------- contact
rep("Where to find you?", "Where can I reach you?")
rep("I'm available for new projects!", "Podcasters, press, and partners welcome!")
rep("CenImty1m:`https://www.facebook.com/`", "CenImty1m:`mailto:Htoo.Kyaw@tufts.edu`")
rep('href="https://www.facebook.com/"', 'href="mailto:Htoo.Kyaw@tufts.edu"')
rep("https://www.instagram.com/", "https://www.instagram.com/brieflyhq_/")
rep("https://www.linkedin.com/", "https://www.linkedin.com/in/htoo-myat-kyaw-ny/")
rep("`Facebook`", "`Email`"); rep(">Facebook<", ">Email<")
rep("`Linkedin`", "`LinkedIn`"); rep(">Linkedin<", ">LinkedIn<")
rep("M12 2.04004C6.5 2.04004 2 6.53004 2 12.06C2 17.06 5.66 21.21 10.44 21.96V14.96H7.9V12.06H10.44V9.85004C10.44 7.34004 11.93 5.96004 14.22 5.96004C15.31 5.96004 16.45 6.15004 16.45 6.15004V8.62004H15.19C13.95 8.62004 13.56 9.39004 13.56 10.18V12.06H16.34L15.89 14.96H13.56V21.96C15.9164 21.5879 18.0622 20.3856 19.6099 18.5701C21.1576 16.7546 22.0053 14.4457 22 12.06C22 6.53004 17.5 2.04004 12 2.04004Z",
    "M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z")

# Services, "How I work": the template pins the section and scrubs it sideways
# with the scroll. On a phone the cards are already stacked, so the pin only
# makes the page judder; leave phones to scroll normally.
rep("if(!t||!ut()){", "if(!t||!ut()||globalThis.matchMedia(`(max-width:809.98px)`).matches){", ["VIGVWIlQjzb1djAyRJmH49B9oW6pb13oxHnQJngdpOE"])

# ---------------------------------------------------------------- site script
# Every page except Home carries content or a script that is in its own HTML
# and not in the Framer bundle (tools/build-content.mjs, journey.js on About),
# so links to them do a full page load instead of a client-side route change; a capture
# listener runs before Framer's router sees the click.
# Published write-ups (LIVE) open their standalone page instead; card 1
# (Briefly) opens the product site and its button reads "View Product".
# Card 2 (The Briefly Look) gets a second button under "View Project":
# "View My Framework", opening /making-of-briefly (a copy of the first button,
# added after hydration since all cards share one component).
# In the nav, "HK" copies the email address and "BR" opens Briefly.
# Backstop: if the page router still tries to show one of those routes (for a
# tap that slipped past the click handler), load the real destination instead
# of rendering the template page client-side.
SITE_JS = r"""(()=>{
const SOON=/^\/(case-study|services|blog|about|contact|play-ground)(\/|$)/;
const LIVE={"/case-study/north-light":"/under-the-hood","/case-study/stylebook":"/the-briefly-look","/case-study/homestead":"/seven-slides-a-day","/case-study/meridian-health":"https://briefly.briefa.net"};
const EMAIL="htoomyatk645@gmail.com",BRIEFLY="https://briefly.briefa.net",FRAMEWORK="/making-of-briefly";
let el,t;
const note=m=>{if(!el){el=document.createElement("div");el.id="coming-soon";el.setAttribute("role","status");document.body.appendChild(el)}el.textContent=m;el.classList.add("on");clearTimeout(t);t=setTimeout(()=>el.classList.remove("on"),1800)};
const copy=v=>(navigator.clipboard?navigator.clipboard.writeText(v):Promise.reject()).catch(()=>{const a=document.createElement("textarea");a.value=v;a.style.position="fixed";a.style.opacity="0";document.body.appendChild(a);a.select();try{document.execCommand("copy")}finally{a.remove()}});
const open=to=>/^https?:/.test(to)?window.open(to,"_blank","noopener"):location.href=to;
const target=u=>{const p=u.pathname.replace(/\/$/,"");return LIVE[p]||null};
const here=location.pathname.replace(/\/$/,"");
const same=u=>u.pathname.replace(/\/$/,"")===here;
const guard=f=>function(st,ti,url){if(url!=null){const u=new URL(url,location.href);if(u.origin===location.origin&&SOON.test(u.pathname)&&!same(u)){location.assign(target(u)||u.href);return}}return f.apply(this,arguments)};
addEventListener("popstate",()=>{if(SOON.test(location.pathname)&&!same(location))location.reload()});
history.pushState=guard(history.pushState);history.replaceState=guard(history.replaceState);
document.addEventListener("click",e=>{
  const tg=e.target.closest?e.target:e.target.parentElement;
  if(tg.closest(".framer-119y192-container")){e.preventDefault();e.stopImmediatePropagation();copy(EMAIL).then(()=>note("Email Copied"));return}
  if(tg.closest(".framer-1yzdk2p-container")){e.preventDefault();e.stopImmediatePropagation();open(BRIEFLY);return}
  const a=tg.closest("a[href]");if(!a)return;
  const u=new URL(a.getAttribute("href"),location.href);
  if(u.origin!==location.origin||!SOON.test(u.pathname))return;
  e.preventDefault();e.stopImmediatePropagation();
  const to=target(u);if(to)return open(to);
  if(same(u)&&!u.hash){scrollTo({top:0,behavior:"smooth"});return}
  location.assign(u.href);
},true);
const relabel=()=>document.querySelectorAll('a[href$="case-study/meridian-health"]').forEach(a=>{const w=document.createTreeWalker(a,4);for(let n;n=w.nextNode();)if(n.nodeValue.trim()==="View Project")n.nodeValue=n.nodeValue.replace("View Project","View Product")});
const swap=(el,a,b)=>{const w=document.createTreeWalker(el,4);for(let n;n=w.nextNode();)if(n.nodeValue.trim()===a)n.nodeValue=n.nodeValue.replace(a,b)};
const framework=()=>document.querySelectorAll('a[href$="case-study/stylebook"]').forEach(a=>{const c=a.closest(".framer-1nmyz7r-container");if(!c)return;if(c.nextElementSibling&&c.nextElementSibling.dataset.framework)return;const n=c.cloneNode(true);n.dataset.framework="1";const l=n.matches("a")?n:n.querySelector("a");l.setAttribute("href",FRAMEWORK);l.removeAttribute("target");swap(n,"View Project","View My Framework");c.after(n)});
const RESUME="/Htoo_Myat_Kyaw_Resume.pdf",LINKEDIN="https://www.linkedin.com/in/htoo-myat-kyaw-ny/";
let top;
const topbar=()=>{
  if(!top){top=document.createElement("div");top.id="hk-top";top.innerHTML='<a class="cv" href="'+RESUME+'" target="_blank" rel="noopener">Resume</a><a class="in" href="'+LINKEDIN+'" target="_blank" rel="noopener" aria-label="LinkedIn"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg></a>';document.body.appendChild(top)}
  const vis=s=>[...document.querySelectorAll(s)].find(e=>e.getBoundingClientRect().width>0);
  const anchor=vis(".framer-ns3vo2")||vis(".framer-1v43z4j-container"),nav=vis("nav");
  const r=anchor&&anchor.getBoundingClientRect();
  if(!r||r.top>24||(nav&&nav.getBoundingClientRect().height>80)){top.classList.remove("on");return}
  top.style.right=Math.round(innerWidth-r.left+12)+"px";top.style.top=Math.round(r.top+(r.height-32)/2)+"px";top.classList.add("on");
};
const pill=()=>{const w=document.querySelector(".framer-1ukjnmv"),p=document.querySelector(".framer-rmz83s");if(!w||!p)return;const r=w.getBoundingClientRect();p.classList.toggle("hk-away",r.bottom<innerHeight-40||r.top>innerHeight*.6)};
const patch=()=>{relabel();framework();topbar();pill()};
let pq=0;const soon=()=>{if(pq)return;pq=1;setTimeout(()=>{pq=0;patch()},150)};
let sq=0;addEventListener("scroll",()=>{if(sq)return;sq=1;requestAnimationFrame(()=>{sq=0;pill()})},{passive:true});
addEventListener("resize",soon);
addEventListener("load",()=>setTimeout(()=>{patch();new MutationObserver(soon).observe(document.body,{subtree:true,childList:true})},300));
})()"""
SITE_CSS = ("#coming-soon{position:fixed;left:50%;bottom:32px;transform:translate(-50%,20px);opacity:0;pointer-events:none;z-index:2147483647;"
            "background:#111212;color:#fff;font:500 14px/1 Inter,system-ui,sans-serif;letter-spacing:.02em;padding:12px 18px;border-radius:999px;"
            "transition:opacity .2s,transform .2s}#coming-soon.on{opacity:1;transform:translate(-50%,0)}"
            ".framer-119y192-container,.framer-1yzdk2p-container{display:none!important}"
            "#hk-top{position:fixed;top:8px;right:16px;z-index:12;display:none;align-items:center;gap:8px}#hk-top.on{display:flex}"
            "#hk-top a{box-sizing:border-box;height:32px;display:inline-flex;align-items:center;justify-content:center;color:#111212;text-decoration:none;transition:transform .2s}"
            "#hk-top a:active{transform:scale(.94)}"
            "#hk-top .cv{padding:0 10px;border:1px solid #111212;background:#fff;font:500 13px/1 'DM Mono',ui-monospace,monospace;letter-spacing:-.02em;text-transform:uppercase}"
            "#hk-top .cv:hover{background:#111212;color:#fff}"
            "#hk-top .in{width:32px}#hk-top .in svg{width:26px;height:26px;fill:#111212}#hk-top .in:hover svg{fill:#444}"
            "@media (max-width:809.98px){"
            ".framer-qu7yco{position:static!important;height:0!important;min-height:0!important}"
            ".framer-rmz83s{position:fixed!important;left:50%!important;top:auto!important;bottom:calc(14px + env(safe-area-inset-bottom,0px))!important;transform:translateX(-50%)!important;z-index:9!important;transition:opacity .25s,visibility .25s}"
            ".framer-rmz83s.hk-away{opacity:0!important;visibility:hidden;pointer-events:none}}")
SITE_SCRIPT = "<style>" + SITE_CSS + "</style><script>" + "".join(l.strip() for l in SITE_JS.splitlines()) + "</script>"
# Anchor on Framer's bodyEnd marker so standalone pages in site/ are left alone.
rep("<!-- End of bodyEnd -->", "<!-- End of bodyEnd -->" + SITE_SCRIPT, [".html"])
# About: collapsible experience list (site/journey.js replaces the template timeline).
rep("<!-- End of bodyEnd -->", "<!-- End of bodyEnd --><script src=\"/journey.js\" defer></script>", ["site/about.html"])

# ---------------------------------------------------------------- asset URLs
# Serve every asset under a new prefix so browsers that cached /_ext/* as
# immutable fetch fresh copies; src/worker.js maps it back to ./site/_ext.
# Runs after every replacement that mentions an /_ext/ path.
ASSET_PREFIX = "/_v2/"

# ---------------------------------------------------------------- name (last)
rep("BEJAMAN", "HTOO MYAT KYAW")
rep("Bejaman", "Htoo Myat Kyaw")

# New URLs for the icons and the share image so browsers and link-preview
# caches (iMessage, LinkedIn, Slack...) pick up the portrait versions.
for f in ["fLhqLc1Zfa1vomoVNhwjalzo.jpg", "wjwqrOUY5j7XeCzEQHXDiOX9dE.png", "ZMWEi8bXq0UHyMgEUcSAtJsVRKg.jpg", "/brand/favicon-dark.png"]:
    rep(f, f + "?v=portrait")
rep("/_ext/", ASSET_PREFIX)

cfg = {"profile": {"name": "Htoo Myat Kyaw", "role": "Co-founder of Briefly (UI/UX, product design, strategy)",
                   "school": "Tufts University, Cognitive Brain Science + Computer Science", "contact_form_inbox": "htoo.m.kyaw645@gmail.com",
                   "public_email": "Htoo.Kyaw@tufts.edu", "source": "Replacement copy: Briefly only (Oct 10, 2026)"},
       "replacements": R}
json.dump(cfg, open("tools/rebrand.json", "w"), indent=2, ensure_ascii=False)
open("tools/rebrand.json", "a").write("\n")
print(len(R), "replacements")
