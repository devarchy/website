const assert = require('assert');
const Thing = require('../database/thingdb');
const uuid = require('node-uuid');
const Promise = require('bluebird');
Promise.longStackTraces();
const env = require('../util/env');


module.exports = function(server){

    server.auth.strategy('session', 'cookie', 'try', {
        password: env.HAPI_COOKIE_PASSWORD,
        isSecure: false
    });

    server.auth.strategy('github', 'bell', {
        provider: 'github',
        scope: [],
        password: env.HAPI_AUTH_PASSWORD,
        isSecure: false,
        clientId: env.GITHUB_CLIENT_ID,
        clientSecret: env.GITHUB_CLIENT_SECRET,
    });

    server.route({
        method: ['GET', 'POST'],
        path: '/auth/github',
        config: {
            auth: 'github',
            handler: function (request, reply) {

                var info = request.auth.credentials;
                assert( info.provider === 'github' );

                const github_login = info.profile.raw.login;
                assert(github_login);

                new Thing({
                    type: 'user',
                    github_login,
                    draft: {},
                }).draft.save()
                .then(([user]) => {
                    assert(user.type==='user');
                    assert(user.id);
                    assert(user.github_login);
                    request.cookieAuth.set({
                        id: user.id,
                        github_login: user.github_login,
                    });
                })
                .then(() => {
                    reply.redirect('/')
                });

            }
        }
    });
};
