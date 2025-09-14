import { Injectable } from "@nestjs/common";
import { io } from "socket.io-client";

@Injectable()
export class SocketService {
    socket1: any = null;

    constructor() {
        this.socket1 = this.createSocket("46.62.205.241")
    }

    emit(key: string, payload: any) {
        this.socket1.emit(key, payload)
    }

    createSocket(ip: string) {
        const socket = io(`http://${ip}:9000`, {
            // query: { phone: userInfo?.phone },
            secure: true,
        })
        socket.on('connect', () => {
            console.log('Connected to server admin page!.')
        })
        socket.on('error', (error) => {
            console.error('Socket connection error:', error)
        })
        socket.on('disconnect', () => {
            console.log('Disconnected from socket')
        })

        return socket
    }
}