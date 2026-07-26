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
        hakedis:            { label: 'Müşteri Ödemesi',             icon: '💰', direction: 'income',  cssClass: 'income' },
        malzeme:            { label: 'Malzeme',                     icon: '🧱', direction: 'expense', cssClass: 'expense' },
        iscilik:            { label: 'İşçilik Gideri (Usta)',       icon: '👷', direction: 'expense', cssClass: 'expense' },
        'iscilik-malzeme':  { label: 'İşçilik + Malzeme (Taşeron)', icon: '🛠️', direction: 'expense', cssClass: 'expense' },
        'ilave-is':         { label: 'Müşteri İlave İşi (Ek Sözleşme)', icon: '✨', direction: 'expense', cssClass: 'expense' },
        'ofis-sabit':       { label: 'Ofis Sabit Gideri',         icon: '🏢', direction: 'expense', cssClass: 'ofis' },
        'borc-ver':         { label: 'Proje Borç Verme',           icon: '↗️', direction: 'expense', cssClass: 'loan-out' },
        'borc-al':          { label: 'Proje Borç Alma',            icon: '↙️', direction: 'income',  cssClass: 'loan-in' }
    };

    const STATUS_LABELS = {
        odendi:   'Kapatıldı / Ödendi',
        bekliyor: 'Bekliyor'
    };

    const PROJECT_STATUS = {
        'hazirlik':     '📝 Taslak / Bütçeleme',
        'devam-ediyor': '🏁 Sözleşmeli Aktif Proje',
        'tamamlandi':   '✅ Tamamlandı / Teslim Edildi'
    };

    const PRESET_WORK_CATEGORIES = [
        { name: 'Beton Kalıp', icon: '🏗️', keywords: ['beton', 'kalıp', 'kalip', 'demirc'] },
        { name: 'Tesisat', icon: '🚰', keywords: ['tesisat', 'su tesisat', 'su boru', 'lavabo', 'gider'] },
        { name: 'Yerden Isıtma', icon: '♨️', keywords: ['yerden ısıtma', 'yerden isitma', 'alttan ısıtma'] },
        { name: 'Parke', icon: '🪵', keywords: ['parke', 'laminat', 'ahşap zemin', 'ahsap zemin'] },
        { name: 'İç Kapı', icon: '🚪', keywords: ['kapı', 'kapi', 'iç kapı', 'ic kapi', 'amerikan kapı'] },
        { name: 'Seramik', icon: '🔲', keywords: ['seramik', 'fayans', 'granit', 'kalebodur'] },
        { name: "20'lik duvar", icon: '🧱', keywords: ['20\'lik', 'tuğla', 'tugla', 'bims'] },
        { name: "10'luk duvar", icon: '🧱', keywords: ['10\'luk'] },
        { name: 'Örülecek duvar', icon: '🧱', keywords: ['duvar', 'örülecek', 'orulecek', 'gazbeton'] },
        { name: 'Kırım', icon: '🔨', keywords: ['kırım', 'kirim', 'yıkım', 'yikim', 'söküm', 'sokum', 'hafriyat', 'harfiyat'] },
        { name: 'Şap', icon: '🪨', keywords: ['şap', 'sap'] },
        { name: 'Kum çimento', icon: '🪨', keywords: ['kum', 'çimento', 'cimento', 'harç', 'harc'] },
        { name: 'Mutfak', icon: '🍳', keywords: ['mutfak', 'mutfak dolabı', 'mutfak dolabi'] },
        { name: 'Banyo dolabı', icon: '🛁', keywords: ['banyo', 'banyo dolabı', 'banyo dolabi', 'duşa kabin', 'dusakabin'] },
        { name: 'Vestiyer', icon: '👔', keywords: ['vestiyer', 'portmanto', 'gardırop', 'gardrop'] },
        { name: 'Tezgah', icon: '🍽️', keywords: ['tezgah', 'çimstone', 'cimstone', 'mermer'] },
        { name: 'Çatı Tamiri', icon: '🏠', keywords: ['çatı tamir', 'cati tamir', 'tamir'] },
        { name: 'Çatı Yapılması', icon: '🛖', keywords: ['çatı', 'cati', 'izolasyon', 'membran'] },
        { name: 'Dış Cephe', icon: '🏢', keywords: ['dış cephe', 'dis cephe', 'mantolama', 'sıva', 'siva'] },
        { name: 'Elektrik', icon: '⚡', keywords: ['elektrik', 'kablo', 'anahtar', 'priz', 'sigorta', 'aydınlatma', 'spot'] },
        { name: 'Alçı Boya', icon: '🎨', keywords: ['alçı', 'alci', 'boya', 'badan', 'saten', 'alçıpan', 'alcipan'] },
        { name: 'Doğrama (Pencere)', icon: '🪟', keywords: ['doğrama', 'dograma', 'pencere', 'pvc', 'pimapen', 'cam'] },
        { name: 'Isı pompası', icon: '🌡️', keywords: ['ısı pompası', 'isi pompasi', 'pompa'] },
        { name: 'Şofben vs', icon: '🔥', keywords: ['şofben', 'sofben', 'kombi', 'termosifon'] },
        { name: 'Merdiven', icon: '🪜', keywords: ['merdiven', 'küpeşte', 'kupeste', 'basamak'] }
    ];

    function getWorkCategoryIcon(text) {
        if (!text || typeof text !== 'string') return '';
        const lower = text.toLowerCase().trim();
        for (const cat of PRESET_WORK_CATEGORIES) {
            if (cat.keywords.some(kw => lower.includes(kw))) {
                return cat.icon;
            }
        }
        return '';
    }

    function getDescriptionSuggestionsHtml() {
        const set = new Set();
        PRESET_WORK_CATEGORIES.forEach(c => set.add(c.name));
        if (data && Array.isArray(data.transactions)) {
            data.transactions.forEach(t => {
                if (t.description && typeof t.description === 'string' && t.description.trim()) {
                    set.add(t.description.trim());
                }
            });
        }
        const items = Array.from(set);
        return `
            <datalist id="description-suggestions-list">
                ${items.map(name => `<option value="${escapeHtml(name)}">`).join('')}
            </datalist>
        `;
    }

    const MONTHS_TR = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
    const MONTHS_FULL_TR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
    const DAYS_TR = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];

    // ─────────────────────────────────────
    // STATE
    // ─────────────────────────────────────
    let data = { projects: [], transactions: [] };
    let currentProjectId = null;
    let confirmCallback = null;
    let activeSortMode = localStorage.getItem('zebraActiveSortMode') || 'date';

    function setActiveTxSort(mode) {
        activeSortMode = mode;
        try { localStorage.setItem('zebraActiveSortMode', mode); } catch (e) {}
        if (currentProjectId) {
            renderProjectDetail(currentProjectId);
        }
    }

    // ─────────────────────────────────────
    // DATA LAYER — Storage
    // ─────────────────────────────────────
    function loadData() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                data = JSON.parse(raw);
                if (!Array.isArray(data.projects)) data.projects = [];
                if (!Array.isArray(data.transactions)) data.transactions = [];

                // ── MIGRATION v2: Merge legacy "Kısmi Tahsilat" duplicates ──
                // Old executePayment created SEPARATE paid transactions for partial payments
                // AND reduced the original's amount. We need to:
                //  1. Find those duplicates (description contains "Kısmi Tahsilat")
                //  2. Add their amounts back to the parent's payments[] array
                //  3. Restore the parent's original amount
                //  4. Remove the duplicates
                if (!data._migrated_v2) {
                    const duplicateIds = new Set();
                    const parentAdjustments = new Map(); // parentKey -> [{amount, date, createdBy}]

                    data.transactions.forEach(t => {
                        if (t.description && t.paymentStatus === 'odendi') {
                            const kısmiMatch = t.description.match(/Kısmi Tahsilat\s*\/?\s*Ödenen:\s*[₺\s]*([\d.,]+)/i);
                            if (kısmiMatch) {
                                // This is a legacy duplicate — find its parent by matching type+projectId+period
                                const parentKey = `${t.projectId}_${t.type}_${t.period || 0}`;
                                if (!parentAdjustments.has(parentKey)) parentAdjustments.set(parentKey, []);
                                parentAdjustments.get(parentKey).push({
                                    amount: t.amount,
                                    date: t.dueDate || (t.createdAt ? t.createdAt.split('T')[0] : todayStr()),
                                    createdBy: t.createdBy || 'Mimar / Yönetici'
                                });
                                duplicateIds.add(t.id);
                            }
                        }
                    });

                    if (duplicateIds.size > 0) {
                        // For each parent transaction that was reduced, restore its original amount
                        // and add payments from the duplicates
                        data.transactions.forEach(t => {
                            if (duplicateIds.has(t.id)) return; // Skip duplicates themselves
                            const parentKey = `${t.projectId}_${t.type}_${t.period || 0}`;
                            const adjustments = parentAdjustments.get(parentKey);
                            if (adjustments && t.paymentStatus === 'bekliyor') {
                                // Restore original amount: current reduced amount + sum of partial payments
                                const paidFromDuplicates = adjustments.reduce((s, a) => s + a.amount, 0);
                                t.amount = t.amount + paidFromDuplicates;
                                t.paidAmount = paidFromDuplicates;
                                t.payments = adjustments.map(a => ({
                                    id: generateId(),
                                    amount: a.amount,
                                    date: a.date,
                                    createdBy: a.createdBy
                                }));
                                // Clean up description
                                if (t.description) {
                                    t.description = t.description
                                        .replace(/\s*\(Eksik Kalan Miktar:.*?\)/g, '')
                                        .replace(/\s*\(Kısmi Ödeme Yapıldı\)/g, '')
                                        .replace(/\s*\(Eksik Kalan Bakiye\)/g, '')
                                        .replace(/^Geçkmiş\s*—\s*/i, '')
                                        .replace(/^Geçmiş\s*—\s*/i, '')
                                        .trim();
                                }
                                // Remove the parentKey so we don't double-process
                                parentAdjustments.delete(parentKey);
                            }
                        });

                        // Remove the duplicate transactions
                        data.transactions = data.transactions.filter(t => !duplicateIds.has(t.id));
                    }

                    data._migrated_v2 = true;
                    // Save migration result
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
                }

                // Basic field migration for any remaining transactions
                data.transactions.forEach(t => {
                    if (t.paidAmount === undefined) {
                        t.paidAmount = t.paymentStatus === 'odendi' ? t.amount : 0;
                    }
                    if (!Array.isArray(t.payments)) {
                        t.payments = t.paidAmount > 0 ? [{ id: generateId(), amount: t.paidAmount, date: t.createdAt ? t.createdAt.split('T')[0] : todayStr(), createdBy: t.createdBy || 'Mimar / Yönetici' }] : [];
                    }
                    if (!t.createdBy) {
                        t.createdBy = 'Mimar / Yönetici';
                    }
                });
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
    const USER_NAME_KEY = 'zebra_user_name';

    function getUserName() {
        return localStorage.getItem(USER_NAME_KEY) || 'Mimar / Yönetici';
    }

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
        const currentUser = getUserName();
        if (status === 'connected') {
            badge.innerHTML = `
                <span style="display:flex; align-items:center; gap:6px; font-weight:700; color:var(--success);">
                    <span class="dot safe" style="background:#10b981; width:8px; height:8px; display:inline-block; border-radius:50%;"></span>
                    🟢 Bulut Canlı · 👤 ${escapeHtml(currentUser)}
                </span>
                <span style="font-size:0.7rem; color:var(--text-muted);">🔑 Ayarlar</span>
            `;
        } else {
            badge.innerHTML = `
                <span style="display:flex; align-items:center; gap:6px; font-weight:700; color:var(--warning);">
                    <span class="dot" style="background:#f59e0b; width:8px; height:8px; display:inline-block; border-radius:50%;"></span>
                    🟡 Yerel Kayıt · 👤 ${escapeHtml(currentUser)}
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
        const currentUser = getUserName();
        const html = `
            <div class="import-info" style="margin-bottom: 15px;">
                🔑 <strong>Kullanıcı Adı & Bulut PIN Ayarları</strong><br>
                İşlem geçmişinde ve yapılan ödemelerde adınızın görünmesi için kullanıcı adınızı belirleyin.
            </div>
            <div class="form-group" style="margin-bottom: 14px;">
                <label class="form-label" for="setting-user-name">👤 Kullanıcı Adınız / Unvanınız</label>
                <input class="form-input" type="text" id="setting-user-name" placeholder="Örn: Mimar Mutlu, Şantiye Şefi Ali" value="${escapeHtml(currentUser)}">
            </div>
            <div class="form-group">
                <label class="form-label" for="setting-team-pin">🔐 Ekip PIN Kodu (Boş bırakılırsa şifresiz açılır)</label>
                <input class="form-input" type="text" id="setting-team-pin" placeholder="Örn: 1234" value="${escapeHtml(currentPin)}">
            </div>
            <div class="form-actions">
                <button type="button" class="btn btn-outline" onclick="App.closeModal()">İptal</button>
                <button type="button" class="btn btn-primary" onclick="App.savePinSettings()">✓ Ayarları Kaydet</button>
            </div>
        `;
        openModal('🔑 Kullanıcı & PIN Ayarları', html);
    }

    function savePinSettings() {
        const userName = document.getElementById('setting-user-name')?.value.trim() || 'Mimar / Yönetici';
        const newPin = document.getElementById('setting-team-pin')?.value.trim() || '';

        localStorage.setItem(USER_NAME_KEY, userName);

        if (newPin) {
            localStorage.setItem(PIN_KEY, newPin);
            sessionStorage.setItem('zebra_pin_unlocked', 'true');
            showToast(`Kullanıcı: ${userName} · PIN güncellendi`, 'success');
        } else {
            localStorage.removeItem(PIN_KEY);
            showToast(`Kullanıcı: ${userName} kaydedildi.`, 'info');
        }
        closeModal();
        if (currentProjectId) renderProjectDetail(currentProjectId);
        else renderDashboard();
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
            periodCount: (periodCount !== undefined && periodCount !== null && !isNaN(periodCount)) ? parseInt(periodCount, 10) : 0,
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
        project.periodCount = (periodCount !== undefined && periodCount !== null && !isNaN(periodCount)) ? parseInt(periodCount, 10) : 0;
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

    function isContractSigned(projectOrId) {
        const project = typeof projectOrId === 'object' ? projectOrId : getProject(projectOrId);
        if (!project) return false;
        return project.status === 'devam-ediyor' || project.status === 'tamamlandi' || project.contractSigned === true;
    }

    function getProjectContractAmount(projectOrId) {
        const project = typeof projectOrId === 'object' ? projectOrId : getProject(projectOrId);
        if (!project) return 0;
        const base = parseFloat(project.contractAmount) || 0;
        const addonsFromTx = data.transactions
            .filter(t => t.projectId === project.id && (t.type === 'ilave-is' || t.scopeType === 'ilave-is'))
            .reduce((sum, t) => sum + (parseFloat(t.clientAddonAmount) || 0), 0);
        const addonsFromAddons = Array.isArray(project.contractAddons)
            ? project.contractAddons.reduce((sum, a) => sum + (parseFloat(a.clientAmount) || 0), 0)
            : 0;
        return base + addonsFromTx + addonsFromAddons;
    }

    function getProjectBaseContractAmount(projectOrId) {
        const project = typeof projectOrId === 'object' ? projectOrId : getProject(projectOrId);
        return project ? (parseFloat(project.contractAmount) || 0) : 0;
    }

    function getProjectAddonContractAmount(projectOrId) {
        const project = typeof projectOrId === 'object' ? projectOrId : getProject(projectOrId);
        if (!project) return 0;
        const addonsFromTx = data.transactions
            .filter(t => t.projectId === project.id && (t.type === 'ilave-is' || t.scopeType === 'ilave-is'))
            .reduce((sum, t) => sum + (parseFloat(t.clientAddonAmount) || 0), 0);
        const addonsFromAddons = Array.isArray(project.contractAddons)
            ? project.contractAddons.reduce((sum, a) => sum + (parseFloat(a.clientAmount) || 0), 0)
            : 0;
        return addonsFromTx + addonsFromAddons;
    }

    function signContract(projectId) {
        const project = getProject(projectId);
        if (!project) return;
        showConfirm(
            '🏁 Sözleşmeyi İmzala & İşe Başla',
            `<strong>"${escapeHtml(project.name)}"</strong> projesinin sözleşmesi resmen imzalandı olarak işaretlenecek ve başlangıç bütçesi dondurulacak.<br><br>Şantiye sürecinde girilen yeni şantiye harcamalarında tahmini maliyet otomatik 0 ₺ kabul edilecek. Devam edilsin mi?`,
            () => {
                project.status = 'devam-ediyor';
                project.contractSigned = true;
                project.signedAt = todayStr();
                saveData();
                showToast('🏁 Sözleşme resmen imzalandı! Başlangıç bütçesi donduruldu.', 'success');
                renderProjectDetail(projectId);
            }
        );
    }

    // ─────────────────────────────────────
    // DATA LAYER — CRUD: Transactions
    // ─────────────────────────────────────
    function getTxPaidAmount(tx) {
        if (!tx) return 0;
        if (tx.paymentStatus === 'odendi') return tx.amount;
        return parseFloat(tx.paidAmount) || 0;
    }

    function getTxRemainingAmount(tx) {
        if (!tx) return 0;
        if (tx.paymentStatus === 'odendi') return 0;
        const paid = getTxPaidAmount(tx);
        return Math.max(0, tx.amount - paid);
    }

    function addTransaction(type, projectId, amount, paymentStatus, dueDate, description, estimatedAmount, period, vendor, scopeType, clientAddonAmount) {
        const currentUser = getUserName();
        const amtVal = parseFloat(amount) || 0;
        const isPaid = (paymentStatus === 'odendi');
        const project = getProject(projectId);
        const signed = isContractSigned(project);

        let finalScopeType = scopeType;
        if (!finalScopeType) {
            if (type === 'ilave-is') {
                finalScopeType = 'ilave-is';
            } else if (signed && ['malzeme', 'iscilik', 'iscilik-malzeme', 'ofis-sabit'].includes(type)) {
                finalScopeType = 'santiye-ici';
            } else {
                finalScopeType = 'sözleşme';
            }
        }

        let finalEstimated = estimatedAmount;
        if (finalScopeType === 'santiye-ici') {
            finalEstimated = 0;
        }

        const tx = {
            id: generateId(),
            type,
            projectId,
            amount: amtVal,
            paidAmount: isPaid ? amtVal : 0,
            paymentStatus: paymentStatus || 'bekliyor',
            dueDate: dueDate || '',
            description: (description || '').trim(),
            vendor: (vendor || '').trim(),
            period: (typeof period === 'string' && period.startsWith('ilave-')) ? period : (parseInt(period) || 0),
            scopeType: finalScopeType,
            createdBy: currentUser,
            createdAt: new Date().toISOString(),
            payments: isPaid && amtVal > 0 ? [{ id: generateId(), amount: amtVal, date: todayStr(), createdBy: currentUser }] : []
        };

        if (finalScopeType === 'ilave-is' && clientAddonAmount !== undefined && clientAddonAmount !== null) {
            tx.clientAddonAmount = parseFloat(clientAddonAmount) || 0;
        }

        if (finalEstimated !== undefined && finalEstimated !== null && finalEstimated !== '') {
            tx.estimatedAmount = parseFloat(finalEstimated) || 0;
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

    /** Sum of realized income for a project.
     *  - hakedis: only when paid (odendi)
     *  - borc-al: ALWAYS (money was received immediately, bekliyor = not yet repaid)
     */
    function getProjectIncome(projectId) {
        return data.transactions
            .filter(t => t.projectId === projectId)
            .reduce((sum, t) => {
                if (t.type === 'hakedis' && t.paymentStatus === 'odendi') return sum + t.amount;
                if (t.type === 'borc-al') return sum + t.amount; // Loan received = immediate income
                return sum;
            }, 0);
    }

    /** Sum of realized expenses for a project.
     *  - malzeme/iscilik/ofis-sabit: actual paid amounts (partial payments supported)
     *  - borc-ver: actual paid amounts
     *  - borc-al repayments: payments[] on borc-al count as expenses (money leaving)
     */
    function getProjectExpense(projectId) {
        const expenseTypes = ['malzeme', 'iscilik', 'iscilik-malzeme', 'ofis-sabit', 'borc-ver'];
        return data.transactions
            .filter(t => t.projectId === projectId)
            .reduce((sum, t) => {
                if (expenseTypes.includes(t.type)) return sum + getTxPaidAmount(t);
                if (t.type === 'borc-al') return sum + getTxPaidAmount(t); // Repayments = expense
                return sum;
            }, 0);
    }

    /** Current cash balance for a project */
    function getProjectBalance(projectId) {
        return getProjectIncome(projectId) - getProjectExpense(projectId);
    }

    /**
     * Resolves the effective due date for a transaction.
     * 1. Uses explicit tx.dueDate if set.
     * 2. If assigned to a period with a valid date, uses period.date.
     * 3. If assigned to İş Bitimi or a period without a date, returns '' (matches that period, not immediate 30-day risk).
     * 4. Only if unassigned to any period (period = 0) and pending, defaults to createdAt/today.
     */
    function getTxDueDate(tx) {
        if (tx.dueDate) return tx.dueDate;
        if (tx.period && tx.period > 0) {
            const project = getProject(tx.projectId);
            if (project && project.periods && Array.isArray(project.periods)) {
                const pObj = project.periods.find(p => p.number === tx.period);
                if (pObj) {
                    if (pObj.date) return pObj.date;
                    // If assigned to a period (e.g. İş Bitimi or Ara Ödeme) without an explicit date,
                    // it belongs to that specific period's cash flow, NOT immediate 30-day risk!
                    return '';
                }
            }
        }
        if (tx.paymentStatus === 'bekliyor') {
            return tx.createdAt ? tx.createdAt.split('T')[0] : todayStr();
        }
        return '';
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

        const expenseTypes = ['malzeme', 'iscilik', 'iscilik-malzeme', 'ofis-sabit', 'borc-al'];
        return data.transactions
            .filter(t => {
                if (t.projectId !== projectId) return false;
                if (!expenseTypes.includes(t.type)) return false;
                if (t.paymentStatus !== 'bekliyor') return false;
                const dueDateStr = getTxDueDate(t);
                if (!dueDateStr) return false;
                const due = new Date(dueDateStr);
                due.setHours(0, 0, 0, 0);
                return due <= limit;
            })
            .reduce((sum, t) => sum + getTxRemainingAmount(t), 0);
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
        const expenseTypes = ['malzeme', 'iscilik', 'iscilik-malzeme', 'ofis-sabit'];
        return data.transactions
            .filter(t => t.projectId === projectId && expenseTypes.includes(t.type))
            .reduce((sum, t) => sum + (t.estimatedAmount > 0 ? t.estimatedAmount : t.amount), 0);
    }

    /** Güncel toplam maliyet: tüm giderlerin gerçek/anlaşılan tutarları */
    function getProjectCurrentCost(projectId) {
        const expenseTypes = ['malzeme', 'iscilik', 'iscilik-malzeme', 'ofis-sabit'];
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
        const expenseTypes = ['malzeme', 'iscilik', 'iscilik-malzeme', 'ofis-sabit'];
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

        const expenseTypes = ['malzeme', 'iscilik', 'iscilik-malzeme', 'ofis-sabit', 'borc-al'];
        return data.transactions
            .filter(t => {
                if (!expenseTypes.includes(t.type)) return false;
                if (t.paymentStatus !== 'bekliyor') return false;
                if (getTxRemainingAmount(t) <= 0) return false; // Fully paid but status not updated
                const dueDateStr = getTxDueDate(t);
                if (!dueDateStr) return false;
                const due = new Date(dueDateStr);
                due.setHours(0, 0, 0, 0);
                return due <= limit;
            })
            .sort((a, b) => new Date(getTxDueDate(a)) - new Date(getTxDueDate(b)));
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
        // Scroll to top
        window.scrollTo(0, 0);
        const mainContent = document.querySelector('.main-content');
        if (mainContent) mainContent.scrollTop = 0;
    }

    function showDashboard() {
        currentProjectId = null;
        showView('view-dashboard');
        renderDashboard();
        // Update nav active state
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        const dashNav = document.getElementById('nav-dashboard');
        if (dashNav) dashNav.classList.add('active');
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
        const riskLabel = riskCard ? riskCard.querySelector('.risk-label') : null;
        riskAmount.textContent = formatCurrency(totalRisk);
        riskCard.className = 'risk-card ' + (totalRisk >= 0 ? 'risk-positive' : 'risk-negative pulse-danger');
        if (riskLabel) {
            riskLabel.textContent = totalRisk >= 0 ? '30 Günlük Tahmini Bakiye — Tüm Projeler' : '30 Günlük Riskli Bakiye — Tüm Projeler';
        }

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
            const remaining = getTxRemainingAmount(tx);
            const paidAmt = getTxPaidAmount(tx);
            const isPartial = paidAmt > 0 && remaining > 0;

            // Partial payment indicator
            let partialBadge = '';
            if (isPartial) {
                const pct = Math.round((paidAmt / tx.amount) * 100);
                partialBadge = `<span style="font-size:0.65rem; padding:2px 6px; border-radius:4px; background:rgba(245,158,11,0.15); color:#f59e0b; font-weight:700; white-space:nowrap;">⚠️ %${pct} ödendi</span>`;
            }

            const workIcon = getWorkCategoryIcon(tx.description);
            const descWithIcon = workIcon ? `${workIcon} ${escapeHtml(tx.description || typeInfo.label)}` : escapeHtml(tx.description || typeInfo.label);

            return `
                <div class="payment-item ${overdue ? 'overdue' : ''}" onclick="App.showProject('${tx.projectId}')" style="cursor:pointer;" title="Projeye git: ${project ? escapeHtml(project.name) : ''}">
                    <div class="payment-date">
                        <div class="payment-date-day">${ds.day}</div>
                        <div class="payment-date-month">${ds.month}</div>
                        <div style="font-size:0.65rem; color:var(--text-muted); font-weight:600; text-transform:uppercase; margin-top:2px;">${ds.dayName || ''}</div>
                    </div>
                    <div class="payment-info">
                        <div class="payment-desc">${descWithIcon}${tx.vendor ? `<span style="font-size:0.75rem; font-weight:700; color:var(--accent); margin-left:6px;">🏢 ${escapeHtml(tx.vendor)}</span>` : ''}</div>
                        <div class="payment-project">${project ? escapeHtml(project.name) : '—'} · <span style="color:var(--text-secondary); font-size:0.75rem;">${formatDate(tx.dueDate)}</span></div>
                        ${isPartial ? `<div style="font-size:0.7rem; margin-top:3px; color:var(--text-muted);">Toplam: ${formatCurrency(tx.amount)} · Ödenen: ${formatCurrency(paidAmt)}</div>` : ''}
                    </div>
                    <span class="payment-type-badge">${typeInfo.label || tx.type}</span>
                    ${partialBadge}
                    ${overdue ? '<span class="payment-overdue-badge">Gecikmiş</span>' : ''}
                    <span class="payment-amount">-${formatCurrency(remaining)}</span>
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
        
        const totalContract = getProjectContractAmount(projectId);
        const baseContract = getProjectBaseContractAmount(projectId);
        const addonContract = getProjectAddonContractAmount(projectId);

        const contractEl = document.getElementById('detail-contract-amount');
        if (contractEl) {
            if (addonContract > 0) {
                contractEl.innerHTML = `
                    ${formatCurrency(totalContract)}
                    <span style="font-size:0.72rem; font-weight:600; color:var(--text-muted); font-family:sans-serif; display:block; margin-top:2px;">
                        (Orijinal: ${formatCurrency(baseContract)} + Ek Sözleşmeler: +${formatCurrency(addonContract)})
                    </span>
                `;
            } else {
                contractEl.textContent = formatCurrency(totalContract);
            }
        }

        const statusBadge = document.getElementById('detail-status-badge');
        if (statusBadge) {
            if (project.status === 'hazirlik') {
                statusBadge.innerHTML = `
                    📝 Taslak / Bütçeleme
                    <button type="button" class="btn btn-xs btn-success" onclick="App.signContract('${projectId}')" style="margin-left:8px; font-weight:700;">🏁 Sözleşmeyi İmzala & İşe Başla</button>
                `;
                statusBadge.className = 'badge badge-warning';
            } else if (project.status === 'tamamlandi') {
                statusBadge.textContent = '✅ Tamamlandı';
                statusBadge.className = 'badge badge-muted';
            } else {
                statusBadge.textContent = '🏁 Sözleşmeli Aktif Proje';
                statusBadge.className = 'badge badge-success';
            }
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
        const riskLabel = riskCard ? riskCard.querySelector('.risk-label') : null;
        riskAmount.textContent = formatCurrency(risk);
        riskCard.className = 'risk-card compact ' + (risk >= 0 ? 'risk-positive' : 'risk-negative pulse-danger');
        if (riskLabel) {
            riskLabel.textContent = risk >= 0 ? '30 Günlük Tahmini Bakiye' : '30 Günlük Riskli Bakiye';
        }

        // Müşteri Cari Mutabakat Ekstresi & Kârlılık Analizi
        renderProfitability(projectId);

        // Period cash flow table
        renderPeriodFlow(projectId);

        // Transactions list
        renderProjectTransactions(projectId);
    }

    function getClientStatement(projectId) {
        const project = getProject(projectId);
        if (!project) return null;

        const baseContract = getProjectBaseContractAmount(projectId);
        const addonContract = getProjectAddonContractAmount(projectId);
        const totalContract = getProjectContractAmount(projectId);

        const hakedisTxs = data.transactions.filter(t => t.projectId === projectId && t.type === 'hakedis' && t.paymentStatus === 'odendi');

        let mainPaid = 0;
        let addonPaid = 0;

        hakedisTxs.forEach(t => {
            if (t.period && typeof t.period === 'string' && t.period.startsWith('ilave-')) {
                addonPaid += t.amount;
            } else {
                mainPaid += t.amount;
            }
        });

        const mainRemaining = Math.max(0, baseContract - mainPaid);
        const addonRemaining = Math.max(0, addonContract - addonPaid);
        const totalPaid = mainPaid + addonPaid;
        const totalRemaining = Math.max(0, totalContract - totalPaid);

        return {
            baseContract,
            addonContract,
            totalContract,
            mainPaid,
            addonPaid,
            totalPaid,
            mainRemaining,
            addonRemaining,
            totalRemaining
        };
    }

    function renderClientStatement(projectId) {
        const stmt = getClientStatement(projectId);
        if (!stmt) return '';

        return `
            <div class="card" style="margin-bottom:14px; background:linear-gradient(135deg, rgba(30,41,59,0.7), rgba(15,23,42,0.8)); border:1px solid rgba(99,102,241,0.25);">
                <div style="padding:10px 14px; border-bottom:1px solid var(--glass-border); display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px;">
                    <span style="font-weight:700; font-size:0.82rem; color:#ffffff; display:flex; align-items:center; gap:8px;">
                        🏛️ Müşteri Cari Mutabakat Ekstresi (Ana Sözleşme vs İlave İşler)
                    </span>
                    <span class="badge badge-primary" style="font-size:0.68rem; font-weight:700;">Live Statement</span>
                </div>
                <div style="padding:12px 14px;">
                    <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:10px;">
                        <div style="background:rgba(255,255,255,0.03); padding:10px 12px; border-radius:8px; border:1px solid var(--glass-border);">
                            <div style="color:var(--text-muted); font-size:0.7rem; font-weight:700; text-transform:uppercase;">🏛️ Ana Sözleşme</div>
                            <div style="font-size:1.05rem; font-weight:800; color:#ffffff; margin-top:2px;">${formatCurrency(stmt.baseContract)}</div>
                            <div style="font-size:0.72rem; color:var(--success); margin-top:4px;">Tahsil Edilen: ${formatCurrency(stmt.mainPaid)}</div>
                            <div style="font-size:0.75rem; color:${stmt.mainRemaining > 0 ? '#f59e0b' : 'var(--success)'}; font-weight:800; margin-top:2px;">Kalan Borç: ${formatCurrency(stmt.mainRemaining)}</div>
                        </div>
                        <div style="background:rgba(245,158,11,0.06); padding:10px 12px; border-radius:8px; border:1px solid rgba(245,158,11,0.2);">
                            <div style="color:#f59e0b; font-size:0.7rem; font-weight:700; text-transform:uppercase;">✨ İlave İşler Toplamı</div>
                            <div style="font-size:1.05rem; font-weight:800; color:#ffffff; margin-top:2px;">${formatCurrency(stmt.addonContract)}</div>
                            <div style="font-size:0.72rem; color:var(--success); margin-top:4px;">Tahsil Edilen: ${formatCurrency(stmt.addonPaid)}</div>
                            <div style="font-size:0.75rem; color:${stmt.addonRemaining > 0 ? '#f59e0b' : 'var(--success)'}; font-weight:800; margin-top:2px;">Kalan Borç: ${formatCurrency(stmt.addonRemaining)}</div>
                        </div>
                        <div style="background:rgba(99,102,241,0.08); padding:10px 12px; border-radius:8px; border:1px solid rgba(99,102,241,0.25);">
                            <div style="color:var(--accent); font-size:0.7rem; font-weight:700; text-transform:uppercase;">💰 Toplam Müşteri Borcu</div>
                            <div style="font-size:1.05rem; font-weight:800; color:#ffffff; margin-top:2px;">${formatCurrency(stmt.totalContract)}</div>
                            <div style="font-size:0.72rem; color:var(--success); margin-top:4px;">Toplam Tahsilat: ${formatCurrency(stmt.totalPaid)}</div>
                            <div style="font-size:0.75rem; color:${stmt.totalRemaining > 0 ? 'var(--danger)' : 'var(--success)'}; font-weight:800; margin-top:2px;">Net Alacak: ${formatCurrency(stmt.totalRemaining)}</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
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
        const paidExpenseTotal = expenseTxs.reduce((sum, t) => sum + getTxPaidAmount(t), 0);
        const agreedExpenseRemaining = Math.max(0, agreedExpenseTotal - paidExpenseTotal);

        container.innerHTML = `
            ${renderClientStatement(projectId)}
            <div class="profit-card">
                <div class="profit-card-title" onclick="this.parentElement.classList.toggle('collapsed')" style="cursor:pointer; user-select:none; display:flex; align-items:center; justify-content:space-between;">
                    <span style="display:flex; align-items:center; gap:8px;">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                        Kârlılık ve Kalan Anlaşılan Bakiye Analizi
                    </span>
                    <svg class="collapse-arrow" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="transition:transform 0.3s;"><polyline points="6 9 12 15 18 9"/></svg>
                </div>
                <div class="collapsible-body" style="overflow:hidden; transition: max-height 0.35s ease, opacity 0.25s ease;">
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
                        <div style="font-size: 0.7rem; color: var(--text-muted);">Toplam Gider: ${formatCurrency(agreedExpenseTotal)} · Ödenen: ${formatCurrency(paidExpenseTotal)}</div>
                    </div>
                </div>
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
            <div class="period-flow-card collapsed">
                <div class="period-flow-title" onclick="this.parentElement.classList.toggle('collapsed')" style="cursor:pointer; user-select:none; display:flex; align-items:center; justify-content:space-between;">
                    <span style="display:flex; align-items:center; gap:8px;">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                        Dönemsel Nakit Akışı ve Darboğaz Takibi
                    </span>
                    <svg class="collapse-arrow" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="transition:transform 0.3s;"><polyline points="6 9 12 15 18 9"/></svg>
                </div>
                <div class="collapsible-body" style="overflow:hidden; transition: max-height 0.35s ease, opacity 0.25s ease;">
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

        // Split into active (bekliyor) and completed (odendi)
        const activeTxs = txs.filter(t => t.paymentStatus === 'bekliyor');
        const completedTxs = txs.filter(t => t.paymentStatus === 'odendi');

        // Sort activeTxs by Date or Period
        if (activeSortMode === 'period') {
            activeTxs.sort((a, b) => {
                const pA = a.period > 0 ? a.period : 999;
                const pB = b.period > 0 ? b.period : 999;
                if (pA !== pB) return pA - pB;
                const dateA = getTxDueDate(a) || '9999-12-31';
                const dateB = getTxDueDate(b) || '9999-12-31';
                return dateA.localeCompare(dateB);
            });
        } else {
            activeTxs.sort((a, b) => {
                const dateA = getTxDueDate(a) || '9999-12-31';
                const dateB = getTxDueDate(b) || '9999-12-31';
                return dateA.localeCompare(dateB);
            });
        }

        let html = '';

        // ── ACTIVE SECTION ──
        if (activeTxs.length > 0) {
            html += `
                <div style="margin-bottom:8px;">
                    <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:10px; flex-wrap:wrap; gap:8px;">
                        <div style="display:flex; align-items:center; gap:8px;">
                            <span style="font-size:0.75rem; font-weight:700; text-transform:uppercase; letter-spacing:0.8px; color:var(--warning);">
                                ⏳ Aktif Borçlar & Bekleyen İşlemler
                            </span>
                            <span style="font-size:0.68rem; padding:2px 8px; border-radius:10px; background:rgba(245,158,11,0.15); color:#f59e0b; font-weight:700;">${activeTxs.length}</span>
                        </div>
                        <div style="display:flex; align-items:center; gap:4px; font-size:0.72rem;">
                            <span style="color:var(--text-muted); font-weight:600;">Sırala:</span>
                            <button type="button" class="btn btn-xs ${activeSortMode === 'date' ? 'btn-primary' : 'btn-outline'}" onclick="App.setActiveTxSort('date')" style="padding:2px 8px; font-size:0.7rem;">📅 Tarihe Göre</button>
                            <button type="button" class="btn btn-xs ${activeSortMode === 'period' ? 'btn-primary' : 'btn-outline'}" onclick="App.setActiveTxSort('period')" style="padding:2px 8px; font-size:0.7rem;">📊 Döneme Göre</button>
                        </div>
                    </div>
                    ${activeTxs.map(tx => renderTxCard(tx, projectId)).join('')}
                </div>`;
        }

        // ── COMPLETED SECTION ──
        if (completedTxs.length > 0) {
            html += `
                <div class="completed-section collapsed" style="margin-top:16px;">
                    <div onclick="this.parentElement.classList.toggle('collapsed')" style="display:flex; align-items:center; justify-content:space-between; cursor:pointer; user-select:none; padding:10px 14px; background:rgba(16,185,129,0.06); border:1px solid rgba(16,185,129,0.15); border-radius:var(--radius-sm); margin-bottom:10px;">
                        <div style="display:flex; align-items:center; gap:8px;">
                            <span style="font-size:0.75rem; font-weight:700; text-transform:uppercase; letter-spacing:0.8px; color:var(--success);">
                                ✅ Tamamlanan İşlemler
                            </span>
                            <span style="font-size:0.68rem; padding:2px 8px; border-radius:10px; background:rgba(16,185,129,0.15); color:#10b981; font-weight:700;">${completedTxs.length}</span>
                        </div>
                        <svg class="collapse-arrow" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="transition:transform 0.3s; color:var(--text-muted);"><polyline points="6 9 12 15 18 9"/></svg>
                    </div>
                    <div class="collapsible-body" style="overflow:hidden; transition: max-height 0.4s ease, opacity 0.3s ease;">
                        ${completedTxs.map(tx => renderTxCard(tx, projectId)).join('')}
                    </div>
                </div>`;
        }

        container.innerHTML = html;
    }

    function renderTxCard(tx, projectId) {
        const project = getProject(tx.projectId);
        const typeInfo = TX_TYPES[tx.type] || {};
        const isIncome = tx.type === 'hakedis';
        const amountClass = isIncome ? 'positive' : 'negative';
        const amountSign = isIncome ? '+' : '-';

        const paidAmount = getTxPaidAmount(tx);
        const remaining = getTxRemainingAmount(tx);
        const isPartiallyPaid = paidAmount > 0 && remaining > 0;
        const hasPayments = tx.payments && tx.payments.length > 0;

        // Status badge
        let statusBadge = '';
        if (tx.paymentStatus === 'odendi') {
            statusBadge = '<span class="badge badge-success">✅ Ödendi</span>';
        } else if (isPartiallyPaid) {
            const pct = Math.round((paidAmount / tx.amount) * 100);
            statusBadge = `<span class="badge" style="background:rgba(245,158,11,0.15); color:#f59e0b; border:1px solid rgba(245,158,11,0.3);">⚠️ Kısmi %${pct}</span>`;
        } else {
            statusBadge = '<span class="badge badge-warning">Bekliyor</span>';
        }

        // Tahmini vs Anlaşılan
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
        const createdByLine = tx.createdBy ? `<div style="font-size:0.72rem; color:var(--text-muted); margin-top:2px;">👤 ${escapeHtml(tx.createdBy)}</div>` : '';

        // Linked project info for loan transactions
        let linkedProjectLine = '';
        if (tx.linkedProjectId && (tx.type === 'borc-ver' || tx.type === 'borc-al')) {
            const linkedProject = getProject(tx.linkedProjectId);
            const linkedName = linkedProject ? escapeHtml(linkedProject.name) : 'Silinmiş Proje';
            const arrow = tx.type === 'borc-ver' ? '→' : '←';
            const color = tx.type === 'borc-ver' ? 'var(--danger)' : 'var(--success)';
            linkedProjectLine = `<div style="font-size:0.72rem; margin-top:3px; padding:3px 8px; background:rgba(99,102,241,0.08); border:1px solid rgba(99,102,241,0.15); border-radius:4px; display:inline-block;">
                <span style="color:${color}; font-weight:700;">🔄 ${arrow} ${linkedName}</span>
            </div>`;
        }

        // Partial payment progress bar
        let partialPaymentLine = '';
        if (isPartiallyPaid) {
            const pct = Math.round((paidAmount / tx.amount) * 100);
            partialPaymentLine = `
                <div style="margin-top:6px;">
                    <div style="display:flex; justify-content:space-between; font-size:0.72rem; font-weight:600; margin-bottom:3px;">
                        <span style="color:var(--success);">Ödenen: ${formatCurrency(paidAmount)}</span>
                        <span style="color:var(--danger);">Kalan: ${formatCurrency(remaining)}</span>
                    </div>
                    <div style="width:100%; height:6px; background:rgba(239,68,68,0.15); border-radius:3px; overflow:hidden;">
                        <div style="width:${pct}%; height:100%; background:linear-gradient(90deg, #10b981, #34d399); border-radius:3px; transition:width 0.3s;"></div>
                    </div>
                </div>
            `;
        }

        // Pay button
        let payButtonLabel = '✓ Öde';
        if (isPartiallyPaid) {
            payButtonLabel = `💳 Kalan ${formatCurrency(remaining)} Öde`;
        }

        const workIcon = getWorkCategoryIcon(tx.description);
        const descWithIcon = workIcon ? `${workIcon} ${escapeHtml(tx.description || typeInfo.label)}` : escapeHtml(tx.description || typeInfo.label);
        const vendorLine = tx.vendor ? `<div style="font-size:0.75rem; font-weight:700; color:var(--accent); margin-top:2px;">🏢 ${escapeHtml(tx.vendor)}</div>` : '';

        let scopeBadge = '';
        if (tx.scopeType === 'santiye-ici') {
            scopeBadge = `<div style="font-size:0.7rem; color:#f59e0b; margin-top:2px; font-weight:700;">🔨 Şantiye İçi Unutulan İş (Tahmini: 0 ₺)</div>`;
        } else if (tx.scopeType === 'ilave-is' || tx.type === 'ilave-is') {
            scopeBadge = `<div style="font-size:0.7rem; color:var(--success); margin-top:2px; font-weight:700;">✨ Ek Sözleşme (+${formatCurrency(tx.clientAddonAmount || 0)} Müşteri Alacağı)</div>`;
        }

        return `
            <div class="transaction-item">
                <div class="tx-icon ${typeInfo.cssClass || ''}">${workIcon || typeInfo.icon || '📄'}</div>
                <div class="tx-info">
                    <div class="tx-desc">${descWithIcon}</div>
                    ${vendorLine}
                    ${scopeBadge}
                    <div class="tx-date">${dateLabelText} · ${typeInfo.label}${periodLabelText}</div>
                    ${estimateLine}
                    ${createdByLine}
                    ${linkedProjectLine}
                    ${partialPaymentLine}
                </div>
                <span class="tx-amount ${amountClass}">${amountSign}${formatCurrency(tx.amount)}</span>
                <span class="tx-status">${statusBadge}</span>
                <div class="tx-actions">
                    ${hasPayments || tx.paymentStatus === 'odendi' ? `
                        <button class="btn btn-xs btn-outline" onclick="event.stopPropagation(); App.openPaymentHistory('${tx.id}')" title="Ödeme geçmişi ve hesap mutabakatı" style="font-size:0.68rem; color:var(--accent);">
                            📋 Detay
                        </button>
                    ` : ''}
                    ${tx.paymentStatus === 'bekliyor' ? `
                        <button class="btn btn-xs btn-success" onclick="event.stopPropagation(); App.markAsPaid('${tx.id}')" title="Ödendi olarak işaretle" style="${isPartiallyPaid ? 'font-size:0.68rem; padding:3px 8px;' : ''}">
                            ${payButtonLabel}
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
    }

    // ─────────────────────────────────────
    // HESAP MUTABAKATI — Payment History & Reconciliation Modal
    // ─────────────────────────────────────
    function openPaymentHistory(txId) {
        const tx = data.transactions.find(t => t.id === txId);
        if (!tx) return;

        const typeInfo = TX_TYPES[tx.type] || {};
        const paidAmount = getTxPaidAmount(tx);
        const remaining = getTxRemainingAmount(tx);
        const payments = tx.payments || [];
        const isFullyPaid = tx.paymentStatus === 'odendi';

        // Summary header
        const pct = tx.amount > 0 ? Math.round((paidAmount / tx.amount) * 100) : 0;
        const statusColor = isFullyPaid ? 'var(--success)' : (paidAmount > 0 ? '#f59e0b' : 'var(--danger)');
        const statusLabel = isFullyPaid ? '✅ Tamamen Ödendi' : (paidAmount > 0 ? `⚠️ Kısmi Ödeme (%${pct})` : '⏳ Henüz Ödenmedi');

        let html = `
            <div style="margin-bottom:18px;">
                <div style="display:flex; align-items:center; gap:10px; margin-bottom:10px;">
                    <span style="font-size:1.8rem;">${typeInfo.icon || '📄'}</span>
                    <div>
                        <div style="font-weight:800; font-size:1rem;">${escapeHtml(tx.description || typeInfo.label)}</div>
                        <div style="font-size:0.78rem; color:var(--text-muted);">
                            ${typeInfo.label} · ${tx.dueDate ? 'Vade: ' + formatDate(tx.dueDate) : 'Vade belirlenmemiş'}
                            ${tx.createdBy ? ' · 👤 ' + escapeHtml(tx.createdBy) : ''}
                        </div>
                    </div>
                </div>

                <!-- Summary Cards -->
                <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:8px; margin-bottom:14px;">
                    <div style="background:rgba(99,102,241,0.08); border:1px solid rgba(99,102,241,0.2); padding:10px 12px; border-radius:8px; text-align:center;">
                        <div style="font-size:0.65rem; text-transform:uppercase; letter-spacing:0.5px; color:var(--text-muted); font-weight:600;">Anlaşılan Tutar</div>
                        <div style="font-size:1.15rem; font-weight:800; color:var(--text-main);">${formatCurrency(tx.amount)}</div>
                    </div>
                    <div style="background:rgba(16,185,129,0.08); border:1px solid rgba(16,185,129,0.2); padding:10px 12px; border-radius:8px; text-align:center;">
                        <div style="font-size:0.65rem; text-transform:uppercase; letter-spacing:0.5px; color:var(--success); font-weight:600;">Toplam Ödenen</div>
                        <div style="font-size:1.15rem; font-weight:800; color:var(--success);">${formatCurrency(paidAmount)}</div>
                    </div>
                    <div style="background:${isFullyPaid ? 'rgba(16,185,129,0.06)' : 'rgba(239,68,68,0.08)'}; border:1px solid ${isFullyPaid ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}; padding:10px 12px; border-radius:8px; text-align:center;">
                        <div style="font-size:0.65rem; text-transform:uppercase; letter-spacing:0.5px; color:${isFullyPaid ? 'var(--success)' : 'var(--danger)'}; font-weight:600;">Kalan Bakiye</div>
                        <div style="font-size:1.15rem; font-weight:800; color:${isFullyPaid ? 'var(--success)' : 'var(--danger)'};">${isFullyPaid ? '₺ 0' : formatCurrency(remaining)}</div>
                    </div>
                </div>

                <!-- Progress Bar -->
                <div style="margin-bottom:14px;">
                    <div style="display:flex; justify-content:space-between; font-size:0.7rem; font-weight:600; margin-bottom:4px;">
                        <span style="color:${statusColor};">${statusLabel}</span>
                        <span style="color:var(--text-muted);">%${pct}</span>
                    </div>
                    <div style="width:100%; height:8px; background:rgba(239,68,68,0.12); border-radius:4px; overflow:hidden;">
                        <div style="width:${pct}%; height:100%; background:${isFullyPaid ? 'linear-gradient(90deg, #10b981, #34d399)' : 'linear-gradient(90deg, #f59e0b, #fbbf24)'}; border-radius:4px; transition:width 0.3s;"></div>
                    </div>
                </div>
            </div>`;

        // Payment History Table
        if (payments.length > 0) {
            html += `
                <div style="margin-bottom:14px;">
                    <div style="font-size:0.72rem; text-transform:uppercase; letter-spacing:0.6px; color:var(--text-muted); font-weight:700; margin-bottom:8px; display:flex; align-items:center; gap:6px;">
                        📋 Ödeme Geçmişi (${payments.length} işlem)
                    </div>
                    <div style="border:1px solid var(--glass-border); border-radius:8px; overflow:hidden;">
                        <table style="width:100%; border-collapse:collapse; font-size:0.82rem;">
                            <thead>
                                <tr style="background:rgba(255,255,255,0.03);">
                                    <th style="padding:8px 12px; text-align:left; font-size:0.7rem; text-transform:uppercase; letter-spacing:0.5px; color:var(--text-muted); font-weight:600; border-bottom:1px solid var(--glass-border);">#</th>
                                    <th style="padding:8px 12px; text-align:left; font-size:0.7rem; text-transform:uppercase; letter-spacing:0.5px; color:var(--text-muted); font-weight:600; border-bottom:1px solid var(--glass-border);">Tarih</th>
                                    <th style="padding:8px 12px; text-align:left; font-size:0.7rem; text-transform:uppercase; letter-spacing:0.5px; color:var(--text-muted); font-weight:600; border-bottom:1px solid var(--glass-border);">Açıklama / Dekont</th>
                                    <th style="padding:8px 12px; text-align:right; font-size:0.7rem; text-transform:uppercase; letter-spacing:0.5px; color:var(--text-muted); font-weight:600; border-bottom:1px solid var(--glass-border);">Tutar</th>
                                    <th style="padding:8px 12px; text-align:left; font-size:0.7rem; text-transform:uppercase; letter-spacing:0.5px; color:var(--text-muted); font-weight:600; border-bottom:1px solid var(--glass-border);">Yapan</th>
                                </tr>
                            </thead>
                            <tbody>`;

            let runningTotal = 0;
            payments.forEach((p, i) => {
                runningTotal += p.amount;
                const remainingAfter = tx.amount - runningTotal;
                html += `
                                <tr style="border-bottom:1px solid rgba(255,255,255,0.03);">
                                    <td style="padding:8px 12px; font-weight:600; color:var(--text-muted);">${i + 1}</td>
                                    <td style="padding:8px 12px;">
                                        <div style="font-weight:600;">${formatDate(p.date)}</div>
                                    </td>
                                    <td style="padding:8px 12px;">
                                        <span style="font-size:0.78rem; font-weight:600; color:var(--text-main);">${p.note ? `📝 ${escapeHtml(p.note)}` : '—'}</span>
                                    </td>
                                    <td style="padding:8px 12px; text-align:right;">
                                        <span style="font-weight:700; color:var(--success);">${formatCurrency(p.amount)}</span>
                                        <div style="font-size:0.68rem; color:var(--text-muted);">Kalan: ${formatCurrency(Math.max(0, remainingAfter))}</div>
                                    </td>
                                    <td style="padding:8px 12px; font-size:0.78rem; color:var(--text-muted);">
                                        👤 ${escapeHtml(p.createdBy || 'Bilinmiyor')}
                                    </td>
                                </tr>`;
            });

            html += `
                            </tbody>
                            <tfoot>
                                <tr style="background:rgba(255,255,255,0.03);">
                                    <td colspan="3" style="padding:8px 12px; font-weight:800; font-size:0.78rem; text-transform:uppercase;">TOPLAM ÖDENEN</td>
                                    <td style="padding:8px 12px; text-align:right; font-weight:800; color:var(--success); font-size:0.95rem;">${formatCurrency(paidAmount)}</td>
                                    <td style="padding:8px 12px;"></td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>`;
        } else {
            html += `
                <div style="text-align:center; padding:20px; color:var(--text-muted); font-size:0.85rem;">
                    Henüz ödeme kaydı bulunmuyor.
                </div>`;
        }

        // Estimation info if available
        if (tx.estimatedAmount && tx.estimatedAmount > 0) {
            const diff = tx.amount - tx.estimatedAmount;
            const diffPct = tx.estimatedAmount > 0 ? ((diff / tx.estimatedAmount) * 100).toFixed(1) : '0';
            html += `
                <div style="margin-top:10px; padding:10px 14px; background:rgba(99,102,241,0.06); border:1px solid rgba(99,102,241,0.15); border-radius:8px; font-size:0.8rem;">
                    <span style="color:var(--text-muted);">📊 İş Başlangıcı Tahmini:</span>
                    <strong>${formatCurrency(tx.estimatedAmount)}</strong>
                    → Anlaşılan: <strong>${formatCurrency(tx.amount)}</strong>
                    <span style="color:${diff > 0 ? 'var(--danger)' : 'var(--success)'}; font-weight:700;">(${diff > 0 ? '+' : ''}${diffPct}%)</span>
                </div>`;
        }

        // Action buttons
        html += `
            <div class="form-actions" style="margin-top:18px;">
                <button type="button" class="btn btn-outline" onclick="App.closeModal()">Kapat</button>
                ${!isFullyPaid ? `<button type="button" class="btn btn-success" onclick="App.closeModal(); App.markAsPaid('${txId}')">💳 Ödeme Yap</button>` : ''}
            </div>`;

        openModal('📋 Hesap Mutabakatı', html);
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
        const statusHazirlik = (project && project.status === 'hazirlik') ? 'selected' : '';
        const statusDevam = ((project && project.status === 'devam-ediyor') || !project) ? 'selected' : '';
        const statusTamam = (project && project.status === 'tamamlandi') ? 'selected' : '';
        let periodCount = 0;
        if (project) {
            if (project.periods && Array.isArray(project.periods)) {
                // Only count intermediate periods that actually have an amount > 0 or a date set
                const activeInters = project.periods.filter(p => !p.isDownpayment && !p.isCompletion && (p.amount > 0 || (p.date && p.date.trim() !== '')));
                periodCount = activeInters.length;
            } else if (project.periodCount !== undefined && project.periodCount !== null) {
                periodCount = parseInt(project.periodCount, 10) || 0;
            }
        }
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
                    <label class="form-label" for="input-project-status" onchange="App.saveProjectDraft()">Aşama / Durum</label>
                    <select class="form-select" id="input-project-status">
                        <option value="hazirlik" ${statusHazirlik}>📝 Taslak / Hazırlık (İmza Öncesi Bütçeleme)</option>
                        <option value="devam-ediyor" ${statusDevam}>🏁 Sözleşme İmzalandı / İşe Başlandı</option>
                        <option value="tamamlandi" ${statusTamam}>✅ Tamamlandı / Teslim Edildi</option>
                    </select>
                </div>

                <div class="form-group" style="border-top: 1px solid var(--glass-border); padding-top: 15px; margin-top: 15px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                        <h4 style="font-size: 0.85rem; text-transform: uppercase; color: var(--text-secondary); margin:0;">Dönemsel Ödeme Planı</h4>
                    </div>
                    <div style="display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 12px;">
                        <button type="button" class="btn btn-xs btn-outline" onclick="App.setPaymentPreset('upfront')" title="%100 Tutar işe başlarken Peşinat olarak tahsil edilir">⚡ %100 Peşin (İşe Başlarken)</button>
                        <button type="button" class="btn btn-xs btn-outline" onclick="App.setPaymentPreset('completion')" title="%100 Tutar iş tesliminde/bitiminde tahsil edilir">🏁 %100 Teslimde (İş Bitiminde)</button>
                        <button type="button" class="btn btn-xs btn-outline" onclick="App.setPaymentPreset('standard')" title="Tutar 4 eşit ara ödemeye bölünür">📊 4 Eşit Ara Ödeme</button>
                    </div>
                </div>

                <div class="form-group" style="margin-bottom: 15px;">
                    <label class="form-label" for="input-period-count">Ara Ödeme (Hakediş) Sayısı <span style="font-weight:400; color:var(--text-muted); text-transform:none;">(0 = Ara Ödemesiz)</span></label>
                    <input class="form-input" type="number" id="input-period-count" value="${periodCount}" min="0" max="24" required oninput="App.onPeriodCountInput()">
                </div>

                <div class="form-group">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                        <label class="form-label" style="margin-bottom:0;">Dönem Detayları</label>
                        <button type="button" class="btn btn-xs btn-outline" onclick="App.distributePeriodsEvenly()">Eşit Dağıt</button>
                    </div>
                    <div id="project-periods-list" style="max-height: 280px; overflow-y: auto; padding-right: 4px; border: 1px solid var(--glass-border); padding: 10px; border-radius: var(--radius-sm); background: rgba(255,255,255,0.01);">
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
        if (!periodCountInput) return;

        if (presetType === 'upfront') {
            periodCountInput.value = 0;
            generatePeriodFields();
            const downInput = document.getElementById('input-downpayment-amount');
            const compInput = document.getElementById('input-completion-amount');
            if (downInput) downInput.value = contractAmt ? contractAmt.toLocaleString('tr-TR') : '0';
            if (compInput) compInput.value = '0';
            validatePeriodSum();
            showToast('Ödeme planı %100 Peşin (İşe Başlarken) olarak ayarlandı.', 'info');
        } else if (presetType === 'completion') {
            periodCountInput.value = 0;
            generatePeriodFields();
            const downInput = document.getElementById('input-downpayment-amount');
            const compInput = document.getElementById('input-completion-amount');
            if (downInput) downInput.value = '0';
            if (compInput) compInput.value = contractAmt ? contractAmt.toLocaleString('tr-TR') : '0';
            validatePeriodSum();
            showToast('Ödeme planı %100 Teslimde (İş Bitiminde) olarak ayarlandı.', 'info');
        } else if (presetType === 'standard') {
            periodCountInput.value = 4;
            generatePeriodFields();
            const downInput = document.getElementById('input-downpayment-amount');
            const compInput = document.getElementById('input-completion-amount');
            if (downInput) downInput.value = '0';
            if (compInput) compInput.value = '0';
            distributePeriodsEvenly();
            showToast('Ödeme planı 4 Eşit Ara Ödeme olarak ayarlandı.', 'info');
        }

        saveProjectDraft();
    }

    function onContractAmountInput(el) {
        formatAmountInput(el);
        const contractAmt = parseAmountInput(el);
        const count = parseInt(document.getElementById('input-period-count')?.value, 10) || 0;
        if (count === 0) {
            const downInput = document.getElementById('input-downpayment-amount');
            const compInput = document.getElementById('input-completion-amount');
            if (downInput && compInput) {
                const downVal = parseAmountInput(downInput);
                if (downVal === 0) {
                    compInput.value = contractAmt > 0 ? contractAmt.toLocaleString('tr-TR') : '0';
                } else {
                    compInput.value = Math.max(0, contractAmt - downVal).toLocaleString('tr-TR');
                }
            }
        }
        generatePeriodFields();
        saveProjectDraft();
    }

    function onDownpaymentAmountInput(el) {
        formatAmountInput(el);
        const contractAmt = parseAmountInput(document.getElementById('input-contract-amount'));
        const downAmt = parseAmountInput(el);
        const count = parseInt(document.getElementById('input-period-count')?.value, 10) || 0;
        if (count === 0) {
            const compInput = document.getElementById('input-completion-amount');
            if (compInput) {
                compInput.value = Math.max(0, contractAmt - downAmt).toLocaleString('tr-TR');
            }
        }
        validatePeriodSum();
        saveProjectDraft();
    }

    function onCompletionAmountInput(el) {
        formatAmountInput(el);
        const contractAmt = parseAmountInput(document.getElementById('input-contract-amount'));
        const compAmt = parseAmountInput(el);
        const count = parseInt(document.getElementById('input-period-count')?.value, 10) || 0;
        if (count === 0) {
            const downInput = document.getElementById('input-downpayment-amount');
            if (downInput) {
                downInput.value = Math.max(0, contractAmt - compAmt).toLocaleString('tr-TR');
            }
        }
        validatePeriodSum();
        saveProjectDraft();
    }

    function onPeriodCountInput() {
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
        let periodCount = 0;
        if (existingPeriods && Array.isArray(existingPeriods)) {
            const activeInters = existingPeriods.filter(p => !p.isDownpayment && !p.isCompletion && (p.amount > 0 || (p.date && p.date.trim() !== '')));
            periodCount = activeInters.length;
            const countInput = document.getElementById('input-period-count');
            if (countInput) countInput.value = periodCount;
        } else {
            const periodCountVal = document.getElementById('input-period-count')?.value;
            periodCount = periodCountVal !== undefined && periodCountVal !== '' ? (parseInt(periodCountVal, 10) || 0) : 0;
        }

        let downpaymentAmt = parseAmountInput(document.getElementById('input-downpayment-amount'));
        let downpaymentDate = document.getElementById('input-downpayment-date')?.value || '';
        let completionAmt = parseAmountInput(document.getElementById('input-completion-amount'));
        let completionDate = document.getElementById('input-completion-date')?.value || '';

        if (existingPeriods && existingPeriods.length > 0) {
            // Find completion period (last item or explicitly marked isCompletion)
            const compObj = existingPeriods.find(p => p.isCompletion) || (existingPeriods.length > 1 ? existingPeriods[existingPeriods.length - 1] : null);
            if (compObj) {
                completionAmt = compObj.amount || 0;
                completionDate = compObj.date || '';
            }

            // Find downpayment period
            const dpObj = existingPeriods.find(p => p.isDownpayment);
            if (dpObj) {
                downpaymentAmt = dpObj.amount || 0;
                downpaymentDate = dpObj.date || '';
            } else if (existingPeriods.length > 1 && existingPeriods[0] !== compObj) {
                // Check if first period is Peşinat
                const firstLabel = (existingPeriods[0].label || '').toLowerCase();
                if (firstLabel.includes('peşin')) {
                    downpaymentAmt = existingPeriods[0].amount || 0;
                    downpaymentDate = existingPeriods[0].date || '';
                }
            }
        }

        // If periodCount === 0 and both downpayment & completion amounts are 0, set completionAmt = contractAmt
        if (periodCount === 0 && downpaymentAmt === 0 && completionAmt === 0 && contractAmt > 0) {
            completionAmt = contractAmt;
        }

        const remainingForIntermediate = Math.max(0, contractAmt - downpaymentAmt - completionAmt);
        const autoAmt = periodCount > 0 ? Math.round(remainingForIntermediate / periodCount) : 0;

        let html = '';

        // 1. Peşinat Row
        html += `
            <div class="form-group-row" style="display: flex; gap: 10px; margin-bottom: 8px; align-items: center; background: rgba(16, 185, 129, 0.04); padding: 6px 8px; border-radius: var(--radius-sm); border: 1px solid rgba(16, 185, 129, 0.15);">
                <div style="flex: 1.2; font-size: 0.8rem; font-weight: 700; color: var(--success);">⚡ Peşinat (İşe Başlarken)</div>
                <input type="text" inputmode="numeric" class="form-input" id="input-downpayment-amount" value="${downpaymentAmt ? downpaymentAmt.toLocaleString('tr-TR') : '0'}" placeholder="Tutar" style="flex: 2; margin-bottom:0;" oninput="App.onDownpaymentAmountInput(this)" onkeydown="App.onAmountKeyDown(event)">
                <input type="date" class="form-input" id="input-downpayment-date" value="${downpaymentDate}" style="flex: 2; margin-bottom:0;" onchange="App.saveProjectDraft()">
            </div>
        `;

        // 2. Intermediate Ara Ödemeler Rows
        for (let i = 0; i < periodCount; i++) {
            let labelText = periodCount === 1 ? 'Ara Ödeme (Hakediş)' : `${i + 1}. Ara Ödeme (Hakediş)`;
            let val = autoAmt;
            let date = '';

            if (existingPeriods) {
                const interPeriods = existingPeriods.filter(p => !p.isDownpayment && !p.isCompletion);
                if (interPeriods[i]) {
                    val = interPeriods[i].amount;
                    date = interPeriods[i].date || '';
                }
            }

            const valFormatted = val ? val.toLocaleString('tr-TR') : '';

            html += `
                <div class="form-group-row" style="display: flex; gap: 10px; margin-bottom: 8px; align-items: center; padding-left: 4px;">
                    <div style="flex: 1.2; font-size: 0.8rem; font-weight: 600; color: var(--text-secondary);">${labelText}</div>
                    <input type="text" inputmode="numeric" class="form-input input-period-amount" data-index="${i}" value="${valFormatted}" placeholder="Tutar" style="flex: 2; margin-bottom:0;" oninput="App.onPeriodAmountInput(this)">
                    <input type="date" class="form-input input-period-date" data-index="${i}" value="${date}" style="flex: 2; margin-bottom:0;" onchange="App.saveProjectDraft()">
                </div>
            `;
        }

        // 3. İş Bitimi Row
        html += `
            <div class="form-group-row" style="display: flex; gap: 10px; margin-bottom: 8px; align-items: center; background: rgba(99, 102, 241, 0.04); padding: 6px 8px; border-radius: var(--radius-sm); border: 1px solid rgba(99, 102, 241, 0.15); margin-top: 4px;">
                <div style="flex: 1.2; font-size: 0.8rem; font-weight: 700; color: var(--accent);">🏁 İş Bitimi Ödemesi</div>
                <input type="text" inputmode="numeric" class="form-input" id="input-completion-amount" value="${completionAmt ? completionAmt.toLocaleString('tr-TR') : '0'}" placeholder="Tutar" style="flex: 2; margin-bottom:0;" oninput="App.onCompletionAmountInput(this)" onkeydown="App.onAmountKeyDown(event)">
                <input type="date" class="form-input" id="input-completion-date" value="${completionDate}" style="flex: 2; margin-bottom:0;" onchange="App.saveProjectDraft()">
            </div>
        `;

        container.innerHTML = html;
        validatePeriodSum();
    }

    function validatePeriodSum() {
        const label = document.getElementById('period-sum-validation');
        if (!label) return;

        const contractAmt = parseAmountInput(document.getElementById('input-contract-amount'));
        const downAmt = parseAmountInput(document.getElementById('input-downpayment-amount'));
        const completionAmt = parseAmountInput(document.getElementById('input-completion-amount'));

        let sum = downAmt + completionAmt;
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
        const downAmt = parseAmountInput(document.getElementById('input-downpayment-amount'));
        const completionAmt = parseAmountInput(document.getElementById('input-completion-amount'));

        const periodCountVal = document.getElementById('input-period-count')?.value;
        const periodCount = periodCountVal !== undefined && periodCountVal !== '' ? (parseInt(periodCountVal, 10) || 0) : 0;

        const remaining = Math.max(0, contractAmt - downAmt - completionAmt);
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

        const downpaymentAmount = parseAmountInput(document.getElementById('input-downpayment-amount'));
        const downpaymentDate = document.getElementById('input-downpayment-date')?.value || '';

        const completionAmount = parseAmountInput(document.getElementById('input-completion-amount'));
        const completionDate = document.getElementById('input-completion-date')?.value || '';

        if (!name.trim()) {
            showToast('Proje adı boş olamaz.', 'error');
            return;
        }

        // Gather periods data
        const periods = [];
        let pNum = 1;

        // 1. Peşinat
        periods.push({
            number: pNum++,
            label: 'Peşinat (İşe Başlarken)',
            amount: downpaymentAmount,
            date: downpaymentDate,
            isDownpayment: true
        });

        // 2. Intermediate Ara Ödemeler
        const amtInputs = document.querySelectorAll('.input-period-amount');
        const dateInputs = document.querySelectorAll('.input-period-date');
        let intermediateSum = 0;

        for (let i = 0; i < periodCount; i++) {
            const amt = parseAmountInput(amtInputs[i]);
            const date = dateInputs[i]?.value || '';
            intermediateSum += amt;
            const label = periodCount === 1 ? 'Ara Ödeme (Hakediş)' : `${i + 1}. Ara Ödeme (Hakediş)`;
            periods.push({
                number: pNum++,
                label: label,
                amount: amt,
                date: date
            });
        }

        // 3. İş Bitimi
        periods.push({
            number: pNum++,
            label: 'İş Bitimi Ödemesi',
            amount: completionAmount,
            date: completionDate,
            isCompletion: true
        });

        const totalPlanned = downpaymentAmount + intermediateSum + completionAmount;
        if (Math.abs(contractAmount - totalPlanned) > 1) {
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

        const html = `
            <div style="margin-bottom: 16px; line-height: 1.5; color: var(--text-secondary);">
                <strong>"${escapeHtml(project.name)}"</strong> projesi ve tüm işlem geçmişi kalıcı olarak silinecek.
                <br>Devam etmek için güvenlik şifrenizi girin.
            </div>
            <div class="form-group" style="margin-bottom: 16px;">
                <label class="form-label" for="input-delete-password">Güvenlik Şifresi</label>
                <input class="form-input" type="password" id="input-delete-password" placeholder="Şifrenizi girin" autofocus required>
            </div>
            <div class="form-actions">
                <button type="button" class="btn btn-outline" onclick="App.closeModal()">İptal</button>
                <button type="button" class="btn btn-danger" onclick="App.processDeleteProject()">🗑️ Projeyi Sil</button>
            </div>
        `;
        openModal('🗑️ Proje Silme — Şifre Doğrulama', html);
    }

    function processDeleteProject() {
        if (!currentProjectId) return;
        const inputPass = document.getElementById('input-delete-password').value;
        const actualPass = data.resetPassword || '1234';

        if (inputPass !== actualPass) {
            showToast('Hatalı güvenlik şifresi! İşlem iptal edildi.', 'error');
            return;
        }

        closeModal();
        const project = getProject(currentProjectId);
        showConfirm(
            'Projeyi Sil',
            `Şifre doğrulandı. "${project ? project.name : ''}" projesi kalıcı olarak silinecek. Son kez onaylıyor musunuz?`,
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

    function openHakedis(projectId = null) {
        const targetProjectId = projectId || currentProjectId || (data.projects && data.projects.length > 0 ? data.projects[0].id : null);
        if (!targetProjectId) {
            showToast('Lütfen önce bir proje oluşturun.', 'warning');
            return;
        }
        currentProjectId = targetProjectId;
        openModal('💰 Müşteri Ödemesi Tahsil Et', getTransactionFormHtml({
            type: 'hakedis',
            statusLocked: 'odendi',
            showDueDate: false,
            submitLabel: 'Tahsil Et',
            submitClass: 'btn-success'
        }));
    }

    function openGider(defaultType = 'malzeme', projectId = null) {
        const targetProjectId = projectId || currentProjectId || (data.projects && data.projects.length > 0 ? data.projects[0].id : null);
        if (!targetProjectId) {
            showToast('Lütfen önce bir proje oluşturun.', 'warning');
            return;
        }
        currentProjectId = targetProjectId;
        openModal('📦 Proje Maliyet / Ödeme Ekle', getTransactionFormHtml({
            type: defaultType,
            allowTypeSelect: true,
            statusLocked: 'bekliyor',
            showDueDate: true,
            showEstimate: true,
            submitLabel: 'Kaydet',
            submitClass: 'btn-warning'
        }));
    }

    function openMalzeme() { openGider('malzeme'); }
    function openIscilik() { openGider('iscilik'); }
    function openTaseron() { openGider('iscilik-malzeme'); }

    function openIlaveIsModal(projectId = null) {
        const targetProjectId = projectId || currentProjectId || (data.projects && data.projects.length > 0 ? data.projects[0].id : null);
        if (!targetProjectId) {
            showToast('Lütfen önce bir proje oluşturun.', 'warning');
            return;
        }
        currentProjectId = targetProjectId;
        const project = getProject(currentProjectId);
        if (!project) return;

        const vendorSuggestions = getVendorSuggestions();
        const datalistHtml = vendorSuggestions.length > 0 ? `
            <datalist id="vendor-suggestions-list">
                ${vendorSuggestions.map(v => `<option value="${escapeHtml(v)}">`).join('')}
            </datalist>
        ` : '';

        const html = `
            <form onsubmit="App.saveIlaveIs(event)">
                <div style="background:rgba(99,102,241,0.08); border:1px solid rgba(99,102,241,0.2); padding:12px; border-radius:8px; margin-bottom:14px; font-size:0.83rem; color:var(--text-main);">
                    ✨ <strong>Müşteri İlave İş Sözleşmesi (Ek Hakediş)</strong><br>
                    <span style="font-size:0.78rem; color:var(--text-muted);">Müşteri tarafından onaylanmış sözleşme dışı ek iş. Müşteriden alınacak tutar projenin toplam alacağına eklenir.</span>
                </div>
                <div class="form-group">
                    <label class="form-label" for="input-addon-title">İlave İş / Ek Sözleşme Adı</label>
                    <input class="form-input" type="text" id="input-addon-title" placeholder="Örn: Ekstra Teras Kaplama & Banyo Dolabı" required autofocus>
                </div>
                <div class="form-group">
                    <label class="form-label" for="input-addon-client-amount">Müşteriden Alınacak Ek Sözleşme Tutarı (₺)</label>
                    <input class="form-input" type="text" inputmode="numeric" id="input-addon-client-amount" placeholder="0" required oninput="App.formatAmountInput(this)">
                    <div style="font-size:0.72rem; color:var(--text-muted); margin-top:3px;">Bu miktar müşterinin toplam sözleşme alacağına ve hakedişine eklenir.</div>
                </div>
                <div class="form-group">
                    <label class="form-label" for="input-addon-tracking">Müşteri Cari Takip Yöntemi</label>
                    <select class="form-select" id="input-addon-tracking">
                        <option value="combined">📊 Birleşik Cari Takip (Ana Sözleşme Hakedişlerine Dahil)</option>
                        <option value="separate">🎯 Ayrı Ek Sözleşme Takibi (Bu İş İçin Özel Tahsilat Planı)</option>
                    </select>
                </div>
                <div class="form-group" id="group-addon-terms">
                    <label class="form-label" for="input-addon-terms">Müşteri Tahsilat Planı</label>
                    <select class="form-select" id="input-addon-terms">
                        <option value="full-upfront">⚡ %100 Peşin (İlave İşe Başlarken)</option>
                        <option value="split-job">🌓 %50 Peşin, %50 İlave İş Bitiminde</option>
                        <option value="split-project">🏁 %50 Peşin, %50 Ana Proje Tesliminde</option>
                        <option value="job-end">🏁 %100 İlave İş Bitiminde</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label" for="input-addon-cost-amount">Maliyeti / Ustaya Anlaşılan Harcama Tutarı (₺) <span style="font-weight:400; color:var(--text-muted); text-transform:none; letter-spacing:0;">— opsiyonel</span></label>
                    <input class="form-input" type="text" inputmode="numeric" id="input-addon-cost-amount" placeholder="Opsiyonel" oninput="App.formatAmountInput(this)">
                </div>
                <div class="form-group">
                    <label class="form-label" for="input-addon-vendor">Firma / Taşeron / Usta (Alacaklı) <span style="font-weight:400; color:var(--text-muted); text-transform:none; letter-spacing:0;">— opsiyonel</span></label>
                    <input class="form-input" type="text" id="input-addon-vendor" list="vendor-suggestions-list" placeholder="Örn: Mermer A.Ş., Ahmet Usta" autocomplete="off">
                    ${datalistHtml}
                </div>
                <div class="form-group">
                    <label class="form-label" for="input-addon-due-date">Vade Tarihi <span style="font-weight:400; color:var(--text-muted); text-transform:none; letter-spacing:0;">— opsiyonel</span></label>
                    <input class="form-input" type="date" id="input-addon-due-date" value="">
                </div>
                <div class="form-actions">
                    <button type="button" class="btn btn-outline" onclick="App.closeModal()">İptal</button>
                    <button type="submit" class="btn btn-success">✨ Ek Sözleşmeyi Kaydet</button>
                </div>
            </form>
        `;
        openModal('✨ Müşteri İlave İş Sözleşmesi Ekle', html);
    }

    function saveIlaveIs(e) {
        e.preventDefault();
        if (!currentProjectId) return;

        const title = document.getElementById('input-addon-title').value.trim();
        const clientAmount = parseAmountInput(document.getElementById('input-addon-client-amount'));
        const trackingMode = document.getElementById('input-addon-tracking').value;
        const paymentTerms = document.getElementById('input-addon-terms').value;
        const costAmount = parseAmountInput(document.getElementById('input-addon-cost-amount'));
        const vendor = document.getElementById('input-addon-vendor').value.trim();
        const dueDate = document.getElementById('input-addon-due-date').value || '';

        if (!title) {
            showToast('Lütfen ilave iş adını girin.', 'error');
            return;
        }

        if (clientAmount < 0) {
            showToast('Müşteri alacak tutarı sıfırdan küçük olamaz.', 'error');
            return;
        }

        const tx = addTransaction(
            'ilave-is',
            currentProjectId,
            costAmount,
            'bekliyor',
            dueDate,
            `✨ Ek Sözleşme: ${title}`,
            costAmount,
            0,
            vendor,
            'ilave-is',
            clientAmount
        );

        if (tx) {
            tx.trackingMode = trackingMode;
            tx.paymentTerms = paymentTerms;
            saveData();
        }

        showToast(`✨ Ek Sözleşme Kaydedildi! Müşteri alacağına +${formatCurrency(clientAmount)} eklendi.`, 'success');
        closeModal();
        renderProjectDetail(currentProjectId);
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

    // ─────────────────────────────────────
    // PROJELER ARASI BORÇ SİSTEMİ
    // ─────────────────────────────────────
    function openBorcTransfer() {
        if (!currentProjectId) return;
        const currentProject = getProject(currentProjectId);
        if (!currentProject) return;

        // Get other projects for the dropdown
        const otherProjects = data.projects.filter(p => p.id !== currentProjectId);
        if (otherProjects.length === 0) {
            showToast('Borç transferi için en az 2 proje gerekli.', 'error');
            return;
        }

        const projectOptions = otherProjects.map(p =>
            `<option value="${p.id}">${escapeHtml(p.name)} (Kasa: ${formatCurrency(getProjectBalance(p.id))})</option>`
        ).join('');

        const html = `
            <form onsubmit="App.saveBorcTransfer(event)">
                <div style="margin-bottom:14px; padding:12px; background:rgba(99,102,241,0.06); border:1px solid rgba(99,102,241,0.15); border-radius:8px; font-size:0.82rem; line-height:1.5; color:var(--text-secondary);">
                    🔄 Projeler arası borç transferi oluşturun. Borç veren projeden gider, alan projeye gelir kaydı çift kayıt olarak otomatik oluşturulur.
                </div>

                <div class="form-group">
                    <label class="form-label">Bu Proje (Kaynak)</label>
                    <input class="form-input" type="text" value="${escapeHtml(currentProject.name)}" disabled>
                </div>

                <div class="form-group">
                    <label class="form-label" for="input-borc-direction">İşlem Yönü</label>
                    <select class="form-select" id="input-borc-direction">
                        <option value="ver">↗️ Bu projeden → Seçilen projeye BORÇ VER</option>
                        <option value="al">↙️ Seçilen projeden → Bu projeye BORÇ AL</option>
                    </select>
                </div>

                <div class="form-group">
                    <label class="form-label" for="input-borc-target">Karşı Proje</label>
                    <select class="form-select" id="input-borc-target">
                        ${projectOptions}
                    </select>
                </div>

                <div class="form-group">
                    <label class="form-label" for="input-borc-amount">Borç Tutarı (₺)</label>
                    <input class="form-input" type="text" inputmode="numeric" id="input-borc-amount" placeholder="0" required autofocus oninput="App.formatAmountInput(this)">
                </div>

                <div class="form-group">
                    <label class="form-label" for="input-borc-due-date">Geri Ödeme Tarihi <span style="font-weight:400; color:var(--text-muted);">— opsiyonel</span></label>
                    <input class="form-input" type="date" id="input-borc-due-date" value="">
                </div>

                <div class="form-group">
                    <label class="form-label" for="input-borc-description">Açıklama</label>
                    <input class="form-input" type="text" id="input-borc-description" placeholder="Örn: Malzeme alımı için borç">
                </div>

                <div class="form-actions">
                    <button type="button" class="btn btn-outline" onclick="App.closeModal()">İptal</button>
                    <button type="submit" class="btn btn-primary">🔄 Borç Transferi Oluştur</button>
                </div>
            </form>
        `;
        openModal('🔄 Projeler Arası Borç Transferi', html);
    }

    function saveBorcTransfer(e) {
        e.preventDefault();
        if (!currentProjectId) return;

        const direction = document.getElementById('input-borc-direction').value;
        const targetProjectId = document.getElementById('input-borc-target').value;
        const amount = parseAmountInput(document.getElementById('input-borc-amount'));
        const dueDate = document.getElementById('input-borc-due-date').value;
        const description = document.getElementById('input-borc-description').value.trim();

        if (amount <= 0) {
            showToast('Borç tutarı 0\'dan büyük olmalıdır.', 'error');
            return;
        }

        const currentProject = getProject(currentProjectId);
        const targetProject = getProject(targetProjectId);
        if (!currentProject || !targetProject) {
            showToast('Proje bulunamadı!', 'error');
            return;
        }

        const currentUser = getUserName();

        // Determine who lends and who borrows
        let lenderProjectId, borrowerProjectId, lenderName, borrowerName;
        if (direction === 'ver') {
            lenderProjectId = currentProjectId;
            borrowerProjectId = targetProjectId;
            lenderName = currentProject.name;
            borrowerName = targetProject.name;
        } else {
            lenderProjectId = targetProjectId;
            borrowerProjectId = currentProjectId;
            lenderName = targetProject.name;
            borrowerName = currentProject.name;
        }

        const descText = description || 'Projeler arası borç transferi';

        // Create LENDER transaction (borc-ver → expense, immediately paid)
        const lenderTx = {
            id: generateId(),
            type: 'borc-ver',
            projectId: lenderProjectId,
            amount: amount,
            paidAmount: amount,
            paymentStatus: 'odendi',
            dueDate: dueDate || '',
            description: `${descText} → ${borrowerName}`,
            period: 0,
            createdBy: currentUser,
            createdAt: new Date().toISOString(),
            linkedProjectId: borrowerProjectId,
            payments: [{ id: generateId(), amount: amount, date: todayStr(), createdBy: currentUser }]
        };

        // Create BORROWER transaction (borc-al → income, pending repayment)
        const borrowerTx = {
            id: generateId(),
            type: 'borc-al',
            projectId: borrowerProjectId,
            amount: amount,
            paidAmount: 0,
            paymentStatus: 'bekliyor',
            dueDate: dueDate || '',
            description: `${descText} ← ${lenderName}`,
            period: 0,
            createdBy: currentUser,
            createdAt: new Date().toISOString(),
            linkedProjectId: lenderProjectId,
            linkedTxId: lenderTx.id,
            payments: []
        };

        // Cross-link
        lenderTx.linkedTxId = borrowerTx.id;

        data.transactions.push(lenderTx);
        data.transactions.push(borrowerTx);
        saveData();

        closeModal();
        showToast(`🔄 ${formatCurrency(amount)} borç transferi oluşturuldu: ${lenderName} → ${borrowerName}`, 'success');
        renderProjectDetail(currentProjectId);
    }

    function onTxPeriodSelectChange(selectEl) {
        const val = selectEl?.value;
        if (!val || !currentProjectId) return;

        const amtInput = document.getElementById('input-tx-amount');
        if (!amtInput) return;

        if (typeof val === 'string' && val.startsWith('ilave-')) {
            const txId = val.replace('ilave-', '');
            const ilaveTx = data.transactions.find(t => t.id === txId);
            if (ilaveTx && ilaveTx.clientAddonAmount > 0) {
                const collected = data.transactions
                    .filter(t => t.projectId === currentProjectId && t.type === 'hakedis' && t.period === val && t.paymentStatus === 'odendi')
                    .reduce((s, t) => s + t.amount, 0);
                const remaining = Math.max(0, ilaveTx.clientAddonAmount - collected);
                amtInput.value = (remaining > 0 ? remaining : ilaveTx.clientAddonAmount).toLocaleString('tr-TR');
            }
        } else {
            const periodNum = parseInt(val, 10) || 0;
            if (periodNum > 0) {
                const project = getProject(currentProjectId);
                if (project && project.periods) {
                    const pObj = project.periods.find(p => p.number === periodNum);
                    if (pObj && pObj.amount > 0) {
                        const collected = data.transactions
                            .filter(t => t.projectId === currentProjectId && t.type === 'hakedis' && t.period === periodNum && t.paymentStatus === 'odendi')
                            .reduce((s, t) => s + t.amount, 0);
                        const remaining = Math.max(0, pObj.amount - collected);
                        amtInput.value = (remaining > 0 ? remaining : pObj.amount).toLocaleString('tr-TR');
                    }
                }
            }
        }
    }

    function getVendorSuggestions() {
        const set = new Set();
        if (data && Array.isArray(data.transactions)) {
            data.transactions.forEach(t => {
                if (t.vendor && typeof t.vendor === 'string' && t.vendor.trim()) {
                    set.add(t.vendor.trim());
                }
            });
        }
        return Array.from(set).sort((a, b) => a.localeCompare(b, 'tr'));
    }

    function switchTxType(targetType) {
        const typeInput = document.getElementById('input-tx-type');
        if (typeInput) typeInput.value = targetType;

        const container = document.getElementById('tx-type-selector-grid');
        if (container) {
            const btns = container.querySelectorAll('.btn-tx-type');
            btns.forEach(btn => {
                const val = btn.getAttribute('data-type');
                if (val === targetType) {
                    btn.classList.add('active');
                    btn.style.background = 'rgba(99,102,241,0.25)';
                    btn.style.borderColor = 'var(--accent)';
                    btn.style.color = '#ffffff';
                } else {
                    btn.classList.remove('active');
                    btn.style.background = 'rgba(255,255,255,0.03)';
                    btn.style.borderColor = 'var(--glass-border)';
                    btn.style.color = 'var(--text-muted)';
                }
            });
        }
    }

    function switchScopeType(scopeType) {
        const inputScope = document.getElementById('input-tx-scope-type');
        if (inputScope) inputScope.value = scopeType;

        const grid = document.getElementById('scope-type-selector-grid');
        if (grid) {
            const btns = grid.querySelectorAll('.btn-scope-type');
            btns.forEach(btn => {
                const val = btn.getAttribute('data-scope');
                if (val === scopeType) {
                    btn.classList.add('active');
                    btn.style.background = 'rgba(99,102,241,0.25)';
                    btn.style.borderColor = 'var(--accent)';
                    btn.style.color = '#ffffff';
                } else {
                    btn.classList.remove('active');
                    btn.style.background = 'rgba(255,255,255,0.03)';
                    btn.style.borderColor = 'var(--glass-border)';
                    btn.style.color = 'var(--text-muted)';
                }
            });
        }

        const estInput = document.getElementById('input-tx-estimated');
        const estNote = document.getElementById('note-tx-estimated');
        const addonGroup = document.getElementById('group-client-addon');

        if (scopeType === 'santiye-ici') {
            if (estInput) {
                estInput.value = '0';
                estInput.disabled = true;
            }
            if (estNote) estNote.style.display = 'block';
            if (addonGroup) addonGroup.style.display = 'none';
        } else if (scopeType === 'ilave-is') {
            if (estInput) {
                estInput.disabled = false;
            }
            if (estNote) estNote.style.display = 'none';
            if (addonGroup) addonGroup.style.display = 'block';
        } else {
            if (estInput) estInput.disabled = false;
            if (estNote) estNote.style.display = 'none';
            if (addonGroup) addonGroup.style.display = 'none';
        }
    }

    function getTransactionFormHtml({ type, allowTypeSelect, statusLocked, showDueDate, showEstimate, submitLabel = 'Kaydet', submitClass = 'btn-primary', defaultScopeType }) {
        const typeInfo = TX_TYPES[type] || {};

        const amountLabel = showEstimate ? 'Anlaşılan / Fatura Tutarı (₺) <span style="font-weight:400; color:var(--text-muted); text-transform:none; letter-spacing:0;">— opsiyonel</span>' : 'Tutar (₺)';
        const dueDateLabel = showEstimate ? 'Vade Tarihi <span style="font-weight:400; color:var(--text-muted); text-transform:none; letter-spacing:0;">— opsiyonel</span>' : 'Vade Tarihi';
        const requiredAttr = showEstimate ? '' : 'required';

        let periodSelectHtml = '';
        let initialAmountStr = '';

        const project = getProject(currentProjectId);
        const signed = isContractSigned(project);
        const activeScope = defaultScopeType || (signed ? (type === 'ilave-is' ? 'ilave-is' : 'santiye-ici') : 'sözleşme');

        const ilaveIsTxs = data.transactions.filter(t => t.projectId === currentProjectId && (t.type === 'ilave-is' || t.scopeType === 'ilave-is'));
        const ilaveOptionsHtml = ilaveIsTxs.map((t, index) => {
            const cleanTitle = t.description ? t.description.replace(/^✨ Ek Sözleşme:\s*/, '') : 'İlave İş';
            const label = `✨ ${index + 1}. İlave İş: ${escapeHtml(cleanTitle)} (+${formatCurrency(t.clientAddonAmount || 0)})`;
            return `<option value="ilave-${t.id}">${label}</option>`;
        }).join('');

        if ((project && project.periods && project.periods.length > 0) || ilaveIsTxs.length > 0) {
            let defaultPeriodNum = 0;

            if (type === 'hakedis' && project && project.periods) {
                // Find first uncollected period
                for (const p of project.periods) {
                    const collected = data.transactions
                        .filter(t => t.projectId === currentProjectId && t.type === 'hakedis' && t.period === p.number && t.paymentStatus === 'odendi')
                        .reduce((sum, t) => sum + t.amount, 0);
                    if (p.amount > collected) {
                        defaultPeriodNum = p.number;
                        const rem = p.amount - collected;
                        initialAmountStr = rem.toLocaleString('tr-TR');
                        break;
                    }
                }
                // Fallback to first period if all collected
                if (defaultPeriodNum === 0 && project.periods.length > 0) {
                    defaultPeriodNum = project.periods[0].number;
                    initialAmountStr = project.periods[0].amount ? project.periods[0].amount.toLocaleString('tr-TR') : '';
                }
            }

            const options = (project && project.periods) ? project.periods.map(p => {
                const isSel = (p.number === defaultPeriodNum) ? 'selected' : '';
                return `<option value="${p.number}" ${isSel}>${escapeHtml(p.label)} (${formatCurrency(p.amount)})</option>`;
            }).join('') : '';

            periodSelectHtml = `
                <div class="form-group">
                    <label class="form-label" for="input-tx-period">Ödeme Dönemi / İlave İş Ataması</label>
                    <select class="form-select" id="input-tx-period" onchange="App.onTxPeriodSelectChange(this)">
                        <option value="0" ${defaultPeriodNum === 0 ? 'selected' : ''}>Dönem Atanmamış (Genel Bakiye)</option>
                        ${options ? `<optgroup label="📋 Ana Sözleşme Dönemleri">${options}</optgroup>` : ''}
                        ${ilaveOptionsHtml ? `<optgroup label="✨ İlave İş Sözleşmeleri">${ilaveOptionsHtml}</optgroup>` : ''}
                    </select>
                </div>
            `;
        }

        const vendorSuggestions = getVendorSuggestions();
        const datalistHtml = vendorSuggestions.length > 0 ? `
            <datalist id="vendor-suggestions-list">
                ${vendorSuggestions.map(v => `<option value="${escapeHtml(v)}">`).join('')}
            </datalist>
        ` : '';

        let typeFieldHtml = '';
        if (allowTypeSelect || ['malzeme', 'iscilik', 'iscilik-malzeme', 'ofis-sabit'].includes(type)) {
            typeFieldHtml = `
                <div class="form-group">
                    <label class="form-label">İşlem Tipi Seçin</label>
                    <div id="tx-type-selector-grid" style="display:grid; grid-template-columns: 1fr 1fr; gap:8px;">
                        <button type="button" class="btn-tx-type ${type === 'malzeme' ? 'active' : ''}" data-type="malzeme" onclick="App.switchTxType('malzeme')" style="padding:10px 12px; font-size:0.82rem; border-radius:8px; display:flex; align-items:center; gap:6px; cursor:pointer; font-weight:600; text-align:left; background:${type === 'malzeme' ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.03)'}; border:1px solid ${type === 'malzeme' ? 'var(--accent)' : 'var(--glass-border)'}; color:${type === 'malzeme' ? '#ffffff' : 'var(--text-muted)'};">
                            <span>🧱</span> <span>Malzeme</span>
                        </button>
                        <button type="button" class="btn-tx-type ${type === 'iscilik' ? 'active' : ''}" data-type="iscilik" onclick="App.switchTxType('iscilik')" style="padding:10px 12px; font-size:0.82rem; border-radius:8px; display:flex; align-items:center; gap:6px; cursor:pointer; font-weight:600; text-align:left; background:${type === 'iscilik' ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.03)'}; border:1px solid ${type === 'iscilik' ? 'var(--accent)' : 'var(--glass-border)'}; color:${type === 'iscilik' ? '#ffffff' : 'var(--text-muted)'};">
                            <span>👷</span> <span>İşçilik Gideri (Usta)</span>
                        </button>
                        <button type="button" class="btn-tx-type ${type === 'iscilik-malzeme' ? 'active' : ''}" data-type="iscilik-malzeme" onclick="App.switchTxType('iscilik-malzeme')" style="padding:10px 12px; font-size:0.82rem; border-radius:8px; display:flex; align-items:center; gap:6px; cursor:pointer; font-weight:600; text-align:left; background:${type === 'iscilik-malzeme' ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.03)'}; border:1px solid ${type === 'iscilik-malzeme' ? 'var(--accent)' : 'var(--glass-border)'}; color:${type === 'iscilik-malzeme' ? '#ffffff' : 'var(--text-muted)'};">
                            <span>🛠️</span> <span>İşçilik + Malzeme (Taşeron)</span>
                        </button>
                        <button type="button" class="btn-tx-type ${type === 'ofis-sabit' ? 'active' : ''}" data-type="ofis-sabit" onclick="App.switchTxType('ofis-sabit')" style="padding:10px 12px; font-size:0.82rem; border-radius:8px; display:flex; align-items:center; gap:6px; cursor:pointer; font-weight:600; text-align:left; background:${type === 'ofis-sabit' ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.03)'}; border:1px solid ${type === 'ofis-sabit' ? 'var(--accent)' : 'var(--glass-border)'}; color:${type === 'ofis-sabit' ? '#ffffff' : 'var(--text-muted)'};">
                            <span>🏢</span> <span>Ofis Sabit Gideri</span>
                        </button>
                    </div>
                    <input type="hidden" id="input-tx-type" value="${type}">
                </div>`;
        } else {
            typeFieldHtml = `
                <div class="form-group">
                    <label class="form-label">İşlem Tipi</label>
                    <input class="form-input" type="text" value="${typeInfo.label}" disabled>
                    <input type="hidden" id="input-tx-type" value="${type}">
                </div>`;
        }

        let scopeSelectHtml = '';
        if (signed && type !== 'hakedis') {
            scopeSelectHtml = `
                <div class="form-group" style="margin-bottom:12px;">
                    <label class="form-label">Kapsam Türü Seçin</label>
                    <div id="scope-type-selector-grid" style="display:grid; grid-template-columns: 1fr 1fr; gap:8px;">
                        <button type="button" class="btn-scope-type ${activeScope === 'santiye-ici' ? 'active' : ''}" data-scope="santiye-ici" onclick="App.switchScopeType('santiye-ici')" style="padding:10px; font-size:0.8rem; border-radius:8px; display:flex; align-items:center; gap:6px; font-weight:600; cursor:pointer; background:${activeScope === 'santiye-ici' ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.03)'}; border:1px solid ${activeScope === 'santiye-ici' ? 'var(--accent)' : 'var(--glass-border)'}; color:${activeScope === 'santiye-ici' ? '#ffffff' : 'var(--text-muted)'};">
                            <span>🔨</span> <span>Şantiye İçi / Unutulan İş</span>
                        </button>
                        <button type="button" class="btn-scope-type ${activeScope === 'ilave-is' ? 'active' : ''}" data-scope="ilave-is" onclick="App.switchScopeType('ilave-is')" style="padding:10px; font-size:0.8rem; border-radius:8px; display:flex; align-items:center; gap:6px; font-weight:600; cursor:pointer; background:${activeScope === 'ilave-is' ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.03)'}; border:1px solid ${activeScope === 'ilave-is' ? 'var(--accent)' : 'var(--glass-border)'}; color:${activeScope === 'ilave-is' ? '#ffffff' : 'var(--text-muted)'};">
                            <span>✨</span> <span>Müşteri İlave İşi</span>
                        </button>
                    </div>
                    <input type="hidden" id="input-tx-scope-type" value="${activeScope}">
                </div>
            `;
        } else {
            scopeSelectHtml = `<input type="hidden" id="input-tx-scope-type" value="${activeScope}">`;
        }

        const isSantiyeIci = (signed && type !== 'hakedis' && activeScope !== 'ilave-is') || activeScope === 'santiye-ici';

        let vendorFieldHtml = '';
        if (type !== 'hakedis') {
            vendorFieldHtml = `
                <div class="form-group">
                    <label class="form-label" for="input-tx-vendor">Firma / Usta / Taşeron (Alacaklı) <span style="font-weight:400; color:var(--text-muted); text-transform:none; letter-spacing:0;">— opsiyonel</span></label>
                    <input class="form-input" type="text" id="input-tx-vendor" list="vendor-suggestions-list" placeholder="Örn: ABC Yapı, Ahmet Usta, Demir A.Ş." autocomplete="off">
                    ${datalistHtml}
                </div>`;
        }

        return `
            <form onsubmit="App.saveTransaction(event, '${type}', '${statusLocked}')">
                ${typeFieldHtml}
                ${scopeSelectHtml}
                <div class="form-group" id="group-client-addon" style="display:${activeScope === 'ilave-is' ? 'block' : 'none'}; background:rgba(245,158,11,0.08); border:1px solid rgba(245,158,11,0.2); padding:10px 12px; border-radius:8px; margin-bottom:14px;">
                    <label class="form-label" for="input-client-addon-amount" style="color:#f59e0b; font-weight:700;">Müşteriden Alınacak Ek Sözleşme Tutarı (₺)</label>
                    <input class="form-input" type="text" inputmode="numeric" id="input-client-addon-amount" placeholder="0" oninput="App.formatAmountInput(this)">
                    <div style="font-size:0.7rem; color:var(--text-muted); margin-top:2px;">Bu tutar müşterinin toplam sözleşme alacağına eklenir.</div>
                </div>
                ${vendorFieldHtml}
                ${periodSelectHtml}
                ${showEstimate ? `
                <div class="form-group" id="group-tx-estimated">
                    <label class="form-label" for="input-tx-estimated">Tahmini Maliyet (₺) <span style="font-weight:400; color:var(--text-muted); text-transform:none; letter-spacing:0;">— bütçe tahmini</span></label>
                    <input class="form-input" type="text" inputmode="numeric" id="input-tx-estimated" value="${isSantiyeIci ? '0' : ''}" placeholder="Opsiyonel" ${isSantiyeIci ? 'disabled' : ''} oninput="App.formatAmountInput(this)">
                    <div id="note-tx-estimated" style="display:${isSantiyeIci ? 'block' : 'none'}; font-size:0.72rem; color:#f59e0b; margin-top:3px; font-weight:600;">🔒 Sözleşme imzalandığı için şantiye içi harcamalarda tahmini maliyet 0 ₺ kilitlenmiştir.</div>
                </div>
                ` : ''}
                <div class="form-group">
                    <label class="form-label" for="input-tx-amount">${amountLabel}</label>
                    <input class="form-input" type="text" inputmode="numeric" id="input-tx-amount" value="${initialAmountStr}" placeholder="0" ${requiredAttr} autofocus oninput="App.formatAmountInput(this)">
                </div>
                ${showDueDate ? `
                <div class="form-group" id="group-due-date">
                    <label class="form-label" for="input-tx-due-date">${dueDateLabel}</label>
                    <input class="form-input" type="date" id="input-tx-due-date" value="">
                </div>
                ` : ''}
                <div class="form-group">
                    <label class="form-label" for="input-tx-description">Açıklama / İş Kalemi</label>
                    <input class="form-input" type="text" id="input-tx-description" list="description-suggestions-list" placeholder="Örn: Beton Kalıp, Parke, Elektrik, Alçı Boya..." autocomplete="off">
                    ${getDescriptionSuggestionsHtml()}
                </div>
                <div class="form-actions">
                    <button type="button" class="btn btn-outline" onclick="App.closeModal()">İptal</button>
                    <button type="submit" class="btn ${submitClass}">${submitLabel}</button>
                </div>
            </form>`;
    }

    function saveTransaction(e, defaultType, statusLocked) {
        e.preventDefault();
        if (!currentProjectId) return;

        const typeEl = document.getElementById('input-tx-type');
        const type = (typeEl && typeEl.value) ? typeEl.value : defaultType;

        const amount = parseAmountInput(document.getElementById('input-tx-amount'));
        const estimatedAmount = parseAmountInput(document.getElementById('input-tx-estimated'));

        const vendorEl = document.getElementById('input-tx-vendor');
        const vendor = vendorEl ? vendorEl.value.trim() : '';

        const description = document.getElementById('input-tx-description').value;
        const dueDateEl = document.getElementById('input-tx-due-date');
        const dueDate = dueDateEl ? dueDateEl.value : '';

        const periodEl = document.getElementById('input-tx-period');
        let period = 0;
        if (periodEl) {
            const pVal = periodEl.value;
            period = (typeof pVal === 'string' && pVal.startsWith('ilave-')) ? pVal : (parseInt(pVal, 10) || 0);
        }

        const scopeEl = document.getElementById('input-tx-scope-type');
        const scopeType = scopeEl ? scopeEl.value : undefined;

        const addonAmtEl = document.getElementById('input-client-addon-amount');
        const clientAddonAmount = addonAmtEl ? parseAmountInput(addonAmtEl) : 0;

        // Allow 0 amounts (e.g. for logging items without cost/income or adjustments)
        if (type === 'hakedis' && amount < 0) {
            showToast('Tahsilat tutarı sıfırdan küçük olamaz.', 'error');
            return;
        }

        if (type !== 'hakedis' && amount < 0 && (!estimatedAmount || estimatedAmount < 0)) {
            showToast('Lütfen geçerli bir tutar veya tahmini maliyet girin.', 'error');
            return;
        }

        addTransaction(type, currentProjectId, amount, statusLocked, dueDate, description, estimatedAmount, period, vendor, scopeType, clientAddonAmount);

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
        const paidSoFar = getTxPaidAmount(tx);
        const remaining = getTxRemainingAmount(tx);

        // Build payment history section
        let paymentHistoryHtml = '';
        if (tx.payments && tx.payments.length > 0) {
            const rows = tx.payments.map((p, i) => `
                <div style="display:flex; justify-content:space-between; align-items:center; padding:6px 10px; background:rgba(16,185,129,0.06); border-radius:6px; margin-bottom:4px; font-size:0.82rem;">
                    <div>
                        <span style="color:var(--success); font-weight:600;">#${i + 1} · ${formatCurrency(p.amount)}</span>
                        ${p.note ? `<div style="font-size:0.75rem; color:var(--text-main); font-weight:600; margin-top:2px;">📝 ${escapeHtml(p.note)}</div>` : ''}
                    </div>
                    <span style="color:var(--text-muted); font-size:0.75rem;">📅 ${formatDate(p.date)} · 👤 ${escapeHtml(p.createdBy || 'Bilinmiyor')}</span>
                </div>
            `).join('');
            paymentHistoryHtml = `
                <div style="margin-bottom:14px;">
                    <div style="font-size:0.72rem; text-transform:uppercase; letter-spacing:0.5px; color:var(--success); font-weight:700; margin-bottom:6px;">
                        ✅ ÖNCEKİ ÖDEMELER
                    </div>
                    ${rows}
                </div>
            `;
        }

        // Summary box
        const summaryHtml = `
            <div style="background: rgba(99,102,241,0.06); border: 1.5px solid rgba(99,102,241,0.2); border-radius: var(--radius-sm); padding: 14px; margin-bottom: 16px;">
                <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:8px; text-align:center;">
                    <div>
                        <div style="font-size:0.68rem; text-transform:uppercase; letter-spacing:0.5px; color:var(--text-muted); font-weight:600;">Toplam Tutar</div>
                        <div style="font-size:1.1rem; font-weight:800; color:var(--text-main);">${formatCurrency(tx.amount)}</div>
                    </div>
                    <div>
                        <div style="font-size:0.68rem; text-transform:uppercase; letter-spacing:0.5px; color:var(--success); font-weight:600;">Ödenen</div>
                        <div style="font-size:1.1rem; font-weight:800; color:var(--success);">${formatCurrency(paidSoFar)}</div>
                    </div>
                    <div>
                        <div style="font-size:0.68rem; text-transform:uppercase; letter-spacing:0.5px; color:var(--danger); font-weight:600;">Kalan Borç</div>
                        <div style="font-size:1.1rem; font-weight:800; color:var(--danger);">${formatCurrency(remaining)}</div>
                    </div>
                </div>
            </div>
        `;

        const workIcon = getWorkCategoryIcon(tx.description);
        const descWithIcon = workIcon ? `${workIcon} ${escapeHtml(tx.description || typeInfo.label)}` : escapeHtml(tx.description || typeInfo.label);

        const html = `
            <div class="import-info" style="margin-bottom: 10px;">
                💳 <strong>${descWithIcon}</strong>
                ${tx.vendor ? `<span style="font-size:0.8rem; font-weight:700; color:var(--accent); background:rgba(99,102,241,0.15); padding:2px 8px; border-radius:4px; margin-left:6px;">🏢 ${escapeHtml(tx.vendor)}</span>` : ''}<br>
                <span style="font-size:0.82rem; color:var(--text-muted);">Vade: ${formattedDate} · 👤 ${escapeHtml(tx.createdBy || 'Bilinmiyor')}</span>
            </div>
            ${summaryHtml}
            ${paymentHistoryHtml}
            <form onsubmit="App.executePayment(event, '${txId}')">
                <div class="form-group" style="margin-bottom: 15px;">
                    <label class="form-label">Ödeme Tipi</label>
                    <div style="display: flex; gap: 10px;">
                        <label style="flex:1; display:flex; align-items:center; gap:8px; padding:10px 12px; background:rgba(255,255,255,0.03); border:1px solid var(--glass-border); border-radius:var(--radius-sm); cursor:pointer;">
                            <input type="radio" name="pay-mode" value="full" ${remaining <= 0 ? 'checked' : ''} onchange="App.onPayModeChange(${remaining})">
                            <span style="font-size:0.85rem; font-weight:600;">✓ Tam Ödeme (Kalanın Tamamı)</span>
                        </label>
                        <label style="flex:1; display:flex; align-items:center; gap:8px; padding:10px 12px; background:rgba(255,255,255,0.03); border:1px solid var(--glass-border); border-radius:var(--radius-sm); cursor:pointer;">
                            <input type="radio" name="pay-mode" value="partial" ${remaining > 0 ? '' : ''} onchange="App.onPayModeChange(${remaining})">
                            <span style="font-size:0.85rem; font-weight:600; color:var(--warning);">⚠️ Eksik / Kısmi Ödeme</span>
                        </label>
                    </div>
                </div>

                <div class="form-group">
                    <label class="form-label" for="input-pay-amount">Ödenen / Tahsil Edilen Tutar (₺)</label>
                    <input class="form-input" type="text" inputmode="numeric" id="input-pay-amount"
                           value="${remaining > 0 ? remaining.toLocaleString('tr-TR') : tx.amount.toLocaleString('tr-TR')}"
                           oninput="App.onPayAmountInput(this, ${remaining > 0 ? remaining : tx.amount})" onkeydown="App.onAmountKeyDown(event)" required autofocus>
                </div>
                <div class="form-group" style="margin-top:12px;">
                    <label class="form-label" for="input-pay-note">Ödeme / Dekont Açıklaması <span style="font-weight:400; color:var(--text-muted); text-transform:none; letter-spacing:0;">— opsiyonel</span></label>
                    <input class="form-input" type="text" id="input-pay-note" placeholder="Örn: Garanti Bankası Havale, Nakit, Dekont No: 12345">
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

    function onPayModeChange(referenceAmount) {
        const mode = document.querySelector('input[name="pay-mode"]:checked')?.value;
        const amountInput = document.getElementById('input-pay-amount');
        if (mode === 'full') {
            if (amountInput) amountInput.value = referenceAmount.toLocaleString('tr-TR');
            onPayAmountInput(amountInput, referenceAmount);
        } else {
            if (amountInput) {
                amountInput.focus();
                amountInput.select();
            }
            onPayAmountInput(amountInput, referenceAmount);
        }
    }

    function onPayAmountInput(el, referenceAmount) {
        formatAmountInput(el);
        const payAmount = parseAmountInput(el);
        const remaining = referenceAmount - payAmount;
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
        const payNoteEl = document.getElementById('input-pay-note');
        const payNote = payNoteEl ? payNoteEl.value.trim() : '';
        const currentUser = getUserName();
        const remaining = getTxRemainingAmount(tx);

        if (payAmount < 0) {
            showToast('Ödeme tutarı sıfırdan küçük olamaz.', 'error');
            return;
        }

        if (payAmount > remaining) {
            showToast(`Ödeme tutarı kalan borç tutarını (${formatCurrency(remaining)}) aşamaz.`, 'error');
            return;
        }

        // Record this payment in the payments array
        if (!Array.isArray(tx.payments)) tx.payments = [];
        tx.payments.push({
            id: generateId(),
            amount: payAmount,
            date: todayStr(),
            note: payNote,
            createdBy: currentUser
        });

        // Update paidAmount
        tx.paidAmount = (parseFloat(tx.paidAmount) || 0) + payAmount;

        if (payAmount >= remaining) {
            // Full payment of remaining — mark as fully paid
            tx.paymentStatus = 'odendi';
            tx.paidAmount = tx.amount;
            saveData();
            showToast(`Tam ödeme kaydedildi: ${formatCurrency(tx.amount)} · 👤 ${currentUser}`, 'success');
        } else {
            // Partial payment — update due date for remaining
            const newDueDate = document.getElementById('input-partial-due-date')?.value || '';
            if (!newDueDate) {
                // Revert
                tx.payments.pop();
                tx.paidAmount = (parseFloat(tx.paidAmount) || 0) - payAmount;
                showToast('Lütfen eksik kalan tutar için tamamlanma vade tarihini seçin.', 'error');
                return;
            }

            tx.dueDate = newDueDate;
            tx.paymentStatus = 'bekliyor';
            saveData();

            const newRemaining = getTxRemainingAmount(tx);
            const dateText = formatDate(newDueDate);
            showToast(
                `Kısmi ödeme alındı! Ödenen: ${formatCurrency(payAmount)} · Kalan: ${formatCurrency(newRemaining)} (Vade: ${dateText}) · 👤 ${currentUser}`,
                'warning'
            );
        }

        // ── LINKED LOAN REPAYMENT: Update the linked transaction ──
        if (tx.linkedTxId && (tx.type === 'borc-al' || tx.type === 'borc-ver')) {
            const linkedTx = data.transactions.find(t => t.id === tx.linkedTxId);
            if (linkedTx) {
                // When borc-al is repaid, the lender (borc-ver) should see their money coming back
                // We add a payment record to the linked tx to track the repayment
                if (!Array.isArray(linkedTx.payments)) linkedTx.payments = [];
                linkedTx.payments.push({
                    id: generateId(),
                    amount: payAmount,
                    date: todayStr(),
                    createdBy: currentUser,
                    note: `Geri ödeme (${getProject(tx.projectId)?.name || ''})`
                });
                // Sync paidAmount and status
                linkedTx.paidAmount = (parseFloat(linkedTx.paidAmount) || 0);
                if (tx.paymentStatus === 'odendi') {
                    // Fully repaid — both sides should show completion
                    linkedTx.description = linkedTx.description.replace(/\s*\(Geri Ödenmedi\)/g, '');
                }
                saveData();
            }
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
        // Prevent accidental closing when clicking outside the modal box while entering data.
        // User must explicitly click "İptal", "✕" or "Kaydet".
        return;
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
                        <option value="0">Dönem Atanmamış (Vade Yoksa: İş Bitimi)</option>
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
                            <option value="malzeme">Tüm Satırlar: Malzeme</option>
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
                        <label class="form-label">Varsayılan Vade <span style="font-weight:400; color:var(--text-muted); text-transform:none;">(Boşsa: İş Bitimi)</span></label>
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

        // Resolve İş Bitimi (completion period) fallback if no explicit period or dueDate is provided
        const project = getProject(currentProjectId);
        let completionPeriodNum = 0;
        let completionDate = '';

        if (project) {
            if (project.periods && project.periods.length > 0) {
                const compP = project.periods.find(p => p.isCompletion || p.number === (project.periodCount + 1)) || project.periods[project.periods.length - 1];
                if (compP) {
                    completionPeriodNum = compP.number;
                    completionDate = compP.date || '';
                }
            } else {
                completionPeriodNum = (project.periodCount || 1) + 1;
            }
        }

        let defaultPeriod = period;
        let defaultDueDate = dueDate;

        // If no explicit dueDate and period is unassigned (0), default to İş Bitimi (completion period)
        if (!defaultDueDate && defaultPeriod === 0 && completionPeriodNum > 0) {
            defaultPeriod = completionPeriodNum;
            if (completionDate) {
                defaultDueDate = completionDate;
            }
        }

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
                addTransaction(rowType, currentProjectId, 0, 'bekliyor', defaultDueDate, desc, parsedVal, defaultPeriod);
            } else {
                // Default: Agreed/Actual cost — amount gets parsedVal directly!
                addTransaction(rowType, currentProjectId, parsedVal, 'bekliyor', defaultDueDate, desc, parsedVal, defaultPeriod);
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
        const isExpense = ['malzeme', 'iscilik', 'iscilik-malzeme', 'ofis-sabit'].includes(tx.type);
        const showEstimateField = ['malzeme', 'iscilik', 'iscilik-malzeme'].includes(tx.type);
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

        const vendorSuggestions = getVendorSuggestions();
        const datalistHtml = vendorSuggestions.length > 0 ? `
            <datalist id="vendor-suggestions-list">
                ${vendorSuggestions.map(v => `<option value="${escapeHtml(v)}">`).join('')}
            </datalist>
        ` : '';

        // Type options
        const isLoan = ['borc-ver', 'borc-al'].includes(tx.type);
        let typeSelectHtml = '';
        if (isLoan) {
            typeSelectHtml = `<input class="form-input" type="text" value="${typeInfo.label}" disabled><input type="hidden" id="input-tx-type" value="${tx.type}">`;
        } else {
            typeSelectHtml = `
                <div id="tx-type-selector-grid" style="display:grid; grid-template-columns: 1fr 1fr; gap:8px;">
                    <button type="button" class="btn-tx-type ${tx.type === 'malzeme' ? 'active' : ''}" data-type="malzeme" onclick="App.switchTxType('malzeme')" style="padding:10px 12px; font-size:0.82rem; border-radius:8px; display:flex; align-items:center; gap:6px; cursor:pointer; font-weight:600; text-align:left; background:${tx.type === 'malzeme' ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.03)'}; border:1px solid ${tx.type === 'malzeme' ? 'var(--accent)' : 'var(--glass-border)'}; color:${tx.type === 'malzeme' ? '#ffffff' : 'var(--text-muted)'};">
                        <span>🧱</span> <span>Malzeme</span>
                    </button>
                    <button type="button" class="btn-tx-type ${tx.type === 'iscilik' ? 'active' : ''}" data-type="iscilik" onclick="App.switchTxType('iscilik')" style="padding:10px 12px; font-size:0.82rem; border-radius:8px; display:flex; align-items:center; gap:6px; cursor:pointer; font-weight:600; text-align:left; background:${tx.type === 'iscilik' ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.03)'}; border:1px solid ${tx.type === 'iscilik' ? 'var(--accent)' : 'var(--glass-border)'}; color:${tx.type === 'iscilik' ? '#ffffff' : 'var(--text-muted)'};">
                        <span>👷</span> <span>İşçilik Gideri (Usta)</span>
                    </button>
                    <button type="button" class="btn-tx-type ${tx.type === 'iscilik-malzeme' ? 'active' : ''}" data-type="iscilik-malzeme" onclick="App.switchTxType('iscilik-malzeme')" style="padding:10px 12px; font-size:0.82rem; border-radius:8px; display:flex; align-items:center; gap:6px; cursor:pointer; font-weight:600; text-align:left; background:${tx.type === 'iscilik-malzeme' ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.03)'}; border:1px solid ${tx.type === 'iscilik-malzeme' ? 'var(--accent)' : 'var(--glass-border)'}; color:${tx.type === 'iscilik-malzeme' ? '#ffffff' : 'var(--text-muted)'};">
                        <span>🛠️</span> <span>İşçilik + Malzeme (Taşeron)</span>
                    </button>
                    <button type="button" class="btn-tx-type ${tx.type === 'ofis-sabit' ? 'active' : ''}" data-type="ofis-sabit" onclick="App.switchTxType('ofis-sabit')" style="padding:10px 12px; font-size:0.82rem; border-radius:8px; display:flex; align-items:center; gap:6px; cursor:pointer; font-weight:600; text-align:left; background:${tx.type === 'ofis-sabit' ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.03)'}; border:1px solid ${tx.type === 'ofis-sabit' ? 'var(--accent)' : 'var(--glass-border)'}; color:${tx.type === 'ofis-sabit' ? '#ffffff' : 'var(--text-muted)'};">
                        <span>🏢</span> <span>Ofis Sabit Gideri</span>
                    </button>
                </div>
                <input type="hidden" id="input-tx-type" value="${tx.type}">`;
        }

        const html = `
            <form onsubmit="App.updateTransaction(event, '${txId}')">
                <div class="form-group">
                    <label class="form-label" for="input-tx-type">İşlem Tipi</label>
                    ${typeSelectHtml}
                </div>
                <div class="form-group">
                    <label class="form-label" for="input-tx-vendor">Firma / Usta / Taşeron (Alacaklı) <span style="font-weight:400; color:var(--text-muted); text-transform:none; letter-spacing:0;">— opsiyonel</span></label>
                    <input class="form-input" type="text" id="input-tx-vendor" list="vendor-suggestions-list" value="${escapeHtml(tx.vendor || '')}" autocomplete="off">
                    ${datalistHtml}
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
                    <label class="form-label" for="input-tx-description">Açıklama / İş Kalemi</label>
                    <input class="form-input" type="text" id="input-tx-description" list="description-suggestions-list" value="${escapeHtml(tx.description || '')}" autocomplete="off">
                    ${getDescriptionSuggestionsHtml()}
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

        const typeEl = document.getElementById('input-tx-type');
        if (typeEl && typeEl.value) {
            tx.type = typeEl.value;
        }

        const amount = parseAmountInput(document.getElementById('input-tx-amount'));
        const estimatedEl = document.getElementById('input-tx-estimated');
        const estimatedAmount = estimatedEl ? parseAmountInput(estimatedEl) : 0;

        // Allow 0 amounts for edited transactions as well
        if (tx.type === 'hakedis' && amount < 0) {
            showToast('Tahsilat tutarı sıfırdan küçük olamaz.', 'error');
            return;
        }

        if (tx.type !== 'hakedis' && amount < 0 && estimatedAmount < 0) {
            showToast('Lütfen geçerli bir tutar girin.', 'error');
            return;
        }

        tx.amount = amount;
        tx.description = document.getElementById('input-tx-description').value.trim();
        const vendorEl = document.getElementById('input-tx-vendor');
        tx.vendor = vendorEl ? vendorEl.value.trim() : '';
        tx.dueDate = document.getElementById('input-tx-due-date').value || '';
        tx.paymentStatus = document.getElementById('input-tx-status').value;

        const periodEl = document.getElementById('input-tx-period');
        if (periodEl) {
            const pVal = periodEl.value;
            tx.period = (typeof pVal === 'string' && pVal.startsWith('ilave-')) ? pVal : (parseInt(pVal, 10) || 0);
        } else {
            tx.period = 0;
        }

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
        onDownpaymentAmountInput,
        onCompletionAmountInput,
        onPeriodCountInput,
        onPeriodAmountInput,
        deleteProject,
        processDeleteProject,
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
        switchTxType,
        switchScopeType,
        isContractSigned,
        signContract,
        openIlaveIsModal,
        saveIlaveIs,
        getProjectContractAmount,
        setActiveTxSort,
        handleOverlayClick,
        openHakedis,
        openGider,
        openMalzeme,
        openIscilik,
        openTaseron,
        openOfisSabit,
        openBorcTransfer,
        saveBorcTransfer,
        saveTransaction,
        markAsPaid,
        openPaymentHistory,
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
