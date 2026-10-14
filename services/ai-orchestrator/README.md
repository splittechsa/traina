# AI orchestrator

Not a running process. The tool boundary is `executeCoachTool` in `@sahhti/domain`.

A future process may call a model provider through an interface that can be swapped. It must pass the authenticated user and a server-loaded snapshot, keep the provider off the database, and record tool executions. No provider key is configured.
