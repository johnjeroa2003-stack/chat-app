const socket = io();

const roomListDiv = document.getElementById("roomList");
const chatBox = document.getElementById("chatBox");
const usersList = document.getElementById("usersList");
const status = document.getElementById("status");
const input = document.getElementById("messageInput");

const usernameInput = document.getElementById("usernameInput");
const newRoomInput = document.getElementById("newRoomInput");

let username = "";
let room = "";

/* 🎙 VOICE */
let localStream = null;
let peerConnections = {};
let audioElements = {};
let isMuted = true;

/* =========================
   💾 SAVE USERNAME ONLY
========================= */

const savedUser = localStorage.getItem("username");

if (savedUser && usernameInput) {
  usernameInput.value = savedUser;
}

/* =========================
   ROOMS
========================= */

socket.emit("getRooms");

socket.on("roomsList", (rooms) => {
  roomListDiv.innerHTML = "";

  for (let r in rooms) {
    const div = document.createElement("div");
    div.classList.add("room");

    div.innerHTML = `<span>${r}</span><span>${rooms[r]}</span>`;
    div.onclick = () => joinRoom(r);

    roomListDiv.appendChild(div);
  }
});

/* =========================
   JOIN ROOM
========================= */

function joinRoom(selectedRoom) {
  const name = usernameInput.value.trim();
  if (!name) return alert("Enter name");

  username = name;
  room = selectedRoom;

  localStorage.setItem("username", username); // save only name

  socket.emit("joinRoom", { username, room });

  document.querySelector(".lobby").style.display = "none";
  document.querySelector(".chat-container").style.display = "flex";

  document.getElementById("roomName").innerText = room;

  setTimeout(() => input.focus(), 300);
}

/* Create room */
function createRoom() {
  const r = newRoomInput?.value.trim();
  if (!r) return;

  joinRoom(r);
}

/* Leave */
function leaveRoom() {
  location.reload();
}

/* =========================
   CHAT
========================= */

socket.on("message", (msg) => {
  addMessage(msg, "stranger");
});

socket.on("roomUsers", (users) => {
  usersList.innerHTML = "";

  users.forEach((u) => {
    const div = document.createElement("div");
    div.innerText = u;
    usersList.appendChild(div);
  });

  status.innerText = users.length + " users";
});

function sendMessage() {
  const msg = input.value.trim();
  if (!msg) return;

  socket.emit("chatMessage", username + ": " + msg);
  addMessage("You: " + msg, "you");

  input.value = "";
}

function addMessage(msg, type) {
  const div = document.createElement("div");
  div.classList.add("message", type);
  div.innerText = msg;

  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight;
}

/* =========================
   🎙 VOICE CHAT
========================= */

const voiceBtn = document.querySelector(".voice-btn");

if (voiceBtn) voiceBtn.addEventListener("click", toggleVoice);

async function startVoice() {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ audio: true });

    socket.emit("voice-ready");

    isMuted = false;
    voiceBtn.innerText = "🔊";
  } catch {
    alert("Mic permission denied");
  }
}

function toggleVoice() {
  if (!localStream) {
    startVoice();
    return;
  }

  isMuted = !isMuted;
  localStream.getAudioTracks()[0].enabled = !isMuted;

  voiceBtn.innerText = isMuted ? "🔇" : "🔊";
}

/* WebRTC */

socket.on("voice-user-joined", async (id) => {
  const pc = createPeerConnection(id);
  peerConnections[id] = pc;

  localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  socket.emit("voice-offer", { to: id, offer });
});

socket.on("voice-offer", async ({ from, offer }) => {
  const pc = createPeerConnection(from);
  peerConnections[from] = pc;

  localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));

  await pc.setRemoteDescription(offer);
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);

  socket.emit("voice-answer", { to: from, answer });
});

socket.on("voice-answer", async ({ from, answer }) => {
  await peerConnections[from].setRemoteDescription(answer);
});

socket.on("voice-ice", ({ from, candidate }) => {
  peerConnections[from].addIceCandidate(candidate);
});

function createPeerConnection(id) {
  const pc = new RTCPeerConnection({
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
  });

  pc.onicecandidate = (e) => {
    if (e.candidate) {
      socket.emit("voice-ice", { to: id, candidate: e.candidate });
    }
  };

  pc.ontrack = (e) => {
    const audio = document.createElement("audio");
    audio.srcObject = e.streams[0];
    audio.autoplay = true;

    document.body.appendChild(audio);
  };

  return pc;
}

/* =========================
   ENTER KEYS
========================= */

if (usernameInput) {
  usernameInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter" && newRoomInput.value.trim()) {
      createRoom();
    }
  });
}

if (newRoomInput) {
  newRoomInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      createRoom();
    }
  });
}

if (input) {
  input.addEventListener("keypress", (e) => {
    if (e.key === "Enter") sendMessage();
  });
}

/* =========================
   EMOJI
========================= */

const emojiBtn = document.getElementById("emojiBtn");

if (emojiBtn) {
  const picker = new EmojiButton();

  emojiBtn.addEventListener("click", () => {
    picker.togglePicker(emojiBtn);
  });

  picker.on("emoji", (emoji) => {
    input.value += emoji;
  });
}

/* =========================
   SMART FOCUS
========================= */

window.onload = () => {
  if (!savedUser && usernameInput) {
    usernameInput.focus();
  } else if (savedUser && newRoomInput) {
    newRoomInput.focus();
  }
};
