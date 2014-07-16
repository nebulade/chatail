#!/usr/bin/env node

'use strict';

var express = require('express'),
    http = require('http'),
    urlencoded = require('body-parser').urlencoded,
    json = require('body-parser').json,
    Mail = require('./mail.js');

var config = require('./config.json');

if (!config.me) {
    console.error('Missing "me" field in config.json');
    process.exit(1);
}

if (!config.imap) {
    console.error('Missing imap configuration in config.json');
    process.exit(1);
}

if (!config.smtp) {
    console.error('Missing smtp configuration in config.json');
    process.exit(1);
}

var mail = new Mail(config);
mail.on('error', function (error) {
    console.log('ERROR:', error);
    mail.start();
});

mail.start();

var app = express();

var router = new express.Router();
app.use(urlencoded());
app.use(json());
app.use(express.static(__dirname + '/views'));
app.use(router);

router.post('/api/send', function (req, res) {
    var to = [];

    if (req.body.to instanceof Array) to = req.body.to;
    else to.push(req.body.to);

    mail.send(config.me, req.body.to, config.me, 'Chat', req.body.message, function (error) {
        if (error) return res.send(500, 'Unable to send message');
        res.send(200, {});
    });
});

router.get('/api/messages', function (req, res) {
    res.send(200, { messages: mail.getByDate() });
});

router.get('/api/contacts', function (req, res) {
    res.send(200, { contacts: mail.getContacts() });
});

var server = http.createServer(app);
server.listen(3000, function (error) {
    if (error) {
        console.log('Unable to start server.', error);
        process.exit(1);
    }

    console.log('Server running');
});