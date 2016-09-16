const assert = require('assert');
const Thing = require('../index.js');
const schema = require('../../schema.js');
const connection = require('../../connection.js');
require('../../../../.env');
require('mocha');
const promise = require('./test-promise')();
const timerlog = require('timerlog');


timerlog({disable_all: true});

connection.database = 'automated-tests';
Thing.database.connection = connection;

assert(schema.resource.npm_package_name.required);
schema.resource.npm_package_name.required = false;
Thing.schema = schema;

Thing.http_max_delay = 1;

describe('ThingDB management', () => {

    promise.it('can delete and re-create database schema', () =>
        (
            Thing.database.management.delete_all()
        )
        .then(() =>
            Thing.database.management.create_schema()
        )
    )
});
