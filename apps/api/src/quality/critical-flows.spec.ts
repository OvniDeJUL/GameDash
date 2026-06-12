import assert from "node:assert/strict";
import { AdminService } from "../admin/admin.service";
import { AuthService } from "../auth/auth.service";
import { EconomyService } from "../economy/economy.service";
import { MapsService } from "../maps/maps.service";
import { MatchmakingService } from "../matchmaking/matchmaking.service";
import { ProgressionService } from "../progression/progression.service";
import type { AuthenticatedUser } from "../auth/auth.types";

const authService = new AuthService();
const progressionService = new ProgressionService();
const matchmakingService = new MatchmakingService(progressionService);
const economyService = new EconomyService();
const mapsService = new MapsService();
const adminService = new AdminService();

const playerOne = authService.register({
  email: "critical-player-one@example.test",
  password: "minimum-8",
  pseudo: "CriticalOne",
  region: "EU"
});
const playerTwo = authService.register({
  email: "critical-player-two@example.test",
  password: "minimum-8",
  pseudo: "CriticalTwo",
  region: "EU"
});

const actorOne = authService.verifyAccessToken(playerOne.accessToken);
const actorTwo = authService.verifyAccessToken(playerTwo.accessToken);

const queued = matchmakingService.joinQueue(actorOne, { mode: "ranked" });
assert.equal(queued.state, "in_queue");

const matched = matchmakingService.joinQueue(actorTwo, { mode: "ranked" });
assert.equal(matched.state, "in_match");
assert.ok(matched.matchId);

const result = matchmakingService.submitResult(actorTwo, matched.matchId, {
  winnerPlayerId: actorTwo.id,
  notes: "Critical flow result"
});
assert.equal(result.accepted, true);
assert.equal(result.participants.length, 2);
assert.equal(matchmakingService.getAuditLogs().length, 2);
assert.equal(progressionService.getAuditLogs().length, 2);
assert.ok(progressionService.getPlayerProgression(actorTwo.id).lifetimeXp > 0);

const purchase = economyService.purchase(actorOne, {
  storeItemId: "item_starter_skin",
  quantity: 1
});
assert.equal(purchase.transaction.status, "accepted");
assert.equal(economyService.getInventory(actorOne).length, 1);

const rejectedPurchase = economyService.purchase(actorOne, {
  storeItemId: "item_premium_skin",
  quantity: 999
});
assert.equal(rejectedPurchase.transaction.status, "rejected");
assert.equal(economyService.getTransactions(actorOne).length, 2);

const publishedMap = mapsService.createMap(actorOne, {
  title: "Critical Arena",
  description: "Map used by the phase 7 critical flow.",
  tags: ["ranked", "quality"],
  status: "beta"
});
const version = mapsService.createVersion(actorOne, publishedMap.id, {
  versionLabel: "v1",
  releaseNotes: "Initial critical flow version"
});
assert.equal(version.versionLabel, "v1");

mapsService.voteMap(actorTwo, publishedMap.id, { value: 1 });
mapsService.testMap(actorTwo, publishedMap.id, { completed: true });
mapsService.favoriteMap(actorTwo, publishedMap.id, { favorited: true });
assert.equal(mapsService.listMaps({ q: "critical" }).length, 1);
assert.ok(mapsService.getMapStats(publishedMap.id).popularityScore > 0);
assert.deepEqual(
  mapsService.getAuditLogs().map((entry) => entry.action),
  ["map.publish", "map.update"]
);

const admin: AuthenticatedUser = {
  id: "usr_admin_phase7",
  email: "admin-phase7@example.test",
  role: "admin"
};
const staff: AuthenticatedUser = {
  id: "usr_staff_phase7",
  email: "staff-phase7@example.test",
  role: "staff"
};

adminService.updateSettings(admin, {
  matchmaking: {
    rankedQueueMaxWaitSeconds: 75
  }
});
adminService.moderateAccount(staff, actorOne.id, {
  action: "warn",
  reason: "Critical flow moderation review"
});
adminService.moderateMap(staff, publishedMap.id, {
  action: "feature",
  reason: "Critical flow map quality"
});

assert.equal(adminService.getSettings().updatedBy, admin.id);
assert.equal(adminService.getModerationHistory().length, 2);
assert.deepEqual(
  adminService.getAuditLogs().map((entry) => entry.action),
  ["admin.settings.update", "admin.moderation.account", "admin.moderation.map"]
);

console.log("critical flow integration tests passed");
