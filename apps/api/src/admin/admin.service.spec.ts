import assert from "node:assert/strict";
import { BadRequestException } from "@nestjs/common";
import { AdminService } from "./admin.service";
import type { AuthenticatedUser } from "../auth/auth.types";

const service = new AdminService();

const admin: AuthenticatedUser = {
  id: "usr_admin",
  email: "admin@example.test",
  role: "admin"
};

const staff: AuthenticatedUser = {
  id: "usr_staff",
  email: "staff@example.test",
  role: "staff"
};

const initialDashboard = service.getDashboard();
assert.equal(initialDashboard.activePlayers, 1200);
assert.equal(initialDashboard.openModerationSignals, 2);
assert.equal(initialDashboard.activeSanctions, 0);

const settings = service.updateSettings(admin, {
  matchmaking: {
    rankedQueueMaxWaitSeconds: 120
  },
  mmr: {
    rankedWinDelta: 28
  },
  economy: {
    purchaseEnabled: false
  }
});

assert.equal(settings.matchmaking.rankedQueueMaxWaitSeconds, 120);
assert.equal(settings.mmr.rankedWinDelta, 28);
assert.equal(settings.economy.purchaseEnabled, false);
assert.equal(settings.updatedBy, admin.id);

assert.throws(
  () =>
    service.updateSettings(admin, {
      matchmaking: {
        matchSize: 1
      }
    }),
  BadRequestException
);
assert.equal(service.getSettings().matchmaking.matchSize, 2);
assert.equal(service.getAuditLogs().length, 1);

const accountAction = service.moderateAccount(staff, "usr_target", {
  action: "suspend",
  reason: "Ranked abuse reports",
  durationHours: 24
});

assert.equal(accountAction.targetType, "account");
assert.equal(accountAction.action, "account.suspend");
assert.equal(accountAction.actorId, staff.id);
assert.ok(accountAction.expiresAt);

const mapAction = service.moderateMap(staff, "map_target", {
  action: "hide",
  reason: "Unsafe UGC metadata"
});

assert.equal(mapAction.targetType, "map");
assert.equal(mapAction.action, "map.hide");

const dashboardAfterModeration = service.getDashboard();
assert.equal(dashboardAfterModeration.activeSanctions, 1);

const history = service.getModerationHistory();
assert.equal(history.length, 2);
assert.equal(history[0]?.action, "map.hide");
assert.equal(history[1]?.action, "account.suspend");

const signals = service.getModerationSignals();
assert.equal(signals.length, 2);
assert.ok(signals.every((signal) => signal.status === "open"));

const auditActions = service.getAuditLogs().map((entry) => entry.action);
assert.deepEqual(auditActions, [
  "admin.settings.update",
  "admin.moderation.account",
  "admin.moderation.map"
]);

assert.throws(
  () =>
    service.moderateAccount(staff, "usr_target", {
      action: "warn",
      reason: " ",
      durationHours: -1
    }),
  BadRequestException
);

assert.throws(
  () =>
    service.moderateAccount(staff, "usr_target", {
      action: "suspend",
      reason: "Negative moderation duration",
      durationHours: -1
    }),
  BadRequestException
);

console.log("admin service tests passed");
