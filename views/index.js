'use strict';

/* global angular:false */

// create main application module
var app = angular.module('Chatail', ['ngSanitize']);

var MainController = function ($scope, $http) {
    $scope.data = {};
    $scope.data.messages = [];

    $scope.message = '';
    $scope.to = '';

    $scope.send = function () {
        if (!$scope.to || !$scope.message) {
            console.error('No content to send');
            return;
        }

        var obj = {
            to: $scope.to,
            message: $scope.message
        };

        $http.post('/api/send', obj).success(function(data, status, headers, config) {
            console.log('successfully sent message');
            $scope.message = '';
            refresh();
        }).error(function(data, status, headers, config) {
            console.error('Unable to send message', status, data);
        });
    };

    function refresh() {
        $http.get('/api/messages').success(function(data, status, headers, config) {
            var count = $scope.data.messages.length;

            $scope.data.messages = [];
            data.messages.forEach(function (message) {
                message.body = message.body.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
                message.body = '<div>' + message.body.replace(/\n/g, '<br/>') + '</div>';
                $scope.data.messages.push(message);
            });

            if (count !== $scope.data.messages.length) {
                console.log('scroll')
                setTimeout(function () {
                    window.scrollTo(0,document.body.scrollHeight);
                }, 250);
            }

            setTimeout(refresh, 1000);
        }).error(function(data, status, headers, config) {
            console.error('Unable to get messages');
            setTimeout(refresh, 1000);
        });
    }

    refresh();
};
