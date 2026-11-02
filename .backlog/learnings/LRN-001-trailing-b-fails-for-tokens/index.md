---
id: LRN-001
title: Trailing \b fails for tokens that can end in '-'
status: active
tags: [regex, sanitizer, redaction]
task: TSK-001
created: 2026-11-02
---

A regex ending in \b after a character class that includes '-' silently fails when the match ends in '-' and the next char is a non-word char (space, quote, end of string): there is no word boundary between two non-word characters. Use a negative lookahead on the same class, e.g. (?![0-9A-Za-z_-]). In hyntx the leaked key was then partially caught by the generic ID redaction, producing '[REDACTED_ID]-' instead of '[REDACTED_GOOGLE_KEY]', which hides the bug in loose tests: assert on the specific placeholder.
