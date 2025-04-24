//=============================================================================
// Gestor Financeiro - app-pro.js - v1.9.18+ - Funcionalidades Pro (Editor Cat. v7 - Completo)
// - Editor de Categorias Avançado com edição/movimentação/exclusão/ocultação (Defaults+Custom).
// - Títulos expansíveis/recolhíveis. Botão Restaurar Padrão.
// - Dispara evento 'categoriesUpdated' ao salvar categorias.
// - Usa categoryStructure como fonte única.
// - Mantém funcionalidades de Anexo, Recorrência, CSV, Relatórios.
// - Depende de app-base.js, PapaParse, SortableJS.
//=============================================================================

// --- Importações do Módulo Base ---
import {
    transactions, recurringTransactions, categoryBudgets,
    assets, liabilities, currency, valuesHidden, isProPlan,
    showAlert, showConfirmModal, formatCurrency, getLocalDateString,
    formatDisplayDate, parseDateInput, calculateNextDueDate, saveDataToStorage,
    refreshAllUIComponents,
    updateCategoryDropdowns, // Importado para uso em promptForNewCategory
    escapeHtml, closeModal,
    openModal, parseTags, formatTags, updateCharts, updatePlaceholders,
    getMonthName, reportsSection, reportStartDateInput, reportEndDateInput,
    modalCategoryInput, editCategoryInput, settingsSection, transactionModal,
    editModal, defaultCategories, // defaultCategories usado para restaurar/verificar
    categoryIconMapping,
    categoryStructure // <<< IMPORTADO: Nova estrutura principal
} from './app-base.js';

// --- Constantes Específicas do Pro ---
const RECURRING_CHECK_INTERVAL = 5 * 60 * 1000;
const MAX_ATTACHMENT_SIZE_MB = 1;
const MAX_ATTACHMENT_SIZE_BYTES = MAX_ATTACHMENT_SIZE_MB * 1024 * 1024;

// --- Seletores DOM Específicos do Pro ---
const applyReportFilterBtn = document.getElementById('applyReportFilterBtn');
const exportReportCsvBtn = document.getElementById('exportReportCsvBtn');
const exportTransactionsCsvBtn = document.getElementById('exportTransactionsCsvBtn');
const cashFlowReportContainer = document.getElementById('cashFlowReportContainer');
const recurringListContainer = document.getElementById('recurringListContainer');
const addRecurringBtn = document.getElementById('addRecurringBtn');
const recurringTxModal = document.getElementById('recurringTxModal');
const recurringTxForm = document.getElementById('recurringTxForm');
const importCsvBtn = document.getElementById('importCsvBtn');
const importCsvInput = document.getElementById('importCsvInput');
const csvImportModal = document.getElementById('csvImportModal');
const csvPreviewTable = document.getElementById('csvPreviewTable');
const csvMappingArea = document.getElementById('csvMappingArea');
const confirmCsvImportBtn = document.getElementById('confirmCsvImportBtn');
const recurringCategorySelect = recurringTxModal?.querySelector('#recurringCategory');
const recurringTypeSelect = recurringTxModal?.querySelector('#recurringType');

// Seletores para Anexos
const modalAttachmentInput = document.getElementById('modalAttachmentInput');
const modalAttachmentTrigger = document.getElementById('modalAttachmentTrigger');
const modalAttachmentPreview = document.getElementById('modalAttachmentPreview');
const modalRemoveAttachmentBtn = document.getElementById('modalRemoveAttachmentBtn');
const modalAttachmentFilename = document.getElementById('modalAttachmentFilename');
const editAttachmentInput = document.getElementById('editAttachmentInput');
const editAttachmentTrigger = document.getElementById('editAttachmentTrigger');
const editAttachmentPreview = document.getElementById('editAttachmentPreview');
const editRemoveAttachmentBtn = document.getElementById('editRemoveAttachmentBtn');
const editAttachmentFilename = document.getElementById('editAttachmentFilename');

// Seletores para Editor de Categorias
const openCategoryEditorBtn = document.getElementById('openCategoryEditorBtn');
const categoryEditorModal = document.getElementById('categoryEditorModal');
const categoryEditorList = document.getElementById('categoryEditorList');
const categoryEditorFilters = categoryEditorModal?.querySelector('.category-editor-filters');
const saveCategoryEditorChangesBtn = document.getElementById('saveCategoryEditorChangesBtn');
const newCategoryNameEditor = document.getElementById('newCategoryNameEditor');
const newCategoryTypeEditor = document.getElementById('newCategoryTypeEditor');
const addCustomCategoryEditorBtn = document.getElementById('addCustomCategoryEditorBtn');
const newCategoryTitleEditor = document.getElementById('newCategoryTitleEditor');
const newCategoryTitleTypeEditor = document.getElementById('newCategoryTitleTypeEditor');
const addCustomTitleEditorBtn = document.getElementById('addCustomTitleEditorBtn');
const restoreDefaultCategoriesBtn = document.getElementById('restoreDefaultCategoriesBtn');


// --- Estado Específico do Pro ---
let csvImportData = { raw: [], mapped: [], headers: [], map: {} };
let currentEditingRecurringId = null;
let recurringCheckIntervalId = null;
let categoryEditorFilter = 'all';
let categorySortableInstance = null;
let categoryChangesMade = false;

// --- Funções de Anexo de Comprovante ---
function handleAttachmentSelection(event, previewElement, removeBtn, filenameElement, triggerElement, hiddenInputElementId) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { showAlert('Selecione um arquivo de imagem.', 'warning'); event.target.value = ''; return; }
    if (file.size > MAX_ATTACHMENT_SIZE_BYTES) { showAlert(`Arquivo muito grande (Max: ${MAX_ATTACHMENT_SIZE_MB}MB).`, 'warning'); event.target.value = ''; return; }
    const reader = new FileReader();
    const hiddenInput = document.getElementById(hiddenInputElementId);
    reader.onloadend = () => {
        const base64String = reader.result;
        if (previewElement instanceof HTMLImageElement) { previewElement.src = base64String; previewElement.style.display = 'block'; }
        if (filenameElement) { filenameElement.textContent = file.name; filenameElement.style.display = 'inline'; }
        if (removeBtn) removeBtn.style.display = 'inline-block';
        if (triggerElement) triggerElement.style.display = 'none';
        if (hiddenInput) hiddenInput.value = base64String;
        showAlert('Comprovante pronto.', 'info', 2000);
    };
    reader.onerror = (err) => { console.error("Erro ao ler arquivo:", err); showAlert('Erro ao processar arquivo.', 'danger'); if (hiddenInput) hiddenInput.value = ''; event.target.value = ''; };
    reader.readAsDataURL(file);
}
function handleRemoveAttachment(inputElement, previewElement, removeBtn, filenameElement, triggerElement, hiddenInputElementId) {
    if (inputElement) inputElement.value = '';
    if (previewElement) { previewElement.src = '#'; previewElement.style.display = 'none'; }
    if (filenameElement) { filenameElement.textContent = ''; filenameElement.style.display = 'none'; }
    if (removeBtn) removeBtn.style.display = 'none';
    if (triggerElement) triggerElement.style.display = 'inline-block';
    const hiddenInput = document.getElementById(hiddenInputElementId);
    if (hiddenInput) hiddenInput.value = '';
}
export function setupEditAttachmentUI(transaction) {
    if (!isProPlan || !editAttachmentInput) return;
    const attachmentDataUrl = transaction.attachmentDataUrl;
    const hiddenInput = document.getElementById('editAttachmentDataUrlHidden');
    if(hiddenInput) hiddenInput.value = attachmentDataUrl || '';
    if (attachmentDataUrl) {
        if (editAttachmentPreview) { editAttachmentPreview.src = attachmentDataUrl; editAttachmentPreview.style.display = 'block'; }
        if(editAttachmentFilename) { const nameMatch = attachmentDataUrl.match(/name=([^;]+);/); editAttachmentFilename.textContent = nameMatch?.[1] || `comprovante_${transaction.id.toString().slice(-4)}.png`; editAttachmentFilename.style.display = 'inline'; }
        if (editRemoveAttachmentBtn) editRemoveAttachmentBtn.style.display = 'inline-block';
        if (editAttachmentTrigger) editAttachmentTrigger.style.display = 'none';
    } else {
        handleRemoveAttachment( editAttachmentInput, editAttachmentPreview, editRemoveAttachmentBtn, editAttachmentFilename, editAttachmentTrigger, 'editAttachmentDataUrlHidden' );
    }
}
export function clearTemporaryAttachments() {
    handleRemoveAttachment( modalAttachmentInput, modalAttachmentPreview, modalRemoveAttachmentBtn, modalAttachmentFilename, modalAttachmentTrigger, 'modalAttachmentDataUrlHidden' );
    handleRemoveAttachment( editAttachmentInput, editAttachmentPreview, editRemoveAttachmentBtn, editAttachmentFilename, editAttachmentTrigger, 'editAttachmentDataUrlHidden' );
    console.log("Pro: Anexos (UI e hidden inputs) limpos via clearTemporaryAttachments.");
}

// --- Funções de Transações Recorrentes ---
async function saveRecurringTransaction(event) { event.preventDefault(); if (!isProPlan || !recurringTxForm) return; const name = recurringTxForm.querySelector('#recurringName')?.value.trim(); const amountStr = recurringTxForm.querySelector('#recurringAmount')?.value; const type = recurringTxForm.querySelector('#recurringType')?.value; let category = recurringCategorySelect?.value; const paymentMethod = recurringTxForm.querySelector('#recurringPaymentMethod')?.value; const frequency = recurringTxForm.querySelector('#recurringFrequency')?.value; const startDate = recurringTxForm.querySelector('#recurringStartDate')?.value; const tagsInput = recurringTxForm.querySelector('#recurringTagsInput'); const tags = tagsInput ? parseTags(tagsInput.value) : []; if (category === '--add-new--') { const newCategoryName = await promptForNewCategory(type); if (newCategoryName) { category = newCategoryName; if(recurringCategorySelect) { updateCategoryDropdowns(recurringCategorySelect, type, true); setTimeout(() => { if(recurringCategorySelect) recurringCategorySelect.value = newCategoryName; }, 0); } } else { if(recurringCategorySelect) recurringCategorySelect.value = ''; return showAlert('Criação de categoria cancelada.', 'info'); } } const amount = parseFloat(String(amountStr).replace(',', '.')) || 0; if (!name || isNaN(amount) || amount <= 0 || !type || !category || category.startsWith('--') || !paymentMethod || !frequency || !startDate) { return showAlert('Preencha obrigatórios (*).', 'warning'); } const isEditing = currentEditingRecurringId !== null; let nextDueDate = null; let lastCreated = null; const existingRec = isEditing ? recurringTransactions.find(r => r.id === currentEditingRecurringId) : null; if (isEditing && existingRec) { lastCreated = existingRec.lastCreatedDate; if (existingRec.startDate !== startDate || existingRec.frequency !== frequency) { const baseDateForNext = lastCreated || startDate; nextDueDate = calculateNextDueDate(baseDateForNext, frequency); while (nextDueDate && nextDueDate <= getLocalDateString()) { nextDueDate = calculateNextDueDate(nextDueDate, frequency); } if (!nextDueDate && startDate) nextDueDate = calculateNextDueDate(startDate, frequency); } else { nextDueDate = existingRec.nextDueDate; } } else { nextDueDate = calculateNextDueDate(startDate, frequency); while (nextDueDate && nextDueDate < startDate && frequency !== 'daily') { nextDueDate = calculateNextDueDate(nextDueDate, frequency); } if (!nextDueDate && startDate) nextDueDate = startDate; } const recurringData = { id: isEditing ? currentEditingRecurringId : (Date.now() + Math.random()).toString(), name, amount, type, category, paymentMethod, frequency, startDate, nextDueDate: nextDueDate || startDate, lastCreatedDate: lastCreated, tags }; if (isEditing) { const index = recurringTransactions.findIndex(r => r.id === currentEditingRecurringId); if (index > -1) { recurringTransactions[index] = recurringData; } else { return showAlert("Erro editar recorrência.", "danger"); } } else { recurringTransactions.push(recurringData); } saveDataToStorage(); if (document.getElementById('recurring-section')?.classList.contains('active')) { renderRecurringTransactions(); } closeModal(recurringTxModal); showAlert(`Recorrência ${isEditing ? 'atualizada' : 'salva'}!`, 'success'); currentEditingRecurringId = null; }
function openAddRecurringModal() { if (!isProPlan || !recurringTxModal || !recurringTxForm) return showAlert("Recurso Pro ou modal não encontrado.", "warning"); currentEditingRecurringId = null; closeModal(recurringTxModal); const title = recurringTxModal.querySelector('.modal-title'); if(title) title.textContent = "Nova Recorrência"; recurringTxForm.reset(); const typeSelect = recurringTxForm.querySelector('#recurringType'); const categorySelect = recurringTxForm.querySelector('#recurringCategory'); const frequencySelect = recurringTxForm.querySelector('#recurringFrequency'); const startDateInput = recurringTxForm.querySelector('#recurringStartDate'); const tagsInput = recurringTxForm.querySelector('#recurringTagsInput'); if(typeSelect) typeSelect.value = 'expense'; if(categorySelect) updateCategoryDropdowns(categorySelect, 'expense', true); if(frequencySelect) frequencySelect.value = 'monthly'; if(startDateInput) startDateInput.value = getLocalDateString(); if (tagsInput) tagsInput.value = ''; updatePlaceholders(); openModal(recurringTxModal); }
function openEditRecurringModal(index) { if (!isProPlan || index === null || index < 0 || index >= recurringTransactions.length || !recurringTransactions[index] || !recurringTxModal || !recurringTxForm) { return showAlert("Erro editar recorrência.", "danger"); } const r = recurringTransactions[index]; currentEditingRecurringId = r.id; closeModal(recurringTxModal); recurringTxForm.querySelector('#recurringName').value = r.name; recurringTxForm.querySelector('#recurringAmount').value = r.amount.toFixed(2); recurringTxForm.querySelector('#recurringType').value = r.type; if(recurringCategorySelect) { updateCategoryDropdowns(recurringCategorySelect, r.type, true); recurringCategorySelect.value = r.category; } recurringTxForm.querySelector('#recurringPaymentMethod').value = r.paymentMethod; recurringTxForm.querySelector('#recurringFrequency').value = r.frequency; recurringTxForm.querySelector('#recurringStartDate').value = r.startDate; const tagsInput = recurringTxForm.querySelector('#recurringTagsInput'); if (tagsInput) tagsInput.value = formatTags(r.tags); const title = recurringTxModal.querySelector('.modal-title'); if(title) title.textContent = "Editar Recorrência"; updatePlaceholders(); openModal(recurringTxModal); }
async function deleteRecurringTransaction(index) { if (!isProPlan || index === null || index < 0 || index >= recurringTransactions.length || !recurringTransactions[index]) return showAlert("Erro encontrar recorrência.", 'danger'); const recurringToDelete = recurringTransactions[index]; const conf = await showConfirmModal(`Excluir recorrência: <b>"${escapeHtml(recurringToDelete.name)}"</b>?<br>Transações já criadas NÃO serão excluídas.`); if (conf) { recurringTransactions.splice(index, 1); saveDataToStorage(); if (document.getElementById('recurring-section')?.classList.contains('active')) { renderRecurringTransactions(); } showAlert('Recorrência excluída.', 'info'); } }
export function renderRecurringTransactions() { if (!isProPlan || !recurringListContainer) { if (recurringListContainer) recurringListContainer.innerHTML = ''; return; } recurringListContainer.innerHTML = ''; const sortedRecurring = [...recurringTransactions].sort((a, b) => (a.nextDueDate || '9999-12-31').localeCompare(b.nextDueDate || '9999-12-31')); if (sortedRecurring.length === 0) { recurringListContainer.innerHTML = `<div class="empty-state info" style="padding:2rem;"><i class="fas fa-sync-alt fa-2x mb-3"></i><h3>Nenhuma recorrência</h3><p>Crie transações automáticas.</p><button class="btn btn-primary mt-3" id="addRecurringFromEmptyState"><i class="fas fa-plus"></i> Criar</button></div>`; const addBtn = recurringListContainer.querySelector('#addRecurringFromEmptyState'); if (addBtn) addBtn.onclick = openAddRecurringModal; return; } sortedRecurring.forEach((recTx) => { const originalIndex = recurringTransactions.findIndex(r => r.id === recTx.id); if (originalIndex !== -1) { recurringListContainer.appendChild(createRecurringTransactionElement(recTx, originalIndex)); } else { console.warn("Render Rec: Índice não encontrado:", recTx.id); } }); }
export function checkRecurringTransactions() { if (!isProPlan) return; const today = getLocalDateString(); const nowTimestamp = Date.now(); let createdCount = 0; let updated = false; recurringTransactions.forEach((r, index) => { if (!r.nextDueDate || r.nextDueDate > today || r.lastCreatedDate === today) return; const newTx = { id: (nowTimestamp + Math.random() * (index + 1)).toString(), date: today, item: `Rec: ${r.name}`, amount: r.amount, type: r.type, category: r.category, paymentMethod: r.paymentMethod, description: `Gerado por recorrência ID ${r.id} (Freq: ${r.frequency}).`, isScheduled: false, originatingBillId: null, isRecurring: true, originatingRecurringId: r.id, tags: r.tags || [], attachmentDataUrl: null }; transactions.push(newTx); createdCount++; console.log(`Tx Recorrente Criada - ID ${r.id}: ${newTx.item}`); const nextDate = calculateNextDueDate(r.nextDueDate, r.frequency); if (nextDate) { recurringTransactions[index].nextDueDate = nextDate; recurringTransactions[index].lastCreatedDate = today; updated = true; } else { console.error(`Erro Rec: Próx data ${r.id}. Freq: ${r.frequency}.`); } }); if (createdCount > 0) { saveDataToStorage(); refreshAllUIComponents(); showAlert(`${createdCount} transaçõe(s) recorrente(s) criada(s).`, 'success'); } else if (updated) { saveDataToStorage(); if (document.getElementById('recurring-section')?.classList.contains('active')) { renderRecurringTransactions(); } } }
function createRecurringTransactionElement(recurringTx, index) { const div = document.createElement('div'); div.className = `recurring-item ${recurringTx.type}`; div.dataset.index = index; div.dataset.id = recurringTx.id; const isInc = recurringTx.type === 'income'; const catIcon = categoryIconMapping[recurringTx.category] || 'fas fa-question-circle'; const iconBg = isInc ? 'bg-success' : 'bg-danger'; const amtCls = isInc ? 'amount-positive' : 'amount-negative'; const amtPfx = isInc ? '+ ' : '- '; let pmIcon = '', pmText = ''; switch(recurringTx.paymentMethod){ case 'pix': pmIcon='<i class="fas fa-qrcode fa-fw"></i>'; pmText='Pix'; break; case 'cash': pmIcon='<i class="fas fa-money-bill-wave fa-fw"></i>'; pmText='Dinheiro'; break; case 'card': pmIcon='<i class="fas fa-credit-card fa-fw"></i>'; pmText='Conta/C.'; break; default: pmIcon='<i class="fas fa-question-circle fa-fw"></i>'; pmText=recurringTx.paymentMethod||'N/D'; } const freqMap = { daily: 'Diária', weekly: 'Semanal', monthly: 'Mensal', yearly: 'Anual' }; const frequencyText = freqMap[recurringTx.frequency] || recurringTx.frequency; const nextDateText = recurringTx.nextDueDate ? formatDisplayDate(recurringTx.nextDueDate) : 'N/D'; div.innerHTML = `<div class="recurring-icon ${iconBg}"><i class="${catIcon}"></i></div> <div class="recurring-details"> <div class="recurring-title">${escapeHtml(recurringTx.name)} <span class="recurring-category">(${escapeHtml(recurringTx.category)})</span></div> <div class="recurring-meta"> <span><i class="fas fa-redo-alt fa-fw"></i> ${frequencyText}</span> <span class="separator">|</span> <span>${pmIcon} ${escapeHtml(pmText)}</span> <span class="separator">|</span> <span>Próxima: <i class="far fa-calendar-check fa-fw"></i> ${nextDateText}</span> </div> </div> <div class="recurring-amount ${amtCls}"> ${amtPfx} <span class="monetary-value">${formatCurrency(recurringTx.amount)}</span></div> <div class="recurring-actions"> <button class="action-btn edit-recurring btn-sm btn-outline-secondary" title="Editar Recorrência"><i class="fas fa-pencil"></i></button> <button class="action-btn delete-recurring btn-sm btn-outline-danger" title="Excluir Recorrência"><i class="fas fa-trash"></i></button> </div>`; return div; }

// --- Funções do Editor de Categorias (Reformulado) ---

function openCategoryEditorModal() {
    if (!isProPlan || !categoryEditorModal) return showAlert("Recurso Pro indisponível.", "warning");
    categoryEditorFilter = 'all';
    if (categoryEditorFilters) {
        categoryEditorFilters.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.filterType === 'all');
        });
    }
    renderCategoryEditor(categoryEditorFilter);
    openModal(categoryEditorModal);
    categoryChangesMade = false;
    setSaveButtonState(false);
}

function renderCategoryEditor(filter = 'all') {
    if (!categoryEditorList) return;
    categoryEditorList.innerHTML = '<li class="list-group-item text-center p-4"><i class="fas fa-spinner fa-spin"></i> Renderizando...</li>';

    let itemsToRender = [];
    let incomeItems = categoryStructure.income || [];
    let expenseItems = categoryStructure.expense || [];

    if (filter === 'all' || filter === 'expense') {
        itemsToRender = itemsToRender.concat(expenseItems);
    }
    if (filter === 'all' || filter === 'income') {
        if (filter === 'all' && itemsToRender.length > 0 && incomeItems.length > 0) {
             const sep = document.createElement('li');
             sep.className = 'list-group-item list-group-item-secondary text-center small p-1 mt-3 mb-2 visual-separator';
             sep.textContent = "--- RECEITAS ---";
             sep.style.cursor = 'default';
             itemsToRender.push({element: sep});
        }
        itemsToRender = itemsToRender.concat(incomeItems);
    }

    categoryEditorList.innerHTML = '';

    if (itemsToRender.filter(item => !item.element).length === 0) {
        categoryEditorList.innerHTML = '<li class="list-group-item text-center text-muted p-4">Nenhuma categoria encontrada para este filtro.</li>';
        return;
    }

    itemsToRender.forEach(item => {
        if (item.element) { categoryEditorList.appendChild(item.element); return; }

        const li = document.createElement('li');
        const isCoreDefault = (defaultCategories[item.type] || []).includes(item.name);
        const isOriginallyDefault = item.isDefault === true;

        li.className = `list-group-item ${item.isTitle ? 'is-title' : 'is-category'} ${item.isHidden ? 'is-hidden' : ''}`;
        if (isOriginallyDefault) li.classList.add('was-default');
        li.dataset.categoryName = item.name;
        li.dataset.categoryType = item.type;
        li.dataset.isTitle = String(item.isTitle); // Salva como string
        li.dataset.isOriginallyDefault = String(isOriginallyDefault);
        li.dataset.isCoreDefault = String(isCoreDefault);
        li.dataset.isHidden = String(item.isHidden); // Salva como string

        const canEdit = true;
        const canDelete = !isCoreDefaultTitle(item.name, item.type);
        const canHide = true;

        let actionsHtml = `
            <button class="btn btn-sm btn-outline-secondary edit-category-item" title="Editar Nome" ${!canEdit ? 'disabled' : ''}><i class="fas fa-pencil"></i></button>
            <button class="btn btn-sm btn-outline-warning toggle-visibility-item" title="${item.isHidden ? 'Mostrar nos Dropdowns' : 'Ocultar nos Dropdowns'}" ${!canHide ? 'disabled' : ''}><i class="fas ${item.isHidden ? 'fa-eye-slash' : 'fa-eye'}"></i></button>
            <button class="btn btn-sm btn-outline-danger delete-category-item" title="${canDelete ? 'Excluir' : 'Não pode excluir título padrão'}" ${!canDelete ? 'disabled' : ''}><i class="fas fa-trash"></i></button>
        `;

        li.innerHTML = `
            <span class="drag-handle"><i class="fas fa-grip-vertical"></i></span>
            <div class="category-item-content">
                <span class="category-name-display">${escapeHtml(item.name)}</span>
                <input type="text" class="form-control form-control-sm category-name-input" value="${escapeHtml(item.name)}" style="display: none;">
                ${item.isTitle ? '<i class="fas fa-chevron-down category-toggle-icon ms-2 text-muted"></i>' : ''}
            </div>
            <div class="category-actions">
                ${actionsHtml}
                <button class="btn btn-sm btn-success save-category-edit" title="Salvar Edição" style="display: none;"><i class="fas fa-check"></i></button>
                <button class="btn btn-sm btn-outline-secondary cancel-category-edit" title="Cancelar Edição" style="display: none;"><i class="fas fa-times"></i></button>
            </div>
        `;
        categoryEditorList.appendChild(li);

        // Aplica estado colapsado se necessário (ex: começa recolhido)
        if (item.isTitle && li.classList.contains('collapsed')) {
            toggleCategoryGroup(li, true); // Força o estado visual inicial
        }
    });

    if (categorySortableInstance) { categorySortableInstance.destroy(); }
    if(typeof Sortable !== 'undefined'){
        categorySortableInstance = new Sortable(categoryEditorList, {
            handle: '.drag-handle', animation: 150, ghostClass: 'sortable-ghost', dragClass: 'sortable-drag',
            filter: '.visual-separator, .is-hidden', // Impede arrastar separadores e itens ocultos
            onUpdate: function (evt) { markChangesMade(); },
        });
    } else { console.error("SortableJS não encontrado."); showAlert("Erro: Biblioteca SortableJS não carregada.", "warning"); }
    setSaveButtonState(categoryChangesMade);
}

function isCoreDefaultTitle(name, type) {
    if (!name || typeof name !== 'string' || !name.startsWith('-- ')) return false;
    return (defaultCategories[type] || []).includes(name);
}

function markChangesMade() {
    categoryChangesMade = true;
    setSaveButtonState(true);
}

function setSaveButtonState(enabled) {
    if (saveCategoryEditorChangesBtn) {
        saveCategoryEditorChangesBtn.disabled = !enabled;
    }
}

function handleCategoryEditorActions(event) {
    const target = event.target;
    const itemLi = target.closest('.list-group-item');
     if (!itemLi || itemLi.classList.contains('list-group-item-secondary')) return;

    const nameSpan = itemLi.querySelector('.category-name-display');
    const nameInput = itemLi.querySelector('.category-name-input');
    const editButton = itemLi.querySelector('.edit-category-item');
    const deleteButton = itemLi.querySelector('.delete-category-item');
    const toggleButton = itemLi.querySelector('.toggle-visibility-item');
    const saveButton = itemLi.querySelector('.save-category-edit');
    const cancelButton = itemLi.querySelector('.cancel-category-edit');
    const currentName = itemLi.dataset.categoryName;
    const isTitle = itemLi.dataset.isTitle === 'true';
    const type = itemLi.dataset.categoryType;
    const coreDefaultTitle = isCoreDefaultTitle(currentName, type);
    const canDelete = !coreDefaultTitle;
    const canEdit = true;
    const canToggle = true;

    // Clicou no Título (não nos botões) para Expandir/Recolher
    if (isTitle && target.closest('.category-item-content') && !target.closest('.category-actions') && !target.closest('.category-name-input')) {
         event.stopPropagation();
         toggleCategoryGroup(itemLi);
         return;
    }

    // Clicou em Editar
    if (target.closest('.edit-category-item') && canEdit && nameSpan && nameInput && saveButton && cancelButton && editButton) {
        event.stopPropagation();
        itemLi.querySelectorAll('.category-actions .btn:not(.save-category-edit):not(.cancel-category-edit)').forEach(btn => btn.style.display = 'none');
        nameSpan.style.display = 'none';
        nameInput.style.display = 'block';
        nameInput.value = nameSpan.textContent;
        nameInput.select();
        saveButton.style.display = 'inline-block';
        cancelButton.style.display = 'inline-block';
    }
    // Clicou em Cancelar Edição
    else if (target.closest('.cancel-category-edit') && canEdit && nameSpan && nameInput && saveButton && cancelButton && editButton) {
        event.stopPropagation();
        nameSpan.style.display = 'block';
        nameInput.style.display = 'none';
        nameInput.value = nameSpan.textContent; // Restaura o valor original no input escondido
        saveButton.style.display = 'none';
        cancelButton.style.display = 'none';
        // Mostra os botões de ação novamente, respeitando as permissões originais
        itemLi.querySelectorAll('.category-actions .btn:not(.save-category-edit):not(.cancel-category-edit)').forEach(btn => {
            const isDeleteBtn = btn.classList.contains('delete-category-item');
            btn.style.display = (isDeleteBtn && !canDelete) ? 'none' : 'inline-block';
        });
    }
    // Clicou em Salvar Edição
    else if (target.closest('.save-category-edit') && canEdit && nameSpan && nameInput && saveButton && cancelButton && editButton) {
        event.stopPropagation();
        const newName = nameInput.value.trim();
        const originalName = itemLi.dataset.categoryName;

        if (!newName) { return showAlert("Nome não pode ser vazio.", "warning"); }
        if (isTitle && (!newName.startsWith('-- ') || !newName.endsWith(' --') || newName.length <= 6)) { return showAlert("Título deve estar no formato '-- NOME --'.", "warning"); }
        if (!isTitle && newName.startsWith('-- ')) { return showAlert("Nome de categoria não pode começar com '-- '.", "warning"); }

        let existingNamesInUI = [];
         categoryEditorList.querySelectorAll('.list-group-item').forEach(li => {
             if (li !== itemLi && !li.classList.contains('list-group-item-secondary') && li.dataset.categoryType === type && li.dataset.isTitle === String(isTitle)) {
                existingNamesInUI.push(li.dataset.categoryName.toLowerCase());
             }
         });
         if (existingNamesInUI.includes(newName.toLowerCase())) {
             return showAlert(`"${escapeHtml(newName)}" já existe nesta lista para este tipo.`, "warning");
         }

        itemLi.dataset.categoryName = newName; // Atualiza o dataset!
        nameSpan.textContent = newName;
        nameSpan.style.display = 'block';
        nameInput.style.display = 'none';
        saveButton.style.display = 'none';
        cancelButton.style.display = 'none';
        itemLi.querySelectorAll('.category-actions .btn:not(.save-category-edit):not(.cancel-category-edit)').forEach(btn => {
             const isDisabled = btn.classList.contains('delete-category-item') ? !canDelete : false;
             if (!isDisabled) btn.style.display = 'inline-block';
        });

        if (newName !== originalName) { markChangesMade(); }
    }
    // Clicou em Excluir
    else if (target.closest('.delete-category-item') && canDelete) {
        event.stopPropagation();
        confirmDeleteCategoryItem(itemLi);
    }
    // Clicou em Ocultar/Mostrar
    else if (target.closest('.toggle-visibility-item') && canToggle) {
        event.stopPropagation();
        const currentlyHidden = itemLi.dataset.isHidden === 'true';
        const newHiddenState = !currentlyHidden;
        itemLi.dataset.isHidden = String(newHiddenState); // Salva como string
        itemLi.classList.toggle('is-hidden', newHiddenState);
        const icon = target.closest('.toggle-visibility-item').querySelector('i');
        if (icon) {
            icon.classList.toggle('fa-eye', newHiddenState);
            icon.classList.toggle('fa-eye-slash', !newHiddenState);
        }
        target.closest('.toggle-visibility-item').title = newHiddenState ? 'Mostrar nos Dropdowns' : 'Ocultar nos Dropdowns';
        markChangesMade();
    }
}

function toggleCategoryGroup(titleLi) {
    const isCollapsed = titleLi.classList.toggle('collapsed');
    const toggleIcon = titleLi.querySelector('.category-toggle-icon');
    if (toggleIcon) {
        toggleIcon.classList.toggle('fa-chevron-down', !isCollapsed);
        toggleIcon.classList.toggle('fa-chevron-right', isCollapsed);
    }

    let nextSibling = titleLi.nextElementSibling;
    while(nextSibling && !nextSibling.classList.contains('is-title') && !nextSibling.classList.contains('visual-separator')) {
        nextSibling.style.display = isCollapsed ? 'none' : 'flex';
        nextSibling = nextSibling.nextElementSibling;
    }
}


async function confirmDeleteCategoryItem(itemLi) {
    const name = itemLi.dataset.categoryName;
    const type = itemLi.dataset.categoryType;
    const isTitle = itemLi.dataset.isTitle === 'true';
    const coreDefaultTitle = isCoreDefaultTitle(name, type);

    if (isTitle && coreDefaultTitle) { return showAlert("Títulos padrão essenciais não podem ser excluídos.", "warning"); }

    let confirmMessage = `Excluir ${isTitle ? 'título' : 'categoria'} "${escapeHtml(name)}"?`;
    let inUse = false;
    if (!isTitle) {
         inUse = transactions.some(t => t.category === name && t.type === type) ||
                   recurringTransactions.some(r => r.category === name && r.type === type);
         if (inUse) confirmMessage += `<br><strong class="text-danger">Atenção:</strong> Em uso! Transações/recorrências associadas podem ficar sem categoria válida.`;
    } else {
         let nextSibling = itemLi.nextElementSibling;
         let hasChildren = false;
         while(nextSibling && !nextSibling.classList.contains('is-title') && !nextSibling.classList.contains('visual-separator')) { hasChildren = true; break; }
         if(hasChildren) confirmMessage += `<br><strong class="text-danger">Atenção:</strong> Contém itens abaixo! Eles ficarão sem título pai.`;
    }
    confirmMessage += "<br>Esta ação só terá efeito após salvar as alterações.";

    const conf = await showConfirmModal(confirmMessage, "Confirmar Exclusão", "warning");
    if (conf) {
        itemLi.remove();
        showAlert(`${isTitle ? 'Título' : 'Categoria'} removido(a) da lista (lembre-se de salvar).`, 'info', 2000);
         markChangesMade();
    }
}

function addCustomCategoryFromEditor() {
    if (!newCategoryNameEditor || !newCategoryTypeEditor || !categoryEditorList) return;
    const name = newCategoryNameEditor.value.trim();
    const type = newCategoryTypeEditor.value;

    if (!name) return showAlert("Digite o nome da nova categoria.", "warning");
    if (name.startsWith('--')) return showAlert("Nome de categoria inválido.", "warning");

    let existingNamesInUI = [];
     categoryEditorList.querySelectorAll('.list-group-item:not(.is-title)').forEach(li => {
         if (li.dataset.categoryType === type && !li.classList.contains('visual-separator')) {
            existingNamesInUI.push(li.dataset.categoryName.toLowerCase());
         }
     });
     (defaultCategories[type] || []).forEach(defCat => { if(!defCat.startsWith('-- ')) existingNamesInUI.push(defCat.toLowerCase()); });

     if (existingNamesInUI.includes(name.toLowerCase())) { return showAlert(`Categoria "${escapeHtml(name)}" já existe ou conflita com padrão (${type === 'expense' ? 'desp.' : 'rec.'}).`, "warning"); }

    const li = document.createElement('li');
    li.className = `list-group-item is-category is-custom`;
    li.dataset.categoryName = name;
    li.dataset.categoryType = type;
    li.dataset.isTitle = 'false';
    li.dataset.isOriginallyDefault = 'false';
    li.dataset.isCoreDefault = 'false';
    li.dataset.isHidden = 'false';

     li.innerHTML = `
        <span class="drag-handle"><i class="fas fa-grip-vertical"></i></span>
        <div class="category-item-content">
            <span class="category-name-display">${escapeHtml(name)}</span>
            <input type="text" class="form-control form-control-sm category-name-input" value="${escapeHtml(name)}" style="display: none;">
        </div>
        <div class="category-actions">
            <button class="btn btn-sm btn-outline-secondary edit-category-item" title="Editar Nome"><i class="fas fa-pencil"></i></button>
            <button class="btn btn-sm btn-outline-warning toggle-visibility-item" title="Ocultar"><i class="fas fa-eye"></i></button>
            <button class="btn btn-sm btn-outline-danger delete-category-item" title="Excluir"><i class="fas fa-trash"></i></button>
            <button class="btn btn-sm btn-success save-category-edit" title="Salvar Edição" style="display: none;"><i class="fas fa-check"></i></button>
            <button class="btn btn-sm btn-outline-secondary cancel-category-edit" title="Cancelar Edição" style="display: none;"><i class="fas fa-times"></i></button>
        </div>
    `;

    let insertBeforeElement = null;
    let lastElementOfType = null;
    const itemsOfType = categoryEditorList.querySelectorAll(`.list-group-item[data-category-type="${type}"]:not(.visual-separator)`);
    if(itemsOfType.length > 0) { lastElementOfType = itemsOfType[itemsOfType.length-1]; insertBeforeElement = lastElementOfType.nextElementSibling; }
    else if (type === 'expense'){ const separator = categoryEditorList.querySelector('.visual-separator'); if (separator) { insertBeforeElement = separator;} }

    if (insertBeforeElement) { categoryEditorList.insertBefore(li, insertBeforeElement); }
    else if (lastElementOfType) { lastElementOfType.parentNode.insertBefore(li, lastElementOfType.nextSibling); }
    else { categoryEditorList.appendChild(li); }

    newCategoryNameEditor.value = '';
    showAlert(`Categoria "${escapeHtml(name)}" adicionada à lista (lembre-se de salvar).`, 'success', 2500);
    markChangesMade();
}

 function addCustomTitleFromEditor() {
     if (!newCategoryTitleEditor || !newCategoryTitleTypeEditor || !categoryEditorList) return;
     let name = newCategoryTitleEditor.value.trim();
     const type = newCategoryTitleTypeEditor.value;

     if (!name) return showAlert("Digite o nome do novo título.", "warning");
     if (!name.startsWith('-- ') || !name.endsWith(' --') || name.length <= 6) { name = `-- ${name.replace(/--/g, '').trim()} --`; newCategoryTitleEditor.value = name; showAlert("Título formatado para '-- NOME --'.", "info", 2000); }

     let existingTitlesInUI = [];
      categoryEditorList.querySelectorAll('.list-group-item.is-title').forEach(li => { if (li.dataset.categoryType === type && !li.classList.contains('visual-separator')) { existingTitlesInUI.push(li.dataset.categoryName.toLowerCase()); } });
       (defaultCategories[type] || []).forEach(defCat => { if(defCat.startsWith('-- ')) existingTitlesInUI.push(defCat.toLowerCase()); });

      if (existingTitlesInUI.includes(name.toLowerCase())) { return showAlert(`Título "${escapeHtml(name)}" já existe ou conflita com padrão (${type === 'expense' ? 'desp.' : 'rec.'}).`, "warning"); }

     const li = document.createElement('li');
     li.className = `list-group-item is-title is-custom category-title-toggle`;
     li.dataset.categoryName = name;
     li.dataset.categoryType = type;
     li.dataset.isTitle = 'true';
     li.dataset.isOriginallyDefault = 'false';
     li.dataset.isCoreDefault = 'false';
     li.dataset.isHidden = 'false';

     li.innerHTML = `
         <span class="drag-handle"><i class="fas fa-grip-vertical"></i></span>
         <div class="category-item-content">
             <span class="category-name-display">${escapeHtml(name)}</span>
             <input type="text" class="form-control form-control-sm category-name-input" value="${escapeHtml(name)}" style="display: none;">
             <i class="fas fa-chevron-down category-toggle-icon ms-2 text-muted"></i>
         </div>
         <div class="category-actions">
             <button class="btn btn-sm btn-outline-secondary edit-category-item" title="Editar"><i class="fas fa-pencil"></i></button>
              <button class="btn btn-sm btn-outline-warning toggle-visibility-item" title="Ocultar"><i class="fas fa-eye"></i></button>
             <button class="btn btn-sm btn-outline-danger delete-category-item" title="Excluir"><i class="fas fa-trash"></i></button>
             <button class="btn btn-sm btn-success save-category-edit" title="Salvar" style="display: none;"><i class="fas fa-check"></i></button>
             <button class="btn btn-sm btn-outline-secondary cancel-category-edit" title="Cancelar" style="display: none;"><i class="fas fa-times"></i></button>
         </div>
     `;

      let insertBeforeElement = null;
      let lastElementOfType = null;
      const itemsOfType = categoryEditorList.querySelectorAll(`.list-group-item[data-category-type="${type}"]:not(.visual-separator)`);
      if (itemsOfType.length > 0) { lastElementOfType = itemsOfType[itemsOfType.length - 1]; insertBeforeElement = lastElementOfType.nextElementSibling; }
      else if (type === 'expense'){ const separator = categoryEditorList.querySelector('.visual-separator'); if (separator) { insertBeforeElement = separator;} }

      if (insertBeforeElement) { categoryEditorList.insertBefore(li, insertBeforeElement); }
      else if (lastElementOfType) { lastElementOfType.parentNode.insertBefore(li, lastElementOfType.nextSibling); }
      else { categoryEditorList.appendChild(li); }

     newCategoryTitleEditor.value = '';
     showAlert(`Título "${escapeHtml(name)}" adicionado (lembre-se de salvar).`, 'success', 2500);
     markChangesMade();
 }


function saveCategoryEditorChanges() {
    if (!categoryEditorList) return showAlert("Erro: Lista de categorias não encontrada.", "danger");

    const newStructure = { expense: [], income: [] };
    let currentType = 'expense';

    categoryEditorList.querySelectorAll('.list-group-item').forEach(li => {
        if (li.classList.contains('visual-separator')) { currentType = 'income'; return; }
        if (!li.dataset.categoryType) return;

        const type = li.dataset.categoryType;
        const name = li.dataset.categoryName;
        const isTitle = li.dataset.isTitle === 'true';
        const isOriginallyDefault = li.dataset.isOriginallyDefault === 'true';
        const isHidden = li.dataset.isHidden === 'true';

        if (type === 'expense' || type === 'income') {
            if (!newStructure[type]) { newStructure[type] = []; }
            newStructure[type].push({ name, type, isTitle, isDefault: isOriginallyDefault, isHidden });
        } else { console.warn("Tipo de categoria inválido encontrado durante o salvamento:", type, li); }
    });

    categoryStructure.expense = newStructure.expense;
    categoryStructure.income = newStructure.income;

    saveDataToStorage();
    // Dispara evento para o app-base atualizar os dropdowns
    document.dispatchEvent(new CustomEvent('categoriesUpdated'));
    closeModal(categoryEditorModal);
    showAlert("Estrutura de categorias salva com sucesso!", "success");
    categoryChangesMade = false;
    setSaveButtonState(false);
}

async function restoreDefaultCategories() {
    const conf = await showConfirmModal(
        "Restaurar categorias padrão?<br><strong>Atenção:</strong> Todas as suas categorias personalizadas, edições de nomes, ordem e visibilidade serão perdidas. Esta ação só terá efeito após clicar em 'Salvar Alterações'.",
        "Restaurar Padrão", "warning"
    );

    if (conf) {
        const defaultStructure = { expense: [], income: [] };
        defaultCategories.expense.forEach(name => { defaultStructure.expense.push({ name: name, type: 'expense', isTitle: name.startsWith('-- '), isDefault: true, isHidden: false }); });
        defaultCategories.income.forEach(name => { defaultStructure.income.push({ name: name, type: 'income', isTitle: name.startsWith('-- '), isDefault: true, isHidden: false }); });

        // Atualiza a ESTRUTURA GLOBAL temporariamente para refletir na UI
        categoryStructure.expense = defaultStructure.expense;
        categoryStructure.income = defaultStructure.income;

        renderCategoryEditor(categoryEditorFilter);
        markChangesMade();
        showAlert("Estrutura padrão carregada. Clique em 'Salvar Alterações' para confirmar.", "info");
    }
}


async function promptForNewCategory(type) {
    const newName = prompt(`Nome da nova categoria de ${type === 'income' ? 'Receita' : 'Despesa'}:`);
    if (!newName || newName.trim() === '') return null;
    const trimmedName = newName.trim();
    if (trimmedName.startsWith('--')) { showAlert('Nome de categoria inválido.', 'warning'); return null; }

    const currentCatsOfType = (categoryStructure[type] || [])
         .filter(item => !item.isTitle)
         .map(item => item.name.toLowerCase());
     if (currentCatsOfType.includes(trimmedName.toLowerCase())) {
         showAlert(`Categoria "${escapeHtml(trimmedName)}" já existe.`, 'warning');
         return null;
     }

    if (!categoryStructure[type]) categoryStructure[type] = [];
     const newItem = { name: trimmedName, type: type, isTitle: false, isDefault: false, isHidden: false };

     let otherCatIndex = -1;
     if(type === 'expense') { otherCatIndex = categoryStructure.expense.findIndex(item => item.name === '-- OUTROS --'); }
     else if (type === 'income'){ otherCatIndex = categoryStructure.income.findIndex(item => item.name === 'Outras Receitas'); }

     if (otherCatIndex !== -1) { categoryStructure[type].splice(otherCatIndex, 0, newItem); }
     else { categoryStructure[type].push(newItem); }

    saveDataToStorage();
    showAlert(`Categoria "${escapeHtml(trimmedName)}" adicionada!`, 'success');
    if (typeof updateAllCategoryDropdowns === 'function') { updateAllCategoryDropdowns(); } // Chama função importada
    else { console.error("Erro: updateAllCategoryDropdowns não definida/importada em app-pro.js"); }
    return trimmedName;
}

// --- Funções de Relatórios Avançados ---
function exportReportDataToCsv() { if (!isProPlan || typeof Papa === 'undefined') return showAlert(typeof Papa === 'undefined' ? "Erro: PapaParse não carregado." : "Funcionalidade Pro.", "warning"); const reportData = []; const reportTitle = document.querySelector('.page-title')?.textContent || "Relatorio"; const filename = `${reportTitle.toLowerCase().replace(/\s+/g, '-')}-${getLocalDateString()}.csv`; const { startDate, endDate } = getReportDateRange(); const filtered = transactions.filter(t => (!startDate || t.date >= startDate) && (!endDate || t.date <= endDate)); if (filtered.length === 0) { return showAlert("Sem dados no período.", "info"); } reportData.push({ Relatorio: `Relatório - ${startDate ? formatDisplayDate(startDate) : 'Início'} a ${endDate ? formatDisplayDate(endDate) : 'Fim'}` }); reportData.push({}); const totalIncome = filtered.reduce((sum, t) => t.type === 'income' ? sum + t.amount : sum, 0); const totalExpense = filtered.reduce((sum, t) => t.type === 'expense' ? sum + t.amount : sum, 0); reportData.push({ Item: 'Receita Total', Valor: totalIncome.toFixed(2).replace('.', ',') }); reportData.push({ Item: 'Despesa Total', Valor: totalExpense.toFixed(2).replace('.', ',') }); reportData.push({ Item: 'Saldo', Valor: (totalIncome - totalExpense).toFixed(2).replace('.', ',') }); reportData.push({}); const expensesByCategory = {}; filtered.forEach(t => { if (t.type === 'expense') { expensesByCategory[t.category] = (expensesByCategory[t.category] || 0) + t.amount; } }); if (Object.keys(expensesByCategory).length > 0) { reportData.push({ Item: 'Gastos por Categoria'}); Object.entries(expensesByCategory).sort(([,a], [,b]) => b - a).forEach(([cat, amt]) => reportData.push({ Categoria: cat, Valor: amt.toFixed(2).replace('.', ',') })); reportData.push({}); } const expensesByMethod = { pix: 0, cash: 0, card: 0 }; filtered.forEach(t => { if (t.type === 'expense' && expensesByMethod.hasOwnProperty(t.paymentMethod)) { expensesByMethod[t.paymentMethod] += t.amount; } }); if (Object.values(expensesByMethod).some(v => v > 0)) { reportData.push({ Item: 'Uso por Método (Desp)'}); Object.entries(expensesByMethod).forEach(([mth, amt]) => { if (amt > 0) reportData.push({ Metodo: mth, Valor: amt.toFixed(2).replace('.', ',') }); }); reportData.push({}); } const monthlyHistory = {}; filtered.forEach(t => { const mY = t.date.substring(0, 7); if (!monthlyHistory[mY]) monthlyHistory[mY] = { income: 0, expense: 0 }; if (t.type === 'income') monthlyHistory[mY].income += t.amount; else monthlyHistory[mY].expense += t.amount; }); if (Object.keys(monthlyHistory).length > 0) { reportData.push({ Item: 'Histórico Mensal'}); reportData.push({ MesAno: 'Mês/Ano', Receitas: 'Receitas', Despesas: 'Despesas', Saldo: 'Saldo Mensal'}); Object.keys(monthlyHistory).sort().forEach(mY => { const data = monthlyHistory[mY]; const bal = data.income - data.expense; const [y, m] = mY.split('-'); reportData.push({ MesAno: `${getMonthName(parseInt(m)-1)}/${y.slice(-2)}`, Receitas: data.income.toFixed(2).replace('.', ','), Despesas: data.expense.toFixed(2).replace('.', ','), Saldo: bal.toFixed(2).replace('.', ',') }); }); } try { const csv = Papa.unparse(reportData, { quotes: true, delimiter: ";", header: false }); downloadCsv(filename, csv); showAlert("Relatório CSV exportado.", "success"); } catch (err) { console.error("Erro CSV Relatório:", err); showAlert("Erro CSV Relatório.", "danger"); } }
function exportFilteredTransactionsToCsv() { if (!isProPlan || typeof Papa === 'undefined') return showAlert(typeof Papa === 'undefined' ? "Erro: PapaParse não carregado." : "Funcionalidade Pro.", "warning"); const ty=document.getElementById('filterType2')?.value||'all'; const ca=document.getElementById('filterCategory2')?.value||'all'; const pa=document.getElementById('filterPayment2')?.value||'all'; const se=(document.getElementById('searchInput2')?.value||'').toLowerCase().trim(); const tagFilterInput = document.getElementById('filterTagsInput'); const tagsToFilter = tagFilterInput ? parseTags(tagFilterInput.value) : []; const filtered = transactions.filter(t=>{ const typeMatch = (ty==='all'||t.type===ty); const catMatch = (ca==='all'||t.category===ca); const payMatch = (pa==='all'||t.paymentMethod===pa); const searchMatch = (se===''||t.item.toLowerCase().includes(se)||t.category.toLowerCase().includes(se)||(t.description&&t.description.toLowerCase().includes(se))); const tagsMatch = tagsToFilter.length === 0 || tagsToFilter.every(filterTag => (t.tags || []).map(tg=>tg.toLowerCase()).includes(filterTag.toLowerCase())); return typeMatch && catMatch && payMatch && searchMatch && tagsMatch; }); if (filtered.length === 0) { return showAlert("Nenhuma transação encontrada.", "info"); } const dataToExport = filtered.map(t => ({ Data: formatDisplayDate(t.date), Descricao: t.item, Valor: (t.type === 'income' ? '+' : '-') + t.amount.toFixed(2).replace('.',','), Tipo: t.type === 'income' ? 'Receita' : 'Despesa', Categoria: t.category, Metodo: t.paymentMethod, Tags: formatTags(t.tags), Notas: t.description || '', Origem: t.isScheduled ? `Agend:${t.originatingBillId}` : (t.isRecurring ? `Rec:${t.originatingRecurringId}` : 'Manual'), ID: t.id })); const filename = `transacoes-filtradas-${getLocalDateString()}.csv`; try { const csv = Papa.unparse(dataToExport, { quotes: true, delimiter: ";", header: true }); downloadCsv(filename, csv); showAlert(`${filtered.length} transaçõe(s) exportada(s).`, "success"); } catch (err) { console.error("Erro CSV Transações:", err); showAlert("Erro CSV Transações.", "danger"); } }
function getReportDateRange() { let startDate = null; let endDate = null; if (isProPlan && reportStartDateInput && reportEndDateInput) { startDate = reportStartDateInput.value || null; endDate = reportEndDateInput.value || null; if (startDate && endDate && startDate > endDate) { return { startDate: null, endDate: null }; } } return { startDate, endDate }; }
function renderCashFlowReport(monthlyData) { if (!isProPlan || !cashFlowReportContainer) return; cashFlowReportContainer.innerHTML = ''; const months = Object.keys(monthlyData).sort((a, b) => a.localeCompare(b)); if (months.length === 0) { cashFlowReportContainer.innerHTML = '<p class="text-muted text-center p-3">Sem dados no período.</p>'; return; } const table = document.createElement('table'); table.className = 'table table-sm table-striped table-hover cash-flow-table'; const thead = table.createTHead(); const headerRow = thead.insertRow(); headerRow.innerHTML = '<th>Mês/Ano</th><th>Receitas</th><th>Despesas</th><th>Saldo Mensal</th>'; const tbody = table.createTBody(); months.forEach(monthYear => { const data = monthlyData[monthYear]; // Corrigido para usar a variável do parâmetro
         const [year, month] = monthYear.split('-');
         const monthName = getMonthName(parseInt(month) - 1);
         const balance = data.income - data.expense;
         const row = tbody.insertRow();
         row.innerHTML = `<td>${monthName}/${year.slice(-2)}</td> <td class="amount-positive"><span class="monetary-value">${formatCurrency(data.income)}</span></td> <td class="amount-negative"><span class="monetary-value">${formatCurrency(data.expense)}</span></td> <td class="${balance >= 0 ? 'amount-positive' : 'amount-negative'}"><span class="monetary-value">${formatCurrency(balance)}</span></td>`; }); const title = document.createElement('h4'); title.className = 'mt-4 mb-2'; title.innerHTML = '<i class="fas fa-chart-bar me-2"></i>Fluxo de Caixa (Tabela)'; cashFlowReportContainer.appendChild(title); cashFlowReportContainer.appendChild(table); if (valuesHidden) { cashFlowReportContainer.querySelectorAll('.monetary-value').forEach(el => el.textContent = 'R$ ***'); } }

// --- Funções de Importação CSV ---
function handleCsvFileImport(event) { if (!isProPlan || typeof Papa === 'undefined') return showAlert(typeof Papa === 'undefined' ? "Erro: PapaParse não carregado." : "Funcionalidade Pro.", "warning"); const file = event.target.files?.[0]; if (!file || !importCsvInput) return; showLoadingIndicator(true, "Processando CSV..."); Papa.parse(file, { header: true, skipEmptyLines: true, dynamicTyping: false, complete: (results) => { showLoadingIndicator(false); if (results.errors.length > 0) { console.error("Erros CSV:", results.errors); showAlert(`Erro CSV: ${results.errors[0].message}.`, 'danger'); importCsvInput.value = ''; return; } if (!results.data || results.data.length === 0) { showAlert("CSV vazio/inválido.", 'warning'); importCsvInput.value = ''; return; } if (!results.meta || !results.meta.fields || results.meta.fields.length === 0) { showAlert("CSV sem cabeçalhos.", 'danger'); importCsvInput.value = ''; return; } csvImportData.raw = results.data; csvImportData.headers = results.meta.fields; csvImportData.mapped = []; csvImportData.map = {}; displayCsvPreviewAndMapping(); openModal(csvImportModal); }, error: (error) => { showLoadingIndicator(false); console.error("Erro fatal CSV:", error); showAlert(`Erro fatal CSV: ${error.message}`, 'danger'); importCsvInput.value = ''; } }); }
function displayCsvPreviewAndMapping() { if (!csvImportModal || !csvPreviewTable || !csvMappingArea) return; csvPreviewTable.innerHTML = ''; csvMappingArea.innerHTML = ''; const targetFields = ['Data', 'Descrição', 'Valor', 'Tipo (opcional)', 'Categoria (opcional)', 'Tags (opcional)']; const requiredFields = ['Data', 'Descrição', 'Valor']; const mappingTitle = document.createElement('h5'); mappingTitle.textContent = "Mapeie as colunas:"; csvMappingArea.appendChild(mappingTitle); const mappingForm = document.createElement('form'); mappingForm.id = 'csvMappingForm'; mappingForm.className = 'row g-3 align-items-center'; targetFields.forEach(targetField => { const isRequired = requiredFields.includes(targetField); const div = document.createElement('div'); div.className = 'col-md-4 col-sm-6'; const label = document.createElement('label'); label.htmlFor = `map-${targetField.toLowerCase().replace(/[^a-z0-9]/g, '')}`; label.textContent = `${targetField}${isRequired ? ' *' : ''}:`; label.className = 'form-label mb-1'; const select = document.createElement('select'); select.id = `map-${targetField.toLowerCase().replace(/[^a-z0-9]/g, '')}`; select.className = 'form-select form-select-sm'; select.dataset.targetField = targetField; if (isRequired) select.required = true; select.add(new Option(`-- Coluna ${targetField} --`, '')); csvImportData.headers.forEach((header, index) => { if(header) { select.add(new Option(header, String(index))); } }); div.appendChild(label); div.appendChild(select); mappingForm.appendChild(div); }); csvMappingArea.appendChild(mappingForm); guessCsvMapping(); const previewTitle = document.createElement('h5'); previewTitle.className = 'mt-4'; previewTitle.textContent = "Pré-visualização (5 linhas):"; csvPreviewTable.appendChild(previewTitle); const table = document.createElement('table'); table.className = 'table table-sm table-bordered table-striped mt-2 csv-preview-table'; const thead = table.createTHead(); const headerRow = thead.insertRow(); csvImportData.headers.forEach(header => { const th = document.createElement('th'); th.textContent = header || '(Vazia)'; headerRow.appendChild(th); }); const tbody = table.createTBody(); csvImportData.raw.slice(0, 5).forEach(row => { const tr = tbody.insertRow(); csvImportData.headers.forEach(header => { const td = tr.insertCell(); td.textContent = row[header] || ''; td.title = row[header] || ''; }); }); csvPreviewTable.appendChild(table); if(confirmCsvImportBtn) confirmCsvImportBtn.disabled = false; }
function guessCsvMapping() { const mappingForm = document.getElementById('csvMappingForm'); if (!mappingForm || !csvImportData.headers) return; const guesses = { 'Data': ['date', 'data', 'dia', 'vencimento', 'competencia', 'competência'], 'Descrição': ['description', 'descrição', 'descricao', 'detalhes', 'details', 'historico', 'histórico', 'lançamento', 'lancamento'], 'Valor': ['amount', 'value', 'valor', 'total', 'crédito', 'credito', 'débito', 'debito', 'montante', 'price'], 'Tipo (opcional)': ['type', 'tipo', 'movimento'], 'Categoria (opcional)': ['category', 'categoria', 'rubrica'], 'Tags (opcional)': ['tags', 'etiquetas', 'labels'] }; const selects = mappingForm.querySelectorAll('select[data-target-field]'); const assignedColumns = new Set(); selects.forEach(select => { const target = select.dataset.targetField; const possibleHeaders = guesses[target] || []; let bestMatchIndex = -1; for (const guess of possibleHeaders) { const foundIndex = csvImportData.headers.findIndex((h, idx) => h && !assignedColumns.has(idx) && h.toLowerCase().includes(guess)); if (foundIndex > -1) { bestMatchIndex = foundIndex; break; } } if (bestMatchIndex > -1) { select.value = String(bestMatchIndex); assignedColumns.add(bestMatchIndex); } }); }
async function processCsvImport() { if (!isProPlan || typeof Papa === 'undefined') return; const mappingForm = document.getElementById('csvMappingForm'); if (!mappingForm) return showAlert("Erro: Mapeamento não encontrado.", "danger"); const mapping = {}; let isValid = true; const requiredFields = ['Data', 'Descrição', 'Valor']; mappingForm.querySelectorAll('select[data-target-field]').forEach(select => { const target = select.dataset.targetField; const csvColumnIndex = select.value; if (csvColumnIndex !== '') { mapping[target] = parseInt(csvColumnIndex, 10); } else if (requiredFields.includes(target)) { isValid = false; } }); if (!isValid) return showAlert("Mapeie colunas obrigatórias (*).", "warning"); if (!mapping.hasOwnProperty('Data') || !mapping.hasOwnProperty('Descrição') || !mapping.hasOwnProperty('Valor')) { return showAlert("Mapeie Data, Descrição e Valor.", "warning"); } csvImportData.map = mapping; csvImportData.mapped = []; let parseErrors = 0; let transactionsToAdd = []; csvImportData.raw.forEach((row, rowIndex) => { const newTx = { id: (Date.now() + Math.random() * (rowIndex + 1)).toString(), isScheduled: false, isRecurring: false, originatingBillId: null, originatingRecurringId: null, deductible: false, clientId: null, projectId: null, attachmentDataUrl: null }; let rowValid = true; const dateIndex = csvImportData.map['Data']; const rawDate = row[csvImportData.headers[dateIndex]]; let parsedDateStr = null; if(rawDate){ const formatsToTry = [ { regex: /^\d{4}-\d{2}-\d{2}$/, parse: (d) => d }, { regex: /^(\d{2})\/(\d{2})\/(\d{4})$/, parse: (d) => d.replace(/^(\d{2})\/(\d{2})\/(\d{4})$/, '$3-$2-$1') }, { regex: /^(\d{2})\.(\d{2})\.(\d{4})$/, parse: (d) => d.replace(/^(\d{2})\.(\d{2})\.(\d{4})$/, '$3-$2-$1') }, { regex: /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/, parse: (d) => d.replace(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/, (m,d,mo,y) => `${y}-${mo.padStart(2,'0')}-${d.padStart(2,'0')}`) }, { regex: /^(\d{4})\/(\d{2})\/(\d{2})$/, parse: (d) => d.replace(/\//g, '-')}, ]; for (const fmt of formatsToTry) { if (fmt.regex.test(rawDate.trim())) { parsedDateStr = fmt.parse(rawDate.trim()); if (!isNaN(parseDateInput(parsedDateStr))) break; else parsedDateStr = null; } } } if (parsedDateStr) newTx.date = parsedDateStr; else { rowValid = false; parseErrors++; console.warn(`CSV Linha ${rowIndex+1}: Data inválida "${rawDate}"`); } const descIndex = csvImportData.map['Descrição']; newTx.item = row[csvImportData.headers[descIndex]]?.trim() || `Importado ${rowIndex+1}`; const valIndex = csvImportData.map['Valor']; let rawValue = row[csvImportData.headers[valIndex]] || '0'; let amount = 0; let type = 'expense'; rawValue = String(rawValue).replace(/[^-\d,.]/g, '').trim(); const hasMinus = rawValue.startsWith('-'); if(hasMinus) type = 'expense'; if (rawValue.includes(',') && rawValue.includes('.')) { if (rawValue.lastIndexOf('.') < rawValue.lastIndexOf(',')) { rawValue = rawValue.replace(/\./g, ''); } else { rawValue = rawValue.replace(/,/g, ''); } } else if (rawValue.split(',').length > 2) { rawValue = rawValue.replace(/,/g,''); } else if (rawValue.split('.').length > 2) { rawValue = rawValue.replace(/\.(?=.*\.)/g, ''); } rawValue = rawValue.replace(',', '.'); amount = parseFloat(rawValue.replace('-', '')) || 0; newTx.amount = amount; const typeIndex = csvImportData.map['Tipo (opcional)']; if (typeIndex !== undefined) { const rawType = String(row[csvImportData.headers[typeIndex]] || '').toLowerCase(); if (rawType.includes('receita') || rawType.includes('entrada') || rawType.includes('crédito') || rawType.includes('income') || rawType === 'c') { type = 'income'; } else if (rawType.includes('despesa') || rawType.includes('saída') || rawType.includes('débito') || rawType.includes('gasto') || rawType.includes('expense') || rawType === 'd') { type = 'expense'; } } else if (!hasMinus && amount > 0) { type = 'income'; } newTx.type = type; const catIndex = csvImportData.map['Categoria (opcional)']; let categoryName = catIndex !== undefined ? (row[csvImportData.headers[catIndex]]?.trim() || 'Importado') : 'Importado';
        const allValidCats = [...(categoryStructure.expense || []), ...(categoryStructure.income || [])].filter(item => !item.isTitle).map(item => item.name);
        if (!allValidCats.some(c => c.toLowerCase() === categoryName.toLowerCase())) { categoryName = 'Importado'; }
        newTx.category = categoryName;
        const tagsIndex = csvImportData.map['Tags (opcional)']; newTx.tags = tagsIndex !== undefined ? parseTags(row[csvImportData.headers[tagsIndex]] || '') : []; newTx.paymentMethod = 'card'; newTx.description = `Importado via CSV ${getLocalDateString()}. Linha ${rowIndex+1}.`; if(rowValid && newTx.amount > 0) { transactionsToAdd.push(newTx); } else if (rowValid && newTx.amount === 0) { console.log(`CSV Linha ${rowIndex+1}: Valor zero ignorado - ${newTx.item}`); } }); if (transactionsToAdd.length === 0) { closeModal(csvImportModal); return showAlert(`Nenhuma transação válida para importar.${parseErrors > 0 ? ` (${parseErrors} erros)` : ''}`, "warning"); } const confirmMsg = `Importar ${transactionsToAdd.length} transações?${parseErrors > 0 ? ` (${parseErrors} erros)` : ''}<br><strong>Irreversível.</strong>`; const confirmed = await showConfirmModal(confirmMsg); if (confirmed) { transactions.push(...transactionsToAdd); saveDataToStorage(); refreshAllUIComponents(); closeModal(csvImportModal); showAlert(`${transactionsToAdd.length} transações importadas!`, "success"); } else { showAlert("Importação cancelada.", "info"); } }

// --- Funções Auxiliares ---
function showLoadingIndicator(show, message = "Carregando...") { let indicator = document.getElementById('loadingIndicator'); if (show) { if (!indicator) { indicator = document.createElement('div'); indicator.id = 'loadingIndicator'; indicator.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background-color:rgba(0,0,0,0.6);color:white;display:flex;justify-content:center;align-items:center;z-index:10000;'; indicator.innerHTML = `<div style="text-align:center;"><i class="fas fa-spinner fa-spin fa-3x"></i><p style="margin-top: 15px;">${escapeHtml(message)}</p></div>`; document.body.appendChild(indicator); } indicator.style.display = 'flex'; indicator.querySelector('p').textContent = message; } else { if (indicator) { indicator.style.display = 'none'; } } }
function downloadCsv(filename, csvContent) { const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' }); const link = document.createElement("a"); if (link.download !== undefined) { const url = URL.createObjectURL(blob); link.setAttribute("href", url); link.setAttribute("download", filename); link.style.visibility = 'hidden'; document.body.appendChild(link); link.click(); document.body.removeChild(link); URL.revokeObjectURL(url); } else { showAlert("Download direto não suportado.", "warning"); } }

// --- Inicialização e Listeners ---
function initProFeatures() {
    console.log("Pro: Inicializando...");
    setupProEventListeners();
    renderRecurringTransactions();
    checkRecurringTransactions();
    if (recurringCheckIntervalId) clearInterval(recurringCheckIntervalId);
    recurringCheckIntervalId = setInterval(checkRecurringTransactions, RECURRING_CHECK_INTERVAL);
    document.body.classList.add('pro-plan-active');
    document.querySelectorAll('.pro-feature').forEach(el => { el.style.display = ''; if (el.tagName === 'BUTTON' || el.tagName === 'A') { el.classList.remove('disabled'); el.removeAttribute('disabled'); } });
    console.log("Pro: Inicializado.");
}

function setupProEventListeners() {
    console.log("Pro: Configurando Listeners Pro...");
    // Recorrências
    if (addRecurringBtn) addRecurringBtn.addEventListener('click', openAddRecurringModal);
    if (recurringTxForm) recurringTxForm.addEventListener('submit', saveRecurringTransaction);
    if (recurringListContainer) recurringListContainer.addEventListener('click', (e) => { const item = e.target.closest('.recurring-item'); if (!item?.dataset?.id) return; const recId = item.dataset.id; const index = recurringTransactions.findIndex(r => String(r.id) === recId); if (index === -1) return; if (e.target.closest('.edit-recurring')) { e.stopPropagation(); openEditRecurringModal(index); } else if (e.target.closest('.delete-recurring')) { e.stopPropagation(); deleteRecurringTransaction(index); }});

    // Editor de Categorias
    if (openCategoryEditorBtn) openCategoryEditorBtn.addEventListener('click', openCategoryEditorModal);
    if (categoryEditorModal) {
        if (categoryEditorFilters) categoryEditorFilters.addEventListener('click', (e) => { const filterBtn = e.target.closest('.filter-btn'); if (filterBtn && !filterBtn.classList.contains('active')) { categoryEditorFilter = filterBtn.dataset.filterType || 'all'; categoryEditorFilters.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active')); filterBtn.classList.add('active'); renderCategoryEditor(categoryEditorFilter); } });
        if (categoryEditorList) categoryEditorList.addEventListener('click', handleCategoryEditorActions);
        if (addCustomCategoryEditorBtn) addCustomCategoryEditorBtn.addEventListener('click', addCustomCategoryFromEditor);
        if (addCustomTitleEditorBtn) addCustomTitleEditorBtn.addEventListener('click', addCustomTitleFromEditor);
        if (saveCategoryEditorChangesBtn) saveCategoryEditorChangesBtn.addEventListener('click', saveCategoryEditorChanges);
        if (restoreDefaultCategoriesBtn) restoreDefaultCategoriesBtn.addEventListener('click', restoreDefaultCategories);
    }

    // Relatórios
    if(applyReportFilterBtn) applyReportFilterBtn.addEventListener('click', () => { if (reportsSection?.classList.contains('active')) { updateCharts(); showAlert("Filtro aplicado.", "info", 2000); }});
    if(exportReportCsvBtn) exportReportCsvBtn.addEventListener('click', exportReportDataToCsv);
    if(exportTransactionsCsvBtn) exportTransactionsCsvBtn.addEventListener('click', exportFilteredTransactionsToCsv);

    // Importação CSV
    if(importCsvBtn && importCsvInput) importCsvBtn.addEventListener('click', () => importCsvInput.click());
    if(importCsvInput) importCsvInput.addEventListener('change', handleCsvFileImport);
    if(confirmCsvImportBtn) confirmCsvImportBtn.addEventListener('click', processCsvImport);

    // '-- Adicionar Nova --' nos dropdowns
    [modalCategoryInput, editCategoryInput, recurringCategorySelect].filter(Boolean).forEach(select => { if (select) { select.addEventListener('change', (e) => { if (e.target.value === '--add-new--') { let type = 'expense'; if(e.target === modalCategoryInput) type = document.getElementById('modalType')?.value || 'expense'; else if(e.target === editCategoryInput) type = document.getElementById('editType')?.value || 'expense'; else if(e.target === recurringCategorySelect) type = recurringTypeSelect?.value || 'expense'; promptForNewCategory(type).then(newCat => { e.target.value = newCat || ''; }); } }); if (!select.querySelector('option[value="--add-new--"]')) { const addOption = new Option('-- Adicionar Nova --', '--add-new--'); addOption.classList.add('add-new-category-option'); select.appendChild(addOption); } } });

    // Anexos
    if (modalAttachmentTrigger && modalAttachmentInput) { modalAttachmentTrigger.addEventListener('click', () => modalAttachmentInput.click()); }
    if (modalAttachmentInput) { modalAttachmentInput.addEventListener('change', (event) => handleAttachmentSelection(event, modalAttachmentPreview, modalRemoveAttachmentBtn, modalAttachmentFilename, modalAttachmentTrigger, 'modalAttachmentDataUrlHidden')); }
    if (modalRemoveAttachmentBtn) { modalRemoveAttachmentBtn.addEventListener('click', () => handleRemoveAttachment(modalAttachmentInput, modalAttachmentPreview, modalRemoveAttachmentBtn, modalAttachmentFilename, modalAttachmentTrigger, 'modalAttachmentDataUrlHidden')); }
    if (editAttachmentTrigger && editAttachmentInput) { editAttachmentTrigger.addEventListener('click', () => editAttachmentInput.click()); }
    if (editAttachmentInput) { editAttachmentInput.addEventListener('change', (event) => handleAttachmentSelection(event, editAttachmentPreview, editRemoveAttachmentBtn, editAttachmentFilename, editAttachmentTrigger, 'editAttachmentDataUrlHidden')); }
    if (editRemoveAttachmentBtn) { editRemoveAttachmentBtn.addEventListener('click', () => handleRemoveAttachment(editAttachmentInput, editAttachmentPreview, editRemoveAttachmentBtn, editAttachmentFilename, editAttachmentTrigger, 'editAttachmentDataUrlHidden')); }

    console.log("Pro: Listeners Pro configurados.");
}

// --- Exporta funções necessárias ---
export {
    initProFeatures,
 
  
    
};