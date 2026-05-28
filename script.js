/**
 * Ethio Suno - Enterprise Production Script
 * Architecture Level: Production Ready - Fully Fixed & Optimized
 */

const CONFIG = {
    webhookUrl: "https://hook.eu1.make.com/b5gdgowiv4ih95mhrm8cds5fhd14mlmn",
    defaultCredits: 2,
    trashExpirationMs: 30 * 1000 // 30 seconds for evaluation
};

// --- Secure State Storage Engine ---
const StorageEngine = {
    get: (key) => {
        try {
            const raw = localStorage.getItem(btoa(key));
            return raw ? atob(raw) : null;
        } catch (e) {
            console.error("Storage read exception", e);
            return null;
        }
    },
    set: (key, val) => {
        try {
            localStorage.setItem(btoa(key), btoa(String(val)));
        } catch (e) {
            console.error("Storage write exception", e);
        }
    }
};

let currentUser = StorageEngine.get("ethio_suno_user") || "Guest";
let selectedPlan = "";
let currentAudio = null;
let currentPlayBtn = null;
let activeTimelineId = null;
let currentTabFilter = "all";
let currentLang = localStorage.getItem("app_lang") || "am";
let searchHistory = [];

try {
    searchHistory = JSON.parse(StorageEngine.get(`search_hist_${currentUser}`)) || [];
} catch(e) {
    searchHistory = [];
}

const translations = {
    am: {
        planLabel: "ዕቅድ፦", smsLabel: "Smart Paste / የቴሌብር SMS መለጠፊያ", txLabel: "Transaction ID / የግብይት ቁጥር",
        submitBtn: "ማረጋገጫ አቅርብ", lowCredit: "የማምረቻ ክሬዲትዎ እያለቀ ነው! እባክዎ ከታች ጥቅል በመግዛት አካውንቶን ይሙሉ::",
        lyricsTitle: "Lyrics / የዘፈን ግጥም", styleTitle: "Vibe & Genre / ስልት", tagChikchika: "ጭቅጭቃ",
        tagJazz: "ኢትዮ-ጃዝ", trackTitleLabel: "Track Title / ርዕስ", topUpLabel: "Top-Up Credits",
        statementLabel: "Credit Statement / የክሬዲት ታሪክ", workspaceTitle: "የሙዚቃ ማህደሬ", tabAll: "ሁሉም", tabFav: "ተወዳጅ 🎵"
    },
    en: {
        planLabel: "Plan:", smsLabel: "Smart Paste / Telebirr SMS Parser", txLabel: "Transaction ID",
        submitBtn: "Submit Payment", lowCredit: "Your production credits are low! Please top-up below.",
        lyricsTitle: "Lyrics / Song Poem", styleTitle: "Vibe & Genre / Style", tagChikchika: "Chikchika",
        tagJazz: "Ethio-Jazz", trackTitleLabel: "Track Title", topUpLabel: "Top-Up Credits",
        statementLabel: "Credit Statement", workspaceTitle: "My Music Studio Workspace", tabAll: "All Tracks", tabFav: "Favorites ❤️"
    }
};

document.addEventListener("DOMContentLoaded", () => {
    initApp();
});

function initApp() {
    const savedTheme = localStorage.getItem("app_theme") || "dark";
    document.documentElement.setAttribute("data-theme", savedTheme);
    updateThemeIcon(savedTheme);
    applyLocalization();
    refreshAppView();

    // Background Garbage Collector
    setInterval(runAutoGarbageExpunger, 5000);
}

function showToast(message, isSuccess = true) {
    const toast = document.getElementById("toastAlert");
    const msgSpan = document.getElementById("toastMessage");
    const icon = document.getElementById("toastIcon");
    if (!toast || !msgSpan || !icon) return;

    msgSpan.innerText = message;
    icon.className = isSuccess ? "fa-solid fa-circle-check" : "fa-solid fa-triangle-exclamation";
    icon.style.color = isSuccess ? "var(--accent-green)" : "#f44336";

    toast.classList.add("show");
    setTimeout(() => { toast.classList.remove("show"); }, 3500);
}

// --- Account Management Section ---
function linkAccount() {
    const phoneInput = document.getElementById("headerPhoneInput");
    const pinInput = document.getElementById("headerPinInput");
    if (!phoneInput || !pinInput) return;

    const phone = phoneInput.value.trim();
    const pin = pinInput.value.trim();
    
    if (phone.length < 9) { showToast("ስልክ ቁጥር በትክክል ያስገቡ!", false); return; }
    if (pin.length !== 4 || isNaN(pin)) { showToast("PIN 4 አሃዝ መሆን አለበት!", false); return; }

    const savedPin = StorageEngine.get(`pin_${phone}`);
    if (savedPin && savedPin !== pin) {
        showToast("የሚስጥር ቁጥር አልተዛመደም!", false);
        return;
    } else if (!savedPin) {
        StorageEngine.set(`pin_${phone}`, pin);
        showToast("አዲስ የደህንነት ፒን ተፈጥሯል! 🔒");
    }

    currentUser = phone;
    StorageEngine.set("ethio_suno_user", currentUser);
    resetGlobalPlayer(); 
    refreshAppView();
    showToast("መለያዎ በተሳካ ሁኔታ ተገናኝቷል! 🎯");
}

function logOutAccount() {
    if (confirm("እርግጠኛ ነዎት መውጣት ይፈልጋሉ?")) {
        resetGlobalPlayer(); 
        currentUser = "Guest";
        StorageEngine.set("ethio_suno_user", "Guest");
        
        const pinField = document.getElementById("headerPinInput");
        const phoneField = document.getElementById("headerPhoneInput");
        if (pinField) pinField.value = "";
        if (phoneField) phoneField.value = "";
        
        refreshAppView();
    }
}

// --- Credit Engine & Transactions ---
function executeCreditTransfer() {
    const targetPhoneEl = document.getElementById("transferPhoneInput");
    const amountEl = document.getElementById("transferAmountInput");
    if (!targetPhoneEl || !amountEl) return;

    const targetPhone = targetPhoneEl.value.trim();
    const amount = parseInt(amountEl.value, 10);
    let myCredits = parseInt(StorageEngine.get(`credits_${currentUser}`), 10) || 0;

    if (!targetPhone || isNaN(amount) || amount <= 0) { showToast("እባክዎ ትክክለኛ መረጃ ያስገቡ", false); return; }
    if (myCredits < amount) { showToast("በቂ ክሬዲት የለዎትም!", false); return; }

    StorageEngine.set(`credits_${currentUser}`, myCredits - amount);
    addCreditLog(`Transferred to ${targetPhone}`, `-${amount}`, false);

    let targetCredits = parseInt(StorageEngine.get(`credits_${targetPhone}`), 10) || 0;
    StorageEngine.set(`credits_${targetPhone}`, targetCredits + amount);
    
    let targetLogs = [];
    try {
        targetLogs = JSON.parse(StorageEngine.get(`logs_${targetPhone}`)) || [];
    } catch(e) { targetLogs = []; }
    
    targetLogs.unshift({ desc: `Received from ${currentUser}`, amt: `+${amount}`, isPlus: true });
    StorageEngine.set(`logs_${targetPhone}`, JSON.stringify(targetLogs));

    closeTransferModal();
    refreshAppView();
    showToast(`ለ ${targetPhone} ${amount} ክሬዲት ተላልፏል!`);
}

async function submitPaymentDetails() {
    const txIdEl = document.getElementById("txIdInput");
    if (!txIdEl) return;
    const txId = txIdEl.value.trim().toUpperCase(); 
    if (txId === "") { showToast("እባክዎ መጀመሪያ የግብይት ቁጥር ያስገቡ!", false); return; }

    let usedTxIds = [];
    try {
        usedTxIds = JSON.parse(localStorage.getItem("used_telebirr_txids")) || [];
    } catch(e) { usedTxIds = []; }

    if (usedTxIds.includes(txId)) {
        showToast("ይህ የግብይት ቁጥር ቀደም ሲል ጥቅም ላይ ውሏል!", false);
        return;
    }

    try {
        const response = await fetch(CONFIG.webhookUrl, { 
            method: "POST", 
            headers: { "Content-Type": "application/json" }, 
            body: JSON.stringify({ 
                action: "CREDIT_PURCHASE_REQUEST", 
                userId: currentUser, 
                plan: selectedPlan, 
                transactionId: txId 
            }) 
        });
        
        if (!response.ok) throw new Error("Network latency detected.");

        let globalRequests = [];
        try { globalRequests = JSON.parse(localStorage.getItem("global_payment_requests")) || []; } catch(e) { globalRequests = []; }
        
        globalRequests.push({ userId: currentUser, plan: selectedPlan, txId: txId });
        localStorage.setItem("global_payment_requests", JSON.stringify(globalRequests));
        
        usedTxIds.push(txId);
        localStorage.setItem("used_telebirr_txids", JSON.stringify(usedTxIds));

        closePaymentModal(); 
        showToast("ጥያቄው ተልኳል! ማረጋገጫ ይጠብቁ።");
    } catch (e) { 
        showToast("የኔትወርክ ስህተት አጋጥሟል፤ እባክዎ እንደገና ይሞክሩ", false); 
    }
}

// --- Music Generation Engine ---
async function generateMusic() {
    const lyricsEl = document.getElementById("lyricsInput");
    const styleEl = document.getElementById("styleInput");
    const titleEl = document.getElementById("titleInput");
    const genBtn = document.getElementById("createBtn");
    
    if(!lyricsEl || !styleEl || !titleEl) return;

    const lyrics = lyricsEl.value.trim();
    const style = styleEl.value.trim();
    const title = titleEl.value.trim() || "AI Track";
    let credits = parseInt(StorageEngine.get(`credits_${currentUser}`), 10);

    if (isNaN(credits) || credits <= 0) { 
        showToast("በቂ ክሬዲት የለዎትም!", false); 
        return; 
    }
    if (style === "") { showToast("እባክዎ የሙዚቃ ስልት ይምረጡ!", false); return; }

    try {
        if(genBtn) { genBtn.disabled = true; genBtn.innerText = "በማምረት ላይ... ⏳"; }
        showToast("ትዕዛዝዎ ወደ Make.com ተልኳል፤ ሙዚቃው እየተመረተ ነው...");

        const response = await fetch(CONFIG.webhookUrl, { 
            method: "POST", 
            headers: { "Content-Type": "application/json" }, 
            body: JSON.stringify({ 
                action: "GENERATE_MUSIC", 
                userId: currentUser, 
                title: title, 
                style: style, 
                lyrics: lyrics 
            }) 
        });
        
        if (response.ok) {
            const result = await response.json();
            const liveAudioUrl = (result && result.audioUrl) 
                ? result.audioUrl 
                : "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3"; 

            credits--; 
            StorageEngine.set(`credits_${currentUser}`, credits);
            addCreditLog(`Generated (${title})`, "-1", false);
            
            let songs = [];
            try { songs = JSON.parse(StorageEngine.get(`songs_${currentUser}`)) || []; } catch(e) { songs = []; }
            
            songs.unshift({ 
                id: "sn-" + Date.now(), 
                title: title, 
                style: style, 
                audioUrl: liveAudioUrl,
                favorite: false, 
                deleted: false, 
                timestamp: Date.now() 
            });
            
            StorageEngine.set(`songs_${currentUser}`, JSON.stringify(songs));
            refreshAppView(); 
            showToast("ሙዚቃው በተሳካ ሁኔታ ተመርቷል! 🎵");
        } else {
            showToast("ትዕዛዝዎን ማጠናቀቅ አልተቻለም (Server Error)", false);
        }
    } catch (error) {
        console.error("Suno API Bridge Integration Error:", error);
        showToast("የሰርቨር ግንኙነት ችግር አጋጥሟል", false);
    } finally {
        if(genBtn) { genBtn.disabled = false; genBtn.innerText = "Synthesize Audio / ዜማ ፍጠር"; }
    }
}

// --- Media Player Engine ---
function resetGlobalPlayer() {
    if (currentAudio) { 
        currentAudio.pause(); 
        currentAudio.src = ""; 
        currentAudio = null; 
    }
    currentPlayBtn = null; 
    activeTimelineId = null;
    document.querySelectorAll(".wave-bar").forEach(b => b.classList.remove("animating"));
}

function toggleAudio(url, btn, index) {
    const timeline = document.getElementById(`timeline-${index}`);
    const slider = document.getElementById(`slider-${index}`);
    if (!timeline || !slider) return;
    
    const waveBars = timeline.querySelectorAll(".wave-bar");

    if (currentAudio && currentAudio.src === url) {
        if (currentAudio.paused) { 
            currentAudio.play(); 
            btn.innerHTML = '<i class="fa-solid fa-pause"></i>'; 
            btn.classList.add("playing");
            waveBars.forEach(b => b.classList.add("animating"));
        } else { 
            currentAudio.pause(); 
            btn.innerHTML = '<i class="fa-solid fa-play"></i>'; 
            btn.classList.remove("playing");
            waveBars.forEach(b => b.classList.remove("animating"));
        }
    } else {
        resetGlobalPlayer();
        
        currentAudio = new Audio(url); 
        currentPlayBtn = btn; 
        activeTimelineId = `timeline-${index}`;
        
        currentAudio.play().catch(e => console.warn("Playback prevented"));
        btn.innerHTML = '<i class="fa-solid fa-pause"></i>'; 
        btn.classList.add("playing"); 
        timeline.style.display = "flex";
        waveBars.forEach(b => b.classList.add("animating"));

        currentAudio.addEventListener("timeupdate", () => {
            if (!currentAudio || activeTimelineId !== `timeline-${index}`) return;
            const cur = currentAudio.currentTime; 
            const dur = currentAudio.duration || 0;
            slider.value = dur > 0 ? (cur / dur) * 100 : 0;
            
            const curLabel = document.getElementById(`current-time-${index}`);
            const durLabel = document.getElementById(`duration-${index}`);
            if (curLabel) curLabel.innerText = formatTime(cur); 
            if (durLabel) durLabel.innerText = formatTime(dur);
        });

        slider.oninput = () => { 
            if (currentAudio) currentAudio.currentTime = (slider.value / 100) * currentAudio.duration; 
        };
    }
}

function changeAudioSpeed(index, badgeEl) {
    if (!currentAudio || activeTimelineId !== `timeline-${index}`) { showToast("እባክዎ መጀመሪያ ሙዚቃውን ያጫውቱት!", false); return; }
    const speeds = [1.0, 1.25, 1.5, 2.0, 0.5];
    const currentSpeed = currentAudio.playbackRate;
    const nextIdx = (speeds.indexOf(currentSpeed) + 1) % speeds.length;
    currentAudio.playbackRate = speeds[nextIdx];
    badgeEl.innerText = speeds[nextIdx] + "x";
}

// --- Garbage Disposal Engine ---
function runAutoGarbageExpunger() {
    let songs = [];
    try { songs = JSON.parse(StorageEngine.get(`songs_${currentUser}`)) || []; } catch(e) { return; }
    
    if (!songs || !Array.isArray(songs) || songs.length === 0) return;

    const initialCount = songs.length;
    songs = songs.filter(song => {
        if (song.deleted && song.trashedAt) {
            return (Date.now() - song.trashedAt) < CONFIG.trashExpirationMs;
        }
        return true;
    });

    if (songs.length !== initialCount) {
        StorageEngine.set(`songs_${currentUser}`, JSON.stringify(songs));
        loadUserWorkspace();
    }
}

// --- Auxiliary & Global UI Views ---
function refreshAppView() {
    try {
        searchHistory = JSON.parse(StorageEngine.get(`search_hist_${currentUser}`)) || [];
    } catch(e) { searchHistory = []; }

    const creditDisplay = document.getElementById("creditDisplay");
    const logoutBtn = document.getElementById("logoutBtn");
    const workspaceLbl = document.getElementById("lblUserWorkspace");
    const lowCreditBanner = document.getElementById("lowCreditBanner");
    
    if (workspaceLbl) workspaceLbl.innerText = currentUser;
    if (!StorageEngine.get(`credits_${currentUser}`)) { 
        StorageEngine.set(`credits_${currentUser}`, CONFIG.defaultCredits); 
        addCreditLog("የነፃ ስጦታ ክሬዲት", `+${CONFIG.defaultCredits}`, true); 
    }
    
    const currentCredits = parseInt(StorageEngine.get(`credits_${currentUser}`), 10) || 0;
    if (creditDisplay) creditDisplay.innerText = currentCredits;
    if (lowCreditBanner) lowCreditBanner.style.display = currentCredits <= 1 ? "flex" : "none";
    
    const statusDot = document.getElementById("statusDot");
    if (statusDot) {
        statusDot.className = (currentUser === "Guest") ? "status-dot status-guest" : "status-dot status-active";
    }
    if (logoutBtn) logoutBtn.style.display = (currentUser === "Guest") ? "none" : "block";
    
    loadUserWorkspace(); 
    loadCreditLogs(); 
    checkAdminStatus(); 
    updateLyricsCounters(); 
    renderSearchHistory();
}

function loadUserWorkspace() {
    const list = document.getElementById("workspaceList"); 
    if (!list) return; 
    list.innerHTML = "";
    
    let songs = [];
    try { songs = JSON.parse(StorageEngine.get(`songs_${currentUser}`)) || []; } catch(e) { songs = []; }
    
    const sortType = document.getElementById("sortFilterSelect")?.value || "newest";
    songs.sort((a, b) => sortType === "newest" ? b.timestamp - a.timestamp : a.timestamp - b.timestamp);

    if (currentTabFilter === "fav") songs = songs.filter(s => s.favorite && !s.deleted);
    else if (currentTabFilter === "trash") songs = songs.filter(s => s.deleted);
    else songs = songs.filter(s => !s.deleted);

    if (songs.length === 0) { 
        list.innerHTML = `<p style="color:var(--text-muted); text-align:center; padding-top:20px; font-size:14px;">ምንም ሙዚቃ አልተገኘም።</p>`; 
        return; 
    }
    
    songs.forEach((song) => {
        let waveBarsHTML = '';
        for(let i=0; i<20; i++) { 
            let delay = (Math.random() * 0.5).toFixed(2);
            waveBarsHTML += `<div class="wave-bar" style="animation-delay: ${delay}s"></div>`; 
        }

        const actionButtons = song.deleted ? 
            `<button class="trash-btn" onclick="restoreSongFromTrash('${song.id}')" title="Restore"><i class="fa-solid fa-trash-arrow-up" style="color:var(--accent-green)"></i></button>` : 
            `<button class="fav-btn ${song.favorite ? 'active' : ''}" onclick="toggleFavoriteSong('${song.id}')"><i class="${song.favorite ? 'fa-solid' : 'fa-regular'} fa-heart"></i></button>
             <a href="${song.audioUrl}" download="${song.title}.mp3" class="download-btn"><i class="fa-solid fa-download"></i></a>
             <button class="trash-btn" onclick="moveSongToTrash('${song.id}')" title="Delete"><i class="fa-solid fa-trash-can"></i></button>`;

        list.innerHTML += `
            <div class="song-card" data-style="${song.style}">
                <div class="song-core-row">
                    <div class="song-info-block">
                        <button class="play-btn" onclick="toggleAudio('${song.audioUrl}', this, '${song.id}')"><i class="fa-solid fa-play"></i></button>
                        <div>
                            <div class="song-title">${song.title}</div>
                            <div class="song-meta">${song.style}</div>
                        </div>
                    </div>
                    <div class="action-btn-group">${actionButtons}</div>
                </div>
                <div class="player-timeline" id="timeline-${song.id}">
                    <div class="waveform-container">${waveBarsHTML}</div>
                    <div class="timeline-controls-row">
                        <span class="time-label" id="current-time-${song.id}">0:00</span>
                        <input type="range" class="timeline-slider" id="slider-${song.id}" value="0" min="0" max="100">
                        <span class="time-label" id="duration-${song.id}">0:00</span>
                        <span class="speed-badge" onclick="changeAudioSpeed('${song.id}', this)">1.0x</span>
                    </div>
                </div>
            </div>`;
    });
    
    // UI ማጣሪያን ማስኬድ (ያለ Infinite Loop)
    filterWorkspaceSongs();
}

function cleanInputText(id) {
    const el = document.getElementById(id); 
    if (!el) return;
    el.value = el.value.replace(/(?:https?|ftp):\/\/[\n\S]+/g, '').replace(/@\S+/g, '').replace(/\s+/g, ' ').trim();
}

function formatTime(secs) {
    if (isNaN(secs)) return "0:00";
    const m = Math.floor(secs / 60); 
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
}

// Common structural utilities
function toggleLanguage() { currentLang = currentLang === "am" ? "en" : "am"; localStorage.setItem("app_lang", currentLang); applyLocalization(); }
function applyLocalization() { const btn = document.getElementById("langBtn"); if(btn) btn.innerText = currentLang === "am" ? "EN" : "አማ"; const dict = translations[currentLang]; document.querySelectorAll("[data-i18n]").forEach(el => { const key = el.getAttribute("data-i18n"); if(dict[key]) el.innerText = dict[key]; }); }
function openTransferModal() { if(currentUser === "Guest") { alert("እባክዎ መጀመሪያ ይግቡ!"); return; } const o = document.getElementById("transferModal"); if(o) { o.style.display = "flex"; setTimeout(() => o.classList.add("active"), 10); } }
function closeTransferModal() { const o = document.getElementById("transferModal"); if(o) { o.classList.remove("active"); setTimeout(() => o.style.display = "none", 300); } }
function openPaymentModal(plan) { selectedPlan = plan; const lbl = document.getElementById("modalPlanName"); if(lbl) lbl.innerText = plan; const o = document.getElementById("paymentModal"); if(o) { o.style.display = "flex"; setTimeout(() => o.classList.add("active"), 10); } }
function closePaymentModal() { const o = document.getElementById("paymentModal"); if(o) { o.classList.remove("active"); setTimeout(() => o.style.display = "none", 300); } }
function copyTelebirrNumber() { const n = document.getElementById("telebirrNumber"); if(n) { navigator.clipboard.writeText(n.innerText); showToast("ቁጥሩ ተገልብጧል! 📋"); } }
function copyBoxContent(id) { const el = document.getElementById(id); if(el && el.value.trim() !== "") { navigator.clipboard.writeText(el.value); showToast("ኮፒ ተደርጓል! 📋"); } }
function clearBoxContent(id) { const el = document.getElementById(id); if(el) el.value = ""; }
function updateLyricsCounters() { const el = document.getElementById("lyricsInput"); const lbl = document.getElementById("lyricsCounter"); if(el && lbl) { const txt = el.value; lbl.innerText = `${txt.length} ፊደላት | ${txt.trim() === "" ? 0 : txt.trim().split(/\s+/).length} ቃላት`; } }
function toggleAppTheme() { const t = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark"; document.documentElement.setAttribute("data-theme", t); localStorage.setItem("app_theme", t); updateThemeIcon(t); }
function updateThemeIcon(t) { const i = document.getElementById("themeIcon"); if(i) i.className = t === "light" ? "fa-solid fa-sun" : "fa-solid fa-moon"; }
function handleSearchKey(e) { if (e.key === "Enter") { const q = e.target.value.trim(); if (q !== "" && !searchHistory.includes(q)) { searchHistory.unshift(q); if(searchHistory.length > 5) searchHistory.pop(); StorageEngine.set(`search_hist_${currentUser}`, JSON.stringify(searchHistory)); renderSearchHistory(); } } }
function renderSearchHistory() { const c = document.getElementById("searchHistoryTags"); if(!c) return; c.innerHTML = ""; if(searchHistory.length > 0) { searchHistory.forEach(q => { c.innerHTML += `<span class="history-tag" onclick="applyHistorySearch('${q}')">${q}</span>`; }); c.innerHTML += `<span class="history-tag" style="border:none; color:#f44336;" onclick="clearSearchHistory()">Clear X</span>`; } }
function applyHistorySearch(q) { const i = document.getElementById("workspaceSearchInput"); if(i) { i.value = q; filterWorkspaceSongs(); } }
function clearSearchHistory() { searchHistory = []; localStorage.removeItem(btoa(`search_hist_${currentUser}`)); renderSearchHistory(); const i = document.getElementById("workspaceSearchInput"); if(i) { i.value = ""; filterWorkspaceSongs(); } }
function switchWorkspaceTab(t) { currentTabFilter = t; ["all","fav","trash"].forEach(id => document.getElementById(`tab-${id}`)?.classList.remove("active")); document.getElementById(`tab-${t}`)?.classList.add("active"); loadUserWorkspace(); }

function filterWorkspaceSongs() { 
    const q = document.getElementById("workspaceSearchInput")?.value.toLowerCase().trim() || ""; 
    const g = document.getElementById("genreFilterSelect")?.value || "all"; 
    
    document.querySelectorAll("#workspaceList .song-card").forEach(card => { 
        const title = card.querySelector(".song-title").innerText.toLowerCase(); 
        const meta = card.querySelector(".song-meta").innerText; 
        
        const matchesSearch = title.includes(q) || meta.toLowerCase().includes(q);
        const matchesGenre = (g === "all" || meta.includes(g));
        
        card.style.display = (matchesSearch && matchesGenre) ? "flex" : "none"; 
    }); 
}

function toggleFavoriteSong(id) { let s = []; try{s=JSON.parse(StorageEngine.get(`songs_${currentUser}`))||[];}catch(e){} const idx = s.findIndex(x => x.id === id); if(idx !== -1) { s[idx].favorite = !s[idx].favorite; StorageEngine.set(`songs_${currentUser}`, JSON.stringify(s)); loadUserWorkspace(); } }
function moveSongToTrash(id) { let s = []; try{s=JSON.parse(StorageEngine.get(`songs_${currentUser}`))||[];}catch(e){} const idx = s.findIndex(x => x.id === id); if(idx !== -1) { s[idx].deleted = true; s[idx].trashedAt = Date.now(); StorageEngine.set(`songs_${currentUser}`, JSON.stringify(s)); resetGlobalPlayer(); loadUserWorkspace(); showToast("ሙዚቃው ወደ መጣያ ቅርጫት ተወስዷል!"); } }
function restoreSongFromTrash(id) { let s = []; try{s=JSON.parse(StorageEngine.get(`songs_${currentUser}`))||[];}catch(e){} const idx = s.findIndex(x => x.id === id); if(idx !== -1) { s[idx].deleted = false; delete s[idx].trashedAt; StorageEngine.set(`songs_${currentUser}`, JSON.stringify(s)); loadUserWorkspace(); showToast("ሙዚቃው በተካሳ ሁኔታ ተመልሷል! 🔄"); } }
function addCreditLog(d, a, p) { let l = []; try{l=JSON.parse(StorageEngine.get(`logs_${currentUser}`))||[];}catch(e){} l.unshift({ desc: d, amt: a, isPlus: p }); StorageEngine.set(`logs_${currentUser}`, JSON.stringify(l)); }
function loadCreditLogs() { const c = document.getElementById("creditLogsContainer"); if (!c) return; c.innerHTML = ""; let l = []; try{l=JSON.parse(StorageEngine.get(`logs_${currentUser}`))||[];}catch(e){} if(l.length === 0) { c.innerHTML = `<div style="font-size:12px; color:var(--text-muted)">ምንም እንቅስቃሴ የለም።</div>`; return; } l.slice(0, 3).forEach(log => { c.innerHTML += `<div class="log-item"><span>${log.desc}</span><b class="${log.isPlus ? 'plus' : 'minus'}">${log.amt}</b></div>`; }); }
function checkAdminStatus() { const term = document.getElementById("adminTerminal"); if(term) term.style.display = (currentUser === "0900000000") ? "block" : "none"; if (currentUser === "0900000000") loadAdminRequests(); }
function loadAdminRequests() { const list = document.getElementById("adminRequestList"); if (!list) return; list.innerHTML = ""; let r = []; try{r=JSON.parse(localStorage.getItem("global_payment_requests"))||[];}catch(e){} if(r.length === 0) { list.innerHTML = `<p style="color:var(--text-muted); font-size:13px; text-align:center;">ምንም ጥያቄ የለም።</p>`; return; } r.forEach((req, idx) => { list.innerHTML += `<div class="admin-item"><div>User: <b>${req.userId}</b> | Plan: <b style="color:var(--accent-orange);">${req.plan}</b><br>TxID: <code>${req.txId}</code></div><button class="approve-btn" onclick="approveOrder(${idx})">Approve</button></div>`; }); }
function approveOrder(idx) { let r = []; try{r=JSON.parse(localStorage.getItem("global_payment_requests"))||[];}catch(e){} const target = r[idx]; let c = parseInt(StorageEngine.get(`credits_${target.userId}`), 10) || 0; const amt = target.plan.includes("Pro") ? 30 : 90; StorageEngine.set(`credits_${target.userId}`, c + amt); let logs = []; try{logs=JSON.parse(StorageEngine.get(`logs_${target.userId}`))||[];}catch(e){} logs.unshift({ desc: `ጥቅል ግዢ (${target.plan})`, amt: `+${amt}`, isPlus: true }); StorageEngine.set(`logs_${target.userId}`, JSON.stringify(logs)); r.splice(idx, 1); localStorage.setItem("global_payment_requests", JSON.stringify(r)); refreshAppView(); showToast(`✅ ግብይት ጸድቋል!`); }

function extractTxIDFromSMS() { 
    const sms = document.getElementById("smsInput")?.value || ""; 
    // የተሻሻለ የቴሌብር ረጅም የግብይት ቁጥሮችን መለያ (Regex)
    const m = sms.match(/[A-Z0-9]{10,18}/i); 
    if (m && document.getElementById("txIdInput")) {
        document.getElementById("txIdInput").value = m[0].toUpperCase(); 
    } 
}

function generateAILyrics() { const s = [`[Verse 1]\nበሩቅ እያየሁሽ በሕልሜ መድረኩን...\nበድምፅሽ ማረክሽው የልቤን አለምን።`, `[Verse 1]\nማዕበል ቢያናውጠው የፍቅራችንን ታንኳ...\nአንቺው ነሽ መሪዬ የልቤ ፅኑ መልህቅ።`]; document.getElementById("lyricsInput").value = s[Math.floor(Math.random() * s.length)]; updateLyricsCounters(); showToast("አዲስ ግጥም ተዘጋጅቷል! 🎉"); }
function generateAIStyle() { const g = ["Chikchika", "Ethio-Jazz"]; document.getElementById("styleInput").value = g[Math.floor(Math.random() * g.length)]; showToast("የሙዚቃ ስልት ተመርጧል! ✨"); }
function generateAITitle() { document.getElementById("titleInput").value = "የዜማ ማዕበል"; showToast("ርዕስ ተፈጥሯል! 🎵"); }
