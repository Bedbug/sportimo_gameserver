'use strict';

var amqp = require('amqplib/callback_api');


const connString = 'amqps://gu-group:3iqAJvFlU0Y4bjB7MNkA4tu8tDMNI4QVYkh@queue.softnetsport.com/statscore';

let rabbit = null;
try {
    amqp.connect(connString, function (err, conn) {

        rabbit = conn;
        if (err) {
            console.log('Error connecting: ' + err.message);
            return;
        }
        else {
            console.log('About to create channel ...');
            conn.createChannel(function (chErr, ch) {
                if (chErr) {
                    console.log('Error creating channel: ' + chErr.message);
                    return;
                }
                else {
                    const queue = 'gu-group';
                    console.log('About to connect to queue ' + queue);
                    ch.assertQueue(queue, { durable: true });

                    ch.consume(queue, function (msg) {
                        console.log(" [x] Received msg %s", JSON.stringify(msg));
                        const payload = msg.content.toString();

                        console.log(" [x] Received payload %s", payload);
                        ch.ack(msg);
                    }, { noAck: false });
                }
            });
        }
    });
}
catch (error) {
    console.error('Error opening rabbit queue: ' + error.message);
}


module.exports = rabbit;

