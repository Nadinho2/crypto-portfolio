// =============================================
// Nadinho Crypto Portfolio - JavaScript
// =============================================

// Connect Wallet Button Function
function connectWallet() {
    const messages = [
        "🟢 Wallet Connected Successfully!",
        "Welcome back, Vibes Coder! 🔥",
        "You're now connected on the blockchain level ⚡",
        "10hr/day vibe activated! Let's build & trade",
        "Wallet linked • Ready to vibe in Nigeria 🇳🇬"
    ];
    
    const randomMessage = messages[Math.floor(Math.random() * messages.length)];
    
    alert(randomMessage + "\n\nAddress: 0xNadinhoVibe... (Demo Mode)");
    
    // Optional: Change button text after click
    const buttons = document.querySelectorAll('.connect-btn');
    buttons.forEach(btn => {
        const originalText = btn.innerHTML;
        btn.innerHTML = `<i class="fas fa-check"></i> Connected`;
        btn.style.background = 'linear-gradient(45deg, #00ff9d, #00ffc8)';
        
        // Reset after 3 seconds
        setTimeout(() => {
            btn.innerHTML = originalText;
            btn.style.background = '';
        }, 3000);
    });
}

// Animate Portfolio Value on Homepage (Fake live update)
function animatePortfolioValue() {
    const valueElement = document.getElementById('portfolio-value');
    if (!valueElement) return;

    let currentValue = 12845.67;
    const targetValue = 12845.67;
    const increment = 12.34;

    const interval = setInterval(() => {
        currentValue += increment;
        valueElement.textContent = '$' + currentValue.toFixed(2);
        
        if (currentValue >= targetValue + 150) {
            clearInterval(interval);
            valueElement.textContent = '$12,845.67';
        }
    }, 80);
}

// Fake Live Price Updates (for future enhancement)
function updateLivePrices() {
    console.log("%c📈 Live prices would update here in a real app", "color: #00ffc8; font-weight: bold");
    // You can expand this later to update coin prices dynamically
}

// Make navigation active based on current page
function setActiveNav() {
    const currentPage = window.location.pathname.split("/").pop() || "index.html";
    const navLinks = document.querySelectorAll('.nav-links a');
    
    navLinks.forEach(link => {
        const href = link.getAttribute('href');
        if (href === currentPage) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });
}

// Initialize everything when page loads
document.addEventListener('DOMContentLoaded', function() {
    console.log("%c✅ Nadinho Crypto Portfolio JS Loaded Successfully", "color: #00ffc8; font-size: 14px");
    
    // Run functions
    setActiveNav();
    
    // Run portfolio value animation only on homepage
    if (window.location.pathname.includes("index.html") || 
        window.location.pathname === "/" || 
        window.location.pathname.endsWith("/")) {
        animatePortfolioValue();
    }

    // Optional: Add smooth scrolling for any anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth'
                });
            }
        });
    });
});

// Keyboard shortcut: Press "C" to connect wallet (fun for demo)
document.addEventListener('keydown', function(e) {
    if (e.key.toLowerCase() === 'c') {
        connectWallet();
    }
});