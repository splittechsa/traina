# AI coaching architecture

```text
member message
  -> authentication
  -> authorization
  -> trusted snapshot loaded by the server
  -> approved coaching rules
  -> tool call with model arguments
  -> reject if the model sets user id, role, or SQL
  -> domain calculation
  -> response marked persisted or not
  -> audit when a store exists
```

Implemented today: the tool list, the argument rejection, the quota, and reads against a snapshot the caller supplies. `executeCoachTool` always returns `persisted: false`.

Not implemented: a model provider, token accounting against a vendor, conversation persistence, and an evaluation run against a live model.

Proposals to change a program or a nutrition target return `not_applied`. Memory writes return `memory_store_not_configured`.

There is no path from the model to `financial_ledger_entries`.
