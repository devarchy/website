"use strict";
require('mocha');
const assert = require('better-assert');
const chai_assert = require('chai').assert;
const Promise = require('bluebird'); Promise.longStackTraces();
const turn_into_error_object = require('../../../util/turn_into_error_object');


module.exports = Thing => {
    assert(Thing);
    assert(Thing.database);

    let promise = Promise.resolve();

    return  {
        it: (what, test, {timeout}={}) => {
            it(what, function(done) {
                this.timeout(timeout || 30*1000);

                promise = promise
                .then(() =>
                    test()
                )
                .then(() => {
                    Thing.debug.log.buffer.clear();
                    done();
                })
                .catch(err => {
                    // Thing.debug.log.buffer.flush();
                    assert(turn_into_error_object.is_error_object(err));
                    done(err);
                });
            });
        },
        it_validates_if: (what, test, {reason, before, timeout}={}) => {
            assert(reason);

            const count = build_count();

            it('throws `'+Thing.ValidationError.name+'` when '+what, function(done) {
                this.timeout(timeout || module.exports.timeout);

                let things_counter;
                let checkpoints_passed = 0;

                promise = promise
                .then(() =>
                    before && before()
                )
                .finally(() =>
                    // we don't need that now that we count the number of rows
                    count_things()
                    .then(count => (things_counter = count))
                )
                .finally(() =>
                    count.fetch((c, table) => count[table] = c)
                )
                .finally(() => {
                    checkpoints_passed++;
                    return test();
                })
                .finally(() => {
                    checkpoints_passed++;
                    return count.fetch((c, table) => chai_assert.equal(c, count[table]))
                    .then(() => {
                        checkpoints_passed++;
                    })
                })
                .finally(() =>
                    count_things()
                    .then(count => {
                        checkpoints_passed++;
                        chai_assert.equal(things_counter, count);
                    })
                )
                .then(() => {
                    chai_assert(false, "an expection is expected to be thrown");
                })
                .catch(err => {
                    checkpoints_passed++;
                 // console.log(err.constructor);
                 // console.log(err instanceof Thing.ValidationError);
                 // console.log(Thing.ValidationError.name);
                 // console.log(err.name);
                 // if( ! err instanceof Thing.ValidationError || Thing.ValidationError.name !== err.name ) {
                    if( err.constructor !== Thing.ValidationError ) {
                        throw err;
                    }
                    if( reason ) {
                        assert(reason.constructor === String);
                        /*
                        assert([RegExp, String].includes(reason.constructor));
                        if( reason.constructor === RegExp )
                            chai_assert.match(err.message, reason);
                        */
                        if( reason.constructor === String )
                            chai_assert.include(err.message, reason);
                    }
                })
                .then(() => {
                    chai_assert.equal(checkpoints_passed, 5);
                    done();
                })
                .catch(err => {
                    done(err);
                });
            });

            function count_things(){
                return (
                    Thing.database.load.all_things()
                    .then(all_things => all_things.length)
                );
            }
            function build_count(){
                return {
                    fetch: action =>
                        Promise.all(
                            [
                                'thing_aggregate',
                                'thing_event',
                            ]
                            .map(table =>
                                Thing.db_handle(table)
                                .count("*")
                                .then(r => {
                                    const c = parseInt(r[0].count, 10);
                                    assert(c > 0);
                                    assert((NaN > 0) === false);
                                    action(c, table)
                                })
                            )
                        )
                };
            }
        },
    };
};
