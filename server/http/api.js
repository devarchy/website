const assert = require('assert');
const Thing = require('../database/thingdb');
const Boom = require('boom');


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
                        next({message: "Couldn't parse argument as JSON; "+err});
                        return;
                    }

                    if( !args_parsed || args_parsed.constructor!==Object ) {
                        next({message: "Argument should be an object"});
                        return;
                    }

                    if( !args_parsed.properties_filter ) {
                        next({message: "`properties_filter` is required"});
                        return;
                    }
                    if( Object.keys(args_parsed.properties_filter).length === 0 ) {
                        next({message: "`properties_filter` needs at least one property"});
                        return;
                    }

                    if( (args_parsed.result_fields||0).constructor !== Array ) {
                        next({message: "`result_fields` should be an array"});
                        return;
                    }

                    next(null, args_parsed);
                },
            },
        }, 
        handler: (request, reply) => { 
            const args_parsed = request.params;
            assert(args_parsed.constructor === Object);

            Thing.database.load.things(
                args_parsed.properties_filter,
                {result_fields: args_parsed.result_fields}
            )
            .then(things => reply(JSON.stringify(things)));
        }, 
    });

    server.route({
        method: 'GET',
        path: '/api/view/{things}',
        config: { 
            validate: {
                params: function(value, options, next){
                    var value_parsed;
                    var error;

                    try {
                        value_parsed = JSON.parse(value.things);
                    }
                    catch(err){
                        error = err;
                    }

                    if( error===undefined && value_parsed && value_parsed.constructor === Array ) {
                        next(null, value_parsed);
                        return;
                    }

                    if( !error && value_parsed.constructor !== Array ) {
                        error = "Argument is expected to be an array";
                    }

                    console.log('error', value.things, error);

                    next({"message": error});
                },
            },
        }, 
        handler: (request, reply) => { 
            assert(request.params.constructor === Array);

            Thing.database.load.view(request.params)
            .then(things => reply(JSON.stringify(things)))
        }, 
    });

    server.route({
        method: 'GET',
        path: '/api/user',
        config: { 
            auth: 'session',
            handler: (request, reply) => {
                const credentials = request.auth.credentials;

                assert(credentials);

                const user_id = credentials.id;
                assert(user_id);

                Thing.database.load.things({type: 'user', id: user_id})
                .then(things => {
                    assert(things);
                    assert(things.constructor === Array);
                    if(things.length === 0) {
                        reply(JSON.stringify(null)).code(401);
                        return;
                    }
                    const response = reply(JSON.stringify(things));
                })
                .catch(err => { throw err; });
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

                    const errors = [];

                    if( !auth.isAuthenticated ) {
                        errors.push("user is not authenticated");
                    }
                    else if( !auth.credentials.id ) {
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
                    if( auth.credentials.id !== author ) {
                        errors.push("(thing_data.draft.author||thing_data.author)===`"+author+"` but authenticated user has id `"+auth.credentials.id+"`");
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
                    new Thing(thing_data).draft.save()
                    .then(response => next(null, response))
                    .catch(err => {
                        if( err.constructor === Thing.ValidationError ) {
                            next({"message": err.message});
                            return;
                        }
                        if( Thing.NetworkConnectionError.check_error_object(err) ) {
                            next({"message": err.message});
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
};
