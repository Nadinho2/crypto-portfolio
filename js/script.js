// =============================================
// Nadinho Crypto Portfolio - JavaScript
// =============================================

const COINGECKO_SIMPLE =
    "https://api.coingecko.com/api/v3/simple/price";
const PRICE_REFRESH_INTERVAL_MS = 30000;
const ERC20_BALANCE_OF_SELECTOR = "0x70a08231";
const CHAIN_NAMES = {
    "0x1": "Ethereum",
    "0x38": "BNB Chain"
};
const WALLET_ASSET_CONFIG = {
    "0x1": {
        bitcoin: {
            type: "erc20",
            contract: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
            decimals: 8
        },
        ethereum: { type: "native", decimals: 18 },
        solana: {
            type: "erc20",
            contract: "0xd31a59c85ae9d8edefec411d448f90841571b89c",
            decimals: 9
        }
    },
    "0x38": {
        bitcoin: {
            type: "erc20",
            contract: "0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c",
            decimals: 18
        },
        ethereum: {
            type: "erc20",
            contract: "0x2170Ed0880ac9A755fd29B2688956BD959F933F8",
            decimals: 18
        },
        solana: {
            type: "erc20",
            contract: "0x570A5D26f7765Ecb712C0924E4De545B89fD43dF",
            decimals: 18
        }
    }
};

let connectedAccount = null;
let pricesRefreshTimer = null;
let isPriceRefreshInProgress = false;

function shortenAddress(address) {
    if (!address) return "";
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function setConnectButtons(account) {
    const buttons = document.querySelectorAll(".connect-btn");
    const isConnected = Boolean(account);
    buttons.forEach((btn) => {
        if (isConnected) {
            btn.innerHTML = `<i class="fas fa-check-circle"></i> ${shortenAddress(account)}`;
            btn.style.background = "linear-gradient(45deg, #00ff9d, #00ffc8)";
            btn.title = "Wallet connected";
        } else {
            btn.innerHTML = `<i class="fas fa-wallet"></i> Connect Wallet`;
            btn.style.background = "";
            btn.title = "Connect your wallet";
        }
    });
}

function bindWalletEvents() {
    if (!window.ethereum || !window.ethereum.on) return;

    window.ethereum.on("accountsChanged", (accounts) => {
        connectedAccount = accounts && accounts.length ? accounts[0] : null;
        setConnectButtons(connectedAccount);
        syncPortfolioWithWallet();
    });

    window.ethereum.on("chainChanged", () => {
        syncPortfolioWithWallet();
    });

    window.ethereum.on("disconnect", () => {
        connectedAccount = null;
        setConnectButtons(null);
        resetPortfolioToManual();
    });
}

async function hydrateWalletState() {
    if (!window.ethereum || !window.ethereum.request) {
        setConnectButtons(null);
        return;
    }
    try {
        const accounts = await window.ethereum.request({
            method: "eth_accounts"
        });
        connectedAccount = accounts && accounts.length ? accounts[0] : null;
        setConnectButtons(connectedAccount);
        if (connectedAccount) {
            syncPortfolioWithWallet();
        } else {
            resetPortfolioToManual();
        }
    } catch (err) {
        console.warn("Could not restore wallet session:", err);
        setConnectButtons(null);
        resetPortfolioToManual();
    }
}

// Connect Wallet Button Function
async function connectWallet() {
    if (!window.ethereum || !window.ethereum.request) {
        alert("No wallet detected. Install MetaMask or another EVM wallet.");
        return;
    }

    try {
        const accounts = await window.ethereum.request({
            method: "eth_requestAccounts"
        });
        connectedAccount = accounts && accounts.length ? accounts[0] : null;
        setConnectButtons(connectedAccount);
        await syncPortfolioWithWallet();
    } catch (err) {
        if (err && err.code === 4001) {
            alert("Connection request was rejected.");
            return;
        }
        console.error("Wallet connection failed:", err);
        alert("Could not connect wallet right now. Please try again.");
    }
}

function updateWalletSyncStatus(message) {
    const status = document.getElementById("wallet-sync-status");
    if (status) status.textContent = message;
}

function setRefreshButtonsLoading(isLoading) {
    const buttons = document.querySelectorAll("[data-refresh-prices]");
    buttons.forEach((btn) => {
        btn.disabled = isLoading;
        btn.innerHTML = isLoading
            ? '<i class="fas fa-spinner fa-spin"></i> Refreshing...'
            : '<i class="fas fa-rotate-right"></i> Refresh Prices';
    });
}

function setManualAmountOnCard(card) {
    const manualAmount = parseFloat(card.getAttribute("data-manual-amount"), 10);
    if (Number.isNaN(manualAmount)) return;
    card.setAttribute("data-holdings-amount", String(manualAmount));
    const amountEl = card.querySelector(".coin-amount");
    const symbol = card.querySelector(".coin-symbol")?.textContent?.trim() || "";
    if (amountEl) amountEl.textContent = `${manualAmount} ${symbol}`.trim();
}

function resetPortfolioToManual(statusMessage = "Using default portfolio amounts.") {
    const cards = document.querySelectorAll(".coin-card--holding[data-coin-id]");
    if (!cards.length) return;
    cards.forEach((card) => setManualAmountOnCard(card));
    loadLiveCoinPrices();
    updateWalletSyncStatus(statusMessage);
}

function toBalanceNumber(hexValue, decimals) {
    if (!hexValue) return null;
    const raw = BigInt(hexValue);
    const divisor = 10 ** decimals;
    return Number(raw) / divisor;
}

function buildBalanceOfData(address) {
    const clean = address.toLowerCase().replace(/^0x/, "");
    return ERC20_BALANCE_OF_SELECTOR + clean.padStart(64, "0");
}

async function fetchWalletAssetBalance(chainId, coinId, account) {
    const networkConfig = WALLET_ASSET_CONFIG[chainId];
    if (!networkConfig || !networkConfig[coinId]) return null;
    const asset = networkConfig[coinId];

    if (asset.type === "native") {
        const hex = await window.ethereum.request({
            method: "eth_getBalance",
            params: [account, "latest"]
        });
        return toBalanceNumber(hex, asset.decimals);
    }

    const hex = await window.ethereum.request({
        method: "eth_call",
        params: [
            {
                to: asset.contract,
                data: buildBalanceOfData(account)
            },
            "latest"
        ]
    });
    return toBalanceNumber(hex, asset.decimals);
}

async function syncPortfolioWithWallet() {
    const cards = document.querySelectorAll(".coin-card--holding[data-coin-id]");
    if (!cards.length) return;

    if (!window.ethereum || !connectedAccount) {
        resetPortfolioToManual();
        return;
    }

    try {
        const chainId = await window.ethereum.request({ method: "eth_chainId" });
        const chainName = CHAIN_NAMES[chainId] || `Chain ${chainId}`;
        let syncedCount = 0;

        for (const card of cards) {
            const coinId = card.getAttribute("data-coin-id");
            const amountEl = card.querySelector(".coin-amount");
            const symbol = card.querySelector(".coin-symbol")?.textContent?.trim() || "";

            const balance = await fetchWalletAssetBalance(chainId, coinId, connectedAccount);
            if (balance == null || Number.isNaN(balance)) {
                setManualAmountOnCard(card);
                continue;
            }

            const normalized = Number(balance.toFixed(8));
            card.setAttribute("data-holdings-amount", String(normalized));
            if (amountEl) amountEl.textContent = `${normalized} ${symbol}`.trim();
            syncedCount += 1;
        }

        await loadLiveCoinPrices();
        if (syncedCount > 0) {
            updateWalletSyncStatus(
                `Synced ${syncedCount}/${cards.length} assets from ${chainName}.`
            );
        } else {
            updateWalletSyncStatus(
                `No mapped assets found on ${chainName}; using default amounts.`
            );
        }
    } catch (err) {
        console.error("Portfolio sync failed:", err);
        resetPortfolioToManual("Wallet sync failed; using default amounts.");
    }
}

function formatUsdPrice(n) {
    if (n == null || Number.isNaN(n)) return "—";
    const abs = Math.abs(n);
    if (abs >= 1) {
        return (
            "$" +
            n.toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            })
        );
    }
    if (abs >= 0.01) {
        return (
            "$" +
            n.toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 4
            })
        );
    }
    return (
        "$" +
        n.toLocaleString("en-US", {
            maximumFractionDigits: 8
        })
    );
}

function formatUsdCompact(n) {
    if (n == null || Number.isNaN(n) || n <= 0) return "—";
    if (n >= 1e12) return "$" + (n / 1e12).toFixed(2) + "T";
    if (n >= 1e9) return "$" + (n / 1e9).toFixed(2) + "B";
    if (n >= 1e6) return "$" + (n / 1e6).toFixed(2) + "M";
    if (n >= 1e3) return "$" + (n / 1e3).toFixed(2) + "K";
    return formatUsdPrice(n);
}

function formatPortfolioTotal(n) {
    if (n == null || Number.isNaN(n)) return "—";
    return (
        "$" +
        n.toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        })
    );
}

function formatPctChange(pct) {
    if (pct == null || Number.isNaN(pct)) return "—";
    const sign = pct >= 0 ? "+" : "";
    return sign + pct.toFixed(2) + "% (24h)";
}

function applyChangeClass(el, pct) {
    if (!el || pct == null || Number.isNaN(pct)) return;
    el.classList.remove("positive", "negative");
    el.classList.add(pct >= 0 ? "positive" : "negative");
}

async function fetchCoinGeckoPrices(ids) {
    const unique = [...new Set(ids)].filter(Boolean);
    if (!unique.length) return {};

    const params = new URLSearchParams({
        ids: unique.join(","),
        vs_currencies: "usd",
        include_24hr_change: "true",
        include_market_cap: "true"
    });
    const url = COINGECKO_SIMPLE + "?" + params.toString();
    const res = await fetch(url);
    if (!res.ok) throw new Error("CoinGecko " + res.status);
    return res.json();
}

function updateHoldingsFromData(data) {
    const cards = document.querySelectorAll(
        ".coin-card--holding[data-coin-id]"
    );
    let totalUsd = 0;
    let weightedChangeSum = 0;
    let valueWithChange24h = 0;

    cards.forEach((card) => {
        const id = card.getAttribute("data-coin-id");
        const amount = parseFloat(card.getAttribute("data-holdings-amount"), 10);
        const row = data[id];
        const usdEl = card.querySelector(".coin-usd-value");
        const chEl = card.querySelector(".coin-24h-change");

        if (!row || amount == null || Number.isNaN(amount)) {
            if (usdEl) usdEl.textContent = "—";
            if (chEl) chEl.textContent = "—";
            return;
        }

        const usd = row.usd;
        if (usd == null || Number.isNaN(usd)) {
            if (usdEl) usdEl.textContent = "—";
            if (chEl) chEl.textContent = "—";
            return;
        }

        const change24 = row.usd_24h_change;
        const positionUsd = usd * amount;
        totalUsd += positionUsd;
        if (change24 != null && !Number.isNaN(change24)) {
            weightedChangeSum += positionUsd * change24;
            valueWithChange24h += positionUsd;
        }

        if (usdEl) usdEl.textContent = formatUsdPrice(positionUsd);
        if (chEl) {
            if (change24 != null && !Number.isNaN(change24)) {
                chEl.textContent = formatPctChange(change24);
                applyChangeClass(chEl, change24);
            } else {
                chEl.textContent = "—";
                chEl.classList.remove("positive", "negative");
            }
        }
    });

    const portfolioEl = document.getElementById("portfolio-value");
    const portfolioCh = document.getElementById("portfolio-24h-change");
    if (portfolioEl) portfolioEl.textContent = formatPortfolioTotal(totalUsd);
    if (portfolioCh) {
        if (totalUsd > 0 && valueWithChange24h > 0) {
            const w = weightedChangeSum / valueWithChange24h;
            portfolioCh.textContent = formatPctChange(w);
            applyChangeClass(portfolioCh, w);
        } else {
            portfolioCh.textContent = "—";
        }
    }
}

function updateTrendingFromData(data) {
    const cards = document.querySelectorAll(
        ".trending-card[data-coin-id]"
    );

    cards.forEach((card) => {
        const id = card.getAttribute("data-coin-id");
        const row = data[id];
        const priceEl = card.querySelector(".coin-spot-price");
        const chEl = card.querySelector(".coin-24h-change");
        const mcapEl = card.querySelector(".coin-mcap-value");

        if (!row) {
            if (priceEl) priceEl.textContent = "—";
            if (chEl) chEl.textContent = "—";
            if (mcapEl) mcapEl.textContent = "—";
            return;
        }

        const usd = row.usd;
        const change24 = row.usd_24h_change;
        const mcap = row.usd_market_cap;

        if (priceEl) priceEl.textContent = formatUsdPrice(usd);
        if (chEl) {
            if (change24 != null && !Number.isNaN(change24)) {
                chEl.textContent = formatPctChange(change24);
                applyChangeClass(chEl, change24);
            } else {
                chEl.textContent = "—";
                chEl.classList.remove("positive", "negative");
            }
        }
        if (mcapEl) mcapEl.textContent = formatUsdCompact(mcap);
    });

    const el = document.getElementById("prices-updated-at");
    if (el) {
        el.textContent =
            "Updated " + new Date().toLocaleTimeString(undefined, {
                hour: "2-digit",
                minute: "2-digit"
            });
    }
}

async function loadLiveCoinPrices() {
    if (isPriceRefreshInProgress) return;

    const holdingIds = Array.from(
        document.querySelectorAll(".coin-card--holding[data-coin-id]")
    ).map((c) => c.getAttribute("data-coin-id"));

    const trendingIds = Array.from(
        document.querySelectorAll(".trending-card[data-coin-id]")
    ).map((c) => c.getAttribute("data-coin-id"));

    const ids = [...new Set([...holdingIds, ...trendingIds])];
    if (!ids.length) return;

    isPriceRefreshInProgress = true;
    setRefreshButtonsLoading(true);
    try {
        const data = await fetchCoinGeckoPrices(ids);
        if (holdingIds.length) updateHoldingsFromData(data);
        if (trendingIds.length) updateTrendingFromData(data);
    } catch (err) {
        console.warn("Live prices unavailable:", err);
        document
            .querySelectorAll(
                ".coin-usd-value, .coin-spot-price, .coin-mcap-value"
            )
            .forEach((el) => {
                el.textContent = "—";
            });
        document.querySelectorAll(".coin-24h-change").forEach((el) => {
            if (el.closest(".coin-card--holding, .trending-card")) {
                el.textContent = "—";
            }
        });
        const portfolioEl = document.getElementById("portfolio-value");
        if (portfolioEl) portfolioEl.textContent = "—";
        const portfolioCh = document.getElementById("portfolio-24h-change");
        if (portfolioCh) portfolioCh.textContent = "Price data unavailable";
        const updated = document.getElementById("prices-updated-at");
        if (updated) updated.textContent = "Could not load (try again later)";
    } finally {
        isPriceRefreshInProgress = false;
        setRefreshButtonsLoading(false);
    }
}

function setupPriceRefreshControls() {
    document.querySelectorAll("[data-refresh-prices]").forEach((btn) => {
        btn.addEventListener("click", () => {
            loadLiveCoinPrices();
        });
    });
}

function startAutoPriceRefresh() {
    if (pricesRefreshTimer) clearInterval(pricesRefreshTimer);
    pricesRefreshTimer = setInterval(() => {
        if (document.visibilityState === "visible") {
            loadLiveCoinPrices();
        }
    }, PRICE_REFRESH_INTERVAL_MS);
}

function setActiveNav() {
    const currentPage = window.location.pathname.split("/").pop() || "index.html";
    const navLinks = document.querySelectorAll(".nav-links a");

    navLinks.forEach((link) => {
        const href = link.getAttribute("href");
        if (href === currentPage) {
            link.classList.add("active");
        } else {
            link.classList.remove("active");
        }
    });
}

document.addEventListener("DOMContentLoaded", function () {
    console.log(
        "%c✅ Nadinho Crypto Portfolio JS Loaded Successfully",
        "color: #00ffc8; font-size: 14px"
    );

    setActiveNav();
    hydrateWalletState();
    bindWalletEvents();
    setupPriceRefreshControls();
    startAutoPriceRefresh();
    loadLiveCoinPrices();

    document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
        anchor.addEventListener("click", function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute("href"));
            if (target) {
                target.scrollIntoView({
                    behavior: "smooth"
                });
            }
        });
    });
});

document.addEventListener("keydown", function (e) {
    if (e.key.toLowerCase() === "c") {
        connectWallet();
    }
});