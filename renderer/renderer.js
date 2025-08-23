
window.addEventListener('DOMContentLoaded', () => {
  const dataContainer = document.getElementById('data-container');
  const dragDropArea = document.getElementById('drag-drop-area');

  // Request data from the main process
  window.electronAPI.getData();

  // Receive data from the main process
  window.electronAPI.receiveData((data) => {
    dataContainer.innerHTML = ''; // Clear previous data
    data.forEach(item => {
      const p = document.createElement('p');
      p.textContent = `${item.name}: ${item.value}`;
      dataContainer.appendChild(p);
    });
  });

  // Drag and drop functionality
  dragDropArea.addEventListener('dragover', (event) => {
    event.preventDefault();
    dragDropArea.classList.add('drag-over');
  });

  dragDropArea.addEventListener('dragleave', () => {
    dragDropArea.classList.remove('drag-over');
  });

  dragDropArea.addEventListener('drop', (event) => {
    event.preventDefault();
    dragDropArea.classList.remove('drag-over');
    const files = event.dataTransfer.files;
    // Handle dropped files here
    console.log(files);
  });

  // Window controls (placeholders)
  document.getElementById('minimize-btn').addEventListener('click', () => {
    // Implement minimize functionality
  });

  document.getElementById('maximize-btn').addEventListener('click', () => {
    // Implement maximize functionality
  });

  document.getElementById('close-btn').addEventListener('click', () => {
    // Implement close functionality
  });
});
