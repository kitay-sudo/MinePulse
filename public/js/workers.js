let workers = [];
let users = [];
let currentPage = 1;
let itemsPerPage = 10;

// Загрузка воркеров и их простоев
async function loadWorkers() {
  // Получаем список всех воркеров и их простоев с backend
  const res = await fetch('/api/workers');
  workers = await res.json();
  // Получаем всех клиентов
  const usersRes = await fetch('/api/users');
  users = await usersRes.json();
  currentPage = 1;
  renderWorkers();
  renderWorkersPagination();
}

function getClientFioForWorker(workerName) {
  for (const user of users) {
    if (user.workers && user.workers.some(w => workerName.startsWith(w))) {
      return user.fio || '-';
    }
  }
  return '-';
}

function formatDowntime(minutes) {
  if (minutes < 60) return `${minutes} мин`;
  if (minutes < 24 * 60) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h} ч ${m} мин`;
  }
  const d = Math.floor(minutes / (24 * 60));
  const h = Math.floor((minutes % (24 * 60)) / 60);
  const m = minutes % 60;
  return `${d} дн ${h} ч ${m} мин`;
}

function getFilteredWorkers() {
  const search = document.getElementById('workerSearchInput')?.value?.toLowerCase() || '';
  if (!search) return workers;
  return workers.filter(w =>
    (w.worker && w.worker.toLowerCase().includes(search)) ||
    (w.ip && w.ip.toLowerCase().includes(search))
  );
}

function renderWorkers() {
  const tbody = document.querySelector('#workersTable tbody');
  const filtered = getFilteredWorkers();
  const start = (currentPage - 1) * itemsPerPage;
  const paginated = filtered.slice(start, start + itemsPerPage);
  tbody.innerHTML = paginated.map(worker => `
    <tr>
      <td>${worker.worker}</td>
      <td>${worker.ip || '-'}</td>
      <td>${formatDowntime(worker.downtimeCount || 0)}</td>
      <td>${getClientFioForWorker(worker.worker)}</td>
      <td class="text-center">
        <button class="btn btn-sm btn-outline-primary me-1" title="График простоев" onclick="showWorkerChart('${worker.worker}')"><i class="bi bi-bar-chart"></i></button>
        <button class="btn btn-sm btn-outline-danger" title="Удалить воркера" onclick="deleteWorker('${worker.worker}')"><i class="bi bi-trash"></i></button>
      </td>
    </tr>
  `).join('');
  // Счётчик
  const info = document.getElementById('workersPaginationInfo');
  const end = Math.min(start + itemsPerPage, filtered.length);
  info.textContent = `Показано ${filtered.length ? start+1 : 0}-${end} из ${filtered.length} воркеров`;
}

function renderWorkersPagination() {
  const filtered = getFilteredWorkers();
  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const pagination = document.getElementById('workersPagination');
  let html = `
    <li class="page-item ${currentPage === 1 ? 'disabled' : ''}">
      <a class="page-link" href="#" onclick="goToWorkersPage(${currentPage - 1}); return false;">&laquo;</a>
    </li>
  `;
  const maxPages = 5;
  let startPage = Math.max(1, currentPage - Math.floor(maxPages/2));
  let endPage = Math.min(totalPages, startPage + maxPages - 1);
  if (endPage - startPage + 1 < maxPages) {
    startPage = Math.max(1, endPage - maxPages + 1);
  }
  for (let i = startPage; i <= endPage; i++) {
    html += `
      <li class="page-item ${i === currentPage ? 'active' : ''}">
        <a class="page-link" href="#" onclick="goToWorkersPage(${i}); return false;">${i}</a>
      </li>
    `;
  }
  html += `
    <li class="page-item ${currentPage === totalPages || totalPages === 0 ? 'disabled' : ''}">
      <a class="page-link" href="#" onclick="goToWorkersPage(${currentPage + 1}); return false;">&raquo;</a>
    </li>
  `;
  pagination.innerHTML = html;
}

window.goToWorkersPage = function(page) {
  const totalPages = Math.ceil(workers.length / itemsPerPage);
  if (page < 1 || page > totalPages) return;
  currentPage = page;
  renderWorkers();
  renderWorkersPagination();
}

// Агрегация событий по интервалу (минуты)
function aggregateEvents(events, intervalMinutes = 10) {
  if (!events.length) return [];
  const result = [];
  let groupStart = new Date(events[0].timestamp);
  let groupStatus = 0;
  for (const e of events) {
    const t = new Date(e.timestamp);
    if ((t - groupStart) / 60000 > intervalMinutes) {
      result.push({ timestamp: groupStart, status: groupStatus });
      groupStart = t;
      groupStatus = 0;
    }
    if (e.status === 1) groupStatus = 1;
  }
  result.push({ timestamp: groupStart, status: groupStatus });
  return result;
}

// Обновлённая функция для показа графика с учётом режима
async function showWorkerChart(workerName) {
  // Получаем данные простоев по воркеру с backend
  const res = await fetch(`/api/workers/${encodeURIComponent(workerName)}/downtime`);
  let data = await res.json();
  // Сохраняем оригинальные данные для повторного построения
  window._workerChartRaw = data;
  // Открываем модалку и строим график
  const modal = new bootstrap.Modal(document.getElementById('workerChartModal'));
  modal.show();
  drawWorkerChartWithMode(data, 'agg10');
  // Обработчик смены режима
  const select = document.getElementById('chartModeSelect');
  select.onchange = function() {
    drawWorkerChartWithMode(window._workerChartRaw, select.value);
  };
}

function drawWorkerChartWithMode(data, mode) {
  let labels = data.labels;
  let values = data.values;
  let events = labels.map((label, i) => ({ timestamp: label, status: values[i] }));
  if (mode === 'agg10') {
    events = aggregateEvents(events, 10);
  } else if (mode === 'agg30') {
    events = aggregateEvents(events, 30);
  } else if (mode === 'day') {
    // Только за последние сутки
    const now = new Date();
    events = events.filter(e => (now - new Date(e.timestamp)) < 24*60*60*1000);
    events = aggregateEvents(events, 10);
  }
  // labels всегда строки времени
  labels = events.map(e =>
    typeof e.timestamp === 'string'
      ? e.timestamp
      : new Date(e.timestamp).toLocaleString('ru-RU')
  );
  values = events.map(e => e.status);
  drawWorkerChart({ labels, values });
}

function drawWorkerChart(data) {
  const ctx = document.getElementById('workerChartCanvas').getContext('2d');
  if (window.workerChartInstance) {
    window.workerChartInstance.destroy();
  }
  window.workerChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: data.labels,
      datasets: [{
        label: 'Статус',
        data: data.values,
        borderColor: 'rgba(54, 162, 235, 1)',
        backgroundColor: 'rgba(54, 162, 235, 0.2)',
        fill: false,
        tension: 0.2,
        pointRadius: 4,
        pointBackgroundColor: data.values.map(v => v === 1 ? '#dc3545' : '#198754'),
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        title: { display: false },
        tooltip: {
          callbacks: {
            label: function(context) {
              const v = context.parsed.y;
              return v === 1 ? 'Offline' : 'Online';
            }
          }
        }
      },
      scales: {
        x: { title: { display: true, text: 'Время' } },
        y: {
          title: { display: true, text: 'Статус' },
          min: -0.1,
          max: 1.1,
          ticks: {
            callback: function(value) {
              if (value === 1) return 'Offline';
              if (value === 0) return 'Online';
              return '';
            },
            stepSize: 1
          }
        }
      }
    }
  });
}

document.addEventListener('DOMContentLoaded', function() {
  const searchInput = document.getElementById('workerSearchInput');
  if (searchInput) {
    searchInput.addEventListener('input', function() {
      currentPage = 1;
      renderWorkers();
      renderWorkersPagination();
    });
  }
});

// Удаление воркера
async function deleteWorker(workerName) {
  if (!confirm(`Удалить воркера ${workerName} из всех записей?`)) return;
  try {
    const res = await fetch(`/api/workers/${encodeURIComponent(workerName)}`, { method: 'DELETE' });
    if (!res.ok) {
      alert('Ошибка при удалении воркера');
      return;
    }
    await loadWorkers();
  } catch (e) {
    alert('Ошибка сети при удалении воркера');
  }
}
window.deleteWorker = deleteWorker;

// Инициализация
loadWorkers(); 