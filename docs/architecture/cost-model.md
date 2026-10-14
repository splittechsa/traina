# Cost model

No invoice and no cloud account are attached to this repository. Figures below are categories, not quotes.

| Category | Driver | Current spend |
| --- | --- | --- |
| API compute | Requests and always-on instances | None |
| PostgreSQL | Storage, IOPS, backups | None |
| Redis and workers | Queues and cache | None |
| Object storage and CDN | Exercise media and community uploads | None |
| Apple and Google fees | Configured per verified charge, not guessed in settlement | None |
| AI provider | Tokens per member, bounded by quotas that are not yet metered | None |
| SMS and email | Auth and support | None |
| Tax and invoicing | A reviewed policy, not this document | Not determined |

The commission engine is the control that keeps store fees and partner rates as data. It does not estimate a vendor bill.

AI cost is the item most likely to grow without a ceiling. Do not enable a model key until per-user quotas and a spend alert exist. The local tool quota is not that alert.
