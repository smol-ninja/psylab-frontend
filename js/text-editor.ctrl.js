app.controller("TextEditorCtrl", function($scope, $rootScope, $q, $timeout, $routeParams, $location, $http, $sce, $mdDialog, $mdToast, $window, $log, $document, nlp, Auth) {
  var CONTENT_TYPE='application/json; charset=UTF-8';
  $scope.hideterm2=true;
  $scope.strategies=[];
  $scope.userFiles=[];
  $scope.frequencies=['Hourly','Daily','Weekly','Monthly','Yearly'];
  $scope.selectedFile='untitled';
  var file=$rootScope.selectedFile;
  $rootScope.selectedItemChange = selectedItemChange;
  function selectedItemChange(item) {
    $rootScope.selectedItem=item;
    console.log($rootScope.selectedItem);
  }
  $scope.fetchTickers= function(){
    var url=URL_PREFIX+'api/p/tickers/';
    $http({
         method: "GET",
         headers: {
            'Content-Type': CONTENT_TYPE
          },
         url: url
       }).then(function successCallback(response) {
         $rootScope.tickersArray=response.data;
         console.log(response);
       }, function errorCallback(error) {
     });
  };
  if ($rootScope.tickersArray===null || $rootScope.tickersArray===undefined){
    $scope.fetchTickers();
  }
  $scope.getTickers = function(searchText) {
    var deferred = $q.defer();
    $timeout(function() {
        var tickers = $rootScope.tickersArray.filter(function(ticker) {
            return (ticker.symbol.toUpperCase().indexOf(searchText.toUpperCase()) !== -1);
        });
        deferred.resolve(tickers);
    }, 0);
    return deferred.promise;
  };
  $scope.setSelectedFile= function(file){
    $scope.aceSession.setValue(file.strategy);
    $scope.strategies.shares=file.shares;
    $rootScope.selectedItem=file.ticker;
    $scope.strategyPk=file.pk;
    $scope.selectedFile=file.name;
    $scope.frequency=file.trade_frequency;
    $rootScope.selectedFile=null;
  };
  $timeout(function() {
    if (file!==null || file!==undefined){
      $scope.setSelectedFile(file);
    }
  }, 100);
  $scope.addTerminal=function () {
    $scope.hideterm2=!$scope.hideterm2;
  };
  $scope.aceChanged=function () {
    $rootScope.editor1code = $scope.aceSession.getDocument().getValue();
  };
  $scope.backTest=function(){
    $location.path("/backtest");
    $rootScope.selectedFile=file;
  };
  $scope.logInUser=function (user) {
    Auth.login(user).then(function(response) {
        $scope.userInfo = response;
        $rootScope.isUserLoggedIn=true;
        var AUTHORIZATION='Bearer '+response.accessToken;
        $mdToast.show(
          $mdToast.simple()
          .textContent('User sucessfully logged in!')
          .position('bottom right')
          .hideDelay(3000)
        );
        $mdDialog.cancel();
        var confirm = $mdDialog.prompt()
          .title('What would you name your File?')
         //  .textContent('Bowser is a common name.')
          .placeholder('File Name')
          .ariaLabel('File Name')
          .initialValue('untitled')
          .ok('Okay!')
          .cancel('Cancel');
        $mdDialog.show(confirm).then(function(result) {
          var url=URL_PREFIX+'api/p/eng/';
          console.log(result+' '+$rootScope.editor1code+' '+$rootScope.pendingStrategy);
          $http({
               method: "POST",
               data:{
                 name:result,
                 strategy:$rootScope.editor1code,
                 ticker:$rootScope.selectedItem.symbol,
                 shares:$rootScope.pendingStrategy.shares,
                 trade_frequency:$rootScope.pendingStrategy.frequency
               },
               headers: {
                  'Content-Type': CONTENT_TYPE,
                  'Authorization':AUTHORIZATION
                },
               url: url
             }).then(function successCallback(response) {
               $mdToast.show(
                 $mdToast.simple()
                 .textContent('File sucessfully saved!')
                 .position('bottom right')
                 .hideDelay(3000)
               );
              $scope.selectedFile=result;
             }, function errorCallback(error) {
               $mdToast.show(
                 $mdToast.simple()
                 .textContent('Something went wrong, Please check all the input field')
                 .position('bottom right')
                 .hideDelay(3000)
               );
           });
        }, function() {
          $scope.status = 'You didn\'t name your dog.';
        });
      });
  };
  $scope.saveStrategy= function(ev,us){
    $rootScope.pendingStrategy=us;
    if($rootScope.isUserLoggedIn===null || $rootScope.isUserLoggedIn===undefined){
      $mdDialog.show({
        controller:'TextEditorCtrl',
        templateUrl: 'templates/login.html',
        parent: angular.element(document.body),
        targetEvent: ev,
        clickOutsideToClose:true,
        fullscreen: $scope.customFullscreen // Only for -xs, -sm breakpoints.
      })
      .then(function(answer) {
      }, function() {
      });
    }
    else{
      if ($scope.selectedFile == 'untitled') {
        var confirm = $mdDialog.prompt()
          .title('What would you name your File?')
         //  .textContent('Bowser is a common name.')
          .placeholder('File Name')
          .ariaLabel('File Name')
          .initialValue('untitled')
          .targetEvent(ev)
          .ok('Okay!')
          .cancel('Cancel');
        $mdDialog.show(confirm).then(function(result) {
          var url=URL_PREFIX+'api/p/eng/';
          $http({
               method: "POST",
               data:{
                 name:result,
                 strategy:$rootScope.editor1code,
                 ticker:$rootScope.selectedItem.symbol,
                 shares:us.shares,
                 trade_frequency:us.frequency
               },
               headers: {
                  'Content-Type': CONTENT_TYPE,
                  'Authorization':AUTHORIZATION
                },
               url: url
             }).then(function successCallback(response) {
               $mdToast.show(
                 $mdToast.simple()
                 .textContent('File sucessfully saved!')
                 .position('bottom right')
                 .hideDelay(3000)
               );
              $scope.selectedFile=result;
             }, function errorCallback(error) {
               $mdToast.show(
                 $mdToast.simple()
                 .textContent('Something went wrong, Please check all the input field')
                 .position('bottom right')
                 .hideDelay(3000)
               );
           });
        }, function() {
          $scope.status = 'You didn\'t name your dog.';
        });
      }
      else{
        var url=URL_PREFIX+'api/p/eng/'+$scope.strategyPk+'/';
        $http({
             method: "PUT",
             data:{
               strategy:$rootScope.editor1code,
               ticker:$rootScope.selectedItem.symbol,
               shares:us.shares
             },
             headers: {
                'Content-Type': CONTENT_TYPE,
                'Authorization':AUTHORIZATION
              },
             url: url
           }).then(function successCallback(response) {
             $mdToast.show(
               $mdToast.simple()
               .textContent('File sucessfully saved!')
               .position('bottom right')
               .hideDelay(3000)
             );
           }, function errorCallback(error) {
             $mdToast.show(
               $mdToast.simple()
               .textContent('Something went wrong, Please check all the input field')
               .position('bottom right')
               .hideDelay(3000)
             );
         });
      }
    }
  };
  // $scope.fetchIndicator();

  window.onbeforeunload = function() {
     return "Did you save your stuff?";
   };
  $scope.aceLoaded = function(_editor) {
    $scope.aceSession = _editor.getSession();
    $scope.aceSession.setUseWrapMode(true);
    $scope.aceSession.setWrapLimitRange(80, 80);
  };
  $scope.aceLoaded2 = function(_editor) {
    $scope.aceSession2 = _editor.getSession();
  };
});
