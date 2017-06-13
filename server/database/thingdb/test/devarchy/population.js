"use strict";
const assert = require('better-assert');
const Thing = require('./thing');


const population = module.exports = {
    user: null,
    create,
};

let promise;
function create() {

    if( !promise ) { promise = create_promise(); }

    return promise;

    function create_promise() {
        return Thing.database.load.things({type: 'user', github_login: 'brillout'})
        .then(things => {
            if( things.length === 1 ) {
                population.user = things[0];
                return;
            }
            assert( things.length === 0 );
            const user = new Thing({
                type: 'user',
                draft: {
                    github_login: 'brillout',
                },
            });
            user.generate_id();
            assert(user.id);
            user.draft.author = user.id;
            population.user = user;
            return user.draft.save();
        })
    }
}
