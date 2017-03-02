var fs = require('fs');

const express = require('express');
const app = express();
const postApp = express();
const bodyParser = require('body-parser');
const port = process.env.WSPORT || 3000;
const postPort = process.env.POSTPORT || 5015;
const notificationSecret = process.env.NOTIFICATION_SECRET || 'NOTIFICATION_SECRET';
const notificationKey = process.env.NOTIFICATION_KEY || 'NOTIFICATION_KEY'
const EVENTS = {
    newNotification: 'NEW_NOTIFICATION'
};
var server;
var postServer;

if(process.env.SSL_KEY && process.env.SSL_CERT) {
    var options = {
      key: fs.readFileSync(process.env.SSL_KEY),
      cert: fs.readFileSync(process.env.SSL_CERT)
    };
    server = require('https').createServer(options, app);
    postServer = require('https').createServer(options, postApp);
} else {
    server = require('http').createServer(app);
    postServer = require('http').createServer(postApp);
}


const io = require('socket.io')(server, { path: '/stream/events'});
//(server);


server.listen(port, () => console.log('Server listening at port %d', port));
postServer.listen(postPort, () => console.log('Server listening at port %d', postPort));

postApp.use(bodyParser.json());
postApp.use(bodyParser.urlencoded({
    extended: true
}));

  //postApp.use(express.static(__dirname + '/public'));
postApp.get('/alive', (req,res) =>{
  return res.status(200).json('ok');
});

postApp.post('/send', (req, res) => {
    const data = req.body;
    const dispath = (channel, notification) => {
        io.to(channel).emit(EVENTS.newNotification, data.notification);
    };

    if (!req.headers || req.headers.notification_secret !== notificationSecret) {
        return res.status(401).json('invalid notification secret');
    }

    if (data && data.notification && data.channel) {
        if (data.channel.forEach) {
            data.channel.forEach(function (channel) {
                dispath(channel, data.notification);
            });
        } else {
            dispath(data.channel, data.notification);
        }

        return res.status(200).json('ok');
    }
    return res.status(406).json('Missing parameters');

});

io.on('connection', (socket) => {

    if(!validateConnection(socket.handshake.query)) {
        return;
    }

    socket.on('join', (channel) => {
        socket.join(channel);
    });

    socket.on('leave', (channel) => {
        socket.leave(channel);
    });
});


function validateConnection(query) {
    if (query.notificationKey !== notificationKey) {
        return;
    }
    return true;
}
