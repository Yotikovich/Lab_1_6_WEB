import { io } from "socket.io-client";

const token = process.env.ACCESS_TOKEN;
const eventId = process.env.EVENT_ID ? Number(process.env.EVENT_ID) : null;

if (!token) {
  console.error("Не задано ACCESS_TOKEN");
  process.exit(1);
}

const socket = io(process.env.SOCKET_URL || "http://localhost:3000", {
  auth: { token },
  timeout: 5000,
});

socket.on("connect", () => {
  console.log("Підключено до Event Management Socket.IO:", socket.id);
  if (eventId && Number.isInteger(eventId) && eventId > 0) socket.emit("event:join", eventId);
});

socket.on("connected", (data) => console.log("Авторизацію підтверджено:", data));
socket.on("event:joined", (data) => console.log("Приєднано до кімнати події:", data));
socket.on("events:changed", (data) => console.log("Зміни подій:", data));
socket.on("registrations:changed", (data) => console.log("Зміни реєстрацій:", data));
socket.on("ticket:checked-in", (data) => console.log("Квиток перевірено на вході:", data));
socket.on("socket:error", (data) => console.error("Помилка Socket.IO:", data));
socket.on("connect_error", (error) => console.error("Помилка підключення:", error.message));

process.on("SIGINT", () => {
  if (eventId) socket.emit("event:leave", eventId);
  socket.disconnect();
  process.exit(0);
});
