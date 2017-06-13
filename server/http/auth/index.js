const assert = require('assertion-soft');
const assert_soft = require('assertion-soft');
const assert_hard = require('assert');
const Thing = require('../../database');
const uuid = require('node-uuid');
const Promise = require('bluebird');
Promise.longStackTraces();
const env = require('../../util/env');
const providers = require('./providers');


module.exports = function(server){

    server.auth.strategy('session', 'cookie', 'try', {
        password: env.HAPI_COOKIE_PASSWORD,
        isSecure: false
    });

    providers.forEach(({provider_name, scope, config, identifier, private_info_retriever=()=>{}, info_retriever=()=>{}}) => {

        const clientId__name = provider_name.toUpperCase()+'_CLIENT_ID';
        const clientId = env[clientId__name];
        const clientSecret__name = provider_name.toUpperCase()+'_CLIENT_SECRET';
        const clientSecret = env[clientSecret__name];
        assert_hard(clientId, clientId__name);
        assert_hard(clientSecret, clientSecret__name);
        server.auth.strategy(provider_name, 'bell', {
            provider: provider_name,
            scope,
            config,
            clientId,
            clientSecret,
            password: env.HAPI_AUTH_PASSWORD,
            isSecure: false,
        });

        server.route({
            method: ['GET', 'POST'],
            path: '/auth/'+provider_name,
            config: {
                auth: {
                    strategy: provider_name,
                    mode: 'try', // manually manage error, default behavior seem to be swallowing error
                },
                handler: function (request, reply) {

                    // manually manage error, default behavior seem to be swallowing error
                    if( ! request.auth.isAuthenticated ) {
                        throw request.auth.error;
                    }

                    var info = request.auth.credentials;
                    assert_soft( info.provider === provider_name );

                 // console.log(info);

                    const auth_token = {
                        provider: info.provider,
                        token: info.token,
                        secret: info.secret,
                        refreshToken: info.refreshToken,
                        expiresIn: info.expiresIn,
                    };
                    assert_hard(auth_token.provider);
                    assert_hard(auth_token.token);

                    const identifier_name = identifier.name;
                    assert_hard(identifier_name);
                    const identifier_value = identifier.retriever(info.profile);
                    assert_hard(identifier_value);

                    const provider_private_info = private_info_retriever(info.profile.raw);
                    const provider_info = info_retriever(info.profile.raw);

                    handle_request({request, reply, auth_token, provider_name, provider_info, provider_private_info, identifier_name, [identifier_name]: identifier_value});

                }
            }
        });
    });

};


function handle_request(props) {
    const {request, reply, auth_token, provider_name, provider_info, provider_private_info, identifier_name} = props;
    const identifier_value = props[identifier_name];
    assert_hard(identifier_name);
    assert_hard(identifier_value);

    const draft = {}; // TODO
    if( provider_info ) {
        draft[provider_name+'_info'] = provider_info;
    }

    new Thing({
        type: 'user',
        [identifier_name]: identifier_value,
        draft,
    }).draft.save()
    .then(([user]) => {
        assert_hard(user.type==='user');
        assert_hard(user.id);
        assert_hard(user[identifier_name]);
        assert_soft(user[identifier_name]===identifier_value);
        return user;
    })
    .then(user => {
        request.cookieAuth.set({
            user_id: user.id,
            provider_username: identifier_name+':'+identifier_value,
        });
        return user;
    })
    .then(user => {

        const draft = {
            auth_token,
        };
        if( provider_private_info ) {
            draft[provider_name+'_info'] = provider_private_info;
        }

        return (
            new Thing({
                type: 'user_private_data',
                referred_user: user.id,
                author: user.id,
                draft,
            }).draft.save()
        );
    })
    .then(() => {
        reply.redirect('/')
    });
}
