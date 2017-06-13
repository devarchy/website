const assert = require('assert');
const assert_hard = require('assert');


module.exports = (
    (
        linear_info,
        {
            mode='stric',
            categories_to_include=[],
            categories_to_exclude=[], // TODO
        }={}
    ) => {

        let categories = [];
        let category_ancestors = [];
        let category_last;
        const ids = {};

        linear_info
        .forEach(info => {
            assert(['link', 'description', 'header'].includes(info.type));

            if( info.type === 'link' ) {
                if( ! category_last ) {
                    const msg = "No category found for:\n"+JSON.stringify(info, null, 2);
                    assert_hard(mode!=='strict', msg);
                    if( mode!=='silent' ) {
                        console.warn(msg);
                    }
                }
                if( category_last && Object.keys(info.processed).length>0 ) {
                    category_ancestors.forEach(c => c.number_of_all_resources++);
                    assert(info.processed.as_website_url, JSON.stringify(info, null, 2));
                    category_last.resources.push(info.processed);
                    category_last.last_line = info.raw_data.last_line;
                }
            }

            if( info.type === 'description' ) {
                assert(category_last);
                assert(category_last.header_description===null, JSON.stringify(linear_info, null, 2)+'\n\n'+JSON.stringify(info, null, 2));
                category_last.header_description = info.raw_data.text;
                category_last.last_line = info.raw_data.last_line;
            }

            if( info.type === 'header' ) {
                const header_level = info.raw_data.header_level;

                category_ancestors = category_ancestors.filter(c => c.header_level < header_level);

                const parent_category_id = category_ancestors.length === 0 ? null : category_ancestors.slice(-1)[0].id;
                assert(parent_category_id || parent_category_id===null);

                const text = get_text(info);
                assert(text);

                const id = generate_id(text, parent_category_id);
                assert(ids[id]===undefined, id);
                ids[id] = true;

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

        if( categories_to_include.length > 0 ) {
            categories = select_categories({categories, categories_to_include});
        }

        categories = prune_top_level_resources({categories, categories_to_include});

        categories = prune_empty_categories({categories});

        return categories;

        function prune_empty_categories({categories}) { 

            categories = remove_empty(categories);
            categories = remove_useless_root(categories);

            return categories;

            function remove_empty(categories) {
                return categories.filter(c => c.number_of_all_resources>0);
            }

            function remove_useless_root(categories) {
                const root_categories = categories.filter(c => c.parent_category_id===null);
                assert(root_categories.length>0 || categories.length===0);
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

        function select_categories({categories, categories_to_include}) { 
            categories_to_include = categories_to_include.map(find_category_by_title);

            const categories_seleted = (
                categories
                .filter(category =>
                    categories_to_include.some(c_to_include =>
                        is_ancestor(c_to_include, category)
                    )
                )
            );

            categories_to_include.forEach(category => {
                category.parent_category_id = null;
            });

            assert(categories_seleted.length>0);

            return categories_seleted;

            function find_category_by_title(category_title) {
                const c = categories.filter(({text}) => {
                    assert(text);
                    return text===category_title;
                });
                assert(c.length===1);
                return c[0];
            }
            function is_ancestor(category_papa, category_child) {
                assert(category_papa.id);
                const pid = category_child.parent_category_id;
                if( category_papa.id===category_child.id ) {
                    return true;
                }
                if( category_papa.id===pid ) {
                    return true;
                }
                if( !pid ) {
                    return false;
                }
                return is_ancestor(category_papa, get_category(pid));
            }
            function get_category(category_id) {
                assert(category_id);
                const c = categories.filter(({id}) => id===category_id);
                assert(c.length===1);
                return c[0];
            }
        } 

        function prune_top_level_resources({categories, categories_to_include}) { 
            if( categories_to_include.length > 0 ) {
                return categories;
            }
            if( categories.length===1 ) {
                return categories;
            }

            const categories__root = (
                categories
                .filter(c => !c.parent_category_id)
            );

            if( categories__root.length !== 1 ) {
                return categories;
            }

            categories__root.forEach(c => {
                c.number_of_all_resources = c.number_of_all_resources - c.resources.length;
                c.resources = [];
            });

            return categories;
        } 

        function generate_id(text, parent_category_id) { 
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
                assert(str);
                const slug = str.toLowerCase().replace(/[^a-z0-9\s]/g,'').replace(/\s+/g,'-');
                assert(slug.split('-').every(p => p.length>0), slug);
                return slug;
            }
        } 

        function get_text(info) { 
            let text = info.raw_data.text;
            assert(text);
            text = text.trim();
            assert(text);
            return text;
        } 
    }
);
