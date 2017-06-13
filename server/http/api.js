const assert = require('assert');
const assert_hard = require('assert');
const Thing = require('../database');
const Boom = require('boom');
const timerlog = require('timerlog');


const PRIVATE_ERROR_MESSAGE = 'trying to access private information';

module.exports = function(server){
    server.route({
        method: 'GET',
        path: '/api/things/{args}',
        config: { 
            validate: {
                params: function(value, options, next){
                    try {
                        args_parsed = JSON.parse(value.args);
                    }
                    catch(err) {
                        reply_err("Couldn't parse argument as JSON; "+err);
                        return;
                    }

                    if( !args_parsed || args_parsed.constructor!==Object ) {
                        reply_err("Argument should be an object");
                        return;
                    }

                    if( !args_parsed.properties_filter ) {
                        reply_err("`properties_filter` is required");
                        return;
                    }
                    if( Object.keys(args_parsed.properties_filter).length === 0 ) {
                        reply_err("`properties_filter` needs at least one property");
                        return;
                    }

                    if( (args_parsed.result_fields||0).constructor !== Array ) {
                        reply_err("`result_fields` should be an array");
                        return;
                    }

                    next(null, args_parsed);

                    return;

                    function reply_err(message) {
                        reply_args_error(message, value.args, next);
                    }

                },
            },
        }, 
        handler: (request, reply) => { 
            const args_parsed = request.params;
            assert(args_parsed.constructor === Object);

            const tid = timerlog({ 
                start_timer: true,
                tags: ["http_request", "api_request"],
                message: "API response computed for "+request.route.path+" "+JSON.stringify(args_parsed.properties_filter),
            }); 

            const result_fields = args_parsed.result_fields;

            Thing.database.load.load_things_by_props(
                args_parsed.properties_filter,
                {result_fields}
            )
            .then(output => {

                const is_forbidden = output.is_private()!==false;

                const reply_str = (
                    is_forbidden ? (
                       JSON.stringify(PRIVATE_ERROR_MESSAGE)
                    ) : (
                       output.serialize_me({include_plugins_info: true})
                    )
                );

                timerlog({ 
                    id: 'construct_http_response',
                    tags: ['performance', 'db_processing'],
                    start_timer: true,
                }); 

                const rep = reply(reply_str);

                if( is_forbidden ) {
                    rep.code(401);
                }

                timerlog({ 
                    id: 'construct_http_response',
                    end_timer: true,
                }); 

                timerlog({ 
                    id: tid,
                    end_timer: true,
                }); 
            });
        }, 
    });

    server.route({
        method: 'GET',
        path: '/api/view/{args}',
        config: { 
            validate: {
                params: function(value, options, next){
                    var args_parsed;

                    try {
                        args_parsed = JSON.parse(value.args);
                    }
                    catch(err){
                        reply_err(err);
                        return;
                    }

                    if( ! args_parsed || args_parsed.constructor !== Object ) {
                        reply_err([
                            "Unexpected HTTP GET params:",
                            JSON.stringify(args_parsed, null, 2),
                            args_parsed && args_parsed.constructor,
                        ].join('\n'));
                        return;
                    }

                    if( ! args_parsed.things ) {
                        reply_err("Argument `things` missing");
                        return;
                    }

                    if( args_parsed.things.constructor !== Array ) {
                        reply_err("Argument `things` is expected to be an array");
                        return;
                    }

                    if( ![true, false].includes(args_parsed.show_removed_things) ) {
                        reply_err("Argument `show_removed_things` is expected to be `true` or `false`");
                        return;
                    }

                    next(null, args_parsed);

                    return;

                    function reply_err(message) {
                        reply_args_error(message, value.args, next);
                    }
                },
            },
        }, 
        handler: (request, reply) => { 
            assert(request.params.constructor === Object);
            assert(request.params.things.constructor === Array);
            assert(request.params.show_removed_things.constructor === Boolean);

            const things = request.params.things;
            const show_removed_things = request.params.show_removed_things;
            Thing.database.load.view(request.params.things, {show_removed_things})
            .then(things => {
                if( things.is_private()!==false ) {
                    reply(JSON.stringify(PRIVATE_ERROR_MESSAGE)).code(401);
                } else {
                    reply(things.serialize_me({include_side_props: true}));
                }
            });
        }, 
    });

    server.route({
        method: 'GET',
        path: '/api/user',
        config: { 
            handler: (request, reply) => {
                if( ! request.auth.credentials ) {
                    reply_unauthenticated();
                    return;
                }

                assert(request.auth.credentials);
                const user_id =
                    request.auth.credentials.id || // old cookies
                    request.auth.credentials.user_id;
                assert(user_id);

                Thing.database.load.things({type: 'user', id: user_id})
                .then(things => {
                    assert(things);
                    assert(things.constructor === Array);
                    assert_hard(things.is_private()===false);
                    if(things.length === 0) {
                        reply_unauthenticated();
                        return;
                    }
                    const response = reply(things.serialize_me({include_side_props: true}));
                })
                .catch(err => { throw err; });

                return;

                function reply_unauthenticated() {
                    reply(JSON.stringify(null));
                }
            },
        }, 
    });

    server.route({
        method: 'POST',
        path: '/api/save',
        config: {
            auth: 'session',
            validate: { 
                payload: function(value, options, next) {
                    const thing_data = value;
                    const auth = options.context.auth;

                    const user_id =
                        auth.credentials.id || // old cookies
                        auth.credentials.user_id;

                    const errors = [];

                    if( !auth.isAuthenticated ) {
                        errors.push("user is not authenticated");
                    }
                    else if( !user_id ) {
                        errors.push("user is authenticated but has no id");
                    }

                    if( !thing_data ) {
                        errors.push("payload missing");
                    }
                    else {
                        if( thing_data.constructor !== Object ) {
                            errors.push("payload should be a json object");
                        }
                    }

                    const author = thing_data.draft.author||thing_data.author;
                    if( user_id !== author ) {
                        errors.push("(thing_data.draft.author||thing_data.author)===`"+author+"` but authenticated user has id `"+user_id+"`");
                    }

                    if( errors.length > 0 ) {
                        const message =
                            [
                                "*** validation failed *** ",
                                JSON.stringify(thing_data, null, 2),
                            ].concat(
                                errors
                            )
                            .join('\n');
                        next({"message": message});
                        return;
                    }

                    // - hacky to validate response here
                    // - couldn't find a way to have a custom response validation otherwise
                    new Thing(thing_data)
                    .draft.save_draft({schema__args: {is_from_api: true}})
                    .then(resp => {
                        assert_hard(resp.is_private()===false);
                        next(null, resp.serialize_me({include_side_props: true}));
                    })
                    .catch(err => {
                        assert(err.stack);
                        if( err.constructor === Thing.ValidationError ) {
                            next({"message": err.message});
                            return;
                        }
                        if( (err||{}).response_connection_error ) {
                            next({"message": err.response_connection_error});
                            return;
                        }
                        console.error(err);
                        next(Boom.badImplementation(err));
                    })
                },
            }, 
            handler: (request, reply) => { 
                if( request.payload.isBoom ) {
                    console.error(err);
                    console.error(err.stack);
                }
                reply(request.payload);
            }, 
        },
    });

    function reply_args_error(message, args, next) {
        console.error(
            [
                'API Reques Argument Error (properly handled && shown to user):',
                args,
                message,
                new Error().stack,
            ].join('\n')
        );
        next({message});
    }
};
