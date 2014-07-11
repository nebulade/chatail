/* jslint node:true*/

'use strict';

var debug = require('debug')('server'),
    util = require('util'),
    Imap = require('imap'),
    EventEmitter = require('events').EventEmitter;

exports = module.exports = Mail;

function Mail(config) {
    EventEmitter.call(this);

    var that = this;

    this.timer = null;
    this.imap = new Imap(config);

    this.imap.once('error', function (error) {
        that.emit('error', error);
    });

    this.imap.once('end', function () {
        console.log('Connection ended');
    });

    this.messages = {};
}
util.inherits(Mail, EventEmitter);

Mail.prototype.getByDate = function () {
    var tmp = [];

    for (var msg in this.messages) {
        tmp.push(this.messages[msg]);
    }

    tmp.sort(function (a, b) {
        return ((new Date(a.date)).getTime() - (new Date(b.date)).getTime());
    });

    return tmp;
};

Mail.prototype.refresh = function (callback) {
    var that = this;

    this.imap.search([
        ['HEADER', 'SUBJECT', '[chatail]']
    ], function (error, results) {
        if (error) return that.emit('error', error);

        var f = that.imap.fetch(results, {
            bodies: ['HEADER.FIELDS (TO)', 'HEADER.FIELDS (FROM)', 'HEADER.FIELDS (SUBJECT)', 'TEXT']
        });

        f.on('message', function (msg, seqno) {
            if (that.messages[seqno]) return;

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
                that.messages[seqno] = {
                    from: from[0],
                    to: to,
                    date: date,
                    subject: subject[0],
                    body: body.replace(/=0A=\r/g, '')
                };

                console.log('New Message:', that.messages[seqno]);
            });
        });
        f.once('error', function (error) {
            console.log('Fetch error: ' + error);
            that.emit('error', error);
        });
        f.once('end', function () {
            callback();
        });
    });
};

Mail.prototype.start = function () {

    var that = this;

    this.imap.connect();

    this.imap.once('ready', function () {
        that.imap.openBox('INBOX', true, function (error, box) {
            if (error) return that.emit('error', error);

            function run() {
                that.refresh(function () {
                    that.timer = setTimeout(run, 1000);
                });
            }

            run();
        });
    });
};

Mail.prototype.stop = function () {
    if (this.timer) clearTimeout(this.timer);

    this.imap.end();
};
