const validator = require('validator');
// schema common to all Thing types

const schema = {
    author: {
        validation: {
            type: 'Thing.user',
        },
        is_required: true,
    },
    id: {
        validation: {
            type: String,
        },
        test: v => validator.isUUID(v),
        is_required: true,
    },
    type: {
        validation: {
            type: String,
        },
        is_required: true,
    },
    removed: {
        validation: {
            type: Boolean,
        },
    },
    history: {
        validation: {
            type: Array,
        },
    },
    updated_at: {
        validation: {
            type: Date,
        },
    },
    created_at: {
        validation: {
            type: Date,
        },
    },
    computed_at: {
        validation: {
            type: Date,
        },
    },
    views: {
        validation: {
            type: Array,
        },
    },
};

module.exports = {
    thing: schema,
    draft: {
        author: schema.author,
        removed: schema.removed,
    },
};
