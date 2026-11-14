const executeQuery = require("../dbHelper");
const { withTransaction } = require("../dbHelper");
const { ROLE, STATUS, MAX_BOTTLES } = require("../constants");
const { HttpError, asyncHandlers, toId, toInt } = require("../lib/http");

// The owner's requests (the :id in the URL is ignored: always the logged-in user's).
const getUserRequests = async (req, res) => {
  const data = await executeQuery("SELECT * FROM user_requests WHERE user_id = ?", [req.user.id]);
  return res.status(200).json(data);
};

// What the owner may do, as target status -> statuses it may come from.
const OWNER_TRANSITIONS = {
  [STATUS.AWAITS_PICKUP]: [STATUS.AWAITS_APPROVAL], // accept the recycler
  [STATUS.AWAITS_RECYCLER]: [STATUS.AWAITS_APPROVAL, STATUS.AWAITS_PICKUP], // decline the recycler
  [STATUS.CANCELED]: [STATUS.AWAITS_RECYCLER, STATUS.AWAITS_APPROVAL, STATUS.AWAITS_PICKUP],
  [STATUS.COMPLETED]: [STATUS.AWAITS_PICKUP], // bottles handed over
};

// The owner moves their request on. Completing it credits the bottles to the owner and the recycler.
const updateRequestStatus = async (req, res) => {
  const requestId = toId(req.params.id);
  const target = toInt(req.body && req.body.status);
  if (!requestId) throw new HttpError(404, "Request not found");
  if (!Object.prototype.hasOwnProperty.call(OWNER_TRANSITIONS, target)) {
    throw new HttpError(400, "Invalid status");
  }

  let bottles = null;
  if (target === STATUS.COMPLETED) {
    bottles = toInt(req.body.newBottlesNumber);
    if (bottles === null || bottles < 1 || bottles > MAX_BOTTLES) {
      throw new HttpError(400, `Bottles must be a whole number from 1 to ${MAX_BOTTLES}`);
    }
  }

  await withTransaction(async (conn) => {
    // FOR UPDATE: a double click can't complete (and credit) the same request twice.
    const [rows] = await conn.query(
      "SELECT user_id, recycler_id, status FROM user_requests WHERE request_id = ? FOR UPDATE",
      [requestId]
    );
    if (rows.length === 0) throw new HttpError(404, "Request not found");
    const request = rows[0];

    if (req.user.role !== ROLE.ADMIN && request.user_id !== req.user.id) {
      throw new HttpError(403, "You can update only your own requests");
    }
    if (!OWNER_TRANSITIONS[target].includes(request.status)) {
      throw new HttpError(409, "This change isn't possible in the request's current status");
    }

    if (target === STATUS.COMPLETED) {
      await conn.query(
        "UPDATE user_requests SET status = ?, type = 'completed', bottles_number = ?, completed_date = NOW() WHERE request_id = ?",
        [STATUS.COMPLETED, bottles, requestId]
      );
      await conn.query(
        "UPDATE users SET amount = COALESCE(amount, 0) + ? WHERE ID = ?",
        [bottles, request.user_id]
      );
      if (request.recycler_id) {
        await conn.query(
          "UPDATE users SET amount = COALESCE(amount, 0) + ? WHERE ID = ?",
          [bottles, request.recycler_id]
        );
      }
      return;
    }

    // Declining or canceling releases the recycler.
    const releasesRecycler = target === STATUS.AWAITS_RECYCLER || target === STATUS.CANCELED;
    const type = target === STATUS.AWAITS_RECYCLER ? "request" : "pending";
    await conn.query(
      "UPDATE user_requests SET status = ?, type = ?, recycler_id = ?, completed_date = NULL WHERE request_id = ?",
      [target, type, releasesRecycler ? null : request.recycler_id, requestId]
    );
  });

  return res.status(200).json({ message: "Request status updated successfully" });
};

module.exports = asyncHandlers({ getUserRequests, updateRequestStatus });
