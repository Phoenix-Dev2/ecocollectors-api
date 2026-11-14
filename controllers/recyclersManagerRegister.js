const { asyncHandlers } = require("../lib/http");
const { createJoinRequest } = require("../lib/joinSignUp");

const signUp = async (req, res) => {
  await createJoinRequest("recyclers_manager_join_requests", req);
  return res.status(200).json("Request has been sent");
};

module.exports = asyncHandlers({ signUp });
