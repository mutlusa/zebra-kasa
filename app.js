/* ═══════════════════════════════════════════════════════════════
   Zebra Mimarlık — Kasa Yönetimi
   Application Logic (Data Layer, UI Layer, Routing)
   ═══════════════════════════════════════════════════════════════ */

const App = (() => {
    'use strict';

    // ─────────────────────────────────────
    // CONSTANTS
    // ─────────────────────────────────────
    const STORAGE_KEY = 'zebraKasaData';
    const RISK_DAYS = 30;

    const TX_TYPES = {
        hakedis:    { label: 'Hakediş / Gelir',    icon: '💰', direction: 'income',  cssClass: 'income' },
        malzeme:    { label: 'Malzeme Gideri',      icon: '🧱', direction: 'expense', cssClass: 'expense' },
        iscilik:    { label: 'İşçilik Gideri',      icon: '👷', direction: 'expense', cssClass: 'expense' },
        'ofis-sabit': { label: 'Ofis Sabit Gideri', icon: '🏢', direction: 'expense', cssClass: 'ofis' }
    };

    const STATUS_LABELS = {
        odendi:   'Kapatıldı / Ödendi',
        bekliyor: 'Bekliyor'
    };

    const PROJECT_STATUS = {
        'devam-ediyor': 'Devam Ediyor',
        'tamamlandi':   'Tamamlandı'
    };

    const MONTHS_TR = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
    const MONTHS_FULL_TR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
    const DAYS_TR = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];

    // ─────────────────────────────────────
    // STATE
    // ─────────────────────────────────────
    let data = { projects: [], transactions: [] };
    let currentProjectId = null;
    let confirmCallback = null;

    // ─────────────────────────────────────
    // DATA LAYER — Storage
    // ─────────────────────────────────────
    function loadData() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                data = JSON.parse(raw);
                // Ensure arrays exist
                if (!Array.isArray(data.projects)) data.projects = [];
                if (!Array.isArray(data.transactions)) data.transactions = [];
            } else {
                seedDemoData();
            }
        } catch (e) {
            console.error('Veri yüklenirken hata:', e);
            data = { projects: [], transactions: [] };
        }
    }

    // ─────────────────────────────────────
    // FIREBASE REALTIME CLOUD SYNC & PIN AUTH
    // ─────────────────────────────────────
    let dbRef = null;
    let isCloudSyncing = false;
    const DEFAULT_SYNC_ROOM = 'zebra_kasa_shared_db';
    const PIN_KEY = 'zebra_team_pin';

    function initCloudSync() {
        if (typeof firebase === 'undefined') return;
        try {
            if (!firebase.apps.length) {
                firebase.initializeApp({
                    databaseURL: "https://zebra-kasa-default-rtdb.europe-west1.firebasedatabase.app"
                });
            }
            const roomKey = localStorage.getItem('zebra_sync_room') || DEFAULT_SYNC_ROOM;
            dbRef = firebase.database().ref('rooms/' + roomKey);

            // Listen for live updates from other devices / users
            dbRef.on('value', (snapshot) => {
                const cloudData = snapshot.val();
                if (cloudData && typeof cloudData === 'object' && Array.isArray(cloudData.projects)) {
                    isCloudSyncing = true;
                    data = cloudData;
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
                    isCloudSyncing = false;

                    if (currentProjectId) {
                        renderProjectDetail(currentProjectId);
                    } else {
                        renderDashboard();
                    }
                }
            });

            updateSyncBadgeStatus('connected');
        } catch (err) {
            console.warn('Bulut senkronizasyon yerel modda başlatıldı:', err);
            updateSyncBadgeStatus('local');
        }
    }

    function syncDataToCloud() {
        if (isCloudSyncing || !dbRef) return;
        try {
            dbRef.set(data);
        } catch (err) {
            console.error('Bulut verisi güncellenemedi:', err);
        }
    }

    function updateSyncBadgeStatus(status) {
        const badge = document.getElementById('cloud-sync-badge');
        if (!badge) return;
        if (status === 'connected') {
            badge.innerHTML = `
                <span style="display:flex; align-items:center; gap:6px; font-weight:700; color:var(--success);">
                    <span class="dot safe" style="background:#10b981; width:8px; height:8px; display:inline-block; border-radius:50%;"></span>
                    🟢 Canlı Bulut Senkronize
                </span>
                <span style="font-size:0.7rem; color:var(--text-muted);">🔑 Ekip</span>
            `;
        } else {
            badge.innerHTML = `
                <span style="display:flex; align-items:center; gap:6px; font-weight:700; color:var(--warning);">
                    <span class="dot" style="background:#f59e0b; width:8px; height:8px; display:inline-block; border-radius:50%;"></span>
                    🟡 Yerel Kayıt Modu
                </span>
            `;
        }
    }

    function promptPinLock(targetPin) {
        const html = `
            <div style="text-align: center; padding: 10px 0;">
                <div style="font-size: 3rem; margin-bottom: 10px;">🔐</div>
                <h3 style="font-weight: 800; margin-bottom: 6px;">Ekip Güvenlik PIN Kodu</h3>
                <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 20px;">
                    Zebra Kasa verilerine erişmek için lütfen 4 haneli PIN kodunu girin.
                </p>
                <div class="form-group" style="max-width: 240px; margin: 0 auto 20px auto;">
                    <input type="password" id="input-lock-pin" class="form-input" maxlength="8" placeholder="••••" style="text-align: center; font-size: 1.5rem; letter-spacing: 8px; font-weight: 800;" autofocus onkeyup="if(event.key==='Enter') App.verifyTeamPin('${targetPin}')">
                </div>
                <button class="btn btn-primary" style="width: 100%; max-width: 240px;" onclick="App.verifyTeamPin('${targetPin}')">🚀 Giriş Yap</button>
            </div>
        `;
        openModal('🔐 Güvenlik Doğrulaması', html);
    }

    function verifyTeamPin(targetPin) {
        const input = document.getElementById('input-lock-pin')?.value;
        if (input === targetPin) {
            sessionStorage.setItem('zebra_pin_unlocked', 'true');
            closeModal();
            showToast('Giriş başarılı!', 'success');
            if (currentProjectId) renderProjectDetail(currentProjectId);
            else renderDashboard();
        } else {
            showToast('Hatalı PIN Kodu!', 'error');
        }
    }

    function checkTeamPin() {
        const savedPin = localStorage.getItem(PIN_KEY);
        if (!savedPin) return true;

        const sessionUnlocked = sessionStorage.getItem('zebra_pin_unlocked');
        if (sessionUnlocked === 'true') return true;

        promptPinLock(savedPin);
        return false;
    }

    function openPinSettingsModal() {
        const currentPin = localStorage.getItem(PIN_KEY) || '';
        const html = `
            <div class="import-info" style="margin-bottom: 15px;">
                🔑 <strong>Ekip PIN Kodu & Bulut Ayarları</strong><br>
                Tüm ekip üyelerinin uygulamaya erişirken kullanacağı ortak PIN kodunu belirleyebilirsiniz.
            </div>
            <div class="form-group">
                <label class="form-label" for="setting-team-pin">Ekip PIN Kodu (Boş bırakılırsa şifresiz açılır)</label>
                <input class="form-input" type="text" id="setting-team-pin" placeholder="Örn: 1234" value="${escapeHtml(currentPin)}">
            </div>
            <div class="form-actions">
                <button type="button" class="btn btn-outline" onclick="App.closeModal()">İptal</button>
                <button type="button" class="btn btn-primary" onclick="App.savePinSettings()">✓ Ayarları Kaydet</button>
            </div>
        `;
        openModal('🔑 Bulut & PIN Ayarları', html);
    }

    function savePinSettings() {
        const newPin = document.getElementById('setting-team-pin')?.value.trim() || '';
        if (newPin) {
            localStorage.setItem(PIN_KEY, newPin);
            sessionStorage.setItem('zebra_pin_unlocked', 'true');
            showToast(`Ekip PIN Kodu güncellendi: ${newPin}`, 'success');
        } else {
            localStorage.removeItem(PIN_KEY);
            showToast('PIN Kodu kaldırıldı.', 'info');
        }
        closeModal();
    }

    function saveData() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
            syncDataToCloud();
        } catch (e) {
            console.error('Veri kaydedilirken hata:', e);
            showToast('Veri kaydedilemedi!', 'error');
        }
    }

    function generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
    }

    // ─────────────────────────────────────
    // DATA LAYER — CRUD: Projects
    // ─────────────────────────────────────
    function addProject(name, contractAmount, status, periodCount, completionAmount, periods) {
        const project = {
            id: generateId(),
            name: name.trim(),
            contractAmount: parseFloat(contractAmount) || 0,
            status: status || 'devam-ediyor',
            periodCount: parseInt(periodCount) || 4,
            completionAmount: parseFloat(completionAmount) || 0,
            periods: periods || [],
            createdAt: new Date().toISOString()
        };
        data.projects.push(project);
        saveData();
        return project;
    }

    function updateProject(id, name, contractAmount, status, periodCount, completionAmount, periods) {
        const project = data.projects.find(p => p.id === id);
        if (!project) return null;
        project.name = name.trim();
        project.contractAmount = parseFloat(contractAmount) || 0;
        project.status = status || project.status;
        project.periodCount = parseInt(periodCount) || 4;
        project.completionAmount = parseFloat(completionAmount) || 0;
        project.periods = periods || [];
        saveData();
        return project;
    }

    function removeProject(id) {
        data.projects = data.projects.filter(p => p.id !== id);
        data.transactions = data.transactions.filter(t => t.projectId !== id);
        saveData();
    }

    function getProject(id) {
        return data.projects.find(p => p.id === id) || null;
    }

    // ─────────────────────────────────────
    // DATA LAYER — CRUD: Transactions
    // ─────────────────────────────────────
    function addTransaction(type, projectId, amount, paymentStatus, dueDate, description, estimatedAmount, period) {
        const tx = {
            id: generateId(),
            type,
            projectId,
            amount: parseFloat(amount) || 0,
            paymentStatus: paymentStatus || 'bekliyor',
            dueDate: dueDate || '',  // Boş bırakılabilir (tahmini maliyet için vade zorunlu değil)
            description: (description || '').trim(),
            period: parseInt(period) || 0,
            createdAt: new Date().toISOString()
        };
        // Tahmini maliyet (iş başlangıcı bütçe tahmini) — opsiyonel
        if (estimatedAmount !== undefined && estimatedAmount !== null && estimatedAmount !== '') {
            tx.estimatedAmount = parseFloat(estimatedAmount) || 0;
        }
        data.transactions.push(tx);
        saveData();
        return tx;
    }

    function removeTransaction(id) {
        data.transactions = data.transactions.filter(t => t.id !== id);
        saveData();
    }

    function markTransactionPaid(id) {
        const tx = data.transactions.find(t => t.id === id);
        if (tx) {
            tx.paymentStatus = 'odendi';
            saveData();
        }
    }

    // ─────────────────────────────────────
    // COMPUTED FIELDS (Formulas)
    // ─────────────────────────────────────

    /** Sum of paid hakedis income for a project */
    function getProjectIncome(projectId) {
        return data.transactions
            .filter(t => t.projectId === projectId && t.type === 'hakedis' && t.paymentStatus === 'odendi')
            .reduce((sum, t) => sum + t.amount, 0);
    }

    /** Sum of paid expenses for a project (malzeme + iscilik + ofis-sabit) */
    function getProjectExpense(projectId) {
        const expenseTypes = ['malzeme', 'iscilik', 'ofis-sabit'];
        return data.transactions
            .filter(t => t.projectId === projectId
                      && expenseTypes.includes(t.type)
                      && t.paymentStatus === 'odendi')
            .reduce((sum, t) => sum + t.amount, 0);
    }

    /** Current cash balance for a project */
    function getProjectBalance(projectId) {
        return getProjectIncome(projectId) - getProjectExpense(projectId);
    }

    /**
     * Sum of pending expenses that threaten cash flow for a project.
     * Includes:
     *   - Overdue: vadesi geçmiş (dueDate < bugün) ve hala "bekliyor" olan borçlar
     *   - Upcoming: vadesi önümüzdeki 30 gün içinde olan "bekliyor" borçlar
     */
    function getProjectUpcoming30DayExpenses(projectId) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const limit = new Date(today);
        limit.setDate(limit.getDate() + RISK_DAYS);

        const expenseTypes = ['malzeme', 'iscilik', 'ofis-sabit'];
        return data.transactions
            .filter(t => {
                if (t.projectId !== projectId) return false;
                if (!expenseTypes.includes(t.type)) return false;
                if (t.paymentStatus !== 'bekliyor') return false;
                if (!t.dueDate) return false; // Vadesi belirlenmemiş işlemler risk dışı
                const due = new Date(t.dueDate);
                due.setHours(0, 0, 0, 0);
                return due <= limit;
            })
            .reduce((sum, t) => sum + t.amount, 0);
    }

    /** 30-day risk balance for a project */
    function getProject30DayRisk(projectId) {
        return getProjectBalance(projectId) - getProjectUpcoming30DayExpenses(projectId);
    }

    // ─────────────────────────────────────
    // PROFITABILITY (Kârlılık Analizi)
    // ─────────────────────────────────────

    /**
     * Tahmini toplam maliyet: her gider işlemi için estimatedAmount varsa onu,
     * yoksa amount'ı kullan. (ödendi/bekliyor fark etmez — toplam projeksiyon)
     */
    function getProjectEstimatedCost(projectId) {
        const expenseTypes = ['malzeme', 'iscilik', 'ofis-sabit'];
        return data.transactions
            .filter(t => t.projectId === projectId && expenseTypes.includes(t.type))
            .reduce((sum, t) => sum + (t.estimatedAmount > 0 ? t.estimatedAmount : t.amount), 0);
    }

    /** Güncel toplam maliyet: tüm giderlerin gerçek/anlaşılan tutarları */
    function getProjectCurrentCost(projectId) {
        const expenseTypes = ['malzeme', 'iscilik', 'ofis-sabit'];
        return data.transactions
            .filter(t => t.projectId === projectId && expenseTypes.includes(t.type))
            .reduce((sum, t) => sum + t.amount, 0);
    }

    /** Tahmini kâr = sözleşme − tahmini toplam maliyet */
    function getProjectEstimatedProfit(projectId) {
        const project = getProject(projectId);
        if (!project) return 0;
        return project.contractAmount - getProjectEstimatedCost(projectId);
    }

    /** Güncel beklenen kâr = sözleşme − güncel toplam maliyet */
    function getProjectCurrentProfit(projectId) {
        const project = getProject(projectId);
        if (!project) return 0;
        return project.contractAmount - getProjectCurrentCost(projectId);
    }

    // ─────────────────────────────────────

    /** Totals across all projects */
    function getTotalIncome() {
        return data.transactions
            .filter(t => t.type === 'hakedis' && t.paymentStatus === 'odendi')
            .reduce((sum, t) => sum + t.amount, 0);
    }

    function getTotalExpense() {
        const expenseTypes = ['malzeme', 'iscilik', 'ofis-sabit'];
        return data.transactions
            .filter(t => expenseTypes.includes(t.type) && t.paymentStatus === 'odendi')
            .reduce((sum, t) => sum + t.amount, 0);
    }

    function getTotalBalance() {
        return getTotalIncome() - getTotalExpense();
    }

    function getTotal30DayRisk() {
        return data.projects.reduce((sum, p) => sum + getProject30DayRisk(p.id), 0);
    }

    /**
     * All pending expense payments that affect cash flow, sorted by due date.
     * Vadesi olmayan işlemler bu listeye dahil edilmez.
     */
    function getUpcomingPayments() {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const limit = new Date(today);
        limit.setDate(limit.getDate() + RISK_DAYS);

        const expenseTypes = ['malzeme', 'iscilik', 'ofis-sabit'];
        return data.transactions
            .filter(t => {
                if (!expenseTypes.includes(t.type)) return false;
                if (t.paymentStatus !== 'bekliyor') return false;
                if (!t.dueDate) return false; // Vadesi belirlenmemiş = henüz nakit akış endişesi değil
                const due = new Date(t.dueDate);
                due.setHours(0, 0, 0, 0);
                return due <= limit;
            })
            .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
    }

    // ─────────────────────────────────────
    // UTILITIES
    // ─────────────────────────────────────
    function formatCurrency(amount) {
        const abs = Math.abs(amount);
        const formatted = abs.toLocaleString('tr-TR', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        });
        return (amount < 0 ? '-' : '') + '₺ ' + formatted;
    }

    function formatDate(dateStr) {
        if (!dateStr) return '—';
        try {
            let year, month, day;
            if (typeof dateStr === 'string' && dateStr.includes('-')) {
                const clean = dateStr.split('T')[0];
                const parts = clean.split('-');
                if (parts.length === 3) {
                    year = parseInt(parts[0], 10);
                    month = parseInt(parts[1], 10) - 1;
                    day = parseInt(parts[2], 10);
                }
            }
            const d = (year !== undefined && !isNaN(year)) ? new Date(year, month, day) : new Date(dateStr);
            if (isNaN(d.getTime())) return dateStr;
            return `${d.getDate()} ${MONTHS_FULL_TR[d.getMonth()]} ${d.getFullYear()} ${DAYS_TR[d.getDay()]}`;
        } catch (e) {
            return dateStr;
        }
    }

    function formatDateShort(dateStr) {
        if (!dateStr) return { day: '—', month: '', dayName: '' };
        try {
            let year, month, day;
            if (typeof dateStr === 'string' && dateStr.includes('-')) {
                const clean = dateStr.split('T')[0];
                const parts = clean.split('-');
                if (parts.length === 3) {
                    year = parseInt(parts[0], 10);
                    month = parseInt(parts[1], 10) - 1;
                    day = parseInt(parts[2], 10);
                }
            }
            const d = (year !== undefined && !isNaN(year)) ? new Date(year, month, day) : new Date(dateStr);
            if (isNaN(d.getTime())) return { day: dateStr, month: '', dayName: '' };
            return { day: d.getDate(), month: MONTHS_FULL_TR[d.getMonth()], year: d.getFullYear(), dayName: DAYS_TR[d.getDay()] };
        } catch (e) {
            return { day: dateStr, month: '', dayName: '' };
        }
    }

    function isOverdue(dateStr) {
        if (!dateStr) return false;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return new Date(dateStr) < today;
    }

    function todayStr() {
        return new Date().toISOString().split('T')[0];
    }

    // ─────────────────────────────────────
    // TOASTS
    // ─────────────────────────────────────
    function showToast(message, type = 'success') {
        const container = document.getElementById('toast-container');
        const icons = { success: '✅', error: '❌', warning: '⚠️' };
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `<span class="toast-icon">${icons[type] || '💬'}</span><span>${message}</span>`;
        container.appendChild(toast);
        setTimeout(() => { if (toast.parentNode) toast.remove(); }, 3200);
    }

    // ─────────────────────────────────────
    // CONFIRM DIALOG
    // ─────────────────────────────────────
    function showConfirm(title, message, callback) {
        confirmCallback = callback;
        document.getElementById('confirm-title').textContent = title;
        document.getElementById('confirm-message').textContent = message;
        document.getElementById('confirm-overlay').classList.add('active');
    }

    function executeConfirm() {
        document.getElementById('confirm-overlay').classList.remove('active');
        if (typeof confirmCallback === 'function') {
            confirmCallback();
            confirmCallback = null;
        }
    }

    function cancelConfirm() {
        document.getElementById('confirm-overlay').classList.remove('active');
        confirmCallback = null;
    }

    // ─────────────────────────────────────
    // NAVIGATION / ROUTING
    // ─────────────────────────────────────
    function showView(viewId) {
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        const view = document.getElementById(viewId);
        if (view) view.classList.add('active');
        // Close mobile sidebar
        document.getElementById('sidebar').classList.remove('open');
    }

    function showDashboard() {
        currentProjectId = null;
        showView('view-dashboard');
        renderDashboard();
    }

    function showProject(id) {
        currentProjectId = id;
        showView('view-project-detail');
        renderProjectDetail(id);
    }

    function toggleSidebar() {
        document.getElementById('sidebar').classList.toggle('open');
    }

    // ─────────────────────────────────────
    // UI RENDER — Dashboard
    // ─────────────────────────────────────
    function renderDashboard() {
        // Risk card
        const totalRisk = getTotal30DayRisk();
        const riskCard = document.getElementById('dashboard-risk-card');
        const riskAmount = document.getElementById('dashboard-risk-total');
        riskAmount.textContent = formatCurrency(totalRisk);
        riskCard.className = 'risk-card ' + (totalRisk >= 0 ? 'risk-positive' : 'risk-negative pulse-danger');

        // Stats
        document.getElementById('stat-total-income').textContent = formatCurrency(getTotalIncome());
        document.getElementById('stat-total-expense').textContent = formatCurrency(getTotalExpense());

        const totalBalance = getTotalBalance();
        const balanceEl = document.getElementById('stat-total-balance');
        balanceEl.textContent = formatCurrency(totalBalance);
        balanceEl.className = 'stat-value ' + (totalBalance >= 0 ? 'amount-positive' : 'amount-negative');

        // Projects grid
        renderProjectsGrid();

        // Upcoming payments
        renderUpcomingPayments();
    }

    function renderProjectsGrid() {
        const grid = document.getElementById('projects-grid');

        if (data.projects.length === 0) {
            grid.innerHTML = `
                <div class="empty-state" style="grid-column: 1 / -1;">
                    <div class="empty-state-icon">📂</div>
                    <p class="empty-state-text">Henüz proje eklenmemiş.<br>Yeni bir proje oluşturarak başlayın.</p>
                </div>`;
            return;
        }

        grid.innerHTML = data.projects.map(p => {
            const income = getProjectIncome(p.id);
            const expense = getProjectExpense(p.id);
            const balance = getProjectBalance(p.id);
            const risk = getProject30DayRisk(p.id);
            const isSafe = risk >= 0;

            return `
                <div class="project-card" onclick="App.showProject('${p.id}')">
                    <div class="project-card-header">
                        <div>
                            <div class="project-card-name">${escapeHtml(p.name)}</div>
                            <div class="project-card-contract">Sözleşme: ${formatCurrency(p.contractAmount)}</div>
                        </div>
                        <span class="badge ${p.status === 'tamamlandi' ? 'badge-muted' : 'badge-success'}">
                            ${PROJECT_STATUS[p.status] || p.status}
                        </span>
                    </div>
                    <div class="project-card-stats">
                        <div class="project-card-stat">
                            <span class="project-card-stat-label">Tahsilat</span>
                            <span class="project-card-stat-value amount-positive">${formatCurrency(income)}</span>
                        </div>
                        <div class="project-card-stat">
                            <span class="project-card-stat-label">Gider</span>
                            <span class="project-card-stat-value amount-negative">${formatCurrency(expense)}</span>
                        </div>
                        <div class="project-card-stat">
                            <span class="project-card-stat-label">Kasa</span>
                            <span class="project-card-stat-value ${balance >= 0 ? 'amount-positive' : 'amount-negative'}">${formatCurrency(balance)}</span>
                        </div>
                        <div class="project-card-stat">
                            <span class="project-card-stat-label">30G Risk</span>
                            <span class="project-card-stat-value ${isSafe ? 'amount-positive' : 'amount-negative'}">${formatCurrency(risk)}</span>
                        </div>
                    </div>
                    <div class="project-card-footer">
                        <span class="project-card-risk">
                            <span class="dot ${isSafe ? 'safe' : 'danger'}"></span>
                            ${isSafe ? 'Güvende' : 'Darboğaz Riski'}
                        </span>
                        <span class="project-card-arrow">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
                        </span>
                    </div>
                </div>`;
        }).join('');
    }

    function renderUpcomingPayments() {
        const container = document.getElementById('upcoming-payments');
        const payments = getUpcomingPayments();

        if (payments.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">🎉</div>
                    <p class="empty-state-text">Önümüzdeki 30 gün içinde bekleyen ödeme yok.</p>
                </div>`;
            return;
        }

        container.innerHTML = payments.map(tx => {
            const project = getProject(tx.projectId);
            const ds = formatDateShort(tx.dueDate);
            const overdue = isOverdue(tx.dueDate);
            const typeInfo = TX_TYPES[tx.type] || {};

            return `
                <div class="payment-item ${overdue ? 'overdue' : ''}">
                    <div class="payment-date">
                        <div class="payment-date-day">${ds.day}</div>
                        <div class="payment-date-month">${ds.month}</div>
                        <div style="font-size:0.65rem; color:var(--text-muted); font-weight:600; text-transform:uppercase; margin-top:2px;">${ds.dayName || ''}</div>
                    </div>
                    <div class="payment-info">
                        <div class="payment-desc">${escapeHtml(tx.description || typeInfo.label)}</div>
                        <div class="payment-project">${project ? escapeHtml(project.name) : '—'} · <span style="color:var(--text-secondary); font-size:0.75rem;">${formatDate(tx.dueDate)}</span></div>
                    </div>
                    <span class="payment-type-badge">${typeInfo.label || tx.type}</span>
                    ${overdue ? '<span class="payment-overdue-badge">Gecikmiş</span>' : ''}
                    <span class="payment-amount">-${formatCurrency(tx.amount)}</span>
                </div>`;
        }).join('');
    }
    function renderProjectDetail(projectId) {
        const project = getProject(projectId);
        if (!project) {
            showDashboard();
            return;
        }

        // Header info
        document.getElementById('detail-project-name').textContent = project.name;
        document.getElementById('detail-contract-amount').textContent = formatCurrency(project.contractAmount);

        const statusBadge = document.getElementById('detail-status-badge');
        if (statusBadge) {
            statusBadge.textContent = PROJECT_STATUS[project.status] || project.status;
            statusBadge.className = 'badge ' + (project.status === 'tamamlandi' ? 'badge-muted' : 'badge-success');
        }

        // Stats
        const income = getProjectIncome(projectId);
        const expense = getProjectExpense(projectId);
        const balance = getProjectBalance(projectId);
        const risk = getProject30DayRisk(projectId);

        document.getElementById('detail-income').textContent = formatCurrency(income);
        document.getElementById('detail-expense').textContent = formatCurrency(expense);

        const balanceEl = document.getElementById('detail-balance');
        balanceEl.textContent = formatCurrency(balance);
        balanceEl.className = 'stat-value ' + (balance >= 0 ? 'amount-positive' : 'amount-negative');

        // Risk card
        const riskCard = document.getElementById('detail-risk-card');
        const riskAmount = document.getElementById('detail-risk');
        riskAmount.textContent = formatCurrency(risk);
        riskCard.className = 'risk-card compact ' + (risk >= 0 ? 'risk-positive' : 'risk-negative pulse-danger');

        // Profitability & Remaining Agreed Balance analysis
        renderProfitability(projectId);

        // Period cash flow table
        renderPeriodFlow(projectId);

        // Transactions list
        renderProjectTransactions(projectId);
    }

    function renderProfitability(projectId) {
        const container = document.getElementById('detail-profitability');
        const project = getProject(projectId);
        if (!project) { container.innerHTML = ''; return; }

        const contract = project.contractAmount;
        const estCost = getProjectEstimatedCost(projectId);
        const curCost = getProjectCurrentCost(projectId);
        const estProfit = getProjectEstimatedProfit(projectId);
        const curProfit = getProjectCurrentProfit(projectId);
        const deviation = curProfit - estProfit;

        // Yüzde hesaplamaları
        const estProfitPct = contract > 0 ? ((estProfit / contract) * 100).toFixed(1) : '0';
        const curProfitPct = contract > 0 ? ((curProfit / contract) * 100).toFixed(1) : '0';

        // Sapma sınıfı
        const devClass = deviation > 0 ? 'better' : (deviation < 0 ? 'worse' : 'neutral');
        const devIcon = deviation > 0 ? '↑' : (deviation < 0 ? '↓' : '→');
        const devLabel = deviation > 0 ? 'Kâr beklentisi arttı' : (deviation < 0 ? 'Kâr beklentisi düştü' : 'Değişiklik yok');

        // Kalan Anlaşılan Bakiyeler
        const income = getProjectIncome(projectId);
        const contractRemaining = Math.max(0, contract - income);

        const txs = data.transactions.filter(t => t.projectId === projectId);
        const expenseTypes = ['malzeme', 'iscilik', 'ofis-sabit'];
        const expenseTxs = txs.filter(t => expenseTypes.includes(t.type));

        const agreedExpenseTotal = expenseTxs.reduce((sum, t) => sum + t.amount, 0);
        const paidExpenseTotal = expenseTxs.filter(t => t.paymentStatus === 'odendi').reduce((sum, t) => sum + t.amount, 0);
        const agreedExpenseRemaining = Math.max(0, agreedExpenseTotal - paidExpenseTotal);

        container.innerHTML = `
            <div class="profit-card">
                <div class="profit-card-title">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                    Kârlılık ve Kalan Anlaşılan Bakiye Analizi
                </div>
                <div class="profit-grid">
                    <div class="profit-col">
                        <div class="profit-col-header">İş Başlangıcı Tahmini</div>
                        <div class="profit-row">
                            <span class="profit-row-label">Sözleşme Bedeli</span>
                            <span class="profit-row-value">${formatCurrency(contract)}</span>
                        </div>
                        <div class="profit-row">
                            <span class="profit-row-label">Tahmini Maliyet</span>
                            <span class="profit-row-value">${formatCurrency(estCost)}</span>
                        </div>
                        <div class="profit-highlight ${estProfit >= 0 ? 'positive' : 'negative'}">
                            <span class="profit-highlight-label">Tahmini Kâr</span>
                            <span class="profit-highlight-value">${formatCurrency(estProfit)} <span class="profit-pct">${estProfitPct}%</span></span>
                        </div>
                    </div>
                    <div class="profit-col">
                        <div class="profit-col-header">Güncel Durum</div>
                        <div class="profit-row">
                            <span class="profit-row-label">Sözleşme Bedeli</span>
                            <span class="profit-row-value">${formatCurrency(contract)}</span>
                        </div>
                        <div class="profit-row">
                            <span class="profit-row-label">Anlaşılan Maliyet</span>
                            <span class="profit-row-value">${formatCurrency(curCost)}</span>
                        </div>
                        <div class="profit-highlight ${curProfit >= 0 ? 'positive' : 'negative'}">
                            <span class="profit-highlight-label">Beklenen Kâr</span>
                            <span class="profit-highlight-value">${formatCurrency(curProfit)} <span class="profit-pct">${curProfitPct}%</span></span>
                        </div>
                    </div>
                    <div class="profit-divider"></div>
                    <div class="profit-deviation ${devClass}">
                        <span>${devIcon} ${devLabel}</span>
                        <span>${formatCurrency(deviation)}</span>
                    </div>
                </div>

                <div style="margin-top: 14px; padding-top: 14px; border-top: 1px dashed var(--glass-border); display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px;">
                    <div style="background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.25); padding: 10px 14px; border-radius: var(--radius-sm);">
                        <div style="font-size: 0.72rem; text-transform: uppercase; color: var(--success); font-weight: 700;">🤝 Kalan Anlaşılan Tahsilat Bakiyesi</div>
                        <div style="font-size: 1.15rem; font-weight: 800; color: var(--success); margin-top: 2px;">${formatCurrency(contractRemaining)}</div>
                        <div style="font-size: 0.7rem; color: var(--text-muted);">Sözleşme: ${formatCurrency(contract)} · Tahsil Edilen: ${formatCurrency(income)}</div>
                    </div>
                    <div style="background: rgba(245, 158, 11, 0.08); border: 1px solid rgba(245, 158, 11, 0.25); padding: 10px 14px; border-radius: var(--radius-sm);">
                        <div style="font-size: 0.72rem; text-transform: uppercase; color: var(--warning); font-weight: 700;">📋 Kalan Anlaşılan Borç Bakiyesi</div>
                        <div style="font-size: 1.15rem; font-weight: 800; color: var(--warning); margin-top: 2px;">${formatCurrency(agreedExpenseRemaining)}</div>
                </div>
            </div>`;
    }

    function renderPeriodFlow(projectId) {
        const container = document.getElementById('detail-period-flow');
        const project = getProject(projectId);
        if (!project) { container.innerHTML = ''; return; }

        // Auto-initialize project.periods if it's empty so it always works
        if (!project.periods || project.periods.length === 0) {
            project.periodCount = project.periodCount || 4;
            project.completionAmount = project.completionAmount || 0;
            project.periods = [];
            const remaining = Math.max(0, project.contractAmount - project.completionAmount);
            const autoAmt = Math.round(remaining / project.periodCount);
            for (let i = 0; i < project.periodCount; i++) {
                project.periods.push({
                    number: i + 1,
                    label: `${i + 1}. Hakediş`,
                    amount: autoAmt,
                    date: ''
                });
            }
            project.periods.push({
                number: project.periodCount + 1,
                label: 'İş Bitimi',
                amount: project.completionAmount,
                date: '',
                isCompletion: true
            });
            saveData();
        }

        const txs = data.transactions.filter(t => t.projectId === projectId);
        const expenseTypes = ['malzeme', 'iscilik', 'ofis-sabit'];

        // Build period list cash flow
        let cumulative = 0;
        let bottleneckPeriod = null;

        let rowsHtml = project.periods.map(p => {
            const scheduledIncome = p.amount;
            const periodTxs = txs.filter(t => t.period === p.number && expenseTypes.includes(t.type));

            const estGider = periodTxs.reduce((sum, t) => sum + (t.estimatedAmount > 0 ? t.estimatedAmount : t.amount), 0);
            const anlGider = periodTxs.reduce((sum, t) => sum + t.amount, 0);

            // Active cost in the period: agreed cost if agreed (amount > 0), else estimated cost (estimatedAmount)
            const activeGider = periodTxs.reduce((sum, t) => {
                return sum + (t.amount > 0 ? t.amount : (t.estimatedAmount || 0));
            }, 0);

            const net = scheduledIncome - activeGider;
            cumulative += net;

            const isBottleneck = cumulative < 0;
            if (isBottleneck && !bottleneckPeriod) {
                bottleneckPeriod = p.label;
            }

            const rowClass = isBottleneck ? 'bottleneck-row' : '';
            const netClass = net >= 0 ? 'col-positive' : 'col-negative';
            const netSign = net >= 0 ? '+' : '';
            const cumClass = cumulative >= 0 ? 'col-positive' : 'col-negative';

            const dateLabel = p.date ? formatDate(p.date) : '—';

            return `
                <tr class="${rowClass}">
                    <td>
                        <strong>${escapeHtml(p.label)}</strong>
                        <div style="font-size:0.7rem; color:var(--text-muted); margin-top:2px;">Planlanan Vade: ${dateLabel}</div>
                    </td>
                    <td>${formatCurrency(scheduledIncome)}</td>
                    <td class="col-muted">${formatCurrency(estGider)}</td>
                    <td>${formatCurrency(anlGider)}</td>
                    <td class="${netClass}">${netSign}${formatCurrency(net)}</td>
                    <td class="${cumClass}">${formatCurrency(cumulative)}</td>
                </tr>
            `;
        }).join('');

        // Unassigned transactions (period === 0 or legacy)
        const unassignedTxs = txs.filter(t => (t.period === 0 || !t.period) && expenseTypes.includes(t.type));
        if (unassignedTxs.length > 0) {
            const estGider = unassignedTxs.reduce((sum, t) => sum + (t.estimatedAmount > 0 ? t.estimatedAmount : t.amount), 0);
            const anlGider = unassignedTxs.reduce((sum, t) => sum + t.amount, 0);
            const activeGider = unassignedTxs.reduce((sum, t) => sum + (t.amount > 0 ? t.amount : (t.estimatedAmount || 0)), 0);

            cumulative -= activeGider;
            if (cumulative < 0 && !bottleneckPeriod) {
                bottleneckPeriod = 'Dönem Atanmamış Giderler';
            }

            rowsHtml += `
                <tr class="bottleneck-row" style="border-top: 1px dashed var(--glass-border);">
                    <td>
                        <strong style="color: var(--warning);">⚠ Dönem Atanmamış Giderler</strong>
                        <div style="font-size:0.7rem; color:var(--text-muted); margin-top:2px;">Ödeme dönemi seçilmemiş kalemler</div>
                    </td>
                    <td>${formatCurrency(0)}</td>
                    <td class="col-muted">${formatCurrency(estGider)}</td>
                    <td>${formatCurrency(anlGider)}</td>
                    <td class="col-negative">-${formatCurrency(activeGider)}</td>
                    <td class="${cumulative >= 0 ? 'col-positive' : 'col-negative'}">${formatCurrency(cumulative)}</td>
                </tr>
            `;
        }

        // Sums
        const totalIncome = project.periods.reduce((sum, p) => sum + p.amount, 0);
        const allPeriodTxs = txs.filter(t => expenseTypes.includes(t.type));
        const totalEstGider = allPeriodTxs.reduce((sum, t) => sum + (t.estimatedAmount > 0 ? t.estimatedAmount : t.amount), 0);
        const totalAnlGider = allPeriodTxs.reduce((sum, t) => sum + t.amount, 0);
        const totalActiveGider = allPeriodTxs.reduce((sum, t) => sum + (t.amount > 0 ? t.amount : (t.estimatedAmount || 0)), 0);
        const totalNet = totalIncome - totalActiveGider;

        let alertHtml = '';
        if (bottleneckPeriod) {
            alertHtml = `
                <div class="period-alert">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                    <div><strong>Nakit Darboğazı Riski!</strong> ${escapeHtml(bottleneckPeriod)} itibarıyla kümülatif bakiye negatife düşüyor. İş bitmeden paranın bitmesini engellemek için planlama yapın.</div>
                </div>
            `;
        } else {
            alertHtml = `
                <div class="period-alert" style="background: rgba(16, 185, 129, 0.08); border-color: rgba(16, 185, 129, 0.2); color: var(--success);">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                    <div><strong>Nakit Akışı Güvenli:</strong> Proje dönemsel olarak nakit darboğazı riski taşımıyor.</div>
                </div>
            `;
        }

        container.innerHTML = `
            <div class="period-flow-card">
                <div class="period-flow-title">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                    Dönemsel Nakit Akışı ve Darboğaz Takibi
                </div>
                <div class="period-table-wrap">
                    <table class="period-table">
                        <thead>
                            <tr>
                                <th>Ödeme Dönemi</th>
                                <th>Hakediş (Gelir)</th>
                                <th>Tahmini Gider</th>
                                <th>Anlaşılan Gider</th>
                                <th>Net Akış</th>
                                <th>Kümülatif Bakiye</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rowsHtml}
                        </tbody>
                        <tfoot>
                            <tr>
                                <td>TOPLAM</td>
                                <td>${formatCurrency(totalIncome)}</td>
                                <td class="col-muted">${formatCurrency(totalEstGider)}</td>
                                <td>${formatCurrency(totalAnlGider)}</td>
                                <td class="${totalNet >= 0 ? 'col-positive' : 'col-negative'}">${totalNet >= 0 ? '+' : ''}${formatCurrency(totalNet)}</td>
                                <td class="${cumulative >= 0 ? 'col-positive' : 'col-negative'}">${formatCurrency(cumulative)}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
                ${alertHtml}
            </div>
        `;
    }

    function renderProjectTransactions(projectId) {
        const container = document.getElementById('detail-transactions');
        const txs = data.transactions
            .filter(t => t.projectId === projectId)
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        if (txs.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📋</div>
                    <p class="empty-state-text">Bu projede henüz işlem kaydı yok.<br>Hızlı işlem butonlarını kullanarak başlayın.</p>
                </div>`;
            return;
        }

        container.innerHTML = txs.map(tx => {
            const project = getProject(tx.projectId);
            const typeInfo = TX_TYPES[tx.type] || {};
            const isIncome = tx.type === 'hakedis';
            const amountClass = isIncome ? 'positive' : 'negative';
            const amountSign = isIncome ? '+' : '-';
            const statusBadge = tx.paymentStatus === 'odendi'
                ? '<span class="badge badge-success">Ödendi</span>'
                : '<span class="badge badge-warning">Bekliyor</span>';

            // Tahmini vs Anlaşılan karşılaştırma satırı
            let estimateLine = '';
            if (tx.estimatedAmount && tx.estimatedAmount > 0) {
                const diff = tx.amount - tx.estimatedAmount;
                const diffPct = tx.estimatedAmount > 0 ? ((diff / tx.estimatedAmount) * 100).toFixed(0) : '0';
                const diffClass = diff > 0 ? 'tx-estimate-over' : (diff < 0 ? 'tx-estimate-under' : 'tx-estimate-match');
                const diffLabel = diff > 0 ? `+${diffPct}% fazla` : (diff < 0 ? `${diffPct}% düşük` : 'eşit');
                estimateLine = `<div class="tx-estimate"><span class="tx-estimate-label">Tahmini: ${formatCurrency(tx.estimatedAmount)}</span> <span class="${diffClass}">${diffLabel}</span></div>`;
            }

            let periodBadge = '';
            if (tx.period && tx.period > 0 && project && project.periods) {
                const pObj = project.periods.find(p => p.number === tx.period);
                if (pObj) {
                    periodBadge = `<span class="period-badge">${escapeHtml(pObj.label)}</span>`;
                }
            }

            const dateLabelText = tx.dueDate ? `Vade: ${formatDate(tx.dueDate)}` : 'Vade: Belirlenmemiş';
            const periodLabelText = periodBadge ? ` · ${periodBadge}` : '';

            return `
                <div class="transaction-item">
                    <div class="tx-icon ${typeInfo.cssClass || ''}">${typeInfo.icon || '📄'}</div>
                    <div class="tx-info">
                        <div class="tx-desc">${escapeHtml(tx.description || typeInfo.label)}</div>
                        <div class="tx-date">${dateLabelText} · ${typeInfo.label}${periodLabelText}</div>
                        ${estimateLine}
                    </div>
                    <span class="tx-amount ${amountClass}">${amountSign}${formatCurrency(tx.amount)}</span>
                    <span class="tx-status">${statusBadge}</span>
                    <div class="tx-actions">
                        ${tx.paymentStatus === 'bekliyor' ? `
                            <button class="btn btn-xs btn-success" onclick="event.stopPropagation(); App.markAsPaid('${tx.id}')" title="Ödendi olarak işaretle">
                                ✓ Öde
                            </button>
                        ` : ''}
                        <button class="btn btn-xs btn-outline" onclick="event.stopPropagation(); App.openEditTransaction('${tx.id}')" title="Düzenle">
                            ✎
                        </button>
                        <button class="btn btn-xs btn-danger-outline" onclick="event.stopPropagation(); App.deleteTransaction('${tx.id}')" title="İşlemi sil">
                            ✕
                        </button>
                    </div>
                </div>`;
        }).join('');
    }

    // ─────────────────────────────────────
    // ─────────────────────────────────────
    // MODALS — Project (Draft Preserved & Live Thousands Separator)
    // ─────────────────────────────────────
    let projectDraft = null;

    function saveProjectDraft() {
        const nameInput = document.getElementById('input-project-name');
        if (!nameInput) return;
        const form = nameInput.closest('form');
        if (!form || form.dataset.editId) return; // Only draft for new project creation

        const name = nameInput.value;
        const contractAmount = document.getElementById('input-contract-amount')?.value || '';
        const status = document.getElementById('input-project-status')?.value || 'devam-ediyor';
        const periodCount = document.getElementById('input-period-count')?.value || '4';
        const completionAmount = document.getElementById('input-completion-amount')?.value || '';

        const periodAmts = Array.from(document.querySelectorAll('.input-period-amount')).map(i => i.value);
        const periodDates = Array.from(document.querySelectorAll('.input-period-date')).map(i => i.value);
        const compDate = document.getElementById('input-completion-date')?.value || '';

        if (name.trim() || contractAmount || completionAmount) {
            projectDraft = {
                name,
                contractAmount,
                status,
                periodCount,
                completionAmount,
                periodAmts,
                periodDates,
                compDate
            };
        }
    }

    function cancelProjectForm() {
        projectDraft = null;
        closeModal();
        showToast('Yeni proje girişi temizlendi ve kapatıldı.', 'info');
    }

    function openNewProject() {
        openModal('Yeni Proje Oluştur', getProjectFormHtml());
        setTimeout(() => {
            if (projectDraft) {
                if (document.getElementById('input-project-name')) document.getElementById('input-project-name').value = projectDraft.name || '';
                if (document.getElementById('input-contract-amount')) document.getElementById('input-contract-amount').value = projectDraft.contractAmount || '';
                if (document.getElementById('input-project-status')) document.getElementById('input-project-status').value = projectDraft.status || 'devam-ediyor';
                if (document.getElementById('input-period-count')) document.getElementById('input-period-count').value = projectDraft.periodCount || '4';
                if (document.getElementById('input-completion-amount')) document.getElementById('input-completion-amount').value = projectDraft.completionAmount || '';

                generatePeriodFields();

                if (projectDraft.periodAmts) {
                    const amtInputs = document.querySelectorAll('.input-period-amount');
                    amtInputs.forEach((inp, idx) => {
                        if (projectDraft.periodAmts[idx] !== undefined) inp.value = projectDraft.periodAmts[idx];
                    });
                }
                if (projectDraft.periodDates) {
                    const dateInputs = document.querySelectorAll('.input-period-date');
                    dateInputs.forEach((inp, idx) => {
                        if (projectDraft.periodDates[idx] !== undefined) inp.value = projectDraft.periodDates[idx];
                    });
                }
                if (projectDraft.compDate && document.getElementById('input-completion-date')) {
                    document.getElementById('input-completion-date').value = projectDraft.compDate;
                }

                validatePeriodSum();
                showToast('Daha önceden girilen taslak verileriniz geri yüklendi.', 'info');
            } else {
                generatePeriodFields();
            }
        }, 50);
    }

    function openEditProject() {
        if (!currentProjectId) return;
        const project = getProject(currentProjectId);
        if (!project) return;
        openModal('Projeyi Düzenle', getProjectFormHtml(project));
        setTimeout(() => generatePeriodFields(project.periods), 50);
    }

    function getProjectFormHtml(project = null) {
        const name = project ? escapeHtml(project.name) : '';
        const amount = project ? (project.contractAmount ? project.contractAmount.toLocaleString('tr-TR') : '') : '';
        const statusDevam = (!project || project.status === 'devam-ediyor') ? 'selected' : '';
        const statusTamam = (project && project.status === 'tamamlandi') ? 'selected' : '';
        const periodCount = project ? (project.periodCount !== undefined ? project.periodCount : 4) : 4;
        const completionAmount = project ? (project.completionAmount ? project.completionAmount.toLocaleString('tr-TR') : '') : '';
        const editId = project ? project.id : '';

        return `
            <form onsubmit="App.saveProject(event)" data-edit-id="${editId}">
                <div class="form-group">
                    <label class="form-label" for="input-project-name">Proje Adı</label>
                    <input class="form-input" type="text" id="input-project-name" value="${name}" placeholder="Örn: Kemalpaşa Villaları" required oninput="App.saveProjectDraft()">
                </div>
                <div class="form-group">
                    <label class="form-label" for="input-contract-amount">Toplam Sözleşme Bedeli (₺)</label>
                    <input class="form-input" type="text" inputmode="numeric" id="input-contract-amount" value="${amount}" placeholder="0" required oninput="App.onContractAmountInput(this)" onkeydown="App.onAmountKeyDown(event)">
                </div>
                <div class="form-group">
                    <label class="form-label" for="input-project-status" onchange="App.saveProjectDraft()">Durumu</label>
                    <select class="form-select" id="input-project-status">
                        <option value="devam-ediyor" ${statusDevam}>Devam Ediyor</option>
                        <option value="tamamlandi" ${statusTamam}>Tamamlandı</option>
                    </select>
                </div>

                <div class="form-group" style="border-top: 1px solid var(--glass-border); padding-top: 15px; margin-top: 15px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                        <h4 style="font-size: 0.85rem; text-transform: uppercase; color: var(--text-secondary); margin:0;">Dönemsel Ödeme Planı</h4>
                    </div>
                    <div style="display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 12px;">
                        <button type="button" class="btn btn-xs btn-outline" onclick="App.setPaymentPreset('upfront')" title="%100 Tutar işe başlarken Peşinat olarak tahsil edilir">⚡ %100 Peşin (İşe Başlarken)</button>
                        <button type="button" class="btn btn-xs btn-outline" onclick="App.setPaymentPreset('completion')" title="%100 Tutar iş tesliminde/bitiminde tahsil edilir">🏁 %100 Teslimde (İş Bitiminde)</button>
                        <button type="button" class="btn btn-xs btn-outline" onclick="App.setPaymentPreset('standard')" title="Tutar 4 eşit döneme bölünür">📊 4 Eşit Hakediş</button>
                    </div>
                </div>

                <div class="form-group-row" style="display: flex; gap: 12px; margin-bottom: 15px;">
                    <div style="flex: 1;">
                        <label class="form-label" for="input-period-count">Hakediş Ödeme Sayısı <span style="font-weight:400; color:var(--text-muted); text-transform:none;">(0 = Tek Ödeme)</span></label>
                        <input class="form-input" type="number" id="input-period-count" value="${periodCount}" min="0" max="24" required oninput="App.onPeriodCountInput()">
                    </div>
                    <div style="flex: 1;">
                        <label class="form-label" for="input-completion-amount">İş Bitimi Ödemesi (₺)</label>
                        <input class="form-input" type="text" inputmode="numeric" id="input-completion-amount" value="${completionAmount}" placeholder="0" required oninput="App.onCompletionAmountInput(this)" onkeydown="App.onAmountKeyDown(event)">
                    </div>
                </div>

                <div class="form-group">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                        <label class="form-label" style="margin-bottom:0;">Dönem Detayları</label>
                        <button type="button" class="btn btn-xs btn-outline" onclick="App.distributePeriodsEvenly()">Eşit Dağıt</button>
                    </div>
                    <div id="project-periods-list" style="max-height: 250px; overflow-y: auto; padding-right: 4px; border: 1px solid var(--glass-border); padding: 10px; border-radius: var(--radius-sm); background: rgba(255,255,255,0.01);">
                        <!-- generatePeriodFields tarafından doldurulur -->
                    </div>
                    <div id="period-sum-validation" style="margin-top: 6px; text-align: right;"></div>
                </div>

                <div class="form-actions">
                    <button type="button" class="btn btn-outline" onclick="App.cancelProjectForm()">İptal (Formu Temizle)</button>
                    <button type="submit" class="btn btn-primary">${project ? 'Güncelle' : 'Oluştur'}</button>
                </div>
            </form>`;
    }

    function setPaymentPreset(presetType) {
        const contractAmt = parseAmountInput(document.getElementById('input-contract-amount'));
        const periodCountInput = document.getElementById('input-period-count');
        const completionInput = document.getElementById('input-completion-amount');
        if (!periodCountInput || !completionInput) return;

        if (presetType === 'upfront') {
            periodCountInput.value = 1;
            completionInput.value = '0';
            generatePeriodFields();

            const amtInputs = document.querySelectorAll('.input-period-amount');
            if (amtInputs.length > 0) {
                amtInputs[0].value = contractAmt ? contractAmt.toLocaleString('tr-TR') : '0';
            }
            validatePeriodSum();
            showToast('Ödeme planı %100 Peşin (İşe Başlarken) olarak ayarlandı.', 'info');
        } else if (presetType === 'completion') {
            periodCountInput.value = 0;
            completionInput.value = contractAmt ? contractAmt.toLocaleString('tr-TR') : '0';
            generatePeriodFields();
            showToast('Ödeme planı %100 Teslimde (İş Bitiminde) olarak ayarlandı.', 'info');
        } else if (presetType === 'standard') {
            periodCountInput.value = 4;
            completionInput.value = '0';
            generatePeriodFields();
            distributePeriodsEvenly();
            showToast('Ödeme planı 4 Eşit Hakediş olarak ayarlandı.', 'info');
        }

        saveProjectDraft();
    }

    function onContractAmountInput(el) {
        formatAmountInput(el);
        const count = parseInt(document.getElementById('input-period-count')?.value, 10);
        const completionInput = document.getElementById('input-completion-amount');
        if (count === 0 && completionInput) {
            completionInput.value = el.value;
        }
        generatePeriodFields();
        saveProjectDraft();
    }

    function onCompletionAmountInput(el) {
        formatAmountInput(el);
        generatePeriodFields();
        saveProjectDraft();
    }

    function onPeriodCountInput() {
        const periodCountInput = document.getElementById('input-period-count');
        const count = parseInt(periodCountInput?.value, 10);
        const contractAmt = parseAmountInput(document.getElementById('input-contract-amount'));
        const completionInput = document.getElementById('input-completion-amount');

        if (count === 0 && contractAmt > 0 && completionInput) {
            completionInput.value = contractAmt.toLocaleString('tr-TR');
        }

        generatePeriodFields();
        saveProjectDraft();
    }

    function onPeriodAmountInput(el) {
        formatAmountInput(el);
        validatePeriodSum();
        saveProjectDraft();
    }

    function generatePeriodFields(existingPeriods = null) {
        const container = document.getElementById('project-periods-list');
        if (!container) return;

        const contractAmt = parseAmountInput(document.getElementById('input-contract-amount'));
        const periodCountVal = document.getElementById('input-period-count')?.value;
        const periodCount = periodCountVal !== undefined && periodCountVal !== '' ? (parseInt(periodCountVal, 10) || 0) : 0;
        let completionAmt = parseAmountInput(document.getElementById('input-completion-amount'));

        // If 0 hakediş is selected and completion amount is 0, auto fill 100% contract amount
        if (periodCount === 0 && completionAmt === 0 && contractAmt > 0) {
            completionAmt = contractAmt;
            const compInput = document.getElementById('input-completion-amount');
            if (compInput) compInput.value = contractAmt.toLocaleString('tr-TR');
        }

        const displayComp = document.getElementById('input-completion-display-amount');
        if (displayComp) displayComp.value = completionAmt ? completionAmt.toLocaleString('tr-TR') : '0';

        const remaining = Math.max(0, contractAmt - completionAmt);
        const autoAmt = periodCount > 0 ? Math.round(remaining / periodCount) : 0;

        let html = '';
        if (periodCount === 0) {
            html += `
                <div style="font-size:0.75rem; color:var(--text-muted); margin-bottom:8px; padding:8px 10px; background:rgba(255,255,255,0.03); border-radius:var(--radius-sm); border: 1px dashed var(--glass-border);">
                    💡 <strong>0 Hakediş Seçildi:</strong> Ara hakediş ödemesi yapılmayacaktır. Tüm sözleşme bedeli (100%) iş bitiminde tek ödeme olarak tahsil edilir.
                </div>
            `;
        }

        for (let i = 0; i < periodCount; i++) {
            const num = i + 1;
            let val = autoAmt;
            let date = '';

            if (existingPeriods && existingPeriods[i]) {
                val = existingPeriods[i].amount;
                date = existingPeriods[i].date || '';
            }

            const valFormatted = val ? val.toLocaleString('tr-TR') : '';

            html += `
                <div class="form-group-row" style="display: flex; gap: 10px; margin-bottom: 8px; align-items: center;">
                    <div style="flex: 1; font-size: 0.8rem; font-weight: 600; color: var(--text-secondary);">${num}. Hakediş</div>
                    <input type="text" inputmode="numeric" class="form-input input-period-amount" data-index="${i}" value="${valFormatted}" placeholder="Tutar" style="flex: 2; margin-bottom:0;" oninput="App.onPeriodAmountInput(this)">
                    <input type="date" class="form-input input-period-date" data-index="${i}" value="${date}" style="flex: 2; margin-bottom:0;" onchange="App.saveProjectDraft()">
                </div>
            `;
        }

        // Add final completion period info
        const compDateIdx = periodCount > 0 ? periodCount : 0;
        const compDate = existingPeriods && existingPeriods[compDateIdx] ? existingPeriods[compDateIdx].date || '' : '';
        html += `
            <div class="form-group-row" style="display: flex; gap: 10px; margin-bottom: 8px; align-items: center; border-top: 1px dashed var(--glass-border); padding-top: 8px; margin-top: 8px;">
                <div style="flex: 1; font-size: 0.8rem; font-weight: 600; color: var(--text-secondary);">${periodCount === 0 ? 'İş Bitimi (Tek Ödeme)' : 'İş Bitimi'}</div>
                <input type="text" class="form-input" id="input-completion-display-amount" value="${completionAmt ? completionAmt.toLocaleString('tr-TR') : '0'}" disabled style="flex: 2; margin-bottom:0;">
                <input type="date" class="form-input" id="input-completion-date" value="${compDate}" style="flex: 2; margin-bottom:0;" onchange="App.saveProjectDraft()">
            </div>
        `;

        container.innerHTML = html;
        validatePeriodSum();
    }

    function validatePeriodSum() {
        const label = document.getElementById('period-sum-validation');
        if (!label) return;

        const contractAmt = parseAmountInput(document.getElementById('input-contract-amount'));
        const completionAmt = parseAmountInput(document.getElementById('input-completion-amount'));

        let sum = completionAmt;
        const amtInputs = document.querySelectorAll('.input-period-amount');
        amtInputs.forEach(input => {
            sum += parseAmountInput(input);
        });

        const diff = contractAmt - sum;
        if (Math.abs(diff) < 1) {
            label.innerHTML = '<span style="color: var(--success); font-size: 0.75rem;">✓ Toplam tutarlar sözleşme bedeli ile eşleşiyor.</span>';
        } else if (diff > 0) {
            label.innerHTML = `<span style="color: var(--warning); font-size: 0.75rem;">⚠ Dağıtılmamış bakiye: ${formatCurrency(diff)}</span>`;
        } else {
            label.innerHTML = `<span style="color: var(--danger); font-size: 0.75rem;">⚠ Dağıtılan tutar sözleşme bedelini ${formatCurrency(Math.abs(diff))} aşıyor.</span>`;
        }
    }

    function distributePeriodsEvenly() {
        const contractAmt = parseAmountInput(document.getElementById('input-contract-amount'));
        const periodCountVal = document.getElementById('input-period-count')?.value;
        const periodCount = periodCountVal !== undefined && periodCountVal !== '' ? (parseInt(periodCountVal, 10) || 0) : 0;
        const completionAmt = parseAmountInput(document.getElementById('input-completion-amount'));

        const remaining = Math.max(0, contractAmt - completionAmt);
        const autoAmt = periodCount > 0 ? Math.round(remaining / periodCount) : 0;

        const amtInputs = document.querySelectorAll('.input-period-amount');
        amtInputs.forEach((input, index) => {
            if (index === amtInputs.length - 1) {
                let sumOther = 0;
                for (let j = 0; j < index; j++) {
                    sumOther += parseAmountInput(amtInputs[j]);
                }
                const remainder = remaining - sumOther;
                input.value = remainder > 0 ? remainder.toLocaleString('tr-TR') : '0';
            } else {
                input.value = autoAmt ? autoAmt.toLocaleString('tr-TR') : '0';
            }
        });
        validatePeriodSum();
        saveProjectDraft();
    }

    function saveProject(e) {
        e.preventDefault();
        const form = e.target;
        const editId = form.dataset.editId;
        const name = document.getElementById('input-project-name').value;
        const contractAmount = parseAmountInput(document.getElementById('input-contract-amount'));
        const status = document.getElementById('input-project-status').value;
        const periodCountVal = document.getElementById('input-period-count').value;
        const periodCount = periodCountVal !== '' ? (parseInt(periodCountVal, 10) || 0) : 0;
        const completionAmount = parseAmountInput(document.getElementById('input-completion-amount'));

        if (!name.trim()) {
            showToast('Proje adı boş olamaz.', 'error');
            return;
        }

        // Gather periods data
        const periods = [];
        const amtInputs = document.querySelectorAll('.input-period-amount');
        const dateInputs = document.querySelectorAll('.input-period-date');

        let periodSum = 0;
        for (let i = 0; i < periodCount; i++) {
            const amt = parseAmountInput(amtInputs[i]);
            const date = dateInputs[i]?.value || '';
            periodSum += amt;
            periods.push({
                number: i + 1,
                label: `${i + 1}. Hakediş`,
                amount: amt,
                date: date
            });
        }

        // Add the completion period as the last item
        const completionDate = document.getElementById('input-completion-date')?.value || '';
        const compPeriodNumber = periodCount > 0 ? periodCount + 1 : 1;
        const compPeriodLabel = periodCount > 0 ? 'İş Bitimi' : 'İş Bitimi (Tek Ödeme)';

        periods.push({
            number: compPeriodNumber,
            label: compPeriodLabel,
            amount: completionAmount,
            date: completionDate,
            isCompletion: true
        });

        if (Math.abs(contractAmount - (periodSum + completionAmount)) > 1) {
            showToast('Dönem tutarlarının toplamı sözleşme bedeli ile eşleşmelidir.', 'error');
            return;
        }

        if (editId) {
            updateProject(editId, name, contractAmount, status, periodCount, completionAmount, periods);
            showToast('Proje güncellendi.', 'success');
        } else {
            addProject(name, contractAmount, status, periodCount, completionAmount, periods);
            projectDraft = null; // Clear draft on successful creation
            showToast('Yeni proje oluşturuldu!', 'success');
        }

        closeModal();

        if (currentProjectId) {
            renderProjectDetail(currentProjectId);
        } else {
            renderDashboard();
        }
    }

    function deleteProject() {
        if (!currentProjectId) return;
        const project = getProject(currentProjectId);
        if (!project) return;

        showConfirm(
            'Projeyi Sil',
            `"${project.name}" projesi ve tüm işlem geçmişi kalıcı olarak silinecek. Emin misiniz?`,
            () => {
                removeProject(currentProjectId);
                showToast('Proje silindi.', 'warning');
                showDashboard();
            }
        );
    }

    // ─────────────────────────────────────
    // MODALS — Transactions (Quick Actions)
    // ─────────────────────────────────────

    function openHakedis() {
        if (!currentProjectId) return;
        openModal('💰 Hakediş Tahsil Et', getTransactionFormHtml({
            type: 'hakedis',
            statusLocked: 'odendi',
            showDueDate: false,
            submitLabel: 'Tahsil Et',
            submitClass: 'btn-success'
        }));
    }

    function openMalzeme() {
        if (!currentProjectId) return;
        openModal('🧱 Malzeme Faturası Ekle', getTransactionFormHtml({
            type: 'malzeme',
            statusLocked: 'bekliyor',
            showDueDate: true,
            showEstimate: true,
            submitLabel: 'Fatura Ekle',
            submitClass: 'btn-warning'
        }));
    }

    function openIscilik() {
        if (!currentProjectId) return;
        openModal('👷 Usta / İşçilik Ödemesi', getTransactionFormHtml({
            type: 'iscilik',
            statusLocked: 'bekliyor',
            showDueDate: true,
            showEstimate: true,
            submitLabel: 'Kaydet',
            submitClass: 'btn-primary'
        }));
    }

    function openOfisSabit() {
        if (!currentProjectId) return;
        openModal('🏢 Ofis Gideri Yansıt', getTransactionFormHtml({
            type: 'ofis-sabit',
            statusLocked: 'odendi',
            showDueDate: false,
            submitLabel: 'Gider Yansıt',
            submitClass: 'btn-primary'
        }));
    }

    function getTransactionFormHtml(opts) {
        const { type, statusLocked, showDueDate, showEstimate, submitLabel, submitClass } = opts;
        const typeInfo = TX_TYPES[type] || {};

        const amountLabel = showEstimate ? 'Anlaşılan / Fatura Tutarı (₺) <span style="font-weight:400; color:var(--text-muted); text-transform:none; letter-spacing:0;">— opsiyonel</span>' : 'Tutar (₺)';
        const dueDateLabel = showEstimate ? 'Vade Tarihi <span style="font-weight:400; color:var(--text-muted); text-transform:none; letter-spacing:0;">— opsiyonel</span>' : 'Vade Tarihi';
        const requiredAttr = showEstimate ? '' : 'required';

        const project = getProject(currentProjectId);
        let periodSelectHtml = '';
        if (project && project.periods && project.periods.length > 0) {
            const options = project.periods.map(p => {
                return `<option value="${p.number}">${escapeHtml(p.label)} (${formatCurrency(p.amount)})</option>`;
            }).join('');
            
            periodSelectHtml = `
                <div class="form-group">
                    <label class="form-label" for="input-tx-period">Ödeme Dönemi</label>
                    <select class="form-select" id="input-tx-period">
                        <option value="0">Dönem Atanmamış</option>
                        ${options}
                    </select>
                </div>
            `;
        }

        return `
            <form onsubmit="App.saveTransaction(event, '${type}', '${statusLocked}')">
                <div class="form-group">
                    <label class="form-label">İşlem Tipi</label>
                    <input class="form-input" type="text" value="${typeInfo.label}" disabled>
                </div>
                ${periodSelectHtml}
                ${showEstimate ? `
                <div class="form-group">
                    <label class="form-label" for="input-tx-estimated">Tahmini Maliyet (₺) <span style="font-weight:400; color:var(--text-muted); text-transform:none; letter-spacing:0;">— iş başlangıcı bütçe tahmini</span></label>
                    <input class="form-input" type="text" inputmode="numeric" id="input-tx-estimated" placeholder="Opsiyonel" oninput="App.formatAmountInput(this)">
                </div>
                ` : ''}
                <div class="form-group">
                    <label class="form-label" for="input-tx-amount">${amountLabel}</label>
                    <input class="form-input" type="text" inputmode="numeric" id="input-tx-amount" placeholder="0" ${requiredAttr} autofocus oninput="App.formatAmountInput(this)">
                </div>
                ${showDueDate ? `
                <div class="form-group" id="group-due-date">
                    <label class="form-label" for="input-tx-due-date">${dueDateLabel}</label>
                    <input class="form-input" type="date" id="input-tx-due-date" value="">
                </div>
                ` : ''}
                <div class="form-group">
                    <label class="form-label" for="input-tx-description">Açıklama</label>
                    <input class="form-input" type="text" id="input-tx-description" placeholder="Kısa açıklama...">
                </div>
                <div class="form-group">
                    <label class="form-label">Ödeme Durumu</label>
                    <input class="form-input" type="text" value="${STATUS_LABELS[statusLocked]}" disabled>
                </div>
                <div class="form-actions">
                    <button type="button" class="btn btn-outline" onclick="App.closeModal()">İptal</button>
                    <button type="submit" class="btn ${submitClass}">${submitLabel}</button>
                </div>
            </form>`;
    }

    function saveTransaction(e, type, statusLocked) {
        e.preventDefault();
        if (!currentProjectId) return;

        const amount = parseAmountInput(document.getElementById('input-tx-amount'));
        const estimatedAmount = parseAmountInput(document.getElementById('input-tx-estimated'));

        const description = document.getElementById('input-tx-description').value;
        const dueDateEl = document.getElementById('input-tx-due-date');
        const dueDate = dueDateEl ? dueDateEl.value : '';

        const periodEl = document.getElementById('input-tx-period');
        const period = periodEl ? parseInt(periodEl.value) || 0 : 0;

        // If it's hakedis, we require amount.
        if (type === 'hakedis' && amount <= 0) {
            showToast('Hakediş tutarı 0\'dan büyük olmalıdır.', 'error');
            return;
        }

        // For expenses, at least one of estimatedAmount or amount must be > 0.
        if (type !== 'hakedis' && amount <= 0 && (!estimatedAmount || estimatedAmount <= 0)) {
            showToast('Lütfen tahmini maliyet veya anlaşılan tutardan en az birini girin.', 'error');
            return;
        }

        addTransaction(type, currentProjectId, amount, statusLocked, dueDate, description, estimatedAmount, period);

        const typeInfo = TX_TYPES[type] || {};
        showToast(`${typeInfo.label} kaydedildi!`, 'success');

        closeModal();
        renderProjectDetail(currentProjectId);
    }

    function markAsPaid(txId) {
        const tx = data.transactions.find(t => t.id === txId);
        if (!tx) return;

        const typeInfo = TX_TYPES[tx.type] || {};
        const formattedDate = tx.dueDate ? formatDate(tx.dueDate) : 'Vade Belirtilmedi';

        const html = `
            <div class="import-info" style="margin-bottom: 16px;">
                💳 <strong>${escapeHtml(tx.description || typeInfo.label)}</strong><br>
                Toplam Tutar: <strong>${formatCurrency(tx.amount)}</strong> · <span>Mevcut Vade: ${formattedDate}</span>
            </div>
            <form onsubmit="App.executePayment(event, '${txId}')">
                <div class="form-group" style="margin-bottom: 15px;">
                    <label class="form-label">Ödeme Tipi</label>
                    <div style="display: flex; gap: 10px;">
                        <label style="flex:1; display:flex; align-items:center; gap:8px; padding:10px 12px; background:rgba(255,255,255,0.03); border:1px solid var(--glass-border); border-radius:var(--radius-sm); cursor:pointer;">
                            <input type="radio" name="pay-mode" value="full" checked onchange="App.onPayModeChange(${tx.amount})">
                            <span style="font-size:0.85rem; font-weight:600;">✓ Tam Ödeme (%100)</span>
                        </label>
                        <label style="flex:1; display:flex; align-items:center; gap:8px; padding:10px 12px; background:rgba(255,255,255,0.03); border:1px solid var(--glass-border); border-radius:var(--radius-sm); cursor:pointer;">
                            <input type="radio" name="pay-mode" value="partial" onchange="App.onPayModeChange(${tx.amount})">
                            <span style="font-size:0.85rem; font-weight:600; color:var(--warning);">⚠️ Eksik / Kısmi Ödeme</span>
                        </label>
                    </div>
                </div>

                <div class="form-group">
                    <label class="form-label" for="input-pay-amount">Ödenen / Tahsil Edilen Tutar (₺)</label>
                    <input class="form-input" type="text" inputmode="numeric" id="input-pay-amount"
                           value="${tx.amount ? tx.amount.toLocaleString('tr-TR') : ''}"
                           oninput="App.onPayAmountInput(this, ${tx.amount})" onkeydown="App.onAmountKeyDown(event)" required autofocus>
                </div>

                <div id="partial-payment-box" style="display:none; background: rgba(239, 68, 68, 0.08); border: 1.5px dashed rgba(239, 68, 68, 0.4); border-radius: var(--radius-sm); padding: 16px; margin-bottom: 16px;">
                    <div style="font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.5px; color: var(--danger); font-weight: 700; margin-bottom: 4px;">
                        ⚠️ HESAPLANAN EKSİK KALAN BAKİYE
                    </div>
                    <div id="partial-payment-info" style="font-weight: 800; color: var(--danger); margin-bottom: 14px; font-size: 1.25rem;">
                        Kalan Eksik Tutar: 0 ₺
                    </div>
                    <div class="form-group" style="margin-bottom:0;">
                        <label class="form-label" for="input-partial-due-date" style="color: var(--text-main); font-weight:700; font-size:0.88rem;">
                            📅 Bu Eksik Miktar (<span id="partial-amount-badge" style="color:var(--danger); font-weight:800;">0 ₺</span>) Ne Zaman Ödenecek? (Yeni Vade)
                        </label>
                        <input class="form-input" type="date" id="input-partial-due-date" value="${tx.dueDate || ''}">
                        <div style="margin-top:6px; font-size:0.75rem; color:var(--text-muted);">
                            Eksik kalan bakiyenin ne zaman tamamlanacağını belirleyin.
                        </div>
                    </div>
                </div>

                <div class="form-actions">
                    <button type="button" class="btn btn-outline" onclick="App.closeModal()">İptal</button>
                    <button type="submit" class="btn btn-success">✓ Ödemeyi Kaydet</button>
                </div>
            </form>
        `;
        openModal('💳 Ödeme Kaydet', html);
    }

    function onPayModeChange(totalAmount) {
        const mode = document.querySelector('input[name="pay-mode"]:checked')?.value;
        const amountInput = document.getElementById('input-pay-amount');
        if (mode === 'full') {
            if (amountInput) amountInput.value = totalAmount.toLocaleString('tr-TR');
            onPayAmountInput(amountInput, totalAmount);
        } else {
            if (amountInput) {
                amountInput.focus();
                amountInput.select();
            }
            onPayAmountInput(amountInput, totalAmount);
        }
    }

    function onPayAmountInput(el, totalAmount) {
        formatAmountInput(el);
        const payAmount = parseAmountInput(el);
        const remaining = totalAmount - payAmount;
        const box = document.getElementById('partial-payment-box');
        const info = document.getElementById('partial-payment-info');
        const badge = document.getElementById('partial-amount-badge');
        const partialDateInput = document.getElementById('input-partial-due-date');
        const partialRadio = document.querySelector('input[name="pay-mode"][value="partial"]');
        const fullRadio = document.querySelector('input[name="pay-mode"][value="full"]');

        if (remaining > 0 && payAmount > 0) {
            if (partialRadio) partialRadio.checked = true;
            if (box) box.style.display = 'block';
            if (info) info.innerHTML = `Kalan Eksik Tutar: <span style="font-size:1.3rem; font-weight:800; color:var(--danger);">${formatCurrency(remaining)}</span>`;
            if (badge) badge.textContent = formatCurrency(remaining);
            if (partialDateInput) partialDateInput.required = true;
        } else {
            if (fullRadio) fullRadio.checked = true;
            if (box) box.style.display = 'none';
            if (partialDateInput) partialDateInput.required = false;
        }
    }

    function executePayment(e, txId) {
        if (e) e.preventDefault();
        const tx = data.transactions.find(t => t.id === txId);
        if (!tx) return;

        const payAmount = parseAmountInput(document.getElementById('input-pay-amount'));

        if (payAmount <= 0) {
            showToast('Ödeme tutarı 0\'dan büyük olmalıdır.', 'error');
            return;
        }

        if (payAmount > tx.amount) {
            showToast('Ödeme tutarı toplam borç tutarını aşamaz.', 'error');
            return;
        }

        if (payAmount >= tx.amount) {
            // Full payment — mark the original as paid
            tx.paymentStatus = 'odendi';
            saveData();
            showToast(`Tam ödeme kaydedildi: ${formatCurrency(tx.amount)}`, 'success');
        } else {
            // Partial payment — check new completion date
            const newDueDate = document.getElementById('input-partial-due-date')?.value || '';
            if (!newDueDate) {
                showToast('Lütfen eksik kalan tutar için tamamlanma vade tarihini seçin.', 'error');
                return;
            }

            const remaining = tx.amount - payAmount;

            // Create new "paid" transaction for the partial amount
            addTransaction(
                tx.type,
                tx.projectId,
                payAmount,
                'odendi',
                todayStr(),
                (tx.description ? tx.description + ` (Kısmi Tahsilat / Ödenen: ${formatCurrency(payAmount)})` : `Kısmi Ödeme: ${formatCurrency(payAmount)}`),
                0,
                tx.period
            );

            // Update the original transaction for the remaining missing amount and new completion date
            tx.amount = remaining;
            tx.dueDate = newDueDate;
            const cleanDesc = tx.description ? tx.description.replace(/\(Eksik Kalan Miktar:.*?\)/g, '').replace(/\(Kısmi Ödeme Yapıldı\)|\(Eksik Kalan Bakiye\)/g, '').trim() : '';
            tx.description = `${cleanDesc} (Eksik Kalan Miktar: ${formatCurrency(remaining)})`;
            saveData();

            const dateText = formatDate(newDueDate);
            showToast(
                `Kısmi ödeme alındı! Kalan Eksik Miktar: ${formatCurrency(remaining)} (Tamamlanma Vadesi: ${dateText})`,
                'warning'
            );
        }

        closeModal();

        if (currentProjectId) {
            renderProjectDetail(currentProjectId);
        } else {
            renderDashboard();
        }
    }

    function deleteTransaction(txId) {
        showConfirm(
            'İşlemi Sil',
            'Bu finansal işlem kalıcı olarak silinecek. Emin misiniz?',
            () => {
                removeTransaction(txId);
                showToast('İşlem silindi.', 'warning');
                if (currentProjectId) {
                    renderProjectDetail(currentProjectId);
                } else {
                    renderDashboard();
                }
            }
        );
    }

    // ─────────────────────────────────────
    // NUMBER FORMATTING & MODAL HELPERS
    // ─────────────────────────────────────
    function onAmountKeyDown(e) {
        if (e.key === 'Backspace') {
            const el = e.target;
            const selStart = el.selectionStart;
            const selEnd = el.selectionEnd;
            if (selStart === selEnd && selStart > 0) {
                if (el.value[selStart - 1] === '.') {
                    e.preventDefault();
                    const val = el.value;
                    const newVal = val.slice(0, selStart - 2) + val.slice(selStart);
                    el.value = newVal;
                    const newPos = Math.max(0, selStart - 2);
                    try { el.setSelectionRange(newPos, newPos); } catch (err) {}
                    formatAmountInput(el);
                }
            }
        }
    }

    function formatAmountInput(el) {
        if (!el) return;
        const val = el.value;
        const selStart = el.selectionStart || 0;

        let raw = val.replace(/\D/g, '');
        if (!raw) {
            el.value = '';
            return;
        }

        if (raw.length > 12) raw = raw.slice(0, 12);

        const num = parseInt(raw, 10);
        const formatted = num.toLocaleString('tr-TR');

        const digitsBeforeCursor = val.slice(0, selStart).replace(/\D/g, '').length;

        el.value = formatted;

        let newCursorPos = formatted.length;
        let digitCount = 0;
        for (let i = 0; i < formatted.length; i++) {
            if (/\d/.test(formatted[i])) {
                digitCount++;
            }
            if (digitCount === digitsBeforeCursor) {
                newCursorPos = i + 1;
                break;
            }
        }
        if (digitsBeforeCursor === 0) newCursorPos = 0;

        try {
            el.setSelectionRange(newCursorPos, newCursorPos);
        } catch (e) {}
    }

    function parseAmountInput(valOrEl) {
        let val = (typeof valOrEl === 'object' && valOrEl !== null) ? valOrEl.value : valOrEl;
        if (val === undefined || val === null || val === '') return 0;
        if (typeof val === 'number') return val;
        const cleaned = String(val).replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '');
        return parseFloat(cleaned) || 0;
    }

    // ─────────────────────────────────────
    // MODAL — Core
    // ─────────────────────────────────────
    function openModal(title, bodyHtml) {
        document.getElementById('modal-title').textContent = title;
        document.getElementById('modal-body').innerHTML = bodyHtml;
        document.getElementById('modal-overlay').classList.add('active');

        // Auto-focus first input
        setTimeout(() => {
            const firstInput = document.querySelector('#modal-body input:not([disabled])');
            if (firstInput) firstInput.focus();
        }, 100);
    }

    function closeModal() {
        saveProjectDraft();
        document.getElementById('modal-overlay').classList.remove('active');
    }

    function handleOverlayClick(e) {
        if (e.target.id === 'modal-overlay') {
            closeModal();
        }
    }

    // ─────────────────────────────────────
    // IMPORT / EXPORT
    // ─────────────────────────────────────
    function exportData() {
        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        a.href = url;
        a.download = `zebra-kasa-yedek-${timestamp}.json`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('Veriler dışa aktarıldı.', 'success');
    }

    function importData(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const imported = JSON.parse(e.target.result);
                if (!imported.projects || !imported.transactions) {
                    showToast('Geçersiz dosya formatı!', 'error');
                    return;
                }
                showConfirm(
                    'İçe Aktar',
                    'Mevcut tüm veriler silinip, yüklenen dosyadaki verilerle değiştirilecek. Emin misiniz?',
                    () => {
                        data = imported;
                        saveData();
                        showToast('Veriler başarıyla içe aktarıldı!', 'success');
                        showDashboard();
                    }
                );
            } catch (err) {
                showToast('Dosya okunamadı: ' + err.message, 'error');
            }
        };
        reader.readAsText(file);
        event.target.value = '';
    }

    function resetData() {
        const html = `
            <div style="margin-bottom: 16px; line-height: 1.5; color: var(--text-secondary);">
                Bu işlem tüm finansal verileri silecektir. Devam etmek için güvenlik şifrenizi girin.
                <br><span style="font-size:0.75rem; color:var(--text-muted);">(Varsayılan şifre: <strong>1234</strong>)</span>
            </div>
            
            <div class="form-group" style="margin-bottom: 16px;">
                <label class="form-label" for="input-reset-password">Güvenlik Şifresi</label>
                <input class="form-input" type="password" id="input-reset-password" placeholder="Şifrenizi girin" autofocus required>
            </div>

            <div style="display: flex; flex-direction: column; gap: 10px; margin-bottom: 16px;">
                <button type="button" class="btn btn-warning" style="justify-content: center; padding: 10px;" onclick="App.processReset('demo')">
                    🔄 Demo Verileri Yükle (Örnek Projeler)
                </button>
                <button type="button" class="btn btn-danger-outline" style="justify-content: center; padding: 10px;" onclick="App.processReset('clear')">
                    🗑️ Tüm Verileri Sil (Temiz Kasa)
                </button>
            </div>

            <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--glass-border); padding-top: 12px; margin-top: 12px;">
                <button type="button" class="btn btn-xs btn-outline" onclick="App.openChangeResetPasswordModal()">
                    🔒 Şifreyi Değiştir
                </button>
                <button type="button" class="btn btn-outline btn-sm" onclick="App.closeModal()">İptal</button>
            </div>
        `;
        openModal('🔒 Şifreli Veri Sıfırlama', html);
    }

    function processReset(mode) {
        const inputPass = document.getElementById('input-reset-password').value;
        const actualPass = data.resetPassword || '1234';

        if (inputPass !== actualPass) {
            showToast('Hatalı güvenlik şifresi! İşlem iptal edildi.', 'error');
            return;
        }

        closeModal();
        if (mode === 'demo') {
            showConfirm(
                'Demo Verileri Yükle',
                'Şifre doğrulandı. Mevcut veriler silinip örnek projeler (Kemalpaşa & Bornova) yüklenecek. Emin misiniz?',
                () => {
                    const passBackup = data.resetPassword;
                    seedDemoData();
                    if (passBackup) data.resetPassword = passBackup;
                    saveData();
                    showToast('Örnek demo verileri yüklendi!', 'success');
                    showDashboard();
                }
            );
        } else if (mode === 'clear') {
            showConfirm(
                'Tüm Verileri Sil',
                'Şifre doğrulandı. TÜM projeler ve finansal kayıtlar kalıcı olarak silinecek. Emin misiniz?',
                () => {
                    const passBackup = data.resetPassword;
                    data = { projects: [], transactions: [] };
                    if (passBackup) data.resetPassword = passBackup;
                    saveData();
                    showToast('Tüm veriler temizlendi.', 'warning');
                    showDashboard();
                }
            );
        }
    }

    function openChangeResetPasswordModal() {
        const html = `
            <form onsubmit="App.saveResetPassword(event)">
                <div class="form-group">
                    <label class="form-label" for="input-current-pass">Mevcut Şifre</label>
                    <input class="form-input" type="password" id="input-current-pass" placeholder="Varsayılan: 1234" required autofocus>
                </div>
                <div class="form-group">
                    <label class="form-label" for="input-new-pass">Yeni Şifre</label>
                    <input class="form-input" type="password" id="input-new-pass" placeholder="En az 4 karakter" required>
                </div>
                <div class="form-group">
                    <label class="form-label" for="input-new-pass-confirm">Yeni Şifre (Tekrar)</label>
                    <input class="form-input" type="password" id="input-new-pass-confirm" placeholder="Yeni şifreyi tekrar girin" required>
                </div>
                <div class="form-actions">
                    <button type="button" class="btn btn-outline" onclick="App.resetData()">Geri</button>
                    <button type="submit" class="btn btn-primary">Şifreyi Kaydet</button>
                </div>
            </form>
        `;
        openModal('🔒 Sıfırlama Şifresini Değiştir', html);
    }

    function saveResetPassword(e) {
        e.preventDefault();
        const currentPassInput = document.getElementById('input-current-pass').value;
        const newPass = document.getElementById('input-new-pass').value;
        const newPassConfirm = document.getElementById('input-new-pass-confirm').value;
        const actualPass = data.resetPassword || '1234';

        if (currentPassInput !== actualPass) {
            showToast('Mevcut şifre hatalı!', 'error');
            return;
        }

        if (newPass.length < 4) {
            showToast('Yeni şifre en az 4 karakter olmalıdır.', 'error');
            return;
        }

        if (newPass !== newPassConfirm) {
            showToast('Yeni şifreler eşleşmiyor!', 'error');
            return;
        }

        data.resetPassword = newPass;
        saveData();
        closeModal();
        showToast('Sıfırlama şifreniz başarıyla değiştirildi!', 'success');
    }

    // ─────────────────────────────────────
    // DEMO DATA
    // ─────────────────────────────────────
    function seedDemoData() {
        const today = new Date();

        // Helper: date offset from today
        function dateOffset(days) {
            const d = new Date(today);
            d.setDate(d.getDate() + days);
            return d.toISOString().split('T')[0];
        }

        const p1Id = 'demo-kemalpasa';
        const p2Id = 'demo-bornova';

        data.projects = [
            {
                id: p1Id,
                name: 'Kemalpaşa Villaları',
                contractAmount: 2500000,
                status: 'devam-ediyor',
                periodCount: 4,
                completionAmount: 200000,
                periods: [
                    { number: 1, label: '1. Hakediş', amount: 575000, date: dateOffset(-75) },
                    { number: 2, label: '2. Hakediş', amount: 575000, date: dateOffset(-45) },
                    { number: 3, label: '3. Hakediş', amount: 575000, date: dateOffset(-15) },
                    { number: 4, label: '4. Hakediş', amount: 575000, date: dateOffset(15) },
                    { number: 5, label: 'İş Bitimi', amount: 200000, date: dateOffset(45), isCompletion: true }
                ],
                createdAt: dateOffset(-90)
            },
            {
                id: p2Id,
                name: 'Bornova Rezidans',
                contractAmount: 4200000,
                status: 'devam-ediyor',
                periodCount: 4,
                completionAmount: 400000,
                periods: [
                    { number: 1, label: '1. Hakediş', amount: 950000, date: dateOffset(-55) },
                    { number: 2, label: '2. Hakediş', amount: 950000, date: dateOffset(-25) },
                    { number: 3, label: '3. Hakediş', amount: 950000, date: dateOffset(5) },
                    { number: 4, label: '4. Hakediş', amount: 950000, date: dateOffset(35) },
                    { number: 5, label: 'İş Bitimi', amount: 400000, date: dateOffset(65), isCompletion: true }
                ],
                createdAt: dateOffset(-60)
            }
        ];

        data.transactions = [
            // ── Kemalpaşa: Gelirler ──
            { id: generateId(), type: 'hakedis', projectId: p1Id, amount: 575000, paymentStatus: 'odendi', dueDate: dateOffset(-75), description: 'Hakediş #1 — Proje Başlangıcı', period: 1, createdAt: dateOffset(-75) },
            { id: generateId(), type: 'hakedis', projectId: p1Id, amount: 575000, paymentStatus: 'odendi', dueDate: dateOffset(-45), description: 'Hakediş #2 — Kaba İnşaat', period: 2, createdAt: dateOffset(-45) },
            { id: generateId(), type: 'hakedis', projectId: p1Id, amount: 575000, paymentStatus: 'odendi', dueDate: dateOffset(-15), description: 'Hakediş #3 — İnce İşler', period: 3, createdAt: dateOffset(-15) },

            // ── Kemalpaşa: Giderler (Ödendi) ──
            { id: generateId(), type: 'malzeme', projectId: p1Id, amount: 180000, estimatedAmount: 200000, paymentStatus: 'odendi', dueDate: dateOffset(-70), description: 'Çimento ve demir alımı', period: 1, createdAt: dateOffset(-70) },
            { id: generateId(), type: 'iscilik', projectId: p1Id, amount: 95000, estimatedAmount: 90000, paymentStatus: 'odendi', dueDate: dateOffset(-60), description: 'Kalıpçı ekip ödemesi', period: 1, createdAt: dateOffset(-60) },
            { id: generateId(), type: 'malzeme', projectId: p1Id, amount: 120000, estimatedAmount: 110000, paymentStatus: 'odendi', dueDate: dateOffset(-40), description: 'Elektrik ve tesisat malzeme', period: 2, createdAt: dateOffset(-40) },
            { id: generateId(), type: 'iscilik', projectId: p1Id, amount: 75000, estimatedAmount: 80000, paymentStatus: 'odendi', dueDate: dateOffset(-30), description: 'Cuma harçlıkları (4 hafta)', period: 2, createdAt: dateOffset(-30) },
            { id: generateId(), type: 'ofis-sabit', projectId: p1Id, amount: 45000, estimatedAmount: 45000, paymentStatus: 'odendi', dueDate: dateOffset(-20), description: 'Merkez ofis gider payı — Haziran', period: 2, createdAt: dateOffset(-20) },

            // ── Kemalpaşa: Giderler (Bekliyor — yaklaşan) ──
            { id: generateId(), type: 'malzeme', projectId: p1Id, amount: 85000, estimatedAmount: 80000, paymentStatus: 'bekliyor', dueDate: dateOffset(5), description: 'Seramik ve fayans faturası', period: 3, createdAt: dateOffset(-5) },
            { id: generateId(), type: 'iscilik', projectId: p1Id, amount: 60000, estimatedAmount: 60000, paymentStatus: 'bekliyor', dueDate: dateOffset(12), description: 'Boyacı usta ödemesi', period: 3, createdAt: dateOffset(-3) },
            { id: generateId(), type: 'malzeme', projectId: p1Id, amount: 42000, estimatedAmount: 50000, paymentStatus: 'bekliyor', dueDate: dateOffset(22), description: 'Mutfak dolapları', period: 4, createdAt: dateOffset(-1) },

            // ── Bornova: Gelirler ──
            { id: generateId(), type: 'hakedis', projectId: p2Id, amount: 95000, paymentStatus: 'odendi', dueDate: dateOffset(-55), description: 'Hakediş #1 — Avans', period: 1, createdAt: dateOffset(-55) },
            { id: generateId(), type: 'hakedis', projectId: p2Id, amount: 95000, paymentStatus: 'odendi', dueDate: dateOffset(-25), description: 'Hakediş #2 — Temel Atma', period: 2, createdAt: dateOffset(-25) },

            // ── Bornova: Giderler (Ödendi) ──
            { id: generateId(), type: 'malzeme', projectId: p2Id, amount: 350000, estimatedAmount: 300000, paymentStatus: 'odendi', dueDate: dateOffset(-50), description: 'Hafriyat ve beton', period: 1, createdAt: dateOffset(-50) },
            { id: generateId(), type: 'iscilik', projectId: p2Id, amount: 220000, estimatedAmount: 200000, paymentStatus: 'odendi', dueDate: dateOffset(-35), description: 'Temel kazı ekibi', period: 1, createdAt: dateOffset(-35) },
            { id: generateId(), type: 'ofis-sabit', projectId: p2Id, amount: 55000, estimatedAmount: 55000, paymentStatus: 'odendi', dueDate: dateOffset(-20), description: 'Merkez ofis gider payı — Haziran', period: 2, createdAt: dateOffset(-20) },
            { id: generateId(), type: 'iscilik', projectId: p2Id, amount: 110000, estimatedAmount: 120000, paymentStatus: 'odendi', dueDate: dateOffset(-10), description: 'Kalıpçı ve demirci', period: 2, createdAt: dateOffset(-10) },

            // ── Bornova: Giderler (Bekliyor — yaklaşan) ──
            { id: generateId(), type: 'malzeme', projectId: p2Id, amount: 280000, estimatedAmount: 250000, paymentStatus: 'bekliyor', dueDate: dateOffset(3), description: 'Çelik konstrüksiyon faturası', period: 3, createdAt: dateOffset(-2) },
            { id: generateId(), type: 'iscilik', projectId: p2Id, amount: 95000, estimatedAmount: 100000, paymentStatus: 'bekliyor', dueDate: dateOffset(8), description: 'Haftalık usta ödemesi', period: 3, createdAt: dateOffset(-1) },
            { id: generateId(), type: 'malzeme', projectId: p2Id, amount: 150000, estimatedAmount: 150000, paymentStatus: 'bekliyor', dueDate: dateOffset(18), description: 'Asansör sistemi peşinat', period: 4, createdAt: dateOffset(0) },

            // Gecikmiş ödeme (overdue) — test
            { id: generateId(), type: 'malzeme', projectId: p2Id, amount: 35000, estimatedAmount: 30000, paymentStatus: 'bekliyor', dueDate: dateOffset(-3), description: 'Geçikmiş — Boya malzeme', period: 2, createdAt: dateOffset(-10) }
        ];

        saveData();
    }

    // ─────────────────────────────────────
    // CSV / EXCEL IMPORT
    // ─────────────────────────────────────

    let csvParsedRows = [];   // Temp storage for parsed rows during import flow
    let csvHeaders = [];      // Temp storage for CSV headers

    function fixTurkishEncodingArtifacts(str) {
        if (!str) return str;
        return str
            .replace(/\uFEFF/g, '') // BOM
            .replace(/Ã¾/g, 'ş').replace(/Ã³/g, 'ü').replace(/Ã§/g, 'ç').replace(/Ã°/g, 'ğ').replace(/Ã½/g, 'ı').replace(/Ã¶/g, 'ö')
            .replace(/Ã/g, 'Ş').replace(/Ã/g, 'Ü').replace(/Ã/g, 'Ç').replace(/Ã/g, 'Ğ').replace(/Ã/g, 'İ').replace(/Ã/g, 'Ö')
            .replace(/þ/g, 'ş').replace(/ð/g, 'ğ').replace(/ý/g, 'ı').replace(/Þ/g, 'Ş').replace(/Ð/g, 'Ğ').replace(/Ý/g, 'İ');
    }

    function parseExcelSheet(worksheet) {
        if (!worksheet) return { headers: [], rows: [] };

        const rawRows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
        if (!rawRows || rawRows.length === 0) return { headers: [], rows: [] };

        // Find the row that contains header keywords (search top 10 rows)
        let headerRowIndex = 0;
        const descKeywords = ['açıklama', 'aciklama', 'kalem', 'iş kalemi', 'is kalemi', 'tanım', 'tanim', 'ürün', 'urun', 'malzeme', 'işçilik', 'iscilik', 'detay', 'description', 'item', 'ad', 'isim', 'name', 'gider', 'faaliyet', 'harcama', 'no', 'sıra'];
        const amountKeywords = ['tutar', 'toplam', 'maliyet', 'bedel', 'fiyat', 'harcama', 'gider', 'rakam', 'amount', 'total', 'cost', 'price', 'birim fiyat'];

        for (let r = 0; r < Math.min(10, rawRows.length); r++) {
            const row = rawRows[r];
            if (!Array.isArray(row)) continue;
            const textCells = row.map(c => String(c).toLowerCase().trim()).filter(Boolean);
            const hasHeaderKeyword = textCells.some(cell =>
                descKeywords.some(kw => cell.includes(kw)) || amountKeywords.some(kw => cell.includes(kw))
            );
            if (hasHeaderKeyword) {
                headerRowIndex = r;
                break;
            }
        }

        // Determine column count from widest row
        let maxCols = 0;
        rawRows.forEach(r => { if (Array.isArray(r) && r.length > maxCols) maxCols = r.length; });

        // Build friendly column names for EVERY column (Sütun A: ..., Sütun B: ...)
        const rawHeaderRow = rawRows[headerRowIndex] || [];
        const headers = [];
        const getColLetter = (idx) => {
            if (idx < 26) return String.fromCharCode(65 + idx);
            return `${String.fromCharCode(65 + Math.floor(idx / 26) - 1)}${String.fromCharCode(65 + (idx % 26))}`;
        };

        for (let col = 0; col < maxCols; col++) {
            const letter = getColLetter(col);
            const headerVal = String(rawHeaderRow[col] || '').trim();
            if (headerVal && !headerVal.startsWith('__EMPTY')) {
                headers.push(`Sütun ${letter}: ${headerVal}`);
            } else {
                headers.push(`Sütun ${letter} (${col + 1}. Sütun)`);
            }
        }

        // Extract data rows below header row
        const dataRows = [];
        for (let r = headerRowIndex + 1; r < rawRows.length; r++) {
            const rowArr = rawRows[r];
            if (!Array.isArray(rowArr)) continue;
            if (rowArr.some(cell => String(cell).trim())) {
                const rowObj = {};
                headers.forEach((h, colIdx) => {
                    const val = rowArr[colIdx];
                    rowObj[h] = (val === null || val === undefined) ? '' : String(val).trim();
                });
                dataRows.push(rowObj);
            }
        }

        return { headers, rows: dataRows };
    }

    function handleCsvImport(event) {
        const file = event.target.files[0];
        if (!file) return;
        event.target.value = ''; // Reset so same file can be re-selected if needed

        const fileName = file.name.toLowerCase();
        const isExcel = fileName.endsWith('.xlsx') || fileName.endsWith('.xls');

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const buffer = e.target.result;

                if (isExcel && typeof XLSX !== 'undefined') {
                    // Read native Excel (.xlsx / .xls) binary file using SheetJS
                    const workbook = XLSX.read(buffer, { type: 'array' });
                    const firstSheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[firstSheetName];

                    const { headers, rows } = parseExcelSheet(worksheet);

                    if (rows.length === 0) {
                        showToast('Excel sayfasında veri bulunamadı.', 'error');
                        return;
                    }

                    csvHeaders = headers;
                    csvParsedRows = rows;
                    showImportPreview(headers, rows);
                } else {
                    // Read text CSV / TSV file with smart encoding detection (UTF-8 / CP1254)
                    const bytes = new Uint8Array(buffer);
                    let text = '';
                    if (bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) {
                        text = new TextDecoder('utf-8').decode(bytes.subarray(3));
                    } else {
                        try {
                            const utf8Decoder = new TextDecoder('utf-8', { fatal: true });
                            text = utf8Decoder.decode(bytes);
                        } catch (err) {
                            const cp1254Decoder = new TextDecoder('windows-1254');
                            text = cp1254Decoder.decode(bytes);
                        }
                    }

                    text = fixTurkishEncodingArtifacts(text);
                    const { headers, rows } = parseCSV(text);

                    if (rows.length === 0) {
                        showToast('Dosyada veri bulunamadı.', 'error');
                        return;
                    }

                    csvHeaders = headers;
                    csvParsedRows = rows;
                    showImportPreview(headers, rows);
                }
            } catch (err) {
                showToast('Dosya okunamadı: ' + err.message, 'error');
            }
        };
        reader.readAsArrayBuffer(file);
    }

    /**
     * Smart CSV parser — auto-detects delimiter (tab, semicolon, comma)
     * Handles quoted fields and Turkish number formats (1.234,56 → 1234.56)
     */
    function parseCSV(text) {
        // Normalize line endings
        const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(l => l.trim());
        if (lines.length < 2) throw new Error('En az 2 satır gerekli (başlık + veri)');

        // Auto-detect delimiter from header line
        const headerLine = lines[0];
        let delimiter = ',';
        if (headerLine.includes('\t')) delimiter = '\t';
        else if (headerLine.split(';').length > headerLine.split(',').length) delimiter = ';';

        function splitRow(line) {
            const result = [];
            let current = '';
            let inQuotes = false;
            for (let i = 0; i < line.length; i++) {
                const ch = line[i];
                if (ch === '"') {
                    inQuotes = !inQuotes;
                } else if (ch === delimiter && !inQuotes) {
                    result.push(current.trim());
                    current = '';
                } else {
                    current += ch;
                }
            }
            result.push(current.trim());
            return result;
        }

        const headers = splitRow(lines[0]);
        const rows = [];
        for (let i = 1; i < lines.length; i++) {
            const cells = splitRow(lines[i]);
            if (cells.length > 0 && cells.some(c => c.trim())) {
                const row = {};
                headers.forEach((h, idx) => { row[h] = cells[idx] || ''; });
                rows.push(row);
            }
        }
        return { headers, rows };
    }

    /**
     * Parse a Turkish-format number string.
     * Handles: "1.234.567,89" → 1234567.89, "1234567" → 1234567, "1.250.000" → 1250000, "₺ 150.000" → 150000
     */
    function parseTurkishNumber(str) {
        if (str === null || str === undefined || str === '') return 0;
        if (typeof str === 'number') return str;

        let s = String(str).trim();
        s = s.replace(/[^\d.,\-]/g, '').trim();
        if (!s) return 0;

        const isNegative = s.startsWith('-');
        if (isNegative) s = s.replace(/-/g, '');

        if (s.includes(',') && s.includes('.')) {
            if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
                s = s.replace(/\./g, '').replace(',', '.');
            } else {
                s = s.replace(/,/g, '');
            }
        } else if (s.includes(',')) {
            const parts = s.split(',');
            if (parts.length === 2 && parts[1].length <= 2) {
                s = s.replace(',', '.');
            } else {
                s = s.replace(/,/g, '');
            }
        } else if (s.includes('.')) {
            const parts = s.split('.');
            if (parts.length > 2) {
                s = s.replace(/\./g, '');
            } else if (parts.length === 2 && parts[1].length === 3) {
                s = s.replace(/\./g, '');
            }
        }

        const val = parseFloat(s);
        if (isNaN(val)) return 0;
        return isNegative ? -val : val;
    }

    /**
     * Auto-detect which columns map to description, amount, and row category.
     * Returns { descCol, amountCol, typeCol }
     */
    function autoDetectColumns(headers, rows) {
        const descKeywords = [
            'açıklama', 'aciklama', 'kalem', 'iş kalemi', 'is kalemi', 'tanım', 'tanim',
            'ürün', 'urun', 'malzeme', 'işçilik', 'iscilik', 'detay', 'açıklamalar',
            'description', 'item', 'ad', 'isim', 'name', 'konu', 'gider', 'faaliyet', 'harcama'
        ];
        const amountKeywords = [
            'tutar', 'toplam', 'maliyet', 'bedel', 'fiyat', 'harcama', 'gider', 'rakam',
            'tutar (₺)', 'toplam (₺)', 'genel toplam', 'amount', 'total', 'cost', 'price',
            'birim fiyat', 'hakediş'
        ];
        const typeKeywords = [
            'kategori', 'tip', 'tür', 'tur', 'gider tipi', 'gider türü', 'gider turu',
            'işlem tipi', 'islem tipi', 'category', 'type', 'sınıf', 'sinif'
        ];

        let descCol = null;
        let amountCol = null;
        let typeCol = null;

        const lowerHeaders = headers.map(h => String(h).toLowerCase().trim());

        // Find description column
        for (const kw of descKeywords) {
            const idx = lowerHeaders.findIndex(h => h.includes(kw));
            if (idx !== -1) { descCol = headers[idx]; break; }
        }

        // Find amount column
        for (const kw of amountKeywords) {
            const idx = lowerHeaders.findIndex(h => h.includes(kw));
            if (idx !== -1) { amountCol = headers[idx]; break; }
        }

        // Find category/type column
        for (const kw of typeKeywords) {
            const idx = lowerHeaders.findIndex(h => h.includes(kw));
            if (idx !== -1) { typeCol = headers[idx]; break; }
        }

        // Fallback amount detection: column with most numeric values
        if (!amountCol) {
            let bestCol = null;
            let bestCount = 0;
            for (const h of headers) {
                const numCount = rows.filter(r => parseTurkishNumber(r[h]) > 0).length;
                if (numCount > bestCount) { bestCount = numCount; bestCol = h; }
            }
            if (bestCol && bestCount > rows.length * 0.3) amountCol = bestCol;
        }

        // Fallback description detection: first non-amount/non-type column
        if (!descCol) {
            descCol = headers.find(h => h !== amountCol && h !== typeCol) || headers[0];
        }

        return { descCol, amountCol, typeCol };
    }

    /**
     * Auto-detect row transaction type (Labour vs Material vs Office)
     */
    function detectRowTxType(row, typeCol, descCol, defaultType) {
        if (typeCol && row[typeCol]) {
            const val = String(row[typeCol]).toLowerCase();
            if (val.includes('işçilik') || val.includes('iscilik') || val.includes('yevmiye') || val.includes('usta') || val.includes('taşeron') || val.includes('taseron') || val.includes('labor') || val.includes('maaş')) {
                return 'iscilik';
            }
            if (val.includes('ofis') || val.includes('sabit') || val.includes('fatura') || val.includes('kira')) {
                return 'ofis-sabit';
            }
            if (val.includes('malzeme') || val.includes('ürün') || val.includes('urun') || val.includes('material')) {
                return 'malzeme';
            }
        }

        if (descCol && row[descCol]) {
            const desc = String(row[descCol]).toLowerCase();
            const labourKeywords = ['işçilik', 'iscilik', 'usta', 'yevmiye', 'taşeron', 'taseron', 'montaj', 'kalıpçı', 'demirci', 'duvarcı', 'sıvacı', 'boyacı', 'tesisatçı', 'elektrikçi', 'ustalık', 'maaş', 'hakediş usta', 'işçiliği', 'isciligi', 'çalışma'];
            for (const kw of labourKeywords) {
                if (desc.includes(kw)) return 'iscilik';
            }

            const officeKeywords = ['ofis', 'kira', 'fatura', 'elektrik faturası', 'su faturası', 'internet', 'aidat', 'muhasebe', 'yemek', 'yakıt', 'benzin'];
            for (const kw of officeKeywords) {
                if (desc.includes(kw)) return 'ofis-sabit';
            }
        }

        return defaultType || 'malzeme';
    }

    function showImportPreview(headers, rows) {
        const { descCol, amountCol, typeCol } = autoDetectColumns(headers, rows);

        function selectedAttr(col, target) { return col === target ? 'selected' : ''; }
        const descOptions = headers.map(h => `<option value="${escapeHtml(h)}" ${selectedAttr(h, descCol)}>${escapeHtml(h)}</option>`).join('');
        const amountOptions = headers.map(h => `<option value="${escapeHtml(h)}" ${selectedAttr(h, amountCol)}>${escapeHtml(h)}</option>`).join('');

        const previewRows = rows.slice(0, 8);
        const totalRows = rows.length;

        const totalAmount = amountCol
            ? rows.reduce((sum, r) => sum + parseTurkishNumber(r[amountCol]), 0)
            : 0;

        const project = getProject(currentProjectId);
        let periodSelectHtml = '';
        if (project && project.periods && project.periods.length > 0) {
            const options = project.periods.map(p => {
                return `<option value="${p.number}">${escapeHtml(p.label)} (${formatCurrency(p.amount)})</option>`;
            }).join('');

            periodSelectHtml = `
                <div class="form-group" style="flex:1; margin-bottom:0">
                    <label class="form-label">Ödeme Dönemi</label>
                    <select class="form-select" id="import-tx-period">
                        <option value="0">Dönem Atanmamış</option>
                        ${options}
                    </select>
                </div>
            `;
        }

        const html = `
            <div class="import-info">
                📊 <strong>${totalRows} satır</strong> bulundu.
                Açıklama ve Tutar sütunları <strong>otomatik algılandı</strong>.
            </div>

            <div class="import-mapping">
                <div class="import-mapping-row">
                    <div class="form-group" style="margin-bottom:0">
                        <label class="form-label">Açıklama Sütunu (Otomatik)</label>
                        <select class="form-select" id="import-col-desc">${descOptions}</select>
                    </div>
                    <div class="form-group" style="margin-bottom:0">
                        <label class="form-label">Tutar Sütunu (Otomatik)</label>
                        <select class="form-select" id="import-col-amount">${amountOptions}</select>
                    </div>
                </div>
                <div class="import-mapping-row" style="margin-top:10px;">
                    <div class="form-group" style="margin-bottom:0">
                        <label class="form-label">İşlem Tipi</label>
                        <select class="form-select" id="import-tx-type">
                            <option value="auto" selected>✨ Otomatik Algıla (İşçilik & Malzeme Karma)</option>
                            <option value="malzeme">Tüm Satırlar: Malzeme Gideri</option>
                            <option value="iscilik">Tüm Satırlar: İşçilik Gideri</option>
                            <option value="ofis-sabit">Tüm Satırlar: Ofis Sabit Gideri</option>
                        </select>
                    </div>
                    <div class="form-group" style="margin-bottom:0">
                        <label class="form-label">Gider Durumu (Tutar Tipi)</label>
                        <select class="form-select" id="import-cost-mode">
                            <option value="agreed" selected>Anlaşılan Maliyet (Rakamlar Aynen Aktarılır)</option>
                            <option value="estimated">Sadece Bütçe Tahmini (Anlaşılan Tutar 0 ₺)</option>
                        </select>
                    </div>
                </div>
                <div class="import-mapping-row" style="margin-top:10px;">
                    <div class="form-group" style="flex:1; margin-bottom:0">
                        <label class="form-label">Varsayılan Vade</label>
                        <input class="form-input" type="date" id="import-due-date" value="">
                    </div>
                    ${periodSelectHtml}
                </div>
            </div>

            <table class="import-preview-table">
                <thead><tr>${headers.map(h => `<th>${escapeHtml(h)}</th>`).join('')}</tr></thead>
                <tbody>
                    ${previewRows.map(row => `<tr>${headers.map(h => {
                        const isAmt = (h === amountCol);
                        return `<td class="${isAmt ? 'col-amount' : ''}">${escapeHtml(row[h] || '')}</td>`;
                    }).join('')}</tr>`).join('')}
                </tbody>
            </table>
            ${totalRows > 8 ? `<div class="import-more-rows">... ve ${totalRows - 8} satır daha</div>` : ''}

            <div class="import-summary" id="import-summary">
                Toplam: ${formatCurrency(totalAmount)} · ${totalRows} kalem · Durum: Bekliyor
            </div>

            <div class="form-actions">
                <button type="button" class="btn btn-outline" onclick="App.closeModal()">İptal</button>
                <button type="button" class="btn btn-primary" onclick="App.executeCsvImport()">📊 ${totalRows} Kalemi İçe Aktar</button>
            </div>
        `;

        openModal('📊 Maliyet Tablosu İçe Aktar', html);

        const updateSummary = () => {
            const amtCol = document.getElementById('import-col-amount').value;
            const total = csvParsedRows.reduce((s, r) => s + parseTurkishNumber(r[amtCol]), 0);
            document.getElementById('import-summary').textContent =
                `Toplam: ${formatCurrency(total)} · ${csvParsedRows.length} kalem · Durum: Bekliyor`;
        };
        setTimeout(() => {
            const amtSelect = document.getElementById('import-col-amount');
            if (amtSelect) amtSelect.addEventListener('change', updateSummary);
        }, 50);
    }

    function executeCsvImport() {
        if (!currentProjectId || csvParsedRows.length === 0) return;

        const descCol = document.getElementById('import-col-desc').value;
        const amountCol = document.getElementById('import-col-amount').value;
        const txTypeSetting = document.getElementById('import-tx-type').value;
        const costMode = document.getElementById('import-cost-mode')?.value || 'agreed';
        const dueDate = document.getElementById('import-due-date').value || '';

        const periodEl = document.getElementById('import-tx-period');
        const period = periodEl ? parseInt(periodEl.value) || 0 : 0;

        let importCount = 0;
        let totalImported = 0;
        let labourCount = 0;
        let materialCount = 0;

        const headers = csvHeaders;
        const { typeCol } = autoDetectColumns(headers, csvParsedRows);

        csvParsedRows.forEach(row => {
            const parsedVal = parseTurkishNumber(row[amountCol]);
            if (parsedVal <= 0) return;

            const desc = (row[descCol] || '').trim() || 'İçe aktarılan kalem';

            let rowType = txTypeSetting;
            if (txTypeSetting === 'auto') {
                rowType = detectRowTxType(row, typeCol, descCol, 'malzeme');
            }

            if (rowType === 'iscilik') labourCount++;
            else materialCount++;

            if (costMode === 'estimated') {
                // Pure estimate
                addTransaction(rowType, currentProjectId, 0, 'bekliyor', dueDate, desc, parsedVal, period);
            } else {
                // Default: Agreed/Actual cost — amount gets parsedVal directly!
                addTransaction(rowType, currentProjectId, parsedVal, 'bekliyor', dueDate, desc, parsedVal, period);
            }

            importCount++;
            totalImported += parsedVal;
        });

        // Cleanup
        csvParsedRows = [];
        csvHeaders = [];

        closeModal();

        if (importCount > 0) {
            const modeText = costMode === 'estimated' ? 'Tahmini Maliyet' : 'Anlaşılan Maliyet';
            const detailText = txTypeSetting === 'auto'
                ? ` (${materialCount} Malzeme, ${labourCount} İşçilik)`
                : '';
            showToast(`${importCount} kalem${detailText} aktarıldı! (${formatCurrency(totalImported)})`, 'success');
            renderProjectDetail(currentProjectId);
        } else {
            showToast('Aktarılacak geçerli tutar bulunamadı.', 'warning');
        }
    }

    // ─────────────────────────────────────
    // EDIT TRANSACTION
    // ─────────────────────────────────────

    function openEditTransaction(txId) {
        const tx = data.transactions.find(t => t.id === txId);
        if (!tx) return;

        const typeInfo = TX_TYPES[tx.type] || {};
        const isExpense = ['malzeme', 'iscilik', 'ofis-sabit'].includes(tx.type);
        const showEstimateField = ['malzeme', 'iscilik'].includes(tx.type);
        const estimatedValFormatted = tx.estimatedAmount > 0 ? tx.estimatedAmount.toLocaleString('tr-TR') : '';
        const amountValFormatted = tx.amount > 0 ? tx.amount.toLocaleString('tr-TR') : '';
        const statusOdendi = tx.paymentStatus === 'odendi' ? 'selected' : '';
        const statusBekliyor = tx.paymentStatus === 'bekliyor' ? 'selected' : '';

        const amountLabel = showEstimateField ? 'Anlaşılan / Fatura Tutarı (₺) <span style="font-weight:400; color:var(--text-muted); text-transform:none; letter-spacing:0;">— opsiyonel</span>' : 'Tutar (₺)';
        const requiredAttr = showEstimateField ? '' : 'required';

        const project = getProject(tx.projectId);
        let periodSelectHtml = '';
        if (project && project.periods && project.periods.length > 0) {
            const options = project.periods.map(p => {
                const selected = tx.period === p.number ? 'selected' : '';
                return `<option value="${p.number}" ${selected}>${escapeHtml(p.label)} (${formatCurrency(p.amount)})</option>`;
            }).join('');
            
            periodSelectHtml = `
                <div class="form-group">
                    <label class="form-label" for="input-tx-period">Ödeme Dönemi</label>
                    <select class="form-select" id="input-tx-period">
                        <option value="0">Dönem Atanmamış</option>
                        ${options}
                    </select>
                </div>
            `;
        }

        const html = `
            <form onsubmit="App.updateTransaction(event, '${txId}')">
                <div class="form-group">
                    <label class="form-label">İşlem Tipi</label>
                    <input class="form-input" type="text" value="${typeInfo.label}" disabled>
                </div>
                ${periodSelectHtml}
                ${showEstimateField ? `
                <div class="form-group">
                    <label class="form-label" for="input-tx-estimated">Tahmini Maliyet (₺) <span style="font-weight:400; color:var(--text-muted); text-transform:none; letter-spacing:0;">— iş başlangıcı bütçe tahmini</span></label>
                    <input class="form-input" type="text" inputmode="numeric" id="input-tx-estimated" value="${estimatedValFormatted}" placeholder="Opsiyonel" oninput="App.formatAmountInput(this)">
                </div>
                ` : ''}
                <div class="form-group">
                    <label class="form-label" for="input-tx-amount">${amountLabel}</label>
                    <input class="form-input" type="text" inputmode="numeric" id="input-tx-amount" value="${amountValFormatted}" ${requiredAttr} oninput="App.formatAmountInput(this)">
                </div>
                <div class="form-group">
                    <label class="form-label" for="input-tx-due-date">Vade Tarihi <span style="font-weight:400; color:var(--text-muted); text-transform:none; letter-spacing:0;">— opsiyonel</span></label>
                    <input class="form-input" type="date" id="input-tx-due-date" value="${tx.dueDate || ''}">
                </div>
                <div class="form-group">
                    <label class="form-label" for="input-tx-description">Açıklama</label>
                    <input class="form-input" type="text" id="input-tx-description" value="${escapeHtml(tx.description || '')}">
                </div>
                <div class="form-group">
                    <label class="form-label" for="input-tx-status">Ödeme Durumu</label>
                    <select class="form-select" id="input-tx-status">
                        <option value="bekliyor" ${statusBekliyor}>Bekliyor</option>
                        <option value="odendi" ${statusOdendi}>Ödendi</option>
                    </select>
                </div>
                <div class="form-actions">
                    <button type="button" class="btn btn-outline" onclick="App.closeModal()">İptal</button>
                    <button type="submit" class="btn btn-primary">Güncelle</button>
                </div>
            </form>
        `;

        openModal('✎ İşlemi Düzenle', html);
    }

    function updateTransaction(e, txId) {
        e.preventDefault();
        const tx = data.transactions.find(t => t.id === txId);
        if (!tx) return;

        const amount = parseAmountInput(document.getElementById('input-tx-amount'));
        const estimatedEl = document.getElementById('input-tx-estimated');
        const estimatedAmount = estimatedEl ? parseAmountInput(estimatedEl) : 0;

        // If it's hakedis, we require amount.
        if (tx.type === 'hakedis' && amount <= 0) {
            showToast('Hakediş tutarı 0\'dan büyük olmalıdır.', 'error');
            return;
        }

        // For expenses, at least one of estimatedAmount or amount must be > 0.
        if (tx.type !== 'hakedis' && amount <= 0 && estimatedAmount <= 0) {
            showToast('Lütfen tahmini maliyet veya anlaşılan tutardan en az birini girin.', 'error');
            return;
        }

        tx.amount = amount;
        tx.description = document.getElementById('input-tx-description').value.trim();
        tx.dueDate = document.getElementById('input-tx-due-date').value || '';
        tx.paymentStatus = document.getElementById('input-tx-status').value;

        const periodEl = document.getElementById('input-tx-period');
        tx.period = periodEl ? parseInt(periodEl.value) || 0 : 0;

        if (estimatedEl) {
            if (estimatedAmount > 0) {
                tx.estimatedAmount = estimatedAmount;
            } else {
                delete tx.estimatedAmount;
            }
        }

        saveData();
        closeModal();
        showToast('İşlem güncellendi.', 'success');

        if (currentProjectId) {
            renderProjectDetail(currentProjectId);
        } else {
            renderDashboard();
        }
    }

    // ─────────────────────────────────────
    // HELPERS
    // ─────────────────────────────────────
    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // ─────────────────────────────────────
    // INITIALIZATION
    // ─────────────────────────────────────
    function init() {
        loadData();
        initCloudSync();

        if (checkTeamPin()) {
            showDashboard();
        }

        // ESC to close modals
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                closeModal();
                cancelConfirm();
            }
        });
    }

    // ─────────────────────────────────────
    // PUBLIC API
    // ─────────────────────────────────────
    return {
        init,
        showDashboard,
        showProject,
        toggleSidebar,
        openNewProject,
        openEditProject,
        saveProject,
        saveProjectDraft,
        cancelProjectForm,
        setPaymentPreset,
        onContractAmountInput,
        onCompletionAmountInput,
        onPeriodCountInput,
        onPeriodAmountInput,
        deleteProject,
        generatePeriodFields,
        validatePeriodSum,
        distributePeriodsEvenly,
        formatAmountInput,
        parseAmountInput,
        formatDate,
        formatDateShort,
        onAmountKeyDown,
        onPayAmountInput,
        onPayModeChange,
        handleOverlayClick,
        openHakedis,
        openMalzeme,
        openIscilik,
        openOfisSabit,
        saveTransaction,
        markAsPaid,
        executePayment,
        openEditTransaction,
        updateTransaction,
        deleteTransaction,
        closeModal,
        executeConfirm,
        cancelConfirm,
        exportData,
        importData,
        handleCsvImport,
        executeCsvImport,
        resetData,
        processReset,
        openChangeResetPasswordModal,
        saveResetPassword,
        verifyTeamPin,
        openPinSettingsModal,
        savePinSettings
    };

})();

// Boot
document.addEventListener('DOMContentLoaded', () => App.init());
