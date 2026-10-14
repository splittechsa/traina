# ADR 0005 — The model cannot choose the user or the SQL

## Status

Accepted for the tool boundary. No model is connected.

## Decision

Coach tool execution takes the user id from the authenticated actor and the data from a server-loaded snapshot. If the model arguments contain `userId`, `sql`, `query`, `statement`, or a role field, the call is rejected.

There is no tool that executes SQL. Unknown tools, including a diagnosis tool, are rejected.

## Consequences

Prompt text is not a security boundary. Authorization, schema checks, and the absence of a database tool are the boundary.
