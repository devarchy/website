"use strict";
const knex_module = require('knex');


let knex;

module.exports = function(){

    if( ! knex ) {

        const Thing = require('../index.js');

        if( ! Thing.database.connection ) {
            throw new Error('ThingDB: database connection required, i.e. `Thing.database.connection` should defined');
        }

        knex = knex_module({
            dialect: 'postgres',
            connection: Thing.database.connection,
        });

    }

    return knex;

};
