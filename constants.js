// Business values that used to be magic numbers spread over the controllers.
// They mirror the `roles` and `request_status` lookup tables.

const ROLE = Object.freeze({
  ADMIN: 1,
  USER: 2,
  RECYCLER: 3,
  MANAGER: 4,
  DEMOTED: 5, // a recycler a manager has deactivated
});

const STATUS = Object.freeze({
  AWAITS_RECYCLER: 1,
  AWAITS_APPROVAL: 2, // a recycler claimed it, the owner hasn't accepted yet
  COMPLETED: 3,
  CANCELED: 4,
  AWAITS_PICKUP: 5, // the owner accepted the recycler
});

const JOIN_STATUS = Object.freeze({
  OPEN: 1,
  DECLINED: 2,
  APPROVED: 3,
});

// Most bottles one request may be closed with. Stops a typo (or a forged request) from crediting millions.
const MAX_BOTTLES = 10000;

module.exports = { ROLE, STATUS, JOIN_STATUS, MAX_BOTTLES };
