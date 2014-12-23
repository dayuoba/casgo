/* global ko */
/* global fetch */
/* global q */
/* global _ */
'use strict';

// Create App namespace on global scope
window.App = {
  VM: null,
  Routes: {}
};

/**
 * View model for top-level casgo app
 *
 * @exports CasgoViewModel
 */
function CasgoViewModel() {
  var vm = this;

  vm.currentRouteUrl =  ko.observable(window.location.hash.slice(1));
  /**
   * Routing utility functions
   */

  /**
   * Check if the current {@link currentRouteUrl} against a given URL
   *
   * @param {string} url - The URL to check
   * @returns whether the current route url is exactly the given value
   */
  vm.currentRouteUrlIs = function(url) {return vm.currentRouteUrl() === url; };

  /**
   * Check whether the current route URL starts with a given URL
   * This usually indicates that it is a sub-route
   *
   * @param {string} prefix - The prefix to search for 
   * @returns whether the current route URL contains the prefix
   */
  vm.currentRouteUrlHasPrefix = function(prefix) { return vm.currentRouteUrl().match('^' + prefix); };

  /**
   * Lookup route by it's url
   *
   * @param {string} url - The URL to use to look up the route
   * @returns the first route that matche the URL exactly
   */
  vm.getRouteByUrl = function(url) {
    return _.first(_.values(window.App.Routes), function(v) { return v.url === url; });
  };

  /**
   * Navigate to a route
   * 
   * @param {object} route - The route to navigate to
   */
  vm.gotoRoute =  function(route) {
    window.location.href = '#' + route.url;
    vm.currentRouteUrl(window.location.hash.slice(1));

    // Run setup functions for all specified controllers, if any
    if (_.has(window.App.Routes, route) &&
        _.has(window.App.Routes[route], 'controllers') &&
        _.isArray(window.App.Routes[route].controllers)) {

      _.forEach(window.App.Routes[route].controllers, function(c) {
        if (_.isString(c) &&
            _.has(vm, c) &&
            _.has(vm[c], 'setup') &&
            _.isFunction(vm[c].setup)) {
          vm[c].setup();
          // TODO: Pass route args
        }

      });
    }
  };


  /**
   * Service that maintains user sessions and information retrieved from the backend
   */
  vm.SessionService = {
    currentUser: ko.observable({}),

    /**
     * Get the current user
     *
     * @returns A Promise that will resolve to the user object
     */
    getCurrentUser: function() {
      var svc = vm.SessionService;
      return new Promise(function(resolve, reject) {
        if (_.isEmpty(svc.currentUser())) {
          svc
            .fetchCurrentUser()
            .then(resolve);
        } else {
          resolve(svc.currentUser());
        }
      });
    },

    /**
     * Fetch the current user in the session from the backend, updating the service
     *
     * @returns a promise that will resolve to the user object
     */
    fetchCurrentUser: function() {
      var svc = vm.SessionService;
      return new Promise(function(resolve, reject) {
        fetch('/api/sessions')
          .then(function(resp){
            return resp.json();
          }).then(function(json) {
            if (json.status === "success") {
              svc.currentUser(json.data);
              resolve(svc.currentUser());
            } else {
              reject(new Error("API call failed", json.message));
            }
        }).catch(function(err) {
          reject(err);
        });

      });
    }

  },

  // Services
  vm.ServicesService = {
    services: ko.observableArray([]),

    /**
     * Get services for given user
     *
     * @param {string} userEmail - The username for which to retrieve services
     */
    getServices: function(userEmail) {
      var svc = vm.ServicesService;

      // Get the user
      var getUserFn;
      if (_.isUndefined(userEmail)) {
        getUserFn = vm.SessionService.getCurrentUser();
      } else {
        new Promise(function(resolve, reject) {resolve(userEmail);});
      }

      getUserFn
        .then(svc.fetchServicesForUser)
        .then(function(services) {
          svc.services(services);
        });
    },

    /**
     * Fetch user's services and update observables
     *
     * @param {string} user - current user
     * @returns A Promise which evaluates to the users' services
     */
    fetchServicesForUser: function(user) {
      var svc = vm.ServicesService;
      // Get user's services
      return new Promise(function(resolve, reject) {
        fetch('/api/sessions/' + user.email + "/services")
        .then(function(resp) {
          return resp.json();
        }).then(function(json) {
          if (json.status === "success") {
            svc.services(json.data);
            resolve(svc.services());
          } else {
            reject(new Error("API call failed", json.message));
          }
        }).catch(function(err) {
          reject(err);
        });
      });
    }

  },

  // Controllers
  vm.ServicesCtrl = {
    pageSize: ko.observable(10),
    currentPage: ko.observable(0),
    numPages: ko.pureComputed(function() {
      var ctrl = vm.ServicesCtrl;
      return Math.Ceil(vm.ServicesService.services() / ctrl.pageSize()) + 1;
    }),
    pagedServices: ko.pureComputed(function() {
      var ctrl = vm.ServicesCtrl;
      var startingIndex = ctrl.currentPage() * ctrl.pageSize();
      var services = vm.ServicesService.services();

      // Return early if not enough data
      if (services.length == 0 || startingIndex > services.length) { return []; }

      return vm.ServicesService.services().slice(ctrl.currentPage() * ctrl.pageSize(), ctrl.pageSize());
    }),

    /**
     * Setup function for the ServicesCtrl (only run once)
     */
    setup: function() {
      vm.ServicesService.getServices();
    }
  };

  vm.ManageCtrl = {};
  vm.ManageUsersCtrl = {users: []};
  vm.ManageServicesCtrl = {services: []};
  vm.StatisticsCtrl = {};

  /**
   * App initialization function, to be run once, when the app starts
   */
  vm.init = function() {
    vm.SessionService.fetchCurrentUser();
  };

  vm.init();
}

// Attach VM
window.App.VM = new CasgoViewModel();
ko.applyBindings(App.VM);
