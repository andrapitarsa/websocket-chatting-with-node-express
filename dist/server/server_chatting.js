"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const bodyParser = require("body-parser");
const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
//initialize a simple http server
const server = http.createServer(app);
server.listen(8999);
const wssRoomsChatQuiz = [];
const setIntervals = [];
app.post("/room", function (req, res) {
    if (wssRoomsChatQuiz[req.body.roomId] === undefined) {
        wssRoomsChatQuiz[req.body.roomId] = new WebSocket.Server({
            noServer: true,
            path: "/" + req.body.roomId
        });
        createIntervalWssRoomChat(req);
        res.status(201).json({ success: "Room is created" });
    }
    else {
        res.status(409).json({ error: "Room is exist" });
    }
    runningWssRoomChat();
});
app.delete("/room", function (req, res) {
    if (wssRoomsChatQuiz[req.body.roomId] !== undefined) {
        const idxWss = wssRoomsChatQuiz.indexOf(req.body.roomId);
        wssRoomsChatQuiz[req.body.roomId].close();
        wssRoomsChatQuiz.splice(idxWss, 1);
        const idxInterval = setIntervals.indexOf(req.body.roomId);
        clearInterval(setIntervals[req.body.roomId]);
        setIntervals.splice(idxInterval, 1);
        res.status(200).json({ success: "Room is deleted" });
    }
    else {
        res.status(404).json({ error: "Room is not found" });
    }
});
function createMessage(message, isSender = false, sender, dateTime) {
    return JSON.stringify(new Message(message, isSender, sender, dateTime));
}
class Message {
    constructor(content, isSender, sender, dateTime) {
        this.content = content;
        this.isSender = isSender;
        this.sender = sender;
        this.dateTime = dateTime;
    }
}
exports.Message = Message;
function createIntervalWssRoomChat(req) {
    setIntervals[req.body.roomId] = setInterval(() => {
        wssRoomsChatQuiz[req.body.roomId].clients.forEach((ws) => {
            const extWs = ws;
            if (!extWs.isAlive)
                return ws.terminate();
            extWs.isAlive = false;
            ws.ping(null, undefined);
            ws.send('{ "onlineCount": ' +
                wssRoomsChatQuiz[req.body.roomId].clients.size +
                "}");
        });
    }, 10000);
}
function runningWssRoomChat() {
    wssRoomsChatQuiz.forEach(wss => {
        wss.on("connection", function connection(ws, request) {
            const extWs = ws;
            extWs.isAlive = true;
            ws.on("pong", () => {
                extWs.isAlive = true;
            });
            //connection is up, let's add a event message
            ws.on("message", (msg) => {
                const message = JSON.parse(msg);
                setTimeout(() => {
                    wss.clients.forEach((client) => {
                        client.send(createMessage(message.content, true, message.sender, new Date().getTime()));
                    });
                    ws.send(createMessage(message.content, false, message.sender, new Date().getTime()));
                }, 1000);
            });
            ws.on("error", err => {
                console.warn("Client disconnected - reason: " + err);
            });
        });
    });
}
server.on("upgrade", function upgrade(request, socket, head) {
    const pathname = request.url.replace("/", "");
    if (wssRoomsChatQuiz[pathname] !== undefined) {
        wssRoomsChatQuiz[pathname].handleUpgrade(request, socket, head, function callback(ws) {
            wssRoomsChatQuiz[pathname].emit("connection", ws, request);
        });
    }
    else {
        socket.destroy();
    }
});
//# sourceMappingURL=server_chatting.js.map