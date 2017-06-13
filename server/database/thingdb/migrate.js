const assert = require('assert');
const assert_hard = require('assert');
const assert_soft = require('assertion-soft');
const Promise_serial = require('promise-serial');


module.exports = {
    recompute_things,
    events,
    rename_column,
};


function recompute_things({
    Thing,
    filter_properties,
    filter_fct,
    dont_cascade_saving,
    close_connections_when_done,
    dont_apply_side_effects,
    dont_throw,
    schema__args={},
}={}) { 
    assert(Thing);

    assert_soft(!(schema__args.cache_expiration_limit===undefined && 'cache_expiration_limit' in schema__args), schema__args, filter_properties);
    schema__args.cache_expiration_limit = (
        'cache_expiration_limit' in schema__args ? schema__args.cache_expiration_limit : -1
    );

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
        if( ! schema__args.is_a_test_run ) {
            console.log('recomputing '+things_to_fix.length+' things');
        }
        return Promise_serial(
            things_to_fix.map(thing => () => {
                return (
                    thing
                    .recompute({dont_cascade_saving, dont_apply_side_effects, remove_non_schema_props: true, skip_non_schema_types: true, schema__args})
                    .then(() => {})
                    .catch(err => {
                        if( dont_throw ) {
                            console.error(err);
                        } else {
                            throw err;
                        }
                    })
                );
            }),
            {log_progress: true}
        );
    })
    .then(() => {
        if( close_connections_when_done ) {
            return Thing.database.close_connections();
        }
    });
} 

function events({db_handle, map_row}) { 
    assert(db_handle);
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
            db_handle('thing_event')
            .where('id_row', '=', row.id_row)
            .update(changes);
            /*
            db_handle.raw(
                [
                    'UPDATE thing_event SET (',
                        columns.join(', '),
                    ')',
                    '= (',
                        columns.map(_ => '?').join(', '),
                    ')'
                    'WHERE',
                    'id_row = ?',
                ].join(' '),
                columns.map(col => changes[col]).push(row.id_row)
            );
            */
    }

    function get_rows() {
        return db_handle('thing_event').select('*');
    }
} 

function rename_column({Thing, db_handle, table, from, to, close_connections_when_done}) { 
    assert_hard(Thing);
    assert_hard(db_handle);
    assert_hard(table);
    assert_hard(from);
    assert_hard(to);
    return (
        db_handle.schema.table(table, function (table) {
            table.renameColumn(from, to);
        })
    )
    .then(() => {
        console.log('column `'+from+'` successfully renamed to `'+to+'`');
    })
    .catch(err => {
        if( (err.message||'').includes('column "'+from+'" does not exist') ) {
            console.log('column `'+from+'` doesn\'t exist (is it already renamed to `'+to+'`?)');
            return;
        }
        throw err;
    })
    .then(() => {
        if( close_connections_when_done ) {
            return Thing.database.close_connections();
        }
    });
} 

