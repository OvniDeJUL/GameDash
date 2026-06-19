"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type {
  AuthUserResponse,
  AdminActivePlayerStatus,
  AdminCreateRankConfigRequest,
  AdminDashboardSummary,
  AdminMatchDetail,
  AdminPlayerResponse,
  AdminQueueSnapshot,
  AdminRankConfigItem,
  AdminSanctionEntry,
  AdminTransactionJournalEntry,
  AdminUpdatePlayerRequest,
  AdminCreateStoreItemRequest,
  AdminPlayerTimeline,
  AuditLogEntry,
  GameMode,
  MapReportItem,
  StudioSettingsResponse,
  ModerationSignalResponse,
  ModerationActionResponse,
  StaffRankAnalyticsResponse,
  StaffMapsAnalyticsResponse,
  StaffEconomyAnalyticsResponse,
  StaffMapAdminItem,
  StoreItem
} from "@gamedash/contracts";
import { REGIONS } from "@gamedash/contracts";
import { auth as authApi, admin } from "../../lib/api";
import { withToken, logout } from "../../lib/auth";

type Tab = "overview" | "analytics" | "community" | "economy" | "settings" | "moderation" | "players" | "journal" | "matchmaking" | "ranking";

const STATUS_COLORS: Record<string, string> = {
  draft: "tag-purple",
  beta: "tag-gold",
  stable: "tag-cyan",
  hidden: "tag-red"
};

export default function AdminPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUserResponse | null>(null);
  const [dash, setDash] = useState<AdminDashboardSummary | null>(null);
  const [settings, setSettings] = useState<StudioSettingsResponse | null>(null);
  const [signals, setSignals] = useState<ModerationSignalResponse[]>([]);
  const [modHistory, setModHistory] = useState<ModerationActionResponse[]>([]);
  const [mapReports, setMapReports] = useState<MapReportItem[]>([]);
  const [mapReportsLoading, setMapReportsLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("overview");

  // Players
  const [players, setPlayers] = useState<AdminPlayerResponse[]>([]);
  const [playersLoading, setPlayersLoading] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<AdminPlayerResponse | null>(null);
  const [editForm, setEditForm] = useState<AdminUpdatePlayerRequest>({});
  const [playerBusy, setPlayerBusy] = useState(false);
  const [playerError, setPlayerError] = useState<string | null>(null);
  const [playerNotice, setPlayerNotice] = useState<string | null>(null);
  const [playerTimeline, setPlayerTimeline] = useState<AdminPlayerTimeline | null>(null);
  const [timelineLoading, setTimelineLoading] = useState(false);

  // Moderation form
  const [modTargetId, setModTargetId] = useState("");
  const [modAction, setModAction] = useState("warn");
  const [modReason, setModReason] = useState("");
  const [modDuration, setModDuration] = useState("");
  const [modType, setModType] = useState<"account" | "map">("account");
  const [modBusy, setModBusy] = useState(false);
  const [modNotice, setModNotice] = useState<string | null>(null);
  const [modError, setModError] = useState<string | null>(null);

  // Settings form
  const [settingsBusy, setSettingsBusy] = useState(false);
  const [settingsNotice, setSettingsNotice] = useState<string | null>(null);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [rankedWait, setRankedWait] = useState(90);
  const [matchSize, setMatchSize] = useState(2);
  const [maxMmrGap, setMaxMmrGap] = useState(400);
  const [matchDurationSeconds, setMatchDurationSeconds] = useState(15);
  const [rankedWin, setRankedWin] = useState(32);
  const [rankedLoss, setRankedLoss] = useState(-24);
  const [purchaseEnabled, setPurchaseEnabled] = useState(true);
  // Reward settings
  const [rankedBaseXp, setRankedBaseXp] = useState(120);
  const [unrankedBaseXp, setUnrankedBaseXp] = useState(90);
  const [funBaseXp, setFunBaseXp] = useState(60);
  const [winBonusXp, setWinBonusXp] = useState(60);
  const [lossXp, setLossXp] = useState(25);
  const [rankedSoftBase, setRankedSoftBase] = useState(50);
  const [rankedSoftWinBonus, setRankedSoftWinBonus] = useState(25);
  const [unrankedSoftBase, setUnrankedSoftBase] = useState(40);
  const [unrankedSoftWinBonus, setUnrankedSoftWinBonus] = useState(20);
  const [funSoftBase, setFunSoftBase] = useState(25);
  const [funSoftWinBonus, setFunSoftWinBonus] = useState(10);
  // Queue snapshot
  const [queueSnapshot, setQueueSnapshot] = useState<AdminQueueSnapshot | null>(null);
  const [queueLoading, setQueueLoading] = useState(false);

  // Rank configs
  const [rankConfigs, setRankConfigs] = useState<AdminRankConfigItem[]>([]);
  const [ranksLoaded, setRanksLoaded] = useState(false);
  const [ranksBusy, setRanksBusy] = useState(false);
  const [ranksError, setRanksError] = useState<string | null>(null);
  const [ranksNotice, setRanksNotice] = useState<string | null>(null);
  const [editingRankId, setEditingRankId] = useState<string | null>(null);
  const [editRankForm, setEditRankForm] = useState<{ rank: string; minMmr: number; maxMmr: string; sortOrder: number }>({ rank: "", minMmr: 0, maxMmr: "", sortOrder: 0 });
  const [newRank, setNewRank] = useState<AdminCreateRankConfigRequest>({ mode: "ranked", rank: "", minMmr: 0, sortOrder: 0 });
  const [newRankMaxMmr, setNewRankMaxMmr] = useState("");

  // Mobile sidebar
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Journal
  const [journalSubTab, setJournalSubTab] = useState<"logs" | "transactions" | "sanctions">("transactions");
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[] | null>(null);
  const [txJournal, setTxJournal] = useState<AdminTransactionJournalEntry[] | null>(null);
  const [sanctionJournal, setSanctionJournal] = useState<AdminSanctionEntry[] | null>(null);
  const [journalLoading, setJournalLoading] = useState(false);

  // Overview drill-downs
  const [activePlayersExpanded, setActivePlayersExpanded] = useState(false);
  const [activePlayersData, setActivePlayersData] = useState<AdminActivePlayerStatus[] | null>(null);
  const [activePlayersLoading, setActivePlayersLoading] = useState(false);
  const [dailyMatchesExpanded, setDailyMatchesExpanded] = useState(false);
  const [dailyMatchesData, setDailyMatchesData] = useState<AdminMatchDetail[] | null>(null);
  const [dailyMatchesLoading, setDailyMatchesLoading] = useState(false);

  // Analytics
  const [rankAnalytics, setRankAnalytics] = useState<StaffRankAnalyticsResponse | null>(null);
  const [economyAnalytics, setEconomyAnalytics] = useState<StaffEconomyAnalyticsResponse | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsLoaded, setAnalyticsLoaded] = useState(false);

  // Community
  const [adminMaps, setAdminMaps] = useState<StaffMapAdminItem[]>([]);
  const [mapsAnalytics, setMapsAnalytics] = useState<StaffMapsAnalyticsResponse | null>(null);
  const [communityLoading, setCommunityLoading] = useState(false);
  const [communityLoaded, setCommunityLoaded] = useState(false);
  const [communityBusy, setCommunityBusy] = useState(false);
  const [communityNotice, setCommunityNotice] = useState<string | null>(null);
  const [communityError, setCommunityError] = useState<string | null>(null);
  const [communitySubTab, setCommunitySubTab] = useState<"all" | "topPlayed" | "topRated" | "growing" | "abandoned" | "creators">("all");

  // Economy
  const [storeItems, setStoreItems] = useState<StoreItem[]>([]);
  const [economyLoading, setEconomyLoading] = useState(false);
  const [economyLoaded, setEconomyLoaded] = useState(false);
  const [economyBusy, setEconomyBusy] = useState(false);
  const [economyError, setEconomyError] = useState<string | null>(null);
  const [economyNotice, setEconomyNotice] = useState<string | null>(null);
  const [editingItemCode, setEditingItemCode] = useState<string | null>(null);
  const [editingPrice, setEditingPrice] = useState(0);
  const [newItem, setNewItem] = useState<AdminCreateStoreItemRequest>({ itemCode: "", name: "", description: "", currencyType: "soft", price: 0, sortOrder: 0 });
  const [newItemBusy, setNewItemBusy] = useState(false);
  const [newItemError, setNewItemError] = useState<string | null>(null);
  const [newItemNotice, setNewItemNotice] = useState<string | null>(null);

  const handleLogout = useCallback(async () => {
    await logout();
    router.replace("/login");
  }, [router]);

  useEffect(() => {
    async function load() {
      try {
        const me = await withToken((t) => authApi.me(t));
        if (me.role !== "staff" && me.role !== "admin") {
          router.replace("/dashboard");
          return;
        }
        setUser(me);
        const [dashData, settingsData, signalsData, histData] = await Promise.allSettled([
          withToken((t) => admin.getDashboard(t)),
          withToken((t) => admin.getSettings(t)),
          withToken((t) => admin.getModerationSignals(t)),
          withToken((t) => admin.getModerationHistory(t))
        ]);
        if (dashData.status === "fulfilled") setDash(dashData.value);
        if (settingsData.status === "fulfilled") {
          const s = settingsData.value;
          setSettings(s);
          setRankedWait(s.matchmaking.rankedQueueMaxWaitSeconds);
          setMatchSize(s.matchmaking.matchSize);
          setMaxMmrGap(s.matchmaking.maxMmrGap);
          setMatchDurationSeconds(s.matchmaking.matchDurationSeconds ?? 15);
          setRankedWin(s.mmr.rankedWinDelta);
          setRankedLoss(s.mmr.rankedLossDelta);
          setPurchaseEnabled(s.economy.purchaseEnabled);
          if (s.rewards) {
            setRankedBaseXp(s.rewards.rankedBaseXp);
            setUnrankedBaseXp(s.rewards.unrankedBaseXp);
            setFunBaseXp(s.rewards.funBaseXp);
            setWinBonusXp(s.rewards.winBonusXp);
            setLossXp(s.rewards.lossXp);
            setRankedSoftBase(s.rewards.rankedSoftBase);
            setRankedSoftWinBonus(s.rewards.rankedSoftWinBonus);
            setUnrankedSoftBase(s.rewards.unrankedSoftBase);
            setUnrankedSoftWinBonus(s.rewards.unrankedSoftWinBonus);
            setFunSoftBase(s.rewards.funSoftBase);
            setFunSoftWinBonus(s.rewards.funSoftWinBonus);
          }
        }
        if (signalsData.status === "fulfilled") setSignals(signalsData.value);
        if (histData.status === "fulfilled") setModHistory(histData.value);
      } catch {
        await logout();
        router.replace("/login");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [router]);

  function handleTabChange(next: Tab) {
    setTab(next);
    setSidebarOpen(false);
    if (next === "analytics" && !analyticsLoaded) handleLoadAnalytics();
    if (next === "community" && !communityLoaded) handleLoadCommunity();
    if (next === "economy" && !economyLoaded) handleLoadEconomy();
    if (next === "players" && players.length === 0) handleLoadPlayers();
    if (next === "settings" && !ranksLoaded) handleLoadRanks();
    if (next === "ranking" && !ranksLoaded) handleLoadRanks();
    if (next === "journal") handleLoadJournalSubTab("transactions");
    if (next === "matchmaking") handleLoadQueueSnapshot();
    if (next === "moderation") handleLoadMapReports();
  }

  async function handleLoadMapReports() {
    setMapReportsLoading(true);
    try {
      setMapReports(await withToken((t) => admin.getMapReports(t)));
    } catch { /* ignore */ } finally { setMapReportsLoading(false); }
  }

  async function handleDismissMapReport(id: string, action: "reviewed" | "dismissed") {
    try {
      await withToken((t) => admin.dismissMapReport(id, action, t));
      setMapReports((prev) => prev.filter((r) => r.id !== id));
    } catch { /* ignore */ }
  }

  async function handleLoadQueueSnapshot() {
    setQueueLoading(true);
    try {
      setQueueSnapshot(await withToken((t) => admin.getQueueSnapshot(t)));
    } catch { /* ignore */ } finally {
      setQueueLoading(false);
    }
  }

  async function handleLoadJournalSubTab(sub: "logs" | "transactions" | "sanctions") {
    setJournalSubTab(sub);
    setJournalLoading(true);
    try {
      if (sub === "transactions") {
        setTxJournal(await withToken((t) => admin.getTransactionJournal(t)));
      } else if (sub === "logs") {
        setAuditLogs(await withToken((t) => admin.getAuditLogs(t)));
      } else {
        setSanctionJournal(await withToken((t) => admin.getSanctionJournal(t)));
      }
    } catch { /* ignore */ } finally {
      setJournalLoading(false);
    }
  }

  async function handleToggleActivePlayers() {
    const next = !activePlayersExpanded;
    setActivePlayersExpanded(next);
    if (next && activePlayersData === null) {
      setActivePlayersLoading(true);
      try {
        setActivePlayersData(await withToken((t) => admin.getActivePlayers(t)));
      } catch { setActivePlayersData([]); } finally { setActivePlayersLoading(false); }
    }
  }

  async function handleRefreshActivePlayers() {
    setActivePlayersLoading(true);
    try {
      setActivePlayersData(await withToken((t) => admin.getActivePlayers(t)));
    } catch { /* ignore */ } finally { setActivePlayersLoading(false); }
  }

  async function handleToggleDailyMatches() {
    const next = !dailyMatchesExpanded;
    setDailyMatchesExpanded(next);
    if (next && dailyMatchesData === null) {
      setDailyMatchesLoading(true);
      try {
        setDailyMatchesData(await withToken((t) => admin.getDailyMatches(t)));
      } catch { setDailyMatchesData([]); } finally { setDailyMatchesLoading(false); }
    }
  }

  async function handleLoadPlayers() {
    setPlayersLoading(true);
    try {
      const list = await withToken((t) => admin.listPlayers(t));
      setPlayers(list);
    } catch { /* ignore */ } finally {
      setPlayersLoading(false);
    }
  }

  async function handleLoadAnalytics() {
    setAnalyticsLoading(true);
    try {
      const [ranks, eco] = await Promise.all([
        withToken((t) => admin.getRankAnalytics(t)),
        withToken((t) => admin.getEconomyAnalytics(t))
      ]);
      setRankAnalytics(ranks);
      setEconomyAnalytics(eco);
      setAnalyticsLoaded(true);
    } catch { /* ignore */ } finally {
      setAnalyticsLoading(false);
    }
  }

  async function handleLoadCommunity() {
    setCommunityLoading(true);
    try {
      const [maps, analytics] = await Promise.all([
        withToken((t) => admin.listAdminMaps(t)),
        withToken((t) => admin.getMapsAnalytics(t))
      ]);
      setAdminMaps(maps);
      setMapsAnalytics(analytics);
      setCommunityLoaded(true);
    } catch { /* ignore */ } finally {
      setCommunityLoading(false);
    }
  }

  async function handleLoadEconomy() {
    setEconomyLoading(true);
    try {
      const items = await withToken((t) => admin.listStoreItems(t));
      setStoreItems(items);
      setEconomyLoaded(true);
    } catch { /* ignore */ } finally {
      setEconomyLoading(false);
    }
  }

  function openEdit(p: AdminPlayerResponse) {
    setEditingPlayer(p);
    setEditForm({ role: p.role, email: p.email, pseudo: p.pseudo ?? "", region: p.region ?? "", bio: p.bio ?? "" });
    setPlayerError(null);
    setPlayerNotice(null);
    setPlayerTimeline(null);
    setTimelineLoading(true);
    withToken((t) => admin.getPlayerTimeline(p.id, t))
      .then(setPlayerTimeline)
      .catch(() => {/* ignore */})
      .finally(() => setTimelineLoading(false));
  }

  async function handleSavePlayer(e: React.FormEvent) {
    e.preventDefault();
    if (!editingPlayer) return;
    setPlayerBusy(true);
    setPlayerError(null);
    try {
      const updated = await withToken((t) => admin.updatePlayer(editingPlayer.id, editForm, t));
      setPlayers((prev) => prev.map((p) => p.id === updated.id ? updated : p));
      setEditingPlayer(updated);
      setPlayerNotice("Saved.");
      setTimeout(() => setPlayerNotice(null), 2500);
    } catch (err) {
      setPlayerError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setPlayerBusy(false);
    }
  }

  async function handleModerate(e: React.FormEvent) {
    e.preventDefault();
    setModBusy(true);
    setModError(null);
    try {
      if (modType === "account") {
        await withToken((t) =>
          admin.moderateAccount(modTargetId, { action: modAction, reason: modReason, durationHours: modDuration ? Number(modDuration) : undefined }, t)
        );
      } else {
        await withToken((t) =>
          admin.moderateMap(modTargetId, { action: modAction, reason: modReason }, t)
        );
      }
      const hist = await withToken((t) => admin.getModerationHistory(t));
      setModHistory(hist);
      setModNotice("Action applied successfully.");
      setModTargetId("");
      setModReason("");
      setModDuration("");
      setTimeout(() => setModNotice(null), 3000);
    } catch (err) {
      setModError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setModBusy(false);
    }
  }

  async function handleMapQuickAction(mapId: string, action: string, reason: string) {
    setCommunityBusy(true);
    setCommunityError(null);
    try {
      await withToken((t) => admin.moderateMap(mapId, { action, reason }, t));
      const [maps, analytics] = await Promise.all([
        withToken((t) => admin.listAdminMaps(t)),
        withToken((t) => admin.getMapsAnalytics(t))
      ]);
      setAdminMaps(maps);
      setMapsAnalytics(analytics);
      setCommunityNotice(`"${action}" applied.`);
      setTimeout(() => setCommunityNotice(null), 3000);
    } catch (err) {
      setCommunityError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setCommunityBusy(false);
    }
  }

  async function handleLoadRanks() {
    if (ranksLoaded) return;
    setRanksBusy(true);
    try {
      setRankConfigs(await withToken((t) => admin.listRankConfigs(t)));
      setRanksLoaded(true);
    } catch { /* ignore */ } finally { setRanksBusy(false); }
  }

  function startEditRank(r: AdminRankConfigItem) {
    setEditingRankId(r.id);
    setEditRankForm({ rank: r.rank, minMmr: r.minMmr, maxMmr: r.maxMmr !== undefined ? String(r.maxMmr) : "", sortOrder: r.sortOrder });
  }

  async function handleSaveRank(id: string) {
    setRanksBusy(true);
    setRanksError(null);
    try {
      const updated = await withToken((t) => admin.updateRankConfig(id, {
        rank: editRankForm.rank,
        minMmr: editRankForm.minMmr,
        maxMmr: editRankForm.maxMmr === "" ? null : Number(editRankForm.maxMmr),
        sortOrder: editRankForm.sortOrder
      }, t));
      setRankConfigs((prev) => prev.map((r) => r.id === id ? updated : r));
      setEditingRankId(null);
      setRanksNotice("Rank updated.");
      setTimeout(() => setRanksNotice(null), 2500);
    } catch (err) {
      setRanksError(err instanceof Error ? err.message : "Error");
    } finally { setRanksBusy(false); }
  }

  async function handleDeleteRank(id: string) {
    setRanksBusy(true);
    setRanksError(null);
    try {
      await withToken((t) => admin.deleteRankConfig(id, t));
      setRankConfigs((prev) => prev.filter((r) => r.id !== id));
      setRanksNotice("Rank deleted.");
      setTimeout(() => setRanksNotice(null), 2500);
    } catch (err) {
      setRanksError(err instanceof Error ? err.message : "Error");
    } finally { setRanksBusy(false); }
  }

  async function handleCreateRank(e: React.FormEvent) {
    e.preventDefault();
    setRanksBusy(true);
    setRanksError(null);
    try {
      const created = await withToken((t) => admin.createRankConfig({
        ...newRank,
        maxMmr: newRankMaxMmr === "" ? undefined : Number(newRankMaxMmr)
      }, t));
      setRankConfigs((prev) => [...prev, created].sort((a, b) => a.mode.localeCompare(b.mode) || a.sortOrder - b.sortOrder));
      setNewRank({ mode: "ranked", rank: "", minMmr: 0, sortOrder: 0 });
      setNewRankMaxMmr("");
      setRanksNotice("Rank created.");
      setTimeout(() => setRanksNotice(null), 2500);
    } catch (err) {
      setRanksError(err instanceof Error ? err.message : "Error");
    } finally { setRanksBusy(false); }
  }

  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    setSettingsBusy(true);
    setSettingsError(null);
    try {
      const updated = await withToken((t) =>
        admin.updateSettings({
          matchmaking: { rankedQueueMaxWaitSeconds: rankedWait, matchSize, maxMmrGap, matchDurationSeconds },
          mmr: { rankedWinDelta: rankedWin, rankedLossDelta: rankedLoss },
          economy: { purchaseEnabled },
          rewards: {
            rankedBaseXp, unrankedBaseXp, funBaseXp,
            winBonusXp, lossXp,
            rankedSoftBase, rankedSoftWinBonus,
            unrankedSoftBase, unrankedSoftWinBonus,
            funSoftBase, funSoftWinBonus
          }
        }, t)
      );
      setSettings(updated);
      setSettingsNotice("Settings saved.");
      setTimeout(() => setSettingsNotice(null), 3000);
    } catch (err) {
      setSettingsError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSettingsBusy(false);
    }
  }

  async function handleToggleStoreItem(itemCode: string, active: boolean) {
    setEconomyBusy(true);
    setEconomyError(null);
    try {
      const updated = await withToken((t) => admin.updateStoreItem(itemCode, { active }, t));
      setStoreItems((prev) => prev.map((i) => i.itemCode === updated.itemCode ? updated : i));
      setEconomyNotice(`${itemCode} ${active ? "activated" : "deactivated"}.`);
      setTimeout(() => setEconomyNotice(null), 2500);
    } catch (err) {
      setEconomyError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setEconomyBusy(false);
    }
  }

  async function handleUpdateItemPrice(itemCode: string, price: number) {
    setEconomyBusy(true);
    setEconomyError(null);
    try {
      const updated = await withToken((t) => admin.updateStoreItem(itemCode, { price }, t));
      setStoreItems((prev) => prev.map((i) => i.itemCode === updated.itemCode ? updated : i));
      setEditingItemCode(null);
    } catch (err) {
      setEconomyError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setEconomyBusy(false);
    }
  }

  async function handleCreateStoreItem(e: React.FormEvent) {
    e.preventDefault();
    setNewItemBusy(true);
    setNewItemError(null);
    try {
      const created = await withToken((t) => admin.createStoreItem(newItem, t));
      setStoreItems((prev) => [...prev, created]);
      setNewItem({ itemCode: "", name: "", description: "", currencyType: "soft", price: 0, sortOrder: 0 });
      setNewItemNotice("Item created.");
      setTimeout(() => setNewItemNotice(null), 3000);
    } catch (err) {
      setNewItemError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setNewItemBusy(false);
    }
  }

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "var(--bg)" }}>
        <div style={{ color: "var(--cyan)", fontSize: "1.2rem" }}>Loading…</div>
      </div>
    );
  }

  const openSignalCount = signals.filter((s) => s.status === "open").length + mapReports.length;

  const NAV_ITEMS: { id: Tab; icon: string; label: string }[] = [
    { id: "overview",    icon: "📊", label: "Overview" },
    { id: "analytics",   icon: "📈", label: "Analytics" },
    { id: "matchmaking", icon: "⚔️",  label: "Matchmaking" },
    { id: "ranking",     icon: "🏆", label: "Ranking" },
    { id: "community",   icon: "🗺️", label: "Community" },
    { id: "economy",     icon: "💰", label: "Economy" },
    { id: "players",     icon: "👥", label: "Players" },
    { id: "moderation",  icon: "🚨", label: "Moderation" },
    { id: "journal",     icon: "📋", label: "Journal" },
    { id: "settings",    icon: "⚙️", label: "Settings" },
  ];

  const PAGE_TITLES: Record<Tab, string> = {
    overview: "Overview", analytics: "Analytics", matchmaking: "Matchmaking",
    ranking: "Ranking", community: "Community", economy: "Economy", players: "Players",
    moderation: "Moderation", journal: "Journal", settings: "Settings"
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--bg)" }}>

      {/* Mobile overlay */}
      <div
        className={`admin-sidebar-overlay${sidebarOpen ? " open" : ""}`}
        onClick={() => setSidebarOpen(false)}
      />

      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <aside className={`admin-sidebar${sidebarOpen ? " open" : ""}`}>
        <Link href="/dashboard" style={{ display: "block", padding: "2rem 1.5rem 1.5rem", borderBottom: "1px solid var(--border)", textDecoration: "none" }}>
          <div style={{ fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: "0.15em", color: "var(--text-muted)", marginBottom: "0.3rem" }}>Studio</div>
          <div style={{ fontFamily: "Rajdhani, sans-serif", fontSize: "1.4rem", fontWeight: 700, color: "var(--cyan)", letterSpacing: "0.04em" }}>GameDash</div>
        </Link>

        <nav style={{ flex: 1, padding: "1rem 0.75rem" }}>
          {NAV_ITEMS.map(({ id, icon, label }) => (
            <button
              key={id}
              onClick={() => handleTabChange(id)}
              style={{
                display: "flex", alignItems: "center", gap: "0.75rem",
                width: "100%", padding: "0.7rem 0.875rem", marginBottom: "0.15rem",
                borderRadius: "0.5rem", border: "none", cursor: "pointer",
                fontFamily: "inherit", fontSize: "0.875rem", textAlign: "left",
                background: tab === id ? "rgba(0,212,255,0.08)" : "transparent",
                color: tab === id ? "var(--cyan)" : "var(--text-muted)",
                borderLeft: tab === id ? "2px solid var(--cyan)" : "2px solid transparent",
                transition: "background 0.15s, color 0.15s",
              }}
            >
              <span style={{ width: 20, flexShrink: 0, fontSize: "1rem" }}>{icon}</span>
              <span style={{ flex: 1, fontWeight: tab === id ? 600 : 400 }}>{label}</span>
              {id === "moderation" && openSignalCount > 0 && (
                <span style={{
                  background: "var(--red)", color: "#fff",
                  fontSize: "0.68rem", fontWeight: 700, borderRadius: "999px",
                  padding: "0.1rem 0.4rem", minWidth: "1.2rem", textAlign: "center"
                }}>{openSignalCount}</span>
              )}
            </button>
          ))}
        </nav>

        <div style={{ padding: "1.25rem 1.5rem", borderTop: "1px solid var(--border)" }}>
          <div style={{ fontSize: "0.85rem", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: "0.375rem", color: "var(--text-primary)" }}>
            {user?.profile?.pseudo ?? user?.email}
          </div>
          <div style={{ marginBottom: "1rem" }}>
            <span className={`tag ${user?.role === "admin" ? "tag-red" : "tag-gold"}`}>{user?.role}</span>
          </div>
          <button className="btn" style={{ width: "100%", fontSize: "0.8rem" }} onClick={handleLogout}>Sign out</button>
        </div>
      </aside>

      {/* ── Main content ────────────────────────────────────────────────── */}
      <main className="admin-main">
        {/* Mobile topbar */}
        <div className="admin-mobile-topbar">
          <button className="admin-hamburger" onClick={() => setSidebarOpen((v) => !v)}>☰</button>
          <span style={{ fontFamily: "Rajdhani, sans-serif", fontSize: "1.1rem", fontWeight: 700, color: "var(--cyan)", flex: 1 }}>
            {PAGE_TITLES[tab]}
          </span>
          <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 120 }}>
            {user?.profile?.pseudo ?? user?.email}
          </span>
        </div>
        <div className="admin-desktop-header" style={{ marginBottom: "2.5rem", paddingBottom: "1.25rem", borderBottom: "1px solid var(--border)" }}>
          <h1 style={{ margin: 0, fontSize: "1.75rem", fontFamily: "Rajdhani, sans-serif", fontWeight: 700, letterSpacing: "0.04em" }}>
            {PAGE_TITLES[tab]}
          </h1>
        </div>
        <div>

          {/* ── Overview ──────────────────────────────────────────────────── */}
          {tab === "overview" && dash && (
            <>
              <div className="grid-4" style={{ marginBottom: "2rem", gap: "1.25rem" }}>
                {/* Cliquable — active players */}
                <div
                  className="kpi-card cyan"
                  style={{ cursor: "pointer", outline: activePlayersExpanded ? "2px solid var(--cyan)" : undefined }}
                  onClick={handleToggleActivePlayers}
                  title="Cliquer pour voir le détail"
                >
                  <span className="kpi-icon">👥</span>
                  <span className="kpi-value">{dash.activePlayers.toLocaleString()}</span>
                  <span className="kpi-label">Active players {activePlayersExpanded ? "▲" : "▼"}</span>
                </div>

                {/* Cliquable — daily matches */}
                <div
                  className="kpi-card purple"
                  style={{ cursor: "pointer", outline: dailyMatchesExpanded ? "2px solid var(--purple, #a855f7)" : undefined }}
                  onClick={handleToggleDailyMatches}
                  title="Cliquer pour voir le détail"
                >
                  <span className="kpi-icon">⚔️</span>
                  <span className="kpi-value">{dash.dailyMatches.toLocaleString()}</span>
                  <span className="kpi-label">Daily matches {dailyMatchesExpanded ? "▲" : "▼"}</span>
                </div>

                <div className="kpi-card gold"><span className="kpi-icon">💰</span><span className="kpi-value">{dash.virtualRevenue.toLocaleString()}</span><span className="kpi-label">Virtual revenue</span></div>
                <div className="kpi-card green"><span className="kpi-icon">🗺️</span><span className="kpi-value">{dash.mapActivity.toLocaleString()}</span><span className="kpi-label">Map tests today</span></div>
              </div>

              {/* ── Drill-down : joueurs actifs ────────────────────────── */}
              {activePlayersExpanded && (
                <div className="card" style={{ marginBottom: "1.5rem" }}>
                  <div className="card-header">
                    <span className="card-title">Joueurs actifs en ce moment</span>
                    <button className="btn btn-sm" disabled={activePlayersLoading} onClick={handleRefreshActivePlayers}>
                      {activePlayersLoading ? "…" : "Rafraîchir"}
                    </button>
                  </div>
                  {activePlayersLoading && <div style={{ color: "var(--cyan)", fontSize: "0.85rem" }}>Chargement…</div>}
                  {!activePlayersLoading && activePlayersData !== null && (
                    activePlayersData.length === 0
                      ? <div style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>Aucun joueur actif actuellement.</div>
                      : (
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
                          <thead>
                            <tr style={{ color: "var(--text-muted)", textAlign: "left" }}>
                              <th style={{ padding: "0.7rem 1rem" }}>Joueur</th>
                              <th style={{ padding: "0.7rem 1rem" }}>Statut</th>
                              <th style={{ padding: "0.7rem 1rem" }}>Mode</th>
                              <th style={{ padding: "0.7rem 1rem" }}>Match ID</th>
                              <th style={{ padding: "0.7rem 1rem" }}>En file depuis</th>
                            </tr>
                          </thead>
                          <tbody>
                            {activePlayersData.map((p) => (
                              <tr key={p.playerId} style={{ borderTop: "1px solid var(--border)" }}>
                                <td style={{ padding: "0.7rem 1rem" }}>
                                  {p.pseudo ?? <span style={{ fontFamily: "monospace", fontSize: "0.78rem", color: "var(--text-muted)" }}>{p.playerId.slice(0, 12)}…</span>}
                                </td>
                                <td style={{ padding: "0.7rem 1rem" }}>
                                  <span className={`tag ${p.state === "in_match" ? "tag-cyan" : p.state === "in_queue" ? "tag-gold" : "tag-purple"}`}>
                                    {{ in_match: "En match", in_queue: "En attente", online: "Connecté" }[p.state]}
                                  </span>
                                </td>
                                <td style={{ padding: "0.7rem 1rem", color: "var(--text-muted)" }}>
                                  {p.mode ?? "—"}
                                </td>
                                <td style={{ padding: "0.7rem 1rem", fontFamily: "monospace", fontSize: "0.78rem", color: "var(--text-muted)" }}>
                                  {p.matchId ? `${p.matchId.slice(0, 8)}…` : "—"}
                                </td>
                                <td style={{ padding: "0.7rem 1rem", color: "var(--text-muted)", fontSize: "0.78rem" }}>
                                  {p.queuedAt ? new Date(p.queuedAt).toLocaleTimeString() : "—"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )
                  )}
                </div>
              )}

              {/* ── Drill-down : matchs du jour ────────────────────────── */}
              {dailyMatchesExpanded && (
                <div className="card" style={{ marginBottom: "1.5rem" }}>
                  <div className="card-header">
                    <span className="card-title">Matchs des dernières 24h</span>
                    <span className="tag tag-purple">{dailyMatchesData?.length ?? 0}</span>
                  </div>
                  {dailyMatchesLoading && <div style={{ color: "var(--cyan)", fontSize: "0.85rem" }}>Chargement…</div>}
                  {!dailyMatchesLoading && dailyMatchesData !== null && (
                    dailyMatchesData.length === 0
                      ? <div style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>Aucun match aujourd'hui.</div>
                      : (
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
                          <thead>
                            <tr style={{ color: "var(--text-muted)", textAlign: "left" }}>
                              <th style={{ padding: "0.7rem 1rem" }}>Match</th>
                              <th style={{ padding: "0.7rem 1rem" }}>Mode</th>
                              <th style={{ padding: "0.7rem 1rem" }}>Date</th>
                              <th style={{ padding: "0.7rem 1rem" }}>Durée</th>
                              <th style={{ padding: "0.7rem 1rem" }}>Résultats</th>
                            </tr>
                          </thead>
                          <tbody>
                            {dailyMatchesData.map((m) => {
                              const durStr = m.durationSeconds != null
                                ? `${Math.floor(m.durationSeconds / 60)}m${m.durationSeconds % 60}s`
                                : "In progress";
                              const is3v3 = m.format === "3v3";

                              const renderTeam = (outcome: "win" | "loss") => {
                                const members = m.participants.filter((p) => p.outcome === outcome);
                                if (members.length === 0) return null;
                                const delta = members[0]?.mmrDelta ?? 0;
                                const color = outcome === "win" ? "var(--green)" : "var(--red)";
                                const tagClass = outcome === "win" ? "tag-cyan" : "tag-red";
                                return (
                                  <span style={{ display: "flex", alignItems: "center", gap: "0.3rem", flexWrap: "wrap" }}>
                                    {members.map((p, i) => (
                                      <span key={p.playerId} style={{ color: outcome === "win" ? color : "var(--text-muted)", fontWeight: 600 }}>
                                        {p.pseudo ?? p.playerId.slice(0, 8)}{i < members.length - 1 ? "," : ""}
                                      </span>
                                    ))}
                                    <span className={`tag ${tagClass}`} style={{ fontSize: "0.68rem" }}>{outcome.toUpperCase()}</span>
                                    <span style={{ color, fontSize: "0.78rem" }}>{delta > 0 ? "+" : ""}{delta}</span>
                                  </span>
                                );
                              };

                              return (
                                <tr key={m.matchId} style={{ borderTop: "1px solid var(--border)" }}>
                                  <td style={{ padding: "0.7rem 1rem", fontFamily: "monospace", fontSize: "0.78rem", color: "var(--text-muted)" }}>
                                    {m.matchId.slice(0, 8)}…
                                  </td>
                                  <td style={{ padding: "0.7rem 1rem" }}>
                                    <span className={`tag ${m.mode === "ranked" ? "tag-cyan" : m.mode === "unranked" ? "tag-purple" : "tag-gold"}`}>
                                      {m.mode}
                                    </span>
                                    {is3v3 && <span className="tag tag-purple" style={{ marginLeft: "0.25rem", fontSize: "0.68rem" }}>3v3</span>}
                                  </td>
                                  <td style={{ padding: "0.7rem 1rem", color: "var(--text-muted)", fontSize: "0.78rem" }}>
                                    {new Date(m.startedAt).toLocaleTimeString()}
                                  </td>
                                  <td style={{ padding: "0.7rem 1rem", color: "var(--text-muted)" }}>
                                    {durStr}
                                  </td>
                                  <td style={{ padding: "0.7rem 1rem" }}>
                                    <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center" }}>
                                      {renderTeam("win")}
                                      {m.participants.some((p) => p.outcome === "win") && m.participants.some((p) => p.outcome === "loss") && (
                                        <span style={{ color: "var(--text-muted)" }}>vs</span>
                                      )}
                                      {renderTeam("loss")}
                                      {!m.participants.some((p) => p.outcome === "win") && !m.participants.some((p) => p.outcome === "loss") && m.participants.map((p) => (
                                        <span key={p.playerId} style={{ color: "var(--text-muted)", fontSize: "0.78rem" }}>
                                          {p.pseudo ?? p.playerId.slice(0, 8)} ({p.outcome})
                                        </span>
                                      ))}
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      )
                  )}
                </div>
              )}

              <div className="grid-2" style={{ gap: "1.25rem" }}>
                <div className="kpi-card" style={{ border: "1px solid var(--border)" }}>
                  <span className="kpi-icon">🚨</span>
                  <span className="kpi-value" style={{ color: "var(--orange)" }}>{dash.openModerationSignals}</span>
                  <span className="kpi-label">Open signals</span>
                </div>
                <div className="kpi-card" style={{ border: "1px solid var(--border)" }}>
                  <span className="kpi-icon">🔒</span>
                  <span className="kpi-value" style={{ color: "var(--red)" }}>{dash.activeSanctions}</span>
                  <span className="kpi-label">Active sanctions</span>
                </div>
              </div>
            </>
          )}

          {/* ── Matchmaking ───────────────────────────────────────────────── */}
          {tab === "matchmaking" && (
            <div style={{ display: "grid", gap: "2rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                <span style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>
                  MMR gap limit: <strong style={{ color: "var(--cyan)" }}>{queueSnapshot?.maxMmrGap ?? "…"}</strong>
                  {" · "}Team size: <strong style={{ color: "var(--cyan)" }}>{queueSnapshot?.teamSize ?? "…"}</strong>
                </span>
                <button className="btn btn-sm" disabled={queueLoading} onClick={handleLoadQueueSnapshot}>
                  {queueLoading ? "…" : "Refresh"}
                </button>
              </div>

              {/* In-queue players */}
              <div className="card" style={{ overflowX: "auto" }}>
                <div className="card-header">
                  <span className="card-title">Players in queue</span>
                  <span className="tag tag-cyan">{queueSnapshot?.inQueue.length ?? 0}</span>
                </div>
                {queueLoading && !queueSnapshot
                  ? <div style={{ color: "var(--cyan)", fontSize: "0.85rem" }}>Loading…</div>
                  : queueSnapshot?.inQueue.length === 0
                    ? <div style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>Queue empty.</div>
                    : (
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
                        <thead>
                          <tr style={{ color: "var(--text-muted)", textAlign: "left" }}>
                            <th style={{ padding: "0.7rem 1rem" }}>Player</th>
                            <th style={{ padding: "0.7rem 1rem" }}>Mode</th>
                            <th style={{ padding: "0.7rem 1rem", textAlign: "right" }}>MMR</th>
                            <th style={{ padding: "0.7rem 1rem" }}>Rank</th>
                            <th style={{ padding: "0.7rem 1rem" }}>In queue since</th>
                          </tr>
                        </thead>
                        <tbody>
                          {queueSnapshot?.inQueue.map((entry) => (
                            <tr key={entry.playerId} style={{ borderTop: "1px solid var(--border)" }}>
                              <td style={{ padding: "0.7rem 1rem" }}>
                                {entry.pseudo ?? <span style={{ fontFamily: "monospace", fontSize: "0.78rem", color: "var(--text-muted)" }}>{entry.playerId.slice(0, 8)}</span>}
                              </td>
                              <td style={{ padding: "0.7rem 1rem" }}>
                                <span className={`tag ${entry.mode === "ranked" ? "tag-cyan" : entry.mode === "unranked" ? "tag-purple" : "tag-gold"}`}>{entry.mode}</span>
                              </td>
                              <td style={{ padding: "0.7rem 1rem", textAlign: "right", fontFamily: "monospace" }}>{entry.mmr}</td>
                              <td style={{ padding: "0.7rem 1rem" }}>{entry.rank}</td>
                              <td style={{ padding: "0.7rem 1rem", color: "var(--text-muted)", fontSize: "0.75rem" }}>
                                {new Date(entry.queuedAt).toLocaleTimeString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )
                }
              </div>

              {/* Live matches */}
              <div className="card">
                <div className="card-header">
                  <span className="card-title">Live matches</span>
                  <span className="tag tag-green">{queueSnapshot?.liveMatches.length ?? 0}</span>
                </div>
                {queueSnapshot?.liveMatches.length === 0
                  ? <div style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>No live matches.</div>
                  : (
                    <div style={{ display: "grid", gap: "0.75rem" }}>
                      {queueSnapshot?.liveMatches.map((match) => (
                        <div key={match.matchId} style={{ border: "1px solid var(--border)", borderRadius: "0.5rem", padding: "0.75rem 1rem" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem" }}>
                            <span className={`tag ${match.mode === "ranked" ? "tag-cyan" : match.mode === "unranked" ? "tag-purple" : "tag-gold"}`}>{match.mode}</span>
                            <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>{match.matchId.slice(0, 12)}…</span>
                            <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>{new Date(match.startedAt).toLocaleTimeString()}</span>
                            <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>· {match.teamSize}v{match.teamSize}</span>
                          </div>
                          <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap" }}>
                            {match.participants.map((p, i) => (
                              <div key={p.playerId} style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.875rem" }}>
                                {i > 0 && <span style={{ color: "var(--text-muted)", marginRight: "0.75rem" }}>vs</span>}
                                <span>{p.pseudo ?? <span style={{ fontFamily: "monospace", fontSize: "0.78rem", color: "var(--text-muted)" }}>{p.playerId.slice(0, 8)}</span>}</span>
                                <span style={{ fontFamily: "monospace", color: "var(--cyan)", fontSize: "0.78rem" }}>{p.mmr}</span>
                                <span style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>{p.rank}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                }
              </div>
            </div>
          )}

          {/* ── Analytics ─────────────────────────────────────────────────── */}
          {tab === "analytics" && (
            analyticsLoading
              ? <div style={{ color: "var(--cyan)", padding: "2rem 0" }}>Loading analytics…</div>
              : (
                <div style={{ display: "grid", gap: "2rem" }}>
                  {/* Economy KPIs */}
                  {economyAnalytics && (
                    <>
                      <div className="grid-4" style={{ gap: "1.25rem" }}>
                        <div className="kpi-card gold"><span className="kpi-icon">💰</span><span className="kpi-value">{economyAnalytics.revenueToday.toLocaleString()}</span><span className="kpi-label">Revenue today</span></div>
                        <div className="kpi-card gold"><span className="kpi-icon">📈</span><span className="kpi-value">{economyAnalytics.revenueWeek.toLocaleString()}</span><span className="kpi-label">Revenue (7d)</span></div>
                        <div className="kpi-card cyan"><span className="kpi-icon">🛒</span><span className="kpi-value">{economyAnalytics.salesToday.toLocaleString()}</span><span className="kpi-label">Sales today</span></div>
                        <div className="kpi-card cyan"><span className="kpi-icon">📦</span><span className="kpi-value">{economyAnalytics.salesWeek.toLocaleString()}</span><span className="kpi-label">Sales (7d)</span></div>
                      </div>

                      <div className="card">
                        <div className="card-header"><span className="card-title">Top selling items (all time)</span></div>
                        {economyAnalytics.topItems.length === 0
                          ? <div style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>No sales yet.</div>
                          : (
                            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
                              <thead>
                                <tr style={{ color: "var(--text-muted)", textAlign: "left" }}>
                                  <th style={{ padding: "0.7rem 1rem" }}>Item</th>
                                  <th style={{ padding: "0.7rem 1rem" }}>Currency</th>
                                  <th style={{ padding: "0.7rem 1rem", textAlign: "right" }}>Sales</th>
                                  <th style={{ padding: "0.7rem 1rem", textAlign: "right" }}>Revenue</th>
                                </tr>
                              </thead>
                              <tbody>
                                {economyAnalytics.topItems.map((item) => (
                                  <tr key={item.itemCode} style={{ borderTop: "1px solid var(--border)" }}>
                                    <td style={{ padding: "0.7rem 1rem" }}>{item.name}<span style={{ color: "var(--text-muted)", marginLeft: "0.4rem", fontSize: "0.78rem" }}>{item.itemCode}</span></td>
                                    <td style={{ padding: "0.7rem 1rem" }}><span className={`tag ${item.currencyType === "hard" ? "tag-gold" : "tag-cyan"}`}>{item.currencyType}</span></td>
                                    <td style={{ padding: "0.7rem 1rem", textAlign: "right" }}>{item.salesCount}</td>
                                    <td style={{ padding: "0.7rem 1rem", textAlign: "right", fontWeight: 600 }}>{item.revenue.toLocaleString()}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )
                        }
                      </div>
                    </>
                  )}

                  {/* Rank distribution */}
                  {rankAnalytics && (
                    <div className="card">
                      <div className="card-header">
                        <span className="card-title">Rank distribution (ranked mode)</span>
                        <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                          {rankAnalytics.totalRankedPlayers} players · global win rate {rankAnalytics.globalAvgWinRate}%
                        </span>
                      </div>
                      {rankAnalytics.distribution.length === 0
                        ? <div style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>No ranked data yet.</div>
                        : (
                          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
                            <thead>
                              <tr style={{ color: "var(--text-muted)", textAlign: "left" }}>
                                <th style={{ padding: "0.7rem 1rem" }}>Rank</th>
                                <th style={{ padding: "0.7rem 1rem", textAlign: "right" }}>Players</th>
                                <th style={{ padding: "0.7rem 1rem", textAlign: "right" }}>Share</th>
                                <th style={{ padding: "0.7rem 1rem", textAlign: "right" }}>Avg win rate</th>
                              </tr>
                            </thead>
                            <tbody>
                              {rankAnalytics.distribution.map((d) => {
                                const share = rankAnalytics.totalRankedPlayers > 0
                                  ? Math.round((d.count / rankAnalytics.totalRankedPlayers) * 100)
                                  : 0;
                                return (
                                  <tr key={d.rank} style={{ borderTop: "1px solid var(--border)" }}>
                                    <td style={{ padding: "0.7rem 1rem", fontWeight: 500 }}>{d.rank}</td>
                                    <td style={{ padding: "0.7rem 1rem", textAlign: "right" }}>{d.count}</td>
                                    <td style={{ padding: "0.7rem 1rem", textAlign: "right" }}>
                                      <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", justifyContent: "flex-end" }}>
                                        <div style={{ width: 60, height: 4, background: "var(--border)", borderRadius: 2, overflow: "hidden" }}>
                                          <div style={{ width: `${share}%`, height: "100%", background: "var(--cyan)", borderRadius: 2 }} />
                                        </div>
                                        {share}%
                                      </div>
                                    </td>
                                    <td style={{ padding: "0.7rem 1rem", textAlign: "right", color: d.avgWinRate >= 50 ? "var(--green)" : "var(--text-muted)" }}>
                                      {d.avgWinRate}%
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        )
                      }
                    </div>
                  )}
                </div>
              )
          )}

          {/* ── Community ─────────────────────────────────────────────────── */}
          {tab === "community" && (
            communityLoading
              ? <div style={{ color: "var(--cyan)", padding: "2rem 0" }}>Loading community data…</div>
              : (
                <div style={{ display: "grid", gap: "2rem" }}>
                  {communityNotice && <div className="success-banner">{communityNotice}</div>}
                  {communityError && <div className="error-banner">{communityError}</div>}

                  {/* Sub-tab bar */}
                  <div className="tab-bar">
                    {(["all", "topPlayed", "topRated", "growing", "abandoned", "creators"] as const).map((st) => (
                      <button
                        key={st}
                        className={`tab-btn${communitySubTab === st ? " active" : ""}`}
                        onClick={() => setCommunitySubTab(st)}
                        style={{ fontSize: "0.8rem" }}
                      >
                        {{ all: "All maps", topPlayed: "Top played", topRated: "Top rated", growing: "Growing", abandoned: "Abandoned", creators: "Creators" }[st]}
                      </button>
                    ))}
                  </div>

                  {/* All maps table */}
                  {communitySubTab === "all" && (
                    <div className="card" style={{ overflowX: "auto" }}>
                      <div className="card-header">
                        <span className="card-title">All maps</span>
                        <span className="tag tag-purple">{adminMaps.length}</span>
                      </div>
                      {adminMaps.length === 0
                        ? <div style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>No maps found.</div>
                        : (
                          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                            <thead>
                              <tr style={{ color: "var(--text-muted)", textAlign: "left" }}>
                                <th style={{ padding: "0.7rem 1rem" }}>Title</th>
                                <th style={{ padding: "0.7rem 1rem" }}>Creator</th>
                                <th style={{ padding: "0.7rem 1rem" }}>Status</th>
                                <th style={{ padding: "0.7rem 1rem", textAlign: "right" }}>Votes</th>
                                <th style={{ padding: "0.7rem 1rem", textAlign: "right" }}>Tests</th>
                                <th style={{ padding: "0.7rem 1rem", textAlign: "right" }}>Reports</th>
                                <th style={{ padding: "0.7rem 1rem" }}>Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {adminMaps.map((m) => (
                                <tr key={m.id} style={{ borderTop: "1px solid var(--border)" }}>
                                  <td style={{ padding: "0.7rem 1rem", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                    {m.reviewStatus === "featured" && <span style={{ color: "var(--gold)", marginRight: "0.25rem" }}>⭐</span>}
                                    {m.title}
                                  </td>
                                  <td style={{ padding: "0.7rem 1rem", color: "var(--text-muted)" }}>{m.creatorPseudo ?? m.creatorId.slice(0, 8)}</td>
                                  <td style={{ padding: "0.7rem 1rem" }}>
                                    <span className={`tag ${STATUS_COLORS[m.status] ?? "tag-cyan"}`}>{m.status}</span>
                                  </td>
                                  <td style={{ padding: "0.7rem 1rem", textAlign: "right", color: m.voteScore > 0 ? "var(--green)" : m.voteScore < 0 ? "var(--red)" : undefined }}>
                                    {m.voteScore > 0 ? "+" : ""}{m.voteScore}
                                  </td>
                                  <td style={{ padding: "0.7rem 1rem", textAlign: "right" }}>{m.testCount}</td>
                                  <td style={{ padding: "0.7rem 1rem", textAlign: "right", color: m.reportCount > 0 ? "var(--red)" : undefined }}>
                                    {m.reportCount > 0 ? `⚠ ${m.reportCount}` : m.reportCount}
                                  </td>
                                  <td style={{ padding: "0.7rem 1rem" }}>
                                    <div style={{ display: "flex", gap: "0.25rem", flexWrap: "wrap" }}>
                                      <button className="btn btn-sm" title="Feature" disabled={communityBusy} onClick={() => handleMapQuickAction(m.id, "feature", "Featured by staff")}>⭐</button>
                                      <button className="btn btn-sm" title="Validate (→ stable)" disabled={communityBusy} onClick={() => handleMapQuickAction(m.id, "validate", "Approved by staff")}>✓</button>
                                      <button className="btn btn-sm" title="Hide" disabled={communityBusy} style={{ color: "var(--red)" }} onClick={() => handleMapQuickAction(m.id, "hide", "Hidden by staff")}>✕</button>
                                      <button className="btn btn-sm" title="Restore (→ stable)" disabled={communityBusy} onClick={() => handleMapQuickAction(m.id, "restore", "Restored by staff")}>↩</button>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )
                      }
                    </div>
                  )}

                  {/* Analytics sub-tabs */}
                  {communitySubTab !== "all" && communitySubTab !== "creators" && mapsAnalytics && (() => {
                    const lists: Record<string, StaffMapAdminItem[]> = {
                      topPlayed: mapsAnalytics.topPlayed,
                      topRated: mapsAnalytics.topRated,
                      growing: mapsAnalytics.growing,
                      abandoned: mapsAnalytics.abandoned
                    };
                    const subtitles: Record<string, string> = {
                      topPlayed: "Most tested in the last 7 days",
                      topRated: "Highest vote score",
                      growing: "Most activity in the last 3 days",
                      abandoned: "No activity in 30+ days"
                    };
                    const items = lists[communitySubTab] ?? [];
                    return (
                      <div className="card" style={{ overflowX: "auto" }}>
                        <div className="card-header">
                          <span className="card-title">{{ topPlayed: "Top played", topRated: "Top rated", growing: "Growing", abandoned: "Abandoned" }[communitySubTab]}</span>
                          <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>{subtitles[communitySubTab]}</span>
                        </div>
                        {items.length === 0
                          ? <div style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>No maps in this category.</div>
                          : (
                            <div style={{ display: "grid", gap: "0.5rem" }}>
                              {items.map((m) => (
                                <div key={m.id} style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.7rem 1rem", borderRadius: "0.375rem", border: "1px solid var(--border)", fontSize: "0.875rem" }}>
                                  <span className={`tag ${STATUS_COLORS[m.status] ?? "tag-cyan"}`}>{m.status}</span>
                                  <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.title}</span>
                                  <span style={{ color: "var(--text-muted)", fontSize: "0.78rem" }}>{m.creatorPseudo ?? m.creatorId.slice(0, 8)}</span>
                                  <span style={{ color: m.voteScore >= 0 ? "var(--green)" : "var(--red)", minWidth: 32, textAlign: "right" }}>{m.voteScore > 0 ? "+" : ""}{m.voteScore}</span>
                                  <span style={{ color: "var(--text-muted)", minWidth: 48, textAlign: "right" }}>{m.testCount} tests</span>
                                  <div style={{ display: "flex", gap: "0.25rem" }}>
                                    <button className="btn btn-sm" disabled={communityBusy} onClick={() => handleMapQuickAction(m.id, "feature", "Featured by staff")}>⭐</button>
                                    <button className="btn btn-sm" disabled={communityBusy} onClick={() => handleMapQuickAction(m.id, "validate", "Approved by staff")}>✓</button>
                                    <button className="btn btn-sm" disabled={communityBusy} style={{ color: "var(--red)" }} onClick={() => handleMapQuickAction(m.id, "hide", "Hidden by staff")}>✕</button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )
                        }
                      </div>
                    );
                  })()}

                  {/* Creators */}
                  {communitySubTab === "creators" && mapsAnalytics && (
                    <div className="card">
                      <div className="card-header">
                        <span className="card-title">Most active creators</span>
                        <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>Ranked by total tests</span>
                      </div>
                      {mapsAnalytics.activeCreators.length === 0
                        ? <div style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>No creators yet.</div>
                        : (
                          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
                            <thead>
                              <tr style={{ color: "var(--text-muted)", textAlign: "left" }}>
                                <th style={{ padding: "0.7rem 1rem" }}>Creator</th>
                                <th style={{ padding: "0.7rem 1rem", textAlign: "right" }}>Maps</th>
                                <th style={{ padding: "0.7rem 1rem", textAlign: "right" }}>Votes</th>
                                <th style={{ padding: "0.7rem 1rem", textAlign: "right" }}>Tests</th>
                              </tr>
                            </thead>
                            <tbody>
                              {mapsAnalytics.activeCreators.map((c, i) => (
                                <tr key={c.creatorId} style={{ borderTop: "1px solid var(--border)" }}>
                                  <td style={{ padding: "0.7rem 1rem" }}>
                                    <span style={{ color: "var(--text-muted)", marginRight: "0.5rem", fontSize: "0.78rem" }}>#{i + 1}</span>
                                    {c.pseudo ?? <span style={{ fontFamily: "monospace", fontSize: "0.78rem" }}>{c.creatorId.slice(0, 12)}</span>}
                                  </td>
                                  <td style={{ padding: "0.7rem 1rem", textAlign: "right" }}>{c.mapCount}</td>
                                  <td style={{ padding: "0.7rem 1rem", textAlign: "right", color: c.totalVotes > 0 ? "var(--green)" : undefined }}>{c.totalVotes > 0 ? "+" : ""}{c.totalVotes}</td>
                                  <td style={{ padding: "0.7rem 1rem", textAlign: "right", fontWeight: 600 }}>{c.totalTests}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )
                      }
                    </div>
                  )}
                </div>
              )
          )}

          {/* ── Economy ───────────────────────────────────────────────────── */}
          {tab === "economy" && (
            economyLoading
              ? <div style={{ color: "var(--cyan)", padding: "2rem 0" }}>Loading store…</div>
              : (
                <div className="grid-2" style={{ alignItems: "start" }}>
                  {/* Create item */}
                  <div className="card">
                    <div className="card-header"><span className="card-title">New store item</span></div>
                    {newItemNotice && <div className="success-banner" style={{ marginBottom: "0.75rem" }}>{newItemNotice}</div>}
                    {newItemError && <div className="error-banner" style={{ marginBottom: "0.75rem" }}>{newItemError}</div>}
                    <form className="auth-form" onSubmit={handleCreateStoreItem}>
                      <div className="form-group">
                        <label className="form-label">Item code</label>
                        <input className="form-input" value={newItem.itemCode} required placeholder="skin_rare_01" onChange={(e) => setNewItem((p) => ({ ...p, itemCode: e.target.value }))} />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Name</label>
                        <input className="form-input" value={newItem.name} required placeholder="Rare Skin" onChange={(e) => setNewItem((p) => ({ ...p, name: e.target.value }))} />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Description</label>
                        <input className="form-input" value={newItem.description ?? ""} placeholder="Optional description" onChange={(e) => setNewItem((p) => ({ ...p, description: e.target.value }))} />
                      </div>
                      <div className="grid-2">
                        <div className="form-group">
                          <label className="form-label">Currency</label>
                          <select className="form-input" value={newItem.currencyType} onChange={(e) => setNewItem((p) => ({ ...p, currencyType: e.target.value as "soft" | "hard" }))}>
                            <option value="soft">Soft</option>
                            <option value="hard">Hard</option>
                          </select>
                        </div>
                        <div className="form-group">
                          <label className="form-label">Price</label>
                          <input className="form-input" type="number" min={0} value={newItem.price} onChange={(e) => setNewItem((p) => ({ ...p, price: Number(e.target.value) }))} />
                        </div>
                      </div>
                      <div className="form-group">
                        <label className="form-label">Sort order</label>
                        <input className="form-input" type="number" value={newItem.sortOrder ?? 0} onChange={(e) => setNewItem((p) => ({ ...p, sortOrder: Number(e.target.value) }))} />
                      </div>
                      <button className="btn btn-primary btn-full" type="submit" disabled={newItemBusy}>{newItemBusy ? "Creating…" : "Create item"}</button>
                    </form>
                  </div>

                  {/* Store items list */}
                  <div className="card" style={{ overflowX: "auto" }}>
                    <div className="card-header">
                      <span className="card-title">Store items</span>
                      {economyNotice && <span className="tag tag-cyan">{economyNotice}</span>}
                    </div>
                    {economyError && <div className="error-banner" style={{ marginBottom: "0.5rem" }}>{economyError}</div>}
                    {storeItems.length === 0
                      ? <div style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>No items yet.</div>
                      : (
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                          <thead>
                            <tr style={{ color: "var(--text-muted)", textAlign: "left" }}>
                              <th style={{ padding: "0.7rem 1rem" }}>Code</th>
                              <th style={{ padding: "0.7rem 1rem" }}>Name</th>
                              <th style={{ padding: "0.7rem 1rem" }}>Currency</th>
                              <th style={{ padding: "0.7rem 1rem", textAlign: "right" }}>Price</th>
                              <th style={{ padding: "0.7rem 1rem" }}>Active</th>
                            </tr>
                          </thead>
                          <tbody>
                            {storeItems.map((item) => (
                              <tr key={item.itemCode} style={{ borderTop: "1px solid var(--border)", opacity: item.active ? 1 : 0.5 }}>
                                <td style={{ padding: "0.7rem 1rem", fontFamily: "monospace", fontSize: "0.78rem", color: "var(--text-muted)" }}>{item.itemCode}</td>
                                <td style={{ padding: "0.7rem 1rem" }}>{item.name}</td>
                                <td style={{ padding: "0.7rem 1rem" }}>
                                  <span className={`tag ${item.currencyType === "hard" ? "tag-gold" : "tag-cyan"}`}>{item.currencyType}</span>
                                </td>
                                <td style={{ padding: "0.7rem 1rem", textAlign: "right" }}>
                                  {editingItemCode === item.itemCode
                                    ? (
                                      <input
                                        type="number"
                                        className="form-input"
                                        style={{ width: 72, padding: "0.1rem 0.3rem", fontSize: "0.85rem" }}
                                        value={editingPrice}
                                        min={0}
                                        onChange={(e) => setEditingPrice(Number(e.target.value))}
                                        onBlur={() => handleUpdateItemPrice(item.itemCode, editingPrice)}
                                        onKeyDown={(e) => { if (e.key === "Enter") handleUpdateItemPrice(item.itemCode, editingPrice); if (e.key === "Escape") setEditingItemCode(null); }}
                                        autoFocus
                                      />
                                    )
                                    : (
                                      <span
                                        style={{ cursor: "pointer", borderBottom: "1px dashed var(--text-muted)" }}
                                        title="Click to edit price"
                                        onClick={() => { setEditingItemCode(item.itemCode); setEditingPrice(item.price); }}
                                      >
                                        {item.price}
                                      </span>
                                    )
                                  }
                                </td>
                                <td style={{ padding: "0.7rem 1rem" }}>
                                  <button
                                    className={`btn btn-sm ${item.active ? "" : "btn-primary"}`}
                                    disabled={economyBusy}
                                    onClick={() => handleToggleStoreItem(item.itemCode, !item.active)}
                                  >
                                    {item.active ? "Deactivate" : "Activate"}
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )
                    }
                  </div>
                </div>
              )
          )}

          {/* ── Settings ──────────────────────────────────────────────────── */}
          {tab === "settings" && (
            <div style={{ display: "grid", gap: "2rem", maxWidth: 840 }}>
              {/* ── Studio settings form ────────────────────────────────── */}
              <div style={{ maxWidth: 560 }}>
                {settingsNotice && <div className="success-banner" style={{ marginBottom: "1rem" }}>{settingsNotice}</div>}
                {settingsError && <div className="error-banner" style={{ marginBottom: "1rem" }}>{settingsError}</div>}
                {user?.role !== "admin" && (
                  <div className="error-banner" style={{ marginBottom: "1rem" }}>Read-only — only admins can edit settings.</div>
                )}
                <form className="card auth-form" onSubmit={handleSaveSettings}>
                  <div className="card-header"><span className="card-title">Matchmaking</span></div>
                  <div className="grid-2">
                    <div className="form-group">
                      <label className="form-label">Ranked queue max wait (s)</label>
                      <input className="form-input" type="number" value={rankedWait} onChange={(e) => setRankedWait(Number(e.target.value))} disabled={user?.role !== "admin"} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Match size</label>
                      <input className="form-input" type="number" min={2} value={matchSize} onChange={(e) => setMatchSize(Number(e.target.value))} disabled={user?.role !== "admin"} />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Max MMR gap between opponents</label>
                    <input className="form-input" type="number" min={0} value={maxMmrGap} onChange={(e) => setMaxMmrGap(Number(e.target.value))} disabled={user?.role !== "admin"} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Match duration (seconds)</label>
                    <input className="form-input" type="number" min={5} max={3600} value={matchDurationSeconds} onChange={(e) => setMatchDurationSeconds(Number(e.target.value))} disabled={user?.role !== "admin"} />
                  </div>

                  <div className="card-header" style={{ marginTop: "0.5rem" }}><span className="card-title">MMR deltas</span></div>
                  <div className="grid-2">
                    <div className="form-group">
                      <label className="form-label">Ranked win delta</label>
                      <input className="form-input" type="number" value={rankedWin} onChange={(e) => setRankedWin(Number(e.target.value))} disabled={user?.role !== "admin"} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Ranked loss delta</label>
                      <input className="form-input" type="number" value={rankedLoss} onChange={(e) => setRankedLoss(Number(e.target.value))} disabled={user?.role !== "admin"} />
                    </div>
                  </div>

                  <div className="card-header" style={{ marginTop: "0.5rem" }}><span className="card-title">Economy</span></div>
                  <div className="form-group">
                    <label className="form-label">
                      <input type="checkbox" checked={purchaseEnabled} onChange={(e) => setPurchaseEnabled(e.target.checked)} disabled={user?.role !== "admin"} style={{ marginRight: "0.5rem" }} />
                      Purchases enabled
                    </label>
                  </div>

                  <div className="card-header" style={{ marginTop: "0.5rem" }}><span className="card-title">XP rewards per match</span></div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.5rem" }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: "0.75rem" }}>Ranked base XP</label>
                      <input className="form-input" type="number" min={0} value={rankedBaseXp} onChange={(e) => setRankedBaseXp(Number(e.target.value))} disabled={user?.role !== "admin"} />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: "0.75rem" }}>Unranked base XP</label>
                      <input className="form-input" type="number" min={0} value={unrankedBaseXp} onChange={(e) => setUnrankedBaseXp(Number(e.target.value))} disabled={user?.role !== "admin"} />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: "0.75rem" }}>Fun base XP</label>
                      <input className="form-input" type="number" min={0} value={funBaseXp} onChange={(e) => setFunBaseXp(Number(e.target.value))} disabled={user?.role !== "admin"} />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: "0.75rem" }}>Win bonus XP</label>
                      <input className="form-input" type="number" min={0} value={winBonusXp} onChange={(e) => setWinBonusXp(Number(e.target.value))} disabled={user?.role !== "admin"} />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: "0.75rem" }}>Loss XP</label>
                      <input className="form-input" type="number" min={0} value={lossXp} onChange={(e) => setLossXp(Number(e.target.value))} disabled={user?.role !== "admin"} />
                    </div>
                  </div>

                  <div className="card-header" style={{ marginTop: "0.5rem" }}><span className="card-title">Soft currency rewards per match</span></div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.5rem" }}>
                    {[
                      { label: "Ranked base", val: rankedSoftBase, set: setRankedSoftBase },
                      { label: "Ranked win bonus", val: rankedSoftWinBonus, set: setRankedSoftWinBonus },
                      { label: "Unranked base", val: unrankedSoftBase, set: setUnrankedSoftBase },
                      { label: "Unranked win bonus", val: unrankedSoftWinBonus, set: setUnrankedSoftWinBonus },
                      { label: "Fun base", val: funSoftBase, set: setFunSoftBase },
                      { label: "Fun win bonus", val: funSoftWinBonus, set: setFunSoftWinBonus }
                    ].map(({ label, val, set }) => (
                      <div key={label} className="form-group" style={{ margin: 0 }}>
                        <label className="form-label" style={{ fontSize: "0.75rem" }}>{label}</label>
                        <input className="form-input" type="number" min={0} value={val} onChange={(e) => set(Number(e.target.value))} disabled={user?.role !== "admin"} />
                      </div>
                    ))}
                  </div>

                  {settings && (
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.5rem" }}>
                      Last updated: {new Date(settings.updatedAt).toLocaleString()}
                    </div>
                  )}

                  {user?.role === "admin" && (
                    <button className="btn btn-primary btn-full" type="submit" disabled={settingsBusy}>{settingsBusy ? "Saving…" : "Save settings"}</button>
                  )}
                </form>
              </div>
            </div>
          )}

          {/* ── Ranking ───────────────────────────────────────────────────── */}
          {tab === "ranking" && (
            <div style={{ display: "grid", gap: "2rem", maxWidth: 840 }}>
              <div>
                {ranksNotice && <div className="success-banner" style={{ marginBottom: "0.75rem" }}>{ranksNotice}</div>}
                {ranksError && <div className="error-banner" style={{ marginBottom: "0.75rem" }}>{ranksError}</div>}

                <div className="card" style={{ overflowX: "auto" }}>
                  <div className="card-header">
                    <span className="card-title">Brackets de rang</span>
                    <span className="tag tag-cyan">{rankConfigs.length} rangs</span>
                  </div>

                  {ranksBusy && rankConfigs.length === 0
                    ? <div style={{ color: "var(--cyan)", fontSize: "0.85rem" }}>Loading…</div>
                    : (
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
                        <thead>
                          <tr style={{ color: "var(--text-muted)", textAlign: "left" }}>
                            <th style={{ padding: "0.6rem 0.875rem" }}>Mode</th>
                            <th style={{ padding: "0.6rem 0.875rem" }}>Rank</th>
                            <th style={{ padding: "0.6rem 0.875rem", textAlign: "right" }}>Min MMR</th>
                            <th style={{ padding: "0.6rem 0.875rem", textAlign: "right" }}>Max MMR</th>
                            <th style={{ padding: "0.6rem 0.875rem", textAlign: "right" }}>Order</th>
                            <th style={{ padding: "0.6rem 0.875rem" }}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rankConfigs.map((r) => (
                            <tr key={r.id} style={{ borderTop: "1px solid var(--border)" }}>
                              {editingRankId === r.id ? (
                                <>
                                  <td style={{ padding: "0.6rem 0.875rem" }}>
                                    <span className={`tag ${r.mode === "ranked" ? "tag-cyan" : r.mode === "unranked" ? "tag-purple" : "tag-gold"}`}>{r.mode}</span>
                                  </td>
                                  <td style={{ padding: "0.6rem 0.875rem" }}>
                                    <input className="form-input" style={{ padding: "0.2rem 0.4rem", fontSize: "0.8rem", width: 120 }} value={editRankForm.rank} onChange={(e) => setEditRankForm((f) => ({ ...f, rank: e.target.value }))} />
                                  </td>
                                  <td style={{ padding: "0.6rem 0.875rem" }}>
                                    <input className="form-input" type="number" style={{ padding: "0.2rem 0.4rem", fontSize: "0.8rem", width: 80 }} value={editRankForm.minMmr} onChange={(e) => setEditRankForm((f) => ({ ...f, minMmr: Number(e.target.value) }))} />
                                  </td>
                                  <td style={{ padding: "0.6rem 0.875rem" }}>
                                    <input className="form-input" type="number" placeholder="∞" style={{ padding: "0.2rem 0.4rem", fontSize: "0.8rem", width: 80 }} value={editRankForm.maxMmr} onChange={(e) => setEditRankForm((f) => ({ ...f, maxMmr: e.target.value }))} />
                                  </td>
                                  <td style={{ padding: "0.6rem 0.875rem" }}>
                                    <input className="form-input" type="number" style={{ padding: "0.2rem 0.4rem", fontSize: "0.8rem", width: 60 }} value={editRankForm.sortOrder} onChange={(e) => setEditRankForm((f) => ({ ...f, sortOrder: Number(e.target.value) }))} />
                                  </td>
                                  <td style={{ padding: "0.6rem 0.875rem" }}>
                                    <div style={{ display: "flex", gap: "0.25rem" }}>
                                      <button className="btn btn-sm btn-primary" disabled={ranksBusy} onClick={() => handleSaveRank(r.id)}>✓</button>
                                      <button className="btn btn-sm" disabled={ranksBusy} onClick={() => setEditingRankId(null)}>✕</button>
                                    </div>
                                  </td>
                                </>
                              ) : (
                                <>
                                  <td style={{ padding: "0.6rem 0.875rem" }}>
                                    <span className={`tag ${r.mode === "ranked" ? "tag-cyan" : r.mode === "unranked" ? "tag-purple" : "tag-gold"}`}>{r.mode}</span>
                                  </td>
                                  <td style={{ padding: "0.6rem 0.875rem", fontWeight: 500 }}>{r.rank}</td>
                                  <td style={{ padding: "0.6rem 0.875rem", textAlign: "right", fontFamily: "monospace" }}>{r.minMmr}</td>
                                  <td style={{ padding: "0.6rem 0.875rem", textAlign: "right", fontFamily: "monospace", color: "var(--text-muted)" }}>
                                    {r.maxMmr !== undefined ? r.maxMmr : <span style={{ opacity: 0.4 }}>∞</span>}
                                  </td>
                                  <td style={{ padding: "0.6rem 0.875rem", textAlign: "right", color: "var(--text-muted)" }}>{r.sortOrder}</td>
                                  <td style={{ padding: "0.6rem 0.875rem" }}>
                                    <div style={{ display: "flex", gap: "0.25rem" }}>
                                      <button className="btn btn-sm" disabled={ranksBusy} onClick={() => startEditRank(r)}>Edit</button>
                                      <button className="btn btn-sm btn-danger" disabled={ranksBusy} onClick={() => handleDeleteRank(r.id)}>✕</button>
                                    </div>
                                  </td>
                                </>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )
                  }
                </div>

                {/* ── Add rank form ──────────────────────────── */}
                <form className="card" style={{ marginTop: "1rem" }} onSubmit={handleCreateRank}>
                  <div className="card-header"><span className="card-title">Add rank</span></div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: "0.75rem" }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: "0.75rem" }}>Mode</label>
                      <select className="form-input" style={{ fontSize: "0.8rem" }} value={newRank.mode} onChange={(e) => setNewRank((f) => ({ ...f, mode: e.target.value as GameMode }))}>
                        <option value="ranked">ranked</option>
                        <option value="unranked">unranked</option>
                        <option value="fun">fun</option>
                      </select>
                    </div>
                    <div className="form-group" style={{ margin: 0, gridColumn: "span 2" }}>
                      <label className="form-label" style={{ fontSize: "0.75rem" }}>Rank name</label>
                      <input required className="form-input" style={{ fontSize: "0.8rem" }} placeholder="ex: Gold III" value={newRank.rank} onChange={(e) => setNewRank((f) => ({ ...f, rank: e.target.value }))} />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: "0.75rem" }}>Min MMR</label>
                      <input required className="form-input" type="number" style={{ fontSize: "0.8rem" }} value={newRank.minMmr} onChange={(e) => setNewRank((f) => ({ ...f, minMmr: Number(e.target.value) }))} />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: "0.75rem" }}>Max MMR (empty = ∞)</label>
                      <input className="form-input" type="number" placeholder="∞" style={{ fontSize: "0.8rem" }} value={newRankMaxMmr} onChange={(e) => setNewRankMaxMmr(e.target.value)} />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: "0.75rem" }}>Order</label>
                      <input required className="form-input" type="number" style={{ fontSize: "0.8rem" }} value={newRank.sortOrder} onChange={(e) => setNewRank((f) => ({ ...f, sortOrder: Number(e.target.value) }))} />
                    </div>
                  </div>
                  <button className="btn btn-primary" type="submit" disabled={ranksBusy} style={{ marginTop: "0.75rem" }}>
                    {ranksBusy ? "…" : "+ Add"}
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* ── Moderation ────────────────────────────────────────────────── */}
          {tab === "moderation" && (
            <div className="grid-2" style={{ alignItems: "start", gap: "2rem" }}>
              <div className="card">
                <div className="card-header"><span className="card-title">New action</span></div>
                {modNotice && <div className="success-banner">{modNotice}</div>}
                {modError && <div className="error-banner">{modError}</div>}
                <form className="auth-form" onSubmit={handleModerate}>
                  <div className="form-group">
                    <label className="form-label">Target type</label>
                    <select className="form-input" value={modType} onChange={(e) => setModType(e.target.value as "account" | "map")}>
                      <option value="account">Account</option>
                      <option value="map">Map</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Target ID</label>
                    <input className="form-input" value={modTargetId} onChange={(e) => setModTargetId(e.target.value)} required placeholder="User ID or Map ID" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Action</label>
                    <select className="form-input" value={modAction} onChange={(e) => setModAction(e.target.value)}>
                      {modType === "account"
                        ? (<>
                            <option value="warn">Warn</option>
                            <option value="suspend">Suspend</option>
                            <option value="ban">Ban</option>
                            <option value="unban">Unban</option>
                          </>)
                        : (<>
                            <option value="feature">Feature</option>
                            <option value="validate">Validate (→ stable)</option>
                            <option value="hide">Hide</option>
                            <option value="restore">Restore</option>
                          </>)
                      }
                    </select>
                  </div>
                  {modType === "account" && modAction === "suspend" && (
                    <div className="form-group">
                      <label className="form-label">Duration (hours)</label>
                      <input className="form-input" type="number" min={1} value={modDuration} onChange={(e) => setModDuration(e.target.value)} placeholder="24" />
                    </div>
                  )}
                  <div className="form-group">
                    <label className="form-label">Reason</label>
                    <textarea className="form-input" value={modReason} onChange={(e) => setModReason(e.target.value)} required rows={2} placeholder="Reason for this action…" style={{ resize: "vertical" }} />
                  </div>
                  <button className="btn btn-primary btn-full" type="submit" disabled={modBusy}>{modBusy ? "Applying…" : "Apply action"}</button>
                </form>
              </div>

              <div style={{ display: "grid", gap: "1.5rem" }}>
                <div className="card">
                  <div className="card-header">
                    <span className="card-title">Open signals</span>
                    <span className="tag tag-orange">{signals.filter((s) => s.status === "open").length}</span>
                  </div>
                  <div className="moderation-list">
                    {signals.filter((s) => s.status === "open").length === 0 && (
                      <div style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>No open signals.</div>
                    )}
                    {signals.filter((s) => s.status === "open").map((s) => (
                      <div key={s.id} className="moderation-item open">
                        <span className="moderation-type" style={{ color: "var(--orange)" }}>{s.targetType}</span>
                        <span className="moderation-reason">{s.reason}</span>
                        <span className="moderation-status">{s.status}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="card">
                  <div className="card-header">
                    <span className="card-title">Map reports</span>
                    <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                      {mapReports.length > 0 && <span className="tag tag-red">{mapReports.length}</span>}
                      <button className="btn btn-sm" onClick={handleLoadMapReports} disabled={mapReportsLoading}>
                        {mapReportsLoading ? "…" : "Refresh"}
                      </button>
                    </div>
                  </div>
                  <div className="moderation-list">
                    {mapReports.length === 0 && !mapReportsLoading && (
                      <div style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>No open map reports.</div>
                    )}
                    {mapReports.map((r) => (
                      <div key={r.id} className="moderation-item open" style={{ flexDirection: "column", gap: "0.375rem", alignItems: "flex-start" }}>
                        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", width: "100%", flexWrap: "wrap" }}>
                          <span className="tag tag-orange" style={{ fontSize: "0.65rem" }}>map</span>
                          <span style={{ fontWeight: 600, fontSize: "0.875rem" }}>{r.mapTitle}</span>
                          <span style={{ color: "var(--text-muted)", fontSize: "0.78rem", marginLeft: "auto" }}>
                            by {r.reporterPseudo} · {new Date(r.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <span className="moderation-reason" style={{ fontSize: "0.875rem" }}>{r.reason}</span>
                        <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.25rem" }}>
                          <button className="btn btn-sm" onClick={() => handleDismissMapReport(r.id, "reviewed")}>
                            Mark reviewed
                          </button>
                          <button className="btn btn-sm" style={{ color: "var(--text-muted)" }} onClick={() => handleDismissMapReport(r.id, "dismissed")}>
                            Dismiss
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="card">
                  <div className="card-header">
                    <span className="card-title">History</span>
                    <span className="tag tag-purple">{modHistory.length}</span>
                  </div>
                  <div className="moderation-list">
                    {modHistory.length === 0 && (
                      <div style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>No actions yet.</div>
                    )}
                    {modHistory.slice(0, 10).map((a) => (
                      <div key={a.id} className="moderation-item action">
                        <span className="moderation-type" style={{ color: "var(--red)", fontSize: "0.65rem" }}>{a.action}</span>
                        <span className="moderation-reason">{a.reason}</span>
                        <span style={{ fontSize: "0.65rem", color: "var(--text-muted)" }}>{new Date(a.createdAt).toLocaleDateString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Players ───────────────────────────────────────────────────── */}
          {tab === "players" && (
            <>
            <div className="grid-2" style={{ alignItems: "start", gap: "2rem" }}>
              <div className="card" style={{ overflowX: "auto" }}>
                <div className="card-header">
                  <span className="card-title">Players</span>
                  <button className="btn btn-sm" onClick={handleLoadPlayers} disabled={playersLoading}>{playersLoading ? "…" : "Refresh"}</button>
                </div>
                {players.length === 0 && !playersLoading && (
                  <div style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>No players loaded.</div>
                )}
                <div style={{ display: "grid", gap: "0.5rem" }}>
                  {players.map((p) => (
                    <div
                      key={p.id}
                      style={{ display: "flex", alignItems: "center", gap: "0.875rem", padding: "0.75rem 1rem", borderRadius: "0.5rem", background: editingPlayer?.id === p.id ? "rgba(0,212,255,0.08)" : "transparent", border: editingPlayer?.id === p.id ? "1px solid var(--cyan)" : "1px solid rgba(255,255,255,0.04)", cursor: "pointer", fontSize: "0.875rem", transition: "background 0.15s, border-color 0.15s" }}
                      onClick={() => openEdit(p)}
                    >
                      <span style={{ fontFamily: "monospace", color: "var(--text-muted)", fontSize: "0.7rem", flexShrink: 0 }}>{p.id.slice(0, 8)}…</span>
                      <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.pseudo ?? p.email}</span>
                      <span style={{ color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 160 }}>{p.email}</span>
                      <span className={`tag ${p.role === "admin" ? "tag-red" : p.role === "staff" ? "tag-gold" : "tag-cyan"}`} style={{ flexShrink: 0 }}>{p.role}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="card">
                <div className="card-header">
                  <span className="card-title">{editingPlayer ? `Edit — ${editingPlayer.pseudo ?? editingPlayer.email}` : "Select a player"}</span>
                </div>
                {!editingPlayer && <div style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>Click a player on the left to edit.</div>}
                {editingPlayer && (
                  <>
                    {playerNotice && <div className="success-banner" style={{ marginBottom: "0.75rem" }}>{playerNotice}</div>}
                    {playerError && <div className="error-banner" style={{ marginBottom: "0.75rem" }}>{playerError}</div>}
                    <form className="auth-form" onSubmit={handleSavePlayer}>
                      <div className="form-group">
                        <label className="form-label">Email</label>
                        <input className="form-input" value={editForm.email ?? ""} onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))} />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Role</label>
                        <select className="form-input" value={editForm.role ?? "player"} onChange={(e) => setEditForm((f) => ({ ...f, role: e.target.value as "player" | "staff" | "admin" }))} disabled={user?.role !== "admin"}>
                          <option value="player">Player</option>
                          <option value="staff">Staff</option>
                          <option value="admin">Admin</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label className="form-label">Pseudo</label>
                        <input className="form-input" value={editForm.pseudo ?? ""} onChange={(e) => setEditForm((f) => ({ ...f, pseudo: e.target.value }))} placeholder="Display name" />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Region</label>
                        <select className="form-input" value={editForm.region ?? ""} onChange={(e) => setEditForm((f) => ({ ...f, region: e.target.value }))}>
                          <option value="">— None —</option>
                          {REGIONS.map((r) => (
                            <option key={r} value={r}>{r}</option>
                          ))}
                        </select>
                      </div>
                      <div className="form-group">
                        <label className="form-label">Bio</label>
                        <textarea className="form-input" value={editForm.bio ?? ""} onChange={(e) => setEditForm((f) => ({ ...f, bio: e.target.value }))} rows={2} style={{ resize: "vertical" }} />
                      </div>
                      <div style={{ display: "flex", gap: "0.5rem" }}>
                        <button className="btn btn-primary" style={{ flex: 1 }} type="submit" disabled={playerBusy || user?.role !== "admin"}>{playerBusy ? "Saving…" : "Save"}</button>
                        <button className="btn" type="button" onClick={() => setEditingPlayer(null)}>Cancel</button>
                      </div>
                      {user?.role !== "admin" && (
                        <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>Read-only — only admins can edit players.</div>
                      )}
                    </form>
                  </>
                )}
              </div>
            </div>

            {editingPlayer && (
              <div className="card" style={{ marginTop: "1rem", gridColumn: "1 / -1" }}>
                <div className="card-header">
                  <span className="card-title">Timeline — {editingPlayer.pseudo ?? editingPlayer.email}</span>
                  {playerTimeline && <span className="tag tag-purple">{playerTimeline.events.length} events</span>}
                </div>
                {timelineLoading && <div style={{ color: "var(--cyan)", fontSize: "0.85rem" }}>Loading…</div>}
                {!timelineLoading && playerTimeline?.events.length === 0 && (
                  <div style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>No events yet.</div>
                )}
                {!timelineLoading && playerTimeline && playerTimeline.events.length > 0 && (
                  <div style={{ display: "grid", gap: "0.625rem", maxHeight: "460px", overflowY: "auto" }}>
                    {playerTimeline.events.map((ev) => (
                      <div
                        key={ev.id}
                        style={{
                          display: "flex",
                          gap: "0.75rem",
                          alignItems: "flex-start",
                          padding: "0.75rem 1rem",
                          borderRadius: "0.375rem",
                          background: ev.kind === "moderation" ? "rgba(239,68,68,0.06)" : "rgba(0,200,255,0.04)",
                          border: `1px solid ${ev.kind === "moderation" ? "rgba(239,68,68,0.2)" : "rgba(0,200,255,0.1)"}`,
                          fontSize: "0.875rem"
                        }}
                      >
                        <span style={{ fontSize: "1rem", flexShrink: 0 }}>
                          {ev.kind === "match"
                            ? ev.result === "win" ? "✅" : ev.result === "loss" ? "❌" : "➖"
                            : ev.action?.includes("warn") ? "⚠️"
                            : ev.action?.includes("ban") ? "🔨"
                            : ev.action?.includes("suspend") ? "⏸️"
                            : ev.action?.includes("unban") || ev.action?.includes("unsuspend") ? "✔️"
                            : "📋"}
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          {ev.kind === "moderation" && (
                            <>
                              <span className={`tag ${ev.action?.includes("ban") ? "tag-red" : ev.action?.includes("warn") ? "tag-orange" : ev.action?.includes("unban") || ev.action?.includes("unsuspend") ? "tag-green" : "tag-purple"}`} style={{ fontSize: "0.65rem", marginRight: "0.4rem" }}>
                                {ev.action?.replace("account.", "")}
                              </span>
                              <span style={{ color: "var(--text-muted)", fontSize: "0.78rem" }}>{ev.reason}</span>
                            </>
                          )}
                          {ev.kind === "match" && (
                            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
                              <span className="tag tag-cyan" style={{ fontSize: "0.65rem" }}>{ev.mode}</span>
                              <span style={{ fontWeight: 600, color: ev.result === "win" ? "var(--green, #22c55e)" : ev.result === "loss" ? "var(--red, #ef4444)" : "var(--text-muted)" }}>
                                {ev.result?.toUpperCase() ?? "—"}
                              </span>
                              {ev.mmrDelta !== undefined && (
                                <span style={{ color: ev.mmrDelta >= 0 ? "var(--green, #22c55e)" : "var(--red, #ef4444)", fontWeight: 600, fontSize: "0.78rem" }}>
                                  MMR {ev.mmrDelta >= 0 ? "+" : ""}{ev.mmrDelta}
                                  {ev.mmrAfter !== undefined && <span style={{ color: "var(--text-muted)", fontWeight: 400 }}> → {ev.mmrAfter}</span>}
                                </span>
                              )}
                              <span style={{ color: "var(--text-muted)", fontSize: "0.7rem", fontFamily: "monospace" }}>{ev.matchId?.slice(0, 8)}…</span>
                            </div>
                          )}
                        </div>
                        <span style={{ color: "var(--text-muted)", fontSize: "0.7rem", flexShrink: 0, textAlign: "right" }}>
                          {new Date(ev.date).toLocaleDateString()}<br />
                          <span style={{ fontSize: "0.65rem" }}>{new Date(ev.date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            </>
          )}

          {/* ── Journal ───────────────────────────────────────────────────── */}
          {tab === "journal" && (
            <div style={{ display: "grid", gap: "1.5rem" }}>
              <div className="tab-bar">
                {(["transactions", "sanctions", "logs"] as const).map((st) => (
                  <button
                    key={st}
                    className={`tab-btn${journalSubTab === st ? " active" : ""}`}
                    style={{ fontSize: "0.8rem" }}
                    onClick={() => handleLoadJournalSubTab(st)}
                  >
                    {{ transactions: "Transactions", sanctions: "Sanctions", logs: "Audit log" }[st]}
                  </button>
                ))}
              </div>

              {journalLoading && <div style={{ color: "var(--cyan)", fontSize: "0.85rem" }}>Chargement…</div>}

              {/* ── Transactions ──────────────────────────────────────── */}
              {!journalLoading && journalSubTab === "transactions" && txJournal !== null && (
                <div className="card" style={{ overflowX: "auto" }}>
                  <div className="card-header">
                    <span className="card-title">Journal des transactions</span>
                    <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                      <span className="tag tag-purple">{txJournal.length}</span>
                      <button className="btn btn-sm" onClick={() => handleLoadJournalSubTab("transactions")}>Rafraîchir</button>
                    </div>
                  </div>
                  {txJournal.length === 0
                    ? <div style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>Aucune transaction.</div>
                    : (
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                        <thead>
                          <tr style={{ color: "var(--text-muted)", textAlign: "left" }}>
                            <th style={{ padding: "0.7rem 1rem" }}>Date</th>
                            <th style={{ padding: "0.7rem 1rem" }}>Joueur</th>
                            <th style={{ padding: "0.7rem 1rem" }}>Objet</th>
                            <th style={{ padding: "0.7rem 1rem" }}>Monnaie</th>
                            <th style={{ padding: "0.7rem 1rem", textAlign: "right" }}>Qté</th>
                            <th style={{ padding: "0.7rem 1rem", textAlign: "right" }}>Prix u.</th>
                            <th style={{ padding: "0.7rem 1rem", textAlign: "right" }}>Total</th>
                            <th style={{ padding: "0.7rem 1rem" }}>Statut</th>
                          </tr>
                        </thead>
                        <tbody>
                          {txJournal.map((tx) => (
                            <tr key={tx.id} style={{ borderTop: "1px solid var(--border)" }}>
                              <td style={{ padding: "0.7rem 1rem", color: "var(--text-muted)", fontSize: "0.74rem", whiteSpace: "nowrap" }}>
                                {new Date(tx.createdAt).toLocaleString()}
                              </td>
                              <td style={{ padding: "0.7rem 1rem" }}>
                                {tx.playerPseudo ?? <span style={{ fontFamily: "monospace", fontSize: "0.78rem", color: "var(--text-muted)" }}>{tx.playerId.slice(0, 8)}…</span>}
                              </td>
                              <td style={{ padding: "0.7rem 1rem" }}>
                                <span style={{ fontWeight: 500 }}>{tx.itemName ?? tx.itemCode ?? <span style={{ color: "var(--text-muted)" }}>—</span>}</span>
                                {tx.itemCode && tx.itemName && <span style={{ color: "var(--text-muted)", fontSize: "0.78rem", marginLeft: "0.25rem" }}>({tx.itemCode})</span>}
                              </td>
                              <td style={{ padding: "0.7rem 1rem" }}>
                                <span className={`tag ${tx.currencyType === "soft" ? "tag-cyan" : "tag-gold"}`}>{tx.currencyType}</span>
                              </td>
                              <td style={{ padding: "0.7rem 1rem", textAlign: "right" }}>{tx.quantity}</td>
                              <td style={{ padding: "0.7rem 1rem", textAlign: "right", fontFamily: "monospace" }}>{tx.unitPrice}</td>
                              <td style={{ padding: "0.7rem 1rem", textAlign: "right", fontFamily: "monospace", fontWeight: 600, color: tx.status === "rejected" ? "var(--red)" : "var(--green)" }}>
                                {tx.status === "rejected" ? "—" : tx.amount}
                              </td>
                              <td style={{ padding: "0.7rem 1rem" }}>
                                <span className={`tag ${tx.status === "accepted" ? "tag-green" : "tag-red"}`}>
                                  {tx.status === "accepted" ? "OK" : tx.reason ?? "refusé"}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )
                  }
                </div>
              )}

              {/* ── Sanctions ─────────────────────────────────────────── */}
              {!journalLoading && journalSubTab === "sanctions" && sanctionJournal !== null && (
                <div className="card" style={{ overflowX: "auto" }}>
                  <div className="card-header">
                    <span className="card-title">Journal des sanctions</span>
                    <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                      <span className="tag tag-red">{sanctionJournal.filter((s) => s.status === "active").length} actives</span>
                      <button className="btn btn-sm" onClick={() => handleLoadJournalSubTab("sanctions")}>Rafraîchir</button>
                    </div>
                  </div>
                  {sanctionJournal.length === 0
                    ? <div style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>Aucune sanction.</div>
                    : (
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                        <thead>
                          <tr style={{ color: "var(--text-muted)", textAlign: "left" }}>
                            <th style={{ padding: "0.7rem 1rem" }}>Date</th>
                            <th style={{ padding: "0.7rem 1rem" }}>Joueur</th>
                            <th style={{ padding: "0.7rem 1rem" }}>Type</th>
                            <th style={{ padding: "0.7rem 1rem" }}>Raison</th>
                            <th style={{ padding: "0.7rem 1rem" }}>Par</th>
                            <th style={{ padding: "0.7rem 1rem" }}>Expire</th>
                            <th style={{ padding: "0.7rem 1rem" }}>Statut</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sanctionJournal.map((s) => (
                            <tr key={s.id} style={{ borderTop: "1px solid var(--border)" }}>
                              <td style={{ padding: "0.7rem 1rem", color: "var(--text-muted)", fontSize: "0.74rem", whiteSpace: "nowrap" }}>
                                {new Date(s.startedAt).toLocaleString()}
                              </td>
                              <td style={{ padding: "0.7rem 1rem", fontWeight: 500 }}>
                                {s.userPseudo ?? <span style={{ fontFamily: "monospace", fontSize: "0.78rem" }}>{s.userId.slice(0, 8)}…</span>}
                              </td>
                              <td style={{ padding: "0.7rem 1rem" }}>
                                <span className={`tag ${s.type === "ban" ? "tag-red" : s.type === "suspension" ? "tag-orange" : "tag-gold"}`}>{s.type}</span>
                              </td>
                              <td style={{ padding: "0.7rem 1rem", color: "var(--text-muted)", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {s.reason}
                              </td>
                              <td style={{ padding: "0.7rem 1rem", color: "var(--text-muted)", fontSize: "0.74rem" }}>
                                {s.actorPseudo ?? (s.actorId ? s.actorId.slice(0, 8) + "…" : "—")}
                              </td>
                              <td style={{ padding: "0.7rem 1rem", color: "var(--text-muted)", fontSize: "0.74rem" }}>
                                {s.endsAt ? new Date(s.endsAt).toLocaleString() : <span style={{ opacity: 0.4 }}>∞</span>}
                              </td>
                              <td style={{ padding: "0.7rem 1rem" }}>
                                <span className={`tag ${s.status === "active" ? "tag-red" : "tag-cyan"}`}>{s.status}</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )
                  }
                </div>
              )}

              {/* ── Audit log ─────────────────────────────────────────── */}
              {!journalLoading && journalSubTab === "logs" && auditLogs !== null && (
                <div className="card" style={{ overflowX: "auto" }}>
                  <div className="card-header">
                    <span className="card-title">Audit log</span>
                    <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                      <span className="tag tag-purple">{auditLogs.length}</span>
                      <button className="btn btn-sm" onClick={() => handleLoadJournalSubTab("logs")}>Rafraîchir</button>
                    </div>
                  </div>
                  {auditLogs.length === 0
                    ? <div style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>Aucune entrée.</div>
                    : (
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.78rem" }}>
                        <thead>
                          <tr style={{ color: "var(--text-muted)", textAlign: "left" }}>
                            <th style={{ padding: "0.7rem 1rem" }}>Date</th>
                            <th style={{ padding: "0.7rem 1rem" }}>Action</th>
                            <th style={{ padding: "0.7rem 1rem" }}>Cible</th>
                            <th style={{ padding: "0.7rem 1rem" }}>Acteur</th>
                            <th style={{ padding: "0.7rem 1rem" }}>Détails</th>
                          </tr>
                        </thead>
                        <tbody>
                          {auditLogs.map((log) => {
                            const actionColor = log.action.startsWith("admin.moderation") || log.action.startsWith("admin.rank.delete")
                              ? "tag-red"
                              : log.action.startsWith("mmr.") ? "tag-cyan"
                              : log.action.startsWith("map.") ? "tag-gold"
                              : log.action.startsWith("economy.") ? "tag-green"
                              : log.action.startsWith("admin.rank") ? "tag-purple"
                              : "tag-purple";
                            return (
                              <tr key={log.id} style={{ borderTop: "1px solid var(--border)" }}>
                                <td style={{ padding: "0.7rem 1rem", color: "var(--text-muted)", fontSize: "0.73rem", whiteSpace: "nowrap" }}>
                                  {new Date(log.createdAt).toLocaleString()}
                                </td>
                                <td style={{ padding: "0.7rem 1rem" }}>
                                  <span className={`tag ${actionColor}`} style={{ fontSize: "0.7rem" }}>{log.action}</span>
                                </td>
                                <td style={{ padding: "0.7rem 1rem", color: "var(--text-muted)", fontSize: "0.73rem" }}>
                                  <span>{log.targetType}</span>
                                  {log.targetId && <span style={{ fontFamily: "monospace", marginLeft: "0.25rem", opacity: 0.6 }}>{log.targetId.slice(0, 8)}…</span>}
                                </td>
                                <td style={{ padding: "0.7rem 1rem", fontSize: "0.74rem" }}>
                                  {log.actorPseudo ?? <span style={{ fontFamily: "monospace", opacity: 0.7 }}>{log.actorId.slice(0, 8)}…</span>}
                                </td>
                                <td style={{ padding: "0.7rem 1rem", color: "var(--text-muted)", fontSize: "0.78rem", maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                  {log.metadata ? JSON.stringify(log.metadata) : "—"}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )
                  }
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
