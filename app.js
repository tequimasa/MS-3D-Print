// Configuration Supabase
const supabaseUrl = 'https://gcteqsvtbnprlndaldvf.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdjdGVxc3Z0Ym5wcmxuZGFsZHZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkzNjk5OTYsImV4cCI6MjA5NDk0NTk5Nn0.r7QHqwhbJwRAnrDjIWVgBd9q0Erlr9vpEQl3M2YpF1U';
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

// State Management
let settings = {
    tvaRate: 20 // Default
};
let products = [];
let quotes = [];
let orders = [];
let invoices = [];
let editingProductId = null;

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    loadData();
    initNavigation();
    initForms();
    initTheme();
    initLibraryActions();
});

// Load from Supabase
async function loadData() {
    try {
        const { data: dbResult, error } = await supabase.from('app_data').select('data').eq('id', 1).single();
        
        if (error && error.code !== 'PGRST116') {
            throw error;
        }

        const data = dbResult?.data || {};
        
        settings = { ...settings, ...data.settings };
        products = data.products || [];
        quotes = data.quotes || [];
        orders = data.orders || [];
        invoices = data.invoices || [];

        // Populate Settings Form
        if (settings.elecPrice) document.getElementById('set-elec-price').value = settings.elecPrice;
        if (settings.machinePower) document.getElementById('set-machine-power').value = settings.machinePower;
        if (settings.laborRate) document.getElementById('set-labor-rate').value = settings.laborRate;
        if (settings.machineHourlyCost) document.getElementById('set-machine-cost').value = settings.machineHourlyCost;
        if (settings.margin) document.getElementById('set-margin').value = settings.margin;
        if (settings.tvaRate) document.getElementById('set-tva').value = settings.tvaRate;

        renderProductList();
        renderQuoteList();
        renderOrderList();
        renderInvoiceList();
    } catch (error) {
        console.error('Erreur lors du chargement des données Supabase:', error);
    }
}

// Save to Supabase
async function syncData() {
    try {
        const payload = { settings, products, quotes, orders, invoices };
        
        const { error } = await supabase
            .from('app_data')
            .upsert({ id: 1, data: payload });

        if (error) throw error;
    } catch (error) {
        console.error('Erreur lors de la sauvegarde Supabase:', error);
    }
}

// Navigation
function initNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    const views = document.querySelectorAll('.view');

    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const viewId = item.getAttribute('data-view');
            
            navItems.forEach(i => i.classList.remove('active'));
            item.classList.add('active');

            views.forEach(v => {
                v.classList.remove('active');
                if (v.id === `view-${viewId}`) v.classList.add('active');
            });

            // Reset editing state if leaving calculator
            if (viewId !== 'calculator') {
                resetCalculator();
            }
            
            // Refresh lists when switching
            if (viewId === 'quotes') renderQuoteList();
            if (viewId === 'orders') renderOrderList();
            if (viewId === 'invoices') renderInvoiceList();
        });
    });
}

function resetCalculator() {
    editingProductId = null;
    document.getElementById('calc-form').reset();
    document.getElementById('save-product').textContent = 'Sauvegarder';
    document.getElementById('result-display').innerHTML = '<div class="result-placeholder">Entrez les paramètres pour voir le résultat.</div>';
}

// Theme Toggle
function initTheme() {
    const toggle = document.getElementById('toggle-theme');
    const html = document.documentElement;
    
    const savedTheme = localStorage.getItem('ag_3d_theme') || 'dark';
    html.setAttribute('data-theme', savedTheme);

    toggle.addEventListener('click', () => {
        const current = html.getAttribute('data-theme');
        const next = current === 'dark' ? 'light' : 'dark';
        html.setAttribute('data-theme', next);
        localStorage.setItem('ag_3d_theme', next);
    });
}

// Forms & Calculation
function initForms() {
    const calcForm = document.getElementById('calc-form');
    const settingsForm = document.getElementById('settings-form');

    calcForm.addEventListener('submit', (e) => {
        e.preventDefault();
        calculateAndDisplay();
    });

    settingsForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        settings.elecPrice = parseFloat(document.getElementById('set-elec-price').value);
        settings.machinePower = parseFloat(document.getElementById('set-machine-power').value);
        settings.laborRate = parseFloat(document.getElementById('set-labor-rate').value);
        settings.machineHourlyCost = parseFloat(document.getElementById('set-machine-cost').value);
        settings.margin = parseFloat(document.getElementById('set-margin').value);
        settings.tvaRate = parseFloat(document.getElementById('set-tva').value);
        
        await syncData();
        alert('Paramètres enregistrés sur le serveur !');
    });

    document.getElementById('save-product').addEventListener('click', async () => {
        const result = calculateCosts();
        if (!result) return;

        const partName = document.getElementById('part-name').value;
        if (!partName) {
            alert('Veuillez donner un nom à la pièce.');
            return;
        }

        const productData = {
            name: partName,
            ...result,
            date: new Date().toLocaleDateString('fr-FR')
        };

        if (editingProductId) {
            const index = products.findIndex(p => p.id === editingProductId);
            products[index] = { ...products[index], ...productData };
            alert('Produit mis à jour !');
        } else {
            productData.id = Date.now();
            products.push(productData);
            alert('Produit sauvegardé !');
        }

        await syncData();
        renderProductList();
        resetCalculator();
        
        // Go to library
        document.querySelector('[data-view="library"]').click();
    });
}

function initLibraryActions() {
    document.getElementById('select-all').addEventListener('change', (e) => {
        const checks = document.querySelectorAll('.product-check');
        checks.forEach(c => c.checked = e.target.checked);
    });

    document.getElementById('multi-quote-btn').addEventListener('click', () => {
        const selectedIds = Array.from(document.querySelectorAll('.product-check:checked'))
                                 .map(c => parseInt(c.value));
        
        if (selectedIds.length === 0) {
            alert('Veuillez sélectionner au moins un produit.');
            return;
        }

        showMultiQuote(selectedIds);
    });
}

function calculateCosts() {
    const weightPerUnit = parseFloat(document.getElementById('part-weight').value);
    const timeStrPerUnit = document.getElementById('print-time').value;
    const timePerUnit = parseTimeToHours(timeStrPerUnit);
    const quantity = parseInt(document.getElementById('part-qty').value) || 1;
    
    const filamentPrice = parseFloat(document.getElementById('filament-price').value);
    const prepTimeTotal = parseFloat(document.getElementById('prep-time').value);
    const postTimeTotal = parseFloat(document.getElementById('post-time').value);

    if (isNaN(weightPerUnit) || isNaN(timePerUnit)) return null;

    // Totals for the batch
    const totalWeight = weightPerUnit * quantity;
    const totalTimeHours = timePerUnit * quantity;

    // Costs Breakdown
    const materialCost = (filamentPrice / 1000) * totalWeight;
    const elecCost = (settings.machinePower / 1000) * totalTimeHours * settings.elecPrice;
    const laborCost = ((prepTimeTotal + postTimeTotal) / 60) * settings.laborRate;
    const machineCost = settings.machineHourlyCost * totalTimeHours;
    
    const totalCostPrice = materialCost + elecCost + laborCost + machineCost;
    const totalMarginAmount = totalCostPrice * (settings.margin / 100);
    
    const totalHT = totalCostPrice + totalMarginAmount;
    const tvaAmount = totalHT * (settings.tvaRate / 100);
    const totalTTC = totalHT + tvaAmount;
    
    const unitPriceHT = totalHT / quantity;
    const unitPriceTTC = totalTTC / quantity;

    return {
        weightPerUnit, timeStrPerUnit, quantity,
        totalWeight, totalTimeHours,
        filamentPrice, prepTimeTotal, postTimeTotal,
        materialCost, elecCost, laborCost, machineCost,
        totalCostPrice, totalMarginAmount, 
        totalHT, tvaAmount, totalTTC, unitPriceHT, unitPriceTTC,
        tvaRateUsed: settings.tvaRate
    };
}

function parseTimeToHours(timeStr) {
    if (!timeStr) return 0;
    const parts = timeStr.split(':').map(Number);
    if (parts.length !== 3) return 0;
    const [h, m, s] = parts;
    return h + (m / 60) + (s / 3600);
}

function formatHoursToTime(hours) {
    const h = Math.floor(hours);
    const m = Math.floor((hours * 60) % 60);
    const s = Math.round((hours * 3600) % 60);
    return [h, m, s].map(v => v.toString().padStart(2, '0')).join(':');
}

function calculateAndDisplay() {
    const res = calculateCosts();
    if (!res) return;

    const display = document.getElementById('result-display');
    display.innerHTML = `
        <div class="result-item">
            <span>Matière (${res.totalWeight.toFixed(1)}g total @ ${res.filamentPrice}€/kg)</span>
            <span>${res.materialCost.toFixed(2)} €</span>
        </div>
        <div class="result-item">
            <span>Électricité (${formatHoursToTime(res.totalTimeHours)} total @ ${settings.elecPrice}€/kWh)</span>
            <span>${res.elecCost.toFixed(2)} €</span>
        </div>
        <div class="result-item">
            <span>Main d'œuvre (Prépa + Post @ ${settings.laborRate}€/h)</span>
            <span>${res.laborCost.toFixed(2)} €</span>
        </div>
        <div class="result-item">
            <span>Amortissement Machine (@ ${settings.machineHourlyCost}€/h)</span>
            <span>${res.machineCost.toFixed(2)} €</span>
        </div>
        <div class="result-item" style="border-top: 1px solid var(--card-border); margin-top: 0.5rem; padding-top: 0.5rem; font-style: italic; color: var(--text-secondary);">
            <span>Sous-total (Coût de revient)</span>
            <span>${res.totalCostPrice.toFixed(2)} €</span>
        </div>
        <div class="result-item" style="color: var(--accent-color);">
            <span>Marge Bénéficiaire (${settings.margin}%)</span>
            <span>+ ${res.totalMarginAmount.toFixed(2)} €</span>
        </div>
        <div class="result-item" style="font-weight: 600; border-top: 1px solid var(--accent-color); margin-top: 0.5rem; padding-top: 0.5rem;">
            <span>Total HT (Prix de vente)</span>
            <span>${res.totalHT.toFixed(2)} €</span>
        </div>
        <div class="result-item">
            <span>TVA (${res.tvaRateUsed}%)</span>
            <span>${res.tvaAmount.toFixed(2)} €</span>
        </div>
        <div class="result-item total">
            <span>Total TTC</span>
            <span>${res.totalTTC.toFixed(2)} €</span>
        </div>
        <p style="font-size: 0.8rem; opacity: 0.8; text-align: right; margin-top: 5px;">Soit ${res.unitPriceTTC.toFixed(2)} € TTC / pièce</p>
    `;
}

// Product List / Library
function renderProductList() {
    const body = document.getElementById('product-list-body');
    body.innerHTML = '';

    products.slice().reverse().forEach(p => {
        const tr = document.createElement('tr');
        const displayTime = p.timeStrPerUnit || formatHoursToTime(p.timePerUnit || p.time);
        tr.innerHTML = `
            <td><input type="checkbox" class="product-check" value="${p.id}"></td>
            <td><strong>${p.name}</strong><br><small>${p.date}</small></td>
            <td>${p.weightPerUnit || p.weight}g x ${p.quantity || 1}<br><small>${displayTime} / pc</small></td>
            <td>${(p.totalTTC || p.totalSalePrice).toFixed(2)} €</td>
            <td style="display: flex; gap: 4px; flex-wrap: wrap;">
                <button onclick="editProduct(${p.id})" class="btn btn-secondary btn-sm" style="margin:0; padding: 4px 8px; font-size: 0.75rem;">Editer</button>
                <button onclick="showMultiQuote([${p.id}])" class="btn btn-secondary btn-sm" style="margin:0; padding: 4px 8px; font-size: 0.75rem;">Devis</button>
                <button onclick="deleteProduct(${p.id})" class="btn btn-danger btn-sm" style="margin:0; padding: 4px 8px; font-size: 0.75rem; background: var(--danger-color); color:white;">Suppr.</button>
            </td>
        `;
        body.appendChild(tr);
    });
}

function editProduct(id) {
    const p = products.find(prod => prod.id === id);
    if (!p) return;

    editingProductId = id;
    
    document.getElementById('part-name').value = p.name;
    document.getElementById('part-weight').value = p.weightPerUnit || p.weight;
    document.getElementById('print-time').value = p.timeStrPerUnit || formatHoursToTime(p.timePerUnit || p.time);
    document.getElementById('part-qty').value = p.quantity || 1;
    document.getElementById('filament-price').value = p.filamentPrice || 25;
    document.getElementById('prep-time').value = p.prepTimeTotal || 0;
    document.getElementById('post-time').value = p.postTimeTotal || 0;

    document.getElementById('save-product').textContent = 'Mettre à jour';
    document.querySelector('[data-view="calculator"]').click();
    calculateAndDisplay();
}

async function deleteProduct(id) {
    if (confirm('Supprimer ce produit ?')) {
        products = products.filter(p => p.id !== id);
        await syncData();
        renderProductList();
    }
}

// Rendering Lists for New Tabs
function renderQuoteList() {
    const body = document.getElementById('quote-list-body');
    body.innerHTML = '';
    quotes.slice().reverse().forEach(q => {
        const statusClass = q.status === 'Ordered' ? 'badge-success' : 'badge-accent';
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>#DE-${q.id.toString().slice(-6)}</td>
            <td>${q.date}</td>
            <td>${q.items.map(i => i.name).join(', ')}</td>
            <td>${q.totalTTC.toFixed(2)} €</td>
            <td><span class="badge ${statusClass}">${q.status === 'Ordered' ? 'Validé' : 'En attente'}</span></td>
            <td style="display: flex; gap: 4px; flex-wrap: wrap;">
                <button onclick="viewQuote(${q.id})" class="btn btn-secondary btn-sm" style="margin:0; padding:2px 6px; font-size:0.7rem;">Voir</button>
                <button onclick="editDocument('quotes', ${q.id})" class="btn btn-secondary btn-sm" style="margin:0; padding:2px 6px; font-size:0.7rem;">Modifier</button>
                ${q.status !== 'Ordered' ? `<button onclick="convertToOrder(${q.id})" class="btn btn-primary btn-sm" style="margin:0; padding:2px 6px; font-size:0.7rem;">Commander</button>` : ''}
                <button onclick="deleteItem('quotes', ${q.id})" class="btn btn-danger btn-sm" style="margin:0; padding:2px 6px; font-size:0.7rem; background: var(--danger-color);">Suppr</button>
            </td>
        `;
        body.appendChild(tr);
    });
}

function renderOrderList() {
    const body = document.getElementById('order-list-body');
    body.innerHTML = '';
    orders.slice().reverse().forEach(o => {
        const statusClass = o.status === 'Invoiced' ? 'badge-success' : 'badge-accent';
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>#CO-${o.id.toString().slice(-6)}</td>
            <td>${o.date}</td>
            <td>${o.totalTTC.toFixed(2)} €</td>
            <td><span class="badge ${statusClass}">${o.status === 'Invoiced' ? 'Facturé' : 'En production'}</span></td>
            <td style="display: flex; gap: 4px; flex-wrap: wrap;">
                <button onclick="viewQuoteFromOrder(${o.id})" class="btn btn-secondary btn-sm" style="margin:0; padding:2px 6px; font-size:0.7rem;">Détails</button>
                <button onclick="editDocument('orders', ${o.id})" class="btn btn-secondary btn-sm" style="margin:0; padding:2px 6px; font-size:0.7rem;">Modifier</button>
                ${o.status !== 'Invoiced' ? `<button onclick="convertToInvoice(${o.id})" class="btn btn-primary btn-sm" style="margin:0; padding:2px 6px; font-size:0.7rem;">Facturer</button>` : ''}
                <button onclick="deleteItem('orders', ${o.id})" class="btn btn-danger btn-sm" style="margin:0; padding:2px 6px; font-size:0.7rem; background: var(--danger-color);">Suppr</button>
            </td>
        `;
        body.appendChild(tr);
    });
}

function renderInvoiceList() {
    const body = document.getElementById('invoice-list-body');
    body.innerHTML = '';
    invoices.slice().reverse().forEach(f => {
        const statusClass = f.paid ? 'badge-success' : 'badge-accent';
        const tr = document.createElement('tr');
        tr.style.opacity = f.paid ? '0.7' : '1';
        tr.innerHTML = `
            <td>#FA-${f.id.toString().slice(-6)}</td>
            <td>${f.date}</td>
            <td>${f.totalTTC.toFixed(2)} €</td>
            <td><span class="badge ${statusClass}">${f.paid ? 'Payée' : 'Impayée'}</span></td>
            <td style="display: flex; gap: 4px; flex-wrap: wrap;">
                <button onclick="viewInvoice(${f.id})" class="btn btn-secondary btn-sm" style="margin:0; padding:2px 6px; font-size:0.7rem;">Voir</button>
                <button onclick="editDocument('invoices', ${f.id})" class="btn btn-secondary btn-sm" style="margin:0; padding:2px 6px; font-size:0.7rem;">Modifier</button>
                <button onclick="togglePaid(${f.id})" class="btn btn-secondary btn-sm" style="margin:0; padding:2px 6px; font-size:0.7rem;">${f.paid ? 'Annuler' : 'Payée'}</button>
                <button onclick="deleteItem('invoices', ${f.id})" class="btn btn-danger btn-sm" style="margin:0; padding:2px 6px; font-size:0.7rem; background: var(--danger-color);">Suppr</button>
            </td>
        `;
        body.appendChild(tr);
    });
}

// Workflow Logic
async function saveQuote(qData) {
    const quote = {
        id: Date.now(),
        date: new Date().toLocaleDateString('fr-FR'),
        status: 'Pending',
        ...qData
    };
    quotes.push(quote);
    await syncData();
    renderQuoteList();
    alert('Devis enregistré !');
}

async function convertToOrder(quoteId) {
    const qIndex = quotes.findIndex(q => q.id === quoteId);
    if (qIndex === -1) return;
    
    quotes[qIndex].status = 'Ordered';
    const order = {
        id: Date.now(),
        quoteId: quoteId,
        date: new Date().toLocaleDateString('fr-FR'),
        status: 'Pending',
        ...quotes[qIndex]
    };
    orders.push(order);
    await syncData();
    renderQuoteList();
    renderOrderList();
    alert('Commande créée !');
}

async function convertToInvoice(orderId) {
    const oIndex = orders.findIndex(o => o.id === orderId);
    if (oIndex === -1) return;
    
    orders[oIndex].status = 'Invoiced';
    const invoice = {
        id: Date.now(),
        orderId: orderId,
        date: new Date().toLocaleDateString('fr-FR'),
        paid: false,
        ...orders[oIndex]
    };
    invoices.push(invoice);
    await syncData();
    renderOrderList();
    renderInvoiceList();
    alert('Facture créée !');
}

async function togglePaid(invoiceId) {
    const fIndex = invoices.findIndex(f => f.id === invoiceId);
    if (fIndex === -1) return;
    invoices[fIndex].paid = !invoices[fIndex].paid;
    await syncData();
    renderInvoiceList();
}

async function deleteItem(type, id) {
    if (!confirm('Supprimer cet élément ?')) return;
    if (type === 'quotes') quotes = quotes.filter(i => i.id !== id);
    if (type === 'orders') orders = orders.filter(i => i.id !== id);
    if (type === 'invoices') invoices = invoices.filter(i => i.id !== id);
    await syncData();
    if (type === 'quotes') renderQuoteList();
    if (type === 'orders') renderOrderList();
    if (type === 'invoices') renderInvoiceList();
}

// Modal logic update
function showMultiQuote(productIds) {
    const selectedProducts = products.filter(p => productIds.includes(p.id));
    if (selectedProducts.length === 0) return;

    let totalHT = 0;
    let quoteItems = [];

    selectedProducts.forEach(p => {
        const itemHT = p.totalHT || (p.totalSalePrice / 1.2);
        totalHT += itemHT;
        quoteItems.push({ 
            name: p.name, 
            quantity: p.quantity, 
            unitPriceHT: itemHT / p.quantity,
            totalHT: itemHT,
            tvaRate: p.tvaRateUsed || settings.tvaRate
        });
    });

    const totalTVA = totalHT * (settings.tvaRate / 100);
    const totalTTC = totalHT + totalTVA;

    renderStaticModal({ items: quoteItems, totalHT, totalTTC, tvaRate: settings.tvaRate, date: new Date().toLocaleDateString('fr-FR'), id: Date.now() }, 'DEVIS', true);
}

function viewQuote(id) {
    const q = quotes.find(quote => quote.id === id);
    if (!q) return;
    renderStaticModal(q, 'DEVIS');
}

function viewQuoteFromOrder(id) {
    const o = orders.find(order => order.id === id);
    if (!o) return;
    renderStaticModal(o, 'COMMANDE');
}

function viewInvoice(id) {
    const f = invoices.find(invoice => invoice.id === id);
    if (!f) return;
    renderStaticModal(f, 'FACTURE');
}

function editDocument(type, id) {
    let doc;
    if (type === 'quotes') doc = quotes.find(q => q.id === id);
    if (type === 'orders') doc = orders.find(o => o.id === id);
    if (type === 'invoices') doc = invoices.find(f => f.id === id);
    
    if (!doc) return;

    const modal = document.getElementById('quote-modal');
    const content = document.getElementById('quote-printable');

    renderEditDocForm(type, doc);
    modal.style.display = 'block';
}

function renderEditDocForm(type, doc) {
    const content = document.getElementById('quote-printable');
    
    let itemsHtml = '';
    doc.items.forEach((item, index) => {
        itemsHtml += `
            <div class="result-item" style="padding: 12px; border: 1px solid var(--card-border); border-radius: 8px; margin-bottom: 0.8rem; background: var(--bg-primary);">
                <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                    <div style="flex: 1;">
                        <strong style="font-size: 1rem;">${item.name}</strong><br>
                        <small style="color: var(--text-secondary);">Qté: ${item.quantity} | Total HT: ${item.totalHT.toFixed(2)} €</small>
                    </div>
                    <button onclick="removeItemFromDoc('${type}', ${doc.id}, ${index})" 
                            class="btn btn-danger" 
                            style="margin: 0; padding: 6px 12px; min-width: 40px; background: #ef4444; color: white; border: none; border-radius: 4px; font-weight: bold; cursor: pointer;">
                        Supprimer
                    </button>
                </div>
            </div>
        `;
    });

    let libraryOptions = products.map(p => `<option value="${p.id}">${p.name} (${(p.totalHT/p.quantity).toFixed(2)}€ HT/pc)</option>`).join('');

    content.innerHTML = `
        <h3>Modifier ${type === 'quotes' ? 'le Devis' : (type === 'orders' ? 'la Commande' : 'la Facture')}</h3>
        <p>Réf: ${doc.id}</p>
        
        <div style="margin-bottom: 1.5rem;">
            <h4>Produits inclus :</h4>
            ${itemsHtml}
            ${doc.items.length === 0 ? '<p style="font-style: italic; opacity: 0.7;">Aucun produit.</p>' : ''}
        </div>

        <div style="margin-bottom: 1.5rem; padding: 1rem; background: var(--bg-secondary); border-radius: 8px;">
            <label>Ajouter un produit de la bibliothèque :</label>
            <div style="display: flex; gap: 0.5rem; margin-top: 0.5rem;">
                <select id="add-item-select" style="flex: 1; padding: 8px; border-radius: 4px; background: var(--bg-primary); color: var(--text-primary); border: 1px solid var(--card-border);">
                    <option value="">-- Sélectionner --</option>
                    ${libraryOptions}
                </select>
                <button onclick="addItemToDoc('${type}', ${doc.id})" class="btn btn-primary" style="margin:0;">Ajouter</button>
            </div>
        </div>

        ${(type === 'orders' || type === 'invoices') ? `
            <div class="form-group" style="margin-bottom: 1.5rem;">
                <label>Numéro de commande client :</label>
                <input type="text" id="doc-cust-ref" value="${doc.customerOrderRef || ''}" placeholder="Ex: BC-2024-001" style="width: 100%; padding: 8px; border-radius: 4px; background: var(--bg-primary); color: var(--text-primary); border: 1px solid var(--card-border);">
            </div>
        ` : ''}

        <div class="no-print" style="margin-top: 2rem; border-top: 1px solid var(--card-border); padding-top: 1rem; display: flex; gap: 1rem;">
            <button onclick="saveDocEdits('${type}', ${doc.id})" class="btn btn-primary">Enregistrer les modifications</button>
            <button onclick="document.getElementById('quote-modal').style.display='none'" class="btn btn-secondary">Annuler</button>
        </div>
    `;
}

async function addItemToDoc(type, docId) {
    const productId = parseInt(document.getElementById('add-item-select').value);
    if (!productId) return;

    const p = products.find(prod => prod.id === productId);
    if (!p) return;

    let list = type === 'quotes' ? quotes : (type === 'orders' ? orders : invoices);
    const doc = list.find(d => d.id === docId);
    
    doc.items.push({
        name: p.name,
        quantity: p.quantity,
        unitPriceHT: p.unitPriceHT || (p.totalHT / p.quantity),
        totalHT: p.totalHT,
        tvaRate: p.tvaRateUsed || settings.tvaRate
    });

    recalculateDocTotals(doc);
    renderEditDocForm(type, doc);
}

function removeItemFromDoc(type, docId, index) {
    let list = type === 'quotes' ? quotes : (type === 'orders' ? orders : invoices);
    const doc = list.find(d => d.id === docId);
    doc.items.splice(index, 1);
    recalculateDocTotals(doc);
    renderEditDocForm(type, doc);
}

function recalculateDocTotals(doc) {
    doc.totalHT = doc.items.reduce((sum, item) => sum + item.totalHT, 0);
    // Use the first item's TVA rate or default if multiple
    const rate = doc.items.length > 0 ? doc.items[0].tvaRate : settings.tvaRate;
    doc.tvaRate = rate;
    doc.totalTTC = doc.totalHT * (1 + rate / 100);
}

async function saveDocEdits(type, docId) {
    let list = type === 'quotes' ? quotes : (type === 'orders' ? orders : invoices);
    const doc = list.find(d => d.id === docId);
    
    const refInput = document.getElementById('doc-cust-ref');
    if (refInput) {
        doc.customerOrderRef = refInput.value;
    }

    await syncData();
    document.getElementById('quote-modal').style.display = 'none';
    
    if (type === 'quotes') renderQuoteList();
    if (type === 'orders') renderOrderList();
    if (type === 'invoices') renderInvoiceList();
    alert('Document mis à jour !');
}

function renderStaticModal(data, typeLabel, isNew = false) {
    const modal = document.getElementById('quote-modal');
    const content = document.getElementById('quote-printable');
    
    const label = typeLabel;
    const prefix = label === 'FACTURE' ? 'FA' : (label === 'COMMANDE' ? 'CO' : 'DE');
    
    let itemsHtml = '';
    data.items.forEach(p => {
        const lineTTC = p.totalHT * (1 + p.tvaRate / 100);
        itemsHtml += `
            <tr style="border-bottom: 1px solid #eee;">
                <td style="padding: 12px 0;">
                    <span style="font-weight: 600; font-size: 1rem;">${p.name}</span><br>
                    <small style="color: #666;">Prestation d'impression 3D / Modélisation</small>
                </td>
                <td style="text-align: center;">${p.quantity}</td>
                <td style="text-align: right;">${p.unitPriceHT.toFixed(2)} €</td>
                <td style="text-align: right;">${p.totalHT.toFixed(2)} €</td>
                <td style="text-align: center;">${p.tvaRate}%</td>
                <td style="text-align: right; font-weight: 600;">${lineTTC.toFixed(2)} €</td>
            </tr>
        `;
    });

    content.innerHTML = `
        <div class="quote-content-wrapper">
            <div class="quote-header">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 3rem;">
                    <div>
                        <img src="logo.png" alt="MS 3D" style="height: 100px; width: auto; margin-top: -5mm; margin-left: -5mm; margin-bottom: 5px;">
                        <h3 style="margin: 15px 0 0 0; color: #1a1a1a; font-family: 'Outfit', sans-serif;">MS 3D</h3>
                        <p style="margin: 2px 0; font-size: 0.85rem; color: #666;">Conception & Impression 3D</p>
                    </div>
                    <div style="text-align: right;">
                        <div class="quote-title-box">${label}</div>
                        <p style="margin: 10px 0 0 0; font-weight: 700; font-size: 1.1rem;">N° ${prefix}-${data.id.toString().slice(-6)}</p>
                        <p style="margin: 2px 0; font-size: 0.9rem; color: #666;">Date : ${data.date}</p>
                        ${data.customerOrderRef ? `<p style="margin: 2px 0; font-size: 0.9rem; color: #666;">Réf. Client : <strong>${data.customerOrderRef}</strong></p>` : ''}
                    </div>
                </div>

                <div style="display: flex; justify-content: space-between; margin-bottom: 3rem; font-size: 0.9rem;">
                    <div style="width: 45%;">
                        <p style="text-transform: uppercase; color: #888; font-weight: 700; margin-bottom: 10px; letter-spacing: 1px;">Émetteur :</p>
                        <p><strong>MS 3D</strong></p>
                        <p>Sylvain Maupas</p>
                        <p>74000 Annecy, France</p>
                        <p>Email : contact@ms-3d.fr</p>
                    </div>
                    <div style="width: 45%; text-align: right;">
                        <p style="text-transform: uppercase; color: #888; font-weight: 700; margin-bottom: 10px; letter-spacing: 1px;">Destinataire :</p>
                        <p><strong>${data.customerName || 'Client'}</strong></p>
                        <p>Adresse du client</p>
                        <p>Ville, CP</p>
                    </div>
                </div>
            </div>

            <div class="quote-body" style="flex: 1;">
                <table style="width: 100%; border-collapse: collapse; margin-bottom: 2rem; font-size: 0.9rem;">
                     <thead>
                        <tr style="border-bottom: 2px solid #06b6d4; color: #888; text-transform: uppercase; font-size: 0.75rem; letter-spacing: 1px;">
                            <th style="text-align: left; padding: 10px 0;">Description :</th>
                            <th style="text-align: center; padding: 10px 0;">Qté :</th>
                            <th style="text-align: right; padding: 10px 0;">P.U. HT :</th>
                            <th style="text-align: right; padding: 10px 0;">Total HT :</th>
                            <th style="text-align: center; padding: 10px 0;">TVA :</th>
                            <th style="text-align: right; padding: 10px 0;">Total TTC :</th>
                        </tr>
                     </thead>
                     <tbody>${itemsHtml}</tbody>
                </table>
            </div>

            <div class="quote-footer">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-top: 3rem;">
                    <div style="width: 50%; font-size: 0.8rem; color: #666;">
                        <p style="text-transform: uppercase; color: #1a1a1a; font-weight: 700; margin-bottom: 10px; letter-spacing: 1px;">Règlement :</p>
                        <p>Par virement bancaire :</p>
                        <p>Banque : <strong>VOTRE BANQUE</strong></p>
                        <p>IBAN : <strong>FR76 XXXX XXXX XXXX XXXX XXXX XXX</strong></p>
                        <p>BIC : <strong>XXXXXXXX</strong></p>
                        <p style="margin-top: 15px; font-style: italic;">En cas de retard de paiement, une indemnité forfaitaire de 40€ pour frais de recouvrement sera exigée.</p>
                    </div>
                    <div style="width: 300px;">
                        <div style="display: flex; justify-content: space-between; padding: 5px 0;">
                            <span>TOTAL HORS TAXES</span>
                            <span style="font-weight: 600;">${data.totalHT.toFixed(2)} €</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; padding: 5px 0;">
                            <span>TVA (${data.tvaRate}%)</span>
                            <span style="font-weight: 600;">${(data.totalTTC - data.totalHT).toFixed(2)} €</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; padding: 15px 0; border-top: 3px solid #06b6d4; font-weight: 800; font-size: 1.4rem; color: #1a1a1a; margin-top: 10px;">
                            <span>TOTAL TTC</span>
                            <span>${data.totalTTC.toFixed(2)} €</span>
                        </div>
                        ${data.paid ? '<div style="text-align: right; background: #dcfce7; color: #166534; padding: 5px 10px; border-radius: 4px; display: inline-block; width: 100%; box-sizing: border-box; font-weight: bold;">DOCUMENT PAYÉ</div>' : ''}
                    </div>
                </div>
                
                <div style="margin-top: 4rem; text-align: center; font-size: 0.7rem; color: #aaa; border-top: 1px solid #eee; padding-top: 20px;">
                    <p>MS 3D - SIRET : XXXXXXXXXXXXXX - RCS ANNECY</p>
                    <p>Conditions générales de vente disponibles sur demande.</p>
                </div>
            </div>
        </div>

        <div class="no-print" style="margin-top: 2rem; border-top: 1px solid #eee; padding-top: 1rem; display: flex; gap: 1rem; position: fixed; bottom: 20px; right: 20px; z-index: 100;">
            ${isNew ? '<button id="save-quote-db-btn" class="btn btn-primary" style="box-shadow: 0 4px 12px rgba(0,0,0,0.2);">Enregistrer</button>' : ''}
            <button onclick="window.print()" class="btn btn-secondary" style="box-shadow: 0 4px 12px rgba(0,0,0,0.2);">Imprimer / PDF</button>
        </div>
    `;

    if (isNew) {
        document.getElementById('save-quote-db-btn').onclick = () => saveQuote({ 
            items: data.items, 
            totalHT: data.totalHT, 
            totalTTC: data.totalTTC, 
            tvaRate: data.tvaRate 
        });
    }

    modal.style.display = 'block';
}

// Modal Close
document.querySelector('.close-modal').onclick = () => {
    document.getElementById('quote-modal').style.display = 'none';
};

window.onclick = (event) => {
    const modal = document.getElementById('quote-modal');
    if (event.target == modal) {
        modal.style.display = 'none';
    }
};
