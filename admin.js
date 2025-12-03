// ========================================
// NARDOTO TOOLS - ADMIN DE LICENÇAS
// Version: 1.0.0
// Desenvolvido por: Nardoto
// ========================================

let currentUser = null;
let allUsers = [];

// Admin emails - Lista de administradores autorizados
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
            showToast('❌ Acesso negado! Apenas administradores podem acessar.', 'error');
            setTimeout(() => logout(), 2000);
        }
    } else {
        console.log('Nenhum usuário logado');
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
        const result = await window.firebaseSignInWithPopup(window.firebaseAuth, window.firebaseProvider);
        console.log('✅ Login:', result.user.email);
    } catch (error) {
        console.error('Erro no login:', error);
        if (error.code === 'auth/popup-closed-by-user') {
            showToast('⚠️ Login cancelado', 'warning');
        } else {
            showToast('❌ Erro: ' + error.message, 'error');
        }
    }
}

window.loginWithGoogle = loginWithGoogle;

async function logout() {
    try {
        await window.firebaseSignOut(window.firebaseAuth);
        showToast('✅ Logout realizado!', 'success');
    } catch (error) {
        console.error('Erro no logout:', error);
    }
}

window.logout = logout;

// ========================================
// FUNÇÕES DE DATA (CORRIGIDAS PARA FIRESTORE)
// ========================================

// Converte qualquer formato de data para timestamp (ms)
function getTimestamp(dateValue) {
    if (!dateValue) return 0;

    // Firestore Timestamp tem o método toDate()
    if (dateValue.toDate && typeof dateValue.toDate === 'function') {
        return dateValue.toDate().getTime();
    }
    // Firestore Timestamp também pode ter seconds
    if (dateValue.seconds) {
        return dateValue.seconds * 1000;
    }
    // String ISO ou timestamp normal
    const date = new Date(dateValue);
    return isNaN(date.getTime()) ? 0 : date.getTime();
}

function formatDate(dateValue) {
    if (!dateValue) return 'Data desconhecida';

    let date;

    // Firestore Timestamp tem o método toDate()
    if (dateValue.toDate && typeof dateValue.toDate === 'function') {
        date = dateValue.toDate();
    }
    // Firestore Timestamp também pode ter seconds
    else if (dateValue.seconds) {
        date = new Date(dateValue.seconds * 1000);
    }
    // String ISO ou timestamp normal
    else {
        date = new Date(dateValue);
    }

    if (isNaN(date.getTime())) {
        return 'Data desconhecida';
    }

    return date.toLocaleDateString('pt-BR');
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
            allUsers.push({
                id: doc.id,
                ...doc.data()
            });
        });

        // Ordenar por data de criação (mais recentes primeiro)
        allUsers.sort((a, b) => {
            const dateA = getTimestamp(a.createdAt);
            const dateB = getTimestamp(b.createdAt);
            return dateB - dateA;
        });

        updateStats();
        renderUsers(allUsers);

        showToast(`✅ ${allUsers.length} usuários carregados!`, 'success');
    } catch (error) {
        console.error('Erro ao carregar usuários:', error);
        showToast('❌ Erro ao carregar usuários', 'error');
    } finally {
        loading.classList.remove('show');
    }
}

window.loadUsers = loadUsers;

function updateStats() {
    const total = allUsers.length;
    const pro = allUsers.filter(u => u.isPro && u.proActivatedBy !== 'trial').length;
    const trial = allUsers.filter(u => u.isPro && u.proActivatedBy === 'trial').length;
    const free = total - pro - trial;

    document.getElementById('totalUsers').textContent = total;
    document.getElementById('proUsers').textContent = pro;
    document.getElementById('freeUsers').textContent = free;
    document.getElementById('trialUsers').textContent = trial;
}

function renderUsers(users) {
    const userList = document.getElementById('userList');

    if (users.length === 0) {
        userList.innerHTML = '<p style="text-align: center; color: var(--text-light); padding: 2rem;">Nenhum usuário encontrado.</p>';
        return;
    }

    userList.innerHTML = users.map(user => {
        // Verificar tipo de usuário
        const isTrial = user.isPro && user.proActivatedBy === 'trial';
        const trialExpired = isTrial && user.trialExpiresAt && new Date(user.trialExpiresAt) < new Date();

        // Calcular dias restantes do teste
        let trialDaysLeft = 0;
        if (isTrial && user.trialExpiresAt) {
            const expiresAt = new Date(user.trialExpiresAt);
            const now = new Date();
            trialDaysLeft = Math.ceil((expiresAt - now) / (1000 * 60 * 60 * 24));
        }

        // Badge do status
        let badgeClass = 'badge-free';
        let badgeText = 'GRÁTIS';

        if (user.isPro) {
            if (isTrial) {
                badgeClass = trialExpired ? 'badge-free' : 'badge-trial';
                badgeText = trialExpired ? 'TESTE EXPIRADO' : `TESTE (${trialDaysLeft}d)`;
            } else {
                badgeClass = 'badge-pro';
                badgeText = 'PRO';
            }
        }

        return `
            <div class="user-item" data-email="${user.email}">
                <div class="user-info">
                    <div class="user-email">
                        ${user.email}
                        <span class="badge ${badgeClass}">${badgeText}</span>
                    </div>
                    <div class="user-status">
                        ${user.displayName || 'Sem nome'} •
                        ${user.translationsToday || 0} traduções hoje •
                        Criado em ${formatDate(user.createdAt)}
                        ${isTrial && !trialExpired ? ` • Expira em ${new Date(user.trialExpiresAt).toLocaleDateString('pt-BR')}` : ''}
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
        const planChoice = prompt(
            `Escolha o plano para ${email}:\n\n` +
            `1 - BÁSICO\n` +
            `2 - VIP (Tudo liberado)\n\n` +
            `Digite 1 ou 2:`
        );

        let plan = planChoice === '2' ? 'vip' : 'basic';
        let features = plan === 'vip' ? ['all-features'] : ['veo3-automator', 'wisk-automator', 'tradutor-ai-unlimited'];

        if (!confirm(`Ativar plano ${plan.toUpperCase()} para ${email}?`)) return;

        try {
            const userRef = window.firebaseDoc(window.firebaseDb, 'users', userId);
            await window.firebaseUpdateDoc(userRef, {
                plan: plan,
                isPro: true,
                features: features,
                proActivatedBy: 'admin_manual',
                proActivatedAt: new Date().toISOString()
            });

            showToast(`✅ PRO ativado para ${email}!`, 'success');
            await loadUsers();
        } catch (error) {
            console.error('Erro:', error);
            showToast('❌ Erro ao ativar PRO', 'error');
        }
    } else {
        if (!confirm(`Desativar PRO para ${email}?`)) return;

        try {
            const userRef = window.firebaseDoc(window.firebaseDb, 'users', userId);
            await window.firebaseUpdateDoc(userRef, {
                plan: 'free',
                isPro: false,
                features: [],
                proActivatedBy: null,
                proActivatedAt: null
            });

            showToast(`✅ PRO desativado para ${email}!`, 'success');
            await loadUsers();
        } catch (error) {
            console.error('Erro:', error);
            showToast('❌ Erro ao desativar PRO', 'error');
        }
    }
}

window.togglePro = togglePro;

// ========================================
// ATIVAÇÃO TESTE GRÁTIS (3 DIAS)
// ========================================

async function activateTrials() {
    const emailList = document.getElementById('trialEmailList').value;

    if (!emailList.trim()) {
        showToast('⚠️ Cole a lista de emails primeiro!', 'warning');
        return;
    }

    const emails = emailList
        .split('\n')
        .map(e => e.trim().toLowerCase())
        .filter(e => e && e.includes('@'));

    if (emails.length === 0) {
        showToast('⚠️ Nenhum email válido encontrado!', 'warning');
        return;
    }

    if (!confirm(`Ativar teste grátis de 3 dias para ${emails.length} usuários?`)) return;

    let activated = 0;
    let pending = 0;

    showToast(`⏳ Ativando teste para ${emails.length} usuários...`, 'info');

    try {
        const usersRef = window.firebaseCollection(window.firebaseDb, 'users');
        const snapshot = await window.firebaseGetDocs(usersRef);

        const userMap = new Map();
        snapshot.forEach((doc) => {
            const data = doc.data();
            userMap.set(data.email.toLowerCase(), { id: doc.id, ...data });
        });

        const trialDuration = 3 * 24 * 60 * 60 * 1000;
        const trialExpiresAt = new Date(Date.now() + trialDuration).toISOString();

        for (const email of emails) {
            const user = userMap.get(email);

            if (user) {
                if (user.isPro && user.proActivatedBy === 'kiwify') {
                    console.log(`⏭️ Pulando ${email} - Já é PRO pago`);
                    continue;
                }

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
                const pendingQuery = window.firebaseQuery(pendingRef, window.firebaseWhere('email', '==', email));
                const pendingSnap = await window.firebaseGetDocs(pendingQuery);

                if (pendingSnap.empty) {
                    await window.firebaseAddDoc(pendingRef, {
                        email: email,
                        orderId: `TRIAL-${Date.now()}`,
                        trialExpiresAt: trialExpiresAt,
                        createdAt: new Date().toISOString(),
                        status: 'pending',
                        source: 'trial'
                    });
                }
                pending++;
            }
        }

        let msg = `✅ Teste ativado!\n`;
        if (activated > 0) msg += `${activated} usuários ativados\n`;
        if (pending > 0) msg += `${pending} pendentes (aguardando login)`;

        showToast(msg, 'success');
        await loadUsers();
        document.getElementById('trialEmailList').value = '';

    } catch (error) {
        console.error('Erro:', error);
        showToast('❌ Erro: ' + error.message, 'error');
    }
}

window.activateTrials = activateTrials;

// ========================================
// FILTRO DE BUSCA
// ========================================

function filterUsers() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();

    if (!searchTerm) {
        renderUsers(allUsers);
        return;
    }

    const filtered = allUsers.filter(user =>
        user.email.toLowerCase().includes(searchTerm) ||
        (user.displayName && user.displayName.toLowerCase().includes(searchTerm))
    );

    renderUsers(filtered);
}

window.filterUsers = filterUsers;

// ========================================
// TOAST NOTIFICATION
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

    setTimeout(() => {
        toast.classList.remove('show');
    }, 4000);
}

console.log('⚙️ Nardoto Tools Admin v1.0.0');
