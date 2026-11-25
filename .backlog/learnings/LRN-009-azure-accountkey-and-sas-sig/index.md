---
id: LRN-009
title: Azure AccountKey and SAS sig redaction: name rules run before opaque-id rules; anchor short names on [?&]
status: active
tags: [sanitizer, security, testing]
task: TSK-011
created: 2026-11-25
---

Secret-assignment redaction (redactSecretAssignments) runs before redactOpaqueIds, so adding a key name there (here account[_-]?key) captures the whole value including / + and = up to the next ; & , ) quote or space; the partial [REDACTED_ID] leak only happened because no name rule matched and the base64 rule cannot start after "=". Short names like the SAS "sig" must not go into otherName (its [A-Za-z0-9_-]* affixes would hit design=, signature=), so sig gets its own rule anchored on [?&]sig= in a query string.
