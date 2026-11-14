// Admin and recycler-manager panels: roles, join requests, account toggles, bins.
const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const h = require("./helpers");

let ctx;
let api;
let admin;
let manager;
let user;
let recycler;

before(async () => {
  ctx = await h.startApp();
  api = ctx.api;
  admin = await h.createUser(ctx.db, { role: 1 });
  manager = await h.createUser(ctx.db, { role: 4 });
  user = await h.createUser(ctx.db, { role: 2 });
  recycler = await h.createUser(ctx.db, { role: 3 });
});
after(() => h.stopApp());

const roleOf = async (u) => (await h.getUserRow(ctx.db, u.id)).role;

async function joinRequest(table, applicant, email = `${applicant.id}-${Date.now()}@example.test`) {
  const [result] = await ctx.db.query(
    `INSERT INTO ${table} (user_id, join_date, first_name, last_name, email, phone, message, status) VALUES (?, NOW(), 'A', 'B', ?, '0501234567', 'hi', 1)`,
    [applicant.id, email]
  );
  return result.insertId;
}

describe("role checks on the panels", () => {
  it("each panel only for its role", async () => {
    assert.equal((await api().get("/admin/users")).status, 401);
    assert.equal((await api().get("/admin/users").set(h.bearer(manager))).status, 403);
    assert.equal((await api().get("/admin/users").set(h.bearer(admin))).status, 200);
    assert.equal((await api().get("/manager/recyclers").set(h.bearer(user))).status, 403);
    assert.equal((await api().get("/manager/recyclers").set(h.bearer(manager))).status, 200);
    assert.equal((await api().get("/recycler/accepted-requests").set(h.bearer(user))).status, 403);
    assert.equal((await api().get("/recycler/accepted-requests").set(h.bearer(recycler))).status, 200);
  });

  it("admin user list has no password hashes", async () => {
    const res = await api().get("/admin/users").set(h.bearer(admin));
    assert.ok(res.body.length > 0);
    assert.ok(res.body.every((u) => u.password === undefined && u.role !== 1));
  });
});

describe("manager: recycler (de)activation (S7)", () => {
  it("toggles a recycler 3 <-> 5", async () => {
    const r = await h.createUser(ctx.db, { role: 3 });
    assert.equal((await api().put(`/manager/recyclers/${r.id}`).set(h.bearer(manager)).send({ active: 0 })).status, 200);
    assert.equal(await roleOf(r), 5);
    assert.equal((await api().put(`/manager/recyclers/${r.id}`).set(h.bearer(manager)).send({ active: 1 })).status, 200);
    assert.equal(await roleOf(r), 3);
  });

  it("can't touch an admin, a manager or a normal user", async () => {
    for (const target of [admin, manager, user]) {
      const res = await api().put(`/manager/recyclers/${target.id}`).set(h.bearer(manager)).send({ active: 0 });
      assert.equal(res.status, 403);
      assert.equal(await roleOf(target), target.role);
    }
  });
});

describe("join requests (S7)", () => {
  it("manager approval promotes the applicant from the join request, not the userID in the body", async () => {
    const applicant = await h.createUser(ctx.db, { role: 2 });
    const joinId = await joinRequest("recyclers_join_requests", applicant);
    const res = await api()
      .put(`/manager/join-requests/${joinId}`)
      .set(h.bearer(manager))
      .send({ status: 3, userID: admin.id });
    assert.equal(res.status, 200);
    assert.equal(await roleOf(applicant), 3);
    assert.equal(await roleOf(admin), 1);
  });

  it("a join request naming an admin can't demote them", async () => {
    const joinId = await joinRequest("recyclers_join_requests", admin);
    const res = await api().put(`/manager/join-requests/${joinId}`).set(h.bearer(manager)).send({ status: 3 });
    assert.equal(res.status, 409);
    assert.equal(await roleOf(admin), 1);
    const [rows] = await ctx.db.query("SELECT status FROM recyclers_join_requests WHERE join_id = ?", [joinId]);
    assert.equal(rows[0].status, 1); // rolled back
  });

  it("declining changes no role; bad statuses are refused", async () => {
    const applicant = await h.createUser(ctx.db, { role: 2 });
    const joinId = await joinRequest("recyclers_join_requests", applicant);
    assert.equal((await api().put(`/manager/join-requests/${joinId}`).set(h.bearer(manager)).send({ status: 7 })).status, 400);
    assert.equal((await api().put(`/manager/join-requests/${joinId}`).set(h.bearer(manager)).send({ status: 2 })).status, 200);
    assert.equal(await roleOf(applicant), 2);
    assert.equal((await api().put("/manager/join-requests/999999").set(h.bearer(manager)).send({ status: 2 })).status, 404);
  });

  it("admin approval makes the applicant a recycler manager", async () => {
    const applicant = await h.createUser(ctx.db, { role: 3 });
    const joinId = await joinRequest("recyclers_manager_join_requests", applicant);
    const res = await api().put(`/admin/join-requests/${joinId}`).set(h.bearer(admin)).send({ status: 3, userID: user.id });
    assert.equal(res.status, 200);
    assert.equal(await roleOf(applicant), 4);
    assert.equal(await roleOf(user), 2);
  });

  it("sign-up form: one join request per e-mail", async () => {
    const applicant = await h.createUser(ctx.db, { role: 2 });
    const body = { join_date: "2026-11-14 10:00:00", first_name: "A", last_name: "B", email: "join@example.test", phone: "0501234567", message: "hi", user_id: applicant.id };
    assert.equal((await api().post("/recyclers/recyclerRegister").send(body)).status, 200);
    const again = await api().post("/recyclers/recyclerRegister").send(body);
    assert.equal(again.status, 400);
    assert.equal(again.body, "Please be patient, we will be in contact soon!");
  });

  it("sign-up form: a logged-in caller always applies for themselves", async () => {
    const applicant = await h.createUser(ctx.db, { role: 2 });
    const body = { join_date: "2026-11-14", first_name: "A", last_name: "B", email: "join2@example.test", phone: "0501234567", message: "hi", user_id: admin.id };
    assert.equal((await api().post("/recyclersManagers/recyclerManagerRegister").set(h.bearer(applicant)).send(body)).status, 200);
    const [rows] = await ctx.db.query("SELECT user_id, status FROM recyclers_manager_join_requests WHERE email = 'join2@example.test'");
    assert.deepEqual(rows[0], { user_id: applicant.id, status: 1 });
  });
});

describe("admin: accounts and requests", () => {
  it("activation toggle: 0/1 only, never on an admin", async () => {
    const u = await h.createUser(ctx.db, { role: 2 });
    assert.equal((await api().put(`/admin/users/${u.id}`).set(h.bearer(admin)).send({ active: 0 })).status, 200);
    assert.equal((await h.getUserRow(ctx.db, u.id)).active, 0);
    assert.equal((await api().put(`/admin/users/${u.id}`).set(h.bearer(admin)).send({ active: 5 })).status, 400);
    const otherAdmin = await h.createUser(ctx.db, { role: 1 });
    assert.equal((await api().put(`/admin/users/${otherAdmin.id}`).set(h.bearer(admin)).send({ active: 0 })).status, 404);
    assert.equal((await h.getUserRow(ctx.db, otherAdmin.id)).active, 1);
  });

  it("putting a request on hold; invalid statuses refused", async () => {
    const id = await h.createRequest(ctx.db, { user_id: user.id });
    assert.equal((await api().put(`/admin/requests/${id}`).set(h.bearer(admin)).send({ status: 4 })).status, 200);
    const row = await h.getRequestRow(ctx.db, id);
    assert.equal(row.status, 4);
    assert.equal(row.type, "hold");
    assert.equal((await api().put(`/admin/requests/${id}`).set(h.bearer(admin)).send({ status: "x" })).status, 400);
    assert.equal((await api().put(`/manager/requests/${id}`).set(h.bearer(manager)).send({ status: 1 })).status, 200);
    assert.equal((await h.getRequestRow(ctx.db, id)).type, "request");
  });

  it("all-requests shows every status to the admin", async () => {
    await h.createRequest(ctx.db, { user_id: user.id, status: 3 });
    const res = await api().get("/admin/all-requests").set(h.bearer(admin));
    assert.equal(res.status, 200);
    assert.ok(res.body.some((r) => r.status === 3));
  });
});

describe("admin: bins (S13)", () => {
  it("activating a bin is PUT only; GET is gone", async () => {
    const [result] = await ctx.db.query(
      "INSERT INTO markers (address, city, lat, lng, type, active, last_modified) VALUES ('A 1', 'Haifa', 32.8, 34.9, 'plastic', 0, CURDATE())"
    );
    const binId = result.insertId;
    assert.equal((await api().get(`/admin/activateBin/${binId}`).set(h.bearer(admin))).status, 404);
    assert.equal((await api().put(`/admin/activateBin/${binId}`).set(h.bearer(admin))).status, 200);
    const [rows] = await ctx.db.query("SELECT active FROM markers WHERE id = ?", [binId]);
    assert.equal(rows[0].active, 1);
    const markers = await api().get("/markers");
    assert.ok(markers.body.some((m) => m.id === binId));
    assert.equal((await api().put(`/admin/deactivateBin/${binId}`).set(h.bearer(admin))).status, 200);
    assert.equal((await api().get(`/admin/bins/${binId}`).set(h.bearer(admin))).body.active, 0);
  });

  it("add and update a bin", async () => {
    const add = await api().post("/admin/bins").set(h.bearer(admin)).send({ address: "B 2", city: "Haifa", lat: 32.81, lng: 34.91, type: "glass" });
    assert.equal(add.status, 200);
    const dup = await api().post("/admin/bins").set(h.bearer(admin)).send({ address: "B 2", city: "Haifa", lat: 32.81, lng: 34.91, type: "glass" });
    assert.equal(dup.status, 400);
    const [rows] = await ctx.db.query("SELECT id FROM markers WHERE address = 'B 2'");
    const upd = await api().put(`/admin/bins/${rows[0].id}`).set(h.bearer(admin)).send({ address: "B 3", city: "Haifa", lat: 32.82, lng: 34.92, type: "glass" });
    assert.equal(upd.status, 200);
  });
});
