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
      <td>${(m.ths !== undefined && m.ths !== null && m.ths !== '') ? m.ths : 0}</td>
      <td class="text-center">
        <button class="btn btn-sm btn-outline-primary me-1" title="Редактировать" onclick="editModel('${m._id}')">
          <i class="bi bi-pencil"></i>
        </button>
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

window.editModel = function(id) {
  const model = allModels.find(m => m._id === id);
  if (!model) return;
  document.getElementById('modelName').value = model.name;
  document.getElementById('modelConsumption').value = model.consumption;
  document.getElementById('modelThs').value = model.ths || '';
  document.getElementById('modelModalTitle').textContent = 'Редактировать модель';
  document.getElementById('modelForm').dataset.mode = 'edit';
  document.getElementById('modelForm').dataset.id = id;
  const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('modelModal'));
  modal.show();
}

document.addEventListener('DOMContentLoaded', function() {
  loadModels();
  document.getElementById('searchModelInput').addEventListener('input', renderModels);
  document.getElementById('addModelBtn').addEventListener('click', function() {
    document.getElementById('modelForm').reset();
    document.getElementById('modelModalTitle').textContent = 'Добавить модель';
    delete document.getElementById('modelForm').dataset.mode;
    delete document.getElementById('modelForm').dataset.id;
  });
  document.getElementById('modelForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const name = document.getElementById('modelName').value.trim();
    const consumption = parseFloat(document.getElementById('modelConsumption').value);
    const ths = parseFloat(document.getElementById('modelThs').value) || 0;
    if (!name || isNaN(consumption)) return;
    const mode = this.dataset.mode;
    const id = this.dataset.id;
    try {
      let res;
      if (mode === 'edit' && id) {
        res = await fetch(`/api/device-models/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, consumption, ths })
        });
      } else {
        res = await fetch('/api/device-models', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, consumption, ths })
        });
      }
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || 'Ошибка при сохранении модели');
        return;
      }
      await loadModels();
      document.getElementById('modelForm').reset();
      const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('modelModal'));
      modal.hide();
    } catch (err) {
      alert('Ошибка сети при сохранении модели');
    }
  });
}); 