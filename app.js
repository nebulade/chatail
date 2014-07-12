#!/usr/bin/env node

'use strict';

var express = require('express'),
    path = require('path'),
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
});
mail.start();

var app = express();

var router = new express.Router();
app.use(urlencoded());
app.use(json());
app.use(express.static(__dirname + '/views'));
app.use(router);

router.post('/api/send', function (req, res) {
    mail.send(config.me, req.body.to, config.me, 'foo', req.body.message);
    res.send(200, {})
});

router.get('/api/messages', function (req, res) {
    res.send(200, { messages: mail.getByDate() });
});

var server = http.createServer(app);
server.listen(3000, function (error) {
    if (error) {
        console.log('Unable to start server.', error);
        process.exit(1);
    }

    console.log('Server running');
});