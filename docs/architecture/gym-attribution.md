# Gym attribution

A referral code belongs to one branch, one organization, and one contract.

`resolveAttribution` returns the existing row when a user already has one, even if the new code is invalid or points at another gym. That is the first-touch lock. A new attribution is created only when the code is active, unexpired, and the contract is active and matches the code.

`attributionCoversPurchase` is true from the attribution time through the contract's window in whole days. The window must be at least one day. Contract validation in the schema limits it to 3650 days.

QR assets, deep links, and the partner portal are not built. The resolution function is deterministic and tested.
