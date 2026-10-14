# System architecture

```text
iOS (SwiftUI)          Android (Compose)         Admin / gym / support web
        \                      |                          /
         \                     |                         /
          +----------- HTTPS /v1 API (Fastify) ---------+
                              |
              +---------------+----------------+
              |               |                |
        packages/domain   PostgreSQL        Redis / queue
        (pure rules)      (system of        (not deployed)
                          record, not
                          yet applied)
                              |
                    workers (not built)
                    model provider (not connected)
                    App Store / Play verifiers (not connected)
```

The domain package is the authority for calculations. The API adapts HTTP onto it. PostgreSQL will persist the results once a database is operated. The model, if added later, may propose text and tool calls. It may not post a ledger line, approve a rule, or select another user's id.

See the ADRs in `docs/adr` and the technology matrix in `technology-matrix.md`.
