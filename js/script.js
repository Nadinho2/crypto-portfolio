// =============================================
// Nadinho Crypto Portfolio - JavaScript
// =============================================

const COINGECKO_SIMPLE =
    "https://api.coingecko.com/api/v3/simple/price";

let connectedAccount = null;

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
    });

    window.ethereum.on("disconnect", () => {
        connectedAccount = null;
        setConnectButtons(null);
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
    } catch (err) {
        console.warn("Could not restore wallet session:", err);
        setConnectButtons(null);
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
    } catch (err) {
        if (err && err.code === 4001) {
            alert("Connection request was rejected.");
            return;
        }
        console.error("Wallet connection failed:", err);
        alert("Could not connect wallet right now. Please try again.");
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
    const holdingIds = Array.from(
        document.querySelectorAll(".coin-card--holding[data-coin-id]")
    ).map((c) => c.getAttribute("data-coin-id"));

    const trendingIds = Array.from(
        document.querySelectorAll(".trending-card[data-coin-id]")
    ).map((c) => c.getAttribute("data-coin-id"));

    const ids = [...new Set([...holdingIds, ...trendingIds])];
    if (!ids.length) return;

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
    }
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