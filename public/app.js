const sendButton = document.getElementById('send');
const seriesSelect = document.getElementById('series');
const subjectInput = document.getElementById('subject');
const messageInput = document.getElementById('message');
const starterEl = document.getElementById('starter');
const chatEl = document.getElementById('chat');
const cardEl = document.getElementById('card');

const messages = [];

function renderChat() {
  chatEl.textContent = messages.map((m) => `${m.role}: ${m.content}`).join('\n\n');
}

async function loadReleasePlan() {
  const res = await fetch('/api/releases');
  const data = await res.json();

  Object.entries(data.series).forEach(([key, value]) => {
    const option = document.createElement('option');
    option.value = key;
    option.textContent = value.name;
    seriesSelect.appendChild(option);
  });

  seriesSelect.value = 'diamond-kings-2026';
  starterEl.textContent = data.starterWave.join('\n');
}

sendButton.addEventListener('click', async () => {
  const content = messageInput.value.trim();
  if (!content) return;

  messages.push({ role: 'user', content });
  renderChat();

  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      seriesKey: seriesSelect.value,
      subjectName: subjectInput.value.trim(),
      messages
    })
  });

  const data = await res.json();
  if (data.error) {
    messages.push({ role: 'assistant', content: `Error: ${data.error}` });
  } else {
    messages.push({ role: 'assistant', content: data.reply || 'Card generated.' });
    cardEl.textContent = JSON.stringify(data.card, null, 2);
  }

  renderChat();
  messageInput.value = '';
});

loadReleasePlan().catch((error) => {
  starterEl.textContent = `Failed to load release plan: ${error.message}`;
});
