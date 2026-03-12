import { io } from 'socket.io-client'

const socket = io({
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
})

export default socket
