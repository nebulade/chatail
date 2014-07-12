/* jslint node:true*/

'use strict';

var debug = require('debug')('server'),
    util = require('util'),
    Imap = require('imap'),
    nodemailer = require('nodemailer'),
    EventEmitter = require('events').EventEmitter;

exports = module.exports = Mail;

function Mail(config) {
    EventEmitter.call(this);

    var that = this;

    this.config = config;
    this.imapConfig = config.imap;
    this.smtpConfig = config.smtp;

    this.messages = {};
    this.timer = null;
    this.imap = new Imap(config.imap);

    this.imap.once('error', function (error) {
        that.emit('error', error);
    });

    this.imap.once('end', function () {
        console.log('Connection ended');
    });

    this.smtp = null;
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

Mail.prototype.parseMultipart = function (buffer, boundary) {
    var parts = buffer.split('\r\n');

    var content = [];
    var found = false;
    var headers = true;

    for (var i = 0; i < parts.length; ++i) {
        if (parts[i].indexOf('--' + boundary) === 0) {
            debug('found boundary');

            if (found) break;

            content = [];
            headers = true;
            continue;
        }

        if (headers && parts[i].indexOf('Content-Type: text/plain; charset=UTF-8') === 0) {
            debug('found content type text');

            found = true;
            continue;
        }

        if (headers && parts[i] === '') {
            debug('skip empty line after headers');
            headers = false;
            continue;
        }

        debug('add line ', parts[i]);

        content.push(parts[i]);
    }

    return content.join('\n');
};

Mail.prototype.send = function (from, to, cc, subject, message) {

    debug('send: ', from, to, subject, message);

    if (subject.indexOf('[chatail]') === -1) subject = '[chatail] ' + subject.trim();

    var mailOptions = {
        from: from,
        to: to,
        cc: cc,
        subject: subject,
        text: message
    }

    this.smtp.sendMail(mailOptions, function (error, result) {
        if (error) console.error('Failed to send message:', error);
        debug('Message successfully sent.');
    });
};

Mail.prototype.refresh = function (callback) {
    var that = this;

    this.imap.search([
        ['HEADER', 'SUBJECT', '[chatail]']
    ], function (error, results) {
        if (error) return that.emit('error', error);

        var f = that.imap.fetch(results, {
            bodies: ['HEADER.FIELDS (TO)', 'HEADER.FIELDS (FROM)', 'HEADER.FIELDS (SUBJECT)', 'HEADER.FIELDS (CONTENT-TYPE)', 'TEXT']
        });

        f.on('message', function (msg, seqno) {
            if (that.messages[seqno]) return;

            var subject = null;
            var body = null;
            var from = null;
            var to = null;
            var date = null;
            var multipartBoundry = null;

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
                    } else if (info.which === 'HEADER.FIELDS (CONTENT-TYPE)') {
                        if (buffer.indexOf('multipart/alternative') !== -1) {
                            multipartBoundry = buffer.split('boundary=')[1].replace(/\r\n/g, '');
                            debug('Multipart found with boundry', multipartBoundry);
                        }
                    }
                });
            });
            msg.once('attributes', function (attrs) {
                date = attrs.date;
            });
            msg.once('end', function () {
                if (multipartBoundry) {
                    debug('Handle multipart message');
                    body = that.parseMultipart(body, multipartBoundry);
                }

                that.messages[seqno] = {
                    me: (from[0].indexOf(that.config.me) !== -1),
                    from: from[0],
                    to: to,
                    date: date,
                    subject: subject[0],
                    body: that.decode(body)
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

Mail.prototype.decode = function (body) {
    var tmp = '';
    tmp = body.replace(/=0A=\r/g, '');
    tmp = body.replace(/=3F/g, '?');
    return tmp;
};

Mail.prototype.start = function () {

    var that = this;

    this.smtp = nodemailer.createTransport('SMTP', this.smtpConfig);

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
    this.smtp.close();
};
