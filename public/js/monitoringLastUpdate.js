// Скрывать блок, если не на dashboard
const el = document.getElementById('monitoringLastUpdate');
if (el) {
  if (document.body.dataset.dashboard === 'true') {
    el.classList.remove('d-none');
    el.style.display = '';
  } else {
    el.classList.add('d-none');
    el.style.display = 'none';
  }
}

async function loadMonitoringLastUpdate() {
  const el = document.getElementById('monitoringLastUpdate');
  if (!el) return;
  try {
    const res = await fetch('/api/settings/monitoring');
    const data = await res.json();
    console.log('Ответ сервера:', data);
    if (data.monitoringLastUpdate) {
      const dt = new Date(data.monitoringLastUpdate);
      el.textContent = dt.toLocaleString('ru-RU');
    } else {
      el.innerHTML = '<span class="spinner-border spinner-border-sm text-secondary me-1" role="status"></span> Ожидаем опроса...';
    }
  } catch (e) {
    console.error('Ошибка запроса:', e);
    el.innerHTML = '<span class="spinner-border spinner-border-sm text-secondary me-1" role="status"></span> Ожидаем опроса...';
  }
}

// При первой загрузке сразу делаем запрос, а потом запускаем интервал

document.addEventListener('DOMContentLoaded', async () => {
  await loadMonitoringLastUpdate();
  setInterval(loadMonitoringLastUpdate, 3000);
});

document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    loadMonitoringLastUpdate();
  }
}); 