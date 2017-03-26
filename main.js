
var app = angular.module('app', ['ngMaterial','ngAnimate','ngRoute','chart.js','ui.ace','nlpCompromise']);

var URL_PREFIX = 'http://localhost:8000/';
var CLIENT_ID='6IHW13vUvCYWrSQLTMaXPW1Sd1BICxgeWSOwQWmw';
var CLIENT_SECRET='3GpWUcoGhov6aIDQ0KTffkwH72LfN4DOEciNXfWljPwichBNwq1sb2UY0UsFSuiX4T3eeRvmL5djBreEGIbKJaxKcY1aUSZdNiZ8SfQg3W434PYhoWlQNjUEW0HYd5PT';
// using angular material without any default theme
app.config(function($mdThemingProvider) {
  $mdThemingProvider.theme('default')
  .primaryPalette('teal', {
   'default': '400', // by default use shade 400 from the pink palette for primary intentions
   'hue-1': '100', // use shade 100 for the <code>md-hue-1</code> class
   'hue-2': '600', // use shade 600 for the <code>md-hue-2</code> class
   'hue-3': 'A100' // use shade A100 for the <code>md-hue-3</code> class
  })
  .accentPalette('orange');
});
app.config(function ($httpProvider) {
  $httpProvider.defaults.headers.common = {};
  $httpProvider.defaults.headers.post = {};
  $httpProvider.defaults.headers.put = {};
  $httpProvider.defaults.headers.patch = {};
});
app.config(["$routeProvider", "$locationProvider", function($routeProvider, $locationProvider) {
  $routeProvider.when("/", {
    controller: "MainCtrl",
    templateUrl: "templates/home.html"
  }).when("/play", {
    controller: "MainCtrl",
    templateUrl: "templates/play.html"
  }).when("/details", {
    controller: "detailCtrl",
    templateUrl: "templates/details.html",
    resolve: {
        auth: function ($q, Auth) {
            var userInfo = Auth.getUserInfo();
            if (userInfo) {
                return $q.when(userInfo);
            } else {
                return $q.reject({ authenticated: false });
            }
        }
    }
  }).when("/trader", {
    controller: "TextEditorCtrl",
    templateUrl: "templates/trader.editor.html",
    resolve: {
        auth: function ($q, Auth) {
            var userInfo = Auth.getUserInfo();
            if (userInfo) {
                return $q.when(userInfo);
            } else {
                return $q.reject({ authenticated: false });
            }
        }
    }
  }).when("/editor", {
    controller: "CodeEditorCtrl",
    templateUrl: "templates/editor.html",
    resolve: {
        auth: function ($q, Auth) {
            var userInfo = Auth.getUserInfo();
            if (userInfo) {
                return $q.when(userInfo);
            } else {
                return $q.reject({ authenticated: false });
            }
        }
    }
  }).when("/file", {
    controller: "FileCtrl",
    templateUrl: "templates/file.html",
    resolve: {
        auth: function ($q, Auth) {
            var userInfo = Auth.getUserInfo();
            if (userInfo) {
                return $q.when(userInfo);
            } else {
                return $q.reject({ authenticated: false });
            }
        }
    }
  });
}]);
app.run(["$rootScope", "$location", function ($rootScope, $location) {
    $rootScope.$on("$routeChangeSuccess", function (userInfo) {
        console.log(userInfo);
    });

    $rootScope.$on("$routeChangeError", function (event, current, previous, eventObj) {
        if (eventObj.authenticated === false) {
            $location.path("/");
        }
    });
}]);
app.factory("Auth", ["$http","$q","$window",function ($http, $q, $window) {
    var userInfo;

    function login(user) {
        var url=URL_PREFIX+'login/';
        var deferred = $q.defer();
        $http({
             method: "POST",
             data: {
                'email':user.email,
                'password':user.password,
             },
             headers: {
                'Content-Type': 'application/json; charset=UTF-8'
              },
             url: url
           }).then(function successCallback(response) {
             console.log(response);
             userInfo = {
                 accessToken: response.data.access_token,
                 email: response.data.email
             };
             $window.sessionStorage["userInfo"] = JSON.stringify(userInfo);
             deferred.resolve(userInfo);
           }, function errorCallback(error) {
             deferred.reject(error);
         });
         return deferred.promise;
    };

    function logout() {
        var deferred = $q.defer();

        $http({
            method: "POST",
            url: "/api/logout",
            headers: {
                "access_token": userInfo.accessToken
            }
        }).then(function (result) {
            userInfo = null;
            $window.sessionStorage["userInfo"] = null;
            deferred.resolve(result);
        }, function (error) {
            deferred.reject(error);
        });

        return deferred.promise;
    };

    function getUserInfo() {
        return userInfo;
    }

    function init() {
        if ($window.sessionStorage["userInfo"]) {
            userInfo = JSON.parse($window.sessionStorage["userInfo"]);
        }
    }
    init();

    return {
        login: login,
        logout: logout,
        getUserInfo: getUserInfo
    };
}]);