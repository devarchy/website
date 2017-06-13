module.exports = {
    user: { 
        _options: {
            is_required: ['name', 'url', ],
        },
        name: {
            validation: {
                type: String,
            },
            is_unique: true,
        },
        url: {
            validation: {
                type: String,
            },
            is_unique: true,
        },
        bio: {
            validation: {
                type: String,
            },
        },
    }, 
    resource: { 
        // having both the resource and the tag in the `views` property of tagged is enough to view resources of a tag
        // but it isn't enough to view resources in the intersection of several tags
        _options: {
            additional_views: [
                (thing_self, {Thing, transaction}) =>
                    Thing.database.load.load_things_by_props(
                        {
                            type: 'tagged',
                            referred_resource: thing_self.id,
                            is_removed: false,
                        },
                        {transaction}
                    )
                    .then(({things_matched: things_tagged}) =>
                        things_tagged.map(thing_tagged => thing_tagged.referred_tag)
                    )
            ],
        },
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
                test: val => {
                    if( ! val.includes('://') ) {
                        throw new Error('missing `://`');
                    }
                    if( ! val.startsWith('http') ) {
                        return false;
                    }
                    return true;
                },
            },
            is_unique: true,
        },
        serial_number: {
            validation: {
                type: String,
            },
            is_unique: true,
        },
        tags: {
            validation: {
                type: Array,
            },
            is_required: true,
            is_async: true,
            value: (thing_self, {transaction, Thing}) => {
                const tags = [];
                return (
                    Thing.database.load.view([{id: thing_self.id}], {transaction})
                    .then(related_things => {
                        related_things
                        .filter(thing => thing.type === 'tag')
                        .forEach(({name}) => tags.push(name));
                    })
                    .then(() => tags)
                );
            },
        },
        is_reviewed: {
            validation: {
                type: Boolean,
            },
            is_required: true,
            default_value: false,
        },
    }, 
    tag: { 
        name: {
            validation: {
                type: String,
            },
            is_unique: true,
            is_required: true,
        },
        description: {
            validation: {
                type: String,
            },
        },
        title: {
            validation: {
                type: String,
            },
        },
        info: {
            validation: {
                type: Object,
            },
            required_props: ['url'],
        },
    }, 
    tagged: { 
        _options: {
            is_unique: ['referred_tag', 'referred_resource', ],
        },
        referred_tag: {
            validation: {
                type: 'Thing.tag',
            },
            is_required: true,
            immutable: true,
            add_to_view: true,
        },
        referred_resource: {
            validation: {
                type: 'Thing.resource',
            },
            is_required: true,
            immutable: true,
            add_to_view: true,
            cascade_save: true,
        },
    }, 
};
