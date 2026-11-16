---
title: Why Briefly stays audio
date: 2026-11-16
category: building-briefly
summary: Most tools that shorten podcasts turn them into text. We clip the real audio instead, and this is the reasoning behind that choice.
draft: true
---
When people hear that Briefly makes podcasts shorter, they usually assume it writes summaries. It doesn't. Briefly finds the few minutes of an episode that are worth hearing and plays them to you in the host's own voice.

That choice came early, and almost every later decision follows from it.

## A summary is a different thing

A written summary tells you what somebody said. A clip lets you hear them say it. The pause before an answer, the laugh, and the way a guest slows down when a topic matters to them are all part of what the conversation means, and none of it survives being rewritten.

There is also a question of trust. A summary asks you to believe that the tool understood the speaker correctly. With a clip there is nothing to take on faith, because you are listening to the original. If you want the full context, the whole episode is one tap away.

> We clip, we never rewrite.

## It fits when people actually listen

People listen to podcasts while they commute, cook, or drive. Their hands and eyes are busy. A summary you have to read asks for the one kind of attention they don't have in that moment.

Staying in audio means Briefly works in the places podcasts already live. It is also why CarPlay support mattered to us for launch, and why the touch targets in the app are large.

## What it cost us

Clipping is harder than summarizing. The system has to find a moment that makes sense on its own, cut it cleanly at the start and the end, and do that across thousands of shows. We built the pipeline so that all of the expensive work happens once, when an episode comes in. Nothing heavy runs while you scroll the feed, which is what keeps it fast.

[TODO: add one moment from early testing when you knew real audio was the right call.]

## What I'd tell another founder

Pick the one thing your product will not do, and say it out loud early. For us it was "we will not rewrite what people said." A line like that settles a lot of design debates before they start.

Briefly is on the iOS App Store now. If you try it, I'd love to hear which clip made you open the full episode.
