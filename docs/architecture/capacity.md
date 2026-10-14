# Capacity planning

These figures are planning assumptions from the product brief. They are not measurements.

| Assumption | Value | Validated |
| --- | --- | --- |
| Registered accounts | 1,000,000 | No |
| Daily active users | 100,000 | No |
| Peak concurrent sessions | 10,000 | No |
| Peak API requests | 2,000 per second | No |
| Daily AI conversations | 50,000 | No |

`PLATFORM_CAPABILITIES.scale.validated` is false, and a test fails if that flag is turned on without evidence.

## What must be measured before any capacity claim

Load, stress, and soak tests of the API; database benchmarks of workout and food inserts; payment notification bursts; queue throughput; cache hit rate; failover; and a backup restore. A k6 sketch is in `tests/load`. It has not been run. k6 is not installed here.

## Early shape

Start with one API service and one PostgreSQL primary. Add a read replica only after query latency shows a read bottleneck. Partition only after a table's measured volume justifies it. Connection pools stay bounded.

AI cost is unbounded until per-user quotas, token budgets, and a provider meter exist. The in-memory tool quota is a local stand-in, not that meter.

Registered users are not concurrent users. The table above keeps them separate.
