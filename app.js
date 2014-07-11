#!/usr/bin/env node

'use strict';

var debug = require('debug')('server'),
    Imap = require('imap');

var imap = new Imap(require('./config.json'));

var messages = {};

function openInbox(cb) {
    imap.openBox('INBOX', true, cb);
}

function printNewMessage(seqno) {
    console.log('');
    console.log('From:', messages[seqno].from);
    console.log('To:', messages[seqno].to);
    console.log('Date:', messages[seqno].date);
    console.log('Subject:', messages[seqno].subject);
    console.log('-------------------------------------------------------------------------------------');
    console.log(messages[seqno].body);
    console.log('');
}

function searchChatail(callback) {
    imap.search([
        ['HEADER', 'SUBJECT', '[chatail]']
    ], function (err, results) {
        if (err) throw err;
        var f = imap.fetch(results, {
            bodies: ['HEADER.FIELDS (TO)', 'HEADER.FIELDS (FROM)', 'HEADER.FIELDS (SUBJECT)', 'TEXT']
        });
        f.on('message', function (msg, seqno) {
            if (messages[seqno]) return;

            var subject = null;
            var body = null;
            var from = null;
            var to = null;
            var date = null;

            msg.on('body', function (stream, info) {
                var buffer = '';

                stream.on('data', function (chunk) {
                    buffer += chunk.toString('utf8');
                });

                stream.once('end', function () {
                    if (info.which === 'TEXT') {
                        body = buffer;
                    } else if (info.which === 'HEADER.FIELDS (SUBJECT)') {
                        subject = Imap.parseHeader(buffer).subject;
                    } else if (info.which === 'HEADER.FIELDS (FROM)') {
                        from = Imap.parseHeader(buffer).from;
                    } else if (info.which === 'HEADER.FIELDS (TO)') {
                        to = Imap.parseHeader(buffer).to;
                    }
                });
            });
            msg.once('attributes', function (attrs) {
                date = attrs.date;
            });
            msg.once('end', function () {
                messages[seqno] = {
                    from: from[0],
                    to: to,
                    date: date,
                    subject: subject[0],
                    body: body.replace(/=0A=\r/g, '')
                };

                printNewMessage(seqno);
            });
        });
        f.once('error', function (err) {
            console.log('Fetch error: ' + err);
        });
        f.once('end', function () {
            callback();
            // imap.end();
        });
    });
}

imap.once('ready', function () {
    openInbox(function (err, box) {
        if (err) throw err;

        function run() {
            searchChatail(function () {
                setTimeout(run, 1000);
            });
        }

        run();
    });
});

imap.once('error', function (err) {
    console.log(err);
});
imap.once('end', function () {
    console.log('Connection ended');
});

imap.connect();