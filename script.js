// --- APPLICATION STATE & CONFIG ---

const DEFAULT_RATES = {
    full: 200,
    half: 100,
    off: 0
};

const STORAGE_KEYS = {
    work: "mdf_work_records",
    payments: "mdf_payment_records",
    rates: "mdf_work_rates"
};

let workRates = loadRates();
let workRecords = loadData(STORAGE_KEYS.work);
let paymentRecords = loadData(STORAGE_KEYS.payments);

let activeTab = 'work';
let confirmResolver = null;

// DOM Elements
const workDateInput = document.getElementById("workDate");
const paymentDateInput = document.getElementById("paymentDate");
const paymentAmountInput = document.getElementById("paymentAmount");
const paymentMethodInput = document.getElementById("paymentMethod");
const paymentNotesInput = document.getElementById("paymentNotes");

const totalEarningsElement = document.getElementById("totalEarnings");
const totalReceivedElement = document.getElementById("totalReceived");
const remainingBalanceElement = document.getElementById("remainingBalance");
const workingDaysBadge = document.getElementById("workingDaysBadge");

const monthFilterSelect = document.getElementById("monthFilter");
const workHistoryTable = document.getElementById("workHistoryTable");
const paymentHistoryTable = document.getElementById("paymentHistoryTable");

// --- INIT APP ON WINDOW LOAD ---

window.onload = function () {
    document.getElementById("currentYear").textContent =
        new Date().getFullYear();

    document.getElementById("printDate").textContent =
        new Date().toLocaleDateString('en-IN', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

    // Set default date inputs to today
    workDateInput.value = getToday();
    paymentDateInput.value = getToday();

    updateRateLabels();
    populateMonthFilter();
    updateApp();
};

// --- HELPER UTILITIES ---

function getToday() {
    const today = new Date();

    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

function formatMoney(amount) {
    return "₹" + Number(amount || 0).toLocaleString("en-IN");
}

function formatDate(dateStr) {
    if (!dateStr) return "Unknown Date";

    const parts = dateStr.split("-");

    if (parts.length !== 3) return dateStr;

    return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function loadRates() {
    try {
        const saved = localStorage.getItem(STORAGE_KEYS.rates);

        return saved
            ? { ...DEFAULT_RATES, ...JSON.parse(saved) }
            : { ...DEFAULT_RATES };

    } catch (e) {
        return { ...DEFAULT_RATES };
    }
}

function loadData(key) {
    try {
        const savedData = localStorage.getItem(key);
        const parsedData = savedData ? JSON.parse(savedData) : [];

        return Array.isArray(parsedData) ? parsedData : [];

    } catch (error) {
        console.error("Unable to load saved data:", error);
        return [];
    }
}

function saveData() {
    try {
        localStorage.setItem(
            STORAGE_KEYS.work,
            JSON.stringify(workRecords)
        );

        localStorage.setItem(
            STORAGE_KEYS.payments,
            JSON.stringify(paymentRecords)
        );

        localStorage.setItem(
            STORAGE_KEYS.rates,
            JSON.stringify(workRates)
        );

        return true;

    } catch (error) {
        showToast(
            "Unable to save data. Browser storage error.",
            "error"
        );

        return false;
    }
}

function updateRateLabels() {
    document.getElementById("rateLabelFull").textContent =
        formatMoney(workRates.full);

    document.getElementById("rateLabelHalf").textContent =
        formatMoney(workRates.half);

    document.getElementById("btnFullLabel").textContent =
        formatMoney(workRates.full);

    document.getElementById("btnHalfLabel").textContent =
        formatMoney(workRates.half);
}

// --- TOAST NOTIFICATIONS ---

function showToast(message, type = "success") {
    const container = document.getElementById("toastContainer");
    const toast = document.createElement("div");

    const bgClass =
        type === "success"
            ? "bg-slate-900 text-white"
            : type === "error"
                ? "bg-rose-600 text-white"
                : "bg-blue-600 text-white";

    const icon =
        type === "success"
            ? "fa-circle-check text-emerald-400"
            : type === "error"
                ? "fa-circle-xmark text-white"
                : "fa-circle-info text-blue-200";

    toast.className =
        `flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl text-xs font-semibold ${bgClass} transition-all duration-300 transform translate-y-4 opacity-0 pointer-events-auto`;

    toast.innerHTML =
        `<i class="fa-solid ${icon} text-base"></i> <span>${message}</span>`;

    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.remove("translate-y-4", "opacity-0");
    }, 10);

    setTimeout(() => {
        toast.classList.add("opacity-0", "translate-y-2");

        setTimeout(() => toast.remove(), 300);

    }, 3000);
}

// --- CUSTOM CONFIRM MODAL ---

function customConfirm(title, message, btnText = "Delete") {
    return new Promise((resolve) => {
        confirmResolver = resolve;

        document.getElementById("confirmTitle").textContent = title;

        document.getElementById("confirmMessage").textContent = message;

        document.getElementById("confirmBtnAction").textContent = btnText;

        document.getElementById("confirmModal")
            .classList.remove("hidden");
    });
}

function closeConfirmModal(result) {
    document.getElementById("confirmModal")
        .classList.add("hidden");

    if (confirmResolver) {
        confirmResolver(result);
        confirmResolver = null;
    }
}

// --- POPULATE MONTH FILTER OPTIONS ---

function populateMonthFilter() {
    const months = new Set();

    workRecords.forEach(r => {
        if (r.date) months.add(r.date.substring(0, 7));
    });

    paymentRecords.forEach(p => {
        if (p.date) months.add(p.date.substring(0, 7));
    });

    const sortedMonths = Array.from(months).sort().reverse();

    const selectedVal = monthFilterSelect.value;

    monthFilterSelect.innerHTML =
        '<option value="all">All Time History</option>';

    sortedMonths.forEach(m => {
        const [year, month] = m.split("-");

        const dateObj = new Date(
            year,
            parseInt(month) - 1,
            1
        );

        const monthName = dateObj.toLocaleString('en-IN', {
            month: 'long',
            year: 'numeric'
        });

        const option = document.createElement("option");

        option.value = m;
        option.textContent = monthName;

        monthFilterSelect.appendChild(option);
    });

    if (
        Array.from(monthFilterSelect.options)
            .some(opt => opt.value === selectedVal)
    ) {
        monthFilterSelect.value = selectedVal;
    }
}

function filterRecords() {
    updateApp();
}

// --- WORK ATTENDANCE LOGIC ---

function addWork(type) {
    const date = workDateInput.value;

    if (!date) {
        showToast("Please select a date.", "error");
        return;
    }

    const existingIndex = workRecords.findIndex(
        r => r.date === date
    );

    if (existingIndex !== -1) {
        showToast(
            "Attendance already exists for this date.",
            "error"
        );

        return;
    }

    const amount =
        type === "full"
            ? workRates.full
            : type === "half"
                ? workRates.half
                : 0;

    const record = {
        id: Date.now().toString(),
        date: date,
        type: type,
        amount: amount,
        customLabel: ""
    };

    workRecords.push(record);

    if (saveData()) {
        populateMonthFilter();
        updateApp();

        showToast("Attendance added successfully!");
    }
}

function promptCustomWork() {
    document.getElementById("customWorkAmount").value = "";
    document.getElementById("customWorkLabel").value = "";

    document.getElementById("customWorkModal")
        .classList.remove("hidden");
}

function closeCustomWorkModal() {
    document.getElementById("customWorkModal")
        .classList.add("hidden");
}

function saveCustomWork() {
    const date = workDateInput.value;

    const amountVal =
        document.getElementById("customWorkAmount").value;

    const label =
        document.getElementById("customWorkLabel").value.trim();

    if (!date) {
        showToast("Please select a date.", "error");
        return;
    }

    if (
        amountVal === "" ||
        isNaN(amountVal) ||
        Number(amountVal) < 0
    ) {
        showToast("Please enter a valid amount.", "error");
        return;
    }

    const existingIndex = workRecords.findIndex(
        r => r.date === date
    );

    if (existingIndex !== -1) {
        showToast(
            "Attendance already recorded for this date.",
            "error"
        );

        return;
    }

    const record = {
        id: Date.now().toString(),
        date: date,
        type: "custom",
        amount: Number(amountVal),
        customLabel: label || "Custom Rate"
    };

    workRecords.push(record);

    if (saveData()) {
        closeCustomWorkModal();

        populateMonthFilter();
        updateApp();

        showToast("Custom attendance added!");
    }
}

// --- EDIT WORK RECORD ---

function openEditWorkModal(id) {
    const record = workRecords.find(
        item => item.id === id
    );

    if (!record) return;

    document.getElementById("editWorkId").value = record.id;

    document.getElementById("editWorkDate").value =
        record.date;

    document.getElementById("editWorkType").value =
        record.type;

    document.getElementById("editWorkAmount").value =
        record.amount;

    handleEditTypeChange();

    document.getElementById("editWorkModal")
        .classList.remove("hidden");
}

function handleEditTypeChange() {
    const type =
        document.getElementById("editWorkType").value;

    const container =
        document.getElementById("editCustomAmountContainer");

    if (type === "custom") {
        container.classList.remove("hidden");
    } else {
        container.classList.add("hidden");
    }
}

function closeEditWorkModal() {
    document.getElementById("editWorkModal")
        .classList.add("hidden");
}

function saveEditWork() {
    const id =
        document.getElementById("editWorkId").value;

    const record = workRecords.find(
        item => item.id === id
    );

    if (!record) return;

    const date =
        document.getElementById("editWorkDate").value;

    const type =
        document.getElementById("editWorkType").value;

    if (!date) {
        showToast("Invalid date.", "error");
        return;
    }

    // Check duplicate date if changed
    if (
        date !== record.date &&
        workRecords.some(r => r.date === date)
    ) {
        showToast(
            "Another attendance entry exists on this date.",
            "error"
        );

        return;
    }

    record.date = date;
    record.type = type;

    if (type === "full") {
        record.amount = workRates.full;

    } else if (type === "half") {
        record.amount = workRates.half;

    } else if (type === "off") {
        record.amount = 0;

    } else if (type === "custom") {
        const amt = Number(
            document.getElementById("editWorkAmount").value
        );

        record.amount = isNaN(amt) ? 0 : amt;
    }

    if (saveData()) {
        closeEditWorkModal();

        populateMonthFilter();
        updateApp();

        showToast("Attendance updated successfully!");
    }
}

async function deleteWork(id) {
    const confirmed = await customConfirm(
        "Delete Attendance?",
        "Are you sure you want to delete this attendance record?"
    );

    if (!confirmed) return;

    workRecords = workRecords.filter(
        record => record.id !== id
    );

    if (saveData()) {
        populateMonthFilter();
        updateApp();

        showToast("Attendance entry deleted.");
    }
}

// --- PAYMENT LOGIC ---

function handlePaymentSubmit(e) {
    e.preventDefault();

    const date = paymentDateInput.value;

    const amount = Number(paymentAmountInput.value);

    const method = paymentMethodInput.value;

    const notes = paymentNotesInput.value.trim();

    if (!date) {
        showToast("Please select payment date.", "error");
        return;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
        showToast("Please enter a valid amount.", "error");
        return;
    }

    const payment = {
        id: Date.now().toString(),
        date: date,
        amount: amount,
        method: method,
        notes: notes
    };

    paymentRecords.push(payment);

    if (saveData()) {
        paymentAmountInput.value = "";
        paymentNotesInput.value = "";

        populateMonthFilter();
        updateApp();

        showToast("Payment recorded successfully!");
    }
}

async function deletePayment(id) {
    const confirmed = await customConfirm(
        "Delete Payment Record?",
        "Are you sure you want to remove this payment entry?"
    );

    if (!confirmed) return;

    paymentRecords = paymentRecords.filter(
        p => p.id !== id
    );

    if (saveData()) {
        populateMonthFilter();
        updateApp();

        showToast("Payment record deleted.");
    }
}

// --- TAB SWITCHING ---

function switchTab(tab) {
    activeTab = tab;

    const btnWork =
        document.getElementById("tabBtnWork");

    const btnPayment =
        document.getElementById("tabBtnPayment");

    const contentWork =
        document.getElementById("tabContentWork");

    const contentPayment =
        document.getElementById("tabContentPayment");

    if (tab === 'work') {
        btnWork.className =
            "px-4 py-2 rounded-xl font-bold text-sm transition bg-white text-blue-600 shadow-sm border border-slate-200 flex items-center gap-2";

        btnPayment.className =
            "px-4 py-2 rounded-xl font-semibold text-sm transition text-slate-600 hover:bg-slate-100 flex items-center gap-2";

        contentWork.classList.remove("hidden");
        contentPayment.classList.add("hidden");

    } else {
        btnPayment.className =
            "px-4 py-2 rounded-xl font-bold text-sm transition bg-white text-emerald-600 shadow-sm border border-slate-200 flex items-center gap-2";

        btnWork.className =
            "px-4 py-2 rounded-xl font-semibold text-sm transition text-slate-600 hover:bg-slate-100 flex items-center gap-2";

        contentPayment.classList.remove("hidden");
        contentWork.classList.add("hidden");
    }

    handleSearch();
}

// --- DASHBOARD CALCULATIONS & RENDERING ---

function getFilteredData() {
    const filterVal = monthFilterSelect.value;

    if (filterVal === "all") {
        return {
            filteredWork: workRecords,
            filteredPayments: paymentRecords
        };
    }

    const filteredWork = workRecords.filter(
        r => r.date && r.date.startsWith(filterVal)
    );

    const filteredPayments = paymentRecords.filter(
        p => p.date && p.date.startsWith(filterVal)
    );

    return {
        filteredWork,
        filteredPayments
    };
}

function updateDashboard(filteredWork, filteredPayments) {
    const totalEarnings = filteredWork.reduce(
        (acc, r) => acc + Number(r.amount || 0),
        0
    );

    const totalReceived = filteredPayments.reduce(
        (acc, p) => acc + Number(p.amount || 0),
        0
    );

    const remainingBalance =
        totalEarnings - totalReceived;

    const fullCount = filteredWork.filter(
        r => r.type === "full"
    ).length;

    const halfCount = filteredWork.filter(
        r => r.type === "half"
    ).length;

    const offCount = filteredWork.filter(
        r => r.type === "off"
    ).length;

    const customCount = filteredWork.filter(
        r => r.type === "custom"
    ).length;

    const totalWorkingDays =
        fullCount + (halfCount * 0.5) + customCount;

    totalEarningsElement.textContent =
        formatMoney(totalEarnings);

    totalReceivedElement.textContent =
        formatMoney(totalReceived);

    remainingBalanceElement.textContent =
        formatMoney(remainingBalance);

    workingDaysBadge.textContent =
        `${totalWorkingDays} Active Days`;

    // Balance Indicator Status

    const statusText =
        document.getElementById("balanceStatusText");

    const iconContainer =
        document.getElementById("balanceIconContainer");

    if (remainingBalance > 0) {
        statusText.textContent = "Pending payment";

        statusText.className =
            "text-xs text-amber-600 font-medium mt-1";

        iconContainer.className =
            "w-8 h-8 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center";

    } else if (remainingBalance === 0) {
        statusText.textContent = "Fully Settled";

        statusText.className =
            "text-xs text-emerald-600 font-medium mt-1";

        iconContainer.className =
            "w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center";

    } else {
        statusText.textContent = "Advance Received";

        statusText.className =
            "text-xs text-blue-600 font-medium mt-1";

        iconContainer.className =
            "w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center";
    }

    // Stats breakdown

    document.getElementById("statFullCount").textContent =
        fullCount;

    document.getElementById("statHalfCount").textContent =
        halfCount;

    document.getElementById("statOffCount").textContent =
        offCount;

    const totalShifts = filteredWork.length || 1;

    document.getElementById("barFull").style.width =
        `${(fullCount / totalShifts) * 100}%`;

    document.getElementById("barHalf").style.width =
        `${(halfCount / totalShifts) * 100}%`;

    document.getElementById("barOff").style.width =
        `${(offCount / totalShifts) * 100}%`;
}

// --- RENDER WORK HISTORY ---

function renderWorkHistory(records) {
    document.getElementById("badgeWorkCount").textContent =
        records.length;

    if (records.length === 0) {
        workHistoryTable.innerHTML = `
            <tr>
                <td colspan="4" class="py-8 text-center text-slate-400 text-xs">
                    <i class="fa-solid fa-folder-open text-2xl mb-2 block"></i>
                    No attendance records found for this period.
                </td>
            </tr>
        `;

        return;
    }

    const sorted = [...records].sort(
        (a, b) => b.date.localeCompare(a.date)
    );

    workHistoryTable.innerHTML = sorted.map(r => {
        let badgeHTML = '';

        if (r.type === 'full') {
            badgeHTML = `
                <span class="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-md text-xs font-semibold">
                    <i class="fa-solid fa-briefcase text-[10px]"></i>
                    Full Day
                </span>
            `;

        } else if (r.type === 'half') {
            badgeHTML = `
                <span class="inline-flex items-center gap-1 bg-amber-50 text-amber-700 px-2.5 py-1 rounded-md text-xs font-semibold">
                    <i class="fa-solid fa-business-time text-[10px]"></i>
                    Half Day
                </span>
            `;

        } else if (r.type === 'off') {
            badgeHTML = `
                <span class="inline-flex items-center gap-1 bg-slate-100 text-slate-600 px-2.5 py-1 rounded-md text-xs font-semibold">
                    <i class="fa-solid fa-bed text-[10px]"></i>
                    Off Day
   
