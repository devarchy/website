require('mocha');
const assert = require('better-assert');
const assert_node = require('assert');
const http = require('request-promise');
const config = require('../http/config');
const path = require('path');
const Promise = require('bluebird'); Promise.longStackTraces();
const Thing = require('../database');
const uuid = require('node-uuid');
require('timerlog')({disable_all: true});


const HOST = 'localhost';
const URI_BASE = config.protocol + HOST + ':' + config.port;

const GITHUB_SESSION_USERNAME = process.env.GITHUB_SESSION_USERNAME;
const GITHUB_SESSION_COOKIE = process.env.GITHUB_SESSION_COOKIE;
const DEVARCHY_SESSION_COOKIE = process.env.DEVARCHY_SESSION_COOKIE;
if( ! GITHUB_SESSION_COOKIE || ! GITHUB_SESSION_USERNAME ) { throw new Error('env variable missing') }

const jar = http.jar();
jar.setCookie(
    http.cookie('user_session='+GITHUB_SESSION_COOKIE),
    'https://github.com');
/*
jar.setCookie(
    http.cookie('sid='+
    DEVARCHY_SESSION_COOKIE),
    URI_BASE);
//*/


describe('API', function() {

    var resource;
    var user;

    it('provides resource list', done => { 
        api_call({
            path_base: '/api/things/',
            path_args: {
                properties_filter: {type: 'resource'},
                result_fields: ['id', 'type', 'author', ],
            },
        })
        .then(resources => {
            assert( resources && resources.constructor === Array && resources.length > 10 );
            assert( resources && resources.every(thing => thing.type === 'resource') );

            resource = resources[0];
        })
        .then(() => {
            done();
        });
    }); 

    it('provides authentication status when logged out', function(done){ 
        api_call({
            path: '/api/user',
            jar: null,
        })
        .then(() => {
            assert(false);
        })
        .catch(err => {
            assert( err.statusCode === 401 );
            done();
        });
    }); 

    it('provides view for a resource', done => { 
        api_call({
            path_base: '/api/view/',
            path_args: [{id: resource.id}],
        })
        .then(things => {
            assert( things && things.length > 0 );
            assert( things.some(thing => thing.id === resource.id) );
            assert( things.some(thing => thing.id === resource.author) );
        })
        .then(() => {
            done();
        });
    }); 

    /*
    it('cookie is still valid', function(done) { 
        this.timeout(20000);
        http({
            method: 'GET',
            uri: 'https://github.com',
        })
        .then(resp => {
            console.log(resp);
            assert( resp.indexOf(GITHUB_SESSION_USERNAME) !== -1, '`user_session` cookie from github.com seems to be expired' );
            done();
        })
        .catch(err => { throw err })
    }); 
    //*/

    it('can log user in', function(done) { 
        this.timeout(20000);

        api_call({
            path: '/auth/github',
            json: undefined,
        })
        .then(() =>
            api_call({
                path: '/api/user',
            })
            .catch(err => {
                if( err.statusCode === 401 ) {
                    throw new Error("app doesn't seem to be authorized by `"+GITHUB_SESSION_USERNAME+"` anymore, please re-authorize");
                }
                throw err;
            })
        )
        .then(() => {
            done();
        });
    }); 
    //*/

    it('saves user session', function(done) { 
        api_call({
            path: '/api/user',
        })
        .then(resp => {
            assert(resp.length === 1);
            assert(resp[0].type === 'user');
            assert(resp[0].github_login === GITHUB_SESSION_USERNAME);
            user = resp[0];
            done();
        })
    }); 

    it('when user logs in, its email is saved', function(done) { 
        Thing.database.load.things({type: 'user_private_data', referred_user: user.id})
        .then(things => {
            assert(things.length===1);
            assert(things[0].email === 'github.com@brillout.com');
            done();
        })
    }); 

    it('forbids retrieving private things', function(done) { 
        api_call({
            path_base: '/api/things/',
            path_args: {
                properties_filter: {type: 'user_private_data'},
                result_fields: ['id', 'email', 'type', ],
            },
        })
        .then(things => {
            assert(false);
        })
        .catch(err => {
            if( err.statusCode === undefined ) {
                throw err;
            }
            assert_node( err.statusCode === 401, 'got status code `'+err.statusCode+'` instead of 401' );
            assert( err.message.includes('trying to access private information') );
            done();
        });
    }); 

    it('forbids saving something as another user', function(done) { 
        api_call({
            path_base: '/api/things/',
            path_args: {
                properties_filter: {type: 'user'},
                result_fields: ['id', 'type', 'github_login', ],
            },
        })
        .then(users => {
            assert(users.every(u => u.type==='user'));
            assert(users.some(u => u.github_login === GITHUB_SESSION_USERNAME));
            assert(users.some(u => u.github_login !== GITHUB_SESSION_USERNAME));
            const other_user = users.find(u => u.id !== user.id);
            assert(other_user.id);
            return other_user;
        })
        .then(other_user =>
            api_call({
                method: 'POST',
                path: '/api/save',
                body: {
                    type: 'tag',
                    author: other_user.id,
                    draft: {
                        name: 'tag-from-unit-test',
                    },
                },
            })
        )
        .then(() => assert(false))
        .catch(err => {
            if( err.statusCode === undefined ) {
                throw err;
            }
            assert_node( err.statusCode === 400, 'got status code `'+err.statusCode+'` instead of 400' );
            assert( err.message.includes('but authenticated user has id') );
            done();
        });
    }); 
});

function api_call(obj) { 
    if( obj.path_base ) {
        assert(obj.path_args);
        assert(obj.path===undefined);
        obj.path = obj.path_base+encodeURIComponent(JSON.stringify(obj.path_args));
        delete obj.path_base;
        delete obj.path_args;
    }
    if( obj.path ) {
        assert(obj.uri===undefined);
        obj.uri = URI_BASE + (obj.path||'');
        delete obj.path;
    }
    return http(
        Object.assign(
            {
                method: 'GET',
                json: true,
                jar,
            },
            obj
        )
    );
} 
