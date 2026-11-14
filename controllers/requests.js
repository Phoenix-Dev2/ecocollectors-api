const executeQuery = require("../dbHelper");
const { ROLE, STATUS, MAX_BOTTLES } = require("../constants");
const { HttpError, asyncHandlers, toId, toInt } = require("../lib/http");

const DETAIL_COLUMNS =
  "request_id, user_id, full_name, req_lat, req_lng, req_address, phone_number, bottles_number, from_hour, to_hour, recycler_id, request_date, completed_date, status, type";

// The map is public: no names, phone numbers or user ids. user_id is selected only to work out
// is_mine, and stays on the caller's own rows so the current client can still spot them.
const PUBLIC_COLUMNS =
  "request_id, user_id, req_lat, req_lng, req_address, bottles_number, from_hour, to_hour, request_date, status, type";

const findRequest = async (requestId) => {
  const id = toId(requestId);
  if (!id) throw new HttpError(404, "Request not found");
  const rows = await executeQuery(
    `SELECT ${DETAIL_COLUMNS} FROM user_requests WHERE request_id = ?`,
    [id]
  );
  if (rows.length === 0) throw new HttpError(404, "Request not found");
  return rows[0];
};

// The request without recycler_id, like the old responses.
const withoutRecycler = ({ recycler_id, ...rest }) => rest;

// Open requests (status 1 or 2) for the public map.
const getRequests = async (req, res) => {
  const rows = await executeQuery(
    `SELECT ${PUBLIC_COLUMNS} FROM user_requests WHERE status IN (?, ?)`,
    [STATUS.AWAITS_RECYCLER, STATUS.AWAITS_APPROVAL]
  );
  const me = req.user ? req.user.id : null;
  const data = rows.map(({ user_id, ...row }) =>
    me !== null && user_id === me
      ? { ...row, user_id, is_mine: true }
      : { ...row, is_mine: false }
  );
  return res.status(200).json(data);
};

// One request with its contact details: for its owner, the recycler handling it, admins and managers.
const getRequest = async (req, res) => {
  const request = await findRequest(req.params.id);
  const { id, role } = req.user;
  const allowed =
    request.user_id === id ||
    request.recycler_id === id ||
    role === ROLE.ADMIN ||
    role === ROLE.MANAGER;
  if (!allowed) throw new HttpError(403, "You can view only your own requests");
  return res.status(200).json(withoutRecycler(request));
};

// The "Collect" page. Recyclers may see an open request, or one they handle.
const getRequestForRecycle = async (req, res) => {
  const request = await findRequest(req.params.id);
  const { id, role } = req.user;
  if (
    role === ROLE.RECYCLER &&
    request.status !== STATUS.AWAITS_RECYCLER &&
    request.recycler_id !== id
  ) {
    throw new HttpError(403, "This request is handled by another recycler");
  }
  return res.status(200).json(withoutRecycler(request));
};

// Add a new request
const addRequest = async (req, res) => {
  const query = `
    INSERT INTO user_requests (user_id, full_name, req_lat, req_lng, req_address, phone_number, bottles_number, from_hour, to_hour, request_date, status, type)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const values = [
    req.user.id,
    req.body.fullName,
    req.body.reqLat,
    req.body.reqLng,
    req.body.reqAddress,
    req.body.phoneNumber,
    req.body.bottlesNumber,
    req.body.fromTime,
    req.body.toTime,
    req.body.reqDate,
    STATUS.AWAITS_RECYCLER,
    "request",
  ];

  await executeQuery(query, values);
  return res.status(200).json("Request has been created");
};

// Delete a request (owner only)
const deleteRequest = async (req, res) => {
  const result = await executeQuery(
    "DELETE FROM user_requests WHERE request_id = ? AND user_id = ?",
    [toId(req.params.id), req.user.id]
  );

  if (result.affectedRows === 0) {
    return res.status(403).json("You can delete only your requests!");
  }

  return res.json("Request has been deleted!");
};

// A recycler claims an open request. Atomic: of two recyclers clicking at once, one wins.
const updateRequestType = async (req, res) => {
  const requestId = toId(req.params.id);
  const me = req.user.id;

  const result = await executeQuery(
    `UPDATE user_requests
     SET recycler_id = ?, status = ?, type = 'pending'
     WHERE request_id = ? AND status = ? AND (user_id IS NULL OR user_id <> ?)`,
    [me, STATUS.AWAITS_APPROVAL, requestId, STATUS.AWAITS_RECYCLER, me]
  );

  if (result.affectedRows === 0) {
    const request = await findRequest(requestId);
    if (request.user_id === me) throw new HttpError(403, "You can't collect your own request");
    throw new HttpError(409, "This request is no longer waiting for a recycler");
  }
  return res.json("Request has been updated.");
};

// Fields the owner may change, with their checks. Anything else in the body is ignored
// (the client sends the whole row back, including status, user_id, etc.).
const text = (max) => (value) => {
  if (typeof value !== "string" && typeof value !== "number") return undefined;
  const s = String(value).trim();
  return s.length >= 1 && s.length <= max ? s : undefined;
};
const time = (value) =>
  typeof value === "string" && /^\d{1,2}:\d{2}(:\d{2})?$/.test(value.trim())
    ? value.trim()
    : undefined;
const coordinate = (limit) => (value) => {
  const n = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  return typeof n === "number" && Number.isFinite(n) && Math.abs(n) <= limit ? n : undefined;
};
const bottles = (value) => {
  const n = toInt(value);
  return n !== null && n >= 1 && n <= MAX_BOTTLES ? n : undefined;
};

const EDITABLE_FIELDS = {
  full_name: { check: text(55), message: "Full name must be 1-55 characters" },
  req_address: { check: text(55), message: "Address must be 1-55 characters" },
  phone_number: { check: text(55), message: "Phone number must be 1-55 characters" },
  bottles_number: { check: bottles, message: `Bottles must be a whole number from 1 to ${MAX_BOTTLES}` },
  from_hour: { check: time, message: "From hour must look like HH:MM" },
  to_hour: { check: time, message: "To hour must look like HH:MM" },
  req_lat: { check: coordinate(90), message: "Latitude is invalid" },
  req_lng: { check: coordinate(180), message: "Longitude is invalid" },
};

// The owner (or an admin) edits a request that is still waiting for a recycler.
const updateRequestByUser = async (req, res) => {
  const request = await findRequest(req.params.id);
  const { id, role } = req.user;

  if (role !== ROLE.ADMIN && request.user_id !== id) {
    throw new HttpError(403, "You are not authorized to update this request.");
  }

  const body = req.body && typeof req.body === "object" ? req.body : {};
  const columns = [];
  const values = [];
  for (const [column, { check, message }] of Object.entries(EDITABLE_FIELDS)) {
    if (!Object.prototype.hasOwnProperty.call(body, column)) continue;
    const value = check(body[column]);
    if (value === undefined) throw new HttpError(400, message);
    columns.push(`\`${column}\` = ?`);
    values.push(value);
  }
  if (columns.length === 0) throw new HttpError(400, "Nothing to update");

  const result = await executeQuery(
    `UPDATE user_requests SET ${columns.join(", ")}, request_date = NOW()
     WHERE request_id = ? AND status = ?`,
    [...values, request.request_id, STATUS.AWAITS_RECYCLER]
  );
  if (result.affectedRows === 0) {
    throw new HttpError(409, "Only requests that are waiting for a recycler can be edited");
  }
  return res.json("Request has been updated by user.");
};

module.exports = asyncHandlers({
  getRequests,
  getRequestForRecycle,
  getRequest,
  addRequest,
  deleteRequest,
  updateRequestType,
  updateRequestByUser,
});
