let users = [];
let devices = [];
let currentPage = 1;
let usersPerPage = 10;

async function loadUsers() {
  const res = await fetch('/api/users');
  users = await res.json();
  // Загружаем все устройства
  const devRes = await fetch('/api/devices/full');
  devices = await devRes.json();
  renderUsers();
}

function getUserDeviceStats(user) {
  if (!user.workers || !user.workers.length) return { online: 0, offline: 0 };
  const workerBases = user.workers.map(w => w.split('.')[0]);
  const userDevices = devices.filter(d =>
    d.worker && workerBases.some(base => d.worker.startsWith(base + '.'))
  );
  const online = userDevices.filter(d => d.status === 'online').length;
  const offline = userDevices.filter(d => d.status === 'offline').length;
  return { online, offline };
}

function renderUsers() {
  const search = (document.getElementById('userSearchInput')?.value || '').toLowerCase();
  const roleFilter = document.getElementById('roleFilter')?.value || 'all';
  const archiveFilter = document.getElementById('archiveFilter')?.value || 'all';
  const tbody = document.querySelector('#usersTable tbody');
  let filtered = users;
  if (search) {
    filtered = users.filter(u =>
      (u.fio && u.fio.toLowerCase().includes(search)) ||
      (u.email && u.email.toLowerCase().includes(search)) ||
      (u.phone && u.phone.toLowerCase().includes(search)) ||
      (u.workers && u.workers.join(' ').toLowerCase().includes(search))
    );
  }
  if (roleFilter !== 'all') {
    filtered = filtered.filter(u => u.role === roleFilter);
  }
  if (archiveFilter !== 'all') {
    filtered = filtered.filter(u =>
      archiveFilter === 'active' ? !u.archived : u.archived
    );
  }
  // Пагинация
  const total = filtered.length;
  const totalPages = Math.ceil(total / usersPerPage);
  if (currentPage > totalPages) currentPage = totalPages || 1;
  const start = (currentPage - 1) * usersPerPage;
  const end = Math.min(start + usersPerPage, total);
  const pageUsers = filtered.slice(start, end);
  tbody.innerHTML = pageUsers.map(u => {
    const stats = getUserDeviceStats(u);
    return `
    <tr>
      <td>${u.fio}</td>
      <td>${u.email || u.telegramId}</td>
      <td>${u.tariff}</td>
      <td>${u.role}</td>
      <td>${u.phone}</td>
      <td>${u.workers ? u.workers.length : 0}</td>
      <td>${stats.online}</td>
      <td>${stats.offline}</td>
      <td class="text-center">
        ${getTelegramBtn(u)}
        <button class="btn btn-sm btn-outline-info me-1" title="Счёт" onclick="generateInvoice('${u._id}')"><i class="bi bi-receipt"></i></button>
        <button class="btn btn-sm btn-outline-warning me-1" title="Редактировать" onclick="editUser('${u._id}')"><i class="bi bi-pencil"></i></button>
        <button class="btn btn-sm btn-outline-danger me-1" title="Удалить" onclick="deleteUser('${u._id}')"><i class="bi bi-trash"></i></button>
        ${getArchiveBtn(u)}
      </td>
    </tr>
  `}).join('');
  // Инфо
  document.getElementById('paginationInfo').textContent = `Показано ${total ? start+1 : 0}-${end} из ${total} пользователей`;
  // Кнопки страниц
  const pag = document.getElementById('pagination');
  let pagHTML = `<li class="page-item${currentPage===1?' disabled':''}"><a class="page-link" href="#" onclick="goToPage(${currentPage-1});return false;">&laquo;</a></li>`;
  let maxPages = 5, startPage = Math.max(1, currentPage-Math.floor(maxPages/2)), endPage = Math.min(totalPages, startPage+maxPages-1);
  if (endPage-startPage+1<maxPages) startPage = Math.max(1, endPage-maxPages+1);
  for(let i=startPage;i<=endPage;i++) pagHTML += `<li class="page-item${i===currentPage?' active':''}"><a class="page-link" href="#" onclick="goToPage(${i});return false;">${i}</a></li>`;
  pagHTML += `<li class="page-item${currentPage===totalPages||totalPages===0?' disabled':''}"><a class="page-link" href="#" onclick="goToPage(${currentPage+1});return false;">&raquo;</a></li>`;
  pag.innerHTML = pagHTML;
}

window.goToPage = function(page) {
  const totalPages = Math.ceil(users.filter(u => {
    const search = (document.getElementById('userSearchInput')?.value || '').toLowerCase();
    return !search || (u.fio && u.fio.toLowerCase().includes(search)) || (u.email && u.email.toLowerCase().includes(search)) || (u.phone && u.phone.toLowerCase().includes(search)) || (u.workers && u.workers.join(' ').toLowerCase().includes(search));
  }).length / usersPerPage);
  if (page < 1 || page > totalPages) return;
  currentPage = page;
  renderUsers();
}

document.getElementById('usersPerPage').addEventListener('change', function() {
  usersPerPage = parseInt(this.value);
  currentPage = 1;
  renderUsers();
});

document.getElementById('userSearchInput').addEventListener('input', function() {
  currentPage = 1;
  renderUsers();
});

document.getElementById('roleFilter').addEventListener('change', function() {
  currentPage = 1;
  renderUsers();
});
document.getElementById('archiveFilter').addEventListener('change', function() {
  currentPage = 1;
  renderUsers();
});

window.sendTelegram = function(id) {
  const user = users.find(u => u._id === id);
  if (!user || !user.telegramId) return;
  document.getElementById('telegramUserId').value = user._id;
  document.getElementById('telegramSubject').value = '';
  document.getElementById('telegramBody').value = '';
  const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('telegramModal'));
  modal.show();
}
window.generateInvoice = function(id) {
  document.getElementById('invoiceUserId').value = id;
  document.getElementById('invoiceFrom').value = '';
  document.getElementById('invoiceTo').value = '';
  const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('invoiceModal'));
  modal.show();
}
window.deleteUser = async function(id) {
  if (!confirm('Удалить пользователя?')) return;
  await fetch(`/api/users/${id}`, { method: 'DELETE' });
  await loadUsers();
}
window.archiveUser = async function(id, unarchive = false) {
  if (unarchive) {
    await fetch(`/api/users/${id}/unarchive`, { method: 'PATCH' });
    if (typeof showSuccess === 'function') showSuccess('Клиент восстановлен из архива!');
    document.getElementById('archiveFilter').value = 'active';
    await loadUsers();
  } else {
    await fetch(`/api/users/${id}/archive`, { method: 'PATCH' });
    if (typeof showSuccess === 'function') showSuccess('Клиент отправлен в архив!');
    await loadUsers();
  }
}

// Генерация пароля
const genPasswordBtn = document.getElementById('genPasswordBtn');
if (genPasswordBtn) {
  genPasswordBtn.onclick = function() {
    const pass = Math.random().toString(36).slice(-8);
    document.getElementById('password').value = pass;
  }
}

window.editUser = function(id) {
  const user = users.find(u => u._id === id);
  if (!user) return;
  document.getElementById('userModalTitle').textContent = 'Редактирование пользователя';
  document.getElementById('fio').value = user.fio || '';
  document.getElementById('phone').value = user.phone || '';
  document.getElementById('telegramId').value = user.telegramId || '';
  document.getElementById('tariff').value = user.tariff || '';
  document.getElementById('email').value = user.email || '';
  document.getElementById('password').value = user.password || '';
  document.getElementById('role').value = user.role || 'Клиент';
  document.getElementById('workers').value = user.workers ? user.workers.join('\n') : '';
  // contractFile не трогаем
  document.getElementById('userForm').dataset.editId = user._id;
  const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('userModal'));
  modal.show();
}

document.getElementById('userForm').onsubmit = async function(e) {
  e.preventDefault();
  const fio = document.getElementById('fio').value.trim();
  const phone = document.getElementById('phone').value.trim();
  const telegramId = document.getElementById('telegramId').value.trim();
  const tariff = document.getElementById('tariff').value.trim();
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value.trim();
  const role = document.getElementById('role').value;
  const workers = document.getElementById('workers').value.split('\n').map(w=>w.trim()).filter(Boolean);
  const user = { fio, phone, telegramId, tariff, email, password, role, workers };
  const editId = this.dataset.editId;
  if (editId) {
    await fetch(`/api/users/${editId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(user)
    });
    delete this.dataset.editId;
  } else {
    await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(user)
    });
  }
  this.reset();
  document.getElementById('userModalTitle').textContent = 'Добавление пользователя';
  const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('userModal'));
  modal.hide();
  await loadUsers();
}

document.getElementById('resetUsersFiltersBtn').addEventListener('click', function() {
  document.getElementById('userSearchInput').value = '';
  document.getElementById('usersPerPage').value = '10';
  document.getElementById('roleFilter').value = 'all';
  document.getElementById('archiveFilter').value = 'all';
  usersPerPage = 10;
  currentPage = 1;
  renderUsers();
});

function getArchiveBtn(user) {
  if (user.archived) {
    return `<button class="btn btn-sm btn-outline-success" title="Восстановить" onclick="archiveUser('${user._id}', true)"><i class="bi bi-arrow-counterclockwise"></i></button>`;
  } else {
    return `<button class="btn btn-sm btn-outline-secondary" title="Архивировать" onclick="archiveUser('${user._id}', false)"><i class="bi bi-archive"></i></button>`;
  }
}

function getTelegramBtn(user) {
  if (user.telegramId) {
    return `<button class="btn btn-sm btn-primary me-1" title="Телеграм" onclick="sendTelegram('${user._id}')"><i class="bi bi-telegram"></i></button>`;
  } else {
    return `<button class="btn btn-sm btn-outline-primary me-1" title="Телеграм не указан" disabled><i class="bi bi-telegram"></i></button>`;
  }
}

document.addEventListener('DOMContentLoaded', function() {
  document.getElementById('archiveFilter').value = 'active';
  loadUsers();
});

document.addEventListener('DOMContentLoaded', loadUsers);

document.getElementById('telegramForm').onsubmit = async function(e) {
  e.preventDefault();
  const userId = document.getElementById('telegramUserId').value;
  const subject = document.getElementById('telegramSubject').value.trim();
  const body = document.getElementById('telegramBody').value.trim();
  if (!userId || !subject || !body) return;
  const message = `<b>📧 ${subject}</b>\n${body}`;
  await fetch(`/api/users/${userId}/telegram`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message })
  });
  const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('telegramModal'));
  modal.hide();
  if (typeof showSuccess === 'function') showSuccess('Сообщение отправлено в Telegram!');
}

document.getElementById('invoiceForm').onsubmit = async function(e) {
  e.preventDefault();
  const userId = document.getElementById('invoiceUserId').value;
  const from = document.getElementById('invoiceFrom').value;
  const to = document.getElementById('invoiceTo').value;
  const coef = parseFloat(document.getElementById('invoiceCoef').value) || 1.02;
  if (!userId || !from || !to) return;
  // Получаем данные для счета
  const res = await fetch(`/api/users/${userId}/invoice?from=${from}&to=${to}&coef=${coef}`);
  const data = await res.json();
  // Формируем объект счета
  const fio = users.find(u => u._id === userId)?.fio || '';
  const invoice = {
    clientId: userId,
    clientFio: fio,
    amount: Number(data.totalAmount.toFixed(2)),
    status: 'На оплате',
    periodFrom: from,
    periodTo: to,
    totalDowntime: data.totalDowntime,
    details: data.details
  };
  // Сохраняем счет
  const resp = await fetch('/api/invoices', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(invoice)
  });
  const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('invoiceModal'));
  modal.hide();
  if (typeof showSuccess === 'function') showSuccess('Счёт сгенерирован!');
} 