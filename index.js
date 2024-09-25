import express from 'express';
import { readFileSync } from 'fs';
import { SerialPort } from 'serialport';
import { ReadlineParser } from '@serialport/parser-readline';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';

//carregar arquivo de configurações
let configsPath = 'C:\\Program Files\\nodejs\\comunicacao_balanca\\configs.json';
console.log(configsPath);
const configs = JSON.parse(readFileSync(configsPath, 'utf-8'));

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

//configuração da porta serial
const port = new SerialPort({
  path: configs.ComPort,// caminho da porta COM da balança
  baudRate: configs.BaudRate, // Taxa de transmissão da balança
  dataBits: configs.DataBits,
  stopBits: configs.StopBits,
  parity: configs.Parity,
});

port.on('open', () => {
  console.log('Conexão com a balança estabelecida');

  const comandoSolicitarPeso = '\x05';
  port.write(comandoSolicitarPeso, (err) => {
    if (err) {
      return console.error('Erro ao enviar comando para a balança: ', err.message);
    }
    console.log('Comando ENQ envido com sucesso');
  });
});

port.on('error', (err) => {
  console.error('Erro na porta serial: ', err.message);
})

const parser = port.pipe(new ReadlineParser({ delimiter: '\x03' }));

// Quando receber os dados da balança
parser.on('data', (data) => {
  const weight = (data.replace(/[^0-9]/, ''))/1000;
  console.log(data)

  if (weight !== Number) {
    console.log(`Peso recebido: ${weight}`);

    // Enviar o peso para todos os clientes conectados via WebSocket
    wss.clients.forEach((client) => {
      if (client.readyState === 1) { // Verifica se o cliente está conectado
        client.send(JSON.stringify({ weight }));
      }
    });
  } else {
    console.log(`Dados inválidos ou não reconhecidos da balança: ${data}`);
  }
});

// Lidar com conexões WebSocket
wss.on('connection', (ws) => {
  console.log('Cliente conectado via WebSocket');

  ws.on('message', (message) => {
    console.log(`Mensagem recebida do cliente: ${message}`);

    if (message === 'solicitarPeso') {
      // Quando o cliente solicitar o peso, podemos forçar uma nova leitura da balança
      const comandoSolicitarPeso = '\x05';
      port.write(comandoSolicitarPeso, (err) => {
        if (err) {
          return console.error('Erro ao enviar comando para a balança: ', err.message);
        }
        console.log('Comando ENQ enviado por solicitação do cliente');
      });
    }
  });

  ws.on('error', (error) => {
    console.error("Erro no WebSocket: ", error.message);
  });

  ws.on('close', () => {
    console.log('Cliente desconectado do WebSocket');
  });
});


// Endpoint do servidor
app.get('/', (req, res) => {
  res.send('Servidor da balança funcionando');
});

const portServer = configs.PortServer || 3000; // Caso não tenha valor no configs.json, usa porta 3000 como padrão
server.listen(portServer, () => {
  console.log(`Servidor rodando na porta ${portServer}`);
});