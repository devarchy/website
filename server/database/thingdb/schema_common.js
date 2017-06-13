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
            test: v => validator.isUUID(v),
        },
        is_required: true,
        is_unique: true,
    },
    type: {
        validation: {
            type: String,
        },
        is_required: true,
    },
    is_removed: {
        validation: {
            type: Boolean,
        },
        is_required: true,
        default_value: false,
    },
    history: {
        validation: {
            type: Array,
        },
        is_not_user_generated: true,
        is_non_enumerable: true,
    },
    updated_at: {
        validation: {
            type: Date,
        },
        is_not_user_generated: true,
    },
    created_at: {
        validation: {
            type: Date,
        },
        is_not_user_generated: true,
    },
    computed_at: {
        validation: {
            type: Date,
        },
        is_not_user_generated: true,
    },
    views: {
        validation: {
            type: Array,
        },
        is_not_user_generated: true,
        is_non_enumerable: true,
    },
    subtype: {
        validation: {
            type: String,
        },
        is_not_user_generated: true,
        is_non_enumerable: true,
    },
};

module.exports = {
    thing: schema,
    draft: {
        author: schema.author,
        is_removed: schema.is_removed,
    },
};
