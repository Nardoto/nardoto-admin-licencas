// ========================================
// NARDOTO TOOLS - ADMIN DE LICENÇAS
// Version: 1.1.0 - Controle de Cobrança
// Desenvolvido por: Nardoto
// ========================================

let currentUser = null;
let allUsers = [];
let currentFilter = 'all';

// Admin emails
const ADMIN_EMAILS = [
    'tharcisionardoto@gmail.com',
    'nardotoengenharia@gmail.com'
];

// ========================================
// AUTENTICAÇÃO
// ========================================

window.firebaseOnAuthStateChanged(window.firebaseAuth, (user) => {
    console.log('Auth state changed:', user ? user.email : 'não logado');

    if (user) {
        if (ADMIN_EMAILS.includes(user.email)) {
            console.log('✅ Admin autorizado:', user.email);
            currentUser = user;
            showAdminPanel();
            loadUsers();
        } else {
            console.log('❌ Email não autorizado:', user.email);
            showToast('❌ Acesso negado!', 'error');
            setTimeout(() => logout(), 2000);
        }
    } else {
        showLoginScreen();
    }
});

function showLoginScreen() {
    document.getElementById('loginScreen').style.display = 'flex';
    document.getElementById('adminPanel').style.display = 'none';
}

function showAdminPanel() {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('adminPanel').style.display = 'block';
}

async function loginWithGoogle() {
    try {
        console.log('Iniciando login...');
        await window.firebaseSignInWithPopup(window.firebaseAuth, window.firebaseProvider);
    } catch (error) {
        console.error('Erro no login:', error);
        showToast('❌ Erro: ' + error.message, 'error');
    }
}

window.loginWithGoogle = loginWithGoogle;

async function logout() {
    await window.firebaseSignOut(window.firebaseAuth);
    showToast('✅ Logout!', 'success');
}

window.logout = logout;

// ========================================
// FUNÇÕES DE DATA
// ========================================

function getTimestamp(dateValue) {
    if (!dateValue) return 0;
    if (dateValue.toDate && typeof dateValue.toDate === 'function') {
        return dateValue.toDate().getTime();
    }
    if (dateValue.seconds) {
        return dateValue.seconds * 1000;
    }
    const date = new Date(dateValue);
    return isNaN(date.getTime()) ? 0 : date.getTime();
}

function formatDate(dateValue) {
    if (!dateValue) return '-';
    let date;
    if (dateValue.toDate && typeof dateValue.toDate === 'function') {
        date = dateValue.toDate();
    } else if (dateValue.seconds) {
        date = new Date(dateValue.seconds * 1000);
    } else {
        date = new Date(dateValue);
    }
    if (isNaN(date.getTime())) return '-';
    return date.toLocaleDateString('pt-BR');
}

// ========================================
// CLASSIFICAR USUÁRIO
// ========================================

function classifyUser(user) {
    if (!user.isPro) return 'free';

    const source = user.proActivatedBy || '';

    if (source === 'kiwify' || source === 'kiwify_import') return 'kiwify';
    if (source === 'trial') {
        const expired = user.trialExpiresAt && new Date(user.trialExpiresAt) < new Date();
        return expired ? 'trial_expired' : 'trial';
    }
    if (source === 'admin_manual' || source === 'admin_bulk') return 'manual';

    // PRO sem fonte definida = manual
    return 'manual';
}

function getSourceLabel(user) {
    const source = user.proActivatedBy || '';

    if (source === 'kiwify') return 'Kiwify (Auto)';
    if (source === 'kiwify_import') return 'Kiwify (Import)';
    if (source === 'trial') return 'Teste Grátis';
    if (source === 'admin_manual') return 'Manual';
    if (source === 'admin_bulk') return 'Manual (Lote)';

    if (user.isPro) return 'Manual';
    return '-';
}

// ========================================
// CARREGAR USUÁRIOS
// ========================================

async function loadUsers() {
    const loading = document.getElementById('loading');
    const userList = document.getElementById('userList');

    loading.classList.add('show');
    userList.innerHTML = '';

    try {
        const usersRef = window.firebaseCollection(window.firebaseDb, 'users');
        const snapshot = await window.firebaseGetDocs(usersRef);

        allUsers = [];
        snapshot.forEach((doc) => {
            allUsers.push({ id: doc.id, ...doc.data() });
        });

        // Ordenar por data de criação (mais recentes primeiro)
        allUsers.sort((a, b) => getTimestamp(b.createdAt) - getTimestamp(a.createdAt));

        updateStats();
        applyFilter(currentFilter);

        showToast(`✅ ${allUsers.length} usuários carregados!`, 'success');
    } catch (error) {
        console.error('Erro:', error);
        showToast('❌ Erro ao carregar', 'error');
    } finally {
        loading.classList.remove('show');
    }
}

window.loadUsers = loadUsers;

function updateStats() {
    const total = allUsers.length;
    const kiwify = allUsers.filter(u => classifyUser(u) === 'kiwify').length;
    const manual = allUsers.filter(u => classifyUser(u) === 'manual').length;
    const trial = allUsers.filter(u => classifyUser(u) === 'trial').length;
    const trialExpired = allUsers.filter(u => classifyUser(u) === 'trial_expired').length;
    const free = allUsers.filter(u => classifyUser(u) === 'free').length;

    document.getElementById('totalUsers').textContent = total;
    document.getElementById('kiwifyUsers').textContent = kiwify;
    document.getElementById('manualUsers').textContent = manual;
    document.getElementById('trialUsers').textContent = trial + trialExpired;
    document.getElementById('freeUsers').textContent = free;
}

// ========================================
// FILTROS
// ========================================

function applyFilter(filter) {
    currentFilter = filter;

    // Atualizar botões
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.filter === filter) btn.classList.add('active');
    });

    let filtered = allUsers;

    if (filter === 'kiwify') {
        filtered = allUsers.filter(u => classifyUser(u) === 'kiwify');
    } else if (filter === 'manual') {
        filtered = allUsers.filter(u => classifyUser(u) === 'manual');
    } else if (filter === 'trial') {
        filtered = allUsers.filter(u => ['trial', 'trial_expired'].includes(classifyUser(u)));
    } else if (filter === 'free') {
        filtered = allUsers.filter(u => classifyUser(u) === 'free');
    }

    renderUsers(filtered);
}

window.applyFilter = applyFilter;

function filterUsers() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();

    let filtered = allUsers;

    // Aplicar filtro de tipo primeiro
    if (currentFilter !== 'all') {
        if (currentFilter === 'trial') {
            filtered = filtered.filter(u => ['trial', 'trial_expired'].includes(classifyUser(u)));
        } else {
            filtered = filtered.filter(u => classifyUser(u) === currentFilter);
        }
    }

    // Depois busca por texto
    if (searchTerm) {
        filtered = filtered.filter(user =>
            user.email.toLowerCase().includes(searchTerm) ||
            (user.displayName && user.displayName.toLowerCase().includes(searchTerm))
        );
    }

    renderUsers(filtered);
}

window.filterUsers = filterUsers;

// ========================================
// RENDERIZAR USUÁRIOS
// ========================================

function renderUsers(users) {
    const userList = document.getElementById('userList');

    if (users.length === 0) {
        userList.innerHTML = '<p style="text-align: center; color: var(--text-light); padding: 2rem;">Nenhum usuário encontrado.</p>';
        return;
    }

    userList.innerHTML = users.map(user => {
        const type = classifyUser(user);
        const isTrial = type === 'trial';
        const isTrialExpired = type === 'trial_expired';

        // Dias restantes do teste
        let trialDaysLeft = 0;
        if (isTrial && user.trialExpiresAt) {
            const expiresAt = new Date(user.trialExpiresAt);
            trialDaysLeft = Math.ceil((expiresAt - new Date()) / (1000 * 60 * 60 * 24));
        }

        // Badge
        let badgeClass, badgeText;
        switch(type) {
            case 'kiwify':
                badgeClass = 'badge-kiwify';
                badgeText = 'KIWIFY';
                break;
            case 'manual':
                badgeClass = 'badge-manual';
                badgeText = 'MANUAL';
                break;
            case 'trial':
                badgeClass = 'badge-trial';
                badgeText = `TESTE (${trialDaysLeft}d)`;
                break;
            case 'trial_expired':
                badgeClass = 'badge-expired';
                badgeText = 'EXPIRADO';
                break;
            default:
                badgeClass = 'badge-free';
                badgeText = 'GRÁTIS';
        }

        // Info de ativação
        const activatedAt = user.proActivatedAt ? formatDate(user.proActivatedAt) : '-';
        const source = getSourceLabel(user);

        return `
            <div class="user-item ${type}">
                <div class="user-info">
                    <div class="user-email">
                        ${user.email}
                        <span class="badge ${badgeClass}">${badgeText}</span>
                    </div>
                    <div class="user-details">
                        <span><strong>Nome:</strong> ${user.displayName || '-'}</span>
                        <span><strong>Cadastro:</strong> ${formatDate(user.createdAt)}</span>
                        ${user.isPro ? `<span><strong>Ativado:</strong> ${activatedAt}</span>` : ''}
                        ${user.isPro ? `<span><strong>Origem:</strong> ${source}</span>` : ''}
                        ${isTrial ? `<span><strong>Expira:</strong> ${formatDate(user.trialExpiresAt)}</span>` : ''}
                        ${user.kiwifyOrderId ? `<span><strong>Kiwify ID:</strong> ${user.kiwifyOrderId}</span>` : ''}
                    </div>
                </div>
                <div class="user-actions">
                    ${user.isPro ?
                        `<button onclick="togglePro('${user.id}', '${user.email}', false)" class="btn btn-danger btn-sm">Desativar</button>` :
                        `<button onclick="togglePro('${user.id}', '${user.email}', true)" class="btn btn-success btn-sm">Ativar PRO</button>`
                    }
                </div>
            </div>
        `;
    }).join('');
}

// ========================================
// ATIVAR/DESATIVAR PRO
// ========================================

async function togglePro(userId, email, activate) {
    if (activate) {
        if (!confirm(`Ativar PRO MANUAL para ${email}?\n\n(Você irá cobrar manualmente)`)) return;

        try {
            const userRef = window.firebaseDoc(window.firebaseDb, 'users', userId);
            await window.firebaseUpdateDoc(userRef, {
                isPro: true,
                proActivatedBy: 'admin_manual',
                proActivatedAt: new Date().toISOString()
            });

            showToast(`✅ PRO ativado para ${email}!`, 'success');
            await loadUsers();
        } catch (error) {
            showToast('❌ Erro', 'error');
        }
    } else {
        if (!confirm(`Desativar PRO para ${email}?`)) return;

        try {
            const userRef = window.firebaseDoc(window.firebaseDb, 'users', userId);
            await window.firebaseUpdateDoc(userRef, {
                isPro: false,
                proActivatedBy: null,
                proActivatedAt: null
            });

            showToast(`✅ PRO desativado!`, 'success');
            await loadUsers();
        } catch (error) {
            showToast('❌ Erro', 'error');
        }
    }
}

window.togglePro = togglePro;

// ========================================
// TESTE GRÁTIS
// ========================================

async function activateTrials() {
    const emailList = document.getElementById('trialEmailList').value;

    if (!emailList.trim()) {
        showToast('⚠️ Cole os emails primeiro!', 'warning');
        return;
    }

    const emails = emailList.split('\n').map(e => e.trim().toLowerCase()).filter(e => e && e.includes('@'));

    if (emails.length === 0) {
        showToast('⚠️ Nenhum email válido!', 'warning');
        return;
    }

    if (!confirm(`Ativar teste grátis (3 dias) para ${emails.length} usuários?`)) return;

    let activated = 0, pending = 0;

    try {
        const usersRef = window.firebaseCollection(window.firebaseDb, 'users');
        const snapshot = await window.firebaseGetDocs(usersRef);

        const userMap = new Map();
        snapshot.forEach((doc) => {
            const data = doc.data();
            userMap.set(data.email.toLowerCase(), { id: doc.id, ...data });
        });

        const trialExpiresAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();

        for (const email of emails) {
            const user = userMap.get(email);

            if (user) {
                if (user.isPro && user.proActivatedBy === 'kiwify') continue;

                const userRef = window.firebaseDoc(window.firebaseDb, 'users', user.id);
                await window.firebaseUpdateDoc(userRef, {
                    isPro: true,
                    proActivatedBy: 'trial',
                    proActivatedAt: new Date().toISOString(),
                    trialExpiresAt: trialExpiresAt
                });
                activated++;
            } else {
                const pendingRef = window.firebaseCollection(window.firebaseDb, 'pending_activations');
                await window.firebaseAddDoc(pendingRef, {
                    email: email,
                    orderId: `TRIAL-${Date.now()}`,
                    trialExpiresAt: trialExpiresAt,
                    createdAt: new Date().toISOString(),
                    status: 'pending',
                    source: 'trial'
                });
                pending++;
            }
        }

        showToast(`✅ ${activated} ativados, ${pending} pendentes`, 'success');
        await loadUsers();
        document.getElementById('trialEmailList').value = '';

    } catch (error) {
        showToast('❌ Erro: ' + error.message, 'error');
    }
}

window.activateTrials = activateTrials;

// ========================================
// TOAST
// ========================================

function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.style.background =
        type === 'success' ? '#10b981' :
        type === 'error' ? '#ef4444' :
        type === 'warning' ? '#f59e0b' :
        '#667eea';

    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 4000);
}

console.log('⚙️ Nardoto Tools Admin v1.1.0');
