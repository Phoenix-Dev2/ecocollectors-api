const executeQuery = require("../dbHelper");
const { ROLE } = require("../constants");
const { HttpError, asyncHandlers, toId } = require("../lib/http");

// Name and phone of the recycler handling one of the caller's requests.
const getRecyclerDetails = async (req, res) => {
  const recyclerId = toId(req.params.id);
  // The client also asks for requests without a recycler (".../null"): nothing to show.
  if (!recyclerId) return res.status(200).json([]);

  const { id, role } = req.user;
  let allowed = recyclerId === id || role === ROLE.ADMIN || role === ROLE.MANAGER;
  if (!allowed) {
    const rows = await executeQuery(
      "SELECT 1 FROM user_requests WHERE user_id = ? AND recycler_id = ? LIMIT 1",
      [id, recyclerId]
    );
    allowed = rows.length > 0;
  }
  if (!allowed) throw new HttpError(403, "You can see only the recyclers of your own requests");

  const data = await executeQuery(
    "SELECT first_name, last_name, phone FROM users WHERE ID = ?",
    [recyclerId]
  );
  return res.status(200).json(data);
};

module.exports = asyncHandlers({ getRecyclerDetails });
