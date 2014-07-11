#!/usr/bin/env node

'use strict';

var express = require('express'),
    path = require('path'),
    http = require('http'),
    Mail = require('./mail.js');

var mail = new Mail(require('./config.json'));
mail.on('error', function (error) {
    console.log('ERROR:', error);
});
mail.start();

var app = express();

app.set('views', path.join(__dirname, 'views'));
app.set('view options', { layout: true, debug: true });
app.set('view engine', 'ejs');

var router = new express.Router();
app.use(router);

router.get('*', function (req, res) {
    res.render('index', {
        messages: mail.getByDate(),
        owner: 'Johannes Zellner <johannes@nebulon.de>'
    });
});

var server = http.createServer(app);
server.listen(3000, function (error) {
    if (error) {
        console.log('Unable to start server.', error);
        process.exit(1);
    }

    console.log('Server running');
});