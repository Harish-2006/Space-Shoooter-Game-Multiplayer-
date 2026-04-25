export const socket = io();

export function sendPlayerUpdate(data) {
  socket.emit("playerUpdate", data);
}

export function shoot() {
  socket.emit("shoot");
}
