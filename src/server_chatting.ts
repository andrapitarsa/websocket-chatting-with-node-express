import * as express from "express";
import * as http from "http";
import * as WebSocket from "ws";
import * as bodyParser from "body-parser";

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

//initialize a simple http server
const server = http.createServer(app);
server.listen(8999);

const wssRoomsChatQuiz: any[] = [];
const setIntervals: any[] = [];

app.post("/room", function(req, res) {
  if (wssRoomsChatQuiz[req.body.roomId] === undefined) {
    wssRoomsChatQuiz[req.body.roomId] = new WebSocket.Server({
      noServer: true,
      path: "/" + req.body.roomId
    });

    createIntervalWssRoomChat(req);
    res.status(201).json({ success: "Room is created" });
  } else {
    res.status(409).json({ error: "Room is exist" });
  }

  runningWssRoomChat();
});

app.delete("/room", function(req, res) {
  if (wssRoomsChatQuiz[req.body.roomId] !== undefined) {
    const idxWss = wssRoomsChatQuiz.indexOf(req.body.roomId);
    wssRoomsChatQuiz[req.body.roomId].close();
    wssRoomsChatQuiz.splice(idxWss, 1);

    const idxInterval = setIntervals.indexOf(req.body.roomId);
    clearInterval(setIntervals[req.body.roomId]);
    setIntervals.splice(idxInterval, 1);

    res.status(200).json({ success: "Room is deleted" });
  } else {
    res.status(404).json({ error: "Room is not found" });
  }
});

interface ExtWebSocket extends WebSocket {
  isAlive: boolean;
}

function createMessage(
  message: string,
  isSender = false,
  sender: string,
  dateTime: number
): string {
  return JSON.stringify(new Message(message, isSender, sender, dateTime));
}

export class Message {
  constructor(
    public content: string,
    public isSender: boolean,
    public sender: string,
    public dateTime: number
  ) {}
}

function createIntervalWssRoomChat(req: { body: { roomId: string | number } }) {
  setIntervals[req.body.roomId] = setInterval(() => {
    wssRoomsChatQuiz[req.body.roomId].clients.forEach((ws: WebSocket) => {
      const extWs = ws as ExtWebSocket;

      if (!extWs.isAlive) return ws.terminate();

      extWs.isAlive = false;
      ws.ping(null, undefined);

      ws.send(
        '{ "onlineCount": ' +
          wssRoomsChatQuiz[req.body.roomId].clients.size +
          "}"
      );
    });
  }, 10000);
}

function runningWssRoomChat() {
  wssRoomsChatQuiz.forEach(wss => {
    wss.on("connection", function connection(ws: WebSocket, request: any) {
      const extWs = ws as ExtWebSocket;
      extWs.isAlive = true;

      ws.on("pong", () => {
        extWs.isAlive = true;
      });

      //connection is up, let's add a event message
      ws.on("message", (msg: string) => {
        const message = JSON.parse(msg) as Message;

        setTimeout(() => {
          wss.clients.forEach((client: { send: (arg0: string) => void }) => {
            client.send(
              createMessage(
                message.content,
                true,
                message.sender,
                new Date().getTime()
              )
            );
          });

          ws.send(
            createMessage(
              message.content,
              false,
              message.sender,
              new Date().getTime()
            )
          );
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
    wssRoomsChatQuiz[pathname].handleUpgrade(
      request,
      socket,
      head,
      function callback(ws: WebSocket) {
        wssRoomsChatQuiz[pathname].emit("connection", ws, request);
      }
    );
  } else {
    socket.destroy();
  }
});
