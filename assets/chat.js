/* Lines & Logos — public website assistant.
 * Docked bottom-right on public pages. Answers company questions via
 * /api/chat-public, accepts one validated attachment, exports transcripts,
 * and falls back to a local answer set when the server is unavailable. */
(() => {
  'use strict';
  if (document.getElementById('llChat')) return;
  const BASE = (location.protocol === 'file:') ? 'http://localhost:3001' : '';
  const MAX_FILE_SIZE = 5 * 1024 * 1024;
  const ALLOWED_EXTENSIONS = ['png', 'jpg', 'jpeg', 'pdf', 'txt', 'doc', 'docx'];
  const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const icons = {
    download: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12m0 0 4-4m-4 4-4-4M5 17v3h14v-3"/></svg>',
    minimize: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 12h12"/></svg>',
    attach: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m20 11-8.5 8.5a5 5 0 0 1-7-7L14 3a3.5 3.5 0 0 1 5 5l-9.5 9.5a2 2 0 0 1-3-3L15 6"/></svg>',
    send: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 4 17 8-17 8 3-8-3-8Zm3 8h14"/></svg>',
    chat: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 15a3 3 0 0 1-3 3H9l-5 3v-6a3 3 0 0 1-1-2V7a3 3 0 0 1 3-3h11a3 3 0 0 1 3 3v8Z"/></svg>',
    close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 7 10 10M17 7 7 17"/></svg>',
    file: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 3H6v18h12V7l-4-4Zm0 0v4h4M9 13h6M9 17h4"/></svg>'
  };

  const css = `
  #llChat{position:fixed;right:57px;bottom:0;z-index:400;font-family:'Space Grotesk',system-ui,sans-serif;color-scheme:light;--chat-bg:#ffffff;--chat-panel:#f4f6fd;--chat-text:#26335c;--chat-dim:#5f6f95;--chat-line:rgba(38,54,96,.14)}
  #llChat *{box-sizing:border-box}
  #llChat .ll-win{display:flex;width:min(340px,100vw);height:min(460px,100dvh);flex-direction:column;border-radius:16px 0 0 0;border-right:none;border-bottom:none;overflow:hidden;border:1px solid var(--chat-line);background:var(--chat-bg);box-shadow:0 24px 64px rgba(15,30,80,.28);transform-origin:bottom right;transition:opacity .18s ease,transform .18s ease}
  #llChat .ll-head{display:flex;align-items:center;gap:8px;padding:7px 8px 7px 13px;background:var(--chat-panel);border-bottom:1px solid var(--chat-line);min-height:58px}
  #llChat .ll-dot{width:8px;height:8px;border-radius:50%;background:#c6e02c;box-shadow:0 0 10px #c6e02c;flex:none}
  #llChat .ll-id{min-width:0;margin-right:auto}
  #llChat .ll-head b{color:#fff;font-family:'Archivo',sans-serif;font-size:13px;display:block;white-space:nowrap}
  #llChat .ll-head small{color:var(--chat-dim);font-size:10.5px;display:block;white-space:nowrap}
  #llChat .ll-icon{width:44px;height:44px;flex:0 0 44px;display:inline-flex;align-items:center;justify-content:center;background:transparent;border:1px solid transparent;border-radius:10px;color:var(--chat-dim);cursor:pointer;padding:0;transition:color .15s ease,background-color .15s ease,border-color .15s ease,transform .15s ease}
  #llChat .ll-icon:hover{color:#fff;background:rgba(77,125,255,.14);border-color:var(--chat-line)}
  #llChat .ll-icon:active{transform:scale(.96)}
  #llChat .ll-icon:focus-visible,#llChat .ll-in:focus-visible,#llChat .ll-launcher:focus-visible,#llChat .ll-remove:focus-visible{outline:2px solid #57c7ff;outline-offset:2px}
  #llChat .ll-icon svg,#llChat .ll-launcher svg,#llChat .ll-file svg,#llChat .ll-remove svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
  #llChat .ll-msgs{flex:1;overflow-y:auto;padding:13px 12px;display:flex;flex-direction:column;gap:9px;overscroll-behavior:contain}
  #llChat .ll-row{display:flex}
  #llChat .ll-row.user{justify-content:flex-end}
  #llChat .ll-m{max-width:86%;padding:9px 12px;border-radius:13px;font-size:14px;line-height:1.5;white-space:pre-line;overflow-wrap:anywhere}
  #llChat .ll-row.bot .ll-m{background:rgba(45,91,255,.14);border:1px solid rgba(77,125,255,.3);color:var(--chat-text);border-bottom-left-radius:4px}
  #llChat .ll-row.user .ll-m{background:rgba(198,224,44,.12);border:1px solid rgba(198,224,44,.3);color:#eef3c9;border-bottom-right-radius:4px}
  #llChat .ll-file{display:flex;align-items:center;gap:7px;margin-top:7px;padding-top:7px;border-top:1px solid currentColor;font-size:12px;font-weight:600;white-space:normal}
  #llChat .ll-file svg{flex:none;width:17px;height:17px}
  #llChat .ll-compose{border-top:1px solid var(--chat-line);background:var(--chat-panel);padding:7px 8px 5px}
  #llChat .ll-selection{display:none;align-items:center;gap:6px;padding:4px 4px 8px;color:var(--chat-text);font-size:12px}
  #llChat .ll-selection.show{display:flex}
  #llChat .ll-selection span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
  #llChat .ll-remove{margin-left:auto;width:44px;height:44px;flex:0 0 44px;display:inline-flex;align-items:center;justify-content:center;border:0;background:transparent;color:var(--chat-dim);cursor:pointer;border-radius:9px}
  #llChat .ll-remove:hover{color:#fff;background:rgba(255,255,255,.07)}
  #llChat .ll-remove svg{width:17px;height:17px}
  #llChat .ll-foot{display:flex;gap:5px;align-items:center}
  #llChat .ll-in{flex:1;min-width:0;height:44px;padding:10px 11px;border-radius:10px;border:1px solid var(--chat-line);background:rgba(4,6,13,.6);color:#fff;font-family:inherit;font-size:14px;outline:none}
  #llChat .ll-in:focus{border-color:#4d7dff;box-shadow:0 0 0 3px rgba(45,91,255,.16)}
  #llChat .ll-send{background:linear-gradient(180deg,#4d7dff,#2d5bff);color:#fff;border-color:rgba(120,160,255,.35)}
  #llChat .ll-send:hover{color:#fff;background:linear-gradient(180deg,#668fff,#3563ff)}
  #llChat button:disabled{opacity:.45;cursor:not-allowed;transform:none}
  #llChat .ll-cap{font-size:10.5px;line-height:1.4;color:var(--chat-dim);text-align:center;padding:6px 5px 2px}
  #llChat .ll-status{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
  #llChat .ll-dock{display:none;width:min(340px,100vw);height:38px;align-items:center;justify-content:space-between;padding:0 16px;border:none;border-radius:12px 12px 0 0;background:linear-gradient(310deg,#3b5bff,#5e72e4);color:#fff;cursor:pointer;box-shadow:0 -8px 28px rgba(28,42,90,.3);font-family:'Space Grotesk',system-ui,sans-serif}
  #llChat .ll-dock .ll-dock-label{display:inline-flex;align-items:center;gap:9px;font-weight:700;font-size:13px}
  #llChat .ll-dock svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
  #llChat .ll-dock-hint{font-size:10.5px;opacity:.75;font-weight:600;letter-spacing:.06em;text-transform:uppercase}
  #llChat .ll-dock:hover{filter:brightness(1.08)}
  #llChat.minimized .ll-win{display:none}
  #llChat.minimized .ll-dock{display:flex}
  html[data-theme="light"] #llChat{color-scheme:light;--chat-bg:#ffffff;--chat-panel:#f3f6fc;--chat-text:#273651;--chat-dim:#59677e;--chat-line:rgba(40,53,208,.20)}
  html[data-theme="light"] #llChat .ll-win{background:#ffffff;box-shadow:0 20px 55px rgba(30,50,95,.20)}
  html[data-theme="light"] #llChat .ll-head b{color:#121a2b}
  html[data-theme="light"] #llChat .ll-icon:hover{color:#2835d0;background:rgba(40,53,208,.08)}
  html[data-theme="light"] #llChat .ll-row.bot .ll-m{background:#f3f6fc;border-color:rgba(40,53,208,.16);color:#273651}
  html[data-theme="light"] #llChat .ll-row.user .ll-m{background:#edf2ff;border-color:rgba(40,53,208,.22);color:#202f68}
  html[data-theme="light"] #llChat .ll-in{background:#ffffff;color:#17233b}
  html[data-theme="light"] #llChat .ll-remove:hover{color:#2835d0;background:rgba(40,53,208,.08)}
  @media(max-width:560px){#llChat{right:0;bottom:0}#llChat .ll-win{width:100vw;height:min(460px,100dvh);border-radius:0;border-left:none}}
  @media(prefers-reduced-motion:reduce){#llChat .ll-win,#llChat .ll-icon,#llChat .ll-launcher{transition:none}}
  `;
  const styleEl = document.createElement('style');
  styleEl.textContent = css;
  document.head.appendChild(styleEl);

  const root = document.createElement('div');
  root.id = 'llChat';
  root.innerHTML = `
    <div class="ll-win" role="dialog" aria-modal="false" aria-label="Lines &amp; Logos website assistant">
      <div class="ll-head">
        <span class="ll-dot" aria-hidden="true"></span>
        <div class="ll-id"><b>Lines &amp; Logos</b><small>AI assistant · replies instantly</small></div>
        <button class="ll-icon ll-download" type="button" aria-label="Download chat transcript" title="Download chat">${icons.download}</button>
        <button class="ll-icon ll-min" type="button" aria-label="Minimize chat" title="Minimize chat">${icons.minimize}</button>
      </div>
      <div class="ll-msgs" aria-live="polite" aria-label="Chat messages"></div>
      <div class="ll-compose">
        <div class="ll-selection"><span></span><button class="ll-remove" type="button" aria-label="Remove attachment" title="Remove attachment">${icons.close}</button></div>
        <div class="ll-foot">
          <input class="ll-in" type="text" placeholder="Ask about services, pricing…" autocomplete="off" aria-label="Message">
          <input class="ll-file-input" type="file" accept=".png,.jpg,.jpeg,.pdf,.txt,.doc,.docx" hidden aria-label="Choose attachment">
          <button class="ll-icon ll-attach" type="button" aria-label="Attach a file" title="Attach a file">${icons.attach}</button>
          <button class="ll-icon ll-send" type="button" aria-label="Send message" title="Send message">${icons.send}</button>
        </div>
        <div class="ll-cap">Images, PDF, TXT, DOC, DOCX · 5 MB max</div>
        <div class="ll-cap" style="padding-top:0">Chats are kept 30 days to respond &amp; improve, then purged. Say “privacy” for details.</div>
      </div>
      <div class="ll-status" role="status" aria-live="polite"></div>
    </div>
    <button class="ll-dock" type="button" aria-label="Open Lines &amp; Logos chat" title="Open chat"><span class="ll-dock-label">${icons.chat}<span>Chat with us</span></span><span class="ll-dock-hint">click to expand</span></button>`;
  document.body.appendChild(root);

  const msgs = root.querySelector('.ll-msgs');
  const input = root.querySelector('.ll-in');
  const fileInput = root.querySelector('.ll-file-input');
  const selection = root.querySelector('.ll-selection');
  const status = root.querySelector('.ll-status');
  const sendButton = root.querySelector('.ll-send');
  const attachButton = root.querySelector('.ll-attach');
  const transcript = [];
  let session = '';
  let selectedFile = null;
  let sending = false;
  try { session = localStorage.getItem('ll_pub_sess') || ''; } catch {}

  function announce(text) { status.textContent = text; }
  function formatBytes(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  function extension(name) { return String(name).toLowerCase().split('.').pop(); }

  function add(who, text, attachment = null, record = true) {
    const at = new Date();
    if (record) transcript.push({ who, text, attachment, at });
    const row = document.createElement('div');
    row.className = `ll-row ${who}`;
    const bubble = document.createElement('div');
    bubble.className = 'll-m';
    bubble.textContent = text;
    if (attachment) {
      const file = document.createElement('div');
      file.className = 'll-file';
      file.innerHTML = `${icons.file}<span>${esc(attachment.name)} · ${formatBytes(attachment.size)}</span>`;
      bubble.appendChild(file);
    }
    row.appendChild(bubble);
    msgs.appendChild(row);
    msgs.scrollTop = msgs.scrollHeight;
    return row;
  }

  add('bot', "Hi! I'm the Lines & Logos assistant — ask me about gym floors, court striping, wall wraps, pricing, or whether we serve your city. You can also attach a file for our team to review.");

  function renderSelection() {
    const label = selection.querySelector('span');
    if (selectedFile) {
      label.textContent = `${selectedFile.name} · ${formatBytes(selectedFile.size)}`;
      selection.classList.add('show');
      attachButton.setAttribute('aria-label', `Replace attachment: ${selectedFile.name}`);
    } else {
      label.textContent = '';
      selection.classList.remove('show');
      attachButton.setAttribute('aria-label', 'Attach a file');
    }
  }

  function chooseFile(file) {
    if (!file) return;
    if (!ALLOWED_EXTENSIONS.includes(extension(file.name))) {
      announce('That file type is not supported. Choose an image, PDF, TXT, DOC, or DOCX file.');
      fileInput.value = '';
      return;
    }
    if (!file.size || file.size > MAX_FILE_SIZE) {
      announce('Choose a non-empty file no larger than 5 MB.');
      fileInput.value = '';
      return;
    }
    selectedFile = file;
    renderSelection();
    announce(`${file.name} attached. It will be sent with your next message.`);
  }

  function setMinimized(minimized) {
    root.classList.toggle('minimized', minimized);
    root.querySelector('.ll-win').setAttribute('aria-hidden', String(minimized));
    if (minimized) root.querySelector('.ll-dock').focus({ preventScroll: true });
    else input.focus({ preventScroll: true });
  }

  function downloadTranscript() {
    const lines = [
      'Lines & Logos — Chat Transcript',
      `Downloaded: ${new Date().toLocaleString()}`,
      '────────────────────────────────────────',
      ''
    ];
    transcript.forEach((item) => {
      lines.push(`[${item.at.toLocaleString()}] ${item.who === 'user' ? 'You' : 'Lines & Logos'}`);
      lines.push(item.text);
      if (item.attachment) lines.push(`Attachment: ${item.attachment.name} (${formatBytes(item.attachment.size)})`);
      lines.push('');
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const day = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download = `lines-logos-chat-${day}.txt`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    announce('Chat transcript downloaded.');
  }

  function fileAsBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
      reader.onerror = () => reject(new Error('Could not read the attachment.'));
      reader.readAsDataURL(file);
    });
  }

  function offlineBrain(message) {
    const t = (message || '').toLowerCase();
    if (/price|cost|quote|estimate|how much/.test(t)) return 'Pricing depends on square footage, service, and city — every quote includes the estimated sales tax for your location. Try our instant quote page (quotes.html) for a line-item number in about 30 seconds.';
    if (/area|where|city|travel|far|location|serve/.test(t)) return "We're based in Memphis and serve a 400-mile radius — Nashville, Atlanta, St. Louis, Louisville, Little Rock, Birmingham, New Orleans and everywhere between across TN, MS, AR, AL, MO, KY, LA, and IL.";
    if (/warrant|guarantee/.test(t)) return "Every project carries a written workmanship warranty — the exact terms are in your signed contract because they vary by surface system. Every job gets photo documentation and a final walkthrough. Details: legal.html#warranty";
    if (/job|career|hiring|apply/.test(t)) return "We're hiring installers, striping techs, and wrap techs across the footprint — leave your name and email and we'll send the application link.";
    if (/human|person|call/.test(t)) return 'Leave your name and the best number or email — a real person will reach out within one business day. You can also reach us at info@linesandlogos.team.';
    return 'Happy to help! We handle gym floors, court striping, wall wraps, donors walls, signage, and playground surfacing within 400 miles of Memphis.';
  }

  async function send() {
    const text = input.value.trim();
    const outgoingFile = selectedFile;
    if (sending || (!text && !outgoingFile)) return;
    sending = true;
    sendButton.disabled = true;
    attachButton.disabled = true;
    input.value = '';
    selectedFile = null;
    renderSelection();
    add('user', text || 'Shared an attachment for the team to review.', outgoingFile ? { name: outgoingFile.name, size: outgoingFile.size } : null);
    const typing = add('bot', '…', null, false);

    try {
      const payload = { message: text, session, page: location.pathname };
      if (outgoingFile) {
        payload.attachment = {
          name: outgoingFile.name,
          type: outgoingFile.type,
          size: outgoingFile.size,
          data: await fileAsBase64(outgoingFile)
        };
      }
      const response = await fetch(BASE + '/api/chat-public', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const out = await response.json().catch(() => ({ error: 'The server returned an unreadable response.' }));
      if (!response.ok) throw new Error(out.error || 'The message could not be sent.');
      session = out.session || session;
      try { localStorage.setItem('ll_pub_sess', session); } catch {}
      typing.remove();
      add('bot', out.reply);
      announce(outgoingFile ? 'Message and attachment sent.' : 'Message sent.');
    } catch (error) {
      typing.remove();
      let reply = offlineBrain(text) + "\n\n(Note: I'm answering offline, so this message has not reached our team. Reconnect and resend it when you're ready.)";
      if (outgoingFile) reply += '\n\nThe attachment was not uploaded. Reconnect and attach it again so our team can receive it.';
      if (error.message && !/fetch|network|unreadable/i.test(error.message)) reply = `I couldn't send that: ${error.message}`;
      add('bot', reply);
      announce('Message not uploaded. Please reconnect and try again.');
    } finally {
      sending = false;
      sendButton.disabled = false;
      attachButton.disabled = false;
      input.focus({ preventScroll: true });
    }
  }

  sendButton.addEventListener('click', send);
  input.addEventListener('keydown', (event) => { if (event.key === 'Enter' && !event.isComposing) send(); });
  attachButton.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => chooseFile(fileInput.files[0]));
  root.querySelector('.ll-remove').addEventListener('click', () => {
    selectedFile = null;
    fileInput.value = '';
    renderSelection();
    announce('Attachment removed.');
  });
  root.querySelector('.ll-download').addEventListener('click', downloadTranscript);
  // start minimized (docked bar); then pop the messenger open once per session
  // so visitors see the greeting — collapsing returns to the 1cm dock.
  setMinimized(true);
  const alreadyPopped = sessionStorage.getItem('ll_popped');
  if (!alreadyPopped){
    sessionStorage.setItem('ll_popped', '1');
    setTimeout(() => { setMinimized(false); input.focus({ preventScroll: true }); }, 1400);
  }
  root.querySelector('.ll-min').addEventListener('click', () => setMinimized(true));
  root.querySelector('.ll-dock').addEventListener('click', () => setMinimized(false));
  root.querySelector('.ll-win').addEventListener('keydown', (event) => { if (event.key === 'Escape') setMinimized(true); });
})();
