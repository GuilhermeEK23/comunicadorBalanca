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
  const weight = data.replace(/[^0-9]/, '')/1000;
  console.log(data)

  if (weight !== Number) {
    console.log(`Peso recebido: ${weight}`);

    // Enviar dados ao frontend via WebSocket
    wss.on('connection', (ws) => {
      ws.on('message', (message) => {
        console.log(`Mensagem recebida do cliente: ${message}`);
    
        if (message == 'solicitarPeso') {
          console.log('enviando resposta')
          ws.send(weight);
        }
      })
    
      ws.on('error', (error) => {
        console.error("Erro no WebSocket: ", error.message);
      });
    });
  } else {
    console.log(`Dados inválidos ou não reconhecidos da balança: ${data}`);
  }

});



// Endpoint do servidor
app.get('/', (req, res) => {
  res.send('Servidor da balança funcionando');
});

const portServer = configs.PortServer || 3000; // Caso não tenha valor no configs.json, usa porta 3000 como padrão
server.listen(portServer, () => {
  console.log(`Servidor rodando na porta ${portServer}`);
});