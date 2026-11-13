---
id: LRN-005
title: redis-cli short-flag redaction must be scoped to -a because -p is the port
status: active
tags: [sanitizer, security, testing]
task: TSK-005
created: 2026-11-13
---

Short password flags are command-specific: docker login and sshpass use -p, but redis-cli uses -a and its -p is the port number. A generic "-p value" rule would redact ports (redis-cli -p 6379, docker run -p 8080:80) and mkdir -p paths. Keep each short-flag rule scoped to its command name, as the mysql -p rule is.

Also: local installs need NODE_ENV unset/development (this machine exports NODE_ENV=production, which skips devDependencies) and Node 22.18+/24.11+/26+ — Node 25 fails engine-strict on tsup. Use ~/.nvm/versions/node/v24.22.0/bin.
