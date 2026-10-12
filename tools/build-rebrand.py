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
BLOG_CSS = (".framer-18htyvr{display:none!important}"
            ".framer-a06x9c::after{content:\"coming soon\";display:block;text-align:center;margin:24px 0 64px;"
            "font-family:'Just Me Again Down Here',cursive;font-size:44px;color:rgb(17,18,18)}")
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
rep("`EM`", "`HK`"); rep(">EM<", ">HK<")
rep("`PH`", "`BR`"); rep(">PH<", ">BR<")
rep("mailto:Hello@selenadesigns.com", "mailto:Htoo.Kyaw@tufts.edu")
# "download resume" on the nav avatar's hover card (rewritten to the email above).
rep("href:`mailto:Htoo.Kyaw@tufts.edu`,motionChild:!0,nodeId:`TZH86zigh`", "href:`/Htoo_Myat_Kyaw_Resume.pdf`,motionChild:!0,nodeId:`TZH86zigh`")
# Clicking that hover card downloads a file: the template's sample resume image.
rep("file:`/_ext/framerusercontent.com/assets/5D0eDc95VXdjgoSNI5fR7NpyX0k.jpg`,fileName:`Bejamin's Resume`",
    "file:`/Htoo_Myat_Kyaw_Resume.pdf`,fileName:`Htoo_Myat_Kyaw_Resume.pdf`")
rep("tel:+123456789", "https://briefly.briefa.net")

# Services hero intro shares its text with the footer; change it first.
FOOTER_OLD = "I'm most energized by projects where I can dig into complex problems, collaborate with smart people, and ship things that genuinely improve someone's day."
rep(FOOTER_OLD, "I wear a few hats at Briefly. Here's what I do, and how.", ["VIGVWIlQjzb1djAyRJmH49B9oW6pb13oxHnQJngdpOE"])
rep(FOOTER_OLD, "I wear a few hats at Briefly. Here's what I do, and how.", ["site/services.html"], split=True)
rep(FOOTER_OLD, "I'm most energized by making interacting with technology pain-free, and by people who care about the same thing. Podcasters, press, partners, researchers, neuroscientists, recruiters or fellow builders, I'd love to hear from you.")
rep("Open to contract work, full-time roles, and interesting conversations about hard design problems.", "Briefly is heading to the App Store. Say hello.")
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
rep("I'm Bejaman", "I'm Htoo", HOME)
rep("a product designer in Chicago who gets excited", "a co-founder in Boston who gets excited", HOME)
rep("about making complicated things simple", "about making podcasts easier to love", HOME)
rep("Interaction Design", "Product Interaction Design", HOME)
rep("This is a showcase of what happens when curiosity drives the process.", "Four chapters of building Briefly, from the first idea to the App Store.")

# ---------------------------------------------------------------- about
rep("a product designer in Chicago who gets excited", "a serial-entrepreneur, Questbridge Scholar at Tufts University, and a founder based in Boston who gets excited", ABOUT)
rep("about making complicated things simple", "about developing consumer facing technology", ABOUT)
rep("I spend my days designing for healthcare platforms, booking systems, and other products where 'just figure it out' isn't an option. The people using these tools are busy, stressed, and have actual work to do. My job is to get out of their way.",
    "I spend my days on one question: how do you give someone the best part of a podcast without taking away the voice? Briefly is a short-form, audio-only podcast platform. It pulls the best moments out of full episodes and serves them in a feed tuned to your interests, the way Instagram and TikTok learn what you like.")
rep("I've worked on teams of two and teams of twenty. I've had access to endless user research and I've had to make educated guesses with limited data. I've worked within strict component libraries and I've built design systems from scratch. What stays consistent is asking good questions, collaborating with people who know more than me, and shipping things that actually help",
    "Briefly is a team of three: me, a post-grad fellow formerly at Stanford HCI lab, and an engineer. I lead UI/UX, product design, and business strategy. We built the AI pipeline and recommendation engine together, and I direct coding agents and review their code, so I stay close to how an idea becomes a product.")
rep("Currently, I'm at Meridian Health working on experiences for mental health clinicians and administrators. Before that, I spent almost two years at StyleBook helping salons manage their businesses (and discovering that stylists have very strong opinions about scheduling interfaces, which I deeply respect). ",
    "I started Briefly in May 2026 while studying Cognitive Brain Science and Computer Science at Tufts. We're mentored through the Tufts Derby Center for Entrepreneurship by a founder with multiple tech exits. The iOS app is launched on the App Store in October 2026, and fully supports CarPlay. ")
rep("When I'm not designing, you'll find me thinking about why some interfaces feel intuitive and others make you want to throw your laptop out a window. Usually with coffee. ",
    "When I'm not working on Briefly, studying, I'm training Brazilian Jiu-Jitsu, cooking, spending time with family or friends, or practicing languages: English, Urdu, and Burmese (fluent), Chinese (intermediate), Turkish (beginner). ")
# principles
rep("Starting with why, not what", "Start with the listener")
rep("Before jumping into wireframes, I want to understand what problem we're actually solving. Sometimes the thing people ask for isn't the thing they need. My favorite projects start with good questions and end with solutions that feel obvious in hindsight.",
    "Before I design a screen, I want to know when and where someone is listening: commuting, cooking, or in the car. The context decides everything else.")
rep("think first, draw later.", "listen first, draw later.")
rep("Designing for real constraints", "Design for real constraints")
rep("Perfect conditions don't exist. Budgets are tight, timelines are aggressive, legacy systems are messy, and sometimes you just can't talk to users directly. I'm comfortable making smart decisions with imperfect information and finding creative solutions within real limitations.",
    "A student-founded team of three has limited time and finances. I'd rather make a few things very good than many things half good.")
rep("no perfect world here!", "small team, sharp focus.")
rep("Collaboration over hero design", "Build with the whole team")
rep("The best work happens when designers, engineers, and product folks are actually talking to each other—not throwing things over the wall. I genuinely enjoy the back-and-forth of figuring out what's possible, what's practical, and what's going to create the most value.",
    "The best work happens when design, engineering, and growth are in one conversation.")
rep("Making the invisible visible", "Make the invisible visible")
rep("Some of the most impactful design work isn't flashy—it's the progress indicator that keeps people oriented, the auto-save that prevents panic, the validation message that actually helps instead of just saying 'error.' These details build trust.",
    "A podcast brief is only useful if you trust it and if you trust us. Our ingestion pipeline incorporates the full contexts, picks up on small cues, and iterates on human trained data points, to build the trust in our users.")
# timeline (About only; the same names are case-study titles elsewhere)
TL = [
    ("Meridian Health", "Briefly Apps Inc.", "Sep 2025 - Current", "May 2026 - Present",
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
rep("available for Q4 projects ots", "live on the App Store")
rep("my services", "what i do")
CARDS = [("Product Design", "Product and UI/UX", "Designing digital products from the first idea to the final interface.", "Designing Briefly from first idea to final screen.", "framer-515de4"),
         ("web design", "Brand and Visual Identity", "Strong visual direction with thoughtful structure to create digital experiences that are as effective as they are memorable", "A dark, minimal look that keeps the voice in front.", "framer-10v42ac"),
         ("Design systems", "Content and Social", "Building flexible visual systems that make products easier to design, build, and scale.", "Daily Instagram carousels, captions, and video that build an audience before launch.", "framer-1b8ygq1"),
         ("Creative direction", "Build and Strategy", "Building flexible visual systems that make products easier to design, build, and scale.", "Working with coding agents, shipping in React Native, and shaping the business side.", "framer-bbkleu")]
for oh, nh, od, nd, cls in CARDS:
    rep(oh, nh, SERVICES, near={"Product Design": "framer-g58dri", "web design": "framer-1igbjtj", "Design systems": "framer-g4c9lv", "Creative direction": "framer-1zotpg"}[oh])
    rep(oh, nh, ["site/services.html"], split=True)
    rep(od, nd, SERVICES, near=cls)
TAGS = {  # container -> new tag, in card order
    "framer-h4g844-container": "UI/UX", "framer-183rdj3-container": "User Flows", "framer-yc6h9r-container": "Prototyping",
    "framer-g0c05d-container": "Interaction Design", "framer-1lueen2-container": "Mobile",
    "framer-o4mpja-container": "Visual Identity", "framer-zho5e9-container": "Color", "framer-1mejb2k-container": "Typography",
    "framer-vpkjn5-container": "Art Direction", "framer-1slb844-container": "Brand Voice",
    "framer-1tlax7p-container": "Carousels", "framer-toxuni-container": "Captions", "framer-1ad3zi6-container": "Short-form Video",
    "framer-mq8bwj-container": "English and Arabic", "framer-1rdpkrn-container": "Content Calendar",
    "framer-49eqph-container": "Product Strategy", "framer-n6gm6d-container": "Business Strategy", "framer-1kbjuiu-container": "React Native and Expo",
    "framer-1ipfo84-container": "Agentic Coding", "framer-15adn40-container": "AI Pipeline",
}
# Read the template text from the unmodified mirror, not the rebranded site/.
import subprocess
MIRROR = "1d2ecb4"
vt = subprocess.run(["git", "show", f"{MIRROR}:" + glob.glob(SITE + "VIGV*.mjs")[0]], capture_output=True, text=True, check=True).stdout
for cont, new in TAGS.items():
    old = re.search(r"className:`" + cont + r"`,nodeId:`\w+`,scopeId:`\w+`,children:d\(q,\{a_X5HpvjX:`([^`]*)`", vt).group(1)
    rep(old, new, SERVICES, near=cont, findHtml=old.replace("&", "&amp;"))
STEPS = [("First, I get familiar with the problem, the people, and the bigger picture.", "First, I get to know the listener, the show, and the moment they press play."),
         ("I translate what I learn into a clear direction, structure, and set of priorities.", "I turn that into one clear direction and a short list of priorities."),
         ("Then I explore, iterate, and refine until the right solution starts to take shape.", "Then I explore, test, and refine until it feels right."),
         ("Finally, I bring everything together into a polished, flexible system ready to ship.", "Finally, I ship it and watch how people actually use it.")]
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
FAQ = [("Does Bejaman design websites, or only digital products?", "What is Briefly?"),
       ("Both. Alongside app/dashboard product design, Bejaman also designs websites and landing pages with a storytelling approach, not just visuals.",
        "A short-form, audio-only podcast platform. It gives you the best parts of episodes as audio, plus recommendations, in a feed tuned to your interests."),
       ("Does he build Design Systems, or just individual screens?", "What does Htoo do there?"),
       ("Yes. Especially for multi stakeholder enterprise work like North Light, where a shared design language and reusable components are key to scaling the product.",
        "He co-founded it and leads UI/UX, product design, and business strategy, and he co-built the AI pipeline and recommendation engine."),
       ("What does the Product Design process look like?", "When can I get it?"),
       ("Four pillars: User Research to find the real problem, Interaction Design to shape the flow, Prototyping to test ideas fast, and Motion Design to polish the experience. Meridian Health and StyleBook are good examples of this in action.",
        "Now. Briefly launched on the iOS App Store in October 2026 and works with CarPlay. More at briefly.briefa.net."),
       ("What does Creative Direction mean here?", "Is Briefly for podcasters or listeners?"),
       ("It's guiding the overall visual identity, tone, and experience across a project, making sure every design decision (color, motion, storytelling) stays consistent and serves the client's business goals.",
        "Both. Listeners get the best moments quickly, and podcasters get their voice heard by more people.")]
for o, n in FAQ: rep(o, n)

# ---------------------------------------------------------------- case-study cards (HTML side; CMS edited by cms-edit.mjs)
rep("dateStyle:`medium`,timeZone:`UTC`", "year:`numeric`,timeZone:`UTC`", DATE_MODULES)
for o in ["Mar 19, 2026", "Mar 2, 2026", "Jan 2, 2025"]: rep(f">{o}<", ">2026<", CARDS_HTML)
CARD_TEXT = [("Meridian Health", "Briefly: All Things Podcasts"), ("StyleBook", "The Briefly Look"), ("Homestead", "Seven Slides a Day"), ("North Light", "Under the Hood"),
             ("When therapists spend less time clicking, they have more time for patients.", "Podcasts briefs that stay audio."),
             ("From 'I hate this system' to 'Can we show other salons?", "Dark, minimal, and quiet enough to let the voice lead."),
             ("Helping first-time homebuyers actually understand what they're looking at.", "How a small team builds an audience on Instagram, one carousel at a time."),
             ("Getting seven stakeholders to agree on what they're actually building.", "The AI pipeline and recommendation engine behind the highlights.")]
for o, n in CARD_TEXT: rep(o, n, CARDS_HTML + ["searchIndex"])
for o, n in [("Healthcare", "Product"), ("Workflow Design", "Audio"), ("SaaS", "Brand"), ("Transformation", "UI/UX"), ("Proptech", "Content"), ("0 -&gt; 1", "Growth"), ("Strategy", "Engineering"), ("Enterprise", "AI"), ("Product Designer", "Co-founder")]:
    rep(f">{o}<", f">{n}<", CARDS_HTML)

# The page's embedded "handover" data (what the client hydrates from) holds the
# same CMS values as quoted JSON strings.
for o in ["2026-03-19T00:00:00.000Z", "2026-03-02T00:00:00.000Z", "2025-01-02T00:00:00.000Z"]:
    rep(f'"{o}"', '"2026-05-01T00:00:00.000Z"', CARDS_HTML)
for o, n in [("Healthcare", "Product"), ("Workflow Design", "Audio"), ("SaaS", "Brand"), ("Transformation", "UI/UX"), ("Proptech", "Content"), ("0 -> 1", "Growth"), ("Strategy", "Engineering"), ("Enterprise", "AI")]:
    rep(f'"{o}"', f'"{n}"', CARDS_HTML)

# ---------------------------------------------------------------- playground
for o, n in [("nothing big, still feels nice", "Picture Before Getting Promoted"), ("Brain’s messy, but it’s okay", "Tabling to Cure Bone Cancer"), 
             ("Good weather", "Thank You!"), ("Random shot", "random shot"), ("Tiny moments", "First Time Training with a Former UFC Fighter"),
             ("Not sure what I’m doing", "Muslims in Business Conference"), ("bus bus bus", "on the green line, thinking"), ("flower!", "First Day Working in the OR at 17")]:
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

# ---------------------------------------------------------------- site script
# Case study, Services and Journal aren't published yet (the Worker redirects
# them home). Links to them stay visible but show a "Coming soon" note instead
# of navigating; a capture listener runs before Framer's router sees the click.
# Published write-ups (LIVE) open their standalone page instead; card 1
# (Briefly) opens the product site and its button reads "View Product".
# In the nav, "HK" copies the email address and "BR" opens Briefly.
# Backstop: if the page router still tries to show one of those routes (for a
# tap that slipped past the click handler), load the real destination instead
# of rendering the template page client-side.
SITE_JS = r"""(()=>{
const SOON=/^\/(case-study|services|blog)(\/|$)/;
const LIVE={"/case-study/north-light":"/under-the-hood","/case-study/stylebook":"/the-briefly-look","/case-study/homestead":"/seven-slides-a-day","/case-study/meridian-health":"https://briefly.briefa.net"};
const EMAIL="htoomyatk645@gmail.com",BRIEFLY="https://briefly.briefa.net";
let el,t;
const note=m=>{if(!el){el=document.createElement("div");el.id="coming-soon";el.setAttribute("role","status");document.body.appendChild(el)}el.textContent=m;el.classList.add("on");clearTimeout(t);t=setTimeout(()=>el.classList.remove("on"),1800)};
const copy=v=>(navigator.clipboard?navigator.clipboard.writeText(v):Promise.reject()).catch(()=>{const a=document.createElement("textarea");a.value=v;a.style.position="fixed";a.style.opacity="0";document.body.appendChild(a);a.select();try{document.execCommand("copy")}finally{a.remove()}});
const open=to=>/^https?:/.test(to)?window.open(to,"_blank","noopener"):location.href=to;
const target=u=>{const p=u.pathname.replace(/\/$/,"");return LIVE[p]||null};
const guard=f=>function(st,ti,url){if(url!=null){const u=new URL(url,location.href);if(u.origin===location.origin&&SOON.test(u.pathname)){location.assign(target(u)||location.href);return}}return f.apply(this,arguments)};
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
  note(u.pathname.startsWith("/blog")?"Journal: coming soon":u.pathname.startsWith("/services")?"Services: coming soon":"Case studies: coming soon");
},true);
const relabel=()=>document.querySelectorAll('a[href$="case-study/meridian-health"]').forEach(a=>{const w=document.createTreeWalker(a,4);for(let n;n=w.nextNode();)if(n.nodeValue.trim()==="View Project")n.nodeValue=n.nodeValue.replace("View Project","View Product")});
addEventListener("load",()=>setTimeout(()=>{relabel();new MutationObserver(relabel).observe(document.body,{subtree:true,childList:true,characterData:true})},300));
})()"""
SITE_CSS = ("#coming-soon{position:fixed;left:50%;bottom:32px;transform:translate(-50%,20px);opacity:0;pointer-events:none;z-index:2147483647;"
            "background:#111212;color:#fff;font:500 14px/1 Inter,system-ui,sans-serif;letter-spacing:.02em;padding:12px 18px;border-radius:999px;"
            "transition:opacity .2s,transform .2s}#coming-soon.on{opacity:1;transform:translate(-50%,0)}"
            ".framer-119y192-container,.framer-1yzdk2p-container{cursor:pointer}")
SITE_SCRIPT = "<style>" + SITE_CSS + "</style><script>" + "".join(l.strip() for l in SITE_JS.splitlines()) + "</script>"
# Anchor on Framer's bodyEnd marker so standalone pages in site/ are left alone.
rep("<!-- End of bodyEnd -->", "<!-- End of bodyEnd -->" + SITE_SCRIPT, [".html"])

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
