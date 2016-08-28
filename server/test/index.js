require('mocha');
const assert = require('better-assert');
const http = require('request-promise');
const config = require('../http/config');
const path = require('path');
const Promise = require('bluebird');
const uuid = require('node-uuid');
Promise.longStackTraces();


const GITHUB_SESSION_USERNAME = process.env.GITHUB_SESSION_USERNAME;
const GITHUB_SESSION_COOKIE = process.env.GITHUB_SESSION_COOKIE;
if( ! GITHUB_SESSION_COOKIE || ! GITHUB_SESSION_USERNAME ) { throw new Error('env variable missing') }

const jar = http.jar();
jar.setCookie(
    http.cookie('user_session='+GITHUB_SESSION_COOKIE),
    'https://github.com');


describe('API', function() {

    var resources;
    var resource;
    var user;

    it('provides resource list', done => {
        api({
            path: '/api/things/'+encodeURIComponent(JSON.stringify({properties_filter:{type: 'resource'}, result_fields: null}))
        })
        .then(resources_ => {
            assert( resources_ && resources_.constructor === Array && resources_.length > 10 );
            assert( resources_ && resources_.every(thing => thing.type === 'resource') );

            resources = resources_;
            resource = resources[0];
        })
        .then(() => {
            done();
        });
    });

    it('provides authentication status when logged out', function(done){
        api({
            path: '/api/user'
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
        api({
            path: '/api/view/'+encodeURIComponent(JSON.stringify([{id: resource.id}])),
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

    it('cookie is still valid', function(done) {
        this.timeout(20000);
        http({
            method: 'GET',
            uri: 'https://github.com',
            jar,
        })
        .then(resp => {
            assert( resp.indexOf(GITHUB_SESSION_USERNAME) !== -1 );
            done();
        })
        .catch(err => { throw err })
    })

    it('can log in user', function(done) {
        this.timeout(50000);

        api({
            method: 'GET',
            path: '/auth/github',
            json: undefined,
        })
        .then(() =>
            api({
                path: '/api/user',
            })
        )
        .then(resp => {
            assert(resp.length === 1);
            assert(resp[0].type === 'user');
            assert(resp[0].github_login === GITHUB_SESSION_USERNAME);
            user = resp[0];
            done();
        })
        .catch(err => { throw err })
    })
});

function api(obj) {
    const uri = config.protocol + config.host + ':' + config.port + (obj.path||'');
    return http(
        Object.assign(
            {
                method: 'GET',
                uri,
                json: true,
                jar,
            },
            obj,
            {
                path: undefined,
            }
        )
    );
}
