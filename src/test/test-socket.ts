// import { io } from 'socket.io-client';
// import readline from 'readline';
//
// // ------------------ CONFIG ------------------
// const SERVER_URL = 'http://localhost:3000';
// const userId = process.argv[2] ? Number(process.argv[2]) : 1;
// // --------------------------------------------
//
// // tạo readline interface
// const rl = readline.createInterface({
//   input: process.stdin,
//   output: process.stdout,
// });
//
// const socket = io(SERVER_URL, {
//   transports: ['websocket'],
//   reconnection: true,
// });
//
// socket.on('connect', () => {
//   console.log(`✅ Connected to Socket.IO server (socket.id=${socket.id})`);
//   console.log(`➡️ Joining room for user ${userId}...`);
//   socket.emit('join', { userId });
// });
//
// socket.on('joined', (data) => {
//   console.log('📥 Joined room:', data);
//   console.log(`Bạn đang là user ${userId}.`);
//   console.log('👉 Nhập tin nhắn và Enter để gửi:');
//   promptSendMessage();
// });
//
// socket.on('new_message', (msg) => {
//   console.log(`\n💬 [From ${msg.sender_id}] ${msg.content}`);
//   promptSendMessage();
// });
//
// socket.on('message_sent', (msg) => {
//   console.log(`📤 [To ${msg.receiver_id}] Gửi thành công: "${msg.content}"`);
//   promptSendMessage();
// });
//
// socket.on('disconnect', () => console.log('❌ Disconnected'));
// socket.on('error', (err) => console.error('⚠️ Error:', err));
//
// // --- hàm nhập tin nhắn ---
// function promptSendMessage() {
//   rl.question('> ', (input) => {
//     if (!input.trim()) return promptSendMessage();
//
//     // lấy receiver_id theo user hiện tại (nếu bạn muốn dynamic thì có thể nhập sau)
//     const receiverId = userId === 1 ? 2 : 1;
//
//     socket.emit('send_message', {
//       sender_id: userId,
//       receiver_id: receiverId,
//       content: input.trim(),
//     });
//
//     promptSendMessage();
//   });
// }
