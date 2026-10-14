# Entity relationship diagram

The migration is the source of the columns. This diagram is the relationship map. It has not been applied to a server.

```mermaid
erDiagram
  users ||--|| user_profiles : has
  users ||--o{ onboarding_snapshots : versions
  users ||--o{ user_goals : sets
  users ||--o{ workout_sessions : performs
  workout_sessions ||--o{ workout_sets : logs
  exercises ||--o{ workout_sets : referenced_by
  users ||--o{ food_entries : logs
  food_sources ||--o{ food_items : publishes
  coaching_methodologies ||--o{ coaching_rules : contains
  coaching_rules ||--o{ coaching_rule_versions : versions
  coaching_rule_versions ||--o{ coaching_rule_approvals : decided_by
  users ||--o{ subscriptions : holds
  subscriptions ||--o{ subscription_events : receives
  gym_organizations ||--o{ gym_branches : operates
  gym_organizations ||--o{ gym_contracts : signs
  gym_contracts ||--o{ gym_referral_codes : issues
  users ||--o| gym_attributions : locked_to
  gym_organizations ||--o{ financial_ledger_entries : credited
  payment_events ||--o{ financial_ledger_entries : posts
  users ||--o{ posts : writes
  users ||--o{ support_tickets : opens
  users ||--o{ audit_logs : acts
```

`financial_ledger_entries` and `audit_logs` reject updates and deletes with a trigger. `commission_ledger` is a view of gym commission lines and rejects writes.
