const assert = require('assert');


module.exports = function (linear_info) {

    let categories = [];
    let category_ancestors = [];
    let category_last;
    const ids = {};

    linear_info
    .forEach(info => {
        if( info.type === 'link' ) {
            assert(category_last, JSON.stringify(info, null, 2));
            if( Object.keys(info.processed).length>0 ) {
                category_ancestors.forEach(c => c.number_of_all_resources++);
                category_last.resources.push(info.processed);
                category_last.last_line = info.raw_data.last_line;
            }
        }

        if( info.type === 'description' ) {
            assert(category_last);
            assert(category_last.header_description===null);
            category_last.header_description = info.raw_data.text;
            category_last.last_line = info.raw_data.last_line;
        }

        if( info.type === 'header' ) {
            const header_level = info.raw_data.header_level;

            category_ancestors = category_ancestors.filter(c => c.header_level < header_level);

            const parent_category_id = category_ancestors.length === 0 ? null : category_ancestors.slice(-1)[0].id;
            assert(parent_category_id || parent_category_id===null);

            const id = generate_id(info, parent_category_id);
            assert(ids[id]===undefined, id);
            ids[id] = true;

            const text = info.processed.as_web_catalog.text;
            assert(text);

            const category = {
                id,
                text,
                parent_category_id,
                header_level,
                header_description: null,
                resources: [],
                number_of_all_resources: 0,
                last_line: info.raw_data.last_line,
            };

            category_last = category;
            category_ancestors.push(category_last);
            categories.push(category);
            assert(category_ancestors.every((c, i) => i===0 || c.header_level > category_ancestors[i-1].header_level));
        }
    });

    categories = prune_empty_categories(categories);

    return categories;

    function prune_empty_categories(categories) { 

        categories = remove_empty(categories);
        categories = remove_useless_root(categories);

        return categories;

        function remove_empty(categories) {
            return categories.filter(c => c.number_of_all_resources>0);
        }

        function remove_useless_root(categories) {
            const root_categories = categories.filter(c => c.parent_category_id===null);
            assert(root_categories.length>0);
            if( root_categories.length!==1 ) {
                return categories;
            }
            const root_category = root_categories[0];
            assert(root_category.id);
            if( root_category.resources.length === 0 ) {
                categories = remove_root(categories);
            }
            return categories;

            function remove_root(categories) {
                categories = categories.filter(c => c.id !== root_category.id);
                categories.forEach(c => {
                    if( c.parent_category_id === root_category.id ) {
                        c.parent_category_id = null;
                    }
                });
                return categories;
            }
        }

    } 

    function generate_id(info, parent_category_id) { 
        const text = get_text(info);
        assert(!text.endsWith(' '), text);
        const clashes = (() => { 
            const clashes = {};
            const slugs = {};
            linear_info.filter(i => i.type==='header').forEach(i => {
                const slug = slugify(get_text(i));
                if( slugs[slug] ) {
                    clashes[slug] = true;
                }
                slugs[slug] = true;
            });
            return clashes;
        })(); 

        let id = slugify(text);
        if( clashes[id] && parent_category_id !== null ) {
            id = parent_category_id + '_' + id;
        }
        return id;

        function slugify(str) {
            const slug = str.toLowerCase().replace(/[^a-z0-9\s]/g,'').replace(/\s+/g,'-');
            assert(slug.split('-').every(p => p.length>0), slug);
            return slug;
        }

        function get_text(info) {
            return info.processed.as_web_catalog.text;
        }
    } 
};
