'use strict';

/* global angular:false */
/* jslint browser:true */

// create main application module
var app = angular.module('Chatail', ['ngSanitize']);

var MainController = function ($scope, $http) {
    $scope.data = {};
    $scope.data.messages = [];
    $scope.data.contacts = [];

    $scope.message = '';
    $scope.to = '';

    $scope.isSetToSend = function (contact) {
        return ($scope.to.indexOf(contact.email) !== -1);
    };

    $scope.send = function () {
        if (!$scope.to || !$scope.message) {
            console.error('No content to send');
            return;
        }

        var obj = {
            to: $scope.to.split(';'),
            message: $scope.message
        };

        $http.post('/api/send', obj).success(function(data, status, headers, config) {
            console.log('successfully sent message');
            $scope.message = '';
        }).error(function(data, status, headers, config) {
            console.error('Unable to send message', status, data);
        });
    };

    $scope.toggleRecepient = function (contact) {
        if ($scope.to.length === 0) {
            $scope.to = contact.email;
            return;
        }

        var emails = $scope.to.split(';');
        var index = emails.indexOf(contact.email);

        if (index === -1) emails.push(contact.email);
        else emails.splice(index, 1);

        $scope.to = emails.join(';');
    };

    function existsInArray(message, key, set) {
        var found = false;

        set.forEach(function (msg) {
            if (msg[key] === message[key]) found = true;
        });

        return found;
    }

    function refreshMessages() {
        $http.get('/api/messages').success(function(data, status, headers, config) {
            var count = $scope.data.messages.length;

            data.messages.forEach(function (message) {
                message.body = message.body.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
                message.body = '<div>' + message.body.replace(/\n/g, '<br/>') + '</div>';

                if (!existsInArray(message, 'seqno', $scope.data.messages)) {
                    $scope.data.messages.push(message);
                }
            });

            if (count !== $scope.data.messages.length) {
                setTimeout(function () {
                    window.scrollTo(0,document.body.scrollHeight);
                }, 250);
            }

            setTimeout(refreshMessages, 1000);
        }).error(function(data, status, headers, config) {
            console.error('Unable to get messages');
            setTimeout(refreshMessages, 1000);
        });
    }

    function refreshContacts() {
        $http.get('/api/contacts').success(function(data, status, headers, config) {
            data.contacts.forEach(function (contact) {
                if (!existsInArray(contact, 'email', $scope.data.contacts)) {
                    $scope.data.contacts.push(contact);
                }
            });

            setTimeout(refreshContacts, 5000);
        }).error(function(data, status, headers, config) {
            console.error('Unable to get messages');
            setTimeout(refreshContacts, 5000);
        });
    }

    refreshMessages();
    refreshContacts();
};
