let invoices = [];
let currentPage = 1;
let invoicesPerPage = 10;

async function loadInvoices() {
  const status = document.getElementById('statusFilter').value;
  const client = document.getElementById('clientSearch').value.trim();
  const from = document.getElementById('fromDate').value;
  const to = document.getElementById('toDate').value;
  let url = '/api/invoices?';
  if (status && status !== 'all') url += `status=${encodeURIComponent(status)}&`;
  if (client) url += `client=${encodeURIComponent(client)}&`;
  if (from) url += `from=${from}&`;
  if (to) url += `to=${to}&`;
  const res = await fetch(url);
  invoices = await res.json();
  renderInvoices();
  renderInvoicesPagination();
}

function renderInvoices() {
  const tbody = document.querySelector('#invoicesTable tbody');
  const start = (currentPage - 1) * invoicesPerPage;
  const end = Math.min(start + invoicesPerPage, invoices.length);
  const pageInvoices = invoices.slice(start, end);
  tbody.innerHTML = pageInvoices.map((inv, i) => `
    <tr>
      <td>${start + i + 1}</td>
      <td>${new Date(inv.createdAt).toLocaleString('ru-RU')}</td>
      <td>${inv.clientFio || ''}</td>
      <td>${inv.amount != null ? inv.amount.toFixed(2) : '-'}</td>
      <td>${inv.status}</td>
      <td class="text-center">
        <button class="btn btn-sm btn-outline-primary me-1" title="Посмотреть" onclick="viewInvoice('${inv._id}')"><i class="bi bi-eye"></i></button>
        <button class="btn btn-sm btn-outline-danger" title="Удалить" onclick="deleteInvoice('${inv._id}')"><i class="bi bi-trash"></i></button>
      </td>
    </tr>
  `).join('');
  // Инфо
  document.getElementById('invoicesPaginationInfo').textContent = `Показано ${invoices.length ? start+1 : 0}-${end} из ${invoices.length} счетов`;
}

function renderInvoicesPagination() {
  const totalPages = Math.ceil(invoices.length / invoicesPerPage);
  const pag = document.getElementById('invoicesPagination');
  let pagHTML = `<li class="page-item${currentPage===1?' disabled':''}"><a class="page-link" href="#" onclick="goToInvoicesPage(${currentPage-1});return false;">&laquo;</a></li>`;
  let maxPages = 5, startPage = Math.max(1, currentPage-Math.floor(maxPages/2)), endPage = Math.min(totalPages, startPage+maxPages-1);
  if (endPage-startPage+1<maxPages) startPage = Math.max(1, endPage-maxPages+1);
  for(let i=startPage;i<=endPage;i++) pagHTML += `<li class="page-item${i===currentPage?' active':''}"><a class="page-link" href="#" onclick="goToInvoicesPage(${i});return false;">${i}</a></li>`;
  pagHTML += `<li class="page-item${currentPage===totalPages||totalPages===0?' disabled':''}"><a class="page-link" href="#" onclick="goToInvoicesPage(${currentPage+1});return false;">&raquo;</a></li>`;
  pag.innerHTML = pagHTML;
}

window.goToInvoicesPage = function(page) {
  const totalPages = Math.ceil(invoices.length / invoicesPerPage);
  if (page < 1 || page > totalPages) return;
  currentPage = page;
  renderInvoices();
  renderInvoicesPagination();
}

window.viewInvoice = function(id) {
  window.open(`/api/invoices/${id}`, '_blank');
}

window.deleteInvoice = async function(id) {
  if (!confirm('Удалить этот счет?')) return;
  await fetch(`/api/invoices/${id}`, { method: 'DELETE' });
  await loadInvoices();
}

document.getElementById('statusFilter').addEventListener('change', function() { currentPage = 1; loadInvoices(); });
document.getElementById('clientSearch').addEventListener('input', function() { currentPage = 1; loadInvoices(); });
document.getElementById('fromDate').addEventListener('change', function() { currentPage = 1; loadInvoices(); });
document.getElementById('toDate').addEventListener('change', function() { currentPage = 1; loadInvoices(); });
document.getElementById('invoicesPerPage').addEventListener('change', function() {
  invoicesPerPage = parseInt(this.value);
  currentPage = 1;
  renderInvoices();
  renderInvoicesPagination();
});
document.getElementById('resetInvoicesFiltersBtn').addEventListener('click', function() {
  document.getElementById('statusFilter').value = 'all';
  document.getElementById('clientSearch').value = '';
  document.getElementById('fromDate').value = '';
  document.getElementById('toDate').value = '';
  invoicesPerPage = 10;
  document.getElementById('invoicesPerPage').value = '10';
  currentPage = 1;
  loadInvoices();
});

document.addEventListener('DOMContentLoaded', loadInvoices); 