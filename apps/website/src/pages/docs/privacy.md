---
layout: ../../layouts/Doc.astro
title: Privacy & data
description: What WhisperFlow stores, what leaves your machine (nothing, by default), and the local-only lock.
---

## The short version

By default, **nothing leaves your machine**. Not your audio, not your transcripts, not
usage stats — there is no telemetry code in WhisperFlow at all.

## What's stored locally

| Data              | Location                          | Retention                     |
| ----------------- | --------------------------------- | ----------------------------- |
| Settings          | `config.json`                     | Until you change them         |
| Dictation history | `history.db` (SQLite, local)      | Until you delete it           |
| Downloaded models | `models/`                         | Until you delete them         |
| Logs              | `logs/` (rotating, local)         | 7 days                        |

History can be disabled entirely in Settings → Privacy, and everything is cleared with one
button.

## Local-only lock

Settings → Privacy includes a **local-only** switch. When enabled, the provider layer
physically refuses to construct a network client — even if a remote endpoint is configured.
It's the strongest guarantee the app can make, and it's on by default.

## If you opt into a remote endpoint

Configuring a BYO OpenAI-compatible endpoint means transcript text is sent to that endpoint
for polishing (never raw audio — audio is always transcribed locally). The endpoint's own
privacy policy then applies. The local-only lock overrides this entirely.

## Source-level verification

WhisperFlow is Apache-2.0 open source. Every claim above is checkable in the repository —
audit the engine, build it yourself, or run it behind a firewall and watch it keep working.

## Not affiliated

WhisperFlow is an independent project, not affiliated with Wispr Inc., OpenAI, Meta, or the
Qwen team. Open models are used under their respective licenses.
