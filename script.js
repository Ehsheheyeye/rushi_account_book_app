document.addEventListener('DOMContentLoaded', () => {
    // --- Firebase Configuration ---
    // IMPORTANT: Replace this with your own Firebase project configuration!
    const firebaseConfig = {
        apiKey: "AIzaSyD_u4q6CH6IIP9iuSJ_ZbBFK6L_byTXLfA",
        authDomain: "account-book-rushi.firebaseapp.com",
        projectId: "account-book-rushi",
        storageBucket: "account-book-rushi.firebasestorage.app",
        messagingSenderId: "102100466470",
        appId: "1:102100466470:web:67204556eba94228011fe7",
        measurementId: "G-24WD42QHP2"
    };

    // --- Initialize Firebase and Firestore ---
    // NOTE: For a real app, you should implement Firebase Authentication and secure your database with Firestore Rules.
    // For this example, the database is open.
    firebase.initializeApp(firebaseConfig);
    const db = firebase.firestore();
    const transactionsCollection = db.collection('transactions');

    // --- Global Variables ---
    let localTransactions = []; // Local cache of transactions
    let suggestionDescriptions = ["Salary", "Groceries", "Food", "Transport", "Rent", "Bills", "Shopping"];
    let selectedType = null;
    let amountString = "0";
    let editMode = false;
    let currentUnsubscribe = null; // To hold the listener function

    // --- DOM Element References ---
    const balanceEl = document.getElementById('currentBalance');
    const totalIncomeEl = document.getElementById('totalIncome');
    const totalExpenseEl = document.getElementById('totalExpense');
    const transactionListEl = document.getElementById('transactionList');
    const loadingStateEl = document.getElementById('loadingState');
    const emptyStateEl = document.getElementById('emptyState');
    
    // Modals & Form
    const addTxModal = document.getElementById('addTxModal');
    const openModalBtn = document.getElementById('openAddTxModalBtn');
    const closeModalBtn = document.getElementById('closeAddTxModalBtn');
    const modalTitleEl = document.getElementById('modalTitle');
    const amountDisplayEl = document.getElementById('amountDisplay');
    const editTxIdInput = document.getElementById('editTxId');
    const descriptionInput = document.getElementById('description');
    const incomeBtn = document.getElementById('incomeBtn');
    const expenseBtn = document.getElementById('expenseBtn');
    const typeToggleWrapper = document.querySelector('.type-toggle-wrapper');
    const quickSuggestionsEl = document.getElementById('quickSuggestions');
    const numpadEl = document.getElementById('numpad');
    const notificationEl = document.getElementById('notification');

    // Search Modal
    const searchModal = document.getElementById('searchModal');
    const searchModalContent = document.getElementById('searchModalContent');
    const openSearchModalBtn = document.getElementById('openSearchModalBtn');
    const closeSearchModalBtn = document.getElementById('closeSearchModalBtn');
    const searchInput = document.getElementById('searchInput');
    const dateInput = document.getElementById('dateInput');
    const clearSearchBtn = document.getElementById('clearSearchBtn');

    // --- UI Rendering & Animations ---

    function updateUI(txList) {
        renderSummary(txList);
        renderTransactionList(txList);
        renderSuggestions();
    }

    function renderSummary(txList) {
        const totalIncome = txList.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
        const totalExpense = txList.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
        const balance = totalIncome - totalExpense;

        balanceEl.textContent = formatCurrency(balance);
        totalIncomeEl.textContent = formatCurrency(totalIncome);
        totalExpenseEl.textContent = formatCurrency(totalExpense);
    }

    function renderTransactionList(txList) {
        transactionListEl.innerHTML = ''; // Clear everything
        transactionListEl.append(loadingStateEl, emptyStateEl); // Re-append static elements
        
        loadingStateEl.classList.add('hidden'); // Hide loading state
        emptyStateEl.classList.toggle('hidden', txList.length > 0);

        // Sort transactions by timestamp (most recent first)
        const sortedTransactions = [...txList].sort((a, b) => b.timestamp - a.timestamp);

        sortedTransactions.forEach(tx => {
            const item = createTransactionElement(tx);
            transactionListEl.appendChild(item);
        });
    }

    function createTransactionElement(transaction) {
        const wrapper = document.createElement('div');
        wrapper.className = 'transaction-item-wrapper';
        wrapper.dataset.id = transaction.id;

        const item = document.createElement('div');
        item.className = 'transaction-item flex items-center justify-between p-3 bg-white rounded-xl shadow-sm border border-slate-200/80';
        
        const isIncome = transaction.type === 'income';
        const iconColor = isIncome ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600';
        const icon = isIncome 
            ? `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>`
            : `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M18 12H6" /></svg>`;

        // Convert Firestore timestamp to JS Date object if it's not already
        const txDate = transaction.timestamp.toDate ? transaction.timestamp.toDate() : transaction.timestamp;

        item.innerHTML = `
            <div class="flex items-center gap-3">
                <div class="h-11 w-11 flex items-center justify-center rounded-full ${iconColor}">${icon}</div>
                <div>
                    <p class="font-bold text-slate-800">${transaction.description}</p>
                    <p class="text-sm text-slate-500">${formatTimestamp(txDate)}</p>
                </div>
            </div>
            <p class="font-bold text-lg ${isIncome ? 'text-emerald-600' : 'text-rose-600'}">${formatCurrency(transaction.amount)}</p>
        `;

        const deleteAction = document.createElement('div');
        deleteAction.className = 'delete-action';
        deleteAction.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>`;
        
        const editAction = document.createElement('div');
        editAction.className = 'edit-action';
        editAction.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>`;

        wrapper.append(editAction, item, deleteAction);
        setupSwipeActions(wrapper);
        return wrapper;
    }

    function renderSuggestions() {
        quickSuggestionsEl.innerHTML = '';
        suggestionDescriptions.slice(0, 5).forEach(desc => {
            const chip = document.createElement('button');
            chip.type = 'button';
            chip.className = 'suggestion-chip';
            chip.textContent = desc;
            chip.addEventListener('click', () => { descriptionInput.value = desc; });
            quickSuggestionsEl.appendChild(chip);
        });
    }

    function renderNumpad() {
        numpadEl.innerHTML = '';
        const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫'];
        keys.forEach(key => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'numpad-btn';
            btn.textContent = key;
            btn.addEventListener('click', () => handleNumpad(key));
            numpadEl.appendChild(btn);
        });
        
        const saveBtn = document.createElement('button');
        saveBtn.type = 'button';
        saveBtn.id = 'saveTxBtn';
        saveBtn.className = 'numpad-btn numpad-save-btn col-span-4';
        saveBtn.textContent = 'Save Transaction';
        saveBtn.addEventListener('click', handleSaveTransaction);
        numpadEl.parentElement.appendChild(saveBtn);
    }

    // --- Firestore & Logic ---

    async function handleSaveTransaction() {
        const amount = parseFloat(amountString);
        const description = descriptionInput.value.trim();

        if (!selectedType) { showNotification("Please select transaction type (Income/Expense)."); return; }
        if (isNaN(amount) || amount <= 0) { showNotification("Please enter a valid amount."); return; }
        if (!description) { showNotification("Please enter a description."); return; }

        const txData = {
            type: selectedType,
            amount,
            description,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        };

        try {
            if (editMode) {
                const txId = editTxIdInput.value;
                // For edits, we don't update the timestamp
                delete txData.timestamp; 
                await transactionsCollection.doc(txId).update(txData);
                showNotification("Transaction updated successfully!", "success");
            } else {
                await transactionsCollection.add(txData);
                showNotification("Transaction added successfully!", "success");
            }
            
            addSuggestion(description);
            toggleModal(false);
        } catch (error) {
            console.error("Error saving transaction: ", error);
            showNotification("Error saving transaction. Please try again.");
        }
    }

    async function handleDeleteTransaction(id) {
        try {
            await transactionsCollection.doc(id).delete();
            // The onSnapshot listener will handle the UI update automatically
            showNotification("Transaction deleted.", "success");
        } catch (error) {
            console.error("Error deleting transaction: ", error);
            showNotification("Error deleting transaction.");
        }
    }

    function handleEdit(id) {
        const transaction = localTransactions.find(t => t.id === id);
        if (!transaction) return;

        editMode = true;
        modalTitleEl.textContent = 'Edit Transaction';
        editTxIdInput.value = transaction.id;
        amountString = String(transaction.amount);
        updateAmountDisplay();
        descriptionInput.value = transaction.description;
        selectType(transaction.type);
        toggleModal(true);
    }

    function fetchAndListenTransactions(query = transactionsCollection) {
        loadingStateEl.classList.remove('hidden');

        // Unsubscribe from the previous listener if it exists
        if (currentUnsubscribe) {
            currentUnsubscribe();
        }

        currentUnsubscribe = query.onSnapshot(snapshot => {
            localTransactions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            updateUI(localTransactions);
        }, error => {
            console.error("Error fetching transactions: ", error);
            showNotification("Could not fetch transactions.");
            loadingStateEl.classList.add('hidden');
        });
    }

    // --- Event Handlers & UI ---

    function addSuggestion(description) {
        const lowerCaseDesc = description.toLowerCase();
        if (!suggestionDescriptions.find(d => d.toLowerCase() === lowerCaseDesc)) {
            suggestionDescriptions.unshift(description);
        }
    }

    function selectType(type) {
        selectedType = type;
        incomeBtn.classList.toggle('active', type === 'income');
        expenseBtn.classList.toggle('active', type === 'expense');
        typeToggleWrapper.classList.remove('income', 'expense');
        if (type) {
            typeToggleWrapper.classList.add(type);
        }
    }

    function toggleModal(show) {
        if (show) {
            if (!editMode) { resetForm(); }
            addTxModal.classList.remove('translate-y-full');
        } else {
            addTxModal.classList.add('translate-y-full');
        }
    }
    
    function toggleSearchModal(show) {
        if (show) {
            searchModal.classList.remove('pointer-events-none', 'opacity-0');
            searchModalContent.classList.remove('translate-y-full');
        } else {
            searchModal.classList.add('pointer-events-none', 'opacity-0');
            searchModalContent.classList.add('translate-y-full');
        }
    }

    function resetForm() {
        editMode = false;
        modalTitleEl.textContent = 'New Transaction';
        editTxIdInput.value = '';
        descriptionInput.value = '';
        amountString = "0";
        updateAmountDisplay();
        selectType(null);
    }

    function handleNumpad(key) {
        if (key === '⌫') {
            amountString = amountString.length > 1 ? amountString.slice(0, -1) : '0';
        } else if (key === '.') {
            if (!amountString.includes('.')) { amountString += '.'; }
        } else {
            if (amountString === '0' && key !== '.') { amountString = key; } 
            else if (amountString.length < 9) { amountString += key; }
        }
        updateAmountDisplay();
    }
    
    function updateAmountDisplay() {
        amountDisplayEl.textContent = `₹${amountString}`;
    }

    function setupSwipeActions(wrapper) {
        let startX = 0, currentX = 0, isSwiping = false;
        const item = wrapper.querySelector('.transaction-item');

        item.addEventListener('touchstart', (e) => {
            startX = e.touches[0].clientX;
            isSwiping = true;
            item.style.transition = 'none';
        }, { passive: true });

        item.addEventListener('touchmove', (e) => {
            if (!isSwiping) return;
            currentX = e.touches[0].clientX - startX;
            if (Math.abs(currentX) < 120) { item.style.transform = `translateX(${currentX}px)`; }
        }, { passive: true });

        item.addEventListener('touchend', () => {
            isSwiping = false;
            item.style.transition = 'transform 0.3s ease';
            if (currentX < -40) { wrapper.className = 'transaction-item-wrapper swiped-left'; } 
            else if (currentX > 40) { wrapper.className = 'transaction-item-wrapper swiped-right'; } 
            else { wrapper.className = 'transaction-item-wrapper'; item.style.transform = ''; }
            currentX = 0;
        });

        wrapper.querySelector('.delete-action').addEventListener('click', () => { handleDeleteTransaction(wrapper.dataset.id); });
        wrapper.querySelector('.edit-action').addEventListener('click', () => { handleEdit(wrapper.dataset.id); });
    }
    
    function applySearch() {
        const searchTerm = searchInput.value.toLowerCase();
        const searchDate = dateInput.value;

        // The search now filters the local cache, which is updated in real-time
        const filtered = localTransactions.filter(tx => {
            const descMatch = tx.description.toLowerCase().includes(searchTerm);
            const txDate = tx.timestamp.toDate ? tx.timestamp.toDate() : tx.timestamp;
            const dateMatch = !searchDate || txDate.toISOString().split('T')[0] === searchDate;
            return descMatch && dateMatch;
        });
        updateUI(filtered);
    }

    // --- Utility Functions ---

    function formatCurrency(number) {
        return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(number);
    }
    
    function formatTimestamp(date) {
        return date.toLocaleString('en-US', { 
            year: 'numeric', month: 'short', day: 'numeric', 
            hour: 'numeric', minute: '2-digit', hour12: true 
        });
    }

    function showNotification(message, type = 'error') {
        const bgColor = type === 'success' ? 'bg-emerald-500' : 'bg-red-500';
        notificationEl.innerHTML = `<div class="${bgColor} text-white text-sm font-bold px-4 py-2 rounded-full shadow-lg">${message}</div>`;
        notificationEl.classList.remove('opacity-0', '-translate-y-20');
        setTimeout(() => { notificationEl.classList.add('opacity-0', '-translate-y-20'); }, 2500);
    }

    // --- Initial Setup & Listeners ---
    openModalBtn.addEventListener('click', () => { editMode = false; toggleModal(true); });
    closeModalBtn.addEventListener('click', () => toggleModal(false));
    
    expenseBtn.addEventListener('click', () => selectType('expense'));
    incomeBtn.addEventListener('click', () => selectType('income'));
    
    openSearchModalBtn.addEventListener('click', () => toggleSearchModal(true));
    closeSearchModalBtn.addEventListener('click', () => toggleSearchModal(false));
    
    // Search inputs now filter the local data, not re-querying Firestore
    searchInput.addEventListener('input', applySearch);
    dateInput.addEventListener('input', applySearch);
    clearSearchBtn.addEventListener('click', () => {
        searchInput.value = '';
        dateInput.value = '';
        updateUI(localTransactions); // Reset to show all local transactions
    });

    renderNumpad();
    fetchAndListenTransactions(); // Initial fetch and start listening for real-time updates
});
