import { io } from "socket.io-client"
import { getSocketUrl } from "@/lib/public-runtime"

const socketUrl = typeof window !== "undefined" ? getSocketUrl() : process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3001"

export const socket = io(socketUrl, {
  transports: ["websocket"],
})
