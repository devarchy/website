const assert = require('assert');
const Promise_serial = require('promise-serial');
const connection = require('./database/connection');


module.exports = {
    recompute_things,
    events,
};


function recompute_things({filter_properties, filter_fct, dont_cascade_saving, close_connections_when_done, dont_apply_side_effects}={}) {
    const Thing = require('./');

    return (
        filter_properties ?
            Thing.database.load.things(filter_properties) :
            Thing.database.load.all_things()
    )
    .then(things => {
        if( ! filter_fct ) {
            return things;
        }
        return things.filter(filter_fct);
    })
    .then(things_to_fix => {
        console.log('recomputing '+things_to_fix.length+' things');
        return Promise_serial(things_to_fix.map(thing => () => thing.recompute({dont_cascade_saving, dont_apply_side_effects})), {log_progress: true});
    })
    .then(() => {
        if( close_connections_when_done ) {
            Thing.database.close_connections();
        }
    });
}

function events({map_row}) {
    const knex = connection();

    return (
        get_rows()
    )
    .then(rows => {
        const updates = rows.map(update_row).filter(Boolean);
        console.log('updating '+updates.length+' thing events');
        return Promise_serial(updates, {log_progress: true});
    });


    function update_row(row) {
        const changes = map_row(row);
        if( !changes ) {
            return null;
        }
        assert(row.id_row);
        const columns = Object.keys(changes);
        return () =>
            knex('thing_event')
            .where('id_row', '=', row.id_row)
            .update(changes);
            /*
            knex.raw(
                [
                    'UPDATE thing_event SET (',
                        columns.join(', '),
                    ')',
                    '= (',
                        columns.map(_ => '?').join(', '),
                    ')',
                    'WHERE',
                    'id_row = ?',
                ].join(' '),
                columns.map(col => changes[col]).push(row.id_row)
            );
            */
    }

    function get_rows() {
        return knex('thing_event').select('*');
    }
}

