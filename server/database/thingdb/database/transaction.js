"use strict";
const assert = require('assert');
const Promise = require('bluebird');
Promise.longStackTraces();

module.exports = ({db_handle}) =>
    new Promise(resolve => {
        let trans;
        const transaction_promise =
            db_handle.transaction(transaction => {
                trans = transaction;
                transaction
                .raw('set transaction isolation level serializable; set constraints all deferred;')
                .then(() => {
                    transaction.rid = Math.random();
                    transaction.commit_promise = () => {
                        transaction.commit().catch(() => assert(false));
                        return transaction_promise;
                    };
                    transaction.rollback_promise = () => {
                        transaction.rollback(new Error('unused generic error')).catch(() => assert(false));
                        return transaction_promise/*.then(() => setTimeout(() => assert(false),0))*/.catch(() => {});
                    };
                    resolve(transaction);
                })
                .catch(() => {assert(false)});
            })
            .catch(err => {
                if( err === undefined ) {
                    // knex seems to throw a `undefined` error when a knex query using that transaction throws
                    // - therefore knex rejects two promises; the query promise and this transaction promise
                    // - we swallow the rejection on this transaction promise
                    return;
                }
                throw err;
            });
    });
