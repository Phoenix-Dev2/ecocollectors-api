// Authentication, login/register, account endpoints, rate limits and error handling.
const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const h = require("./helpers");

let ctx;
let api;
before(async () => {
  ctx = await h.startApp();
  api = ctx.api;
});
after(() => h.stopApp());

describe("requireAuth (B1, S9, Q1)", () => {
  it("401 without a token", async () => {
    const res = await api().get("/user/info");
    assert.equal(res.status, 401);
    assert.equal(res.body, "Not authenticated");
  });

  it("401, not 500, for an expired token", async () => {
    const user = await h.createUser(ctx.db);
    const res = await api().get("/user/info").set(h.bearer(user, { expiresIn: -10 }));
    assert.equal(res.status, 401);
    assert.equal(res.body, "Invalid or expired token");
  });

  it("401 for a token signed with another secret (a forged admin)", async () => {
    const user = await h.createUser(ctx.db);
    const forged = h.bearer(user, { secret: "x".repeat(64), role: 1 });
    assert.equal((await api().get("/admin/users").set(forged)).status, 401);
  });

  it("accepts the Bearer header", async () => {
    const user = await h.createUser(ctx.db);
    const res = await api().get("/user/info").set(h.bearer(user));
    assert.equal(res.status, 200);
    assert.equal(res.body.ID, user.id);
  });

  it("still accepts the access_token cookie (transition)", async () => {
    const user = await h.createUser(ctx.db);
    const res = await api().get("/user/info").set("Cookie", `access_token=${h.tokenFor(user)}`);
    assert.equal(res.status, 200);
  });

  it("falls back to the cookie when the header token is stale", async () => {
    const user = await h.createUser(ctx.db);
    const res = await api()
      .get("/user/info")
      .set(h.bearer(user, { expiresIn: -10 }))
      .set("Cookie", `access_token=${h.tokenFor(user)}`);
    assert.equal(res.status, 200);
  });

  it("ignores 'Bearer null' from a logged-out client", async () => {
    const res = await api().get("/user/info").set("Authorization", "Bearer null");
    assert.equal(res.status, 401);
    assert.equal(res.body, "Not authenticated");
  });

  it("a deactivated user's token stops working at once", async () => {
    const user = await h.createUser(ctx.db, { active: 0 });
    const res = await api().get("/user/info").set(h.bearer(user));
    assert.equal(res.status, 401);
    assert.equal(res.body, "Account is inactive");
  });

  it("the role comes from the database, not the token", async () => {
    // token still says admin, but the account has been demoted to a normal user
    const user = await h.createUser(ctx.db, { role: 2 });
    const res = await api().get("/admin/users").set(h.bearer(user, { role: 1 }));
    assert.equal(res.status, 403);
    const role = await api().get("/user/role").set(h.bearer(user, { role: 1 }));
    assert.deepEqual(role.body, { role: 2 });
  });
});

describe("login and register (S12)", () => {
  it("logs in with a differently-cased e-mail and never returns the password hash", async () => {
    const user = await h.createUser(ctx.db, { email: "Mixed.Case@Example.test" });
    const res = await api()
      .post("/auth/login")
      .send({ email: "  mixed.case@example.TEST ", password: h.PASSWORD });
    assert.equal(res.status, 200);
    assert.equal(res.body.ID, user.id);
    assert.ok(res.body.token);
    assert.equal(res.body.password, undefined);
    assert.equal(res.body.active, undefined);
    assert.match(String(res.headers["set-cookie"]), /access_token=.*HttpOnly/);
  });

  it("the token from login works as Bearer", async () => {
    const user = await h.createUser(ctx.db);
    const login = await api().post("/auth/login").send({ email: user.email, password: h.PASSWORD });
    const res = await api().get("/user/info").set("Authorization", `Bearer ${login.body.token}`);
    assert.equal(res.status, 200);
  });

  it("same answer for an unknown e-mail and a wrong password", async () => {
    const user = await h.createUser(ctx.db);
    const wrongPassword = await api().post("/auth/login").send({ email: user.email, password: "nope" });
    const unknown = await api().post("/auth/login").send({ email: "nobody@example.test", password: "nope" });
    assert.equal(wrongPassword.status, 401);
    assert.equal(unknown.status, 401);
    assert.deepEqual(wrongPassword.body, unknown.body);
  });

  it("an inactive account is reported only after the right password", async () => {
    const user = await h.createUser(ctx.db, { active: 0 });
    const wrong = await api().post("/auth/login").send({ email: user.email, password: "nope" });
    assert.deepEqual(wrong.body, { error: "Wrong email or password" });
    const right = await api().post("/auth/login").send({ email: user.email, password: h.PASSWORD });
    assert.equal(right.status, 401);
    assert.deepEqual(right.body, { error: "Account is inactive. Login is not permitted." });
  });

  it("401, not 500, without a password", async () => {
    const res = await api().post("/auth/login").send({ email: "a@example.test" });
    assert.equal(res.status, 401);
  });

  it("register stores the e-mail lower-case and refuses a case-variant duplicate", async () => {
    const body = {
      first_name: "New",
      last_name: "User",
      email: "  Fresh.User@Example.test",
      password: "pw-123456",
      city: "Haifa",
      address: "Herzl 2",
      phone: "0501111111",
    };
    assert.equal((await api().post("/auth/register").send(body)).status, 200);
    const [rows] = await ctx.db.query("SELECT email, role FROM users WHERE email = 'fresh.user@example.test'");
    assert.equal(rows.length, 1);
    assert.equal(rows[0].role, 2);
    const again = await api().post("/auth/register").send({ ...body, email: "FRESH.USER@example.test" });
    assert.equal(again.status, 400);
  });

  it("register can't choose its own role", async () => {
    await api().post("/auth/register").send({
      first_name: "Sneaky", last_name: "Admin", email: "sneaky@example.test", password: "pw-123456",
      city: "Haifa", address: "Herzl 3", phone: "0502222222", role: 1,
    });
    const [rows] = await ctx.db.query("SELECT role FROM users WHERE email = 'sneaky@example.test'");
    assert.equal(rows[0].role, 2);
  });
});

describe("account endpoints (S11)", () => {
  it("/user/info has no password hash", async () => {
    const user = await h.createUser(ctx.db);
    const res = await api().get("/user/info").set(h.bearer(user));
    assert.equal(res.status, 200);
    assert.equal(res.body.password, undefined);
    assert.equal(res.body.email, user.email);
  });

  it("/user/update with missing fields keeps the current values (B4)", async () => {
    const user = await h.createUser(ctx.db, { first_name: "Keep" });
    const res = await api().put("/user/update").set(h.bearer(user)).send({ city: "Akko" });
    assert.equal(res.status, 200);
    const row = await h.getUserRow(ctx.db, user.id);
    assert.equal(row.first_name, "Keep");
    assert.equal(row.city, "Akko");
  });

  it("/user/update refuses another account's e-mail in any case", async () => {
    const other = await h.createUser(ctx.db, { email: "taken@example.test" });
    const user = await h.createUser(ctx.db);
    const res = await api().put("/user/update").set(h.bearer(user)).send({ email: "TAKEN@example.test" });
    assert.equal(res.status, 400);
    assert.ok(other.id);
  });

  it("change-password checks the old password", async () => {
    const user = await h.createUser(ctx.db);
    const bad = await api().put("/user/change-password").set(h.bearer(user)).send({ old_password: "x", new_password: "y" });
    assert.equal(bad.status, 400);
    const missing = await api().put("/user/change-password").set(h.bearer(user)).send({});
    assert.equal(missing.status, 400);
    const ok = await api()
      .put("/user/change-password")
      .set(h.bearer(user))
      .send({ old_password: h.PASSWORD, new_password: "New-pass-2" });
    assert.equal(ok.status, 200);
    const login = await api().post("/auth/login").send({ email: user.email, password: "New-pass-2" });
    assert.equal(login.status, 200);
  });

  it("deactivating the account ends the session", async () => {
    const user = await h.createUser(ctx.db);
    assert.equal((await api().post("/user/deactivate").set(h.bearer(user))).status, 200);
    assert.equal((await api().get("/user/info").set(h.bearer(user))).status, 401);
  });
});

describe("welcome pages (S13)", () => {
  it("each stats endpoint is limited to its roles", async () => {
    const user = await h.createUser(ctx.db, { role: 2 });
    const admin = await h.createUser(ctx.db, { role: 1 });
    const recycler = await h.createUser(ctx.db, { role: 3 });
    const manager = await h.createUser(ctx.db, { role: 4 });

    assert.equal((await api().get("/user/welcomeAdmin").set(h.bearer(user))).status, 403);
    assert.equal((await api().get("/user/welcomeAdmin").set(h.bearer(admin))).status, 200);
    assert.equal((await api().get("/user/welcomeManager").set(h.bearer(recycler))).status, 403);
    assert.equal((await api().get("/user/welcomeManager").set(h.bearer(manager))).status, 200);
    assert.equal((await api().get("/user/welcomeRecycler").set(h.bearer(user))).status, 403);
    assert.equal((await api().get("/user/welcomeRecycler").set(h.bearer(recycler))).status, 200);
    assert.equal((await api().get("/user/welcomeUser").set(h.bearer(user))).status, 200);
    assert.equal((await api().get("/user/welcomeUser")).status, 401);
  });
});

describe("contact form (S10)", () => {
  it("escapes HTML and sends from the app's own address", async () => {
    ctx.sentMail.length = 0;
    const res = await api().post("/user/sendEmail").send({
      email: "visitor@example.test",
      subject: "Hi\r\nBcc: victim@example.test",
      message: '<img src=x onerror="alert(1)"> hello',
    });
    assert.equal(res.status, 200);
    const mail = ctx.sentMail[0];
    assert.equal(mail.to, "contact@example.test");
    assert.equal(mail.replyTo, "visitor@example.test");
    assert.equal(mail.from.address, "noreply@example.test");
    assert.doesNotMatch(mail.subject, /[\r\n]/);
    assert.doesNotMatch(mail.html, /<img/);
    assert.match(mail.html, /&lt;img src=x onerror=&quot;alert\(1\)&quot;&gt; hello/);
  });

  it("refuses a bad e-mail or an over-long message", async () => {
    const bad = await api().post("/user/sendEmail").send({ email: "nope", subject: "s", message: "m" });
    assert.equal(bad.status, 400);
    const long = await api()
      .post("/user/sendEmail")
      .send({ email: "a@example.test", subject: "s", message: "x".repeat(5001) });
    assert.equal(long.status, 400);
  });
});

describe("rate limits (S12)", () => {
  it("blocks the 31st login attempt in 15 minutes from one address", async () => {
    process.env.RATE_LIMIT = "on";
    try {
      const ip = "203.0.113.7";
      for (let i = 0; i < 30; i++) {
        const res = await api().post("/auth/login").set("CF-Connecting-IP", ip).send({ email: "x@example.test", password: "x" });
        assert.equal(res.status, 401);
      }
      const blocked = await api().post("/auth/login").set("CF-Connecting-IP", ip).send({ email: "x@example.test", password: "x" });
      assert.equal(blocked.status, 429);
      // another visitor is not affected
      const other = await api().post("/auth/login").set("CF-Connecting-IP", "203.0.113.8").send({ email: "x@example.test", password: "x" });
      assert.equal(other.status, 401);
    } finally {
      process.env.RATE_LIMIT = "off";
    }
  });
});

describe("errors (S11)", () => {
  it("unknown routes answer 404 JSON", async () => {
    const res = await api().get("/no-such-route");
    assert.equal(res.status, 404);
    assert.deepEqual(res.body, { error: "Not found" });
  });

  it("malformed JSON answers 400, not a stack trace", async () => {
    const res = await api().post("/auth/login").set("Content-Type", "application/json").send("{bad json");
    assert.equal(res.status, 400);
    assert.deepEqual(res.body, { error: "Invalid JSON body" });
  });

  it("a disallowed Origin gets 403 JSON", async () => {
    const res = await api().get("/markers").set("Origin", "https://evil.example");
    assert.equal(res.status, 403);
    assert.equal(res.headers["access-control-allow-origin"], undefined);
  });

  it("an allowed Origin gets CORS headers with credentials", async () => {
    const res = await api().get("/markers").set("Origin", "http://client.example.test");
    assert.equal(res.status, 200);
    assert.equal(res.headers["access-control-allow-origin"], "http://client.example.test");
    assert.equal(res.headers["access-control-allow-credentials"], "true");
  });

  it("no x-powered-by header", async () => {
    const res = await api().get("/healthz");
    assert.equal(res.status, 200);
    assert.equal(res.headers["x-powered-by"], undefined);
  });
});
