let recognition = null;
let isListening = false;

const synth = window.speechSynthesis;
const chatList = document.getElementById("chatList");
const chatOutput = document.getElementById("chatOutput");
const textInput = document.getElementById("textInput");
const talkButton = document.getElementById("talkButton");
const listenButton = document.getElementById("listenButton");
const submitText = document.getElementById("submitText");
const exportBtn = document.getElementById("exportBtn");
const newChatBtn = document.getElementById("newChatBtn");
const darkModeToggle = document.getElementById("darkModeToggle");

let currentSessionId = `chat-${Date.now()}`;
let sessions = JSON.parse(localStorage.getItem("chatSessions")) || {};
sessions[currentSessionId] = [];
saveSessions();
renderChatList();

function speak(text) {
  const utter = new SpeechSynthesisUtterance(text);
  synth.speak(utter);
}

function addMessage(content, sender = "user") {
  const msg = document.createElement("div");
  msg.className = `message ${sender}`;
  msg.textContent = content;
  chatOutput.appendChild(msg);

  setTimeout(() => {
    chatOutput.scrollTop = chatOutput.scrollHeight;
  }, 100);

  sessions[currentSessionId].push({ sender, content, time: new Date() });
  saveSessions();
}

function singularize(word) {
  return word.endsWith("s") ? word.slice(0, -1) : word;
}

function processTextCommand(command) {
  const cmd = command.toLowerCase().trim();
  addMessage(command, "user");

  if (cmd.startsWith("open ")) {
    const site = cmd.replace("open ", "").trim();
    const url = site.includes("http") ? site : `https://${site.replace(/ /g, "")}.com`;
    window.open(url, "_blank");
    speak(`Opening ${site}`);
    addMessage(`Opening ${site}...`, "assistant");
    return;
  }

  const patterns = [
    /^who is (.+)/,
    /^what is (.+)/,
    /^what is that (.+)/,
    /^explain the (.+)/,
    /^why are (.+)/,
    /^can you tell (.+)/,
    /^explain these (.+)/,
    /^tell me the (.+)/,
    /^explain details (.+)/,
    /^define (.+)/,
    /^what do you know about (.+)/,
    /^give me info about (.+)/,
    /^give me (\d+) number of lines (.+)/,
    /^write (\d+) number of (.+)/,
  ];

  for (let pattern of patterns) {
    const match = cmd.match(pattern);
    if (match) {
      if (match.length === 3 && !isNaN(match[1])) {
        const lines = parseInt(match[1]);
        const topic = singularize(match[2].trim());
        fetchLimitedLines(topic, lines);
        return;
      }
      const topic = match[1].trim();
      fetchDuckDuckGoAnswer(topic);
      return;
    }
  }

  const fallbackMatch = cmd.match(/(?:explain|tell me|give me|write|details|definition|meaning of)?\s*(.+)/);
  if (fallbackMatch && fallbackMatch[1]) {
    const topic = fallbackMatch[1].trim();
    fetchDuckDuckGoAnswer(topic);
    return;
  }

  addMessage("I'm not sure, but I’ll try to improve. Try asking again.", "assistant");
  speak("I’m not sure, try again.");
}

async function fetchDuckDuckGoAnswer(query) {
  try {
    const res = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_redirect=1`);
    const data = await res.json();
    const answer = data.Abstract || data.Answer || data.Definition || "";

    if (answer) {
      addMessage(`📖 ${answer}`, "assistant");
      speak(answer);

      if (data.AbstractURL) {
        const link = document.createElement("a");
        link.href = data.AbstractURL;
        link.target = "_blank";
        link.textContent = "📘 Source";
        chatOutput.appendChild(link);
      }
    } else {
      await fetchWikipediaSummary(query);
    }
  } catch (err) {
    console.error("DuckDuckGo error:", err);
    await fetchWikipediaSummary(query);
  }
}

async function fetchWikipediaSummary(query) {
  try {
    const res = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`);
    const data = await res.json();

    if (data.extract) {
      const container = document.createElement("div");
      container.className = "wiki-result";

      if (data.thumbnail?.source) {
        const img = document.createElement("img");
        img.src = data.thumbnail.source;
        img.alt = query;
        img.className = "wiki-image";
        container.appendChild(img);
      }

      const desc = document.createElement("p");
      desc.innerHTML = `📖 ${data.extract}`;
      container.appendChild(desc);

      const sourceLink = document.createElement("a");
      sourceLink.href = data.content_urls.desktop.page;
      sourceLink.target = "_blank";
      sourceLink.textContent = "📘 Wikipedia Source";
      container.appendChild(sourceLink);

      chatOutput.appendChild(container);
      chatOutput.scrollTop = chatOutput.scrollHeight;

      speak(data.extract);

      sessions[currentSessionId].push({ sender: "assistant", content: data.extract, time: new Date() });
      saveSessions();
    } else {
      addMessage("I couldn't find an answer. Try rephrasing.", "assistant");
      speak("Sorry, I couldn’t find anything useful.");
    }
  } catch (err) {
    console.error("Wikipedia error:", err);
    addMessage("Network error while fetching data.", "assistant");
    speak("Network error while fetching data.");
  }
}

async function fetchLimitedLines(topic, lines = 3) {
  try {
    const res = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(topic)}`);
    const data = await res.json();

    if (data.extract) {
      const extractLines = data.extract.split(". ").slice(0, lines).join(". ") + ".";
      const container = document.createElement("div");
      container.className = "wiki-result";

      if (data.thumbnail?.source) {
        const img = document.createElement("img");
        img.src = data.thumbnail.source;
        img.alt = topic;
        img.className = "wiki-image";
        container.appendChild(img);
      }

      const desc = document.createElement("p");
      desc.innerHTML = `📖 ${extractLines}`;
      container.appendChild(desc);

      const sourceLink = document.createElement("a");
      sourceLink.href = data.content_urls.desktop.page;
      sourceLink.target = "_blank";
      sourceLink.textContent = "📘 Wikipedia Source";
      container.appendChild(sourceLink);

      chatOutput.appendChild(container);
      chatOutput.scrollTop = chatOutput.scrollHeight;

      speak(extractLines);

      sessions[currentSessionId].push({ sender: "assistant", content: extractLines, time: new Date() });
      saveSessions();
    } else {
      addMessage("I couldn't find an answer. Try rephrasing.", "assistant");
      speak("Sorry, I couldn’t find anything useful.");
    }
  } catch (err) {
    console.error("Fetch error:", err);
    addMessage("Error while fetching info.", "assistant");
    speak("Error while fetching data.");
  }
}

function saveSessions() {
  localStorage.setItem("chatSessions", JSON.stringify(sessions));
}

function renderChatList() {
  chatList.innerHTML = "";
  const entries = Object.entries(sessions).sort((a, b) => new Date(b[1]?.[0]?.time || 0) - new Date(a[1]?.[0]?.time || 0));

  for (const [id, messages] of entries) {
    const li = document.createElement("li");
    li.textContent = messages[0]?.content?.slice(0, 20) || "New Chat";
    li.onclick = () => loadChat(id);
    chatList.appendChild(li);
  }
}

function loadChat(id) {
  currentSessionId = id;
  chatOutput.innerHTML = "";
  sessions[id].forEach(msg => addMessage(msg.content, msg.sender));
}

submitText.onclick = () => {
  const text = textInput.value.trim();
  if (text) {
    processTextCommand(text);
    textInput.value = "";
  }
};

textInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") submitText.click();
});

talkButton.onclick = () => {
  speak("Hi, how can I help you?");
};

listenButton.onclick = () => {
  if (!('webkitSpeechRecognition' in window)) {
    alert("Speech Recognition not supported.");
    return;
  }

  recognition = new webkitSpeechRecognition();
  recognition.lang = 'en-US';
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.start();

  recognition.onresult = (e) => {
    const transcript = e.results[0][0].transcript;
    textInput.value = transcript;
    submitText.click();
  };

  recognition.onerror = (e) => {
    console.error("Speech recognition error:", e);
    speak("Sorry, I didn't catch that.");
  };
};

newChatBtn.onclick = () => {
  currentSessionId = `chat-${Date.now()}`;
  sessions[currentSessionId] = [];
  chatOutput.innerHTML = "";
  saveSessions();
  renderChatList();
};

if (localStorage.getItem("darkMode") === "true") {
  document.body.classList.add("dark");
  darkModeToggle.checked = true;
}

darkModeToggle.onchange = () => {
  const isDark = darkModeToggle.checked;
  document.body.classList.toggle("dark", isDark);
  localStorage.setItem("darkMode", isDark);
};

exportBtn.onclick = () => {
  const blob = new Blob([JSON.stringify(sessions, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "altaf_chat_history.json";
  link.click();
};
