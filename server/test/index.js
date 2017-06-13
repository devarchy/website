require('mocha');
const assert = require('better-assert');
const assert_node = require('assert');
const request = require('request-promise');
const config = require('../http/config');
const path = require('path');
const Thing = require('../database');
const uuid = require('node-uuid');
const env = require('../util/env');
require('timerlog')({disable_all: true});
//require('request-debug')(request);


const HOST = 'localhost';
const URI_BASE = config.protocol + HOST + ':' + config.port;

if( ! env.GITHUB_SESSION_COOKIE || ! env.GITHUB_SESSION_USERNAME || ! env.DEVARCHY_SESSION_COOKIE) {
    throw new Error('env variable missing');
}



const jar = request.jar();
setup_cookies([
    {
        origin: 'https://github.com',
        key: 'user_session',
        val: env.GITHUB_SESSION_COOKIE,
    },
    /*
    {
        origin: URI_BASE,
        key: 'sid',
        val: env.DEVARCHY_SESSION_COOKIE,
    },
    */
]);


describe('API', function() {

    var resource;
    var user;

    it('provides resource list', function(done) { 
        this.timeout(5000);
        http_call({
            path_base: '/api/things/',
            path_args: {
                properties_filter: {type: 'resource'},
                result_fields: ['id', 'type', 'author', ],
            },
        })
        .then(resp => {
            assert( resp.constructor === Object );
            const things_matched = resp.things_matched;
            assert( things_matched.constructor === Array && things_matched.length > 10 );
            assert( things_matched.every(thing => thing.type === 'resource') );

            resource = things_matched[0];
        })
        .then(() => {
            done();
        });
    }); 

    it('provides authentication status when logged out', function(done){ 
        http_call({
            path: '/api/user',
         // jar: null,
        })
        .then(resp => {
            assert(resp===null);
            done();
        })
    }); 

    it('provides view for a resource', function(done) { 
        http_call({
            path_base: '/api/view/',
            path_args: {things: [{id: resource.id}], show_removed_things: true},
        })
        .then(resp => {
            assert( resp.constructor === Object );
            const things_matched = resp.things_matched;
            assert( things_matched.constructor === Array && things_matched.length > 0 );
            assert( things_matched.some(thing => thing.id === resource.id) );
            assert( things_matched.some(thing => thing.id === resource.author) );
        })
        .then(() => {
            done();
        });
    }); 

    it('cookie is still valid', function(done) { 
        this.timeout(20000);
        http_call({
            uri: 'https://github.com',
            json: false,
        })
        .then(resp => {
            assert( resp.includes('GitHub') );
            assert( resp.indexOf(env.GITHUB_SESSION_USERNAME) !== -1, '`user_session` cookie from github.com seems to be expired' );
            done();
        })
        .catch(err => { throw err })
    }); 

    it('can log user in', function(done) { 
        this.timeout(20000);

        http_call({
            path: '/auth/github',
            json: undefined,
        })
        .then(() =>
            http_call({
                path: '/api/user',
            })
            .then(resp => {
                if( resp === null ) {
                    throw new Error([
                        '',
                        "app is not authenticating with following cookies:",
                        JSON.stringify(jar.getCookies(URI_BASE), null, 2),
                        "Possible reasons:",
                        " - using production keys instead of dev keys => GitHub production key & secret => wrong OAuth redirect => in that case bell doesn't seem to turn `bell-github` cookie into `sid` cookie",
                        " - app is not authorized by `"+env.GITHUB_SESSION_USERNAME+"` anymore",
                        '',
                    ].join('\n'));
                }
                return resp;
            })
        )
        .then(() => {
            done();
        });
    }); 

    it('saves user session', function(done) { 
        http_call({
            path: '/api/user',
        })
        .then(resp => {
            assert(resp.constructor === Object);
            assert(resp.things_matched.length === 1);
            assert(resp.things_matched[0].type === 'user');
            assert(resp.things_matched[0].github_login === env.GITHUB_SESSION_USERNAME);
            user = resp.things_matched[0];
            done();
        })
    }); 

    it('when user logs in, its email is saved', function(done) { 
        Thing.database.load.load_things_by_props({type: 'user_private_data', referred_user: user.id})
        .then(resp => {
            assert(resp.things_matched.length===1);
            assert(resp.things_matched[0].email === 'github.com@brillout.com');
            done();
        })
    }); 

    it('forbids retrieving private things', function(done) { 
        http_call({
            path_base: '/api/things/',
            path_args: {
                properties_filter: {type: 'user_private_data'},
                result_fields: ['id', 'email', 'type', ],
            },
        })
        .then(() => {
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
        http_call({
            path_base: '/api/things/',
            path_args: {
                properties_filter: {type: 'user'},
                result_fields: ['id', 'type', 'github_login', ],
            },
        })
        .then(resp => {
            const users = resp.things_matched;
            assert(users.every(u => u.type==='user'));
            assert(users.some(u => u.github_login === env.GITHUB_SESSION_USERNAME));
            assert(users.some(u => u.github_login !== env.GITHUB_SESSION_USERNAME));
            const other_user = users.find(u => u.id !== user.id);
            assert(other_user.id);
            return other_user;
        })
        .then(other_user =>
            http_call({
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

function http_call(args) { 
    const http_args = {
        method: 'GET',
        json: true,
        jar,
    };

    if( args.path_base ) {
        assert(args.path_args);
        assert(args.path===undefined);
        args.path = args.path_base+encodeURIComponent(JSON.stringify(args.path_args));
        delete args.path_base;
        delete args.path_args;
    }

    if( args.path ) {
        assert(args.uri===undefined);
        http_args.uri = URI_BASE + (args.path||'');
        delete args.path;
    }

    Object.assign(http_args, args);

    return request(http_args);
} 

function setup_cookies(cookies) { 
    cookies
    .forEach(({origin, key, val}) => {
        // `setCookie` is cumulative => calling `setCookie` several times is fine
        jar.setCookie(request.cookie(key+'='+val), origin);
    });
} 
