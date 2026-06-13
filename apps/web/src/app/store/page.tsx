"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import type {
  AuthUserResponse,
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
  const [loading, setLoading] = useState(true);
  const [buyingId, setBuyingId] = useState<string | null>(null);
  const [equippingCode, setEquippingCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [tab, setTab] = useState<"store" | "inventory" | "transactions">("store");

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
        const [walletData, itemsData, invData, txData] = await Promise.allSettled([
          withToken((t) => economy.getWallet(t)),
          withToken((t) => economy.getStoreItems(t)),
          withToken((t) => economy.getInventory(t)),
          withToken((t) => economy.getTransactions(t))
        ]);
        if (walletData.status === "fulfilled") setWallet(walletData.value);
        if (itemsData.status === "fulfilled") setStoreItems(itemsData.value);
        if (invData.status === "fulfilled") setInventory(invData.value);
        if (txData.status === "fulfilled") setTransactions(txData.value);
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
        economy.purchase({ itemCode: item.itemCode, currencyType: item.currencyType }, t)
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
        </section>
      </main>
    </>
  );
}
