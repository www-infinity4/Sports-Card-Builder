const sendButton = document.getElementById('send');
const playerInput = document.getElementById('player');
const messageInput = document.getElementById('message');
const chatEl = document.getElementById('chat');
const cardEl = document.getElementById('card');

const messages = [];

function renderChat() {
  chatEl.textContent = messages.map((m) => `${m.role}: ${m.content}`).join('\n\n');
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
      playerName: playerInput.value.trim(),
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
