// ========================================
// NARDOTO TOOLS - ADMIN DE LICENÇAS
// Version: 1.2.0 - Controle Financeiro Completo
// Desenvolvido por: Nardoto
// ========================================

let currentUser = null;
let allUsers = [];
let currentFilter = 'all';
let selectedUser = null;

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
// FUNÇÕES DE DATA E FORMATAÇÃO
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

function formatCurrency(value) {
    if (!value && value !== 0) return '-';
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(value);
}

function formatDateInput(dateValue) {
    if (!dateValue) return '';
    let date;
    if (dateValue.toDate && typeof dateValue.toDate === 'function') {
        date = dateValue.toDate();
    } else if (dateValue.seconds) {
        date = new Date(dateValue.seconds * 1000);
    } else {
        date = new Date(dateValue);
    }
    if (isNaN(date.getTime())) return '';
    return date.toISOString().split('T')[0];
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
    if (source === 'admin_manual' || source === 'admin_bulk' || source === 'gift') return 'manual';

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
    if (source === 'gift') return 'Presente';

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
        updateFinancialSummary();
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

function updateFinancialSummary() {
    // Calcular receita mensal esperada dos usuários manuais
    const manualUsers = allUsers.filter(u => classifyUser(u) === 'manual');

    let monthlyTotal = 0;
    let usersWithValue = 0;

    manualUsers.forEach(user => {
        if (user.monthlyValue && user.monthlyValue > 0) {
            monthlyTotal += parseFloat(user.monthlyValue);
            usersWithValue++;
        }
    });

    // Atualizar display
    const monthlyRevenueEl = document.getElementById('monthlyRevenue');
    const paidUsersEl = document.getElementById('paidUsersCount');

    if (monthlyRevenueEl) {
        monthlyRevenueEl.textContent = formatCurrency(monthlyTotal);
    }
    if (paidUsersEl) {
        paidUsersEl.textContent = `${usersWithValue} de ${manualUsers.length}`;
    }
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
            (user.displayName && user.displayName.toLowerCase().includes(searchTerm)) ||
            (user.notes && user.notes.toLowerCase().includes(searchTerm)) ||
            (user.contactInfo && user.contactInfo.toLowerCase().includes(searchTerm))
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
        const isManual = type === 'manual';

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
                badgeText = user.proActivatedBy === 'gift' ? 'PRESENTE' : 'MANUAL';
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

        // Info financeira para manuais
        let financialInfo = '';
        if (isManual) {
            const hasValue = user.monthlyValue && user.monthlyValue > 0;
            const lastPayment = user.payments && user.payments.length > 0 ? user.payments[user.payments.length - 1] : null;

            financialInfo = `
                <span class="financial-badge ${hasValue ? 'has-value' : 'no-value'}">
                    ${hasValue ? formatCurrency(user.monthlyValue) + '/mês' : 'Sem valor definido'}
                </span>
                ${lastPayment ? `<span class="last-payment">Último: ${formatDate(lastPayment.date)}</span>` : ''}
            `;
        }

        // Observações preview
        const notesPreview = user.notes ?
            `<div class="notes-preview">${user.notes.substring(0, 60)}${user.notes.length > 60 ? '...' : ''}</div>` : '';

        return `
            <div class="user-item ${type}" onclick="openUserModal('${user.id}')">
                <div class="user-info">
                    <div class="user-email">
                        ${user.email}
                        <span class="badge ${badgeClass}">${badgeText}</span>
                        ${financialInfo}
                    </div>
                    <div class="user-details">
                        <span><strong>Nome:</strong> ${user.displayName || '-'}</span>
                        <span><strong>Cadastro:</strong> ${formatDate(user.createdAt)}</span>
                        ${user.isPro ? `<span><strong>Ativado:</strong> ${activatedAt}</span>` : ''}
                        ${user.contactInfo ? `<span><strong>Contato:</strong> ${user.contactInfo}</span>` : ''}
                        ${isTrial ? `<span><strong>Expira:</strong> ${formatDate(user.trialExpiresAt)}</span>` : ''}
                    </div>
                    ${notesPreview}
                </div>
                <div class="user-actions" onclick="event.stopPropagation()">
                    ${isManual ? `<button onclick="openUserModal('${user.id}')" class="btn btn-primary btn-sm">Detalhes</button>` : ''}
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
// MODAL DE DETALHES DO USUÁRIO
// ========================================

function openUserModal(userId) {
    selectedUser = allUsers.find(u => u.id === userId);
    if (!selectedUser) return;

    const modal = document.getElementById('userModal');
    const type = classifyUser(selectedUser);

    // Preencher dados básicos
    document.getElementById('modalUserEmail').textContent = selectedUser.email;
    document.getElementById('modalUserName').textContent = selectedUser.displayName || '-';
    document.getElementById('modalUserType').textContent = getSourceLabel(selectedUser);
    document.getElementById('modalCreatedAt').textContent = formatDate(selectedUser.createdAt);
    document.getElementById('modalActivatedAt').textContent = formatDate(selectedUser.proActivatedAt);

    // Campos editáveis
    document.getElementById('userContactInfo').value = selectedUser.contactInfo || '';
    document.getElementById('userMonthlyValue').value = selectedUser.monthlyValue || '';
    document.getElementById('userNotes').value = selectedUser.notes || '';

    // Tipo de ativação
    document.getElementById('userActivationType').value = selectedUser.proActivatedBy || 'admin_manual';

    // Renderizar histórico de pagamentos
    renderPaymentHistory();

    modal.classList.add('show');
}

window.openUserModal = openUserModal;

function closeUserModal() {
    document.getElementById('userModal').classList.remove('show');
    selectedUser = null;
}

window.closeUserModal = closeUserModal;

function renderPaymentHistory() {
    const container = document.getElementById('paymentHistory');
    const payments = selectedUser.payments || [];

    if (payments.length === 0) {
        container.innerHTML = '<p class="no-payments">Nenhum pagamento registrado</p>';
        return;
    }

    // Ordenar por data (mais recentes primeiro)
    const sortedPayments = [...payments].sort((a, b) =>
        new Date(b.date) - new Date(a.date)
    );

    container.innerHTML = sortedPayments.map((payment, index) => `
        <div class="payment-item">
            <div class="payment-info">
                <strong>${formatCurrency(payment.value)}</strong>
                <span>${formatDate(payment.date)}</span>
                ${payment.note ? `<small>${payment.note}</small>` : ''}
            </div>
            <button onclick="removePayment(${payments.indexOf(payment)})" class="btn-icon" title="Remover">🗑️</button>
        </div>
    `).join('');

    // Calcular total
    const total = payments.reduce((sum, p) => sum + parseFloat(p.value || 0), 0);
    container.innerHTML += `
        <div class="payment-total">
            <strong>Total recebido:</strong> ${formatCurrency(total)}
        </div>
    `;
}

async function addPayment() {
    const date = document.getElementById('newPaymentDate').value;
    const value = parseFloat(document.getElementById('newPaymentValue').value);
    const note = document.getElementById('newPaymentNote').value;

    if (!date || !value || value <= 0) {
        showToast('⚠️ Preencha data e valor!', 'warning');
        return;
    }

    const payments = selectedUser.payments || [];
    payments.push({
        date: date,
        value: value,
        note: note,
        addedAt: new Date().toISOString()
    });

    try {
        const userRef = window.firebaseDoc(window.firebaseDb, 'users', selectedUser.id);
        await window.firebaseUpdateDoc(userRef, { payments: payments });

        selectedUser.payments = payments;
        renderPaymentHistory();

        // Limpar campos
        document.getElementById('newPaymentDate').value = '';
        document.getElementById('newPaymentValue').value = '';
        document.getElementById('newPaymentNote').value = '';

        showToast('✅ Pagamento registrado!', 'success');
    } catch (error) {
        showToast('❌ Erro ao salvar', 'error');
    }
}

window.addPayment = addPayment;

async function removePayment(index) {
    if (!confirm('Remover este pagamento?')) return;

    const payments = selectedUser.payments || [];
    payments.splice(index, 1);

    try {
        const userRef = window.firebaseDoc(window.firebaseDb, 'users', selectedUser.id);
        await window.firebaseUpdateDoc(userRef, { payments: payments });

        selectedUser.payments = payments;
        renderPaymentHistory();

        showToast('✅ Pagamento removido!', 'success');
    } catch (error) {
        showToast('❌ Erro ao remover', 'error');
    }
}

window.removePayment = removePayment;

async function saveUserDetails() {
    if (!selectedUser) return;

    const contactInfo = document.getElementById('userContactInfo').value.trim();
    const monthlyValue = parseFloat(document.getElementById('userMonthlyValue').value) || 0;
    const notes = document.getElementById('userNotes').value.trim();
    const activationType = document.getElementById('userActivationType').value;

    try {
        const userRef = window.firebaseDoc(window.firebaseDb, 'users', selectedUser.id);
        await window.firebaseUpdateDoc(userRef, {
            contactInfo: contactInfo,
            monthlyValue: monthlyValue,
            notes: notes,
            proActivatedBy: activationType
        });

        // Atualizar local
        selectedUser.contactInfo = contactInfo;
        selectedUser.monthlyValue = monthlyValue;
        selectedUser.notes = notes;
        selectedUser.proActivatedBy = activationType;

        // Atualizar na lista
        const index = allUsers.findIndex(u => u.id === selectedUser.id);
        if (index >= 0) {
            allUsers[index] = selectedUser;
        }

        updateFinancialSummary();
        applyFilter(currentFilter);

        showToast('✅ Dados salvos!', 'success');
    } catch (error) {
        console.error('Erro:', error);
        showToast('❌ Erro ao salvar', 'error');
    }
}

window.saveUserDetails = saveUserDetails;

// ========================================
// ATIVAR/DESATIVAR PRO
// ========================================

async function togglePro(userId, email, activate) {
    if (activate) {
        if (!confirm(`Ativar PRO MANUAL para ${email}?\n\n(Você poderá definir o valor e pagamentos depois)`)) return;

        try {
            const userRef = window.firebaseDoc(window.firebaseDb, 'users', userId);
            await window.firebaseUpdateDoc(userRef, {
                isPro: true,
                proActivatedBy: 'admin_manual',
                proActivatedAt: new Date().toISOString()
            });

            showToast(`✅ PRO ativado para ${email}!`, 'success');
            await loadUsers();

            // Abrir modal para preencher detalhes
            setTimeout(() => openUserModal(userId), 500);
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

// Fechar modal ao clicar fora
document.addEventListener('click', (e) => {
    const modal = document.getElementById('userModal');
    if (e.target === modal) {
        closeUserModal();
    }
});

// Fechar modal com ESC
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeUserModal();
    }
});

console.log('⚙️ Nardoto Tools Admin v1.2.0 - Controle Financeiro');
