---
title: The tour that talks like a text thread
date: 2026-11-12
category: cognitive-science
summary: Briefly's app tour speaks like an iMessage thread. Here is what I cut, what I added, and how watching people think aloud showed me which was which.
---
I study Cognitive and Brain Science alongside Computer Science, and I design a consumer app. The app tour in Briefly is the place where those two subjects meet most clearly. It speaks like a text thread. This post explains why, one decision at a time: what I cut, what I added, and how I check each choice by watching real people use it.

## Why a text thread

:::thread
> Everyone already knows how a text thread works.
> Grey bubbles arrive from the other side, one idea at a time.
< A blue bubble is what you said.
> Nobody has to be taught this.
< So that's the whole reason?
> Yes. A tutorial has two jobs: it has to be understood, and then it has to teach something.
> If you must first work out how the tutorial itself behaves, the first job eats the memory that the second job needs.
:::

Cognitive scientists call the alternative recognition over recall. A familiar form is understood on sight, with no effort to remember how it works.

The form also keeps every message short. A bubble holds one thought, and a thread has a steady rhythm of them. In the tour, the guide texts in grey and the person answers with a blue "Done" when they have tried the thing it asked for.

:::phones
/media/tour/first-version.jpg | The first texting-style version of the tour. The guide speaks in grey. The person's reply is the blue bubble.
:::

## What I cut, and what I added

The first version of the tour tried to do too much. Most of the work since has been removal, and each cut has a reason from the science of how people learn. Removal is half of the work. The other half is adding the few things that help a person act.

Try it yourself. The screen below is a sketch of the first tour, not the real app. Make each cut, then make each addition, and watch what changes.

:::lab
cut: steps | Eleven steps became seven. | A tour that tries to teach everything teaches nothing well. Working memory holds only a handful of chunks at a time, so each step has to be one chunk that a person can finish and keep.
cut: deco | Gradients, a glowing ring and a progress bar. | These were decoration. They did not help anyone act. Visual detail that does not help learning still costs mental effort, because it competes with the lesson for attention. Cognitive load theory calls this extraneous load, and the goal is to remove as much of it as possible.
cut: labels | "Skip tour" and a "Next" label. | One short word and a plain arrow say the same thing. Familiar symbols are recognised faster than words are read.
cut: house | "Swipe the sheet down" as a step. | The tour now closes the sheet itself. Housekeeping spends effort that belongs to the lesson, so the tour does the housekeeping.
cut: motion | Springs, loud ripples and a screen that blinks. | This cut was the hardest to see. At every step the dark layer behind the guide vanished and returned, and the speech bubble sprang down from the top of the screen, and it sometimes showed on the old tab before the new one had loaded. No single motion was a defect. Together they made the guide feel nervous. Movement pulls the eye without being asked, so every extra movement splits attention.
add: ghost | A ghost that demonstrates first. | The guide does a gesture once, and then the person does it. People learn an action faster when they watch it done first, which psychologists call observational learning, and then do it themselves.
add: ring | A coloured ring and a "Tap this show" label. | The ring marks the exact control to use. A visible signifier shows what can be acted on, so nobody has to guess.
add: contrast | Blue-purple bubbles and an "App tour" label with step dots. | The first grey bubbles blended into the screen, and people could not tell they were inside a tour. Things stand out when they contrast with their background, which is the principle of figure and ground. Knowing where you are in a process also lowers uncertainty, which is why the step dots earned their place back after the progress bar was cut.
add: reply | A "Nice!" or "Done" reply when someone acts. | The tour answers every action. Immediate feedback closes the loop, so the person knows what just happened and what comes next. A product feels trustworthy when it is predictable, and a reply to every action is the simplest way to be predictable.
:::

Two more additions are about order, so they don't show on a single screen.

**An early step for Share.** The most valuable action is taught first. The primacy effect says that what people meet first is remembered best.

**A separate step for hold-to-lock.** It had been the second line inside another step, and people missed it. One idea per message is the rule. Two ideas in one line overload working memory, and the second one is the one that gets dropped.

### The motion fix, in the real app

:::phones
/media/tour/before-after-1.jpg | Before and after, mid-step.
/media/tour/before-after-2.jpg | Left: the bubble is already on screen while the old tab is still fading out. Right: the new screen settles first, and the guide appears once it is ready.
:::

The fix was a single spotlight that stays on screen and glides from one target to the next, and a bubble that waits until it knows where its control is. Predictable movement lets a person anticipate what comes next instead of reacting to it.

:::phones
/media/tour/current-light.jpg | The current tour in light mode.
/media/tour/current-dark.jpg | And in dark. One spotlight, one bubble, one thing to do.
:::

## How I find out what is wrong

I do not trust my own eyes for this. I have seen these screens every day, and they have stopped being strange to me. So I watch someone else use them.

My method is simple. I sit beside a person while they use the app, and I ask them to think out loud. They say what they see, what they expect, and what confuses them. I do not answer their questions. I write each one down.

> The question itself is the finding.

That last rule is the hard one, and it is the most important. When a person asks a question out loud, the screen has failed to answer it. If I reply, I fix the problem for that one person and hide it from myself. The next person will not have me beside them.

The method comes from the think-aloud protocol that Ericsson and Simon described. Speaking while working turns what is in working memory into data: where a person looks, what they expect, and where they hesitate. It works best when people say what they think and do not explain it, because explaining changes how they think.

When the session ends, I do a debrief. I ask what they expected at each pause, while the session is still fresh. Their questions become a list. Across many sessions the same questions repeat, and the repeats show me what to fix first.

Then I change one thing, and I watch the next person.

## What the method gives me

The method gives me a way to learn about people and not only about the app. A person will rarely tell you a screen was wrong. They will blame themselves instead. But they will ask the screen a question out loud, and that question shows exactly where it failed. Watching quietly, and writing the questions down, is how I come to understand how people read what I design.

## Where to start

Pick one screen, and watch one person use it without helping them. Write down every question they ask. Then remove one thing.

---

### Reading behind this post

- Ericsson, K. A., & Simon, H. A. (1980). [Verbal reports as data](https://doi.org/10.1037/0033-295X.87.3.215). *Psychological Review*, 87(3), 215–251. The think-aloud protocol.
- Cowan, N. (2001). [The magical number 4 in short-term memory](https://pubmed.ncbi.nlm.nih.gov/11515286/). *Behavioral and Brain Sciences*, 24(1), 87–114. How few chunks working memory holds.
- Sweller, J. (1988). [Cognitive load during problem solving](https://doi.org/10.1207/s15516709cog1202_4). *Cognitive Science*, 12(2), 257–285. Extraneous load.
- Abrams, R. A., & Christ, S. E. (2003). [Motion onset captures attention](https://pubmed.ncbi.nlm.nih.gov/12930472/). *Psychological Science*, 14(5), 427–432.
- Nielsen, J. (1994). Ten usability heuristics, including recognition rather than recall.
- Bandura, A. (1977). *Social Learning Theory*. Observational learning.
- Murdock, B. B. (1962). The serial position effect of free recall. *Journal of Experimental Psychology*, 64(5), 482–488. The primacy effect.
- Norman, D. (2013). *The Design of Everyday Things*, revised edition. Signifiers and feedback.
