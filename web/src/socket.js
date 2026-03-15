import { io } from 'socket.io-client'

const socket = io({
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionDelay: 500,
  reconnectionDelayMax: 3000,
  reconnectionAttempts: Infinity,
  timeout: 60000,
})

export default socket
