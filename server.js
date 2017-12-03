#!/usr/bin/env node
const express = require('express');
const app = express();
const spawn = require('child_process').spawn;
const fs = require('fs');
const bodyParser = require('body-parser');
const cors = require('cors');
const server = require('http').createServer();
const WebSocket = require('ws');
const wss = new WebSocket.Server({ server });

fs.writeFileSync('/var/run/app.pid', process.pid)

app.use(cors())

server.on('request', app);

wss.broadcast = function broadcast(data) {
  wss.clients.forEach(function each(client) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  });
};

wss.on('connection', async (ws, req)=>{
  let state = await relayctl('state');
  ws.send(JSON.stringify({ type: "SET_DATA", data: state }))
});


async function relayctl(...args) {
  return new Promise((resolve, reject)=>{
    let proc = spawn('/usr/local/bin/relayctl', args);
    let buf = "";
    proc.stdout.on('data', d=>buf+=d.toString());
    proc.on('exit', ()=> {
      try {
        resolve(JSON.parse(buf))
      } catch (e) {
        resolve()
      }
    });
  });
}

app.use(bodyParser.json());

app.get('/relays/:id', async (req, res, next) => {
  let state = await relayctl('state');
  res.json(state);
});

app.post('/relays/:id', async (req, res, next) => {
  let value = parseInt(req.body.value);
  if (value === 0) {
    await relayctl('on');
  } else {
    await relayctl('off');
  }
  res.status(201).end();
  let state = await relayctl('state');
  wss.broadcast(JSON.stringify({ type: "SET_DATA", data: state }))
});

process.on('SIGUSR1', async ()=>{
  let state = await relayctl('state');
  wss.broadcast(JSON.stringify({ type: "SET_DATA", data: state }))
});

server.listen(80);
