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
        scope: ['user:email'],
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
                const auth_token = {
                    provider: info.provider,
                    token: info.token,
                    refreshToken: info.refreshToken,
                    expiresIn: info.expiresIn,
                };
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
                    return user;
                })
                .then(user => {
                    request.cookieAuth.set({
                        user_id: user.id,
                        github_login: user.github_login,
                    });
                    return user;
                })
                .then(user =>
                    new Thing({
                        type: 'user_private_data',
                        referred_user: user.id,
                        author: user.id,
                        draft: {
                            auth_token,
                        },
                    }).draft.save()
                )
                .then(() => {
                    reply.redirect('/')
                });

            }
        }
    });
};
