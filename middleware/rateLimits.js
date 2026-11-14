// Rate limits for the endpoints that can be abused without logging in
// (password guessing, sign-up spam, mail flooding).
//
// Requests reach the API through the Cloudflare Tunnel, so the visitor's address is in the
// CF-Connecting-IP header (Cloudflare sets it and overwrites any value the client sends).
// Counters live in memory: fine for one container. RATE_LIMIT=off disables them (tests).

const { rateLimit, ipKeyGenerator } = require("express-rate-limit");

const clientIp = (req) => req.get("cf-connecting-ip") || req.ip || "unknown";

const limiter = ({ windowMinutes, limit }) =>
  rateLimit({
    windowMs: windowMinutes * 60 * 1000,
    limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    keyGenerator: (req) => ipKeyGenerator(clientIp(req)),
    skip: () => process.env.RATE_LIMIT === "off",
    message: { error: "Too many attempts. Please try again later." },
  });

module.exports = {
  // login, register, checkActivation
  authLimiter: limiter({ windowMinutes: 15, limit: 30 }),
  // forgotPassword
  passwordResetLimiter: limiter({ windowMinutes: 60, limit: 5 }),
  // public contact form
  contactLimiter: limiter({ windowMinutes: 60, limit: 5 }),
  // recycler / recycler-manager join requests
  joinLimiter: limiter({ windowMinutes: 60, limit: 5 }),
};
