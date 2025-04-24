//=============================================================================
// Gestor Financeiro - app-business.js - v1.9.21+ (Devedores)
// - Adiciona gerenciamento completo de Devedores e Dívidas.
// - Permite adicionar/editar/excluir devedores com foto.
// - Permite adicionar/editar/excluir dívidas associadas a devedores (valor, datas, recorrência).
// - Modal de detalhes do devedor exibe dívidas e saldo devedor.
// - Permite registrar pagamentos parciais/totais de dívidas, gerando transações de Receita.
// - Inclui histórico de pagamentos por devedor.
// - Mantém funcionalidades anteriores (Funcionários, Faturas, Clientes, Projetos, Permissões).
//=============================================================================

// --- Importações do Módulo Base ---
import {
    transactions, isProPlan, isBusinessPlan,
    showAlert, showConfirmModal, formatCurrency, getLocalDateString,
    parseDateInput, saveDataToStorage as saveBaseDataToStorage,
    refreshAllUIComponents, updateCategoryDropdowns, escapeHtml,
    closeModal, openModal, parseTags, formatTags, formatDisplayDate,
    body, settingsSection,
    renderAllTransactions, renderTransactionHistory, updateBalanceDisplay, updateCharts, updatePlaceholders,
    companySettings, // Importado: Configurações da Empresa
    calculateCurrentBalances // Importado para checar saldo
} from './app-base.js'; // <<< AJUSTE O CAMINHO SE NECESSÁRIO

// ============================================================
// SIMULAÇÃO DE AUTENTICAÇÃO E PERMISSÕES (REQUER BACKEND REAL)
// ============================================================
let currentUser = {
    id: 'user1',
    name: 'Admin Simulado',
    email: 'admin@simulado.com',
    role: 'admin' // Pode ser 'admin', 'financeiro', 'vendas', 'leitura'
};

export function getCurrentUser() {
    return currentUser;
}

export function hasPermission(requiredRole) {
    const userRole = currentUser?.role;
    if (!userRole) return false;
    const roleHierarchy = { 'admin': 4, 'financeiro': 3, 'vendas': 2, 'leitura': 1 };
    const userLevel = roleHierarchy[userRole] || 0;
    const requiredLevel = roleHierarchy[requiredRole] || 0;
    return userLevel >= requiredLevel;
}

function setupUserSwitcherForTesting() {
    console.log("========================================");
    console.log(" MODO DE SIMULAÇÃO DE USUÁRIO ATIVO ");
    console.log(" Usuário Atual:", currentUser);
    console.log(" Use window.switchUserRole('role') no console.");
    console.log(" Roles: 'admin', 'financeiro', 'vendas', 'leitura'");
    console.log("========================================");

    window.switchUserRole = (newRole) => {
        const validRoles = ['admin', 'financeiro', 'vendas', 'leitura'];
        if (validRoles.includes(newRole)) {
            currentUser.role = newRole;
            currentUser.name = newRole.charAt(0).toUpperCase() + newRole.slice(1) + " Simulado";
            currentUser.email = `${newRole}@simulado.com`;
            currentUser.id = `user_${newRole}`;
            console.log(">>> Papel do usuário simulado alterado para:", newRole);
            console.log(">>> Usuário Atual:", currentUser);
            updateUIAccessBasedOnRole();
            refreshAllUIComponents(); // Re-renderiza tudo para aplicar permissões
             if (settingsSection?.classList.contains('active')) {
                 renderSettingsBasedOnRole(); // Re-renderiza seção de config
             }
            showAlert(`Interface atualizada para o perfil: ${newRole}`, "info");
        } else {
            console.error("Papel inválido. Use um dos:", validRoles.join(', '));
            showAlert(`Papel inválido: ${newRole}`, "danger");
        }
    };
}
// ============================================================
// FIM DA SIMULAÇÃO
// ============================================================


// --- Estado Específico do Business ---
let invoices = [];
let clients = [];
let projects = [];
let employees = [];
let debtors = [];   // <<< NOVO ESTADO PARA DEVEDORES
let debts = [];     // <<< NOVO ESTADO PARA DÍVIDAS
let companyUsers = []; // SIMULAÇÃO

// --- Seletores DOM Específicos do Business ---
const invoiceListContainer = document.getElementById('invoiceListContainer');
const addInvoiceBtn = document.getElementById('addInvoiceBtn');
const invoiceModal = document.getElementById('invoiceModal');
const invoiceForm = document.getElementById('invoiceForm');
const invoiceClientSelect = document.getElementById('invoiceClientSelect');
const invoiceProjectSelect = document.getElementById('invoiceProjectSelect');
const invoiceItemsContainer = document.getElementById('invoiceItemsContainer');
const addInvoiceItemBtn = document.getElementById('addInvoiceItemBtn');
const invoiceDueDateInput = document.getElementById('invoiceDueDate');
const invoiceNumberInput = document.getElementById('invoiceNumber');
const clientListContainer = document.getElementById('clientListContainer');
const projectListContainer = document.getElementById('projectListContainer');
const addClientBtn = document.getElementById('addClientBtn');
const addProjectBtn = document.getElementById('addProjectBtn');
const newClientNameInput = document.getElementById('newClientNameInput');
const newProjectNameInput = document.getElementById('newProjectNameInput');
const modalProjectSelect = document.getElementById('modalProjectSelect');
const modalClientSelect = document.getElementById('modalClientSelect');
const editProjectSelect = document.getElementById('editProjectSelect');
const editClientSelect = document.getElementById('editClientSelect');
const taxReportContainer = document.getElementById('taxReportContainer');
const generateTaxReportBtn = document.getElementById('generateTaxReportBtn');
const taxReportStartDate = document.getElementById('taxReportStartDate');
const taxReportEndDate = document.getElementById('taxReportEndDate');
const deductibleCheckbox = document.getElementById('modalDeductible');
const editDeductibleCheckbox = document.getElementById('editDeductible');
const userManagementSettings = document.getElementById('userManagementSettings');
const userListContainer = document.getElementById('userListContainer');
const addUserBtn = document.getElementById('addUserBtn');
const invoiceViewModal = document.getElementById('invoiceViewModal');
const employeeListContainer = document.getElementById('employeeListContainer');
const addEmployeeBtn = document.getElementById('addEmployeeBtn');
const newEmployeeNameInput = document.getElementById('newEmployeeNameInput');
const invoiceEmployeeSelect = document.getElementById('invoiceEmployeeSelect');
const invoicePaymentMethodSelect = document.getElementById('invoicePaymentMethod');
const recipientTypeRadios = document.querySelectorAll('input[name="invoiceRecipientType"]');
const clientSelectGroup = document.getElementById('clientSelectGroup');
const employeeSelectGroup = document.getElementById('employeeSelectGroup');
// <<< NOVOS Seletores para Devedores >>>
const debtorsSection = document.getElementById('debtors-section');
const debtorListContainer = document.getElementById('debtorListContainer');
const addDebtorBtn = document.getElementById('addDebtorBtn');
const debtorModal = document.getElementById('debtorModal');
const debtorForm = document.getElementById('debtorForm');
const debtorModalTitle = document.getElementById('debtorModalTitle');
const debtorIdInput = document.getElementById('debtorId');
const debtorNameInput = document.getElementById('debtorName');
const debtorEmailInput = document.getElementById('debtorEmail');
const debtorPhoneInput = document.getElementById('debtorPhone');
const debtorPhotoUpload = document.querySelector('.debtor-photo-upload');
const debtorPhotoInput = document.getElementById('debtorPhotoInput');
const debtorPhotoPreview = document.getElementById('debtorPhotoPreview');
const debtorPhotoIcon = document.getElementById('debtorPhotoIcon');
const removeDebtorPhotoBtn = document.getElementById('removeDebtorPhotoBtn');
const debtorPhotoUrlHidden = document.getElementById('debtorPhotoUrlHidden');
const debtorDetailModal = document.getElementById('debtorDetailModal');
const detailDebtorPhoto = document.getElementById('detailDebtorPhoto');
const detailDebtorName = document.getElementById('detailDebtorName');
const detailDebtorEmail = document.getElementById('detailDebtorEmail');
const detailDebtorPhone = document.getElementById('detailDebtorPhone');
const detailTotalOwed = document.getElementById('detailTotalOwed');
const addDebtForDebtorBtn = document.getElementById('addDebtForDebtorBtn');
const debtorDebtsList = document.getElementById('debtorDebtsList');
const viewDebtorPaymentHistoryBtn = document.getElementById('viewDebtorPaymentHistoryBtn');
const debtModal = document.getElementById('debtModal');
const debtForm = document.getElementById('debtForm');
const debtModalTitle = document.getElementById('debtModalTitle');
const debtIdInput = document.getElementById('debtId');
const debtDebtorIdInput = document.getElementById('debtDebtorId');
const debtDescriptionInput = document.getElementById('debtDescription');
const debtAmountInput = document.getElementById('debtAmount');
const debtIncurredDateInput = document.getElementById('debtIncurredDate');
const debtDueDateInput = document.getElementById('debtDueDate');
const debtIsRecurringCheckbox = document.getElementById('debtIsRecurring');
const debtRecurringFrequencySelect = document.getElementById('debtRecurringFrequency');
const debtNotesInput = document.getElementById('debtNotes');
const recordDebtPaymentModal = document.getElementById('recordDebtPaymentModal');
const recordDebtPaymentForm = document.getElementById('recordDebtPaymentForm');
const paymentDebtDescription = document.getElementById('paymentDebtDescription');
const paymentDebtRemaining = document.getElementById('paymentDebtRemaining');
const paymentDebtIdInput = document.getElementById('paymentDebtId');
const paymentAmountReceivedInput = document.getElementById('paymentAmountReceived');
const paymentDateReceivedInput = document.getElementById('paymentDateReceived');
const paymentMethodReceivedSelect = document.getElementById('paymentMethodReceived');
const paymentNotesInput = document.getElementById('paymentNotes');
const debtorPaymentHistoryModal = document.getElementById('debtorPaymentHistoryModal');
const historyDebtorName = document.getElementById('historyDebtorName');
const debtorPaymentHistoryList = document.getElementById('debtorPaymentHistoryList');


// --- Funções de Persistência Específicas do Business ---
function loadBusinessData() {
    clients = JSON.parse(localStorage.getItem('clients')) || [];
    projects = JSON.parse(localStorage.getItem('projects')) || [];
    employees = JSON.parse(localStorage.getItem('employees')) || [];
    invoices = JSON.parse(localStorage.getItem('invoices')) || [];
    debtors = JSON.parse(localStorage.getItem('debtors')) || []; // <<< CARREGAR DEVEDORES
    debts = JSON.parse(localStorage.getItem('debts')) || [];     // <<< CARREGAR DÍVIDAS

    // --- Garantir IDs e Estrutura ---
    clients.forEach(c => { if (!c.id) c.id = `client_${Date.now()}_${Math.random().toString(36).substring(2, 7)}` });
    projects.forEach(p => { if (!p.id) p.id = `proj_${Date.now()}_${Math.random().toString(36).substring(2, 7)}` });
    employees.forEach(e => { if (!e.id) e.id = `emp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}` });
    invoices.forEach(i => {
        if (!i.id) i.id = `inv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        if (!i.recipientType) i.recipientType = 'client';
    });
    debtors.forEach(d => {
         if (!d.id) d.id = `debtor_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
         if (!d.contactInfo) d.contactInfo = {}; // Garante objeto existe
         d.photoUrl = d.photoUrl || null; // Garante que photoUrl existe (pode ser null)
    });
    debts.forEach(db => {
         if (!db.id) db.id = `debt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
         if (db.paidAmount === undefined) db.paidAmount = 0; // Migração/Garantia
         if (!db.status) db.status = 'pending'; // Default status
         if (db.isRecurring === undefined) db.isRecurring = false;
         if (!db.createdAt) db.createdAt = new Date().toISOString(); // Garante data de criação
         if (!db.updatedAt) db.updatedAt = db.createdAt; // Garante data de atualização
         db.amount = parseFloat(db.amount) || 0; // Garante que é número
         db.paidAmount = parseFloat(db.paidAmount) || 0; // Garante que é número
    });
    console.log("Debtors loaded:", debtors);
    console.log("Debts loaded:", debts);
}

function saveBusinessDataToStorage() {
    localStorage.setItem('clients', JSON.stringify(clients));
    localStorage.setItem('projects', JSON.stringify(projects));
    localStorage.setItem('employees', JSON.stringify(employees));
    localStorage.setItem('invoices', JSON.stringify(invoices));
    localStorage.setItem('debtors', JSON.stringify(debtors)); // <<< SALVAR DEVEDORES
    localStorage.setItem('debts', JSON.stringify(debts));     // <<< SALVAR DÍVIDAS
}

// A função saveDataToStorage agora só precisa chamar as funções filhas
function saveDataToStorage() {
    saveBaseDataToStorage(); // Salva dados base (transações, etc.)
    saveBusinessDataToStorage(); // Salva dados business (clientes, projetos, funcionários, invoices, devedores, dívidas)
}

// <<< NOVAS Funções para Funcionários (CRUD) >>>
export function renderEmployees() {
    if (!isBusinessPlan || !employeeListContainer) return;
    if (!hasPermission('admin')) { // Exemplo de permissão (Admin)
        employeeListContainer.innerHTML = '<p class="text-muted small">Permissão de Admin necessária.</p>';
        if (newEmployeeNameInput) newEmployeeNameInput.disabled = true;
        if (addEmployeeBtn) addEmployeeBtn.disabled = true;
        return;
    }
    else {
        if (newEmployeeNameInput) newEmployeeNameInput.disabled = false;
        if (addEmployeeBtn) addEmployeeBtn.disabled = false;
    }
    employeeListContainer.innerHTML = '';
    if (employees.length === 0) {
        employeeListContainer.innerHTML = '<p class="text-muted small p-2 text-center">Nenhum funcionário.</p>';
        return;
    }
    const canDelete = hasPermission('admin');
    employees.sort((a,b) => a.name.localeCompare(b.name)).forEach(emp => {
        const div = document.createElement('div');
        div.className = 'list-group-item list-group-item-action d-flex justify-content-between align-items-center py-1 px-2';
        div.innerHTML = `<span class="small">${escapeHtml(emp.name)}</span> ${canDelete ? `<button class="btn btn-sm btn-outline-danger delete-employee py-0 px-1" data-id="${emp.id}" title="Excluir Funcionário ${escapeHtml(emp.name)}"><i class="fas fa-trash fa-xs"></i></button>` : ''}`;
        employeeListContainer.appendChild(div);
    });
}

function addEmployee() {
    if (!isBusinessPlan || !newEmployeeNameInput || !hasPermission('admin')) return;
    const name = newEmployeeNameInput.value.trim();
    if (!name) return showAlert("Digite o nome do funcionário.", "warning");
    if (employees.some(e => e.name.toLowerCase() === name.toLowerCase())) return showAlert("Funcionário já existe.", "warning");
    employees.push({ id: `emp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`, name: name });
    saveBusinessDataToStorage(); // Salva apenas os dados de business
    renderEmployees(); // Atualiza a lista nas configurações
    populateRecipientSelects(); // Atualiza o select no modal de fatura
    newEmployeeNameInput.value = '';
    showAlert("Funcionário adicionado!", "success");
}

async function deleteEmployee(id) {
     if (!isBusinessPlan || !hasPermission('admin')) return;
     const index = employees.findIndex(e => String(e.id) === String(id));
     if (index === -1) return showAlert("Funcionário não encontrado.", "danger");
     const emp = employees[index];
     const isInUseInvoice = invoices.some(inv => inv.recipientType === 'employee' && String(inv.recipientId) === String(id));
     // Verifica se o funcionário está vinculado a alguma transação
     const isInUseTransaction = transactions.some(tx => String(tx.employeeId) === String(id));
     let confirmMessage = `Excluir funcionário "${escapeHtml(emp.name)}"?`;
     if (isInUseInvoice || isInUseTransaction) {
         confirmMessage += `<br><strong class="text-danger mt-2 d-block">Atenção:</strong> Associado a faturas/pagamentos ou transações. Exclusão NÃO removerá associações.`;
     }
     const conf = await showConfirmModal(confirmMessage, "Confirmar Exclusão", "danger");
     if (conf) {
         employees.splice(index, 1);
         saveBusinessDataToStorage(); // Salva apenas os dados de business
         renderEmployees();
         populateRecipientSelects();
         showAlert("Funcionário excluído.", "info");
     }
}

export function getEmployeeNameById(employeeId) {
    if (!employeeId || !Array.isArray(employees)) return employeeId || 'N/D';
    const emp = employees.find(e => String(e.id) === String(employeeId));
    return emp ? emp.name : `Funcionário ID ${String(employeeId).substring(0,6)}...`;
}
// <<< FIM Funções Funcionários >>>

// --- Função Unificada para Popular Selects ---
export function populateRecipientSelects() {
    const clientSelects = document.querySelectorAll('#invoiceClientSelect, #modalClientSelect, #editClientSelect');
    clientSelects.forEach(clientSelect => {
        if (clientSelect && hasPermission('leitura')) {
            const currentVal = clientSelect.value;
            clientSelect.innerHTML = '<option value="">-- Cliente --</option>';
            clients.sort((a,b) => a.name.localeCompare(b.name)).forEach(c => { clientSelect.add(new Option(c.name, c.id)); });
            if (clients.some(c => String(c.id) === String(currentVal))) { clientSelect.value = currentVal; }
            clientSelect.disabled = false;
        } else if (clientSelect) { clientSelect.innerHTML = '<option value="">-- Sem Permissão --</option>'; clientSelect.disabled = true; }
    });

    const projectSelects = document.querySelectorAll('#invoiceProjectSelect, #modalProjectSelect, #editProjectSelect');
     projectSelects.forEach(projectSelect => {
        if (projectSelect && hasPermission('leitura')) {
            const currentVal = projectSelect.value;
            projectSelect.innerHTML = '<option value="">-- Projeto (Opcional) --</option>';
            projects.sort((a,b) => a.name.localeCompare(b.name)).forEach(p => { projectSelect.add(new Option(p.name, p.id)); });
            if (projects.some(p => String(p.id) === String(currentVal))) { projectSelect.value = currentVal; }
            projectSelect.disabled = false;
        } else if (projectSelect) { projectSelect.innerHTML = '<option value="">-- Sem Permissão --</option>'; projectSelect.disabled = true; }
     });

    const employeeSelects = document.querySelectorAll('#invoiceEmployeeSelect'); // Adicionar outros selects de funcionário aqui se houver (ex: #modalEmployeeSelect, #editEmployeeSelect)
    employeeSelects.forEach(employeeSelect => {
        if (employeeSelect && hasPermission('leitura')) { // Ajustar permissão se necessário
            const currentVal = employeeSelect.value;
            employeeSelect.innerHTML = '<option value="">-- Funcionário --</option>';
            employees.sort((a, b) => a.name.localeCompare(b.name)).forEach(e => { employeeSelect.add(new Option(e.name, e.id)); });
            if (employees.some(e => String(e.id) === String(currentVal))) { employeeSelect.value = currentVal; }
            employeeSelect.disabled = false;
        } else if (employeeSelect) { employeeSelect.innerHTML = '<option value="">-- Sem Permissão --</option>'; employeeSelect.disabled = true; }
    });
}


// --- Funções de Faturamento (Modificadas) ---
export function renderInvoices() {
    if (!isBusinessPlan || !invoiceListContainer) return;
    if (!hasPermission('vendas')) {
        invoiceListContainer.innerHTML = '<p class="text-muted p-3 text-center">Você não tem permissão para visualizar faturas/pagamentos.</p>';
        return;
    }

    invoiceListContainer.innerHTML = '';
    const sortedInvoices = [...invoices].sort((a, b) => (a.dueDate || '9999-12-31').localeCompare(b.dueDate || '9999-12-31'));

    if (sortedInvoices.length === 0) {
        invoiceListContainer.innerHTML = '<p class="text-muted p-3 text-center">Nenhuma fatura ou pagamento criado.</p>';
        return;
    }

    sortedInvoices.forEach((inv) => {
        const originalIndex = invoices.findIndex(i => i.id === inv.id);
        if (originalIndex !== -1) {
             invoiceListContainer.appendChild(createInvoiceElement(inv, originalIndex)); // Usa append para manter ordem
        }
    });
}

function createInvoiceElement(invoice, index) {
    const div = document.createElement('div');
    div.className = `invoice-item card mb-3 status-${invoice.status || 'draft'}`;
    div.dataset.index = index; // Manter o índice original para operações
    div.dataset.id = invoice.id; // Usar ID para referência estável

    let recipientName = 'Destinatário Desconhecido';
    let recipientLabel = 'Para:';
    if (invoice.recipientType === 'employee') {
        recipientName = getEmployeeNameById(invoice.recipientId);
        recipientLabel = 'Funcionário:';
    } else { // 'client' ou default
        recipientName = getClientNameById(invoice.recipientId);
        recipientLabel = 'Cliente:';
    }

    const totalAmount = (invoice.items || []).reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
    const today = new Date(getLocalDateString() + 'T00:00:00');
    const dueDate = invoice.dueDate ? new Date(invoice.dueDate + 'T00:00:00') : null;
    const isOverdue = invoice.status !== 'paid' && dueDate && dueDate < today;

    let effectiveStatus = invoice.status || 'draft';
    if (isOverdue && effectiveStatus !== 'overdue' && effectiveStatus !== 'paid') {
        effectiveStatus = 'overdue';
    }

    let statusBadge = '';
    switch(effectiveStatus) {
        case 'paid': statusBadge = '<span class="badge bg-success">Pago</span>'; break;
        case 'sent': statusBadge = '<span class="badge bg-info text-dark">Enviada</span>'; break;
        case 'overdue': statusBadge = `<span class="badge bg-danger">${invoice.recipientType === 'employee' ? 'Atrasado' : 'Atrasada'}</span>`; break;
        default: statusBadge = '<span class="badge bg-secondary">Rascunho</span>';
    }

    const titleText = invoice.recipientType === 'employee' ? 'Pagamento' : 'Fatura';

    const canEdit = hasPermission('vendas');
    const canMarkPaid = hasPermission('financeiro');
    const canMarkSent = hasPermission('vendas') && invoice.recipientType === 'client'; // Só envia para cliente
    const canDelete = hasPermission('admin');
    const canView = hasPermission('leitura');

    let pmIcon = '';
    switch (invoice.paymentMethod) {
        case 'pix': pmIcon = '<i class="fas fa-qrcode fa-fw text-muted ms-1" title="Pix"></i>'; break;
        case 'cash': pmIcon = '<i class="fas fa-money-bill-wave fa-fw text-muted ms-1" title="Dinheiro"></i>'; break;
        case 'card': pmIcon = '<i class="fas fa-credit-card fa-fw text-muted ms-1" title="Conta/Cartão"></i>'; break;
    }


    div.innerHTML = `
        <div class="card-body">
            <div class="d-flex justify-content-between align-items-start flex-wrap">
                <div class="mb-2">
                    <h5 class="card-title mb-1">${titleText} #${escapeHtml(invoice.number || invoice.id.substring(0, 6))}</h5>
                    <p class="card-subtitle mb-2 text-muted">${recipientLabel} ${escapeHtml(recipientName)}</p>
                    <p class="card-text mb-1"><small>Venc./Pag.: ${invoice.dueDate ? formatDisplayDate(invoice.dueDate) : 'N/D'}</small></p>
                    ${statusBadge} ${pmIcon}
                </div>
                <div class="text-end mb-2">
                    <strong class="d-block fs-5 mb-2"><span class="monetary-value">${formatCurrency(totalAmount)}</span></strong>
                    <div class="invoice-actions btn-group btn-group-sm" role="group">
                        ${canView ? `<button class="btn btn-sm btn-outline-primary view-invoice" title="Visualizar/Imprimir"><i class="fas fa-eye"></i></button>` : ''}
                        ${canEdit ? `<button class="btn btn-sm btn-outline-secondary edit-invoice" title="Editar"><i class="fas fa-pencil"></i></button>` : ''}
                        ${canMarkPaid && invoice.status !== 'paid' ? `<button class="btn btn-sm btn-outline-success mark-paid-invoice" title="Marcar como Pago"><i class="fas fa-check"></i> Pago</button>` : ''}
                        ${canMarkSent && invoice.status !== 'paid' && effectiveStatus !== 'overdue' ? `<button class="btn btn-sm btn-outline-info mark-sent-invoice" title="Marcar como Enviada"><i class="fas fa-paper-plane"></i> Enviada</button>` : ''}
                        ${canDelete ? `<button class="btn btn-sm btn-outline-danger delete-invoice" title="Excluir"><i class="fas fa-trash"></i></button>` : ''}
                    </div>
                </div>
            </div>
        </div>`;

     div.querySelectorAll('.invoice-actions button:disabled').forEach(btn => {
         btn.title = "Permissão necessária";
     });

    return div;
}

function openAddInvoiceModal() {
    if (!hasPermission('vendas')) return showAlert("Você precisa de permissão de 'Vendas' para criar faturas/pagamentos.", "warning");
    if (!isBusinessPlan || !invoiceModal || !invoiceForm) return;

    invoiceForm.reset();
    delete invoiceForm.dataset.editingId;
    invoiceForm.dataset.recipientType = 'client'; // Default

    populateRecipientSelects(); // Popula todos os selects relevantes

    // Garante estado inicial correto dos selects visíveis
    if(clientSelectGroup) clientSelectGroup.style.display = 'block';
    if(employeeSelectGroup) employeeSelectGroup.style.display = 'none';
    if(invoiceClientSelect) invoiceClientSelect.required = true;
    if(invoiceEmployeeSelect) invoiceEmployeeSelect.required = false;
    if(recipientTypeRadios.length > 0 && recipientTypeRadios[0]) recipientTypeRadios[0].checked = true; // Garante que 'Cliente' esteja marcado

    if (invoiceItemsContainer) invoiceItemsContainer.innerHTML = '';
    addInvoiceItemRow(); // Adiciona a primeira linha de item

    if (invoiceNumberInput) invoiceNumberInput.value = `FP-${new Date().getFullYear()}-${(invoices.length + 1).toString().padStart(4, '0')}`;
    if (invoiceDueDateInput) invoiceDueDateInput.value = getLocalDateString(new Date());
    if (invoicePaymentMethodSelect) invoicePaymentMethodSelect.value = ''; // Limpa método de pagamento
    if (invoiceProjectSelect) invoiceProjectSelect.value = ''; // Limpa projeto

    const title = invoiceModal.querySelector('.modal-title');
    if(title) title.textContent = "Nova Fatura / Pagamento";
    updatePlaceholders(); // Atualiza placeholders dos inputs monetários
    openModal(invoiceModal);
}

function openEditInvoiceModal(invoiceId) { // Recebe ID em vez de índice
    if (!hasPermission('vendas')) return showAlert("Você precisa de permissão de 'Vendas' para editar.", "warning");
    const inv = invoices.find(i => String(i.id) === String(invoiceId)); // Busca pelo ID
    if (!inv || !invoiceModal || !invoiceForm) {
        console.error("Erro ao encontrar fatura/pag. para editar. ID:", invoiceId);
        return showAlert("Erro ao carregar dados para edição.", "danger");
    }

    invoiceForm.reset();
    invoiceForm.dataset.editingId = inv.id; // Guarda o ID para edição
    invoiceForm.dataset.recipientType = inv.recipientType || 'client';

    populateRecipientSelects(); // Popula selects ANTES de definir os valores

    // Configura tipo de destinatário e selects correspondentes
    if (inv.recipientType === 'employee') {
        if(recipientTypeRadios.length > 1 && recipientTypeRadios[1]) recipientTypeRadios[1].checked = true;
        if(clientSelectGroup) clientSelectGroup.style.display = 'none';
        if(employeeSelectGroup) employeeSelectGroup.style.display = 'block';
        if(invoiceClientSelect) invoiceClientSelect.required = false;
        if(invoiceEmployeeSelect) invoiceEmployeeSelect.required = true;
        if(invoiceEmployeeSelect) invoiceEmployeeSelect.value = inv.recipientId || ''; // Define o valor AQUI
        if(invoiceClientSelect) invoiceClientSelect.value = '';
    } else { // 'client' ou default
        if(recipientTypeRadios.length > 0 && recipientTypeRadios[0]) recipientTypeRadios[0].checked = true;
        if(clientSelectGroup) clientSelectGroup.style.display = 'block';
        if(employeeSelectGroup) employeeSelectGroup.style.display = 'none';
        if(invoiceClientSelect) invoiceClientSelect.required = true;
        if(invoiceEmployeeSelect) invoiceEmployeeSelect.required = false;
        if(invoiceClientSelect) invoiceClientSelect.value = inv.recipientId || ''; // Define o valor AQUI
        if(invoiceEmployeeSelect) invoiceEmployeeSelect.value = '';
    }

    // Preenche outros campos
    if(invoiceProjectSelect) invoiceProjectSelect.value = inv.projectId || '';
    if(invoiceNumberInput) invoiceNumberInput.value = inv.number || '';
    if(invoiceDueDateInput) invoiceDueDateInput.value = inv.dueDate || '';
    if(invoicePaymentMethodSelect) invoicePaymentMethodSelect.value = inv.paymentMethod || '';

    // Preenche itens
    if(invoiceItemsContainer) invoiceItemsContainer.innerHTML = '';
    (inv.items || []).forEach(item => addInvoiceItemRow(item));
    if (!inv.items || inv.items.length === 0) addInvoiceItemRow(); // Garante pelo menos uma linha

    // Ajusta título do modal
    const title = invoiceModal.querySelector('.modal-title');
    if(title) title.textContent = `Editar ${inv.recipientType === 'employee' ? 'Pagamento' : 'Fatura'} #${escapeHtml(inv.number || inv.id.substring(0,6))}`;
    updatePlaceholders(); // Atualiza placeholders monetários
    openModal(invoiceModal); // Abre o modal
}

function addInvoiceItemRow(itemData = null) {
    if (!invoiceItemsContainer) return;
    const div = document.createElement('div');
    div.className = 'invoice-item-row row gx-2 mb-2 align-items-center';
    div.innerHTML = `
        <div class="col-sm-5">
            <label class="visually-hidden">Descrição</label>
            <input type="text" class="form-control form-control-sm item-description" placeholder="Descrição do Item/Serviço" required value="${itemData ? escapeHtml(itemData.description) : ''}">
        </div>
        <div class="col-sm-2 col-6">
             <label class="visually-hidden">Quantidade</label>
            <input type="number" class="form-control form-control-sm item-quantity" placeholder="Qtd" step="any" min="0.01" required value="${itemData ? itemData.quantity : '1'}">
        </div>
        <div class="col-sm-3 col-6">
             <label class="visually-hidden">Preço Unitário</label>
            <input type="number" class="form-control form-control-sm item-unit-price monetary-input" placeholder="Preço Unit." step="0.01" min="0.01" required value="${itemData && itemData.unitPrice ? itemData.unitPrice.toFixed(2) : ''}">
        </div>
        <div class="col-sm-2 d-flex align-items-center pt-1 pt-sm-0">
            <button type="button" class="btn btn-sm btn-outline-danger remove-item-btn w-100" title="Remover Item"><i class="fas fa-times"></i></button>
        </div>
    `;
    div.querySelector('.remove-item-btn').addEventListener('click', (e) => {
        e.target.closest('.invoice-item-row').remove();
        // Se remover a última linha, adiciona uma nova vazia
        if (invoiceItemsContainer.children.length === 0) {
            addInvoiceItemRow();
        }
    });
    // Atualiza placeholder do input monetário desta linha
    div.querySelectorAll('.monetary-input').forEach(inp => updatePlaceholders(inp));

    invoiceItemsContainer.appendChild(div);
}

async function saveInvoice(event) {
    event.preventDefault();
    if (!isBusinessPlan || !invoiceForm) return;

    if (!hasPermission('vendas')) return showAlert("Permissão de 'Vendas' necessária para salvar.", "warning");

    const editingId = invoiceForm.dataset.editingId || null;
    const items = [];
    let formValid = true;
    let firstInvalidField = null;

    // Valida itens
    invoiceItemsContainer.querySelectorAll('.invoice-item-row').forEach(row => {
        const descriptionInput = row.querySelector('.item-description');
        const quantityInput = row.querySelector('.item-quantity');
        const unitPriceInput = row.querySelector('.item-unit-price');
        const description = descriptionInput?.value.trim();
        const quantity = parseFloat(quantityInput?.value) || 0;
        const unitPrice = parseFloat(String(unitPriceInput?.value).replace(',', '.')) || 0;

        // Reset validation state
        [descriptionInput, quantityInput, unitPriceInput].forEach(el => el?.classList.remove('is-invalid'));

        let itemValid = true;
        if (!description) { itemValid = false; descriptionInput?.classList.add('is-invalid'); if (!firstInvalidField) firstInvalidField = descriptionInput; }
        if (quantity <= 0) { itemValid = false; quantityInput?.classList.add('is-invalid'); if (!firstInvalidField && itemValid) firstInvalidField = quantityInput; }
        if (unitPrice <= 0) { itemValid = false; unitPriceInput?.classList.add('is-invalid'); if (!firstInvalidField && itemValid) firstInvalidField = unitPriceInput; }

        if (itemValid) {
            items.push({ description, quantity, unitPrice });
        } else {
            formValid = false;
        }
    });

    if (items.length === 0 && !formValid) {
         // Se nenhum item for válido E o formulário já era inválido (antes dos itens), foca no primeiro campo inválido geral
         // Se nenhum item for válido MAS o form era válido, foca no primeiro campo de item inválido
        if (!firstInvalidField) { // Se nenhum campo de item foi marcado, talvez o erro esteja antes
           firstInvalidField = invoiceItemsContainer.querySelector('.is-invalid');
        }
        if (firstInvalidField) firstInvalidField.focus();
        return showAlert('Verifique os campos obrigatórios (*) e os itens da fatura/pagamento.', 'warning');
    }
     if (items.length === 0) {
         // Se não há itens válidos, mesmo que outros campos estejam OK.
         if (!firstInvalidField) firstInvalidField = invoiceItemsContainer.querySelector('.item-description'); // Foca na primeira descrição
         if(firstInvalidField) firstInvalidField.focus();
         return showAlert('Adicione pelo menos um item válido à fatura/pagamento.', 'warning');
     }


    // Valida outros campos
    const recipientType = document.querySelector('input[name="invoiceRecipientType"]:checked')?.value || 'client';
    let recipientId = null;
    let recipientSelectElement = null;
    if (recipientType === 'client') { recipientId = invoiceClientSelect?.value; recipientSelectElement = invoiceClientSelect; }
    else { recipientId = invoiceEmployeeSelect?.value; recipientSelectElement = invoiceEmployeeSelect; }
    const paymentMethod = invoicePaymentMethodSelect?.value;
    const projectId = invoiceProjectSelect?.value || null;
    const number = invoiceNumberInput?.value.trim();
    const dueDate = invoiceDueDateInput?.value;

    // Reset validation state for general fields
    [recipientSelectElement, invoicePaymentMethodSelect, invoiceNumberInput, invoiceDueDateInput].forEach(el => el?.classList.remove('is-invalid'));

    if (!recipientId) { formValid = false; if (!firstInvalidField) firstInvalidField = recipientSelectElement; recipientSelectElement?.classList.add('is-invalid'); }
    if (!paymentMethod) { formValid = false; if (!firstInvalidField) firstInvalidField = invoicePaymentMethodSelect; invoicePaymentMethodSelect?.classList.add('is-invalid'); }
    if (!number) { formValid = false; if (!firstInvalidField) firstInvalidField = invoiceNumberInput; invoiceNumberInput?.classList.add('is-invalid'); }
    if (!dueDate) { formValid = false; if (!firstInvalidField) firstInvalidField = invoiceDueDateInput; invoiceDueDateInput?.classList.add('is-invalid'); }

    // Se o formulário se tornou inválido APÓS a verificação dos itens (ou seja, erro nos campos gerais)
    if (!formValid) {
        if (firstInvalidField) firstInvalidField.focus(); // Foca no primeiro erro encontrado
        return showAlert('Verifique os campos obrigatórios (*).', 'warning');
    }

    // Se chegou aqui, está tudo válido e tem itens
    const existingInvoice = editingId ? invoices.find(i => String(i.id) === String(editingId)) : null;
    const invoiceData = {
        id: editingId || `inv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        number, recipientType, recipientId, paymentMethod, projectId, dueDate, items,
        status: existingInvoice?.status || 'draft', // Mantém status se editando
        createdAt: existingInvoice?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        paidDate: existingInvoice?.paidDate || null,
        sentDate: existingInvoice?.sentDate || null,
    };

    if (editingId) {
        const index = invoices.findIndex(i => String(i.id) === String(editingId));
        if (index > -1) {
            invoices[index] = invoiceData;
        } else {
            console.error("Erro ao encontrar fatura/pag. para editar. ID:", editingId);
            return showAlert("Erro interno: Fatura/Pag. para edição não encontrado.", "danger");
        }
    } else {
        invoices.push(invoiceData);
    }

    saveDataToStorage(); // Salva tudo
    renderInvoices(); // Re-renderiza a lista de faturas/pagamentos
    closeModal(invoiceModal); // Fecha o modal
    showAlert(`Fatura/Pagamento ${editingId ? 'atualizado' : 'salvo'} com sucesso!`, 'success');
    delete invoiceForm.dataset.editingId; // Limpa ID de edição
    // Limpeza adicional do formulário pode ser desnecessária se o modal for fechado
}

async function deleteInvoice(invoiceId) { // Recebe ID
     if (!hasPermission('admin')) return showAlert("Apenas administradores podem excluir faturas/pagamentos.", "warning");
     const index = invoices.findIndex(i => String(i.id) === String(invoiceId)); // Encontra pelo ID
     if (index === -1) return showAlert("Fatura/Pagamento inválido para exclusão.", "danger");

     const inv = invoices[index];
     // Verifica se existe transação associada (pelo originatingBillId)
     const linkedTransaction = transactions.find(tx => tx.originatingBillId === inv.id);

     let confirmMsg = `Excluir ${inv.recipientType === 'employee' ? 'Pagamento' : 'Fatura'} #${escapeHtml(inv.number || inv.id.substring(0,6))}?`;
     if (linkedTransaction) {
         confirmMsg += `<br><strong class="text-warning mt-2 d-block">Atenção:</strong> Existe uma transação (${linkedTransaction.type === 'income' ? 'Receita' : 'Despesa'}) vinculada a este item. A transação <strong>NÃO</strong> será excluída automaticamente.`;
     }
     confirmMsg += "<br>Esta ação não pode ser desfeita.";

     const conf = await showConfirmModal(confirmMsg, "Confirmar Exclusão", "danger");
     if(conf) {
         invoices.splice(index, 1); // Remove a fatura/pagamento do array
         saveDataToStorage(); // Salva a alteração
         renderInvoices(); // Re-renderiza a lista
         showAlert("Fatura/Pagamento excluído.", "info");
         // Não removemos a transação, apenas a fatura/pagamento.
         // Se a transação foi excluída separadamente, o link originatingBillId ficará órfão.
     }
}

async function markInvoicePaid(invoiceId) { // Recebe ID
    if (!hasPermission('financeiro')) return showAlert("Apenas usuários Financeiros ou Admins podem marcar como pago.", "warning");
    const index = invoices.findIndex(i => String(i.id) === String(invoiceId)); // Encontra pelo ID
    if (index === -1) return showAlert("Fatura/Pagamento inválido.", "danger");

    const inv = invoices[index];
    if (inv.status === 'paid') return showAlert("Já está marcado como pago.", "info");

    // Verifica se já existe uma transação vinculada a esta fatura/pagamento
    const existingTx = transactions.find(tx => tx.originatingBillId === inv.id);
    if (existingTx) {
        return showAlert(`Atenção: Já existe uma transação (ID: ${existingTx.id.substring(0,8)}...) vinculada a este item. Não é possível marcar como pago novamente. Verifique a transação existente.`, 'warning', 8000);
    }

    const totalAmount = (inv.items || []).reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
    const isEmployeePayment = inv.recipientType === 'employee';
    const recipientName = isEmployeePayment ? getEmployeeNameById(inv.recipientId) : getClientNameById(inv.recipientId);
    const paymentMethod = inv.paymentMethod || 'card'; // Default para 'card' se não definido
    const category = isEmployeePayment ? 'Salários' : 'Vendas'; // Ajuste 'Salários' se necessário
    const itemDescription = isEmployeePayment ? `Pagamento Funcionário #${inv.number} (${recipientName})` : `Recebimento Fatura #${inv.number} (${recipientName})`;
    const transactionType = isEmployeePayment ? 'expense' : 'income';
    const transactionTags = isEmployeePayment ? ['pagamento-funcionario', 'auto'] : ['faturamento', 'auto'];

    // --- VERIFICAÇÃO DE SALDO ANTES DE MARCAR COMO PAGO (se for despesa) ---
    if (transactionType === 'expense') {
        const { currentPix, currentCash, currentCard } = calculateCurrentBalances();
        let balance = 0;
        let methodName = '';
        if (paymentMethod === 'pix') { balance = currentPix; methodName = 'Pix'; }
        else if (paymentMethod === 'cash') { balance = currentCash; methodName = 'Dinheiro'; }
        else if (paymentMethod === 'card') { balance = currentCard; methodName = 'Conta/Cartão'; }

        if (paymentMethod === 'pix' || paymentMethod === 'cash' || paymentMethod === 'card') {
            if (totalAmount > balance) {
                return showAlert(`Saldo ${methodName} insuficiente (${formatCurrency(balance)}) para registrar este pagamento. Ação cancelada.`, 'danger');
            }
        } else {
            // Se o método for inválido ou não for um dos três, impede a ação? Ou permite sem checar saldo?
             console.warn(`Método de pagamento '${paymentMethod}' não suporta verificação de saldo.`);
             // Poderia adicionar um confirm aqui:
             // const confNoBalanceCheck = await showConfirmModal(`Método '${paymentMethod}' não permite verificar saldo. Deseja continuar o registro da despesa assim mesmo?`, "Confirmar Despesa", "warning");
             // if (!confNoBalanceCheck) return;
        }
    }
    // --- FIM VERIFICAÇÃO SALDO ---

    const actionText = isEmployeePayment ? 'Registrar Pagamento' : 'Confirmar Recebimento';
    const modalTitleText = isEmployeePayment ? 'Confirmar Pagamento Funcionário' : 'Confirmar Pagamento Fatura';
    const confirmMsg = `Marcar ${isEmployeePayment ? 'Pagamento' : 'Fatura'} #${escapeHtml(inv.number)} (${formatCurrency(totalAmount)}) para "${escapeHtml(recipientName)}" como PAGO?<br><br><strong class="${isEmployeePayment ? 'text-danger':'text-success'}">Atenção:</strong> Uma transação de ${isEmployeePayment ? 'DESPESA':'RECEITA'} será criada automaticamente usando o método "${paymentMethod.toUpperCase()}".`;

    const conf = await showConfirmModal(confirmMsg, modalTitleText, isEmployeePayment ? 'danger' : 'success');

    if (conf) {
        inv.status = 'paid';
        inv.paidDate = getLocalDateString();
        inv.updatedAt = new Date().toISOString();

        const newTx = {
             id: `tx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`, // ID único para transação
             date: inv.paidDate,
             item: itemDescription,
             amount: totalAmount,
             type: transactionType,
             category: category,
             paymentMethod: paymentMethod,
             description: `${isEmployeePayment ? 'Pagamento' : 'Recebimento'} automático referente à Fatura/Pag. ID ${inv.id}. ${isEmployeePayment ? 'Funcionário' : 'Cliente'}: ${recipientName}.`,
             isScheduled: false, // Não é agendada, é o resultado de marcar como pago
             originatingBillId: inv.id, // << VINCULA à Fatura/Pagamento original
             isRecurring: false,
             originatingRecurringId: null,
             tags: transactionTags,
             projectId: inv.projectId || null,
             clientId: !isEmployeePayment ? (inv.recipientId || null) : null,
             employeeId: isEmployeePayment ? (inv.recipientId || null) : null,
             originatingDebtId: null, // Não é originada de uma dívida do novo sistema
             deductible: false, // Faturamento/Salário geralmente não é dedutível (ajuste se necessário)
             attachmentDataUrl: null, // Sem anexo automático
             createdAt: new Date().toISOString(),
             updatedAt: new Date().toISOString()
        };
        transactions.push(newTx);

        saveDataToStorage(); // Salva tudo (invoices e transactions)
        renderInvoices(); // Atualiza lista de faturas/pagamentos
        refreshAllUIComponents(); // Atualiza saldos, gráficos, etc.
        showAlert(`${isEmployeePayment ? 'Pagamento registrado' : 'Fatura marcada como paga'} e Transação criada!`, "success");
    }
}

function markInvoiceSent(invoiceId) { // Recebe ID
    if (!hasPermission('vendas')) return showAlert("Permissão de 'Vendas' necessária para marcar como enviada.", "warning");
    const index = invoices.findIndex(i => String(i.id) === String(invoiceId)); // Encontra pelo ID
    if (index === -1) return showAlert("Fatura/Pagamento inválido.", "danger");

    const inv = invoices[index];
    // Só permite marcar como enviada se for para Cliente
    if (inv.recipientType !== 'client') return showAlert("Apenas faturas para clientes podem ser marcadas como enviadas.", "warning");
    if (inv.status === 'paid') return showAlert("Não é possível marcar uma fatura paga como enviada.", "info");
    if (inv.status === 'sent') return showAlert("Fatura já foi marcada como enviada.", "info");

    inv.status = 'sent';
    inv.sentDate = getLocalDateString();
    inv.updatedAt = new Date().toISOString();
    saveDataToStorage(); // Salva a alteração
    renderInvoices(); // Atualiza a lista
    showAlert("Fatura marcada como enviada. (Envio real requer backend).", "info");
}

function openInvoiceViewModal(invoiceId) {
    if (!hasPermission('leitura')) { return showAlert("Permissão necessária para visualizar faturas/pagamentos.", "warning"); }
    const invoice = invoices.find(inv => String(inv.id) === String(invoiceId));
    const modal = document.getElementById('invoiceViewModal');
    if (!invoice || !modal) { return showAlert("Erro ao encontrar fatura/pagamento ou modal.", "danger"); }

    const viewCompanyLogo = modal.querySelector('.invoice-header img');
    const viewCompanyName = modal.querySelector('#viewCompanyName');
    const viewCompanyAddress = modal.querySelector('#viewCompanyAddress');
    const viewCompanyContact = modal.querySelector('#viewCompanyContact');
    const viewCompanyTaxId = modal.querySelector('#viewCompanyTaxId');
    const viewInvoiceNumber = modal.querySelector('#viewInvoiceNumber');
    const viewInvoiceDate = modal.querySelector('#viewInvoiceDate');
    const viewInvoiceDueDate = modal.querySelector('#viewInvoiceDueDate');
    const viewInvoiceStatus = modal.querySelector('#viewInvoiceStatus');
    const viewClientName = modal.querySelector('#viewClientName'); // Usaremos este span para ambos
    const viewClientDetailsPlaceholder = modal.querySelector('#viewClientDetailsPlaceholder');
    const viewProjectInfo = modal.querySelector('#viewProjectInfo');
    const viewProjectName = modal.querySelector('#viewProjectName');
    const viewInvoiceItems = modal.querySelector('#viewInvoiceItems');
    const viewInvoiceSubtotal = modal.querySelector('#viewInvoiceSubtotal');
    const viewInvoiceTotal = modal.querySelector('#viewInvoiceTotal');
    const viewInvoiceNotes = modal.querySelector('#viewInvoiceNotes');
    const printBtn = modal.querySelector('.print-invoice-btn');
    const modalTitle = modal.querySelector('.modal-title');
    const documentTitle = modal.querySelector('#viewDocumentTitle'); // Span para "FATURA" ou "PAGAMENTO"

    // Adapta Título do Modal e Documento
    const isEmployee = invoice.recipientType === 'employee';
    const titleText = isEmployee ? 'Visualizar Pagamento' : 'Visualizar Fatura';
    const docTitleText = isEmployee ? 'PAGAMENTO' : 'FATURA';
    if(modalTitle) modalTitle.textContent = titleText;
    if(documentTitle) documentTitle.textContent = docTitleText;


    if (viewCompanyName) viewCompanyName.textContent = escapeHtml(companySettings.name || 'Nome da Empresa não definido');
    if (viewCompanyAddress) viewCompanyAddress.textContent = escapeHtml(companySettings.address || '');
    if (viewCompanyContact) viewCompanyContact.textContent = `Telefone: ${escapeHtml(companySettings.phone || 'N/D')} | Email: ${escapeHtml(companySettings.email || 'N/D')}`;
    if (viewCompanyTaxId) viewCompanyTaxId.textContent = `CNPJ/CPF: ${escapeHtml(companySettings.taxId || 'N/D')}`;
    if (viewCompanyLogo instanceof HTMLImageElement) { viewCompanyLogo.src = companySettings.logoUrl || 'img/logo_placeholder.png'; viewCompanyLogo.style.display = companySettings.logoUrl ? 'inline-block' : 'none'; viewCompanyLogo.alt = `${companySettings.name || 'Empresa'} Logo`; }
    if (viewInvoiceNumber) viewInvoiceNumber.textContent = escapeHtml(invoice.number || invoice.id.substring(0, 8));
    if (viewInvoiceDate) viewInvoiceDate.textContent = invoice.createdAt ? formatDisplayDate(invoice.createdAt.substring(0, 10)) : 'N/D';
    if (viewInvoiceDueDate) viewInvoiceDueDate.textContent = invoice.dueDate ? formatDisplayDate(invoice.dueDate) : 'N/D';

    if (viewInvoiceStatus) {
        let statusText = 'Rascunho'; let statusClass = 'bg-secondary';
        const today = new Date(getLocalDateString() + 'T00:00:00');
        const dueDate = invoice.dueDate ? new Date(invoice.dueDate + 'T00:00:00') : null;
        const isOverdue = invoice.status !== 'paid' && dueDate && dueDate < today;
        let effectiveStatus = invoice.status || 'draft';
        if (isOverdue && effectiveStatus !== 'overdue' && effectiveStatus !== 'paid') { effectiveStatus = 'overdue'; }
        switch (effectiveStatus) { case 'paid': statusText = 'Pago'; statusClass = 'bg-success'; break; case 'sent': statusText = 'Enviada'; statusClass = 'bg-info text-dark'; break; case 'overdue': statusText = isEmployee ? 'Atrasado' : 'Atrasada'; statusClass = 'bg-danger'; break; default: statusText = 'Rascunho'; statusClass = 'bg-secondary'; }
        viewInvoiceStatus.textContent = statusText; viewInvoiceStatus.className = `badge ${statusClass}`;
    }

    // Adapta Destinatário
    const clientInfoDiv = modal.querySelector('.invoice-client-info');
    if (clientInfoDiv && viewClientName && viewClientDetailsPlaceholder) {
        const recipientLabel = clientInfoDiv.querySelector('strong');
        if (recipientLabel) recipientLabel.textContent = isEmployee ? 'Funcionário:' : 'Cliente:';
        viewClientName.textContent = escapeHtml(isEmployee ? getEmployeeNameById(invoice.recipientId) : getClientNameById(invoice.recipientId));
        viewClientDetailsPlaceholder.textContent = ''; // Adicionar detalhes extras aqui se tiver (email, tel, etc)
        // Exemplo: Se o objeto cliente tivesse email:
        // if (!isEmployee) {
        //     const client = clients.find(c => c.id === invoice.recipientId);
        //     if (client?.email) viewClientDetailsPlaceholder.textContent = client.email;
        // }
    }


    if (invoice.projectId && viewProjectInfo && viewProjectName) { viewProjectName.textContent = escapeHtml(getProjectNameById(invoice.projectId)); viewProjectInfo.style.display = 'block'; }
    else if (viewProjectInfo) { viewProjectInfo.style.display = 'none'; }

    let subtotal = 0;
    if (viewInvoiceItems) {
        viewInvoiceItems.innerHTML = '';
        if (invoice.items && invoice.items.length > 0) {
            invoice.items.forEach(item => {
                const itemTotal = (item.quantity || 0) * (item.unitPrice || 0);
                subtotal += itemTotal;
                const row = viewInvoiceItems.insertRow();
                row.innerHTML = `<td>${escapeHtml(item.description)}</td> <td class="text-end">${item.quantity}</td> <td class="text-end">${formatCurrency(item.unitPrice)}</td> <td class="text-end">${formatCurrency(itemTotal)}</td>`;
            });
        } else { viewInvoiceItems.innerHTML = '<tr><td colspan="4" class="text-center text-muted">Nenhum item adicionado.</td></tr>'; }
    }
    const total = subtotal; // Adicionar lógica de impostos/descontos aqui se necessário
    if (viewInvoiceSubtotal) viewInvoiceSubtotal.textContent = formatCurrency(subtotal);
    if (viewInvoiceTotal) viewInvoiceTotal.textContent = formatCurrency(total);

    if (viewInvoiceNotes) { viewInvoiceNotes.innerHTML = escapeHtml(companySettings.invoiceNotes || 'Nenhuma observação definida.').replace(/\n/g, '<br>'); }

    // Recria o botão de impressão para garantir que o listener funcione após reabrir o modal
    if (printBtn) { const newPrintBtn = printBtn.cloneNode(true); printBtn.parentNode.replaceChild(newPrintBtn, printBtn); newPrintBtn.addEventListener('click', () => { window.print(); }); }

    openModal(modal);
}


// --- Funções de Projetos e Clientes ---
// (renderClients, renderProjects, addClient, addProject, deleteClient, deleteProject - permanecem iguais, mas usam saveBusinessDataToStorage)
export function renderClients() { if (!isBusinessPlan || !clientListContainer) return; if (!hasPermission('vendas')) { clientListContainer.innerHTML = '<p class="text-muted small">Permissão necessária.</p>'; if (newClientNameInput) newClientNameInput.disabled = true; if (addClientBtn) addClientBtn.disabled = true; return; } else { if (newClientNameInput) newClientNameInput.disabled = false; if (addClientBtn) addClientBtn.disabled = false; } clientListContainer.innerHTML = ''; if (clients.length === 0) { clientListContainer.innerHTML = '<p class="text-muted small p-2 text-center">Nenhum cliente.</p>'; return; } const canDelete = hasPermission('admin'); clients.sort((a,b) => a.name.localeCompare(b.name)).forEach(client => { const div = document.createElement('div'); div.className = 'list-group-item list-group-item-action d-flex justify-content-between align-items-center py-1 px-2'; div.innerHTML = `<span class="small">${escapeHtml(client.name)}</span> ${canDelete ? `<button class="btn btn-sm btn-outline-danger delete-client py-0 px-1" data-id="${client.id}" title="Excluir Cliente ${escapeHtml(client.name)}"><i class="fas fa-trash fa-xs"></i></button>` : ''}`; clientListContainer.appendChild(div); }); }
export function renderProjects() { if (!isBusinessPlan || !projectListContainer) return; if (!hasPermission('vendas')) { projectListContainer.innerHTML = '<p class="text-muted small">Permissão necessária.</p>'; if (newProjectNameInput) newProjectNameInput.disabled = true; if (addProjectBtn) addProjectBtn.disabled = true; return; } else { if (newProjectNameInput) newProjectNameInput.disabled = false; if (addProjectBtn) addProjectBtn.disabled = false; } projectListContainer.innerHTML = ''; if (projects.length === 0) { projectListContainer.innerHTML = '<p class="text-muted small p-2 text-center">Nenhum projeto.</p>'; return; } const canDelete = hasPermission('admin'); projects.sort((a,b) => a.name.localeCompare(b.name)).forEach(project => { const div = document.createElement('div'); div.className = 'list-group-item list-group-item-action d-flex justify-content-between align-items-center py-1 px-2'; div.innerHTML = `<span class="small">${escapeHtml(project.name)}</span> ${canDelete ? `<button class="btn btn-sm btn-outline-danger delete-project py-0 px-1" data-id="${project.id}" title="Excluir Projeto ${escapeHtml(project.name)}"><i class="fas fa-trash fa-xs"></i></button>` : ''}`; projectListContainer.appendChild(div); }); }
function addClient() { if (!isBusinessPlan || !newClientNameInput || !hasPermission('vendas')) return; const name = newClientNameInput.value.trim(); if (!name) return showAlert("Digite o nome do cliente.", "warning"); if (clients.some(c => c.name.toLowerCase() === name.toLowerCase())) return showAlert("Cliente já existe.", "warning"); clients.push({ id: `client_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`, name: name }); saveBusinessDataToStorage(); renderClients(); populateRecipientSelects(); newClientNameInput.value = ''; showAlert("Cliente adicionado!", "success"); }
function addProject() { if (!isBusinessPlan || !newProjectNameInput || !hasPermission('vendas')) return; const name = newProjectNameInput.value.trim(); if (!name) return showAlert("Digite o nome do projeto.", "warning"); if (projects.some(p => p.name.toLowerCase() === name.toLowerCase())) return showAlert("Projeto já existe.", "warning"); projects.push({ id: `proj_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`, name: name }); saveBusinessDataToStorage(); renderProjects(); populateRecipientSelects(); newProjectNameInput.value = ''; showAlert("Projeto adicionado!", "success"); }
async function deleteClient(id) { if (!isBusinessPlan || !hasPermission('admin')) return; const index = clients.findIndex(c => String(c.id) === String(id)); if (index === -1) return showAlert("Cliente não encontrado.", "danger"); const client = clients[index]; const isInUseInvoice = invoices.some(inv => inv.recipientType === 'client' && String(inv.recipientId) === String(id)); const isInUseTransaction = transactions.some(tx => String(tx.clientId) === String(id)); let confirmMessage = `Excluir cliente "${escapeHtml(client.name)}"?`; if (isInUseInvoice || isInUseTransaction) { confirmMessage += `<br><strong class="text-danger mt-2 d-block">Atenção:</strong> Cliente associado a faturas ou transações. Exclusão NÃO removerá associações.`; } const conf = await showConfirmModal(confirmMessage, "Confirmar Exclusão", "danger"); if (conf) { clients.splice(index, 1); saveBusinessDataToStorage(); renderClients(); populateRecipientSelects(); showAlert("Cliente excluído.", "info"); } }
async function deleteProject(id) { if (!isBusinessPlan || !hasPermission('admin')) return; const index = projects.findIndex(p => String(p.id) === String(id)); if (index === -1) return showAlert("Projeto não encontrado.", "danger"); const project = projects[index]; const isInUseInvoice = invoices.some(inv => String(inv.projectId) === String(id)); const isInUseTransaction = transactions.some(tx => String(tx.projectId) === String(id)); let confirmMessage = `Excluir projeto "${escapeHtml(project.name)}"?`; if (isInUseInvoice || isInUseTransaction) { confirmMessage += `<br><strong class="text-danger mt-2 d-block">Atenção:</strong> Projeto associado a faturas ou transações. Exclusão NÃO removerá associações.`; } const conf = await showConfirmModal(confirmMessage, "Confirmar Exclusão", "danger"); if (conf) { projects.splice(index, 1); saveBusinessDataToStorage(); renderProjects(); populateRecipientSelects(); showAlert("Projeto excluído.", "info"); } }


// --- Funções Auxiliares para Acesso Externo (Base usa isso) ---
export function getClientNameById(clientId) {
    if (!clientId || !Array.isArray(clients)) return clientId || 'N/D';
    const client = clients.find(c => String(c.id) === String(clientId));
    return client ? client.name : `Cliente ID ${String(clientId).substring(0,6)}...`; // Mais curto
}
export function getProjectNameById(projectId) {
    if (!projectId || !Array.isArray(projects)) return projectId || 'N/D';
    const project = projects.find(p => String(p.id) === String(projectId));
    return project ? project.name : `Projeto ID ${String(projectId).substring(0,6)}...`; // Mais curto
}


// --- Funções de Relatório Fiscal (Simulado - permanecem iguais) ---
function generateTaxReport() { if (!hasPermission('financeiro')) return showAlert("Apenas usuários Financeiros ou Admins podem gerar este relatório.", "warning"); if (!isBusinessPlan || !taxReportContainer || !taxReportStartDate || !taxReportEndDate) return; const startDate = taxReportStartDate.value; const endDate = taxReportEndDate.value; if (!startDate || !endDate) return showAlert("Selecione as datas de início e fim para o relatório fiscal.", "warning"); const dStart = new Date(startDate + 'T00:00:00'); const dEnd = new Date(endDate + 'T23:59:59'); if (dStart > dEnd) return showAlert("Data inicial não pode ser maior que a final.", "warning"); taxReportContainer.innerHTML = '<p class="text-center text-muted p-3"><i class="fas fa-spinner fa-spin"></i> Gerando relatório...</p>'; const transactionsInPeriod = transactions.filter(t => { const tDate = new Date(t.date + 'T00:00:00'); return tDate >= dStart && tDate <= dEnd; }); const deductibleExpenses = transactionsInPeriod.filter(t => t.type === 'expense' && t.deductible); const expensesByCategory = deductibleExpenses.reduce((acc, curr) => { const category = curr.category || 'Sem Categoria'; acc[category] = (acc[category] || 0) + curr.amount; return acc; }, {}); const totalDeductible = deductibleExpenses.reduce((sum, t) => sum + t.amount, 0); const incomeInPeriod = transactionsInPeriod.filter(t => t.type === 'income'); const totalIncome = incomeInPeriod.reduce((sum, t) => sum + t.amount, 0); const incomeByCategory = incomeInPeriod.reduce((acc, curr) => { const category = curr.category || 'Sem Categoria'; acc[category] = (acc[category] || 0) + curr.amount; return acc; }, {}); let reportHtml = ` <h4 class="mb-3">Relatório Fiscal Simplificado</h4> <p><strong>Período:</strong> ${formatDisplayDate(startDate)} a ${formatDisplayDate(endDate)}</p> <hr> <div class="row"> <div class="col-md-6 mb-4"> <h5><i class="fas fa-arrow-down text-danger me-2"></i>Despesas Dedutíveis</h5> <p class="fs-4 fw-bold text-danger"><span class="monetary-value">${formatCurrency(totalDeductible)}</span></p> ${Object.keys(expensesByCategory).length > 0 ? `<h6 class="mt-3">Detalhes por Categoria (Dedutível):</h6><ul class="list-group list-group-flush small">${Object.entries(expensesByCategory).sort(([,a], [,b]) => b - a).map(([category, amount]) => `<li class="list-group-item d-flex justify-content-between align-items-center px-0 py-1">${escapeHtml(category)}<span class="badge bg-light text-dark monetary-value amount-negative">${formatCurrency(amount)}</span></li>`).join('')}</ul>` : '<p class="text-muted small mt-3">Nenhuma despesa dedutível encontrada.</p>'} </div> <div class="col-md-6 mb-4"> <h5><i class="fas fa-arrow-up text-success me-2"></i>Receitas</h5> <p class="fs-4 fw-bold text-success"><span class="monetary-value">${formatCurrency(totalIncome)}</span></p> ${Object.keys(incomeByCategory).length > 0 ? `<h6 class="mt-3">Detalhes por Categoria (Receita):</h6><ul class="list-group list-group-flush small">${Object.entries(incomeByCategory).sort(([,a], [,b]) => b - a).map(([category, amount]) => `<li class="list-group-item d-flex justify-content-between align-items-center px-0 py-1">${escapeHtml(category)}<span class="badge bg-light text-dark monetary-value amount-positive">${formatCurrency(amount)}</span></li>`).join('')}</ul>` : '<p class="text-muted small mt-3">Nenhuma receita encontrada.</p>'} </div> </div> <hr> <p class="text-muted small fst-italic">Relatório simplificado. Consulte um contador.</p> `; setTimeout(() => { taxReportContainer.innerHTML = reportHtml; if (valuesHidden) { taxReportContainer.querySelectorAll('.monetary-value').forEach(el => el.textContent = 'R$ ***'); } }, 300); }


// ============================================================
// Gerenciamento de Usuários (Simulado - permanece igual)
// ============================================================
function renderUserManagementSection() { if (!userManagementSettings || !hasPermission('admin')) { if (userManagementSettings) userManagementSettings.style.display = 'none'; return; } userManagementSettings.style.display = ''; if (!userListContainer || !addUserBtn) { console.error("Elementos DOM user mgmt não encontrados."); if (userListContainer) userListContainer.innerHTML = '<p class="text-danger">Erro: UI ausente.</p>'; return; } addUserBtn.disabled = !hasPermission('admin'); userListContainer.innerHTML = ''; if (companyUsers.length === 0) { companyUsers = [ { id: 'user_admin', name: 'Admin Principal', email: 'admin@simulado.com', role: 'admin' }, { id: 'user_financeiro', name: 'Maria Finanças', email: 'financeiro@simulado.com', role: 'financeiro' }, { id: 'user_vendas', name: 'João Vendas', email: 'vendas@simulado.com', role: 'vendas' }, { id: 'user_leitura', name: 'Carlos Leitura', email: 'leitura@simulado.com', role: 'leitura' }, ]; if (!companyUsers.some(u => u.id === currentUser.id)) { companyUsers.push({...currentUser}); } } if (companyUsers.length === 0) { userListContainer.innerHTML = '<p class="text-muted small p-2 text-center">Nenhum usuário (Simulado).</p>'; return; } companyUsers.sort((a, b) => a.name.localeCompare(b.name)).forEach(user => { const div = document.createElement('div'); div.className = 'list-group-item list-group-item-action d-flex justify-content-between align-items-center py-1 px-2'; div.dataset.userId = user.id; const canDelete = hasPermission('admin') && user.id !== currentUser.id; div.innerHTML = `<div class="small"><span class="fw-bold">${escapeHtml(user.name)}</span> <span class="badge bg-secondary ms-2">${escapeHtml(user.role)}</span><br><small class="text-muted">${escapeHtml(user.email)}</small></div> <div> <button class="btn btn-sm btn-outline-secondary edit-user py-0 px-1 me-1" data-id="${user.id}" title="Editar (Simulado)" ${!hasPermission('admin') ? 'disabled' : ''}><i class="fas fa-pencil fa-xs"></i></button> <button class="btn btn-sm btn-outline-danger delete-user py-0 px-1" data-id="${user.id}" title="Excluir Usuário ${escapeHtml(user.name)}" ${!canDelete ? 'disabled' : ''}><i class="fas fa-trash fa-xs"></i></button> </div>`; userListContainer.appendChild(div); }); }
function openAddUserModal() { showAlert("Abertura de Modal de Usuário (simulado via prompt).", "info"); const name = prompt("Nome do novo usuário:"); if (!name) return; const email = prompt(`Email para ${name}:`); if (!email) return; const role = prompt(`Role (admin, financeiro, vendas, leitura) para ${name}:`); const validRoles = ['admin', 'financeiro', 'vendas', 'leitura']; if (!role || !validRoles.includes(role.toLowerCase())) { return showAlert("Role inválido. Use: " + validRoles.join(', '), "warning"); } const newUser = { id: 'user_' + Date.now(), name: name.trim(), email: email.trim().toLowerCase(), role: role.toLowerCase() }; if (companyUsers.some(u => u.email === newUser.email)) { return showAlert(`Email ${newUser.email} já está em uso.`, "warning"); } companyUsers.push(newUser); renderUserManagementSection(); showAlert(`Usuário ${newUser.name} adicionado (Simulado). Backend necessário.`, "success"); }
function openEditUserModal(userId) { const userToEdit = companyUsers.find(u => u.id === userId); if (!userToEdit) return showAlert("Usuário não encontrado.", "danger"); showAlert(`Edição do usuário ${userToEdit.name} (simulado via prompt).`, "info"); const newName = prompt(`Novo nome para ${userToEdit.name} (Enter para manter):`, userToEdit.name); const newEmail = prompt(`Novo email para ${userToEdit.email} (Enter para manter):`, userToEdit.email); const newRole = prompt(`Novo role (${['admin', 'financeiro', 'vendas', 'leitura'].join(', ')}) para ${userToEdit.role} (Enter para manter):`, userToEdit.role); let changed = false; if (newName && newName.trim() !== userToEdit.name) { userToEdit.name = newName.trim(); changed = true;} const cleanEmail = newEmail ? newEmail.trim().toLowerCase() : userToEdit.email; if (cleanEmail !== userToEdit.email) { if (companyUsers.some(u => u.id !== userId && u.email === cleanEmail)) { showAlert(`Email ${cleanEmail} já está em uso.`, "warning"); } else { userToEdit.email = cleanEmail; changed = true; } } const validRoles = ['admin', 'financeiro', 'vendas', 'leitura']; if (newRole && validRoles.includes(newRole.toLowerCase()) && newRole.toLowerCase() !== userToEdit.role) { if (userToEdit.role === 'admin' && companyUsers.filter(u => u.role === 'admin').length <= 1) { showAlert("Não é possível remover permissão do último admin.", "warning"); } else { userToEdit.role = newRole.toLowerCase(); changed = true; } } if (changed) { renderUserManagementSection(); showAlert(`Usuário ${userToEdit.name} atualizado (Simulado).`, "success"); } else { showAlert("Nenhuma alteração.", "info"); } }
async function deleteUser(userId) { const userIndex = companyUsers.findIndex(u => u.id === userId); if (userIndex === -1) return showAlert("Usuário não encontrado.", "danger"); const userToDelete = companyUsers[userIndex]; if (userToDelete.role === 'admin' && companyUsers.filter(u => u.role === 'admin').length <= 1) { return showAlert("Não pode excluir o último admin.", "warning"); } const conf = await showConfirmModal(`Excluir usuário "${escapeHtml(userToDelete.name)}" (${escapeHtml(userToDelete.email)})? Irreversível.`, "Confirmar Exclusão", "danger"); if (conf) { companyUsers.splice(userIndex, 1); renderUserManagementSection(); showAlert("Usuário excluído (Simulado).", "info"); } }
// ============================================================
// FIM GERENCIAMENTO DE USUÁRIOS
// ============================================================

// ============================================================
// === GERENCIAMENTO DE DEVEDORES E DÍVIDAS ===
// ============================================================

// --- Funções Auxiliares ---
function getDebtorById(debtorId) {
    return debtors.find(d => d.id === debtorId);
}

function getDebtorNameById(debtorId) {
    const debtor = getDebtorById(debtorId);
    return debtor ? debtor.name : `Devedor ID ${debtorId?.substring(0, 6)}...`;
}

function getDebtById(debtId) {
    return debts.find(d => d.id === debtId);
}

function calculateTotalOwedByDebtor(debtorId) {
    return debts.filter(d => d.debtorId === debtorId && d.status !== 'paid')
               .reduce((total, debt) => {
                   const remaining = (debt.amount || 0) - (debt.paidAmount || 0);
                   return total + (remaining > 0 ? remaining : 0); // Soma apenas se houver valor restante
               } , 0);
}

// Atualiza o status de UMA dívida baseado no valor pago e data de vencimento
function updateDebtStatus(debtId) {
    const debt = getDebtById(debtId);
    if (!debt) return;

    const remaining = (debt.amount || 0) - (debt.paidAmount || 0);
    const todayStr = getLocalDateString();
    const isOverdue = debt.dueDate && debt.dueDate < todayStr;

    if (remaining <= 0.005) { // Considera pago se a diferença for mínima (ex: 0.005 para R$ 0,01)
        debt.status = 'paid';
    } else if ((debt.paidAmount || 0) > 0) {
        // Se tem pagamento parcial, verifica se está atrasado
        debt.status = isOverdue ? 'overdue' : 'partially_paid'; // Prioriza 'overdue' se atrasado E parcial
    } else if (isOverdue) {
        // Se não tem pagamento e está atrasado
        debt.status = 'overdue';
    } else {
        // Se não tem pagamento e não está atrasado
        debt.status = 'pending';
    }
    // Nota: A função `saveDataToStorage` deve ser chamada após a operação que invocou `updateDebtStatus`.
}

// Verifica TODAS as dívidas pendentes/parciais e marca como 'overdue' se necessário
export function checkAllOverdueDebts() {
    let changed = false;
    const todayStr = getLocalDateString();
    debts.forEach(debt => {
         // Só verifica dívidas que não estão totalmente pagas
         if (debt.status !== 'paid') {
             const isCurrentlyOverdue = debt.dueDate && debt.dueDate < todayStr;
             if (isCurrentlyOverdue && debt.status !== 'overdue') {
                 debt.status = 'overdue'; // Marca como atrasada
                 debt.updatedAt = new Date().toISOString();
                 changed = true;
             }
             // Opcional: Reverter de 'overdue' se a data foi alterada para o futuro?
             // else if (!isCurrentlyOverdue && debt.status === 'overdue') {
             //    // Se não está mais atrasada, volta para 'pending' ou 'partially_paid'
             //    debt.status = (debt.paidAmount || 0) > 0 ? 'partially_paid' : 'pending';
             //    debt.updatedAt = new Date().toISOString();
             //    changed = true;
             // }
         }
    });
    if (changed) {
        console.log("Status de dívidas atrasadas atualizado.");
        saveDataToStorage(); // Salva se houve mudança de status por atraso
        // Re-renderiza as listas relevantes se estiverem visíveis
        if (debtorsSection?.classList.contains('active')) {
            renderDebtorsList();
        }
        // Se o modal de detalhes estiver aberto, atualiza a lista de dívidas nele
        if (debtorDetailModal?.classList.contains('active') && debtorDetailModal.dataset.debtorId) {
             renderDebtsForDebtor(debtorDetailModal.dataset.debtorId);
         }
    }
}

// --- Renderização ---
export function renderDebtorsList() {
    if (!isBusinessPlan || !debtorListContainer) return;
    if (!hasPermission('vendas')) { // Ou outra permissão apropriada
        debtorListContainer.innerHTML = '<p class="text-muted p-3 text-center col-12">Permissão necessária para ver devedores.</p>';
        return;
    }

    debtorListContainer.innerHTML = ''; // Limpa container
    const sortedDebtors = [...debtors].sort((a, b) => a.name.localeCompare(b.name));

    if (sortedDebtors.length === 0) {
        debtorListContainer.innerHTML = '<p class="text-muted text-center p-3 col-12">Nenhum devedor cadastrado.</p>';
        return;
    }

    // Cria e adiciona os cards
    const fragment = document.createDocumentFragment();
    sortedDebtors.forEach(debtor => {
        fragment.appendChild(createDebtorCardElement(debtor));
    });
    debtorListContainer.appendChild(fragment);

    // Atualizar saldos devidos após renderizar (melhor performance que calcular dentro do create)
    debtorListContainer.querySelectorAll('.debtor-card').forEach(card => {
        const debtorId = card.dataset.debtorId;
        const totalOwed = calculateTotalOwedByDebtor(debtorId);
        const owedElement = card.querySelector('.debtor-total-owed');
        if (owedElement) {
            owedElement.textContent = formatCurrency(totalOwed);
            owedElement.classList.toggle('text-danger', totalOwed > 0);
            owedElement.classList.toggle('text-success', totalOwed <= 0); // Verde se 0 ou negativo (crédito?)
        }
    });
}

function createDebtorCardElement(debtor) {
    const colDiv = document.createElement('div');
    colDiv.className = 'col-md-6 col-lg-4 mb-3 d-flex'; // Usa d-flex para garantir altura igual via h-100 no card

    const cardDiv = document.createElement('div');
    // Adiciona a classe h-100 para que o flexbox na coluna funcione
    cardDiv.className = 'card debtor-card h-100 w-100'; // Adiciona w-100 também
    cardDiv.dataset.debtorId = debtor.id;

    const totalOwed = calculateTotalOwedByDebtor(debtor.id); // Calcula aqui para a classe inicial

    // Permissões para ações
    const canEdit = hasPermission('vendas');
    const canDelete = hasPermission('admin');
    const canView = hasPermission('vendas');

    cardDiv.innerHTML = `
        <div class="card-body d-flex flex-column">
            <div class="d-flex align-items-center mb-3">
                <img src="${debtor.photoUrl || 'img/user_placeholder.png'}" alt="Foto de ${escapeHtml(debtor.name)}" class="rounded-circle me-3 shadow-sm" style="width: 60px; height: 60px; object-fit: cover; border: 2px solid var(--border-color)">
                <div style="min-width: 0;"> <!-- Para evitar que o nome longo quebre o layout -->
                    <h5 class="card-title mb-0 text-truncate" title="${escapeHtml(debtor.name)}">${escapeHtml(debtor.name)}</h5>
                    <small class="text-muted d-block text-truncate">${escapeHtml(debtor.contactInfo?.email || debtor.contactInfo?.phone || 'Sem contato')}</small>
                </div>
            </div>
            <div class="mt-auto pt-2 border-top"> <!-- mt-auto empurra para baixo -->
                <p class="mb-2 text-center">Saldo Devedor:</p>
                <p class="text-center mb-3 fs-4 fw-bold debtor-total-owed ${totalOwed > 0 ? 'text-danger' : 'text-success'}">${formatCurrency(totalOwed)}</p>
                <div class="debtor-actions btn-group btn-group-sm w-100">
                    ${canView ? `<button class="btn btn-outline-primary view-debtor-details flex-grow-1" title="Ver Detalhes e Dívidas"><i class="fas fa-eye"></i> Detalhes</button>` : ''}
                    ${canEdit ? `<button class="btn btn-outline-secondary edit-debtor" title="Editar Devedor"><i class="fas fa-pencil"></i></button>` : ''}
                    ${canDelete ? `<button class="btn btn-outline-danger delete-debtor" title="Excluir Devedor"><i class="fas fa-trash"></i></button>` : ''}
                </div>
            </div>
        </div>
    `;
    // Retorna a coluna que contém o card
    colDiv.appendChild(cardDiv);
    return colDiv;
}


function renderDebtsForDebtor(debtorId) {
    if (!debtorDebtsList) return;
    debtorDebtsList.innerHTML = '';
    // Ordena por status (atrasado > pendente/parcial > pago) e depois por data de vencimento (mais antigo primeiro)
    const debtorDebts = debts.filter(d => d.debtorId === debtorId)
                           .sort((a, b) => {
                                const statusOrder = { 'overdue': 1, 'partially_paid': 2, 'pending': 3, 'paid': 4 };
                                const statusA = statusOrder[a.status] || 9;
                                const statusB = statusOrder[b.status] || 9;
                                if (statusA !== statusB) return statusA - statusB;
                                // Se status igual, ordena por data de vencimento (mais antiga primeiro)
                                const dateA = a.dueDate || '9999-12-31';
                                const dateB = b.dueDate || '9999-12-31';
                                return dateA.localeCompare(dateB);
                            });

    if (debtorDebts.length === 0) {
        debtorDebtsList.innerHTML = '<p class="text-muted text-center p-3 list-group-item">Nenhuma dívida encontrada para este devedor.</p>';
        return;
    }

    const fragment = document.createDocumentFragment();
    debtorDebts.forEach(debt => {
        fragment.appendChild(createDebtListItemElement(debt));
    });
    debtorDebtsList.appendChild(fragment);
}

function createDebtListItemElement(debt) {
    const item = document.createElement('div');
    // Adiciona classe de status para possível estilização CSS
    item.className = `list-group-item list-group-item-action flex-column align-items-start p-2 debt-list-item status-${debt.status || 'pending'}`;
    item.dataset.debtId = debt.id;

    const remainingAmount = (debt.amount || 0) - (debt.paidAmount || 0);
    //updateDebtStatus(debt.id); // Garante que o status está atualizado antes de exibir (já chamado em checkAllOverdueDebts e recordPayment)

    let statusBadge = '';
    let statusText = '';
    switch (debt.status) {
        case 'paid': statusBadge = 'bg-success'; statusText = 'Paga'; break;
        case 'partially_paid': statusBadge = 'bg-warning text-dark'; statusText = 'Parcial'; break;
        case 'overdue': statusBadge = 'bg-danger'; statusText = 'Atrasada'; break;
        case 'pending': statusBadge = 'bg-info text-dark'; statusText = 'Pendente'; break;
        default: statusBadge = 'bg-secondary'; statusText = debt.status;
    }
    const statusHtml = `<span class="badge ${statusBadge} ms-2">${statusText}</span>`;

    const canEdit = hasPermission('vendas');
    const canDelete = hasPermission('admin');
    const canRecordPayment = hasPermission('vendas') && debt.status !== 'paid';

    item.innerHTML = `
        <div class="d-flex w-100 justify-content-between align-items-center mb-1">
            <h6 class="mb-0 text-truncate" title="${escapeHtml(debt.description)}">${escapeHtml(debt.description)}</h6>
            <small class="text-muted flex-shrink-0 ps-2">Ref: ${formatDisplayDate(debt.incurredDate || debt.createdAt.substring(0,10))}</small>
        </div>
        <div class="d-flex w-100 justify-content-between align-items-center mb-2">
            <div>
                <p class="mb-0 small">
                   Valor: <span class="monetary-value">${formatCurrency(debt.amount)}</span>
                   ${debt.status !== 'paid' ? ` | <span class="text-${remainingAmount > 0 ? 'danger' : 'success'}">Restante:</span> <strong class="text-${remainingAmount > 0 ? 'danger' : 'success'} monetary-value">${formatCurrency(remainingAmount)}</strong>` : ''}
                </p>
                <p class="mb-0 small">
                   Prazo: ${debt.dueDate ? formatDisplayDate(debt.dueDate) : 'N/D'}
                   ${debt.isRecurring ? `<i class="fas fa-sync-alt ms-2 text-primary" title="Recorrente (${debt.recurringFrequency || ''})"></i>` : ''}
                   ${statusHtml}
                </p>
            </div>
        </div>
        <div class="debt-item-actions text-end">
             ${canRecordPayment ? `<button class="btn btn-sm btn-success record-payment-btn me-1" title="Registrar Pagamento Recebido"><i class="fas fa-hand-holding-usd"></i> Receber</button>` : ''}
             ${canEdit ? `<button class="btn btn-sm btn-outline-secondary edit-debt-btn me-1" title="Editar Dívida"><i class="fas fa-pencil"></i></button>` : ''}
             ${canDelete ? `<button class="btn btn-sm btn-outline-danger delete-debt-btn" title="Excluir Dívida"><i class="fas fa-trash"></i></button>` : ''}
        </div>
        ${debt.notes ? `<p class="mb-0 mt-2 small text-muted fst-italic border-top pt-1">Nota: ${escapeHtml(debt.notes)}</p>` : ''}
    `;
    return item;
}


// --- Ações CRUD Devedor ---
function openAddDebtorModal() {
    if (!hasPermission('vendas')) return showAlert("Permissão necessária para adicionar devedores.", "warning");
    if (!debtorModal || !debtorForm) return;

    debtorForm.reset();
    debtorIdInput.value = ''; // Limpa ID oculto
    debtorModalTitle.textContent = 'Novo Devedor';
    debtorPhotoPreview.style.display = 'none';
    debtorPhotoIcon.style.display = 'block';
    removeDebtorPhotoBtn.style.display = 'none';
    debtorPhotoUrlHidden.value = '';
    debtorForm.querySelectorAll('.is-invalid').forEach(el => el.classList.remove('is-invalid'));

    openModal(debtorModal);
}

function openEditDebtorModal(debtorId) {
     if (!hasPermission('vendas')) return showAlert("Permissão necessária para editar devedores.", "warning");
     const debtor = getDebtorById(debtorId);
     if (!debtor || !debtorModal || !debtorForm) return showAlert("Devedor não encontrado ou erro no modal.", "danger");

     debtorForm.reset();
     debtorIdInput.value = debtor.id;
     debtorModalTitle.textContent = `Editar Devedor: ${escapeHtml(debtor.name)}`;
     debtorNameInput.value = debtor.name;
     debtorEmailInput.value = debtor.contactInfo?.email || '';
     debtorPhoneInput.value = debtor.contactInfo?.phone || '';

     if (debtor.photoUrl) {
         debtorPhotoPreview.src = debtor.photoUrl;
         debtorPhotoPreview.style.display = 'block';
         debtorPhotoIcon.style.display = 'none';
         removeDebtorPhotoBtn.style.display = 'inline-block';
         debtorPhotoUrlHidden.value = debtor.photoUrl;
     } else {
         debtorPhotoPreview.style.display = 'none';
         debtorPhotoPreview.src = '#';
         debtorPhotoIcon.style.display = 'block';
         removeDebtorPhotoBtn.style.display = 'none';
         debtorPhotoUrlHidden.value = '';
     }
     debtorForm.querySelectorAll('.is-invalid').forEach(el => el.classList.remove('is-invalid'));

     openModal(debtorModal);
}

async function saveDebtor(event) {
    event.preventDefault();
    if (!hasPermission('vendas')) return showAlert("Permissão necessária para salvar.", "warning");

    const id = debtorIdInput.value;
    const name = debtorNameInput.value.trim();
    const email = debtorEmailInput.value.trim();
    const phone = debtorPhoneInput.value.trim();
    const photoUrl = debtorPhotoUrlHidden.value || null; // Pega do input hidden

    if (!name) {
        debtorNameInput.classList.add('is-invalid');
        debtorNameInput.focus();
        return showAlert("O nome do devedor é obrigatório.", "warning");
    } else {
        debtorNameInput.classList.remove('is-invalid');
    }

    // Verifica duplicidade de nome apenas ao adicionar
    if (!id && debtors.some(d => d.name.toLowerCase() === name.toLowerCase())) {
         debtorNameInput.classList.add('is-invalid');
         debtorNameInput.focus();
         return showAlert("Já existe um devedor com este nome.", "warning");
    }

    const debtorData = {
        id: id || `debtor_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        name: name,
        photoUrl: photoUrl,
        contactInfo: { email: email || null, phone: phone || null },
        createdAt: id ? getDebtorById(id)?.createdAt || new Date().toISOString() : new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };

    if (id) { // Editando
        const index = debtors.findIndex(d => d.id === id);
        if (index > -1) {
            debtors[index] = debtorData;
        } else {
            return showAlert("Erro: Devedor não encontrado para atualizar.", "danger");
        }
    } else { // Adicionando
        debtors.push(debtorData);
    }

    saveDataToStorage();
    renderDebtorsList();
    closeModal(debtorModal);
    showAlert(`Devedor ${id ? 'atualizado' : 'adicionado'} com sucesso!`, "success");
}

async function deleteDebtor(debtorId) {
    if (!hasPermission('admin')) return showAlert("Permissão de Admin necessária para excluir.", "warning");
    const debtor = getDebtorById(debtorId);
    if (!debtor) return showAlert("Devedor não encontrado.", "danger");

    const associatedDebts = debts.filter(d => d.debtorId === debtorId);
    let confirmMessage = `Tem certeza que deseja excluir o devedor "${escapeHtml(debtor.name)}"?`;
    if (associatedDebts.length > 0) {
        confirmMessage += `<br><strong class="text-danger mt-2 d-block">Atenção:</strong> Este devedor possui ${associatedDebts.length} dívida(s) registrada(s). A exclusão do devedor <strong>também excluirá todas as suas dívidas associadas</strong> e o histórico de pagamentos ficará sem referência direta ao devedor.`;
    }
    confirmMessage += "<br>Esta ação é irreversível.";

    const confirmed = await showConfirmModal(confirmMessage, "Confirmar Exclusão", "danger");
    if (confirmed) {
        // 1. Excluir dívidas associadas
        const debtIdsToDelete = associatedDebts.map(d => d.id);
        debts = debts.filter(d => d.debtorId !== debtorId);

        // 2. Desvincular transações de pagamento (originatingDebtId = null)
        let transactionsModified = false;
        transactions.forEach(tx => {
            if (tx.originatingDebtId && debtIdsToDelete.includes(tx.originatingDebtId)) {
                tx.originatingDebtId = null; // Remove o link
                // Opcional: Adicionar nota na descrição da transação
                tx.description = `(Dívida Original Excluída) ${tx.description || ''}`.trim();
                tx.updatedAt = new Date().toISOString();
                transactionsModified = true;
            }
        });

        // 3. Excluir o devedor
        debtors = debtors.filter(d => d.id !== debtorId);

        saveDataToStorage(); // Salva todas as alterações (debtors, debts, transactions)
        renderDebtorsList();
        // Se o modal de detalhes estava aberto para este devedor, feche-o
        if (debtorDetailModal?.classList.contains('active') && debtorDetailModal.dataset.debtorId === debtorId) {
            closeModal(debtorDetailModal);
        }
        showAlert("Devedor e suas dívidas associadas foram excluídos.", "info");
        if (transactionsModified) {
            refreshAllUIComponents(); // Atualiza UI se transações foram alteradas
        }
    }
}

function handleDebtorPhotoUpload(event) {
     const file = event.target.files[0];
     if (file && file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const imgDataUrl = e.target.result;
             // Validação de tamanho (ex: 2MB)
             if (imgDataUrl.length > 2 * 1024 * 1024) {
                 showAlert("A imagem é muito grande (máx 2MB). Selecione outra ou remova.", "warning");
                 debtorPhotoInput.value = ''; // Limpa seleção
                 return;
             }
            debtorPhotoPreview.src = imgDataUrl;
            debtorPhotoPreview.style.display = 'block';
            debtorPhotoIcon.style.display = 'none';
            removeDebtorPhotoBtn.style.display = 'inline-block';
            debtorPhotoUrlHidden.value = imgDataUrl; // Guarda Data URL no input hidden
        }
        reader.onerror = () => {
            showAlert("Erro ao ler a imagem.", "danger");
            debtorPhotoInput.value = '';
        }
        reader.readAsDataURL(file);
     } else if (file) {
          showAlert("Por favor, selecione um arquivo de imagem válido (jpg, png, gif, etc).", "warning");
          debtorPhotoInput.value = ''; // Limpa seleção inválida
     }
}

 function removeDebtorPhoto() {
     debtorPhotoInput.value = ''; // Limpa o input file
     debtorPhotoPreview.src = '#';
     debtorPhotoPreview.style.display = 'none';
     debtorPhotoIcon.style.display = 'block';
     removeDebtorPhotoBtn.style.display = 'none';
     debtorPhotoUrlHidden.value = ''; // Limpa o valor do input hidden
 }

// --- Ações CRUD Dívida ---
 function openAddDebtModal(debtorId) {
    if (!hasPermission('vendas')) return showAlert("Permissão necessária.", "warning");
    const debtor = getDebtorById(debtorId);
    if (!debtor || !debtModal || !debtForm) return showAlert("Devedor inválido ou erro no modal.", "danger");

    debtForm.reset();
    debtIdInput.value = '';
    debtDebtorIdInput.value = debtorId; // Define o devedor associado
    debtModalTitle.textContent = `Nova Dívida para ${escapeHtml(debtor.name)}`;
    debtIncurredDateInput.value = getLocalDateString(); // Data de hoje como padrão
    debtIsRecurringCheckbox.checked = false;
    debtRecurringFrequencySelect.style.display = 'none';
    debtForm.querySelectorAll('.is-invalid').forEach(el => el.classList.remove('is-invalid'));
    updatePlaceholders(debtAmountInput); // Atualiza placeholder de moeda

    openModal(debtModal);
 }

 function openEditDebtModal(debtId) {
    if (!hasPermission('vendas')) return showAlert("Permissão necessária.", "warning");
    const debt = getDebtById(debtId);
    if (!debt || !debtModal || !debtForm) return showAlert("Dívida não encontrada ou erro no modal.", "danger");
    const debtor = getDebtorById(debt.debtorId);

    debtForm.reset();
    debtIdInput.value = debt.id;
    debtDebtorIdInput.value = debt.debtorId;
    debtModalTitle.textContent = `Editar Dívida (${escapeHtml(debt.description)})`;
    debtDescriptionInput.value = debt.description;
    debtAmountInput.value = debt.amount.toFixed(2);
    debtIncurredDateInput.value = debt.incurredDate;
    debtDueDateInput.value = debt.dueDate || '';
    debtIsRecurringCheckbox.checked = debt.isRecurring;
    debtRecurringFrequencySelect.value = debt.recurringFrequency || 'monthly';
    debtRecurringFrequencySelect.style.display = debt.isRecurring ? 'block' : 'none';
    debtNotesInput.value = debt.notes || '';
    debtForm.querySelectorAll('.is-invalid').forEach(el => el.classList.remove('is-invalid'));
    updatePlaceholders(debtAmountInput);

    openModal(debtModal);
 }

async function saveDebt(event) {
    event.preventDefault();
    if (!hasPermission('vendas')) return showAlert("Permissão necessária.", "warning");

    const id = debtIdInput.value;
    const debtorId = debtDebtorIdInput.value;
    const description = debtDescriptionInput.value.trim();
    const amountStr = String(debtAmountInput.value).replace(',', '.');
    const amount = parseFloat(amountStr) || 0;
    const incurredDate = debtIncurredDateInput.value;
    const dueDate = debtDueDateInput.value || null;
    const isRecurring = debtIsRecurringCheckbox.checked;
    const recurringFrequency = isRecurring ? debtRecurringFrequencySelect.value : null;
    const notes = debtNotesInput.value.trim() || null;

    // Validações
    let isValid = true;
    let firstInvalid = null;
    if (!debtorId) { console.error("ID do devedor está faltando no formulário!"); return showAlert("Erro interno: Devedor não associado.", "danger");}
    if (!description) { debtDescriptionInput.classList.add('is-invalid'); isValid = false; if (!firstInvalid) firstInvalid = debtDescriptionInput;} else { debtDescriptionInput.classList.remove('is-invalid'); }
    if (amount <= 0) { debtAmountInput.classList.add('is-invalid'); isValid = false; if (!firstInvalid) firstInvalid = debtAmountInput;} else { debtAmountInput.classList.remove('is-invalid'); }
    if (!incurredDate) { debtIncurredDateInput.classList.add('is-invalid'); isValid = false; if (!firstInvalid) firstInvalid = debtIncurredDateInput;} else { debtIncurredDateInput.classList.remove('is-invalid'); }
    if (!isValid) { if (firstInvalid) firstInvalid.focus(); return showAlert("Verifique os campos obrigatórios (*).", "warning"); }

    const existingDebt = id ? getDebtById(id) : null;

    const debtData = {
        id: id || `debt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        debtorId: debtorId,
        description: description,
        amount: amount,
        paidAmount: existingDebt?.paidAmount || 0, // Mantém o valor pago se editando
        incurredDate: incurredDate,
        dueDate: dueDate,
        isRecurring: isRecurring,
        recurringFrequency: recurringFrequency,
        status: existingDebt?.status || 'pending', // Mantém status se editando, senão 'pending'
        notes: notes,
        createdAt: existingDebt?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };

    // Atualiza o status ANTES de salvar, especialmente se o valor ou data mudou
    // Criamos um objeto temporário com os dados novos para passar para updateDebtStatus
    const tempDebtForStatusCheck = { ...debtData };
    updateDebtStatus(tempDebtForStatusCheck.id); // Isso vai modificar o status DENTRO do array debts se o ID existir
    // Se for uma nova dívida (sem ID ainda) ou se o status foi modificado pela função acima:
    if (!id || (existingDebt && debts.find(d => d.id === id)?.status !== existingDebt.status)) {
       // Pega o status potencialmente atualizado pela função updateDebtStatus
       debtData.status = debts.find(d => d.id === id)?.status || 'pending';
    } else if (existingDebt && debts.find(d => d.id === id)?.status === existingDebt.status) {
       // Se o status não mudou (ou é nova dívida), aplicamos o status calculado agora
       updateDebtStatus(tempDebtForStatusCheck.id); // Calcula baseado nos novos dados
       debtData.status = tempDebtForStatusCheck.status; // Aplica status calculado
    }


    if (id) { // Editando
        const index = debts.findIndex(d => d.id === id);
        if (index > -1) {
            // Se o valor total foi alterado, RECALCULA o status baseado no valor pago existente
             if (debts[index].amount !== debtData.amount) {
                 // Atualiza o status com base no NOVO valor total e o valor PAGO existente
                 const tempDebt = { ...debtData, paidAmount: debts[index].paidAmount }; // Usa o paidAmount antigo
                 updateDebtStatus(tempDebt.id); // Calcula o status com os dados atualizados
                 debtData.status = tempDebt.status; // Aplica o status recalculado
             }
             debts[index] = debtData; // Atualiza a dívida no array
        } else {
            return showAlert("Erro: Dívida não encontrada para atualizar.", "danger");
        }
    } else { // Adicionando
        debts.push(debtData);
    }

    saveDataToStorage(); // Salva
    closeModal(debtModal); // Fecha modal
    showAlert(`Dívida ${id ? 'atualizada' : 'adicionada'} com sucesso!`, "success");

    // Re-renderiza a lista de dívidas no modal de detalhes se estiver aberto para este devedor
    if (debtorDetailModal?.classList.contains('active') && debtorDetailModal.dataset.debtorId === debtorId) {
        renderDebtsForDebtor(debtorId);
        // Atualiza o total devido no cabeçalho do modal
         const totalOwed = calculateTotalOwedByDebtor(debtorId);
         if (detailTotalOwed) detailTotalOwed.textContent = formatCurrency(totalOwed);
    }
     // Atualiza o card do devedor na lista principal
     renderDebtorsList();
}


async function deleteDebt(debtId) {
     if (!hasPermission('admin')) return showAlert("Permissão de Admin necessária.", "warning");
     const debtIndex = debts.findIndex(d => d.id === debtId); // Encontra o índice
     if (debtIndex === -1) return showAlert("Dívida não encontrada.", "danger");
     const debt = debts[debtIndex]; // Pega a referência antes de excluir
     const debtor = getDebtorById(debt.debtorId);

     const associatedPayments = transactions.filter(tx => tx.originatingDebtId === debtId);

     let confirmMessage = `Tem certeza que deseja excluir a dívida "${escapeHtml(debt.description)}" (${formatCurrency(debt.amount)}) para ${escapeHtml(debtor?.name || 'Devedor Desconhecido')}?`;
     if (associatedPayments.length > 0) {
         confirmMessage += `<br><strong class="text-warning mt-2 d-block">Atenção:</strong> Existem ${associatedPayments.length} pagamento(s) registrados vinculados a esta dívida. Eles <strong>NÃO</strong> serão excluídos, mas perderão o vínculo específico com esta dívida.`;
     }
     confirmMessage += "<br>Esta ação é irreversível.";

     const confirmed = await showConfirmModal(confirmMessage, "Confirmar Exclusão", "danger");
     if (confirmed) {
        let transactionsModified = false;
        // 1. Desvincular transações associadas
        transactions.forEach(tx => {
            if (tx.originatingDebtId === debtId) {
                 tx.originatingDebtId = null; // Remove o link
                 tx.description = `(Ref. Dívida Excluída) ${tx.description || tx.item || ''}`.trim(); // Adiciona nota
                 tx.updatedAt = new Date().toISOString();
                 transactionsModified = true;
            }
        });

         // 2. Excluir a dívida
         const debtorId = debt.debtorId; // Guarda o ID do devedor antes de remover a dívida
         debts.splice(debtIndex, 1); // Remove a dívida do array

         saveDataToStorage(); // Salva TUDO (debts e transactions modificadas)
         showAlert("Dívida excluída.", "info");

         // Re-renderiza a lista de dívidas no modal de detalhes se estiver aberto
         if (debtorDetailModal?.classList.contains('active') && debtorDetailModal.dataset.debtorId === debtorId) {
            renderDebtsForDebtor(debtorId);
            const totalOwed = calculateTotalOwedByDebtor(debtorId);
            if (detailTotalOwed) detailTotalOwed.textContent = formatCurrency(totalOwed);
         }
         // Atualiza o card do devedor na lista principal
         renderDebtorsList();
         // Atualiza componentes gerais se transações foram modificadas
         if (transactionsModified) {
             refreshAllUIComponents();
         }
     }
}

// --- Detalhes e Pagamentos ---
function openDebtorDetailModal(debtorId) {
    if (!hasPermission('vendas')) return showAlert("Permissão necessária.", "warning");
    const debtor = getDebtorById(debtorId);
    if (!debtor || !debtorDetailModal) return showAlert("Devedor não encontrado ou erro no modal.", "danger");

    debtorDetailModal.dataset.debtorId = debtorId; // Guarda o ID no modal para referência

    // Preenche Infos do Devedor
    detailDebtorPhoto.src = debtor.photoUrl || 'img/user_placeholder.png';
    detailDebtorName.textContent = debtor.name;
    detailDebtorEmail.textContent = debtor.contactInfo?.email || '-';
    detailDebtorPhone.textContent = debtor.contactInfo?.phone || '-';

    // Calcula e exibe Total Devido
    const totalOwed = calculateTotalOwedByDebtor(debtorId);
    detailTotalOwed.textContent = formatCurrency(totalOwed);
    detailTotalOwed.classList.toggle('text-danger', totalOwed > 0);
    detailTotalOwed.classList.toggle('text-success', totalOwed <= 0);

    // Guarda o debtorId nos botões dentro do modal
    addDebtForDebtorBtn.dataset.debtorId = debtorId;
    viewDebtorPaymentHistoryBtn.dataset.debtorId = debtorId;

    // Renderiza a lista de dívidas
    renderDebtsForDebtor(debtorId);

    openModal(debtorDetailModal);
}

function openRecordPaymentModal(debtId) {
    if (!hasPermission('vendas')) return showAlert("Permissão necessária.", "warning");
    const debt = getDebtById(debtId);
    if (!debt || !recordDebtPaymentModal || !recordDebtPaymentForm) return showAlert("Dívida não encontrada ou erro no modal.", "danger");

    if (debt.status === 'paid') return showAlert("Esta dívida já está totalmente paga.", "info");

    const remainingAmount = (debt.amount || 0) - (debt.paidAmount || 0);

    recordDebtPaymentForm.reset();
    paymentDebtIdInput.value = debtId;
    paymentDebtDescription.textContent = escapeHtml(debt.description);
    paymentDebtRemaining.textContent = formatCurrency(remainingAmount);
    // Sugere pagar o restante, mas permite menos
    paymentAmountReceivedInput.value = remainingAmount > 0 ? remainingAmount.toFixed(2) : '0.01';
    paymentAmountReceivedInput.max = remainingAmount > 0 ? remainingAmount.toFixed(2) : '0.01'; // Máximo é o restante
    paymentAmountReceivedInput.min = '0.01'; // Mínimo é 1 centavo
    paymentDateReceivedInput.value = getLocalDateString(); // Data de hoje
    paymentMethodReceivedSelect.value = ''; // Limpa seleção
    recordDebtPaymentForm.querySelectorAll('.is-invalid').forEach(el => el.classList.remove('is-invalid'));
    updatePlaceholders(paymentAmountReceivedInput);

    openModal(recordDebtPaymentModal);
}

async function recordDebtPayment(event) {
    event.preventDefault();
    if (!hasPermission('vendas')) return showAlert("Permissão necessária.", "warning");

    const debtId = paymentDebtIdInput.value;
    const amountReceivedStr = String(paymentAmountReceivedInput.value).replace(',', '.');
    const amountReceived = parseFloat(amountReceivedStr) || 0;
    const dateReceived = paymentDateReceivedInput.value;
    const methodReceived = paymentMethodReceivedSelect.value;
    const notes = paymentNotesInput.value.trim() || null;

    const debt = getDebtById(debtId);
    if (!debt) return showAlert("Erro: Dívida não encontrada.", "danger");
    const debtor = getDebtorById(debt.debtorId);

    // Validações
    let isValid = true;
    let firstInvalid = null;
    const remainingAmount = (debt.amount || 0) - (debt.paidAmount || 0);
    if (amountReceived <= 0) { paymentAmountReceivedInput.classList.add('is-invalid'); isValid = false; if (!firstInvalid) firstInvalid = paymentAmountReceivedInput; }
    // Adiciona pequena tolerância (e.g., 0.005 para R$ 0,01) para evitar erros de arredondamento
    else if (amountReceived > remainingAmount + 0.005) {
         paymentAmountReceivedInput.classList.add('is-invalid');
         isValid = false;
         if (!firstInvalid) firstInvalid = paymentAmountReceivedInput;
         showAlert(`Valor recebido (${formatCurrency(amountReceived)}) não pode ser maior que o restante devido (${formatCurrency(remainingAmount)}).`, "warning");
    } else { paymentAmountReceivedInput.classList.remove('is-invalid'); }
    if (!dateReceived) { paymentDateReceivedInput.classList.add('is-invalid'); isValid = false; if (!firstInvalid) firstInvalid = paymentDateReceivedInput; } else { paymentDateReceivedInput.classList.remove('is-invalid'); }
    if (!methodReceived) { paymentMethodReceivedSelect.classList.add('is-invalid'); isValid = false; if (!firstInvalid) firstInvalid = paymentMethodReceivedSelect; } else { paymentMethodReceivedSelect.classList.remove('is-invalid'); }
    if (!isValid) { if (firstInvalid) firstInvalid.focus(); return showAlert("Verifique os campos obrigatórios (*).", "warning"); }


    // 1. Atualizar a Dívida
    debt.paidAmount = (debt.paidAmount || 0) + amountReceived;
    debt.updatedAt = new Date().toISOString();
    updateDebtStatus(debt.id); // Recalcula e atualiza o status da dívida

    // 2. Criar a Transação de Receita
    const transactionDescription = `Recebimento Dívida: ${debt.description.substring(0, 30)}${debt.description.length > 30 ? '...' : ''} (${debtor?.name || 'N/D'})`;
    const transactionDetails = `Pagamento ref. dívida ID ${debt.id}. ${notes ? ` Obs: ${notes}` : ''}`.trim();

    const newIncomeTx = {
        id: `tx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        date: dateReceived,
        item: transactionDescription,
        amount: amountReceived,
        type: 'income', // É sempre receita ao receber de devedor
        category: 'Recebimentos Diversos', // Categoria Padrão
        paymentMethod: methodReceived, // Método que o dinheiro ENTROU na sua conta
        description: transactionDetails,
        isScheduled: false,
        originatingBillId: null,
        isRecurring: false,
        originatingRecurringId: null,
        tags: ['recebimento-divida', 'auto'], // Tags úteis
        projectId: null, // Por enquanto, não vinculamos dívidas a projetos
        clientId: null, // Não é um cliente formal necessariamente
        employeeId: null,
        originatingDebtId: debt.id, // <<< VINCULA À DÍVIDA
        deductible: false,
        attachmentDataUrl: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

    transactions.push(newIncomeTx);

    // 3. Salvar e Atualizar UI
    saveDataToStorage(); // Salva debts e transactions
    closeModal(recordDebtPaymentModal);
    showAlert(`Pagamento de ${formatCurrency(amountReceived)} registrado com sucesso! Transação de receita criada.`, "success");

    // Re-renderiza a lista de dívidas no modal de detalhes se estiver aberto
     if (debtorDetailModal?.classList.contains('active') && debtorDetailModal.dataset.debtorId === debt.debtorId) {
         renderDebtsForDebtor(debt.debtorId);
         const totalOwed = calculateTotalOwedByDebtor(debt.debtorId);
         if (detailTotalOwed) {
             detailTotalOwed.textContent = formatCurrency(totalOwed);
             detailTotalOwed.classList.toggle('text-danger', totalOwed > 0);
             detailTotalOwed.classList.toggle('text-success', totalOwed <= 0);
         }
     }
     // Atualiza o card do devedor na lista principal
     renderDebtorsList();
     // Atualiza componentes gerais (saldo, gráficos, lista de transações)
     refreshAllUIComponents();
}


function openDebtorPaymentHistoryModal(debtorId) {
     if (!hasPermission('vendas')) return showAlert("Permissão necessária.", "warning");
     const debtor = getDebtorById(debtorId);
     if (!debtor || !debtorPaymentHistoryModal) return showAlert("Devedor não encontrado ou erro no modal.", "danger");

     historyDebtorName.textContent = escapeHtml(debtor.name);
     debtorPaymentHistoryList.innerHTML = '<p class="text-center p-3"><i class="fas fa-spinner fa-spin"></i> Carregando histórico...</p>';

     // Achar IDs das dívidas DESTE devedor
     const debtorDebtIds = debts.filter(d => d.debtorId === debtorId).map(d => d.id);

     // Filtrar transações de receita vinculadas a ESSAS dívidas
     const paymentTransactions = transactions
         .filter(tx => tx.type === 'income' && tx.originatingDebtId && debtorDebtIds.includes(tx.originatingDebtId))
         .sort((a, b) => b.date.localeCompare(a.date)); // Mais recentes primeiro

     if (paymentTransactions.length === 0) {
          debtorPaymentHistoryList.innerHTML = '<p class="text-muted text-center p-3">Nenhum pagamento registrado para este devedor.</p>';
     } else {
          debtorPaymentHistoryList.innerHTML = ''; // Limpa o spinner/mensagem
          const fragment = document.createDocumentFragment();
          paymentTransactions.forEach(tx => {
              const debtOrigin = getDebtById(tx.originatingDebtId); // Tenta pegar a dívida original
              const listItem = document.createElement('div');
              listItem.className = 'list-group-item payment-history-item'; // Classe para estilização
              listItem.innerHTML = `
                  <div class="d-flex w-100 justify-content-between">
                      <h6 class="mb-1 text-success">Recebido: ${formatCurrency(tx.amount)}</h6>
                      <small>${formatDisplayDate(tx.date)}</small>
                  </div>
                  <p class="mb-1 small text-muted">
                     <i class="fas fa-receipt fa-fw"></i> Ref: ${escapeHtml(debtOrigin?.description || tx.item || 'Dívida não encontrada')}
                  </p>
                  <small>
                     <i class="fas fa-exchange-alt fa-fw"></i> Método: ${tx.paymentMethod || 'N/D'} | <i class="fas fa-hashtag fa-fw"></i> Transação: ${tx.id.substring(0,8)}...
                  </small>
                  ${tx.description && !tx.description.startsWith('(Ref. Dívida Excluída)') ? `<p class="mb-0 mt-1 fst-italic small border-top pt-1"><i class="far fa-comment-dots fa-fw"></i> ${escapeHtml(tx.description)}</p>` : ''}
              `;
              fragment.appendChild(listItem);
          });
          debtorPaymentHistoryList.appendChild(fragment);
     }

     openModal(debtorPaymentHistoryModal);
}

// ============================================================
// === FIM GERENCIAMENTO DE DEVEDORES E DÍVIDAS ===
// ============================================================


// ============================================================
// ATUALIZAÇÃO DA UI BASEADA EM PERMISSÕES (permanece igual)
// ============================================================
function updateUIAccessBasedOnRole() { if (!currentUser) return; console.log(`Atualizando UI para o papel: ${currentUser.role}`); const userRole = currentUser.role; document.querySelectorAll('.sidebar .menu-item[data-section]').forEach(item => { const sectionId = item.dataset.section; const requiredPermission = item.dataset.permission; if (requiredPermission) { const hasAccess = hasPermission(requiredPermission); item.style.display = hasAccess ? '' : 'none'; } else { item.style.display = ''; } }); document.querySelectorAll('[data-action-permission]').forEach(element => { const requiredPermission = element.dataset.actionPermission; if (requiredPermission) { const canPerform = hasPermission(requiredPermission); const isInput = ['BUTTON', 'INPUT', 'SELECT', 'TEXTAREA'].includes(element.tagName); if (isInput) { element.disabled = !canPerform; if (!element.dataset.originalTitle && element.title) { element.dataset.originalTitle = element.title; } element.title = canPerform ? (element.dataset.originalTitle || '') : `Permissão (${requiredPermission}) necessária.`; element.classList.toggle('action-disabled-permission', !canPerform); } else { element.style.display = canPerform ? '' : 'none'; element.classList.toggle('action-disabled-permission', !canPerform); } } }); document.querySelectorAll('.pro-feature').forEach(el => { const requiredPermission = el.dataset.permission || el.dataset.actionPermission || 'leitura'; el.style.display = (isProPlan || isBusinessPlan) && hasPermission(requiredPermission) ? '' : 'none'; }); document.querySelectorAll('.business-feature').forEach(el => { const requiredPermission = el.dataset.permission || el.dataset.actionPermission || 'vendas'; el.style.display = isBusinessPlan && hasPermission(requiredPermission) ? '' : 'none'; }); const businessFields = document.querySelectorAll('.business-field'); businessFields.forEach(field => { const visible = isBusinessPlan && hasPermission('vendas'); field.style.display = visible ? '' : 'none'; field.querySelectorAll('input, select, textarea, button').forEach(input => { input.disabled = !visible; }); }); const deductibleField = document.getElementById('modalDeductible')?.closest('.form-check'); const editDeductibleField = document.getElementById('editDeductible')?.closest('.form-check'); if(deductibleField) deductibleField.style.display = isBusinessPlan && hasPermission('financeiro') ? '' : 'none'; if(editDeductibleField) editDeductibleField.style.display = isBusinessPlan && hasPermission('financeiro') ? '' : 'none'; const userNameDisplay = document.querySelector('.sidebar .user-name'); const userEmailDisplay = document.querySelector('.sidebar .user-email'); if (userNameDisplay) userNameDisplay.textContent = currentUser.name; if (userEmailDisplay) userEmailDisplay.textContent = currentUser.email; console.log("Atualização da UI baseada em permissões concluída."); }
function renderSettingsBasedOnRole() { console.log("Renderizando Configurações com base no role:", currentUser?.role); renderUserManagementSection(); renderClients(); renderProjects(); renderEmployees(); const saveUserSettingsBtn = document.getElementById('saveUserSettings'); if (saveUserSettingsBtn) saveUserSettingsBtn.disabled = !hasPermission('admin'); const exportBtn = document.getElementById('exportDataBtn'); const importBtn = document.getElementById('importDataBtn'); const importCsvBtn = document.getElementById('importCsvBtn'); if(exportBtn) exportBtn.disabled = !hasPermission('admin'); if(importBtn) importBtn.disabled = !hasPermission('admin'); if(importCsvBtn) importCsvBtn.disabled = !hasPermission('admin'); const companySettingsBlock = document.getElementById('companySettingsBlock'); if(companySettingsBlock) { const canEditCompany = hasPermission('admin'); companySettingsBlock.querySelectorAll('input, textarea').forEach(inp => inp.disabled = !canEditCompany); const saveCompanyBtn = document.getElementById('saveCompanySettingsBtn'); if (saveCompanyBtn) saveCompanyBtn.disabled = !canEditCompany; companySettingsBlock.style.display = hasPermission('leitura') ? '' : 'none'; } }

// --- Inicialização e Event Listeners do Business ---
export function initBusinessFeatures() {
   if (!isBusinessPlan) { console.log("Plano não é Business. Funcionalidades Business desativadas."); document.querySelectorAll('.business-feature').forEach(el => el.style.display = 'none'); return; }
   console.log("Inicializando funcionalidades Business...");
   loadBusinessData(); // Carrega clientes, projetos, funcionários, invoices, DEVEDORES, DÍVIDAS
   setupBusinessEventListeners();
   populateRecipientSelects(); // Popula todos os selects relevantes
   renderInvoices();         // Renderiza faturas/pagamentos
   renderDebtorsList();      // <<< RENDERIZA LISTA DE DEVEDORES >>>
   // checkAllOverdueDebts() é chamado pelo init do app-base.js após tudo estar carregado
   body.classList.add('business-plan-active');
   updateUIAccessBasedOnRole(); // Aplica permissões visuais
   if (settingsSection?.classList.contains('active')) {
       renderSettingsBasedOnRole(); // Renderiza Clientes/Projetos/Funcionários nas Configs se a seção estiver ativa
   }
   setupUserSwitcherForTesting(); // Simulação
   console.log("Funcionalidades Business (incl. Devedores) inicializadas.");
}

function setupBusinessEventListeners() {
    if (!isBusinessPlan) return;
    console.log("Configurando Listeners Business (incl. Devedores)...");

    // Faturamento/Pagamentos
    if (addInvoiceBtn) { addInvoiceBtn.addEventListener('click', openAddInvoiceModal); }
    if (invoiceForm) { invoiceForm.addEventListener('submit', saveInvoice); }
    if (addInvoiceItemBtn) { addInvoiceItemBtn.addEventListener('click', () => addInvoiceItemRow()); }
    if (invoiceListContainer) {
        invoiceListContainer.addEventListener('click', (e) => {
            const item = e.target.closest('.invoice-item');
            if (!item?.dataset?.id) return;
            const invoiceId = item.dataset.id; // Usa o ID

            if (e.target.closest('.view-invoice')) { e.stopPropagation(); openInvoiceViewModal(invoiceId); }
            else if (e.target.closest('.edit-invoice')) { e.stopPropagation(); openEditInvoiceModal(invoiceId); } // Passa ID
            else if (e.target.closest('.delete-invoice')) { e.stopPropagation(); deleteInvoice(invoiceId); } // Passa ID
            else if (e.target.closest('.mark-paid-invoice')) { e.stopPropagation(); markInvoicePaid(invoiceId); } // Passa ID
            else if (e.target.closest('.mark-sent-invoice')) { e.stopPropagation(); markInvoiceSent(invoiceId); } // Passa ID
        });
    }

    // Listener para tipo de destinatário no Modal de Fatura
    if(recipientTypeRadios.length > 0) {
        recipientTypeRadios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                const selectedType = e.target.value;
                const isClient = selectedType === 'client';
                if(clientSelectGroup) clientSelectGroup.style.display = isClient ? 'block' : 'none';
                if(employeeSelectGroup) employeeSelectGroup.style.display = !isClient ? 'block' : 'none';
                if(invoiceClientSelect) invoiceClientSelect.required = isClient;
                if(invoiceEmployeeSelect) invoiceEmployeeSelect.required = !isClient;
                // Limpa o select não visível ao trocar
                if(isClient && invoiceEmployeeSelect) invoiceEmployeeSelect.value = '';
                if(!isClient && invoiceClientSelect) invoiceClientSelect.value = '';
                 if(invoiceForm) invoiceForm.dataset.recipientType = selectedType;
            });
        });
    }

     // Clientes e Projetos (Configurações)
     if (addClientBtn) { addClientBtn.addEventListener('click', () => { if (!hasPermission('vendas')) return showAlert("Permissão de 'Vendas' necessária.", "warning"); addClient(); }); }
     if (addProjectBtn) { addProjectBtn.addEventListener('click', () => { if (!hasPermission('vendas')) return showAlert("Permissão de 'Vendas' necessária.", "warning"); addProject(); }); }
     if (clientListContainer) { clientListContainer.addEventListener('click', (e) => { const deleteBtn = e.target.closest('.delete-client'); if (deleteBtn) { if (!hasPermission('admin')) return showAlert("Apenas Administradores podem excluir clientes.", "warning"); deleteClient(deleteBtn.dataset.id); } }); }
     if (projectListContainer) { projectListContainer.addEventListener('click', (e) => { const deleteBtn = e.target.closest('.delete-project'); if (deleteBtn) { if (!hasPermission('admin')) return showAlert("Apenas Administradores podem excluir projetos.", "warning"); deleteProject(deleteBtn.dataset.id); } }); }

     // <<< NOVO: Listeners para Funcionários (Configurações) >>>
     if (addEmployeeBtn) { addEmployeeBtn.addEventListener('click', () => { if (!hasPermission('admin')) return showAlert("Permissão de 'Admin' necessária.", "warning"); addEmployee(); }); }
     if (employeeListContainer) { employeeListContainer.addEventListener('click', (e) => { const deleteBtn = e.target.closest('.delete-employee'); if (deleteBtn) { if (!hasPermission('admin')) return showAlert("Apenas Administradores podem excluir funcionários.", "warning"); deleteEmployee(deleteBtn.dataset.id); } }); }
     // <<< FIM Listeners Funcionários >>>

     // --- Listeners para Devedores e Dívidas ---
     if (addDebtorBtn) {
         addDebtorBtn.addEventListener('click', openAddDebtorModal);
     }
     if (debtorForm) {
         debtorForm.addEventListener('submit', saveDebtor);
     }
     if (debtorPhotoUpload) { // Trigger para input file da foto do devedor
         debtorPhotoUpload.addEventListener('click', () => debtorPhotoInput?.click());
     }
     if (debtorPhotoInput) { // Listener para quando um arquivo de foto é selecionado
         debtorPhotoInput.addEventListener('change', handleDebtorPhotoUpload);
     }
      if (removeDebtorPhotoBtn) { // Listener para o botão de remover foto
          removeDebtorPhotoBtn.addEventListener('click', removeDebtorPhoto);
      }

     if (debtorListContainer) { // Ações nos cards da lista de devedores
         debtorListContainer.addEventListener('click', (e) => {
             const card = e.target.closest('.debtor-card');
             if (!card) return;
             const debtorId = card.dataset.debtorId;

             if (e.target.closest('.view-debtor-details')) {
                 openDebtorDetailModal(debtorId);
             } else if (e.target.closest('.edit-debtor')) {
                 openEditDebtorModal(debtorId);
             } else if (e.target.closest('.delete-debtor')) {
                 deleteDebtor(debtorId);
             }
         });
     }

     if (debtorDetailModal) { // Ações dentro do modal de detalhes do devedor
          // Botão Nova Dívida
          addDebtForDebtorBtn?.addEventListener('click', (e) => {
              const debtorId = e.currentTarget.dataset.debtorId; // Pega do botão
              if(debtorId) openAddDebtModal(debtorId);
              else console.error("ID do devedor não encontrado no botão 'Nova Dívida'");
          });
          // Botão Histórico
          viewDebtorPaymentHistoryBtn?.addEventListener('click', (e) => {
             const debtorId = e.currentTarget.dataset.debtorId; // Pega do botão
             if(debtorId) openDebtorPaymentHistoryModal(debtorId);
              else console.error("ID do devedor não encontrado no botão 'Histórico'");
          });

          // Ações na lista de dívidas DENTRO do modal de detalhes
          debtorDebtsList?.addEventListener('click', (e) => {
              const debtItem = e.target.closest('.debt-list-item');
              if (!debtItem) return;
              const debtId = debtItem.dataset.debtId;

              if (e.target.closest('.record-payment-btn')) {
                  openRecordPaymentModal(debtId);
              } else if (e.target.closest('.edit-debt-btn')) {
                  openEditDebtModal(debtId);
              } else if (e.target.closest('.delete-debt-btn')) {
                  deleteDebt(debtId);
              }
          });
     }

     if (debtForm) { // Formulário de adicionar/editar dívida
         debtForm.addEventListener('submit', saveDebt);
          // Toggle para mostrar/ocultar frequência recorrente
          debtIsRecurringCheckbox?.addEventListener('change', (e) => {
             if (debtRecurringFrequencySelect) {
                  debtRecurringFrequencySelect.style.display = e.target.checked ? 'block' : 'none';
             }
          });
     }

      if (recordDebtPaymentForm) { // Formulário de registrar pagamento de dívida
          recordDebtPaymentForm.addEventListener('submit', recordDebtPayment);
      }
      // --- FIM Listeners Devedores/Dívidas ---


     // Relatório Fiscal
     if(generateTaxReportBtn) { generateTaxReportBtn.addEventListener('click', () => { if (!hasPermission('financeiro')) return showAlert("Apenas usuários Financeiros ou Admins podem gerar este relatório.", "warning"); generateTaxReport(); }); }

     // Gerenciamento de Usuários (Simulado)
     if (addUserBtn) { addUserBtn.addEventListener('click', () => { if (!hasPermission('admin')) return showAlert("Apenas Administradores podem adicionar usuários.", "warning"); openAddUserModal(); }); }
     if (userListContainer) { userListContainer.addEventListener('click', (e) => { const editButton = e.target.closest('.edit-user'); const deleteButton = e.target.closest('.delete-user'); if (editButton) { if (!hasPermission('admin')) return showAlert("Apenas Administradores podem editar usuários.", "warning"); const userId = editButton.dataset.id; openEditUserModal(userId); } else if (deleteButton) { if (!hasPermission('admin')) return showAlert("Apenas Administradores podem excluir usuários.", "warning"); const userId = deleteButton.dataset.id; if (userId === currentUser.id) return showAlert("Você não pode excluir sua própria conta.", "warning"); deleteUser(userId); } }); }

    console.log("Listeners Business (incl. Devedores) Configurados.");
}

// --- Exportações ---
// Exporta funções que o app-base precisa chamar
export {
   renderSettingsBasedOnRole, // Usado pelo Base após import
        // getClientNameById, // Já exportado pelo Base
   // getProjectNameById, // Já exportado pelo Base
   // getEmployeeNameById // Já exportado pelo Base (se presente)
};