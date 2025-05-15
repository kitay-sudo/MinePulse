// Список моделей
let allModels = [];

// Загрузка моделей с сервера
async function loadModels() {
  const res = await fetch('/api/device-models');
  allModels = await res.json();
  renderModels();
}

// Отрисовка таблицы моделей
function renderModels() {
  const tbody = document.querySelector('#modelsTable tbody');
  const search = document.getElementById('searchModelInput').value.toLowerCase();
  const filtered = allModels.filter(m => m.name.toLowerCase().includes(search));
  tbody.innerHTML = filtered.map(m => `
    <tr>
      <td>${m.name}</td>
      <td>${m.consumption}</td>
      <td class="text-center">
        <button class="btn btn-sm btn-outline-danger" title="Удалить" onclick="deleteModel('${m._id}')">
          <i class="bi bi-trash"></i>
        </button>
      </td>
    </tr>
  `).join('');
}

window.deleteModel = async function(id) {
  if (!confirm('Удалить эту модель?')) return;
  try {
    const res = await fetch(`/api/device-models/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const data = await res.json();
      alert(data.error || 'Ошибка при удалении');
      return;
    }
    await loadModels();
  } catch (err) {
    alert('Ошибка сети при удалении');
  }
}

document.addEventListener('DOMContentLoaded', function() {
  loadModels();
  document.getElementById('searchModelInput').addEventListener('input', renderModels);
  document.getElementById('addModelBtn').addEventListener('click', function() {
    document.getElementById('modelForm').reset();
  });
  document.getElementById('modelForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const name = document.getElementById('modelName').value.trim();
    const consumption = parseFloat(document.getElementById('modelConsumption').value);
    if (!name || isNaN(consumption)) return;
    try {
      const res = await fetch('/api/device-models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, consumption })
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || 'Ошибка при добавлении модели');
        return;
      }
      await loadModels();
      const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('modelModal'));
      modal.hide();
    } catch (err) {
      alert('Ошибка сети при добавлении модели');
    }
  });
}); 