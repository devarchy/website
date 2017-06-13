"use strict";
const assert = require('assert');
const Promise = require('bluebird');
Promise.longStackTraces();

module.exports = ({db_handle}) => (
    new Promise((resolve, reject) => {
        let resolved = false;
        let is_commit = false;
        let is_rollback = false;

        const transaction_promise = (
            db_handle
            .transaction(transaction => {
                transaction
                .raw('set transaction isolation level serializable; set constraints all deferred;')
                .then(() => {
                    transaction.rid = Math.random();
                    transaction.commit_promise = () => {
                        is_commit = true;
                        transaction.commit().catch(() => assert(false));
                        return (
                            transaction_promise
                            .catch(err => {
                                assert(!is_rollback);
                                assert(is_commit && resolved);

                                /*
                                console.log('commit_error')
                                console.log(err);
                                */

                                throw err;
                            })
                        );
                    };
                    transaction.rollback_promise = () => {
                        is_rollback = true;
                        const application_side_error = new Error('unused generic error');
                        transaction.rollback(application_side_error).catch(() => assert(false));
                        return (
                            transaction_promise/*.then(() => setTimeout(() => assert(false),0))*/
                            .catch(err => {
                                assert(!is_commit);
                                assert(is_rollback && resolved);

                                // we don't need this feature of knex
                                if( err === application_side_error ) { return; }

                                /*
                                console.log('rollback_error')
                                console.log(err);
                                */

                                throw err;
                            })
                            .catch(() => {})
                        );
                    };
                    resolve(transaction);
                    resolved = true;
                })
                .catch(() => {assert(false)});
            })
            .catch(err => {
                if( is_rollback || is_commit ) {
                    throw err;
                }

                /*
                console.log('transaction_error');
                console.log('resolved: '+resolved);
                console.log(err);
                */

                assert(resolved===false);
                reject(err);

            })
        );

        /*
        transaction_promise.catch(err => {
        //  throw err;
        });

        transaction_promise.catch(err => {
            console.log('transerr');
            console.log('resolved: '+resolved);
            console.log(err);
        //  throw err;
        });
            /*
            .catch(err => {
                console.log('heal');
                console.log(err.message);
                console.log(err);
                if( err === undefined ) {
                    // knex seems to throw a `undefined` error when a knex query using that transaction throws
                    // - therefore knex rejects two promises; the query promise and this transaction promise
                    // - we swallow the rejection on this transaction promise
                    return;
                }
                throw err;
            });
            */
    })
);
