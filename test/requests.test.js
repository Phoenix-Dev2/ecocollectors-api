// Pickup requests: public map, editing, claiming, status changes and bottle credits.
const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const h = require("./helpers");

let ctx;
let api;
let owner;
let stranger;
let recycler;
let otherRecycler;
let admin;
let manager;

before(async () => {
  ctx = await h.startApp();
  api = ctx.api;
  owner = await h.createUser(ctx.db, { role: 2 });
  stranger = await h.createUser(ctx.db, { role: 2 });
  recycler = await h.createUser(ctx.db, { role: 3, first_name: "Rita", phone: "0549999999" });
  otherRecycler = await h.createUser(ctx.db, { role: 3 });
  admin = await h.createUser(ctx.db, { role: 1 });
  manager = await h.createUser(ctx.db, { role: 4 });
});
after(() => h.stopApp());

describe("public map GET /requests (S5, Q2)", () => {
  it("anonymous visitors get no names, phones or user ids", async () => {
    await h.createRequest(ctx.db, { user_id: owner.id });
    const res = await api().get("/requests");
    assert.equal(res.status, 200);
    assert.ok(res.body.length > 0);
    for (const row of res.body) {
      assert.equal(row.full_name, undefined);
      assert.equal(row.phone_number, undefined);
      assert.equal(row.user_id, undefined);
      assert.equal(row.recycler_id, undefined);
      assert.equal(row.is_mine, false);
      assert.ok(row.req_address && row.req_lat && row.bottles_number);
    }
  });

  it("a logged-in owner sees is_mine (and user_id) on their own rows only", async () => {
    const mine = await h.createRequest(ctx.db, { user_id: owner.id });
    const theirs = await h.createRequest(ctx.db, { user_id: stranger.id });
    const res = await api().get("/requests").set(h.bearer(owner));
    const byId = Object.fromEntries(res.body.map((r) => [r.request_id, r]));
    assert.equal(byId[mine].is_mine, true);
    assert.equal(byId[mine].user_id, owner.id);
    assert.equal(byId[theirs].is_mine, false);
    assert.equal(byId[theirs].user_id, undefined);
  });

  it("only open requests (status 1, 2) are listed", async () => {
    const done = await h.createRequest(ctx.db, { user_id: owner.id, status: 3 });
    const res = await api().get("/requests");
    assert.ok(!res.body.some((r) => r.request_id === done));
  });
});

describe("PUT /requests/userUpdate/:id (S1)", () => {
  it("the owner can edit the whitelisted fields; the rest of the row sent back is ignored", async () => {
    const id = await h.createRequest(ctx.db, { user_id: owner.id });
    const row = (await api().get(`/requests/${id}`).set(h.bearer(owner))).body;
    const res = await api()
      .put(`/requests/userUpdate/${id}`)
      .set(h.bearer(owner))
      .send({ ...row, full_name: "New Name", bottles_number: "25", from_hour: "09:30", status: 3, user_id: stranger.id, recycler_id: recycler.id, type: "completed" });
    assert.equal(res.status, 200);
    const after = await h.getRequestRow(ctx.db, id);
    assert.equal(after.full_name, "New Name");
    assert.equal(after.bottles_number, 25);
    assert.equal(after.from_hour, "09:30");
    assert.equal(after.status, 1);
    assert.equal(after.user_id, owner.id);
    assert.equal(after.recycler_id, null);
    assert.equal(after.type, "request");
  });

  it("an SQL-injection key changes nothing", async () => {
    const id = await h.createRequest(ctx.db, { user_id: owner.id });
    const other = await h.createRequest(ctx.db, { user_id: stranger.id });
    const res = await api()
      .put(`/requests/userUpdate/${id}`)
      .set(h.bearer(owner))
      .send({ "status=3 WHERE 1=1 -- ": "x", "full_name=(SELECT password FROM users LIMIT 1) -- ": "y" });
    assert.equal(res.status, 400); // nothing editable in the body
    assert.equal((await h.getRequestRow(ctx.db, other)).status, 1);
    assert.equal((await h.getRequestRow(ctx.db, id)).full_name, "Owner Name");
  });

  it("someone else can't edit it", async () => {
    const id = await h.createRequest(ctx.db, { user_id: owner.id });
    const res = await api().put(`/requests/userUpdate/${id}`).set(h.bearer(stranger)).send({ full_name: "Hacked" });
    assert.equal(res.status, 403);
  });

  it("only while it waits for a recycler", async () => {
    const id = await h.createRequest(ctx.db, { user_id: owner.id, status: 2, recycler_id: recycler.id });
    const res = await api().put(`/requests/userUpdate/${id}`).set(h.bearer(owner)).send({ full_name: "Late" });
    assert.equal(res.status, 409);
  });

  it("invalid values are refused with 400", async () => {
    const id = await h.createRequest(ctx.db, { user_id: owner.id });
    const tooLong = await api().put(`/requests/userUpdate/${id}`).set(h.bearer(owner)).send({ req_address: "x".repeat(56) });
    assert.equal(tooLong.status, 400);
    const badBottles = await api().put(`/requests/userUpdate/${id}`).set(h.bearer(owner)).send({ bottles_number: -3 });
    assert.equal(badBottles.status, 400);
  });
});

describe("claiming PUT /requests/:id (S3)", () => {
  it("a normal user can't claim", async () => {
    const id = await h.createRequest(ctx.db, { user_id: owner.id });
    assert.equal((await api().put(`/requests/${id}`).set(h.bearer(stranger))).status, 403);
    assert.equal((await h.getRequestRow(ctx.db, id)).status, 1);
  });

  it("a recycler claims an open request, without setting completed_date", async () => {
    const id = await h.createRequest(ctx.db, { user_id: owner.id });
    const res = await api().put(`/requests/${id}`).set(h.bearer(recycler));
    assert.equal(res.status, 200);
    const row = await h.getRequestRow(ctx.db, id);
    assert.equal(row.status, 2);
    assert.equal(row.recycler_id, recycler.id);
    assert.equal(row.type, "pending");
    assert.equal(row.completed_date, null);
  });

  it("a claimed request can't be taken over", async () => {
    const id = await h.createRequest(ctx.db, { user_id: owner.id, status: 2, recycler_id: recycler.id, type: "pending" });
    const res = await api().put(`/requests/${id}`).set(h.bearer(otherRecycler));
    assert.equal(res.status, 409);
    assert.equal((await h.getRequestRow(ctx.db, id)).recycler_id, recycler.id);
  });

  it("a recycler can't claim their own request", async () => {
    const id = await h.createRequest(ctx.db, { user_id: recycler.id });
    assert.equal((await api().put(`/requests/${id}`).set(h.bearer(recycler))).status, 403);
  });

  it("404 for a request that doesn't exist", async () => {
    assert.equal((await api().put("/requests/999999").set(h.bearer(recycler))).status, 404);
  });
});

describe("recycler gives a request back (S4)", () => {
  it("not someone else's", async () => {
    const id = await h.createRequest(ctx.db, { user_id: owner.id, status: 5, recycler_id: recycler.id, type: "pending" });
    const res = await api().put(`/recycler/requests/${id}`).set(h.bearer(otherRecycler)).send({ status: 1 });
    assert.equal(res.status, 404);
    const row = await h.getRequestRow(ctx.db, id);
    assert.equal(row.status, 5);
    assert.equal(row.recycler_id, recycler.id);
  });

  it("their own goes back to 'awaits recycler'", async () => {
    const id = await h.createRequest(ctx.db, { user_id: owner.id, status: 2, recycler_id: recycler.id, type: "pending" });
    const res = await api().put(`/recycler/requests/${id}`).set(h.bearer(recycler)).send({ status: 1 });
    assert.equal(res.status, 200);
    const row = await h.getRequestRow(ctx.db, id);
    assert.equal(row.status, 1);
    assert.equal(row.recycler_id, null);
    assert.equal(row.type, "request");
  });

  it("only status 1 is accepted", async () => {
    const id = await h.createRequest(ctx.db, { user_id: owner.id, status: 2, recycler_id: recycler.id, type: "pending" });
    const res = await api().put(`/recycler/requests/${id}`).set(h.bearer(recycler)).send({ status: 3 });
    assert.equal(res.status, 400);
  });
});

describe("owner status changes PUT /dashboardUser/:id (S2)", () => {
  it("full flow: claim, accept, complete; bottles are credited once to owner and recycler", async () => {
    const id = await h.createRequest(ctx.db, { user_id: owner.id, bottles_number: 10 });
    const ownerBefore = (await h.getUserRow(ctx.db, owner.id)).amount;
    const recyclerBefore = (await h.getUserRow(ctx.db, recycler.id)).amount;

    assert.equal((await api().put(`/requests/${id}`).set(h.bearer(recycler))).status, 200);
    assert.equal((await api().put(`/dashboardUser/${id}`).set(h.bearer(owner)).send({ status: 5 })).status, 200);
    const done = await api().put(`/dashboardUser/${id}`).set(h.bearer(owner)).send({ status: 3, newBottlesNumber: "7" });
    assert.equal(done.status, 200);

    const row = await h.getRequestRow(ctx.db, id);
    assert.equal(row.status, 3);
    assert.equal(row.type, "completed");
    assert.equal(row.bottles_number, 7);
    assert.ok(row.completed_date);
    assert.equal((await h.getUserRow(ctx.db, owner.id)).amount, ownerBefore + 7);
    assert.equal((await h.getUserRow(ctx.db, recycler.id)).amount, recyclerBefore + 7);

    // a second "complete" (double click, replay) is refused and credits nothing
    const again = await api().put(`/dashboardUser/${id}`).set(h.bearer(owner)).send({ status: 3, newBottlesNumber: 7 });
    assert.equal(again.status, 409);
    assert.equal((await h.getUserRow(ctx.db, owner.id)).amount, ownerBefore + 7);
  });

  it("someone else can't change it or credit themselves", async () => {
    const id = await h.createRequest(ctx.db, { user_id: owner.id, status: 5, recycler_id: recycler.id, type: "pending" });
    const before = (await h.getUserRow(ctx.db, owner.id)).amount;
    const res = await api().put(`/dashboardUser/${id}`).set(h.bearer(stranger)).send({ status: 3, newBottlesNumber: 9999 });
    assert.equal(res.status, 403);
    assert.equal((await h.getRequestRow(ctx.db, id)).status, 5);
    assert.equal((await h.getUserRow(ctx.db, owner.id)).amount, before);
  });

  it("can't jump from 'awaits recycler' straight to completed", async () => {
    const id = await h.createRequest(ctx.db, { user_id: owner.id });
    const res = await api().put(`/dashboardUser/${id}`).set(h.bearer(owner)).send({ status: 3, newBottlesNumber: 5 });
    assert.equal(res.status, 409);
  });

  it("refuses bad bottle numbers", async () => {
    const id = await h.createRequest(ctx.db, { user_id: owner.id, status: 5, recycler_id: recycler.id, type: "pending" });
    for (const n of [0, -5, "abc", 2.5, 1e9, undefined]) {
      const res = await api().put(`/dashboardUser/${id}`).set(h.bearer(owner)).send({ status: 3, newBottlesNumber: n });
      assert.equal(res.status, 400, `newBottlesNumber ${n}`);
    }
    assert.equal((await h.getRequestRow(ctx.db, id)).status, 5);
  });

  it("refuses unknown statuses", async () => {
    const id = await h.createRequest(ctx.db, { user_id: owner.id });
    const res = await api().put(`/dashboardUser/${id}`).set(h.bearer(owner)).send({ status: 9 });
    assert.equal(res.status, 400);
  });

  it("declining releases the recycler; canceling works from open", async () => {
    const id = await h.createRequest(ctx.db, { user_id: owner.id, status: 2, recycler_id: recycler.id, type: "pending" });
    assert.equal((await api().put(`/dashboardUser/${id}`).set(h.bearer(owner)).send({ status: 1 })).status, 200);
    let row = await h.getRequestRow(ctx.db, id);
    assert.equal(row.status, 1);
    assert.equal(row.recycler_id, null);
    assert.equal(row.type, "request");
    assert.equal((await api().put(`/dashboardUser/${id}`).set(h.bearer(owner)).send({ status: 4 })).status, 200);
    row = await h.getRequestRow(ctx.db, id);
    assert.equal(row.status, 4);
  });

  it("GET /dashboardUser/:id lists only the caller's own requests", async () => {
    const res = await api().get(`/dashboardUser/${stranger.id}`).set(h.bearer(owner));
    assert.equal(res.status, 200);
    assert.ok(res.body.length > 0);
    assert.ok(res.body.every((r) => r.user_id === owner.id));
  });
});

describe("reading one request (S6)", () => {
  it("GET /requests/:id: owner, assigned recycler, admin and manager only", async () => {
    const id = await h.createRequest(ctx.db, { user_id: owner.id, status: 2, recycler_id: recycler.id, type: "pending" });
    assert.equal((await api().get(`/requests/${id}`).set(h.bearer(stranger))).status, 403);
    assert.equal((await api().get(`/requests/${id}`).set(h.bearer(otherRecycler))).status, 403);
    for (const who of [owner, recycler, admin, manager]) {
      const res = await api().get(`/requests/${id}`).set(h.bearer(who));
      assert.equal(res.status, 200);
      assert.equal(res.body.request_id, id);
      assert.equal(res.body.recycler_id, undefined);
    }
    assert.equal((await api().get("/requests/999999").set(h.bearer(owner))).status, 404);
  });

  it("GET /requests/recycle/:id: recyclers see open requests and their own, not others'", async () => {
    const open = await h.createRequest(ctx.db, { user_id: owner.id });
    const taken = await h.createRequest(ctx.db, { user_id: owner.id, status: 2, recycler_id: recycler.id, type: "pending" });
    assert.equal((await api().get(`/requests/recycle/${open}`).set(h.bearer(otherRecycler))).status, 200);
    assert.equal((await api().get(`/requests/recycle/${taken}`).set(h.bearer(otherRecycler))).status, 403);
    assert.equal((await api().get(`/requests/recycle/${taken}`).set(h.bearer(recycler))).status, 200);
    assert.equal((await api().get(`/requests/recycle/${open}`).set(h.bearer(stranger))).status, 403);
  });

  it("GET /dashboardRecycler/:id: only the owner of a request that recycler handles", async () => {
    await h.createRequest(ctx.db, { user_id: owner.id, status: 5, recycler_id: recycler.id, type: "pending" });
    const ok = await api().get(`/dashboardRecycler/${recycler.id}`).set(h.bearer(owner));
    assert.equal(ok.status, 200);
    assert.equal(ok.body[0].first_name, "Rita");
    assert.equal(ok.body[0].phone, "0549999999");
    assert.equal((await api().get(`/dashboardRecycler/${recycler.id}`).set(h.bearer(stranger))).status, 403);
    assert.equal((await api().get(`/dashboardRecycler/${owner.id}`).set(h.bearer(stranger))).status, 403);
    const none = await api().get("/dashboardRecycler/null").set(h.bearer(owner));
    assert.equal(none.status, 200);
    assert.deepEqual(none.body, []);
  });
});

describe("add and delete", () => {
  it("adds a request for the logged-in user", async () => {
    const res = await api().post("/requests/add").set(h.bearer(stranger)).send({
      fullName: "Sam", reqLat: 32.1, reqLng: 34.8, reqAddress: "Dizengoff 1, Tel Aviv",
      phoneNumber: "0533333333", bottlesNumber: 12, fromTime: "10:00", toTime: "11:00", reqDate: "2026-11-14 10:00:00",
      user_id: owner.id, status: 3,
    });
    assert.equal(res.status, 200);
    const [rows] = await ctx.db.query("SELECT user_id, status FROM user_requests WHERE full_name = 'Sam'");
    assert.deepEqual(rows[0], { user_id: stranger.id, status: 1 });
  });

  it("a database error is a generic 500 without SQL details (a too-long address: B6, until migration 001)", async () => {
    const res = await api().post("/requests/add").set(h.bearer(stranger)).send({
      fullName: "Sam", reqLat: 32.1, reqLng: 34.8, reqAddress: "x".repeat(80),
      phoneNumber: "0533333333", bottlesNumber: 12, fromTime: "10:00", toTime: "11:00", reqDate: "2026-11-14 10:00:00",
    });
    assert.equal(res.status, 500);
    assert.deepEqual(res.body, { error: "Internal Server Error" });
  });

  it("only the owner can delete", async () => {
    const id = await h.createRequest(ctx.db, { user_id: owner.id });
    assert.equal((await api().delete(`/requests/${id}`).set(h.bearer(stranger))).status, 403);
    assert.equal((await api().delete(`/requests/${id}`).set(h.bearer(owner))).status, 200);
    assert.equal(await h.getRequestRow(ctx.db, id), undefined);
  });
});
