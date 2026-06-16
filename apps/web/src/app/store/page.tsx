"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import type {
  AuthUserResponse,
  HardCurrencyPackage,
  StoreItem,
  WalletResponse,
  InventoryItemResponse,
  TransactionResponse
} from "@gamedash/contracts";
import { auth as authApi, economy } from "../../lib/api";
import { withToken, logout } from "../../lib/auth";
import { Nav } from "../../components/Nav";

function getItemIcon(code: string): string {
  if (code.includes("skin")) return "🎭";
  if (code.includes("banner")) return "🏴";
  if (code.includes("border")) return "🔲";
  if (code.includes("title")) return "🏅";
  if (code.includes("currency") || code.includes("coin")) return "💰";
  return "📦";
}

export default function StorePage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUserResponse | null>(null);
  const [wallet, setWallet] = useState<WalletResponse | null>(null);
  const [storeItems, setStoreItems] = useState<StoreItem[]>([]);
  const [inventory, setInventory] = useState<InventoryItemResponse[]>([]);
  const [transactions, setTransactions] = useState<TransactionResponse[]>([]);
  const [hardPackages, setHardPackages] = useState<HardCurrencyPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [buyingId, setBuyingId] = useState<string | null>(null);
  const [equippingCode, setEquippingCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [tab, setTab] = useState<"store" | "inventory" | "transactions" | "topup">("store");
  const [paymentProvider, setPaymentProvider] = useState<"stripe" | "paypal">("stripe");
  const [payingPkgId, setPayingPkgId] = useState<string | null>(null);

  const handleLogout = useCallback(async () => {
    await logout();
    router.replace("/login");
  }, [router]);

  function flash(msg: string) {
    setNotice(msg);
    setTimeout(() => setNotice(null), 3000);
  }

  useEffect(() => {
    async function load() {
      try {
        const me = await withToken((t) => authApi.me(t));
        setUser(me);
        const [walletData, itemsData, invData, txData, pkgData] = await Promise.allSettled([
          withToken((t) => economy.getWallet(t)),
          withToken((t) => economy.getStoreItems(t)),
          withToken((t) => economy.getInventory(t)),
          withToken((t) => economy.getTransactions(t)),
          withToken((t) => economy.getHardCurrencyPackages(t))
        ]);
        if (walletData.status === "fulfilled") setWallet(walletData.value);
        if (itemsData.status === "fulfilled") setStoreItems(itemsData.value);
        if (invData.status === "fulfilled") setInventory(invData.value);
        if (txData.status === "fulfilled") setTransactions(txData.value);
        if (pkgData.status === "fulfilled") setHardPackages(pkgData.value);
      } catch {
        await logout();
        router.replace("/login");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [router]);

  async function handleBuy(item: StoreItem) {
    setBuyingId(item.id);
    setError(null);
    try {
      await withToken((t) =>
        economy.purchase({ storeItemId: item.id, quantity: 1 }, t)
      );
      const [w, inv, tx] = await Promise.all([
        withToken((t) => economy.getWallet(t)),
        withToken((t) => economy.getInventory(t)),
        withToken((t) => economy.getTransactions(t))
      ]);
      setWallet(w);
      setInventory(inv);
      setTransactions(tx);
      flash(`Purchased: ${item.name}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Purchase failed");
    } finally {
      setBuyingId(null);
    }
  }

  async function handleTopUp(pkg: HardCurrencyPackage) {
    setPayingPkgId(pkg.id);
    setError(null);
    try {
      const result = await withToken((t) =>
        economy.simulatePayment({ packageId: pkg.id, provider: paymentProvider }, t)
      );
      if (result.accepted) {
        setWallet(result.wallet);
        const total = pkg.hardAmount + pkg.bonusAmount;
        flash(`+${total} gems added via ${paymentProvider === "stripe" ? "Stripe" : "PayPal"} · ref ${result.referenceId}`);
        const txData = await withToken((t) => economy.getTransactions(t));
        setTransactions(txData);
      } else {
        setError(result.failureReason ?? "Payment declined.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment failed");
    } finally {
      setPayingPkgId(null);
    }
  }

  async function handleEquip(itemCode: string) {
    setEquippingCode(itemCode);
    try {
      const updated = await withToken((t) => economy.equipItem(itemCode, t));
      setInventory((prev) => prev.map((i) => i.itemCode === itemCode ? { ...i, ...updated } : { ...i, equipped: false }));
      flash("Item equipped.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Equip failed");
    } finally {
      setEquippingCode(null);
    }
  }

  if (loading) {
    return (
      <>
        <Nav user={null} onLogout={handleLogout} />
        <main className="page" style={{ textAlign: "center", paddingTop: "4rem" }}>
          <div style={{ color: "var(--cyan)", fontSize: "1.2rem" }}>Loading…</div>
        </main>
      </>
    );
  }

  return (
    <>
      <Nav user={user} onLogout={handleLogout} />

      <main className="page">

        {/* Wallet */}
        <section>
          <p className="section-title">Wallet</p>
          {wallet && (
            <div className="wallet-grid" style={{ maxWidth: 400 }}>
              <div className="currency-card soft">
                <span className="currency-amount">{wallet.softBalance.toLocaleString()}</span>
                <span className="currency-name">Soft coins</span>
              </div>
              <div className="currency-card hard">
                <span className="currency-amount">{wallet.hardBalance.toLocaleString()}</span>
                <span className="currency-name">Hard gems</span>
              </div>
            </div>
          )}
        </section>

        {/* Tabs */}
        <section>
          {notice && <div className="success-banner" style={{ marginBottom: "1rem" }}>{notice}</div>}
          {error && <div className="error-banner" style={{ marginBottom: "1rem" }}>{error}</div>}

          <div className="tab-bar" style={{ marginBottom: "1rem" }}>
            <button className={`tab-btn${tab === "store" ? " active" : ""}`} onClick={() => setTab("store")}>
              Store ({storeItems.length})
            </button>
            <button className={`tab-btn${tab === "inventory" ? " active" : ""}`} onClick={() => setTab("inventory")}>
              Inventory ({inventory.length})
            </button>
            <button className={`tab-btn${tab === "transactions" ? " active" : ""}`} onClick={() => setTab("transactions")}>
              Transactions ({transactions.length})
            </button>
            <button className={`tab-btn${tab === "topup" ? " active" : ""}`} onClick={() => setTab("topup")}>
              Top Up 💎
            </button>
          </div>

          {/* Store tab */}
          {tab === "store" && (
            <>
              <p className="section-title">Available items</p>
              <div className="store-list">
                {storeItems.length === 0 && (
                  <div style={{ color: "var(--text-muted)", fontSize: "0.85rem", padding: "1rem 0" }}>
                    No items available.
                  </div>
                )}
                {storeItems.map((item) => {
                  const affordable = wallet
                    ? item.currencyType === "soft"
                      ? wallet.softBalance >= item.price
                      : wallet.hardBalance >= item.price
                    : false;
                  const owned = inventory.some((i) => i.itemCode === item.itemCode);
                  return (
                    <div key={item.id} className="store-item">
                      <span className="store-icon">{getItemIcon(item.itemCode)}</span>
                      <div style={{ flex: 1 }}>
                        <div className="store-name">{item.name}</div>
                        {item.description && (
                          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.1rem" }}>
                            {item.description}
                          </div>
                        )}
                      </div>
                      <span className={`store-price ${item.currencyType}`}>
                        {item.price.toLocaleString()}
                      </span>
                      <span className={`tag ${item.currencyType === "soft" ? "tag-gold" : "tag-purple"}`}>
                        {item.currencyType}
                      </span>
                      {owned ? (
                        <span className="tag tag-green">owned</span>
                      ) : (
                        <button
                          className="btn btn-primary btn-sm"
                          disabled={!affordable || buyingId === item.id}
                          onClick={() => handleBuy(item)}
                        >
                          {buyingId === item.id ? "…" : "Buy"}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* Inventory tab */}
          {tab === "inventory" && (
            <>
              <p className="section-title">My items</p>
              <div className="store-list">
                {inventory.length === 0 && (
                  <div style={{ color: "var(--text-muted)", fontSize: "0.85rem", padding: "1rem 0" }}>
                    Inventory empty.
                  </div>
                )}
                {inventory.map((item) => (
                  <div key={item.id} className="store-item">
                    <span className="store-icon">{getItemIcon(item.itemCode)}</span>
                    <div style={{ flex: 1 }}>
                      <div className="store-name">{item.name}</div>
                      <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.1rem" }}>
                        x{item.quantity}
                      </div>
                    </div>
                    {item.equipped ? (
                      <span className="tag tag-cyan">equipped</span>
                    ) : (
                      <button
                        className="btn btn-sm"
                        disabled={equippingCode === item.itemCode}
                        onClick={() => handleEquip(item.itemCode)}
                      >
                        {equippingCode === item.itemCode ? "…" : "Equip"}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Transactions tab */}
          {tab === "transactions" && (
            <>
              <p className="section-title">Transaction history</p>
              <div className="store-list">
                {transactions.length === 0 && (
                  <div style={{ color: "var(--text-muted)", fontSize: "0.85rem", padding: "1rem 0" }}>
                    No transactions yet.
                  </div>
                )}
                {transactions.map((tx) => (
                  <div key={tx.transactionId} className="store-item" style={{ cursor: "default" }}>
                    <span className="store-icon">{getItemIcon(tx.itemCode ?? "")}</span>
                    <div style={{ flex: 1 }}>
                      <div className="store-name">{tx.itemCode ?? "—"}</div>
                      <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.1rem" }}>
                        {new Date(tx.createdAt).toLocaleDateString()} · {tx.currencyType}
                      </div>
                    </div>
                    <span style={{
                      fontFamily: "Rajdhani, sans-serif",
                      fontWeight: 700,
                      fontSize: "1rem",
                      color: tx.currencyType === "soft" ? "var(--gold)" : "var(--purple)"
                    }}>
                      {tx.amount.toLocaleString()}
                    </span>
                    <span className={`tag ${tx.status === "accepted" ? "tag-green" : "tag-red"}`}>
                      {tx.status}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
          {/* Top Up tab */}
          {tab === "topup" && (
            <>
              <p className="section-title">Buy Hard Gems (simulated payment)</p>
              <div style={{ marginBottom: "1rem", display: "flex", gap: "0.5rem", alignItems: "center" }}>
                <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Provider:</span>
                <button
                  className={`tab-btn${paymentProvider === "stripe" ? " active" : ""}`}
                  style={{ fontSize: "0.8rem", padding: "0.25rem 0.75rem" }}
                  onClick={() => setPaymentProvider("stripe")}
                >
                  Stripe
                </button>
                <button
                  className={`tab-btn${paymentProvider === "paypal" ? " active" : ""}`}
                  style={{ fontSize: "0.8rem", padding: "0.25rem 0.75rem" }}
                  onClick={() => setPaymentProvider("paypal")}
                >
                  PayPal
                </button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", maxWidth: 480 }}>
                {hardPackages.map((pkg) => {
                  const total = pkg.hardAmount + pkg.bonusAmount;
                  const isPaying = payingPkgId === pkg.id;
                  return (
                    <div key={pkg.id} className="store-item" style={{ display: "flex", alignItems: "center", gap: "1rem", padding: "0.9rem 1rem" }}>
                      <span style={{ fontSize: "1.4rem" }}>💎</span>
                      <div style={{ flex: 1 }}>
                        <div className="store-name">{pkg.label}</div>
                        <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.15rem" }}>
                          {pkg.hardAmount} gems{pkg.bonusAmount > 0 ? ` + ${pkg.bonusAmount} bonus` : ""}
                          {" · "}
                          <span style={{ color: "var(--purple)", fontWeight: 600 }}>{total} total</span>
                        </div>
                      </div>
                      <span style={{ fontFamily: "Rajdhani, sans-serif", fontWeight: 700, fontSize: "1rem", color: "var(--cyan)" }}>
                        ${pkg.priceUsd.toFixed(2)}
                      </span>
                      <button
                        className="btn btn-primary btn-sm"
                        disabled={isPaying || payingPkgId !== null}
                        onClick={() => handleTopUp(pkg)}
                      >
                        {isPaying ? "Processing…" : `Pay with ${paymentProvider === "stripe" ? "Stripe" : "PayPal"}`}
                      </button>
                    </div>
                  );
                })}
              </div>
              <div style={{ marginTop: "1.25rem", padding: "0.75rem 1rem", background: "rgba(255,255,255,0.04)", borderRadius: "0.5rem", fontSize: "0.75rem", color: "var(--text-muted)", maxWidth: 480 }}>
                <strong style={{ color: "var(--text-secondary)" }}>Sandbox mode</strong> — no real money is charged.
                Payments are simulated (95% success rate). Gems are credited instantly on success.
              </div>
            </>
          )}
        </section>
      </main>
    </>
  );
}
