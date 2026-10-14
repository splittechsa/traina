# Load tests

Not executed. k6 is not installed in this workspace, and the API is not a capacity environment.

`health.k6.js` only calls liveness. A passing liveness loop would not validate 2,000 requests per second, the database, or AI concurrency. Do not record a result here until a run stores its summary next to this file and `PLATFORM_CAPABILITIES.scale.validated` stays false unless that evidence is real.
