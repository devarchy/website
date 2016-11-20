module.exports = {
    user: {
        name: {
            validation: {
                type: String,
            },
            is_unique: true,
        },
    },
    resource: {
        name: {
            validation: {
                type: String,
            },
            is_unique: false, // we use `name_normalized` to ensure a stronger uniquness requirement
            is_required: true,
        },
        name_normalized: {
            validation: {
                type: String,
                test: val => /^[a-zA-Z0-9_]+$/.test(val),
            },
            value: thing_self => thing_self.name.toLowerCase().replace(/\s/g,'_').replace(/[^a-z0-9_]/g,''),
            is_async: false,
            is_unique: true,
        },
        url: {
            validation: {
                type: String,
                test: val => val.startsWith('http'),
            },
            is_unique: true,
        },
        serial_number: {
            validation: {
                type: String,
            },
            is_unique: true,
        },
    },
};
